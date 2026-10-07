/*
 * D1.2 -- load-order failures are loud.
 *
 * In its own file because its first boot deliberately omits /bundles/jquery, and ES module caching
 * is per process: once the jQuery shim has been evaluated (with or without jQuery present) every
 * later boot in that process inherits that outcome. See _dom.js. A fresh process is the only way
 * to ask "what happens when jQuery is missing" and get a true answer.
 *
 * The point is not that it breaks. It is that it breaks AUDIBLY -- item 23's bare specifier failed
 * in a way nobody noticed until a page was clicked.
 */

import * as assert from './_assert.js';
import { boot } from './_dom.js';

console.log('dom load order -- a missing dependency fails loudly, not silently');

const show = (list) => (list.length ? ':\n      ' + list.slice(0, 6).join('\n      ') : '');

const ANON = 'id="top" data-require="./src/views/page-view" ' +
    'data-logged-in-user-id="" data-logged-in-user-member-status="" ' +
    'data-logged-in-user-registered-state="" data-page-heading="Test page"';

/*
 * The point is not that it breaks -- it is that it breaks *audibly*. Item 23's bare specifier
 * failed silently in a way nobody noticed until a page was clicked.
 */
const noJquery = boot({
    layout: 'Views/Shared/Layouts/_Base.cshtml',
    bodyAttrs: ANON,
    skip: ['/bundles/jquery'],
});

assert.ok(noJquery.errors.length > 0,
    'D1.2: booting without /bundles/jquery fails loudly rather than silently' +
    show(noJquery.errors));

assert.ok(noJquery.errors.some((e) => /jquery/i.test(e)),
    'D1.2: and the error names jQuery, so the cause is obvious' + show(noJquery.errors));

/*
 * A data-require naming a module that does not exist: jit-require must report it and still
 * initialise the others on the page, rather than taking the whole boot down.
 */
const missingModule = boot({
    layout: 'Views/Shared/Layouts/_Base.cshtml',
    bodyAttrs: ANON,
    body: '<div data-require="./src/views/no-such-view-at-all"></div>',
});

assert.ok(missingModule.errors.some((e) => /failed to load .*no-such-view-at-all/.test(e)),
    'D1.2: a missing data-require target is reported by name' + show(missingModule.errors));

assert.ok(missingModule.warnings.some((w) => /loaded \d+ of \d+/.test(w)),
    'D1.2: and the loaded N of M count says how many survived' + show(missingModule.warnings));


assert.done();
