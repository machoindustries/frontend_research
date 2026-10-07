/*
 * B2.1 and B2.2 -- the emitted JS is loadable as served, and there is exactly one jQuery.
 *
 * These run against the committed output rather than the source, because the bugs they guard
 * against were made by the bundler, not written by anyone. Item 23 shipped 84 files carrying a bare
 * "jquery" specifier that no browser can resolve; item 27 came from a chunk that was pruned while
 * something still imported it. Source review would have missed both.
 *
 * Needs no build, so it runs in the fast suite.
 *
 * Proven able to fail: rewriting one import in a built file to a chunk name that does not exist
 * turns the resolution assertion red, and to "jquery" turns the bare-specifier assertion red.
 */

import fs from 'node:fs';
import path from 'node:path';

import * as assert from './_assert.js';
import { ASSETS, WWWROOT, NODE_MODULES } from '../paths.mjs';
import { isFileExact } from './_casefs.js';

console.log('output integrity -- every emitted import resolves, and jQuery comes from one place');

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;

    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);

        if (e.isDirectory()) walk(full, out);
        else if (e.name.endsWith('.js')) out.push(full);
    }

    return out;
}

const emitted = [
    ...walk(path.join(ASSETS, 'js')),
    ...walk(path.join(ASSETS, 'Ojin')),
    ...walk(path.join(ASSETS, 'hnhn')),
];

const rel = (p) => path.relative(ASSETS, p).split(path.sep).join('/');

assert.ok(emitted.length > 150, `found a plausible number of emitted JS files (${emitted.length})`);

// --- B2.1: every import resolves ---------------------------------------------------------------

/*
 * Extraction is deliberately broad and then classified by SHAPE, because minified output gives no
 * reliable context: `from` and `import(` both appear inside ordinary expressions and string
 * literals. Three such fragments exist in this output today (" + prev + ", "+u+", "in r||"), and a
 * tighter regex that excluded them would also have to make assumptions about minifier spacing.
 *
 * Classifying instead means a genuine bare specifier like "jquery" -- which IS a valid package
 * name -- is still caught, while a code fragment containing a space or an operator is not mistaken
 * for one.
 */
const CANDIDATE = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"'\n]+)["']/g;

// npm's own rules: optional @scope, then a package name, then an optional subpath.
const PACKAGE_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(?:\/[\w.@/-]+)?$/;

const unresolved = [];
const bare = [];
let checked = 0;

for (const file of emitted) {
    const text = fs.readFileSync(file, 'utf8');

    for (const m of text.matchAll(CANDIDATE)) {
        const spec = m[1];

        if (spec.startsWith('.')) {
            checked += 1;

            // Case-sensitively: the server serving these is not required to be forgiving.
            if (!isFileExact(path.resolve(path.dirname(file), spec))) {
                unresolved.push(`${rel(file)}  ->  ${spec}`);
            }
        }
        else if (spec.startsWith('/assets/')) {
            checked += 1;

            if (!isFileExact(path.join(WWWROOT, spec))) {
                unresolved.push(`${rel(file)}  ->  ${spec}`);
            }
        }
        else if (PACKAGE_NAME.test(spec)) {
            // A bare specifier in shipped ESM is unresolvable in a browser, full stop.
            checked += 1;
            bare.push(`${rel(file)}  ->  ${spec}`);
        }
        // Anything else is a code fragment that merely looked like a specifier.
    }
}

assert.ok(checked > 500, `checked a plausible number of emitted specifiers (${checked})`);

assert.equal(unresolved.length, 0,
    'every relative and /assets/ import in the output points at a file that exists' +
    (unresolved.length ? ':\n  ' + unresolved.slice(0, 10).join('\n  ') : ''));

assert.equal(bare.length, 0,
    'no bare specifier survives in the output -- a browser cannot resolve one (item 23: 84 files had one)' +
    (bare.length ? ':\n  ' + bare.slice(0, 10).join('\n  ') : ''));

// --- B2.2: exactly one jQuery ------------------------------------------------------------------

/*
 * The shim at js/vendor/jquery-global.cjs re-exports window.jQuery so every module shares the one
 * instance /bundles/jquery loads. A bundled second copy breaks plugin registration silently:
 * plugins attach to one jQuery and components look for them on the other (items 23, 27).
 *
 * "jQuery requires a window" is jQuery's own factory error, present in both the minified and
 * unminified builds, so it survives minification and is a reliable marker.
 */
const JQUERY_COPIES = ['js/jquery.js', 'js/jquery.min.js'];

const carriers = emitted
    .filter((f) => /jQuery requires a window|rneedsContext/.test(fs.readFileSync(f, 'utf8')))
    .map(rel)
    .sort();

assert.deepEqual(carriers, JQUERY_COPIES,
    'jQuery source appears only in the two files the build copies for it, nowhere else');

// --- vendor files are the versions package.json pins -------------------------------------------

const pkg = JSON.parse(fs.readFileSync(path.join(WWWROOT, '../frontend/package.json'), 'utf8'));

const banner = fs.readFileSync(path.join(ASSETS, 'js/jquery.min.js'), 'utf8').slice(0, 200);

assert.ok(banner.includes(`jQuery v${pkg.dependencies.jquery}`),
    `the served jQuery is the pinned version (package.json: ${pkg.dependencies.jquery})`);

/*
 * Compared byte-for-byte against the installed package rather than by reading a version string:
 * a copy step that silently stopped running would leave a stale file whose banner still claims the
 * right version.
 */
[
    ['bootstrap', 'bootstrap/dist/js/bootstrap.bundle.min.js', 'hnhn/js/bootstrap.bundle.min.js'],
    ['bootstrap', 'bootstrap/dist/css/bootstrap.min.css', 'hnhn/css/bootstrap.min.css'],
    ['aos', 'aos/dist/aos.js', 'hnhn/js/aos.js'],
    ['aos', 'aos/dist/aos.css', 'hnhn/css/aos.css'],
].forEach(([name, from, to]) => {
    const a = fs.readFileSync(path.join(NODE_MODULES, from));
    const b = fs.readFileSync(path.join(ASSETS, to));

    assert.ok(a.equals(b),
        `${to} is byte-identical to the installed ${name}@${pkg.dependencies[name]}`);
});

/*
 * Swiper is deliberately NOT taken from npm. Its CSS is byte-identical to stock 11.1.4 but its JS
 * matches no published Swiper build -- it differs in real code, not a banner -- so the pair is
 * kept as committed vendor files rather than swapped in alongside a structural migration
 * (backlog item 36). This asserts that decision still holds, so the pair cannot drift apart.
 */
const SITES = path.join(WWWROOT, '../frontend/src/sites');

[
    ['hnhn/js/swiper-bundle.min.js', 'hnhn/vendor/js/swiper-bundle.min.js'],
    ['hnhn/css/swiper-bundle.min.css', 'hnhn/vendor/css/swiper-bundle.min.css'],
].forEach(([out, src]) => {
    const a = fs.readFileSync(path.join(SITES, src.replace('hnhn/', 'hnhn/')));
    const b = fs.readFileSync(path.join(ASSETS, out));

    assert.ok(a.equals(b), `${out} is the committed vendor copy verbatim, not an npm substitute`);
});

assert.ok(!fs.existsSync(path.join(NODE_MODULES, 'swiper')),
    'swiper is not an npm dependency -- if this fails, the vendored pair and the package have both ' +
    'become sources of truth, which is the skew item 36 avoided');

// --- B2.3: the output is a production build ----------------------------------------------------

/*
 * Files the build copies verbatim rather than compiling. They are third-party or pre-Vite
 * artifacts, so our minify and drop_console policy does not apply to them and asserting it would
 * only report on code we do not own.
 */
const VERBATIM = [
    // Both jQuery copies: the build emits the unminified one deliberately alongside the minified.
    /^js\/jquery(\.min)?\.js$/,
    // HNHN vendor, copied from npm or committed as a matched pair (item 36).
    /^hnhn\/(js|css)\/(bootstrap|aos|swiper)/,
    // Vendored files with no npm equivalent, and the pre-Vite modernizr build.
    /^js\/(StringList|modernizr-custom)\.js$/,
];

const verbatim = (r) => VERBATIM.some((re) => re.test(r));
const ours = emitted.filter((f) => !verbatim(rel(f)));

assert.ok(ours.length > 150, `found a plausible number of files we compile (${ours.length})`);

/*
 * Source maps. `sourcemap: !isDeploy` means a production build emits none, so any that appear were
 * built in dev mode -- and four stale `css/*.css.map` files were committed that way, their
 * `sources` still pointing at a Windows path in the pre-migration _client/styles tree. They were
 * referenced by nothing and are now deleted. This stops them coming back.
 */
const maps = [...walk(path.join(ASSETS, 'js')), ...walk(path.join(ASSETS, 'Ojin')),
    ...walk(path.join(ASSETS, 'hnhn'))].map(rel).filter((r) => r.endsWith('.map'));

const cssMaps = fs.readdirSync(path.join(ASSETS, 'css')).filter((f) => f.endsWith('.map'));

assert.deepEqual([...maps, ...cssMaps], [],
    'the committed output carries no source maps -- a production build emits none');

const withMapComment = ours
    .filter((f) => /sourceMappingURL/.test(fs.readFileSync(f, 'utf8')))
    .map(rel);

assert.deepEqual(withMapComment, [],
    'and no file we compile carries a sourceMappingURL comment pointing at one');

/*
 * drop_console keeps warn and error on purpose. With drop_console: true the catch handlers in
 * jit-require were minified to `.catch(()=>null)`, so a module failing to load produced no output
 * at all -- silence looked identical to success (item 22). Debug chatter goes; failures must not.
 */
const debugChatter = [];

for (const f of ours) {
    const text = fs.readFileSync(f, 'utf8');

    for (const level of ['log', 'info', 'debug', 'trace']) {
        if (text.includes(`console.${level}`)) debugChatter.push(`${rel(f)}  ->  console.${level}`);
    }
}

assert.deepEqual(debugChatter, [],
    'no console.log/info/debug/trace survives in anything we compile');

/*
 * The other half of that policy, and the part that actually bit: jit-require must still be able to
 * complain. Asserted on the real chunk rather than on source, because the stripping happened in
 * the minifier.
 */
const jitRequire = ours.find((f) => /jit-require/.test(rel(f)));

assert.ok(jitRequire, 'jit-require is emitted as its own chunk');

const jitText = fs.readFileSync(jitRequire, 'utf8');

assert.ok(jitText.includes('console.error'),
    'jit-require keeps console.error -- a module that fails to load must say so (item 22)');
assert.ok(jitText.includes('console.warn'),
    'jit-require keeps console.warn, which reports the loaded N of M count');

/*
 * Minification, checked by line length rather than by looking for short identifiers: an unminified
 * bundle is hundreds of short lines, a minified one is a handful of very long ones.
 */
const unminified = ours.filter((f) => {
    const lines = fs.readFileSync(f, 'utf8').split('\n');

    return lines.length > 30 && Math.max(...lines.map((l) => l.length)) < 200;
}).map(rel);

assert.deepEqual(unminified, [], 'everything we compile is minified');

// --- the checks can actually fail --------------------------------------------------------------

assert.ok(isFileExact(path.join(ASSETS, 'js/entry.js')), 'the resolver finds a file that exists');
assert.ok(!isFileExact(path.join(ASSETS, 'js/chunks/no-such-chunk.js')),
    'and rejects one that does not (proving the resolution check can fail)');
assert.ok(PACKAGE_NAME.test('jquery'), 'a real package name is classified as bare');
assert.ok(!PACKAGE_NAME.test(' + prev + '), 'and a code fragment is not (proving the filter is not vacuous)');
assert.ok(verbatim('js/jquery.js') && !verbatim('js/entry.js'),
    'the verbatim allowlist covers vendor files and not ours (proving B2.3 is not vacuous)');

assert.done();
