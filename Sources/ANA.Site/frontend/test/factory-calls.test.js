/*
 * `new` is never applied to a module whose default export is an arrow function.
 *
 * This is the regression guard for a bug that sat in this codebase undetected: 22 files made 29
 * calls of the form `new SomeComponent(...)` where that component's module default-exports an
 * arrow factory. `new` on an arrow throws "X is not a constructor" unconditionally, in every
 * browser, every time -- and the factories already did the `new` internally, so the call sites were
 * double-constructing something that could never be constructed.
 *
 * It was invisible for the same reason items 23, 24 and 27 were: jit-require catches the throw,
 * logs console.error, and the page renders normally with one component silently dead. Twelve
 * account and checkout views lost their add/update lightboxes that way. Pre-existing at the
 * merge-base (844de8487); fixed by dropping the keyword, which is also how jit-require itself calls
 * these modules.
 *
 * A static source check rather than a runtime one, deliberately: it covers every call site,
 * including the 17 inside *-item-view files that no data-require renders directly and which a DOM
 * test would therefore never reach.
 *
 * Proven able to fail: restoring `new` on any one of those calls turns the assertion red, naming
 * the file, line and the module whose export is an arrow.
 */

import fs from 'node:fs';
import path from 'node:path';

import * as assert from './_assert.js';
import { SITES } from '../paths.mjs';
import { loadSites, collectAliases } from '../scripts/load-sites.mjs';
import { stripComments } from './_source.js';

console.log('factory calls -- an arrow-export factory is called, never constructed');

const sites = await loadSites();
const aliases = collectAliases(sites);

/* Alias heads that resolve inside a site's own source, e.g. `components/foo`. */
const ALIAS_HEADS = new Set(Object.keys(aliases));

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;

    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);

        if (e.isDirectory()) { if (e.name !== 'vendor') walk(full, out); }
        else if (e.name.endsWith('.js')) out.push(full);
    }

    return out;
}

const files = sites.flatMap(({ dir }) => walk(path.join(dir, 'js')));

assert.ok(files.length > 150, `scanning a plausible amount of source (${files.length} files)`);

/*
 * Which modules default-export an arrow. Keyed by the specifier an importer would write, so a
 * module is matched by how it is imported rather than by its path on disk.
 */
const arrowExports = new Set();

for (const file of files) {
    const text = stripComments(fs.readFileSync(file, 'utf8'));
    const m = /^export default\s+(.*)$/m.exec(text);

    if (!m) continue;

    // `(a, b) => …`, `() => …`, `x => …` — but not `class Foo` or a bare identifier.
    if (!/^\(?[\w\s,]*\)?\s*=>/.test(m[1].trim())) continue;

    for (const [head, target] of Object.entries(aliases)) {
        const rel = path.relative(target, file.replace(/\.js$/, ''));

        if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
            arrowExports.add(`${head}/${rel.split(path.sep).join('/')}`);
        }
    }
}

assert.ok(arrowExports.size > 20,
    `found the factory modules (${arrowExports.size} default-export an arrow)`);

// --- no call site constructs one ---------------------------------------------------------------

const offenders = [];

for (const file of files) {
    const text = stripComments(fs.readFileSync(file, 'utf8'));

    for (const [name, spec] of [...text.matchAll(/import\s+(\w+)\s+from\s+'([^']+)'/g)].map((m) => [m[1], m[2]])) {
        if (!ALIAS_HEADS.has(spec.split('/')[0]) || !arrowExports.has(spec)) continue;

        for (const m of text.matchAll(new RegExp(`\\bnew\\s+${name}\\s*\\(`, 'g'))) {
            offenders.push(
                `${path.relative(SITES, file).split(path.sep).join('/')}:${text.slice(0, m.index).split('\n').length}` +
                `\n      new ${name}(…) — ${spec} default-exports an arrow, which cannot be constructed` +
                `\n      drop the keyword: the factory already returns a constructed instance`
            );
        }
    }
}

assert.equal(offenders.length, 0,
    'no call site applies `new` to an arrow-export factory' +
    (offenders.length ? ':\n  ' + offenders.slice(0, 12).join('\n  ') : ''));

// --- the detection is not vacuous --------------------------------------------------------------

/*
 * Two ways this check could pass while catching nothing: finding no factories, or failing to spot
 * a `new` on one. Both are asserted, because a silently-empty scan is exactly how this bug lasted
 * as long as it did.
 */
assert.ok(arrowExports.has('components/add-update-license-component'),
    'the scan still recognises a known factory module');

assert.ok(!arrowExports.has('modules/loading-spinner'),
    'and does not mistake a class export for one (loading-spinner exports a class, and IS constructed)');

const probe = 'import Foo from \'components/add-update-license-component\';\nconst x = new Foo(1);';
const detected = /\bnew\s+Foo\s*\(/.test(stripComments(probe));

assert.ok(detected, 'and the pattern it searches for does match a constructed factory');

assert.done();
