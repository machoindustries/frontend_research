/*
 * B3.3 -- the CSS hooks components toggle at runtime exist in the stylesheet that page loads.
 *
 * A component can call classList.add('x') forever against a stylesheet that defines no .x. Nothing
 * fails: no build error, no console message, no exception. The element simply does not change, and
 * the only way to notice is to perform the interaction and look.
 *
 * It bites hardest where sites load different stylesheets. OJIN does not load screen.css
 * (backlog item 25), so a hook defined only there is invisible on OJIN pages even though the same
 * class works everywhere else.
 *
 * The map is curated rather than derived, deliberately, for two reasons found while writing it:
 *
 *  - Derivation misses indirection. page-view.js does not call addClass('no--scroll'); it sets
 *    `noScrollClass: 'no--scroll'` as an option and applies it through this.options. A scan for
 *    literal toggles never sees it.
 *  - Not every toggled class is a style hook. mega-nav-component marks `bound` to avoid binding a
 *    handler twice, and search.js adds `blog-filter` purely so it can query it back. Asserting
 *    those were styled would be wrong.
 *
 * Proven able to fail: removing `.owl-carousel` from the screen baseline's stylesheet, or moving a
 * KNOWN_GAPS class into STYLE_HOOKS, turns the relevant assertion red.
 */

import fs from 'node:fs';
import path from 'node:path';

import * as assert from './_assert.js';
import { ASSETS, SITES } from '../paths.mjs';
import { inventory } from './_css-inventory.js';
import { stripComments } from './_source.js';

console.log('style hooks -- classes the JS toggles exist in the CSS that page loads');

/*
 * What each site's layout actually links, read from the layouts rather than assumed. OJIN's
 * Bootstrap and Font Awesome come from CDNs, so classes they provide cannot be verified here --
 * recorded in `external` so a missing class is attributed rather than silently excused.
 */
const LAYOUTS = {
    nursingworld: {
        sheets: ['css/screen.css'],
        external: [],
    },
    cdc: {
        sheets: ['css/cdc.css'],
        external: [],
    },
    ojin: {
        sheets: ['Ojin/css/ojin.css', 'Ojin/style_ojin.css'],
        // _OJINBase.cshtml: bootstrap@4.6.0 (jsdelivr) and font-awesome 4.7.0 (cdnjs).
        external: ['bootstrap@4.6.0', 'font-awesome@4.7.0'],
    },
    hnhn: {
        sheets: [
            'hnhn/css/hnhn.css', 'hnhn/css/search.css', 'hnhn/css/bootstrap.min.css',
            'hnhn/css/aos.css', 'hnhn/css/swiper-bundle.min.css',
        ],
        external: [],
    },
};

/* Classes that MUST be styled: toggling them is how a component changes what the user sees. */
const STYLE_HOOKS = {
    nursingworld: {
        'owl-carousel': 'carousel-view: Owl initialises against it',
        'is-active': 'the shared open/selected state across nav, tabs and accordions',
        'is-focused': 'search box focus state',
        'fade-in': 'the reveal transition modules/animate applies',
        'no-results': 'search and listing empty state',
        'save_enabled': 'account forms: the enabled save button',
        'save_disabled': 'account forms: the disabled save button',
    },
    cdc: {
        'flip-icon': 'filter-resources: the accordion chevron rotation (item 26)',
        'flip-search-icon': 'the search accordion chevron',
        hide: 'the shared hidden state',
        show: 'the shared shown state',
        expanded: 'jump-nav expanded state',
    },
    ojin: {
        active: 'navigationMenu and tabs: the selected state',
        'is--open': 'articleContent flyout',
        overflowHidden: 'scroll lock while the menu is open',
    },
    hnhn: {
        'd-none': 'the single most used hook: 41 toggles across all five scripts',
        completed: 'questionnaire: a finished step',
        current: 'questionnaire: the active step',
        'no-scroll': 'scroll lock while the mobile menu is open',
        'sign-up__spinner': 'sign-up: the submit spinner',
        'sign-up__random-error': 'sign-up: the error banner',
    },
};

/*
 * Toggled at runtime but styled nowhere the page loads. Asserted in BOTH directions, like the maps
 * in asset-references.test.js: an unlisted missing hook fails, and a listed one that becomes
 * styled also fails, so the entry gets deleted rather than left to rot.
 */
const KNOWN_GAPS = {
    nursingworld: {
        'no--scroll': 'page-view.js:22 sets noScrollClass and applies it to lock scrolling behind ' +
            'the mobile nav and lightboxes. No stylesheet defines it, so the lock does nothing. ' +
            'The story names this one; pre-existing, not from the Vite migration.',
    },
    cdc: {
        'flip-sub-icon': 'filter-resources.js:96 toggles it on the sub-category chevron. cdc.css ' +
            'defines flip-icon and flip-search-icon but never this one, so sub-category chevrons ' +
            'do not rotate. Same family as item 26.',
    },
    ojin: {
        clicked: 'navigationMenu.js:49 adds and removes it on sibling menu items; ojin.css ' +
            'defines no rule for it.',
        'menu-item-has-children': 'navigationMenu.js:45 applies it to every nav item with a ' +
            'submenu — the name suggests a theme convention this site never adopted.',
    },
    hnhn: {
        'checkbox-error': 'sign-up.js:90 adds it to flag an unchecked required box. Neither ' +
            'hnhn.css nor search.css styles it, so the validation error is invisible.',
    },
};

/* Toggled, but never meant to be styled. Listed so nobody "fixes" them by adding CSS. */
const NOT_STYLE_HOOKS = {
    nursingworld: { bound: 'mega-nav-component.js:67 marks <html> to avoid binding twice' },
    hnhn: {
        'blog-filter': 'search.js:27 adds it, then :32 queries it back — a selector handle',
        'blog-input': 'the same pattern for the text input',
    },
};

// --- what each site's stylesheets define ------------------------------------------------------

function classesFor(site) {
    const found = new Set();

    for (const relPath of LAYOUTS[site].sheets) {
        const file = path.join(ASSETS, relPath);

        assert.ok(fs.existsSync(file), `${site}: loads ${relPath}`);

        for (const sel of inventory(fs.readFileSync(file, 'utf8')).selectors) {
            for (const m of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) found.add(m[1]);
        }
    }

    return found;
}

/** Every class name mentioned in a site's own JS, comments stripped. */
function referencedInJs(site) {
    const found = new Set();

    const walk = (dir) => {
        if (!fs.existsSync(dir)) return;

        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);

            if (e.isDirectory()) { if (e.name !== 'vendor') walk(full); }
            else if (e.name.endsWith('.js')) {
                const text = stripComments(fs.readFileSync(full, 'utf8'));

                for (const m of text.matchAll(/['"`]([^'"`\n]{1,120})['"`]/g)) {
                    for (const token of m[1].split(/[\s.,#>]+/)) {
                        if (/^-?[_a-zA-Z][\w-]*$/.test(token)) found.add(token);
                    }
                }
            }
        }
    };

    walk(path.join(SITES, site, 'js'));

    return found;
}

for (const site of Object.keys(LAYOUTS)) {
    const styled = classesFor(site);
    const inJs = referencedInJs(site);

    assert.ok(styled.size > 100, `${site}: its stylesheets define a plausible number of classes (${styled.size})`);

    // 1. every declared style hook is actually styled
    const hooks = Object.keys(STYLE_HOOKS[site] ?? {});
    const unstyled = hooks.filter((c) => !styled.has(c));

    assert.equal(unstyled.length, 0,
        `${site}: every style hook exists in the CSS this layout loads (${hooks.length} hooks)` +
        (unstyled.length
            ? ':\n  ' + unstyled.map((c) => `${c} — ${STYLE_HOOKS[site][c]}`).join('\n  ') +
              (LAYOUTS[site].external.length
                  ? `\n  (note: this layout also loads ${LAYOUTS[site].external.join(', ')} from a CDN, which cannot be checked here)`
                  : '')
            : ''));

    // 2. known gaps are still gaps
    for (const [cls, reason] of Object.entries(KNOWN_GAPS[site] ?? {})) {
        assert.ok(!styled.has(cls),
            `${site}: known gap .${cls} is still unstyled — if this fails it was FIXED, so delete ` +
            `the KNOWN_GAPS entry. On record: ${reason.slice(0, 70)}…`);
    }

    // 3. every mapped class is still referenced by that site's JS, so the maps cannot rot
    const allMapped = [
        ...hooks,
        ...Object.keys(KNOWN_GAPS[site] ?? {}),
        ...Object.keys(NOT_STYLE_HOOKS[site] ?? {}),
    ];
    const stale = allMapped.filter((c) => !inJs.has(c));

    assert.equal(stale.length, 0,
        `${site}: every mapped class is still referenced in its JS (${allMapped.length} mapped)` +
        (stale.length ? ' — stale entries to delete: ' + stale.join(', ') : ''));
}

// --- the checks can actually fail --------------------------------------------------------------

const screen = classesFor('nursingworld');

assert.ok(screen.has('owl-carousel'), 'the extractor finds a class that is styled');
assert.ok(!screen.has('definitely-not-a-real-class'),
    'and does not find one that is not (proving the hook assertions can fail)');
assert.ok(!screen.has('no--scroll'),
    'and the known gap really is absent, not a quirk of extraction');

assert.done();
