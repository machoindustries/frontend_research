/*
 * B1.3 -- the build does not depend on a case-insensitive file system.
 *
 * Developers here work on macOS and Windows, both of which resolve filenames case-insensitively.
 * Deploy targets and CDNs may not. So a wrong-cased import compiles fine on every machine anyone
 * tests on and then behaves differently elsewhere -- which is not a theory:
 *
 *   views/tab-control-view.js imported 'modules/Utils'; the file is utils.js. On Linux the build
 *   fails outright. On macOS it succeeded and bundled a SECOND copy of Utils into
 *   tab-control-view.js -- 4,637 bytes where a correct build emits 2,684. The committed output was
 *   wrong in 77 files and every check in this repo reported green.
 *
 * Razor and CSS `/assets/` references are covered by asset-references.test.js, which resolves
 * case-sensitively for the same reason. This file covers the two source-side specifier kinds:
 * JS imports and SCSS @import/@use.
 *
 * Needs no build, so it runs in the fast suite -- the point is to catch this before a build, not
 * after one has baked the wrong bytes.
 *
 * Proven able to fail: restoring 'modules/Utils' in tab-control-view.js turns the JS assertion red
 * and reports it as a case-only mismatch naming utils.js; renaming any SCSS partial's reference
 * does the same for SCSS.
 */

import fs from 'node:fs';
import path from 'node:path';

import * as assert from './_assert.js';
import { FRONTEND, NODE_MODULES } from '../paths.mjs';
import { loadSites, collectAliases, collectScssLoadPaths } from '../scripts/load-sites.mjs';
import { isFileExact, isDirExact, caseOnlyMatch } from './_casefs.js';
import { stripComments } from './_source.js';

console.log('source casing -- every specifier matches the name on disk, including case');

const sites = await loadSites();
const aliases = collectAliases(sites);
const scssLoadPaths = collectScssLoadPaths(sites);

function walk(dir, ext, out = []) {
    if (!fs.existsSync(dir)) return out;

    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);

        if (e.isDirectory()) walk(full, ext, out);
        else if (e.name.endsWith(ext)) out.push(full);
    }

    return out;
}

const rel = (p) => path.relative(FRONTEND, p).split(path.sep).join('/');


/** Classifies a resolution failure so a case mistake reads differently from a missing file. */
function classify(file, spec, candidates) {
    for (const c of candidates) {
        const near = caseOnlyMatch(c);

        if (near) {
            return `${rel(file)}\n      ${spec}  ->  CASE MISMATCH: on disk it is "${near}"`;
        }
    }

    return `${rel(file)}\n      ${spec}  ->  no such file (looked for ${candidates.length} candidate name(s))`;
}

// --- 1. JS import specifiers -------------------------------------------------------------------

/*
 * Resolved the way the build resolves them: through the aliases each site declares in its
 * site.config.mjs (read here via collectAliases, so this cannot drift from the real config), or
 * relative to the importing file. Bare specifiers are node_modules and are checked separately.
 */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

function jsCandidates(file, spec) {
    let base;

    if (spec.startsWith('.')) {
        base = path.resolve(path.dirname(file), spec);
    }
    else {
        const head = spec.split('/')[0];

        if (!aliases[head]) return null;   // bare: node_modules, handled below

        base = path.join(aliases[head], ...spec.split('/').slice(1));
    }

    // An alias may point straight at a file (jquery -> the .cjs shim), so try the literal path
    // before the usual extension and index forms.
    return [base, base + '.js', base + '.cjs', base + '.mjs',
        path.join(base, 'index.js'), path.join(base, 'index.cjs')];
}

const jsProblems = [];
const bareSpecifiers = new Set();
let jsChecked = 0;

for (const { dir } of sites) {
    for (const file of walk(path.join(dir, 'js'), '.js')) {
        // vendor/ is third-party and lib/ holds pre-Vite bundles the build does not compile.
        if (/\/(vendor|lib)\//.test(rel(file))) continue;

        const text = stripComments(fs.readFileSync(file, 'utf8'));

        for (const m of text.matchAll(SPECIFIER)) {
            const spec = m[1];
            const candidates = jsCandidates(file, spec);

            if (!candidates) {
                bareSpecifiers.add(spec);
                continue;
            }

            jsChecked += 1;

            if (!candidates.some((c) => isFileExact(c))) {
                jsProblems.push(classify(file, spec, candidates));
            }
        }
    }
}

assert.ok(jsChecked > 200, `checked a plausible number of JS specifiers (${jsChecked})`);

assert.equal(jsProblems.length, 0,
    'every aliased or relative JS import matches the on-disk name exactly' +
    (jsProblems.length ? ':\n  ' + jsProblems.slice(0, 10).join('\n  ') : ''));

// --- 2. bare JS specifiers are installed packages ---------------------------------------------

const missingPackages = [...bareSpecifiers].filter((spec) => {
    // A scoped package is @scope/name; otherwise the package is the first segment.
    const parts = spec.split('/');
    const pkg = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];

    return !isDirExact(path.join(NODE_MODULES, pkg));
}).sort();

assert.equal(missingPackages.length, 0,
    `every bare JS specifier is an installed package (${bareSpecifiers.size} distinct)` +
    (missingPackages.length ? ': ' + missingPackages.join(', ') : ''));

// --- 3. SCSS @import / @use -------------------------------------------------------------------

/*
 * Sass resolution order, which this mirrors: relative to the importing file first, then each
 * configured loadPath. For each of those, Sass accepts the partial form (_name.scss), the plain
 * form (name.scss), and an index file in a directory of that name. `sass:` builtins and
 * `@import url(...)` passthroughs are not file references.
 */
const SCSS_STATEMENT = /@(?:import|use)\s+([^;]+);/g;
const SCSS_SPEC = /['"]([^'"]+)['"]/g;

function scssCandidates(file, spec) {
    const roots = [path.dirname(file), ...scssLoadPaths, NODE_MODULES];
    const out = [];

    for (const root of roots) {
        const abs = path.resolve(root, spec);
        const dir = path.dirname(abs);
        const name = path.basename(abs);

        // An explicit .scss in the specifier must not become name.scss.scss.
        if (name.endsWith('.scss')) {
            out.push(abs, path.join(dir, '_' + name));
        }
        else {
            out.push(
                path.join(dir, `_${name}.scss`), path.join(dir, `${name}.scss`),
                path.join(dir, `_${name}.css`), path.join(dir, `${name}.css`),
                path.join(abs, '_index.scss'), path.join(abs, 'index.scss'),
            );
        }
    }

    return out;
}

const scssProblems = [];
let scssChecked = 0;

for (const file of walk(path.join(FRONTEND, 'src'), '.scss')) {
    const text = stripComments(fs.readFileSync(file, 'utf8'));

    for (const m of text.matchAll(SCSS_STATEMENT)) {
        const body = m[1];

        // `@import url(...)` is a CSS passthrough, not a file to resolve.
        if (/^\s*url\(/.test(body)) continue;

        for (const sm of body.matchAll(SCSS_SPEC)) {
            const spec = sm[1];

            if (spec.startsWith('sass:') || /^https?:/.test(spec)) continue;

            scssChecked += 1;

            const candidates = scssCandidates(file, spec);

            if (!candidates.some((c) => isFileExact(c))) {
                scssProblems.push(classify(file, spec, candidates));
            }
        }
    }
}

assert.ok(scssChecked > 250, `checked a plausible number of SCSS specifiers (${scssChecked})`);

assert.equal(scssProblems.length, 0,
    'every SCSS @import/@use matches the on-disk name exactly' +
    (scssProblems.length ? ':\n  ' + scssProblems.slice(0, 10).join('\n  ') : ''));

// --- 4. the checks can actually fail -----------------------------------------------------------

/*
 * A clean tree proves nothing on its own here: the build succeeds on this machine either way, which
 * is exactly how modules/Utils survived. So assert the primitive itself discriminates.
 */
const realFile = path.join(aliases.modules, 'utils.js');

assert.ok(isFileExact(realFile), 'the resolver finds modules/utils.js');
assert.ok(!isFileExact(path.join(aliases.modules, 'Utils.js')),
    'and rejects modules/Utils.js -- the exact mistake that shipped (proving sections 1-3 can fail)');
assert.equal(caseOnlyMatch(path.join(aliases.modules, 'Utils.js')), 'utils.js',
    'and reports the real name, so the failure message is actionable');

assert.done();
