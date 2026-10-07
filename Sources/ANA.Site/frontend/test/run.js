/*
 * Runs the frontend test suite.
 *
 *   cd Sources/ANA.Site/frontend
 *   npm test                      # all files
 *   node test/run.js paths        # just the files whose name contains "paths"
 *
 * Same contract as the runner on feature/log-cleanup-20291001 — flat discovery by `*.test.js`,
 * one positional substring filter, one child process per file, exit 0 only if every child exits 0.
 *
 * It is much shorter than that one because it has nothing to compile. Over there each test file is
 * browserified through babelify + aliasify before Node can read it, since the modules under test use
 * ES6 `import` plus aliasify aliases that Node cannot resolve. This branch is ESM on Node 24 with
 * subpath imports, so a test file simply imports what it is testing and runs as-is.
 *
 * One process per file is kept anyway. Nothing here holds module-level state the way
 * modules/global-emitter does over there, but it means a test file that hard-crashes or calls
 * process.exit cannot take the rest of the run with it, and the failure is attributable to a file.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const withSlow = args.includes('--slow') || args.includes('--all');
const filter = args.find((a) => !a.startsWith('--')) || '';

// Runner flags are consumed here; anything else is forwarded to each test file, which is how
// `node test/run.js css --update-baseline` reaches css-inventory.test.js.
const forwarded = args.filter((a) => a.startsWith('--') && !['--slow', '--all'].includes(a));

/*
 * A `*.slow.test.js` file runs only with --slow (what `npm run verify` passes). The one such file
 * rebuilds the whole project into a scratch directory, which costs ~5s — worth it before a commit,
 * too slow to pay on every `npm test`.
 */
const files = fs.readdirSync(TEST_DIR)
    // Helpers are prefixed `_`, so the suffix rule alone already excludes them.
    .filter((f) => /\.test\.js$/.test(f))
    .filter((f) => withSlow || !/\.slow\.test\.js$/.test(f))
    .filter((f) => f.includes(filter))
    .sort();

if (!files.length) {
    console.log('no test files matched ' + JSON.stringify(filter));
    process.exit(1);
}

console.log('node ' + process.version + ', ' + files.length + ' test file(s)\n');

const failed = [];

for (const file of files) {
    const run = spawnSync(process.execPath, [path.join(TEST_DIR, file), ...forwarded], { stdio: 'inherit' });

    // A child killed by a signal reports status null, which is a failure, not a pass.
    if (run.status !== 0) {
        failed.push(file);
    }

    console.log('');
}

if (failed.length) {
    console.log('FAILED: ' + failed.join(', '));
    process.exit(1);
}

console.log('All ' + files.length + ' test file(s) passed.');
process.exit(0);
