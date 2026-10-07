/*
 * D2.3 -- modules that wait on window.load still initialise when they load after it.
 *
 * This pins backlog item 24. `window.load` fires exactly once and is never replayed for handlers
 * attached afterwards. That was safe when the bundle was a classic script executing during parse,
 * long before load. It is not safe now: entry.js is a deferred module, and jit-require pulls each
 * view in with a dynamic import() that load does not wait for -- so a view normally initialises
 * *after* load has already fired, and a plain `$(window).on('load', …)` would never run at all.
 *
 * modules/on-window-load exists for exactly that, and carousel-view and gallery-view are its only
 * two callers. Both branches are asserted, because only testing the already-complete one would
 * pass against an implementation that ignored the event entirely.
 *
 * Each branch runs in its own process: readyState has to be set before the view is imported, and
 * re-importing the same module in one process re-executes nothing (see _dom.js).
 *
 * Proven able to fail: replacing onWindowLoad's `document.readyState === 'complete'` branch with a
 * bare `$(window).on('load', …)` leaves callsBeforeLoadEvent at 0 and turns the first assertion red
 * -- which is precisely the regression item 24 shipped.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as assert from './_assert.js';

console.log('late load -- a view that initialises after window.load still runs its callback');

const HERE = path.dirname(fileURLToPath(import.meta.url));

function probe(ref, readyState) {
    return JSON.parse(execFileSync(
        process.execPath,
        [path.join(HERE, '_late-load-probe.mjs'), ref, readyState],
        { cwd: path.dirname(HERE), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    ));
}

const VIEWS = ['src/views/carousel-view', 'src/views/gallery-view'];

for (const ref of VIEWS) {
    const name = ref.split('/').pop();

    // --- the case item 24 broke: load has already fired by the time the view arrives ---
    const late = probe(ref, 'complete');

    assert.ok(late.imported && !late.error, `${name}: imports with readyState complete (${late.error ?? 'ok'})`);

    /*
     * Without this the next assertion would be measuring its own stub rather than the module's
     * behaviour: if Owl never registered, a zero call count would be indistinguishable from a
     * callback that never ran.
     */
    assert.ok(late.owlRegisteredByModule,
        `${name}: the module registers $.fn.owlCarousel, so the call count below means something`);

    /*
     * The precondition that makes the next assertion meaningful: jsdom's own load event has
     * already fired and passed. Without it a bare `$(window).on('load', …)` would catch jsdom's
     * load a moment later and the test would pass against the item 24 bug.
     */
    assert.ok(late.loadAlreadyFired,
        `${name}: window.load had already fired before the view was imported`);

    assert.ok(late.callsBeforeLoadEvent > 0,
        `${name}: its deferred callback RAN even though window.load had already fired — ` +
        `the item 24 regression (calls: ${late.callsBeforeLoadEvent})`);

    // --- and the ordinary case: load has not fired yet, so it waits for the event ---
    const early = probe(ref, 'loading');

    assert.ok(early.imported && !early.error, `${name}: imports with readyState loading (${early.error ?? 'ok'})`);

    assert.equal(early.callsBeforeLoadEvent, 0,
        `${name}: with the page still loading it waits rather than firing early ` +
        `(calls: ${early.callsBeforeLoadEvent})`);

    assert.ok(early.afterLoadEvent > 0,
        `${name}: and runs once window.load arrives (calls: ${early.afterLoadEvent})`);
}

// --- the probe is not reporting vacuously -----------------------------------------------------

/*
 * A module that does NOT use on-window-load must behave differently, or the assertions above would
 * pass for any module at all. accordion-item-view initialises synchronously and never touches Owl.
 */
const control = probe('src/views/accordion-item-view', 'complete');

assert.ok(control.imported, 'the control view imports');
assert.equal(control.calls, 0,
    'a view that does not defer never calls owlCarousel (proving the counts above are real)');

assert.done();
