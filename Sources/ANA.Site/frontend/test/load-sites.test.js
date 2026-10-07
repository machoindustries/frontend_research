/*
 * scripts/load-sites.mjs -- the functions that turn site.config.mjs declarations into Vite's inputs.
 *
 * Everything here fails silently when it is wrong. A bad outBase prefix puts a stylesheet at a URL
 * no Razor layout asks for; a bad stripBase copies images one directory off; a lost alias resolves
 * to nothing. In every case the build still prints "✓ built in 4s".
 *
 * Two kinds of assertion below, deliberately:
 *   - synthetic configs, for the semantics of each collector. Stable: they do not change when a
 *     real manifest is edited, so a failure here means the function changed, not the data.
 *   - the real discovered sites, for the invariants that must hold across the actual tree —
 *     ordering, unique order values, no alias claimed twice.
 *
 * Proven able to fail: setting hnhn's stripBaseFrom to 'assets' instead of 'assets/images' turns
 * assertion 30 red, and giving OJIN the same order value as CDC turns assertion 24 red.
 *
 * The first of those is why the glob-base check at the bottom exists. The synthetic-config
 * assertions above it all passed with the real manifest broken -- they test the collector, not the
 * data, so a wrong stripBaseFrom in a real site.config.mjs went straight through. That is exactly
 * the failure this file claims to guard, and it was only caught by running the mutation.
 */

import path from 'node:path';

import * as assert from './_assert.js';
import { FRONTEND, SITES, NODE_MODULES } from '../paths.mjs';
import {
    loadSites,
    collectEntries,
    collectCopyTargets,
    collectScssLoadPaths,
    collectAliases,
    assetOutBase,
    assetsInlineLimit,
} from '../scripts/load-sites.mjs';

console.log('scripts/load-sites.mjs -- declarations become build inputs, or fail loudly');

/** A site shaped like loadSites() returns, without reading a manifest from disk. */
function site(name, config) {
    const dir = path.join(SITES, name);

    return { name, dir, rel: 'src/sites/' + name, config };
}

// --- 1-4. collectEntries: the outBase prefix is the whole namespacing mechanism ----------------

const entries = collectEntries([
    site('flat', { outBase: '', entries: { 'css/flat': 'scss/flat.scss' } }),
    site('owned', { outBase: 'Owned', entries: { 'js/owned': 'js/owned.js' } }),
]);

assert.equal(entries['css/flat'], path.join(SITES, 'flat/scss/flat.scss'),
    'an empty outBase leaves the key in the shared flat namespace');
assert.equal(entries['Owned/js/owned'], path.join(SITES, 'owned/js/owned.js'),
    'a named outBase prefixes the key, which is what creates /assets/<name>/');
assert.equal(entries['js/owned'], undefined,
    'and the unprefixed key is NOT also emitted');

// dynamicEntries is how nursingworld declares its 131 data-require modules. Its keys must be
// prefixed the same way, or a namespaced site using it would emit to the wrong place.
const dynamic = collectEntries([
    site('owned', {
        outBase: 'Owned',
        dynamicEntries: () => ({ 'js/generated': '/abs/generated.js' }),
        entries: {},
    }),
]);

assert.equal(dynamic['Owned/js/generated'], '/abs/generated.js',
    'dynamicEntries keys are prefixed with outBase too, not just static entries');

// --- 5-9. collectCopyTargets ------------------------------------------------------------------

const flat = collectCopyTargets([
    site('hnhn', { outBase: 'hnhn', copy: [{ src: 'vendor/js/*.js', dest: 'js', flatten: true }] }),
])[0];

assert.equal(flat.rename.stripBase, true, 'flatten:true maps to stripBase:true');
assert.equal(flat.dest, 'hnhn/js', 'the copy destination is prefixed with outBase');

const nested = collectCopyTargets([
    site('hnhn', {
        outBase: 'hnhn',
        copy: [{ src: 'assets/images/**/*', dest: 'img', stripBaseFrom: 'assets/images' }],
    }),
])[0];

assert.equal(nested.rename.stripBase, 5,
    'stripBaseFrom computes the depth rather than trusting a written-down number');

// A leading ~ reaches node_modules, which is how a site ships a stock vendor file from npm.
const fromNpm = collectCopyTargets([
    site('hnhn', {
        outBase: 'hnhn',
        copy: [{ src: '~bootstrap/dist/css/bootstrap.min.css', dest: 'css', flatten: true }],
    }),
])[0];

assert.ok(fromNpm.src[0].includes(NODE_MODULES.split(path.sep).pop()),
    'a ~ source resolves into node_modules, not into the site directory');

// The exclude glob is what keeps nursingworld's icons/ out of the build. Expressed as `filter:`
// it was silently ignored and all 59 icons shipped (backlog item 1).
const excluded = collectCopyTargets([
    site('nursingworld', {
        outBase: '',
        copy: [{
            src: 'images/**/*.svg',
            exclude: 'images/icons/**',
            dest: 'img',
            stripBaseFrom: 'images',
        }],
    }),
])[0];

assert.equal(excluded.src.length, 2, 'exclude adds a second src entry');
assert.ok(excluded.src[1].startsWith('!'), 'and it is a negative glob, which tinyglobby honours');

// --- 10. a copy target with neither option must not be guessed at -----------------------------

assert.throws(
    () => collectCopyTargets([site('broken', { copy: [{ src: 'a/**', dest: 'b' }] })]),
    'a copy target with neither flatten nor stripBaseFrom throws instead of defaulting',
    'flatten or stripBaseFrom'
);

// --- 11-12. scss load paths -------------------------------------------------------------------

const loadPaths = collectScssLoadPaths([
    site('nursingworld', { scssLoadPaths: ['scss'] }),
    site('cdc', { scssLoadPaths: ['~foundation-sites/scss'] }),
]);

assert.equal(loadPaths[0], path.join(SITES, 'nursingworld/scss'),
    'a bare load path resolves inside the site');
assert.equal(loadPaths[1], path.join(NODE_MODULES, 'foundation-sites/scss'),
    'a ~ load path resolves into node_modules');

// --- 13. an alias claimed twice is ambiguous, so it throws ------------------------------------

assert.throws(
    () => collectAliases([
        site('one', { alias: { shared: 'js/a' } }),
        site('two', { alias: { shared: 'js/b' } }),
    ]),
    'the same alias declared by two sites throws rather than letting one win silently',
    'more than one site'
);

// --- 14-16. assetOutBase: which namespace an emitted asset belongs in -------------------------

const sites = [
    site('nursingworld', { outBase: '' }),
    site('hnhn', { outBase: 'hnhn' }),
];

assert.equal(assetOutBase(sites, { originalFileNames: ['src/sites/hnhn/assets/images/x.svg'] }), 'hnhn',
    'an asset from a namespaced site lands in that namespace');
assert.equal(assetOutBase(sites, { originalFileNames: ['src/sites/nursingworld/images/y.svg'] }), '',
    'an asset from a flat-namespace site is unprefixed -- today`s behaviour, unchanged');
assert.equal(assetOutBase(sites, { originalFileNames: ['node_modules/pkg/z.svg'] }), '',
    'an asset from outside every site is unprefixed rather than mis-attributed');
assert.equal(assetOutBase(sites, {}), '',
    'a missing originalFileNames is treated as unowned, not a crash');

// --- 17-19. assetsInlineLimit -----------------------------------------------------------------

assert.equal(assetsInlineLimit([site('a', {})]), undefined,
    'with nobody opting out, Vite`s own size heuristic is left alone');

const limit = assetsInlineLimit([
    site('hnhn', { inlineAssets: false }),
    site('nursingworld', {}),
]);

assert.equal(limit(path.join(FRONTEND, 'src/sites/hnhn/assets/images/squiggle.svg')), false,
    'an opted-out site`s asset is forced to a file, never a data: URI');
assert.equal(limit(path.join(FRONTEND, 'src/sites/nursingworld/images/logo.svg')), undefined,
    'every other site still defers to the size heuristic');

// --- 20-23. the real tree ---------------------------------------------------------------------

const real = await loadSites();

assert.ok(real.length >= 4, 'all four sites are discovered (found ' + real.length + ')');

const orders = real.map((s) => s.config.order);

assert.deepEqual(orders, [...orders].sort((a, b) => a - b),
    'sites come back in ascending order, so filesystem order cannot leak into the build');
assert.equal(new Set(orders).size, orders.length,
    'every order value is unique -- a tie would let the tiebreaker rename chunks on a rename');
assert.equal(real[0].name, 'nursingworld',
    'nursingworld is still first: its 131 entries anchor the shared chunk names');

// The real manifests must survive the real collectors. This is what catches a manifest edit that
// is individually plausible but breaks an invariant.
assert.doesNotThrow(() => collectAliases(real), 'the real manifests declare no conflicting aliases');
assert.doesNotThrow(() => collectCopyTargets(real), 'every real copy target declares its strip mode');

/*
 * stripBaseFrom must name the directory the glob actually starts from -- i.e. the non-glob prefix
 * of src. Declaring `src: 'assets/images/**' + '/*'` with `stripBaseFrom: 'assets'` is the exact
 * backlog item 1 failure: every file lands one directory deep (img/images/...) and the build is
 * still green.
 *
 * Asserting the computed depth would be tautological -- the code computes it the same way. This
 * compares the two declarations against each other, which is the thing a human gets wrong.
 */
for (const { name, config } of real) {
    for (const item of config.copy ?? []) {
        if (!item.stripBaseFrom) continue;

        const staticPrefix = item.src
            .split('/')
            .filter((seg) => !seg.includes('*'))
            // A trailing filename is not a directory; globs are what mark the boundary.
            .join('/')
            .replace(/\/[^/]*\.[^/]*$/, '');

        assert.equal(item.stripBaseFrom, staticPrefix,
            name + ': stripBaseFrom matches the glob base of ' + JSON.stringify(item.src) +
            ' -- a mismatch silently nests the copied files');
    }
}

assert.done();
