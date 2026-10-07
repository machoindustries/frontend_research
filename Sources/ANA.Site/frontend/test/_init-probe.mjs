/*
 * Initialises one module against a supplied fixture and reports what happened.
 *
 * The workhorse for D2.1's remaining fixtures and for D3's behaviour checks. One module per
 * process, because re-importing the same module in one process re-executes nothing (see _dom.js).
 *
 * Takes a JSON spec on argv:
 *   ref        module to load, e.g. "src/views/product-detail-view"
 *   html       fixture markup placed inside <body>
 *   selector   element to init against; defaults to the fixture root
 *   data       the second argument to init(), standing in for $el.data()
 *   globals    extra window globals, each needing a reason in the calling test
 *   readyState force document.readyState before import
 *   actions    interactions to perform after init: { click, submit, dispatch, value }
 *   probe      { counts, attrs, classes, globals, html } to read back afterwards
 *
 * Everything the page itself provides -- jQuery, Modernizr -- is loaded as a classic script first,
 * in the order _Base.cshtml loads it. Nothing else is stubbed unless a test asks, so a module that
 * needs a library the page does not load says so rather than being propped up.
 */

import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

import { JSDOM } from 'jsdom';

import { ASSETS } from '../paths.mjs';

register('./_assets-hook.mjs', import.meta.url, {
    data: { base: pathToFileURL(ASSETS).href.replace(/\/$/, '') },
});

const spec = JSON.parse(process.argv[2]);

const out = {
    ref: spec.ref,
    imported: false,
    initOk: false,
    error: null,
    at: null,
    rejections: [],
    errors: [],
    warnings: [],
    counts: {},
    attrs: {},
    classes: {},
    globals: {},
    html: null,
};

process.on('unhandledRejection', (reason) => {
    // Recorded, not fatal: several views start an API request during init and there is no server.
    out.rejections.push(String(reason?.message ?? reason).split('\n')[0]);
});

/*
 * bodyAttrs matters: modules/gtm-helper reads page-level data off the <body> element's
 * data-logged-in-user-* attributes, so four of these views fail on a bare body no matter what
 * markup the fixture contains. _Base.cshtml renders them on every page.
 */
const dom = new JSDOM(
    `<!doctype html><html><head></head><body ${spec.bodyAttrs ?? ''}>${spec.html ?? ''}</body></html>`, {
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

Object.assign(window, spec.globals ?? {});

if (spec.readyState) {
    Object.defineProperty(window.document, 'readyState', { value: spec.readyState, configurable: true });
}

const record = (sink) => (...a) => sink.push(a.map(String).join(' '));

// Both realms: classic scripts use window.console, the ES modules use Node's (see _boot-worker).
for (const target of [window.console, globalThis.console]) {
    target.error = record(out.errors);
    target.warn = record(out.warnings);
}

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

window.eval(fs.readFileSync(path.join(ASSETS, 'js/jquery.min.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(ASSETS, 'js/modernizr-custom.js'), 'utf8'));

for (const key of ['jQuery', '$', 'Modernizr']) {
    if (window[key] !== undefined) {
        Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
    }
}

const $ = window.jQuery;

try {
    const mod = await import(`/assets/js/${spec.ref}.js`);

    out.imported = true;

    const target = spec.selector
        ? window.document.querySelector(spec.selector)
        : window.document.body.firstElementChild ?? window.document.body;

    if (!target) throw new Error(`fixture has no element matching ${spec.selector}`);

    const instance = mod.default();

    instance.init($(target), spec.data ?? {});
    out.initOk = true;

    await new Promise((r) => setTimeout(r, 150));

    // --- interactions ---
    for (const action of spec.actions ?? []) {
        const el = window.document.querySelector(action.selector);

        if (!el) { out.errors.push(`action target missing: ${action.selector}`); continue; }

        if (action.value !== undefined) el.value = action.value;
        if (action.checked !== undefined) el.checked = action.checked;

        if (action.click) el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
        if (action.submit) el.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
        if (action.dispatch) el.dispatchEvent(new window.Event(action.dispatch, { bubbles: true }));

        await new Promise((r) => setTimeout(r, action.wait ?? 120));
    }
}
catch (e) {
    out.error = `${e.message.split('\n')[0]}`;
    // The first frame inside the built output: says which module threw, which is what makes a
    // fixture gap diagnosable instead of a guessing game.
    out.at = (e.stack ?? '').split('\n').find((l) => l.includes('/wwwroot/assets/'))?.trim().slice(0, 150) ?? null;
}

// --- read back ---
const p = spec.probe ?? {};

for (const [name, selector] of Object.entries(p.counts ?? {})) {
    out.counts[name] = window.document.querySelectorAll(selector).length;
}

for (const [name, [selector, attr]] of Object.entries(p.attrs ?? {})) {
    out.attrs[name] = window.document.querySelector(selector)?.getAttribute(attr) ?? null;
}

for (const [name, [selector, cls]] of Object.entries(p.classes ?? {})) {
    const el = window.document.querySelector(selector);

    out.classes[name] = el ? el.classList.contains(cls) : null;
}

for (const key of p.globals ?? []) {
    out.globals[key] = window[key] !== undefined;
}

if (p.html) out.html = window.document.querySelector(p.html)?.innerHTML?.slice(0, 400) ?? null;

process.stdout.write(JSON.stringify(out));
process.exit(0);
