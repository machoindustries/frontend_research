/*
 * Boots one view with document.readyState forced, and reports whether its deferred callback ran.
 *
 * D2.3's subject is modules/on-window-load, which exists because of a real regression (item 24).
 * `window.load` fires once and is never replayed, and entry.js is now a deferred module whose
 * views arrive later still via dynamic import() -- so by the time a view initialises, load has
 * usually already fired and `$(window).on('load', …)` would never run. carousel-view and
 * gallery-view are the two views that wait on it.
 *
 * readyState has to be set BEFORE the view is imported and initialised, and it cannot be changed
 * back, so each branch gets its own process (argv: <ref> <readyState>).
 *
 * The observable is owlCarousel: both callbacks call it on a jQuery collection, so a counting stub
 * on $.fn.owlCarousel says whether the callback body ran. It is installed after the import and
 * before init, so the real plugin still registers itself first -- a test that stubbed it earlier
 * could pass against a module that never loaded Owl at all.
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

const [ref, readyState] = process.argv.slice(2);

/*
 * Recorded rather than fatal. Several views start an API request during init which rejects here --
 * there is no server -- and an unhandled rejection would kill the probe before it could report
 * anything, turning a module's ordinary async behaviour into a test crash.
 */
const rejections = [];

process.on('unhandledRejection', (reason) => {
    rejections.push(String(reason?.message ?? reason).split('\n')[0]);
});

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

/*
 * For the already-loaded branch, jsdom's OWN load event must fire and pass BEFORE the view is
 * imported. That is item 24's actual condition: load is in the past by the time jit-require's
 * dynamic import resolves.
 *
 * Getting this wrong made the test vacuous. Without the wait, a view registering a bare
 * `$(window).on('load', …)` still caught jsdom's load firing a moment later, so deleting
 * on-window-load's readyState branch — recreating item 24 exactly — left the test green.
 */
let loadAlreadyFired = false;

if (readyState === 'complete') {
    await new Promise((resolve) => {
        if (window.document.readyState === 'complete') { resolve(); return; }

        window.addEventListener('load', resolve, { once: true });
        setTimeout(resolve, 500);
    });

    // A further tick so any handler jsdom queued for that event has run and the event is done.
    await new Promise((r) => setTimeout(r, 50));
    loadAlreadyFired = true;
}

// Then pin readyState, so the branch under test is the one the argv asked for.
Object.defineProperty(window.document, 'readyState', { value: readyState, configurable: true });

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

const out = { ref, readyState, rejections, loadAlreadyFired: false, imported: false, owlRegisteredByModule: false, calls: 0, afterLoadEvent: 0, error: null };

try {
    const mod = await import(`/assets/js/${ref}.js`);

    out.imported = true;

    // The real plugin must have registered itself; otherwise the stub below would be measuring
    // nothing but its own existence.
    out.owlRegisteredByModule = typeof window.jQuery.fn.owlCarousel === 'function';

    window.jQuery.fn.owlCarousel = function countingStub() {
        out.calls += 1;

        return this;
    };

    const el = window.document.getElementById('fixture');

    mod.default().init(window.jQuery(el), {});

    // Let the setTimeout(…, 0) in the already-complete branch run.
    await new Promise((r) => setTimeout(r, 150));

    out.callsBeforeLoadEvent = out.calls;
    out.loadAlreadyFired = loadAlreadyFired;

    /*
     * Only the not-yet-loaded branch gets a load event. The already-loaded branch must have run on
     * its own: dispatching one there would let a bare `.on('load', …)` pass and prove nothing.
     */
    if (readyState !== 'complete') {
        window.dispatchEvent(new window.Event('load'));
        await new Promise((r) => setTimeout(r, 150));
    }

    out.afterLoadEvent = out.calls;
}
catch (e) {
    out.error = e.message.split('\n')[0];
}

process.stdout.write(JSON.stringify(out));
process.exit(0);
