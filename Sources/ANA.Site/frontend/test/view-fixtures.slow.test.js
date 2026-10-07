/*
 * D2.1 step 4 -- the views that need more than a bare element, each against a fixture.
 *
 * module-contract.slow.test.js asserts the floor: 36 of 55 modules initialise against an empty
 * <div>. These are the ones that do not, and each one's fixture is the interesting part, because
 * the fixture IS the markup contract. A view that silently requires an attribute nobody documented
 * will keep working until a Razor change drops it, and then fail in a way no build catches.
 *
 * Every fixture below was derived by running the view and reading what it dereferenced, not by
 * guessing -- the note on each says what it needs and why.
 *
 * Proven able to fail: removing any one attribute named below turns that view's assertion red with
 * the dereference that broke, and the module it broke in.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as assert from './_assert.js';

console.log('view fixtures -- the markup each demanding view actually requires');

const HERE = path.dirname(fileURLToPath(import.meta.url));

function initWith(spec) {
    return JSON.parse(execFileSync(
        process.execPath,
        [path.join(HERE, '_init-probe.mjs'), JSON.stringify(spec)],
        { cwd: path.dirname(HERE), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    ));
}

/*
 * _Base.cshtml renders these on the <body> of every page, and modules/gtm-helper reads page-level
 * data straight off that element. Four of the views below fail on a bare body whatever markup the
 * fixture contains, which is why this is separate from the per-view markup.
 */
const BASE_BODY = 'id="top" data-logged-in-user-id="" data-logged-in-user-member-status="" ' +
    'data-logged-in-user-registered-state="" data-page-heading="Fixture page"';

const FIXTURES = {
    'src/views/page-view': {
        needs: 'only the body attributes — gtm-helper reads them for every page-level event',
        bodyAttrs: BASE_BODY,
        html: '<div id="fx"><main></main></div>',
    },

    'src/views/product-detail-view': {
        needs: 'the body attributes; its own markup is optional',
        bodyAttrs: BASE_BODY,
        html: '<div id="fx"></div>',
    },

    'src/views/product-listing-view': {
        needs: 'the body attributes; listing items are found but not required',
        bodyAttrs: BASE_BODY,
        html: '<div id="fx"><div class="c-product-listing__item"></div></div>',
    },

    'src/views/order-confirmation-page-view': {
        needs: 'data-transaction-{id,revenue,tax,shipping} on the view element. gtm-helper strips ' +
            'the currency symbol from all three money values, so an absent one throws in ' +
            '_stripCurrencySymbol before the purchase event is ever emitted.',
        bodyAttrs: BASE_BODY,
        html: '<div id="fx" data-transaction-id="ORD-1" data-transaction-revenue="$10.00" ' +
              'data-transaction-tax="$0.50" data-transaction-shipping="$2.00" ' +
              'data-gtm-donation-amount="0" data-gtm-donations="[]">' +
              '<div data-purchased-products=\'[{"Name":"P","Sku":"S","Price":"$10.00","Quantity":1}]\'></div></div>',
    },

    'src/views/testimony-slider-view': {
        needs: 'class="owl-carousel" on the view element, which TestimonialSliderBlock.cshtml ' +
            'renders as class="carousel owl-carousel". Without it Owl throws during setup — a ' +
            'fixture omitting the class is what made this look like a product bug at first.',
        html: '<div id="fx" class="carousel owl-carousel"><div class="item">a</div>' +
              '<div class="item">b</div></div>',
    },

    'src/views/account-continuing-education-awards-view': {
        needs: '#fromYear and #toYear select elements — _populateYearsDropdown appends options to ' +
            'both by id, with no null check',
        html: '<div id="fx"><select id="fromYear"></select><select id="toYear"></select></div>',
    },
};

for (const [ref, fixture] of Object.entries(FIXTURES)) {
    const name = ref.split('/').pop();
    const result = initWith({ ref, bodyAttrs: fixture.bodyAttrs, html: fixture.html, selector: '#fx' });

    assert.ok(result.imported, `${name}: imports`);

    assert.ok(result.initOk,
        `${name}: initialises against its fixture — needs ${fixture.needs}` +
        (result.initOk ? '' : `\n      ${result.error}\n      in ${result.at ?? 'unknown'}`));
}

/*
 * Flagged, not asserted: testimony-slider-view sets `navText: ''` while its two sibling views pass
 * arrays -- carousel-view [prevText, nextText] and hero-carousel-view ['', '']. Owl reads
 * navText[0] and navText[1], so a string yields undefined there.
 *
 * It does NOT throw with the markup above, so this is an inconsistency rather than a demonstrated
 * break. jsdom cannot settle it either way: whether Owl builds the nav it would read navText for
 * depends on width measurements jsdom does not perform. Worth a look in a real browser; not
 * something this suite can honestly claim.
 */

// --- the fixtures are load-bearing ------------------------------------------------------------

/*
 * Each assertion above would be worthless if the view initialised regardless of its fixture. These
 * remove the thing the fixture provides and check the view breaks -- so a fixture that has stopped
 * being necessary gets noticed rather than carried forever.
 */
const withoutBodyAttrs = initWith({
    ref: 'src/views/page-view',
    html: '<div id="fx"></div>',
    selector: '#fx',
});

assert.ok(!withoutBodyAttrs.initOk,
    'page-view fails without the body attributes (proving BASE_BODY is doing the work)');

const withoutSelects = initWith({
    ref: 'src/views/account-continuing-education-awards-view',
    html: '<div id="fx"></div>',
    selector: '#fx',
});

assert.ok(!withoutSelects.initOk,
    'the awards view fails without #fromYear/#toYear (proving that fixture is doing the work)');

assert.done();
