/*
 * B3.1 and B3.2 -- the compiled CSS is the CSS we meant to ship.
 *
 * This is the safety net for the remaining Sass work (backlog item 4, `@import` -> `@use`), where
 * the intended result is *no change in the compiled output*. A refactor that silently drops a
 * partial compiles cleanly, lints cleanly, and ships a stylesheet missing a few hundred rules that
 * nobody notices until a page looks wrong in production.
 *
 * A baseline under test/baselines/ records each stylesheet's selectors, at-rule conditions,
 * @font-face families and @keyframes names. Declaration-level churn is deliberately ignored: a
 * minifier may reorder or shorten declarations and the stylesheet is still equivalent.
 *
 *   npm test                                     compare against the baseline
 *   node test/run.js css --update-baseline       rewrite it, deliberately
 *
 * Updating is a separate command on purpose, so the diff lands in a commit and gets reviewed
 * rather than being absorbed silently by a test run.
 *
 * Proven able to fail: commenting one `@import` out of _core.scss and rebuilding removes 60
 * selectors from screen.css and turns the comparison red, naming them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as assert from './_assert.js';
import { ASSETS } from '../paths.mjs';
import { inventory } from './_css-inventory.js';

console.log('css inventory -- every stylesheet still styles what it styled');

// fileURLToPath, not new URL().pathname: the latter yields /C:/… on Windows.
const BASELINES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'baselines');

/* The stylesheets a Razor layout loads. Keyed by the name its baseline file takes. */
const STYLESHEETS = {
    screen: 'css/screen.css',
    print: 'css/print.css',
    editor: 'css/editor.css',
    'editor-fix': 'css/editor-fix.css',
    cdc: 'css/cdc.css',
    ojin: 'Ojin/css/ojin.css',
    hnhn: 'hnhn/css/hnhn.css',
    'hnhn-search': 'hnhn/css/search.css',
};

const updating = process.argv.includes('--update-baseline');

if (updating) fs.mkdirSync(BASELINES, { recursive: true });

// --- B3.2: nothing uncompiled leaked through -------------------------------------------------

/*
 * Checked before the baseline comparison, because a stylesheet full of raw Sass would also produce
 * a wall of meaningless selector differences. This way the real cause is reported first.
 *
 * `@import` is allowed only in its CSS form -- cdc.css legitimately imports a Google Fonts URL.
 * An import of a partial is Sass that never compiled.
 */
const LEAKS = [
    [/@mixin\b/, '@mixin'],
    [/@include\b/, '@include'],
    [/@extend\b/, '@extend'],
    [/@use\b/, '@use'],
    [/\$[a-z][\w-]*\s*:/i, 'a $variable declaration'],
    [/@import\s+['"][^'"]*\.scss/i, 'an @import of a .scss partial'],
    [/@import\s+['"](?!https?:)[^'"/][^'"]*['"]\s*;/i, 'an @import of a relative partial'],
];

for (const [name, rel] of Object.entries(STYLESHEETS)) {
    const file = path.join(ASSETS, rel);

    assert.ok(fs.existsSync(file), `${rel} exists`);

    const css = fs.readFileSync(file, 'utf8');
    const found = LEAKS.filter(([re]) => re.test(css)).map(([, label]) => label);

    assert.deepEqual(found, [], `${name}: no uncompiled Sass survived into ${rel}`);

    assert.ok(css.length > 100, `${name}: is not empty (${css.length} bytes)`);

    // Minified: a compiled stylesheet of any size is a handful of very long lines.
    const lines = css.split('\n');

    assert.ok(lines.length < 20 || Math.max(...lines.map((l) => l.length)) > 200,
        `${name}: is minified`);
}

// --- B3.1: the inventory matches the committed baseline ----------------------------------------

function describe(label, items) {
    return items.length
        ? `\n    ${label} (${items.length}):\n` +
          items.slice(0, 8).map((s) => '      ' + s).join('\n') +
          (items.length > 8 ? `\n      …and ${items.length - 8} more` : '')
        : '';
}

let totals = 0;

for (const [name, rel] of Object.entries(STYLESHEETS)) {
    const current = inventory(fs.readFileSync(path.join(ASSETS, rel), 'utf8'));
    const baselineFile = path.join(BASELINES, `${name}.json`);

    totals += current.selectors.length;

    if (updating) {
        fs.writeFileSync(baselineFile, JSON.stringify(current, null, 2) + '\n');
        console.log(`  wrote ${name}.json (${current.selectors.length} selectors)`);
        continue;
    }

    if (!fs.existsSync(baselineFile)) {
        assert.ok(false,
            `${name}: no baseline — run \`node test/run.js css --update-baseline\` to create one`);
        continue;
    }

    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    const problems = [];

    for (const kind of ['selectors', 'atRules', 'fontFaces', 'keyframes']) {
        const was = new Set(baseline[kind]);
        const now = new Set(current[kind]);
        const removed = baseline[kind].filter((x) => !now.has(x));
        const added = current[kind].filter((x) => !was.has(x));

        if (removed.length || added.length) {
            problems.push(`  ${kind}:${describe('REMOVED', removed)}${describe('ADDED', added)}`);
        }
    }

    assert.equal(problems.length, 0,
        `${name}: inventory matches the baseline (${current.selectors.length} selectors)` +
        (problems.length
            ? '\n' + problems.join('\n') +
              '\n  -> if this change is intended, run `node test/run.js css --update-baseline` and commit the diff'
            : ''));
}

if (updating) {
    console.log(`  baseline updated — review the diff before committing`);
    assert.done();
}

assert.ok(totals > 4000, `the baselines cover a plausible number of selectors (${totals})`);

// --- the comparison can actually fail ----------------------------------------------------------

/*
 * A clean run proves nothing on its own, so exercise the parser and the diff directly: the
 * inventory of a stylesheet with a rule removed must differ from the original, and in the
 * direction that names the missing selector.
 */
const sample = '.a,.b{color:red}@media (min-width:1px){.c{color:blue}}@font-face{font-family:X;src:url(x.woff)}';
const full = inventory(sample);

assert.deepEqual(full.selectors, ['.a', '.b', '.c'], 'the parser splits selector lists and descends into @media');
assert.deepEqual(full.atRules, ['@media (min-width:1px)'], 'and records the @media condition');
assert.deepEqual(full.fontFaces, ['X :: x.woff'], 'and the @font-face family with its src filename');

const reduced = inventory(sample.replace('.a,.b{color:red}', ''));

assert.ok(!reduced.selectors.includes('.a'),
    'removing a rule removes its selectors from the inventory (proving the comparison can fail)');

// A brace inside a string must not be read as a block, or every later selector shifts.
assert.deepEqual(
    inventory('.q{background:url("a{b.svg")}.r{color:red}').selectors, ['.q', '.r'],
    'a brace inside a quoted url() does not break the scan');

assert.done();
