/*
 * Boots one page, in its own process, and prints the result as JSON.
 *
 * One process per boot is not a performance choice, it is the only correct one. ES modules are
 * cached per process by URL, and a module's *dependencies* resolve to unqueried URLs, so a second
 * import of entry.js in the same process re-executes nothing: the second boot silently inherits
 * the first one's module graph.
 *
 * That is not a theoretical concern. It was found here by a test that was supposed to fail: a boot
 * that deliberately omits /bundles/jquery kept passing, because the jQuery shim had already been
 * evaluated successfully by the previous boot. And in the other direction, once the shim had been
 * evaluated WITHOUT jQuery, every later boot in that process failed with the cached error even
 * though jQuery was present. Both directions give a confident, wrong answer.
 *
 * Invoked by boot() in _dom.js; not run directly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

import { JSDOM } from 'jsdom';

import { ASSETS, WWWROOT } from '../paths.mjs';
import { layoutScripts } from './_layout-scripts.js';

register('./_assets-hook.mjs', import.meta.url, {
    data: { base: pathToFileURL(ASSETS).href.replace(/\/$/, '') },
});

const spec = JSON.parse(process.argv[2]);

/*
 * The browser surface jsdom does not provide, kept deliberately small. A stub must never be more
 * generous than the real thing: a lenient stub turns a test green for the wrong reason, which is
 * worse than no test. Each entry exists because something in the shipped code touches it during
 * boot, and the note says what.
 */
function installStubs(window, extra) {
    // enquire.js throws "matchMedia not present" on construction, and views/page-view reaches it
    // transitively through modules/animate. Reporting no match is enough to get the module loaded.
    window.matchMedia ??= (query) => ({
        media: query, matches: false,
        addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {},
        onchange: null, dispatchEvent: () => false,
    });

    // modules/gtm-helper pushes to it. An array is what the real dataLayer is before GTM loads.
    window.dataLayer ??= [];

    // jsdom implements neither, and several views call them on open/close.
    window.scrollTo ??= () => {};
    window.HTMLElement.prototype.scrollIntoView ??= function scrollIntoView() {};

    Object.assign(window, extra ?? {});
}

const dom = new JSDOM(
    `<!doctype html><html><head></head><body ${spec.bodyAttrs ?? ''}>${spec.body ?? ''}</body></html>`,
    { url: 'https://nursingworld.org/', pretendToBeVisual: true, runScripts: 'outside-only' }
);

const { window } = dom;

installStubs(window, spec.stubs);

const errors = [];
const warnings = [];
const logs = [];

/*
 * Captured on BOTH consoles, deliberately.
 *
 * Classic scripts evaluated into the window use window.console. The ES modules run in Node's realm
 * and call bare `console.*`, which is globalThis.console. Overriding only the window one looked
 * like it worked -- every boot reported zero errors -- because the module realm's output, which is
 * where jit-require reports a failed module, was going straight to the real stdout and being
 * counted as nothing. A test asserting "no errors" was then asserting almost nothing.
 */
const record = (sink) => (...a) => sink.push(a.map(String).join(' '));

for (const target of [window.console, globalThis.console]) {
    target.error = record(errors);
    target.warn = record(warnings);
    target.log = record(logs);
}
window.addEventListener('error', (e) => errors.push(`uncaught: ${e.message ?? e.error}`));
window.addEventListener('unhandledrejection', (e) => errors.push(`unhandled rejection: ${e.reason}`));

/*
 * The modules run in Node's realm and reach the DOM through these globals -- which is how the
 * shipped code reaches it anyway: it reads `document` and `window`, never an injected handle.
 */
const GLOBALS = [
    // `self` is window.self in a browser and the bundler runtime uses it. eslint deliberately does
    // not declare it for source files so no-undef still catches a bare `self` where
    // `const self = this` was lost (item 28) -- a source rule, unrelated to the runtime.
    'self', 'top', 'parent', 'frames',
    'window', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage',
    'HTMLElement', 'Element', 'Node', 'NodeList', 'Event', 'CustomEvent', 'MouseEvent',
    'KeyboardEvent', 'FormData', 'XMLHttpRequest', 'getComputedStyle', 'requestAnimationFrame',
    'cancelAnimationFrame', 'matchMedia', 'IntersectionObserver', 'MutationObserver',
    'ResizeObserver', 'DOMParser', 'Image',
];

for (const key of GLOBALS) {
    if (window[key] === undefined) continue;
    // navigator and friends are getter-only on globalThis in Node 24, so assignment throws.
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
}

/*
 * DOMContentLoaded instrumentation, installed before any script runs.
 *
 * OJIN's five modules self-initialise by registering a DOMContentLoaded listener with no
 * readyState guard, so "did they run" cannot be answered by looking at the DOM -- their visible
 * effects are all behind clicks and resizes. It is answered here instead, by counting the
 * listeners registered and wrapping each so an invocation and a throw are both recorded.
 *
 * This also pins the timing. jsdom's readyState is 'loading' only until the end of the tick in
 * which the document was constructed, so a harness that awaited anything before evaluating these
 * classic scripts would register the listeners too late and they would never fire -- leaving the
 * "boots with no errors" assertion technically true and completely vacuous. `registered` and
 * `invoked` being equal and non-zero is what rules that out.
 */
const dclSeen = { registered: 0, invoked: 0, threw: [] };
const realAdd = window.document.addEventListener.bind(window.document);

window.document.addEventListener = function addEventListener(type, listener, ...rest) {
    if (type !== 'DOMContentLoaded' || typeof listener !== 'function') {
        return realAdd(type, listener, ...rest);
    }

    dclSeen.registered += 1;

    return realAdd(type, function wrapped(...args) {
        dclSeen.invoked += 1;

        try { return listener.apply(this, args); }
        catch (e) { dclSeen.threw.push(e.message); return undefined; }
    }, ...rest);
};

const scripts = layoutScripts(path.dirname(WWWROOT), ASSETS, spec.layout);
const loaded = [];
const skipped = [];

for (const s of scripts) {
    if (s.external) { skipped.push(`${s.src} (external)`); continue; }
    if ((spec.skip ?? []).includes(s.src)) { skipped.push(`${s.src} (skipped by the test)`); continue; }

    if (!s.file || !fs.existsSync(s.file)) {
        errors.push(`layout asks for ${s.src} but no file backs it`);
        continue;
    }

    try {
        if (s.module) await import(pathToFileURL(s.file).href);
        else window.eval(fs.readFileSync(s.file, 'utf8'));

        loaded.push(s.src);
    }
    catch (e) {
        errors.push(`${s.module ? 'importing' : 'evaluating'} ${s.src} threw: ${e.message}`);
    }

    // Classic globals must be visible to the modules that come after: the jQuery shim reads
    // window.jQuery at module-evaluation time (item 23).
    for (const key of ['jQuery', '$', 'Modernizr', 'bootstrap', 'Swiper', 'AOS']) {
        if (window[key] !== undefined) {
            Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
        }
    }
}

/*
 * Page-specific scripts the LAYOUT does not render. HNHN's four (search, sign-up, questionnaire,
 * auto-complete) are each included by one page's own view, after the _Root chain, so a test asking
 * for one gets the real order: vendor globals first, then hnhn-scripts, then the page script.
 */
for (const rel of spec.extraScripts ?? []) {
    const file = path.join(ASSETS, rel.replace(/^\/?assets\//, ''));

    if (!fs.existsSync(file)) {
        errors.push(`test asked for ${rel} but no file backs it`);
        continue;
    }

    try {
        window.eval(fs.readFileSync(file, 'utf8'));
        loaded.push(rel);
    }
    catch (e) {
        errors.push(`evaluating ${rel} threw: ${e.message}`);
    }
}

// Let jit-require's dynamic imports and any ready handlers settle.
await new Promise((r) => setTimeout(r, 400));

/*
 * The window cannot cross a process boundary, so a test asks for what it needs by name:
 * `probe.counts` are selectors to count, `probe.globals` are window keys to report as present.
 */
const probe = spec.probe ?? {};
const counts = {};
const globals = {};

for (const [name, selector] of Object.entries(probe.counts ?? {})) {
    counts[name] = window.document.querySelectorAll(selector).length;
}

for (const key of probe.globals ?? []) {
    globals[key] = window[key] !== undefined;
}

/* jQuery plugin functions -- how Foundation reports itself installed ($.fn.foundation). */
const jqFns = {};

for (const name of probe.jqFns ?? []) {
    jqFns[name] = typeof window.$?.fn?.[name] === 'function';
}

/*
 * jQuery .data() keys. CDC's ModuleController records each module it instantiated under
 * `module-ref` on the element, so the keys are the names of the modules that actually loaded.
 */
const jqData = {};

for (const [name, [selector, key]] of Object.entries(probe.jqData ?? {})) {
    const el = window.document.querySelector(selector);
    const value = el && window.$ ? window.$(el).data(key) : undefined;

    jqData[name] = value && typeof value === 'object' ? Object.keys(value).sort() : null;
}

const classes = {};

for (const [name, [selector, cls]] of Object.entries(probe.classes ?? {})) {
    classes[name] = window.document.querySelector(selector)?.classList.contains(cls) ?? null;
}

process.stdout.write(JSON.stringify({
    errors, warnings, logs, loaded, skipped, counts, globals, jqFns, jqData, classes,
    domContentLoaded: dclSeen,
    scripts: scripts.map(({ src, module, external }) => ({ src, module, external })),
}));

// jsdom keeps timers alive; nothing more is going to happen.
process.exit(0);
