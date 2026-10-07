// ─── Cross-tree path constants ───────────────────────────────────────────────
//
// Every path that reaches outside its own directory lives here.
//
// The reason is a bug class this repo has hit repeatedly. Paths that encode how
// deep a directory sits — `TEMPLATE_DEPTH = 4`, `stripBase: 2`, the
// `'../../../../../wwwroot/assets'` climb duplicated in both preview configs —
// keep working right up until a tree moves, and then they misplace files
// *without erroring*. Backlog item 1 shipped a doubled `assets/img/images/` and
// leaked 59 icons that way; item 33 hit the same thing from the SCSS side and
// concluded that "bare specifiers survive relocation".
//
// Deriving these from one module, and computing depth from the directory itself
// rather than by hand, makes a future move a rename instead of an excavation.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** frontend/ — the npm project root and the Vite root for the site build. */
export const FRONTEND = path.dirname(fileURLToPath(import.meta.url));

/** Sources/ANA.Site/wwwroot — what the .NET app serves. */
export const WWWROOT = path.resolve(FRONTEND, '../wwwroot');

/**
 * The site build's outDir. Served under /assets/ with
 * `Cache-Control: public, max-age=2592000` (PreSendHeadersMiddleware.cs:30-35),
 * which is why cache-busting tokens here are load-bearing.
 */
export const ASSETS = path.resolve(WWWROOT, 'assets');

export const SRC = path.resolve(FRONTEND, 'src');

/** One directory per web property; see README "Adding a site". */
export const SITES = path.resolve(SRC, 'sites');

/** Static preview builds, one subdirectory per site. Git-ignored. */
export const PREVIEW_DIST = path.resolve(FRONTEND, 'preview-dist');

export const NODE_MODULES = path.resolve(FRONTEND, 'node_modules');

/**
 * `vite-plugin-static-copy`'s `rename.stripBase` counts leading segments of a
 * match's directory relative to the Vite root, so a copy of
 * `src/sites/nursingworld/images/logos/x.svg` into `dest: 'img'` needs 4 to land
 * at `img/logos/x.svg` — 5 flattens `logos/` away and 3 leaves a doubled path.
 * Both failure modes are silent, which is what makes hand-counting a bad idea.
 *
 * @param {string} dir  absolute path to the directory being copied from
 * @param {string} root absolute Vite root the copy is resolved against
 */
export function stripBaseFor(dir, root = FRONTEND) {
    const rel = path.relative(root, dir);

    if (!rel || rel.startsWith('..')) {
        throw new Error(
            `stripBaseFor(): ${dir} is not inside ${root}, so its depth is meaningless.`
        );
    }

    return rel.split(path.sep).length;
}
