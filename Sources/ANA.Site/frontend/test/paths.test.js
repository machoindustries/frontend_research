/*
 * paths.mjs -- stripBaseFor().
 *
 * This is the guard on a bug class that does not raise anything. vite-plugin-static-copy's
 * `rename.stripBase` counts leading path segments; get it wrong and files are copied to the wrong
 * place with a clean build, a clean lint and no warning. Backlog item 1 shipped a doubled
 * `assets/img/images/` that way and leaked 59 icons that were meant to be excluded; item 33 hit the
 * same shape from the SCSS side.
 *
 * The function exists because hand-counting is what failed. It proved the point during item 35: a
 * hand-guess of 4 for `src/sites/hnhn/assets/images` was wrong, and the function returned 5.
 *
 * Proven able to fail: changing the nursingworld images case to expect 5 turns assertion 1 red with
 * "expected: 5 / actual: 4".
 */

import path from 'node:path';

import * as assert from './_assert.js';
import { FRONTEND, SRC, SITES, ASSETS, WWWROOT, stripBaseFor } from '../paths.mjs';

console.log('paths.mjs -- copy depth is computed, never written down');

// --- 1. the depths the real copy targets rely on ----------------------------------------------

[
    ['nursingworld images', path.join(SITES, 'nursingworld/images'), 4],
    ['nursingworld fonts', path.join(SITES, 'nursingworld/fonts'), 4],
    // 5, not 4: src + sites + hnhn + assets + images. This is the one a human got wrong.
    ['hnhn assets/images', path.join(SITES, 'hnhn/assets/images'), 5],
].forEach(([label, dir, expected]) => {
    assert.equal(stripBaseFor(dir), expected, label + ' strips ' + expected + ' segments');
});

// A preview copies relative to its own directory rather than to frontend/, so the root argument
// has to be honoured. CDC's assets/images is 2 deep from its preview root.
assert.equal(
    stripBaseFor(path.join(SITES, 'cdc/preview/assets/images'), path.join(SITES, 'cdc/preview')),
    2,
    'depth is measured from the root argument, not always from frontend/'
);

// --- 2. a directory outside the root is a programming error, not a 0 ---------------------------

// Silently returning something would put files somewhere arbitrary, which is the whole failure mode
// this function exists to prevent. It must throw.
assert.throws(
    () => stripBaseFor('/etc', FRONTEND),
    'a directory outside the root throws rather than guessing a depth',
    'not inside'
);

assert.throws(
    () => stripBaseFor(FRONTEND, FRONTEND),
    'the root itself throws -- a depth of zero is never a meaningful answer',
    'not inside'
);

// --- 3. the exported locations point where the build expects ----------------------------------

assert.equal(path.basename(ASSETS), 'assets', 'ASSETS is the wwwroot/assets output directory');
assert.equal(path.dirname(ASSETS), WWWROOT, 'ASSETS sits directly under WWWROOT');
assert.equal(path.join(FRONTEND, 'src'), SRC, 'SRC is frontend/src');
assert.equal(path.join(SRC, 'sites'), SITES, 'SITES is frontend/src/sites');

// --- 4. the assertion can actually fail --------------------------------------------------------

assert.throws(
    () => stripBaseFor(path.join(FRONTEND, '..'), FRONTEND),
    'the check itself rejects a parent directory (proving section 2 can fail)',
    'not inside'
);

assert.done();
