/*
 * D2.1 (steps 1 and 2) -- every module Razor renders imports, is a usable factory, and initialises.
 *
 * jit-require does exactly three things with a data-require value: imports the module, calls
 * `mod.default()` WITHOUT new, and calls `.init($el, data)` on what comes back. Each step can fail
 * silently in production: the failure is caught, logged to a console nobody is reading, and the
 * page renders fine with one component that never woke up. Items 23, 24 and 27 were all this.
 *
 * Two layers here, split because they cost very different amounts:
 *
 *   The CONTRACT -- imports, is a factory, returns an object with init -- holds for all 55 with no
 *   fixture work at all. That is the cheap, high-value floor and it is asserted for every module.
 *
 *   INITIALISING against a bare element holds for 48 of 55. The other 7 are listed below with the
 *   reason, and asserted in BOTH directions: a module that starts passing fails the test so it
 *   gets promoted. That is how the arrow-constructor fix reported itself -- the 12 modules it had
 *   been blocking all failed at once, naming each view to move. All 7 that remain have fixtures in
 *   view-fixtures.slow.test.js, so between the two files every one of the 55 is initialised.
 *
 * Proven able to fail: moving any entry out of the two maps below turns the relevant assertion red.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as assert from './_assert.js';

console.log('module contract -- every data-require target imports, builds and initialises');

const HERE = path.dirname(fileURLToPath(import.meta.url));

const probe = JSON.parse(execFileSync(
    process.execPath,
    [path.join(HERE, '_module-probe.mjs')],
    { cwd: path.dirname(HERE), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
));

const results = probe.modules;

const refs = Object.keys(results).sort();

/*
 * The arrow-constructor bug is FIXED, so there is no blocked list any more.
 *
 * For the record, since this file is where it was found: 12 of these views used to fail here
 * because they called `new SomeComponent(...)` on a module whose default export is an arrow
 * factory -- and `new` on an arrow throws "X is not a constructor" unconditionally. The factories
 * already did the `new` internally, so the call sites were double-constructing. 29 such call sites
 * across 22 files; the fix was to drop the keyword, which also matches how jit-require itself calls
 * these modules.
 *
 * It was invisible in production: jit-require caught the throw, logged console.error, and the page
 * rendered with its add/update lightbox silently dead. Pre-existing at the merge-base (844de8487),
 * not introduced by the Vite migration.
 *
 * The two-way assertions below are what reported it fixed: all 12 entries failed at once with
 * "if this FAILS the bug was fixed", naming each view to promote.
 */

/*
 * Genuinely need more than a bare <div>. All seven now HAVE fixtures, in
 * view-fixtures.slow.test.js, where each one's required markup is recorded. They stay listed here
 * because this file asserts the bare-element floor: these are the views that do not meet it.
 */
const NEEDS_FIXTURE = {
    'src/views/page-view': 'the body element with its data-logged-in-user-* attributes. ' +
        'D1.1 in dom-boot.slow.test.js already proves it initialises that way.',
    'src/views/form-view': 'jQuery Validate ($.validator.addMethod), which the page loads from ' +
        'outside the bundle.',
    'src/views/product-detail-view': 'page data Razor injects; reads .length off it.',
    'src/views/product-listing-view': 'page data Razor injects; reads .length off it.',
    'src/views/order-confirmation-page-view': 'order data Razor injects; reads .length off it.',
    'src/views/testimony-slider-view': 'a data attribute it calls .replace() on.',
    'src/views/account-continuing-education-awards-view': 'a container element to appendChild into.',
};

const excluded = { ...NEEDS_FIXTURE };

// --- step 1: the contract, for all 55 ----------------------------------------------------------

assert.ok(refs.length >= 55,
    `found every live data-require target (${refs.length})`);

const notImported = refs.filter((r) => !results[r].imported);

assert.equal(notImported.length, 0,
    'every module Razor renders imports from the URL jit-require builds' +
    (notImported.length ? ':\n  ' + notImported.map((r) => `${r} — ${results[r].error}`).join('\n  ') : ''));

/*
 * Called without `new`, because that is what jit-require does. A module whose default export needs
 * constructing would throw there and nowhere else -- which is precisely the bug the 12 above hit
 * one level down.
 */
const notFactories = refs.filter((r) => results[r].imported && !results[r].isFactory);

assert.equal(notFactories.length, 0,
    'every default export is callable without `new`, the way jit-require calls it' +
    (notFactories.length ? ':\n  ' + notFactories.map((r) => `${r} — ${results[r].error}`).join('\n  ') : ''));

const noInit = refs.filter((r) => results[r].isFactory && !results[r].hasInit);

assert.equal(noInit.length, 0,
    'every factory returns an object with an init() for jit-require to call' +
    (noInit.length ? ':\n  ' + noInit.map((r) => `${r} — ${results[r].error}`).join('\n  ') : ''));

// --- step 2: initialising against a bare element -----------------------------------------------

const shouldInit = refs.filter((r) => !(r in excluded));
const failed = shouldInit.filter((r) => !results[r].initOk);

assert.equal(failed.length, 0,
    `every module outside the two documented lists initialises against a bare element ` +
    `(${shouldInit.length} of ${refs.length})` +
    (failed.length
        ? ':\n  ' + failed.map((r) => `${r}\n      ${results[r].error}\n      rendered by: ${results[r].views.join(', ')}`).join('\n  ')
        : ''));

// --- both lists asserted in the other direction too --------------------------------------------

/*
 * A listed module that starts initialising means its entry is stale. This is the assertion that did
 * the work when the arrow-constructor bug was fixed: it named all 12 modules to promote.
 */
for (const [ref, reason] of Object.entries(NEEDS_FIXTURE)) {
    assert.ok(ref in results, `${ref} is still a live data-require target`);

    assert.ok(!results[ref].initOk,
        `${ref} still needs a fixture (${reason.slice(0, 60)}…) — if this FAILS it no longer does, ` +
        'so move the entry out of NEEDS_FIXTURE');
}

// --- D2.2: nothing hands back `window` ---------------------------------------------------------

/*
 * Item 28's bug shape: `const self = this` was lost in a refactor, so a method's `this` became the
 * global object and a factory handed `window` back instead of a component. The page then renders
 * normally with one component that does nothing, and nothing anywhere says so -- `window` has every
 * method anyone is likely to call, so even a duck-type check passes.
 *
 * Checked at both exits: what a factory returns, and what any of the 92 modules sharing the global
 * emitter puts into an event. The emitter's own emit() is wrapped during the inits above, so this
 * covers every payload those 55 modules produced.
 */
const windowFactories = refs.filter((r) => results[r].returnedWindow);

assert.equal(windowFactories.length, 0,
    'no factory returned `window` instead of a component' +
    (windowFactories.length ? ': ' + windowFactories.join(', ') : ` (${refs.length} checked)`));

assert.ok(probe.emitterFound,
    'the global emitter was found and its emit() wrapped -- without this the next assertion is vacuous');

assert.deepEqual(probe.emitted, [],
    'no event payload emitted during those inits was `window`' +
    (probe.emitted.length ? ': ' + probe.emitted.map((e) => e.event).join(', ') : ''));

/*
 * The loading spinner specifically, because it is the singleton item 28 found and because 52 views
 * construct it.
 */
assert.ok(probe.spinner.found, 'the loading-spinner class was found in the output');
assert.equal(probe.spinner.isWindow, false, 'a new LoadingSpinner is not `window`');
assert.ok(probe.spinner.hasRequest, 'and exposes request(), which its 52 callers use');
assert.ok(probe.spinner.hasRelease, 'and release(), its other half');

// --- the probe itself is not reporting vacuously -----------------------------------------------

assert.ok(refs.every((r) => results[r].views.length > 0),
    'every result names the view that renders it, so a failure is traceable to markup');

/*
 * Step 2 has to be able to fail, and the arrow-constructor failure that used to prove that is gone.
 * page-view still does: on a bare element, with no body attributes, gtm-helper throws reading
 * page-level data. view-fixtures.slow.test.js is where it passes, with the markup it needs.
 */
assert.ok(results['src/views/page-view']?.error?.includes('length'),
    'the probe still reports a real failure for a view that needs a fixture (proving step 2 can fail)');

assert.ok(results['src/views/accordion-view']?.initOk ?? results[shouldInit[0]].initOk,
    'and still reports success for a module that does initialise (proving it is not failing everything)');

assert.done();
