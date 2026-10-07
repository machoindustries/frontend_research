/*
 * Boots a page the way its Razor layout boots it, in jsdom, against the COMMITTED output.
 *
 * Why the committed output and not the source: every bug in backlog items 22-24, 27 and 28 was
 * made by the build or the minifier, not written by anyone. Testing the source would miss them.
 *
 * Each boot runs in its OWN process. That is not for speed -- it is correctness. ES modules are
 * cached per process by URL and a module's dependencies resolve to unqueried URLs, so a second
 * import of entry.js re-executes nothing and the second boot silently inherits the first one's
 * module graph. Both directions of that give confident, wrong answers, and both were observed
 * here: a boot that deliberately omitted jQuery passed because the shim was already evaluated,
 * and once the shim had failed every later boot failed with the cached error.
 *
 * The window cannot cross a process boundary, so a test asks for what it needs with `probe`.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ASSETS, WWWROOT } from '../paths.mjs';
import { layoutScripts as read } from './_layout-scripts.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.dirname(WWWROOT);

/** The script list a layout renders, each entry classified. */
export function layoutScripts(layout) {
    return read(SITE_ROOT, ASSETS, layout);
}

/**
 * @param {object}   o
 * @param {string}   o.layout     .cshtml whose script order to follow
 * @param {string}  [o.body]      fixture markup for <body>
 * @param {string}  [o.bodyAttrs] attributes on <body> itself
 * @param {object}  [o.stubs]     extra globals; each needs a reason in the calling test
 * @param {string[]}[o.skip]      local scripts to deliberately NOT load (load-order tests)
 * @param {string[]}[o.extraScripts] page-specific scripts the layout does not render, loaded
 *                                   after it in order (HNHN's four page scripts)
 * @param {object}  [o.probe]     what to read back out of the window:
 *                                  counts:  {name: selector}        -> how many match
 *                                  globals: [key]                   -> is window[key] defined
 *                                  jqFns:   [name]                  -> is $.fn[name] a function
 *                                  jqData:  {name: [sel, dataKey]}  -> that .data()'s keys
 *                                  classes: {name: [sel, class]}    -> does it carry the class
 * @returns {object} { errors, warnings, logs, loaded, skipped, counts, globals, jqFns, jqData,
 *                     classes, domContentLoaded: {registered, invoked, threw}, scripts }
 */
export function boot(spec) {
    const out = execFileSync(
        process.execPath,
        [path.join(HERE, '_boot-worker.mjs'), JSON.stringify(spec)],
        { cwd: path.dirname(HERE), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 }
    );

    try {
        return JSON.parse(out);
    }
    catch {
        throw new Error(`boot worker produced no result for ${spec.layout}:\n${out.slice(0, 600)}`);
    }
}
