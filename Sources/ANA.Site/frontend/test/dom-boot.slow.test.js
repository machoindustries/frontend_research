/*
 * Epic D1 -- each layout boots the way it loads, with no script errors.
 *
 * This is the layer that replaces part of the manual browser pass. Everything above it checks that
 * files exist and contain what they should; this checks that running them in order does not throw.
 *
 * The distinction matters because the failures this catches are silent by construction. A throw
 * inside a boot path leaves a half-initialised page: some components work, the ones after the throw
 * never run, and nothing is logged unless someone kept console.error alive (item 22). Items 23, 24,
 * 27 and 28 were all this shape.
 *
 * Fixtures are hand-reduced from each layout's own markup rather than saved from a rendered
 * environment. That was the cheaper half of the story's Decision 2 and it has one real advantage:
 * a fixture here carries no CMS content and no member data, which matters because this repo is
 * headed for a public one. The cost is that a fixture can drift from the real page; the body
 * attributes below are taken verbatim from _Base.cshtml to limit that.
 *
 * What this cannot do: jsdom has no layout engine and no network. External scripts (YouTube,
 * AddThis, slick, Bootstrap and lazysizes from CDNs) are not loaded, and each test says so.
 *
 * Proven able to fail, each verified by making the change, rebuilding and watching it go red:
 *   - booting _Base without /bundles/jquery raises the shim's explicit error
 *   - removing a module file makes jit-require report "loaded N-1 of N"
 *   - commenting out `$(document).foundation()` in libs/global-includes.js fails the D1.3 ARIA-role
 *     assertion, since Foundation then never reflows the Accordion plugin
 *   - replacing one OJIN module's DOMContentLoaded registration fails D1.4 with "4 of 5"
 *   - removing any one element named in the D1.5 fixtures makes that page script throw at load
 */

import fs from 'node:fs';
import path from 'node:path';

import * as assert from './_assert.js';
import { ASSETS } from '../paths.mjs';
import { boot, layoutScripts } from './_dom.js';

console.log('dom boot -- each layout runs its scripts in order without throwing');

/** Reports errors readably; jsdom stack traces are noise here. */
const show = (list) => (list.length ? ':\n      ' + list.slice(0, 6).join('\n      ') : '');

// --- the script lists are read from the layouts, not written down here -------------------------

const base = layoutScripts('Views/Shared/Layouts/_Base.cshtml');

assert.ok(base.some((s) => s.src === '/bundles/jquery'),
    '_Base loads /bundles/jquery');
assert.ok(base.some((s) => s.src === '/assets/js/entry.js' && s.module),
    '_Base loads entry.js as a module -- it is ESM, and a classic tag would not execute it');
assert.ok(
    base.findIndex((s) => s.src === '/bundles/jquery') < base.findIndex((s) => s.src === '/assets/js/entry.js'),
    'and jQuery comes first: the shim reads window.jQuery at module-evaluation time (item 23)');

// --- D1.1 nursingworld boots cleanly ----------------------------------------------------------

/*
 * The body attributes are _Base.cshtml's, verbatim. gtm-helper reads the data-logged-in-user-*
 * set; the spike for this work found that a fixture missing them fails inside gtm-helper, which is
 * precisely the markup contract these tests exist to pin.
 */
const ANON = 'id="top" data-require="./src/views/page-view" ' +
    'data-logged-in-user-id="" data-logged-in-user-member-status="" ' +
    'data-logged-in-user-registered-state="" data-page-heading="Test page"';

const MEMBER = 'id="top" data-require="./src/views/page-view" ' +
    'data-logged-in-user-id="12345" data-logged-in-user-member-status="Member" ' +
    'data-logged-in-user-registered-state="MD" data-page-heading="Test page"';

for (const [label, bodyAttrs] of [['anonymous', ANON], ['logged-in', MEMBER]]) {
    const page = boot({
        layout: 'Views/Shared/Layouts/_Base.cshtml',
        bodyAttrs,
        body: '<main><div class="l-page"></div></main>',
    });

    assert.deepEqual(page.errors, [],
        `D1.1 ${label}: _Base boots with no script errors` + show(page.errors));

    const loadFailures = page.warnings.filter((w) => /loaded \d+ of \d+/.test(w));

    assert.deepEqual(loadFailures, [],
        `D1.1 ${label}: jit-require loaded every data-require module` + show(loadFailures));

    assert.ok(page.loaded.includes('/assets/js/entry.js'),
        `D1.1 ${label}: entry.js actually ran (loaded: ${page.loaded.join(', ')})`);
}

// --- D1.3 CDC boots cleanly --------------------------------------------------------------------

/*
 * cdc.js is the only bundle using import.meta.glob, so it is the one that broke when `base` was
 * wrong and its chunks 404'd (item 10). Booting it here exercises that dynamic-import path against
 * the real /assets/js/chunks/ files.
 *
 * slick and the Font Awesome kit come from CDNs and are not loaded; nothing asserted below depends
 * on them.
 */
/*
 * The fixture carries .search-title-mobile because filter-resources.js:89 does
 * `document.querySelector('.search-title-mobile').onclick = …` with no null check — on a CDC page
 * without that element the module throws and every handler it would have bound after it is lost.
 * Pre-existing and out of scope here, but it is why this fixture is shaped the way it is.
 */
// Deliberately bare: none of the markup filter-resources queries is present. Before the null
// guard this threw at `document.querySelector('.search-title-mobile').onclick = …`, and every
// handler bound after that line was lost on any CDC page that did not render it.
const cdc = boot({
    layout: 'Views/Shared/Layouts/_CDC.cshtml',
    body: '<div class="cdc-page"><div data-module-core="skip-nav"></div></div>',
});

assert.ok(cdc.loaded.includes('/assets/js/cdc.js'), 'D1.3: cdc.js ran');

assert.deepEqual(cdc.errors, [],
    'D1.3: _CDC boots with no script errors, with none of the optional markup present' +
    show(cdc.errors));

/*
 * The rest of D1.3: that Foundation is initialised and that ModuleController loads its modules.
 * "No errors on a bare page" does not cover either -- both of those failing looks exactly like a
 * page where nothing was asked of them.
 *
 * The fixture carries what the real views render: _CDC.cshtml itself renders
 * data-module-core="resource-modal", _CDCRegisterForm.cshtml renders
 * data-module-dynamic="modal", and the accordion markup is Foundation's documented shape.
 */
const cdcInit = boot({
    layout: 'Views/Shared/Layouts/_CDC.cshtml',
    body: '<div class="grid-container" id="core" data-module-core="resource-modal"></div>'
        + '<div class="reveal modal-container" id="dyn" data-module-dynamic="modal"></div>'
        + '<ul class="accordion" id="acc" data-accordion><li class="accordion-item" data-accordion-item>'
        + '<a href="#" class="accordion-title">T</a>'
        + '<div class="accordion-content" data-tab-content>B</div></li></ul>',
    probe: {
        globals: ['Foundation'],
        jqFns: ['foundation'],
        jqData: { core: ['#core', 'module-ref'], dyn: ['#dyn', 'module-ref'] },
        // All three roles are added by Foundation's Accordion._init. None is in the fixture.
        counts: {
            tablist: '#acc[role=tablist]',
            tab: '#acc .accordion-title[role=tab]',
            panel: '#acc .accordion-content[role=tabpanel]',
        },
    },
});

assert.deepEqual(cdcInit.errors, [],
    'D1.3: _CDC boots clean with the markup its own views render' + show(cdcInit.errors));

assert.ok(cdcInit.globals.Foundation && cdcInit.jqFns.foundation,
    'D1.3: Foundation is installed onto jQuery -- libs/foundation-includes.js calls '
    + 'Foundation.addToJquery($), so $.fn.foundation existing is that line having run');

/*
 * Stronger than the above: $(document).foundation() actually reflowed. Foundation's Accordion._init
 * is what sets role=tablist/tab/tabpanel, so these counts cannot come from the fixture.
 */
assert.ok(cdcInit.counts.tablist === 1 && cdcInit.counts.tab === 1 && cdcInit.counts.panel === 1,
    'D1.3: and $(document).foundation() initialised the Accordion plugin -- it added the ARIA '
    + `roles, which the fixture does not carry (tablist ${cdcInit.counts.tablist}, `
    + `tab ${cdcInit.counts.tab}, tabpanel ${cdcInit.counts.panel})`);

/*
 * ModuleController records every module it instantiated under `module-ref` on the element, so the
 * keys are the names that actually loaded.
 */
assert.deepEqual(cdcInit.jqData.core, ['resource-modal'],
    'D1.3: ModuleController instantiated the eager core module named by data-module-core');

/*
 * The dynamic half, and the reason this assertion is here: these come from /assets/js/chunks/ via
 * import.meta.glob, which is the path that 404'd when `base` was wrong (item 10). A chunk that
 * cannot be fetched leaves `module-ref` empty and logs a warning nobody reads.
 */
assert.deepEqual(cdcInit.jqData.dyn, ['modal'],
    'D1.3: and code-split the dynamic module out of /assets/js/chunks/ and instantiated it '
    + '(item 10: this import path 404\'d when `base` was wrong)');

/* A module name that does not exist must be reported, or the two assertions above prove nothing. */
const cdcBogus = boot({
    layout: 'Views/Shared/Layouts/_CDC.cshtml',
    body: '<div id="dyn" data-module-dynamic="no-such-module"></div>',
    probe: { jqData: { dyn: ['#dyn', 'module-ref'] } },
});

assert.ok(cdcBogus.warnings.some((w) => /no dynamic module named/.test(w)),
    'D1.3: and an unknown module name is reported rather than silently skipped '
    + '(proving the two assertions above can fail)');

/*
 * And the same fixture with cdc.js skipped: nothing initialises. This is what makes the four
 * assertions above measurements of cdc.js's work rather than of the fixture's markup.
 */
const cdcNoScript = boot({
    layout: 'Views/Shared/Layouts/_CDC.cshtml',
    body: '<div class="grid-container" id="core" data-module-core="resource-modal"></div>'
        + '<ul class="accordion" id="acc" data-accordion></ul>',
    skip: ['/assets/js/cdc.js'],
    probe: {
        globals: ['Foundation'],
        jqFns: ['foundation'],
        jqData: { core: ['#core', 'module-ref'] },
        counts: { tablist: '#acc[role=tablist]' },
    },
});

assert.ok(!cdcNoScript.globals.Foundation && !cdcNoScript.jqFns.foundation
    && cdcNoScript.counts.tablist === 0 && cdcNoScript.jqData.core === null,
    'D1.3: without cdc.js there is no Foundation, no ARIA roles and no module-ref — so the '
    + 'assertions above are measuring the bundle, not the fixture');

// --- D1.4 OJIN boots cleanly -------------------------------------------------------------------

/*
 * OJIN's five modules self-initialise on DOMContentLoaded rather than through data-require, and it
 * loads neither screen.css nor entry.js (item 25). Bootstrap and lazysizes come from CDNs.
 */
/*
 * The fixture carries each module's entry selector: navigationMenu wants .ojin-nav__bar,
 * articleContent .ojin-tabs, articleHeadline .ojin-articleHeadline and search
 * .c-search-results__categories. base.js needs none.
 */
const OJIN_BODY = '<div class="ojin-nav__bar"></div><div class="ojin-articleHeadline"></div>'
    + '<div class="ojin-tabs"></div><div class="c-search-results__categories"></div>';

const ojin = boot({ layout: 'Views/Shared/Layouts/_OJINBase.cshtml', body: OJIN_BODY });

assert.deepEqual(ojin.errors, [], 'D1.4: _OJINBase boots with no script errors' + show(ojin.errors));
assert.ok(ojin.loaded.includes('/assets/Ojin/js/ojin.js'), 'D1.4: ojin.js ran');

/*
 * The rest of D1.4: that the five modules actually initialise.
 *
 * None of them can be observed through the DOM -- every visible effect is behind a click or a
 * resize -- so what is measured is the mechanism itself: each module registers exactly one
 * DOMContentLoaded listener, with no readyState guard. Counted DIFFERENTIALLY against a boot that
 * skips ojin.js, because jQuery registers one of its own and a raw total would silently absorb a
 * module that stopped registering.
 *
 * This also pins a timing trap. jsdom's readyState is 'loading' only during the tick the document
 * was constructed in, so if the harness ever awaited anything before evaluating these classic
 * scripts the listeners would be registered after the event had fired and none would ever run --
 * leaving "boots with no errors" true and meaningless. invoked === registered is what rules it out.
 */
const ojinNoScript = boot({
    layout: 'Views/Shared/Layouts/_OJINBase.cshtml',
    body: OJIN_BODY,
    skip: ['/assets/Ojin/js/ojin.js'],
});

const ownListeners = ojin.domContentLoaded.registered - ojinNoScript.domContentLoaded.registered;

assert.equal(ownListeners, 5,
    `D1.4: all five self-initialising modules registered on DOMContentLoaded (${ownListeners} of 5, `
    + `measured against a boot without ojin.js which registers ${ojinNoScript.domContentLoaded.registered})`);

assert.equal(ojin.domContentLoaded.invoked, ojin.domContentLoaded.registered,
    `D1.4: and every one of them actually ran -- the event had not already fired when they `
    + `registered (${ojin.domContentLoaded.invoked} invoked of ${ojin.domContentLoaded.registered})`);

assert.deepEqual(ojin.domContentLoaded.threw, [],
    'D1.4: and none threw while initialising' + show(ojin.domContentLoaded.threw));

// --- D1.5 HNHN scripts run in _Root order ------------------------------------------------------

/*
 * The whole reason HNHN's scripts were kept as classic copy-through rather than made ES modules:
 * they declare top-level const into shared global scope and depend on load order, with
 * hnhn-scripts.js calling `new Swiper` and `AOS.init` against globals the tags above it set up.
 * This is the test that the decision holds.
 *
 * _Root loads jQuery 3.6.0 from code.jquery.com, which is external and therefore not loaded here.
 * The repo's own 3.7.1 is not substituted: that would test a configuration production does not run
 * (the story's Decision 4).
 */
const hnhnScripts = layoutScripts('HNHN/Views/Shared/Layouts/_Root.cshtml');
const order = hnhnScripts.filter((s) => !s.external).map((s) => path.basename(s.src));

assert.deepEqual(order.slice(0, 4),
    ['bootstrap.bundle.min.js', 'swiper-bundle.min.js', 'aos.js', 'hnhn-scripts.js'],
    'D1.5: _Root loads bootstrap, swiper and aos before hnhn-scripts, which uses all three');

// Also bare. hnhn-scripts.js queries ~15 elements at module load and used each without a null
// check, so it stopped at the first one a page did not render -- taking every behaviour below that
// point with it. With the guards it runs to the end whatever the page contains, which is what makes
// this a clean assertion rather than a characterisation.
const hnhn = boot({
    layout: 'HNHN/Views/Shared/Layouts/_Root.cshtml',
    body: '<main></main>',
    probe: { globals: ['Swiper', 'AOS'] },
});

assert.ok(hnhn.loaded.includes('/assets/hnhn/js/hnhn-scripts.js'),
    'D1.5: hnhn-scripts.js ran to completion');

assert.deepEqual(hnhn.errors, [],
    'D1.5: the _Root chain runs with no errors on a page carrying none of its optional markup' +
    show(hnhn.errors));

assert.ok(hnhn.globals.Swiper && hnhn.globals.AOS,
    'D1.5: Swiper and AOS are on the window before hnhn-scripts needs them');

// --- D1.5 continued: the four page-specific scripts --------------------------------------------

/*
 * _Root renders the chain above on every HNHN page. These four are each included by ONE page's own
 * view -- search.js by SearchPage, ChallengeListingPage and BlogListingPage, auto-complete.js by
 * Header.cshtml, questionnaire.js by QuestionnairePage, sign-up.js by SignUpPage -- so they load
 * after the whole _Root chain, which is the order reproduced here.
 *
 * DECISION, and it is a real one (the story's Decision 4): _Root loads jQuery 3.6.0 from
 * code.jquery.com, which is external and not fetched here, and search.js and auto-complete.js are
 * both `$(document).ready` wrappers that cannot run without it. The repo's own 3.7.1 is substituted
 * rather than leaving these two untested, because the alternative is no coverage at all of the
 * scripts the story names. What that does NOT cover is a 3.6.0-vs-3.7.1 behaviour difference, and
 * nothing here would notice one.
 *
 * Each fixture was derived by running the script and reading what it dereferenced. Every one is
 * paired below with a check that removing its key element breaks it, so a fixture that has stopped
 * being load-bearing gets noticed.
 */
const JQUERY = '/assets/js/jquery.min.js';

const STEP = (label) =>
    '<div class="questionnaire__step"><span class="questionnaire__question-number"></span>'
    + '<div class="questionnaire__answers" data-answers-number="1" data-optional-answers="False">'
    + '<label><input type="checkbox"></label>'
    + `<button class="questionnaire__button">${label}</button></div>`
    + '<button class="questionnaire__button--back">Back</button></div>';

const PAGES = {
    'search.js': {
        needs: '#resultsPerPageSelect and #sortGlobalPage — search.js:5 calls setAttribute on '
            + 'both with no null check. The .form-check-label must have a preceding sibling: the '
            + 'label loop reads previousElementSibling.classList when the text contains "Blog".',
        body: '<main><select id="resultsPerPageSelect"></select><select id="sortGlobalPage"></select>'
            + '<div class="facet-group"><input class="category-filter form-check-input" type="radio">'
            + '<label class="form-check-label">Blog</label></div></main>',
        breaks: '<main><select id="sortGlobalPage"></select></main>',
    },

    'questionnaire.js': {
        needs: 'a .questionnaire__question-number inside EVERY step — questionnaire.js:63 assigns '
            + 'textContent to it unguarded — plus .questionnaire__progress to append the step dots '
            + 'to, and a next/back button per step. Two steps, so the loop exercises both the '
            + 'middle branch and the final-step branch.',
        body: '<main><div class="questionnaire__progress"></div>' + STEP('Next') + STEP('Submit') + '</main>',
        breaks: '<main><div class="questionnaire__progress"></div>'
            + '<div class="questionnaire__step"><button class="questionnaire__button">Next</button>'
            + '<button class="questionnaire__button--back">Back</button></div></main>',
    },

    'sign-up.js': {
        needs: '.sign-up__form form — sign-up.js:5 calls querySelectorAll on it at module load, so '
            + 'the file throws before anything else on a page without it — plus #step1, #step2 and '
            + 'input[name=create_account], which it moves into the step it builds.',
        body: '<main><div class="sign-up__form"><form>'
            + '<div id="step1"><input name="first_name" required><input type="email" name="email" required>'
            + '<input name="city"><input name="postal_code">'
            + '<select name="country"><option value="US">US</option></select>'
            + '<select name="state"><option value="MD">MD</option></select></div>'
            + '<div id="step2"><input name="password" type="password">'
            + '<input name="password_confirm" type="password">'
            + '<input type="checkbox" required><div class="g-recaptcha"></div>'
            + '<div class="sign-up__random-error"></div></div>'
            + '<input type="submit" name="create_account" value="Create">'
            + '</form></div></main>',
        breaks: '<main><div id="step1"></div><div id="step2"></div></main>',
        // reCAPTCHA is a documented stub in the story. Only these three are touched during load;
        // a stub more generous than that would let a missing call pass unnoticed.
        stubs: { grecaptcha: { render: () => 0, getResponse: () => '', reset: () => {} } },
    },

    'auto-complete.js': {
        needs: 'nothing — every handler is delegated from document, so it is the one page script '
            + 'that loads safely whatever the page contains. Asserted because that is the '
            + 'interesting fact about it, and it is the shape the other three should have had.',
        body: '<main><input id="searchInput"><button id="searchButton"></button></main>',
        breaks: null,
    },
};

for (const [script, fx] of Object.entries(PAGES)) {
    const page = boot({
        layout: 'HNHN/Views/Shared/Layouts/_Root.cshtml',
        body: fx.body,
        stubs: fx.stubs,
        extraScripts: [JQUERY, `/assets/hnhn/js/${script}`],
    });

    assert.ok(page.loaded.includes(`/assets/hnhn/js/${script}`),
        `D1.5: ${script} was found and evaluated`);

    assert.deepEqual(page.errors, [],
        `D1.5: ${script} runs on its own page's markup — needs ${fx.needs}` + show(page.errors));
}

/*
 * The fixtures are load-bearing. Three of the four throw at module load without their key element,
 * which is the whole reason each needs a fixture rather than a bare <main>.
 */
for (const [script, fx] of Object.entries(PAGES)) {
    if (!fx.breaks) continue;

    const broken = boot({
        layout: 'HNHN/Views/Shared/Layouts/_Root.cshtml',
        body: fx.breaks,
        stubs: fx.stubs,
        extraScripts: [JQUERY, `/assets/hnhn/js/${script}`],
    });

    assert.ok(broken.errors.length > 0,
        `D1.5: ${script} fails without its required markup (proving its fixture is doing the work)`);
}

/*
 * auto-complete.js is asserted the other way round: it is clean on a page carrying none of its
 * markup, because it delegates. If this starts failing it has grown a load-time dereference.
 */
const autoBare = boot({
    layout: 'HNHN/Views/Shared/Layouts/_Root.cshtml',
    body: '<main></main>',
    extraScripts: [JQUERY, '/assets/hnhn/js/auto-complete.js'],
});

assert.deepEqual(autoBare.errors, [],
    'D1.5: auto-complete.js is clean on a bare page — its handlers are delegated from document, '
    + 'so unlike the other three it has no load-time markup contract' + show(autoBare.errors));

// --- the harness itself can fail ---------------------------------------------------------------

assert.ok(fs.existsSync(path.join(ASSETS, 'js/entry.js')), 'the harness is pointed at real output');
assert.ok(base.filter((s) => s.external).length > 0,
    'external scripts are recognised and skipped rather than silently failing to load');

assert.done();
