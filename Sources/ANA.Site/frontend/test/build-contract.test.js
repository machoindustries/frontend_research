/*
 * The contract between the build output and the server that serves it.
 *
 * Asserted against the COMMITTED wwwroot/assets, not against a fresh build, because committed output
 * is what actually deploys: azure-pipelines.yml is a single `dotnet publish` step with no Node in it
 * (see README "CI/CD"). A green build on a developer machine that was never committed ships nothing.
 *
 * Every assertion here pins something a Razor layout, BundleInitialization.cs or jit-require.js
 * depends on by exact path. None of them would fail the build if they broke -- Rollup does not know
 * what Razor asks for.
 *
 * Proven able to fail: renaming wwwroot/assets/js/cdc.js turns assertion 6 red, and flipping
 * `preserveEntrySignatures: 'strict'` to false in vite.config.js then rebuilding turns assertion 32
 * red -- Rollup drops every default export and the build still reports success.
 */

import fs from 'node:fs';
import path from 'node:path';

import * as assert from './_assert.js';
import { ASSETS, SITES } from '../paths.mjs';

console.log('build output -- the paths Razor and the runtime ask for by name');

const exists = (rel) => fs.existsSync(path.join(ASSETS, rel));

// --- 1-8. the entry points each layout loads ---------------------------------------------------

[
    // _Base.cshtml:217 and BundleInitialization.cs
    ['js/entry.js', '_Base.cshtml loads the main site bundle'],
    ['css/screen.css', '_Base.cshtml loads screen.css'],
    ['css/print.css', 'print styles'],
    // Optimizely CMS editing UI only
    ['css/editor.css', 'the CMS editor stylesheet'],
    ['css/editor-fix.css', 'the CMS editor override stylesheet'],
    // _CDC.cshtml:13,74 and its _CDCHack.cshtml duplicate
    ['js/cdc.js', '_CDC.cshtml loads the CDC bundle'],
    ['css/cdc.css', '_CDC.cshtml loads the CDC stylesheet'],
    // _OJINBase.cshtml:26,85 -- the .umd.min.js name retired with the UMD wrapper (item 34)
    ['Ojin/js/ojin.js', '_OJINBase.cshtml loads the OJIN bundle'],
    ['Ojin/css/ojin.css', '_OJINBase.cshtml loads the OJIN stylesheet'],
    // BundleInitialization.cs:32 serves /bundles/jquery from here
    ['js/jquery.min.js', 'BundleInitialization.cs serves /bundles/jquery from this exact name'],
].forEach(([rel, why]) => {
    assert.ok(exists(rel), why + ' (' + rel + ')');
});

// --- 9. HNHN, whose whole output namespace is new ----------------------------------------------

[
    'hnhn/css/hnhn.css', 'hnhn/css/search.css', 'hnhn/css/bootstrap.min.css',
    'hnhn/css/aos.css', 'hnhn/css/swiper-bundle.min.css',
    'hnhn/js/hnhn-scripts.js', 'hnhn/js/search.js', 'hnhn/js/sign-up.js',
    'hnhn/js/questionnaire.js', 'hnhn/js/auto-complete.js',
    'hnhn/js/bootstrap.bundle.min.js', 'hnhn/js/aos.js', 'hnhn/js/swiper-bundle.min.js',
    // Reached from C#, not from a view: TinyMceSettingsExtensions.cs:34,78
    'hnhn/tinymce/editor.css',
].forEach((rel) => {
    assert.ok(exists(rel), '_Root.cshtml / TinyMCE loads ' + rel);
});

// --- 10. the HNHN scripts are actually minified ------------------------------------------------

/*
 * The gulp build this replaced was run by hand and had stopped being run: dist/js/questionnaire.js
 * was byte-identical to its source, so unminified source was serving in production. Nothing
 * detected that for months. Assert the output is smaller than the source it came from.
 */
['hnhn-scripts', 'search', 'sign-up', 'questionnaire', 'auto-complete'].forEach((name) => {
    const src = fs.statSync(path.join(SITES, 'hnhn/js', name + '.js')).size;
    const out = fs.statSync(path.join(ASSETS, 'hnhn/js', name + '.js')).size;

    assert.ok(out < src,
        name + '.js is minified on the way out (' + src + ' -> ' + out + ' bytes)');
});

// --- 11-13. the data-require contract ----------------------------------------------------------

/*
 * Razor views carry data-require="src/views/foo"; modules/jit-require.js turns that into a dynamic
 * import of /assets/js/src/views/foo.js at runtime. So every module named in the manifest must
 * exist at exactly that path, and must still carry a default export for jit-require to call.
 *
 * This is the contract itself, not a proxy for it: the counts below (131/130) are what items 7 and
 * 35 verified, and preserveEntrySignatures:'strict' is the only thing keeping the exports alive.
 */
const manifest = JSON.parse(
    fs.readFileSync(path.join(SITES, 'nursingworld/js/module-entries.json'), 'utf8')
);

const modules = manifest['entry.js'].filter((m) => m !== './main');
const missing = modules.filter((m) => !exists('js/' + m.replace(/^\.\//, '') + '.js'));

assert.equal(missing.length, 0,
    'every module in module-entries.json has a built file at its data-require path' +
    (missing.length ? ' (missing: ' + missing.slice(0, 3).join(', ') + ')' : ''));

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);

        return e.isDirectory() ? walk(full) : (full.endsWith('.js') ? [full] : []);
    });
}

const built = walk(path.join(ASSETS, 'js/src'));

assert.equal(built.length, 131, 'still 131 per-module outputs under js/src');

const withDefault = built.filter((f) => /as default|export default/.test(fs.readFileSync(f, 'utf8')));

assert.equal(withDefault.length, 130,
    'still 130 of them carry a default export -- jit-require.js calls mod.default()');

// --- B2.4: the data-require contract, from Razor through to the output -------------------------

/*
 * The assertions above check the manifest against the output. This checks the other end: the
 * values Razor views actually render.
 *
 * A view can rename its data-require and nothing complains -- the module still builds, the page
 * still renders, and the component simply never initialises. jit-require logs it, but only to a
 * console nobody is watching during a release.
 *
 * Razor comments are stripped, as in asset-references.test.js. Two targets live only inside
 * comments: src/views/cart-applied-promotions-view (which is in the manifest) and
 * src/views/account-member-upload-view (which is NOT -- so if anyone uncomments it, the first
 * assertion below fails, which is the behaviour we want rather than a KNOWN_GAPS entry).
 */
function cshtmlFiles(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
            if (['bin', 'obj', 'node_modules', '.git', 'wwwroot', 'frontend'].includes(e.name)) continue;
            cshtmlFiles(path.join(dir, e.name), out);
        }
        else if (e.name.endsWith('.cshtml')) out.push(path.join(dir, e.name));
    }

    return out;
}

const SITE_ROOT = path.dirname(path.dirname(ASSETS));
const normalise = (v) => v.trim().replace(/^\.\//, '');

const rendered = new Map();

for (const file of cshtmlFiles(SITE_ROOT)) {
    const text = fs.readFileSync(file, 'utf8').replace(/@\*[\s\S]*?\*@/g, '');

    for (const m of text.matchAll(/data-require\s*=\s*"([^"]+)"/g)) {
        // One attribute can name several modules, space separated.
        for (const target of m[1].split(/\s+/).filter(Boolean)) {
            const key = normalise(target);

            if (!rendered.has(key)) rendered.set(key, new Set());
            rendered.get(key).add(path.relative(SITE_ROOT, file));
        }
    }
}

assert.ok(rendered.size > 40,
    `found a plausible number of data-require targets in live markup (${rendered.size})`);

const manifestModules = new Set(modules.map(normalise));
const notInManifest = [...rendered.keys()].filter((k) => !manifestModules.has(k)).sort();

assert.equal(notInManifest.length, 0,
    'every data-require value a view renders is declared in module-entries.json' +
    (notInManifest.length
        ? ':\n' + notInManifest.map((k) => `  ${k}\n      ${[...rendered.get(k)].join('\n      ')}`).join('\n')
        : ` (${rendered.size} targets)`));

/*
 * And resolves to a real file at the exact URL jit-require builds -- /assets/js/<value>.js. Being
 * in the manifest is not sufficient on its own; this is the path the browser requests.
 */
const notBuilt = [...rendered.keys()]
    .filter((k) => !fs.existsSync(path.join(ASSETS, 'js', `${k}.js`)))
    .sort();

assert.equal(notBuilt.length, 0,
    'and each one has a built file at the URL jit-require requests' +
    (notBuilt.length ? ':\n  ' + notBuilt.map((k) => `/assets/js/${k}.js`).join('\n  ') : ''));

// A target no view renders is not a failure -- most manifest entries are components that views
// import directly rather than through data-require -- but the ratio is worth seeing when this
// output is read.
console.log(`  (${rendered.size} of ${manifestModules.size} manifest modules are reached via data-require)`);

// --- 14. the namespaces stay separate ----------------------------------------------------------

// A site that owns a namespace must not also be emitting into the shared one. This is the
// doubled-prefix class of bug from the other direction: Ojin/Ojin/css/ojin.css was a real mistake
// made while building this, caught only because the filename looked wrong.
assert.ok(!exists('Ojin/Ojin'), 'no doubled Ojin/Ojin/ namespace');
assert.ok(!exists('hnhn/hnhn'), 'no doubled hnhn/hnhn/ namespace');

assert.done();
