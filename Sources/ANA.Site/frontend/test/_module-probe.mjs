/*
 * Imports every live data-require module and reports, per module, how far it gets.
 *
 * Run in one process rather than one per module: these are 55 *different* modules, so the ESM
 * cache that makes re-booting the same entry point useless (see _dom.js) does not apply. They do
 * share chunks and a global-emitter singleton, which was checked — the results here match what
 * each module does when imported alone in a fresh process.
 *
 * The environment is what _Base.cshtml actually provides: jQuery and Modernizr as classic scripts
 * before anything else. Nothing more is stubbed, so a module that needs a library the page does
 * not load reports that rather than being quietly propped up.
 *
 * Invoked by module-contract.slow.test.js; not run directly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

import { JSDOM } from 'jsdom';

import { ASSETS, WWWROOT } from '../paths.mjs';

register('./_assets-hook.mjs', import.meta.url, {
    data: { base: pathToFileURL(ASSETS).href.replace(/\/$/, '') },
});

const SITE_ROOT = path.dirname(WWWROOT);

/** Every data-require value live markup renders, with the views that render it. */
function liveTargets() {
    const found = new Map();

    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);

            if (e.isDirectory()) {
                if (!['bin', 'obj', 'node_modules', '.git', 'wwwroot', 'frontend'].includes(e.name)) walk(full);
            }
            else if (e.name.endsWith('.cshtml')) {
                // Razor comments hold dead attributes; they are not rendered.
                const text = fs.readFileSync(full, 'utf8').replace(/@\*[\s\S]*?\*@/g, '');

                for (const m of text.matchAll(/data-require\s*=\s*"([^"]+)"/g)) {
                    for (const raw of m[1].split(/\s+/).filter(Boolean)) {
                        const ref = raw.replace(/^\.\//, '');

                        if (!found.has(ref)) found.set(ref, new Set());
                        found.get(ref).add(path.relative(SITE_ROOT, full));
                    }
                }
            }
        }
    };

    walk(SITE_ROOT);

    return found;
}

const dom = new JSDOM('<!doctype html><html><body><div id="fixture"></div></body></html>', {
    url: 'https://nursingworld.org/',
    pretendToBeVisual: true,
});

const { window } = dom;

window.matchMedia ??= () => ({
    matches: false,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
});
window.dataLayer ??= [];
window.scrollTo ??= () => {};
window.HTMLElement.prototype.scrollIntoView ??= function scrollIntoView() {};

for (const key of [
    'self', 'window', 'document', 'navigator', 'location', 'history', 'localStorage',
    'sessionStorage', 'HTMLElement', 'Element', 'Node', 'NodeList', 'Event', 'CustomEvent',
    'MouseEvent', 'KeyboardEvent', 'FormData', 'XMLHttpRequest', 'getComputedStyle',
    'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia', 'DOMParser', 'Image',
    'MutationObserver',
]) {
    if (window[key] === undefined) continue;
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
}

// Exactly what _Base loads before the module entry, in that order.
window.eval(fs.readFileSync(path.join(ASSETS, 'js/jquery.min.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(ASSETS, 'js/modernizr-custom.js'), 'utf8'));

for (const key of ['jQuery', '$', 'Modernizr']) {
    if (window[key] !== undefined) {
        Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
    }
}


/*
 * D2.2 -- the global emitter and the loading spinner.
 *
 * Both live only as shared chunks under js/chunks/ with hashed names, not as per-module entries,
 * so they are found by glob and identified by SHAPE: the minifier renames their exports (the
 * emitter chunk ends `var e=new t;export{e as t}`), so matching on an export name would break on
 * the next build.
 *
 * Wrapping the instance's own emit() is what makes this a real check: 92 modules share that one
 * object, so every payload any of them emits during the inits below passes through here.
 */
function findChunk(prefix) {
    const dir = path.join(ASSETS, 'js/chunks');
    const hit = fs.readdirSync(dir).find((f) => f.startsWith(`${prefix}-`) && f.endsWith('.js'));

    return hit ? path.join(dir, hit) : null;
}

const emitted = [];
let emitterFound = false;

const emitterChunk = findChunk('global-emitter');

if (emitterChunk) {
    const mod = await import(pathToFileURL(emitterChunk).href);
    const emitter = Object.values(mod).find((v) => v && typeof v.emit === 'function' && typeof v.on === 'function');

    if (emitter) {
        emitterFound = true;

        const original = emitter.emit.bind(emitter);

        emitter.emit = function wrapped(event, ...args) {
            for (const arg of args) {
                if (arg === window) emitted.push({ event: String(event), payload: 'window' });
            }

            return original(event, ...args);
        };
    }
}

/*
 * Item 28's shape: a singleton whose constructor returned `window` because `const self = this` had
 * been lost. The guard is that an instance is an instance, and still has the API its 52 callers
 * use.
 */
const spinner = { found: false, isWindow: null, hasRequest: null, hasRelease: null };
const spinnerChunk = findChunk('loading-spinner');

if (spinnerChunk) {
    const mod = await import(pathToFileURL(spinnerChunk).href);
    const Klass = Object.values(mod).find((v) => typeof v === 'function' && v.prototype && typeof v.prototype.request === 'function');

    if (Klass) {
        const instance = new Klass();

        spinner.found = true;
        spinner.isWindow = instance === window;
        spinner.hasRequest = typeof instance.request === 'function';
        spinner.hasRelease = typeof instance.release === 'function';
    }
}

const results = {};

for (const [ref, views] of [...liveTargets()].sort()) {
    const row = { views: [...views].sort(), imported: false, isFactory: false, hasInit: false, initOk: false, error: null };

    results[ref] = row;

    let mod;

    try { mod = await import(`/assets/js/${ref}.js`); }
    catch (e) { row.error = `import: ${e.message.split('\n')[0]}`; continue; }

    row.imported = true;

    if (typeof mod.default !== 'function') {
        row.error = `default export is ${typeof mod.default}, not a function`;
        continue;
    }

    let instance;

    // Called WITHOUT new: jit-require does `mod.default()`, and several of these export arrow
    // functions, which throw when constructed.
    try { instance = mod.default(); }
    catch (e) { row.error = `factory: ${e.message.split('\n')[0]}`; continue; }

    row.isFactory = true;
    // Item 28: a factory that returns window instead of a component. Silent — the page just has
    // one dead component — so it has to be asserted rather than noticed.
    row.returnedWindow = instance === window;

    if (!instance || typeof instance.init !== 'function') {
        row.error = 'the factory returned something with no init()';
        continue;
    }

    row.hasInit = true;

    // A bare element and empty data: the floor. A module needing more says so in its error.
    const el = window.document.createElement('div');

    window.document.getElementById('fixture').appendChild(el);

    try {
        instance.init(window.jQuery(el), {});
        row.initOk = true;
    }
    catch (e) {
        row.error = `init: ${e.message.split('\n')[0]}`;
    }
}

process.stdout.write(JSON.stringify({ modules: results, emitted, emitterFound, spinner }));
process.exit(0);
