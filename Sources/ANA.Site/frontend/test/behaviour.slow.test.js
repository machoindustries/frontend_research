/*
 * Epic D3 (the P1 behaviours) -- what a component actually does when clicked.
 *
 * Everything above this checks that code loads and initialises. This checks that the thing a user
 * does produces the DOM change the CSS is written against. It is the closest this suite gets to
 * the manual pass, and the furthest it can go: jsdom has no layout engine, so these assert DOM
 * state -- classes, attributes, element counts -- never appearance.
 *
 * Each one is here because a manual tester would otherwise have to click it. They are deliberately
 * shallow: proving a toggle toggles is worth a lot more than proving nothing, and costs a fixture.
 *
 * Proven able to fail: every assertion below is paired with the state BEFORE the interaction, so a
 * component that does nothing fails on the "after" rather than passing on a coincidence.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as assert from './_assert.js';

console.log('behaviour -- clicking a component does what its CSS expects');

const HERE = path.dirname(fileURLToPath(import.meta.url));

function run(spec) {
    return JSON.parse(execFileSync(
        process.execPath,
        [path.join(HERE, '_init-probe.mjs'), JSON.stringify(spec)],
        { cwd: path.dirname(HERE), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    ));
}

const BASE_BODY = 'id="top" data-logged-in-user-id="" data-logged-in-user-member-status="" ' +
    'data-logged-in-user-registered-state="" data-page-heading="Fixture page"';

// --- D3.1 accordion ---------------------------------------------------------------------------

/*
 * Selectors from accordion-item-view's own defaultOptions: [data-accordion-toggle] opens
 * [data-accordion-content], and the open state is the `is-active` class plus aria-expanded on the
 * panel. aria-expanded is the half a sighted manual tester would not notice missing.
 */
const ACCORDION = '<div id="fx"><button data-accordion-toggle>Toggle</button>' +
    '<div data-accordion-content>Body</div></div>';

const probeAccordion = {
    classes: { open: ['#fx', 'is-active'] },
    attrs: { expanded: ['[data-accordion-content]', 'aria-expanded'] },
};

const acc0 = run({ ref: 'src/views/accordion-item-view', bodyAttrs: BASE_BODY, html: ACCORDION, selector: '#fx', probe: probeAccordion });

assert.ok(acc0.initOk, `D3.1: the accordion initialises (${acc0.error ?? 'ok'})`);

/*
 * Asserted as a TOGGLE rather than against a presumed starting state. It starts OPEN here, which
 * was not the guess -- matchMedia reports no match in jsdom, so the component is in the mode where
 * the panel is expanded. Pinning "starts closed" would have encoded the guess; pinning that one
 * click inverts it and a second restores it is the actual contract, and holds either way round.
 */
const acc1 = run({
    ref: 'src/views/accordion-item-view', bodyAttrs: BASE_BODY, html: ACCORDION, selector: '#fx',
    actions: [{ selector: '[data-accordion-toggle]', click: true }],
    probe: probeAccordion,
});

const acc2 = run({
    ref: 'src/views/accordion-item-view', bodyAttrs: BASE_BODY, html: ACCORDION, selector: '#fx',
    actions: [
        { selector: '[data-accordion-toggle]', click: true },
        { selector: '[data-accordion-toggle]', click: true },
    ],
    probe: probeAccordion,
});

assert.equal(acc1.classes.open, !acc0.classes.open,
    `D3.1: clicking the toggle inverts the open state (${acc0.classes.open} -> ${acc1.classes.open})`);

assert.equal(acc2.classes.open, acc0.classes.open,
    `D3.1: and clicking again restores it (${acc1.classes.open} -> ${acc2.classes.open})`);

assert.equal(acc1.attrs.expanded, String(acc1.classes.open),
    `D3.1: aria-expanded on the panel tracks the class, so assistive tech sees the same state ` +
    `(class ${acc1.classes.open}, aria ${acc1.attrs.expanded})`);

// --- D3.2 tabs --------------------------------------------------------------------------------

/*
 * Same shape, different component, and the one whose source carried the modules/Utils casing bug
 * that made the committed bundle wrong in 77 files (see source-casing.test.js).
 */
const TABS = '<div id="fx"><button data-tab-control-toggle>Tab</button>' +
    '<div data-tab-control-content>Panel</div></div>';

const tabsBefore = run({
    ref: 'src/views/tab-control-view', bodyAttrs: BASE_BODY, html: TABS, selector: '#fx',
    probe: { classes: { active: ['#fx', 'is-active'] } },
});

assert.ok(tabsBefore.initOk, `D3.2: the tab control initialises (${tabsBefore.error ?? 'ok'})`);
assert.equal(tabsBefore.classes.active, false, 'D3.2: and starts inactive');

const tabsAfter = run({
    ref: 'src/views/tab-control-view', bodyAttrs: BASE_BODY, html: TABS, selector: '#fx',
    actions: [{ selector: '[data-tab-control-toggle]', click: true }],
    probe: {
        classes: { active: ['#fx', 'is-active'] },
        attrs: { expanded: ['[data-tab-control-content]', 'aria-expanded'] },
    },
});

assert.equal(tabsAfter.classes.active, true,
    'D3.2: clicking a tab activates it (is-active)');

assert.equal(tabsAfter.attrs.expanded, 'true',
    `D3.2: and marks its panel expanded (got ${tabsAfter.attrs.expanded})`);

// --- D3.3 hero carousel -----------------------------------------------------------------------

/*
 * Item 24's reported symptom was the hero carousel not appearing, so this asserts the thing that
 * was missing: Owl having actually built slides. `.owl-item` elements exist only because Owl
 * wrapped the children -- they are not in the fixture.
 *
 * Needs two or more heroes: with one, Owl has nothing to page between and the structure it builds
 * differs.
 */
// data-carousel on a CHILD, not the root: hero-carousel-view does $el.find(selectors.carousel),
// and jQuery's find() searches descendants only, so a root carrying the attribute is never seen.
const HEROES = '<div id="fx"><div class="owl-carousel" data-carousel>' +
    '<div class="hero"><h1>One</h1></div><div class="hero"><h1>Two</h1></div></div></div>';

const hero = run({
    ref: 'src/views/hero-carousel-view', bodyAttrs: BASE_BODY, html: HEROES, selector: '#fx',
    probe: { counts: { owlItems: '#fx .owl-item', stage: '#fx .owl-stage' } },
});

assert.ok(hero.initOk, `D3.3: the hero carousel initialises (${hero.error ?? 'ok'})`);

assert.ok(hero.counts.owlItems >= 2,
    `D3.3: Owl built a slide per hero — the thing item 24 lost (.owl-item count: ${hero.counts.owlItems})`);

assert.ok(hero.counts.stage >= 1,
    'D3.3: and wrapped them in its stage, so the markup is a carousel rather than a stack');

/*
 * The fixture is load-bearing: without the owl-carousel class Owl does not take over, so the
 * counts above would be zero and the assertion would be measuring the fixture, not the component.
 */
const heroNoClass = run({
    ref: 'src/views/hero-carousel-view', bodyAttrs: BASE_BODY, selector: '#fx',
    html: '<div id="fx"><div data-carousel><div class="hero"></div><div class="hero"></div></div></div>',
    probe: { counts: { owlItems: '#fx .owl-item' } },
});

assert.equal(heroNoClass.counts.owlItems, 0,
    'D3.3: and builds nothing without the owl-carousel class (proving the count is Owl\'s work)');

// --- D3.4 video lightbox ----------------------------------------------------------------------

/*
 * video-view is one of 42 views using Magnific Popup, the library item 27's `module.$el` bug broke.
 * Asserting the popup OPENS is the behaviour; Magnific marks the body with mfp-active and inserts
 * its own container, neither of which is in the fixture.
 */
const VIDEO = '<div id="fx"><a href="#video-content" data-video-link>Play</a>' +
    '<span data-video-play-icon></span>' +
    '<div id="video-content" data-video-content><iframe src="about:blank"></iframe></div></div>';

const videoBefore = run({
    ref: 'src/views/video-view', bodyAttrs: BASE_BODY, html: VIDEO, selector: '#fx',
    probe: { counts: { popup: '.mfp-wrap, .mfp-bg' } },
});

assert.ok(videoBefore.initOk, `D3.4: video-view initialises (${videoBefore.error ?? 'ok'})`);
assert.equal(videoBefore.counts.popup, 0, 'D3.4: and no lightbox is open to begin with');

const videoAfter = run({
    ref: 'src/views/video-view', bodyAttrs: BASE_BODY, html: VIDEO, selector: '#fx',
    actions: [{ selector: '[data-video-link]', click: true, wait: 250 }],
    probe: { counts: { popup: '.mfp-wrap, .mfp-bg' }, classes: { bodyActive: ['body', 'mfp-active'] } },
});

assert.ok(videoAfter.counts.popup > 0 || videoAfter.classes.bodyActive === true,
    'D3.4: clicking the link opens Magnific Popup — the library 42 views depend on ' +
    `(containers: ${videoAfter.counts.popup}, body.mfp-active: ${videoAfter.classes.bodyActive})`);

// --- nothing above passed by accident ---------------------------------------------------------

/*
 * Every behaviour is asserted against its own "before" state, so a component that does nothing
 * fails on the after. This last check confirms the probe's click actually reaches the handler at
 * all: a selector that matches nothing is reported rather than silently skipped.
 */
const noTarget = run({
    ref: 'src/views/accordion-item-view', bodyAttrs: BASE_BODY, html: ACCORDION, selector: '#fx',
    actions: [{ selector: '[data-nothing-matches-this]', click: true }],
});

assert.ok(noTarget.errors.some((e) => e.includes('action target missing')),
    'a click on a selector that matches nothing is reported, not silently skipped');

assert.done();
