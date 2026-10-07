/*
 * B1.1 -- the committed wwwroot/assets is what the current source builds.
 *
 * The deploy ships whatever is committed: azure-pipelines.yml is one `dotnet publish` step with no
 * Node in it, so nothing rebuilds the frontend on the way out. That makes "someone changed source
 * and did not rebuild" the single highest-consequence mistake available in this repo, and nothing
 * catches it -- not the build, not lint, not dotnet build.
 *
 * It is not hypothetical. This test was written immediately after finding that the committed output
 * had been built on a case-insensitive filesystem: `tab-control-view.js` imported `modules/Utils`
 * where the file is `utils.js`, so the committed bundle carried a duplicate copy of Utils that a
 * Linux build does not produce. 77 files were wrong and everything reported green.
 *
 * Builds into a scratch directory and compares, rather than building into wwwroot and reading
 * `git status`: that works in a dirty tree, needs no git, and never touches the committed output.
 *
 * Proven able to fail: appending a rule to screen.scss without rebuilding turns the STALE
 * assertion red naming css/screen.css, and adding a statement that reaches the output of
 * tab-control-view.js does the same for that file.
 *
 * Worth knowing: adding an UNUSED export to a module does NOT go red, because Rollup tree-shakes
 * it and the output really is unchanged. That is correct — this test pins the output, not the
 * source — but it means a green run does not prove the source is untouched, only that what ships
 * from it is what is committed.
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as assert from './_assert.js';
import { ASSETS, FRONTEND } from '../paths.mjs';

console.log('committed output -- wwwroot/assets is what the current source builds');

/*
 * Files that are committed under wwwroot/assets but which the build does not produce, so they must
 * not be reported as orphans. `emptyOutDir` is false precisely so these survive a build, and
 * setting it true would delete them with no error (backlog item 16).
 */
const NOT_BUILT = [
    // The icon webfont used by 97 CSS rules. Its Grunt build step was dropped in the migration and
    // never replaced, so the files are committed artifacts with no source.
    /^fonts\/icons\./,
    // OJIN stylesheets that exist nowhere in the Vue project the port came from (item 34).
    /^Ojin\/(style_ojin|ojin-bfoverride)\.css$/,
    // CMS-imported article images; ArticleContentImportController.cs writes here at runtime.
    /^img\/OJINImages\//,
    // Committed OJIN imagery that predates the port.
    /^Ojin\/img\//,
    // Server-side data files that merely live under wwwroot/assets. UserDataController.cs reads
    // them off WebRootPath (lines 727, 756, 941); they are not frontend assets at all.
    /^memberupload\//,
    /^templatefile\//,
];

const notBuilt = (rel) => NOT_BUILT.some((re) => re.test(rel));

function walk(dir, base = dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);

        if (e.isDirectory()) walk(full, base, out);
        // .DS_Store and friends are not build output and not anyone's contract.
        else if (e.name !== '.DS_Store') out.push(path.relative(base, full).split(path.sep).join('/'));
    }

    return out;
}

const digest = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// --- build into a scratch directory -----------------------------------------------------------

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ana-build-'));
const started = Date.now();

const built = assert.doesNotThrow(() => {
    // --mode production matches what a developer runs as `npm run build`; --emptyOutDir gives the
    // scratch tree a clean picture of exactly what this source emits.
    execFileSync(
        'npx',
        ['vite', 'build', '--mode', 'production', '--outDir', scratch, '--emptyOutDir'],
        { cwd: FRONTEND, stdio: 'pipe', encoding: 'utf8' }
    );

    return walk(scratch);
}, 'a production build into a scratch directory succeeds');

if (!built) {
    assert.done();
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);

// A floor, not an exact count: the point is to catch a build that silently emitted almost
// nothing. The real per-file comparison below is what pins the contract.
assert.ok(built.length > 300, `the build emitted a plausible number of files (${built.length}, ${elapsed}s)`);

// --- compare ----------------------------------------------------------------------------------

const committed = new Set(walk(ASSETS));
const stale = [];
const missing = [];

for (const rel of built) {
    const fresh = path.join(scratch, rel);
    const live = path.join(ASSETS, rel);

    if (!committed.has(rel)) {
        missing.push(rel);
    }
    else if (digest(fresh) !== digest(live)) {
        stale.push(rel);
    }
}

const emitted = new Set(built);
const orphaned = [...committed].filter((rel) => !emitted.has(rel) && !notBuilt(rel));

function list(label, files) {
    return files.length
        ? `\n${label} (${files.length}):\n` + files.slice(0, 12).map((f) => '  ' + f).join('\n') +
          (files.length > 12 ? `\n  …and ${files.length - 12} more` : '')
        : '';
}

assert.equal(stale.length, 0,
    'no committed file differs from what the source builds' + list('STALE', stale) +
    (stale.length ? '\n  -> run `npm run build` and commit the result' : ''));

assert.equal(missing.length, 0,
    'the build emits nothing that is missing from the committed output' + list('MISSING', missing) +
    (missing.length ? '\n  -> run `npm run build` and commit the result' : ''));

assert.equal(orphaned.length, 0,
    'nothing committed under a generated path is no longer emitted' + list('ORPHANED', orphaned) +
    (orphaned.length ? '\n  -> delete these, or add them to NOT_BUILT if they are committed artifacts' : ''));

// --- the committed-artifact allowances are still accurate --------------------------------------

// Each NOT_BUILT pattern exempts real files from the orphan check. If a pattern stops matching
// anything, it is stale and hiding nothing -- delete it rather than let it mask a future orphan.
for (const re of NOT_BUILT) {
    assert.ok([...committed].some((rel) => re.test(rel)),
        `NOT_BUILT pattern ${re} still matches committed files -- if this fails, delete the pattern`);
}

// --- the comparison can actually fail ---------------------------------------------------------

const probe = path.join(scratch, 'js', 'entry.js');

assert.ok(fs.existsSync(probe), 'the scratch build produced js/entry.js');
assert.equal(digest(probe), digest(path.join(ASSETS, 'js/entry.js')),
    'and it is byte-identical to the committed copy');

const pristine = fs.readFileSync(probe);

fs.appendFileSync(probe, '\n// tamper\n');
assert.ok(digest(probe) !== digest(path.join(ASSETS, 'js/entry.js')),
    'a one-line change to a built file is detected (proving the comparison above can fail)');

// Put it back: the determinism check below compares this same scratch tree against a second
// build, and a file this test corrupted would read as non-deterministic.
fs.writeFileSync(probe, pristine);

// --- B1.2: the build is deterministic -------------------------------------------------------

/*
 * Without this, a clean B1.1 diff means nothing: a build that varies run to run would churn the
 * committed output on every rebuild and no one could tell a real change from noise.
 *
 * This is not hypothetical either. Until backlog item 32, @font-face cache-bust tokens came from
 * Sass's unique-id(), which returns a fresh value on EVERY compile -- so screen.css and editor.css
 * came out different after every build whether or not their inputs had changed, and `git status`
 * could not answer "did my change affect the CSS?". fontVersion() replaced it with a hash of the
 * font's own bytes. This assertion is what stops that regressing.
 */
const second = fs.mkdtempSync(path.join(os.tmpdir(), 'ana-build2-'));

assert.doesNotThrow(() => execFileSync(
    'npx',
    ['vite', 'build', '--mode', 'production', '--outDir', second, '--emptyOutDir'],
    { cwd: FRONTEND, stdio: 'pipe', encoding: 'utf8' }
), 'a second production build succeeds');

const secondFiles = walk(second);

assert.deepEqual(secondFiles.sort(), [...built].sort(),
    'both builds emit exactly the same set of files');

const varying = secondFiles.filter((rel) => {
    const a = path.join(scratch, rel);

    return fs.existsSync(a) && digest(a) !== digest(path.join(second, rel));
});

assert.equal(varying.length, 0,
    'every emitted file is byte-identical between two consecutive builds' +
    list('NON-DETERMINISTIC', varying) +
    (varying.length ? '\n  -> something in the build varies per run (a timestamp, a random id, a hash of a changing input)' : ''));

fs.rmSync(second, { recursive: true, force: true });
fs.rmSync(scratch, { recursive: true, force: true });

assert.done();
