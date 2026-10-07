/*
 * Every /assets/ URL the server side asks for must exist in wwwroot/assets.
 *
 * This is the cheap version of clicking every page looking for 404s. It is worth having because the
 * failure is invisible to everything else: a missing asset fails no build, no lint and no C#
 * compile -- it is a string in a .cshtml file and a broken image in a browser nobody opened.
 *
 * Two real bugs of exactly this shape are already on record. OJIN's ojin.css asked for
 * `img/chevron-down.svg` relative to a directory with no sibling img/, so the chevron on article
 * figure tables was missing in production for years (item 34). And vector-arrow.svg -- see
 * KNOWN_GAPS below -- has been 404ing on Hub pages since before this migration.
 *
 * Proven able to fail: pointing _Root.cshtml's stylesheet at /assets/hnhn/css/does-not-exist.css
 * turns assertion 2 red, naming both the missing URL and the view that asked for it. The
 * case-sensitivity is proven separately by restoring the capital B in
 * ConsentGate.cshtml's SourceSansPro-SemiBold.woff, which also turns assertion 2 red --
 * while fs.existsSync() answers true for that same path on macOS.
 */

import fs from 'node:fs';
import path from 'node:path';

import * as assert from './_assert.js';
import { ASSETS, WWWROOT } from '../paths.mjs';
import { isFileExact, isDirExact } from './_casefs.js';

const SITE_ROOT = path.dirname(WWWROOT);

console.log('asset references -- every /assets/ URL the server asks for resolves to a file');

/*
 * References that are known to be broken, with the reason. Asserted in BOTH directions: an
 * unresolved reference missing from this map fails, and an entry here that has started resolving
 * also fails, so a fix forces the entry to be deleted rather than left to rot.
 *
 * Every entry below was verified pre-existing against the merge-base (844de8487), not introduced by
 * the Vite migration.
 */
const KNOWN_GAPS = {
    '/assets/img/vector-arrow.svg':
        'Pre-existing, backlog item 26: this file has never existed in the repo and 404s on the ' +
        'live site. The CDC usages were replaced with a CSS chevron ' +
        '(src/sites/cdc/scss/components/_chevron.scss) but Hub/Views/Partials/_HubFilterSet.cshtml ' +
        'was missed, and Hub loads screen.css rather than cdc.css so that fix never reached it. ' +
        'Out of scope for the Vite migration -- fixing it is a visual decision for whoever owns Hub.',

    // scss/resources/_chosen.scss and _owl.scss are vendored copies of those packages' stylesheets.
    // Their sprites live in node_modules (chosen-js/, owl.carousel/dist/assets/) and have never been
    // copied into wwwroot. Pre-existing: at the merge-base the same CSS asked for
    // url("chosen-sprite.png") and /assets/css/chosen-sprite.png did not exist either. The migration
    // changed the path, not the outcome. Fixing it means adding a copy target for the two packages.
    '/assets/css/resources/chosen-sprite.png': 'chosen-js sprite never copied out of node_modules',
    '/assets/css/resources/chosen-sprite@2x.png': 'chosen-js retina sprite, same cause',
    '/assets/css/resources/owl.video.play.png': 'owl.carousel video play button, same cause',
};

/*
 * Stylesheets whose own url() references are not checked, with the reason. These are files this
 * repo ships but does not author, so an unresolved reference in them is not something a change here
 * can introduce or fix -- checking them would bury the signal under ~36 permanent failures.
 *
 * Razor and C# references are NEVER exempted this way: those we do author.
 */
const UNAUDITED_STYLESHEETS = {
    'assets/Ojin/style_ojin.css':
        'Committed artifact with no source anywhere in the repo (backlog item 34). Loaded by ' +
        'Views/Ojin/OjinArticlePage/Index.cshtml. Asks for a /assets/Client.Images/ tree and an ' +
        'Ojin/webfonts/ tree that have never existed here.',
    'assets/css/system.css':
        'Vendored Optimizely CMS stylesheet, copied verbatim from scss/lib/. Its /assets/Images/ ' +
        'references point at a tree the CMS shell owns, not one this build produces.',
    'assets/css/ToolButton.css':
        'Vendored Optimizely CMS stylesheet, same cause as system.css.',
};

// --- collect references ------------------------------------------------------------------------

/** Every .cshtml / .cs file under ANA.Site, skipping build output and dependencies. */
function sourceFiles(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
            if (['bin', 'obj', 'node_modules', '.git', 'wwwroot'].includes(e.name)) continue;
            sourceFiles(path.join(dir, e.name), out);
        }
        else if (/\.(cshtml|cs)$/.test(e.name)) {
            out.push(path.join(dir, e.name));
        }
    }

    return out;
}

const refs = new Map();

function record(url, from) {
    if (!refs.has(url)) refs.set(url, new Set());
    refs.get(url).add(from);
}

for (const file of sourceFiles(SITE_ROOT)) {
    let text = fs.readFileSync(file, 'utf8');

    // Razor comments hold dead markup. Views/Ojin/OjinContentDetailPage/Index.cshtml has
    // articleContent.js and articleHeadline.js commented out this way; they were folded into
    // ojin.js by item 34 and are not expected to exist.
    if (file.endsWith('.cshtml')) text = text.replace(/@\*[\s\S]*?\*@/g, '');

    const rel = path.relative(SITE_ROOT, file);

    for (const m of text.matchAll(/"~?(\/assets\/[A-Za-z0-9._/-]+)"/g)) record(m[1], rel);
}

// Built stylesheets reference fonts and background images of their own.
function cssFiles(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);

        if (e.isDirectory()) cssFiles(full, out);
        else if (e.name.endsWith('.css')) out.push(full);
    }

    return out;
}

for (const file of cssFiles(ASSETS)) {
    const rel = path.relative(WWWROOT, file).split(path.sep).join('/');

    if (rel in UNAUDITED_STYLESHEETS) continue;

    const text = fs.readFileSync(file, 'utf8');

    for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        const raw = m[1].trim();

        // data: URIs are inline; /globalassets/ is served by the CMS from outside wwwroot.
        if (/^(data:|https?:|\/globalassets\/|#)/.test(raw)) continue;

        if (raw.startsWith('/assets/')) {
            record(raw.split(/[?#]/)[0], rel);
        }
        else if (!raw.startsWith('/')) {
            // Relative, so resolve against the stylesheet's own directory. This is what catches a
            // rewritten path that points one level wrong -- the tinymce/editor.css case, which
            // reaches ../css/bootstrap.min.css and ../img/ after the move off /hnhn/dist/.
            const abs = path.resolve(path.dirname(file), raw.split(/[?#]/)[0]);
            record('/' + path.relative(WWWROOT, abs).split(path.sep).join('/'), rel);
        }
    }
}

// --- assert ------------------------------------------------------------------------------------

assert.ok(refs.size > 50, 'found a plausible number of references to check (' + refs.size + ')');

/*
 * Resolution is deliberately CASE-SENSITIVE -- see test/_casefs.js for why asking the filesystem
 * is not good enough. This test shipped reporting green while Views/Shared/ConsentGate.cshtml
 * asked for a font name that does not exist.
 */
function resolves(url) {
    const segments = url.split('/').filter(Boolean);
    let at = WWWROOT;

    for (let i = 0; i < segments.length; i++) {
        at = path.join(at, segments[i]);

        if (i === segments.length - 1) {
            // A reference ending in / is a directory base built by string concatenation, not a
            // file -- ArticleContentImportController.cs:212 composes /assets/img/OJINImages/ +
            // filename at runtime.
            return url.endsWith('/') ? isDirExact(at) : isFileExact(at);
        }

        if (!isDirExact(at)) return false;
    }

    return false;
}

const unresolved = [...refs.keys()].filter((u) => !resolves(u)).sort();
const unexpected = unresolved.filter((u) => !(u in KNOWN_GAPS));

assert.equal(unexpected.length, 0,
    'no unresolved asset references' +
    (unexpected.length
        ? ':\n' + unexpected.map((u) => '  ' + u + '\n      ' + [...refs.get(u)].join('\n      ')).join('\n')
        : ' (' + refs.size + ' checked, ' + Object.keys(KNOWN_GAPS).length + ' known gap(s) allowed)'));

// The other direction: a known gap that now resolves is stale and must be removed, or it silently
// grants an exemption to a URL that no longer needs one.
for (const [url, reason] of Object.entries(KNOWN_GAPS)) {
    assert.ok(!resolves(url),
        'known gap ' + url + ' is still missing -- if this fails it was FIXED, so delete the ' +
        'KNOWN_GAPS entry. Reason on record: ' + reason.slice(0, 60) + '...');
}

// Same for the exemption list: a stylesheet that no longer ships should not keep an exemption.
for (const rel of Object.keys(UNAUDITED_STYLESHEETS)) {
    assert.ok(fs.existsSync(path.join(WWWROOT, rel)),
        'unaudited stylesheet ' + rel + ' still ships -- if this fails, delete its exemption');
}

// --- the check can actually fail -----------------------------------------------------------------

assert.equal(resolves('/assets/js/entry.js'), true, 'a file that exists resolves');
assert.equal(resolves('/assets/js/no-such-file.js'), false,
    'a file that does not exist does not resolve (proving the check above can fail)');
assert.equal(resolves('/assets/img/'), true, 'a directory reference resolves as a directory');

assert.done();
