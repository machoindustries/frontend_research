// ─── Verbatim (unbundled) assets ─────────────────────────────────────────────
//
// Some files must ship as *classic scripts*, not ES modules — minified, but with
// their contents otherwise untouched and their execution order preserved.
//
// HNHN is the case that needs this. Its five hand-written scripts have no
// import/export anywhere; they declare top-level `const`/`function` into the
// shared global scope and depend on load order, with `hnhn-scripts.js` calling
// `new Swiper` and `AOS.init` against globals set up by the vendor <script> tags
// above it. Making them Rollup entries would wrap each in its own module scope
// and require type="module" on every tag, which also defers execution — the trap
// items 22 and 10 both hit. So they are minified and copied instead, and
// modularizing them properly is a separate change with its own risk budget.
//
// This is a build step rather than a viteStaticCopy target because static copy
// cannot minify, and shipping these unminified would be a regression against the
// gulp build it replaces.

import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { minify } from 'terser';

import { NODE_MODULES } from '../paths.mjs';

function resolveSource(dir, src) {
    return src.startsWith('~')
        ? path.join(NODE_MODULES, src.slice(1))
        : path.join(dir, src);
}

/**
 * @param {Array}   sites    from loadSites()
 * @param {boolean} isDeploy whether to minify, matching build.minify
 */
export function verbatimAssets(sites, isDeploy) {
    return {
        name: 'ana-verbatim-assets',
        apply: 'build',

        async generateBundle() {
            for (const { name, dir, config } of sites) {
                const outBase = config.outBase ?? '';

                for (const item of config.verbatim ?? []) {
                    const matches = await glob(resolveSource(dir, item.src), { nodir: true });

                    if (matches.length === 0) {
                        this.warn(`${name}: verbatim source "${item.src}" matched no files`);
                    }

                    for (const file of matches.sort()) {
                        const raw = fs.readFileSync(file, 'utf8');
                        // Vendor files arrive already minified; re-minifying them
                        // is what the old gulp build did, for a 0.3–3% saving and
                        // a needless risk of changing third-party code.
                        const shouldMinify = item.minify !== false && isDeploy
                            && file.endsWith('.js');

                        const source = shouldMinify
                            ? (await minify(raw, {
                                // Same policy as the bundled output: drop debug
                                // chatter but keep console.warn/error, so a
                                // failure is never silent (backlog item 22).
                                compress: { drop_console: ['log', 'info', 'debug', 'trace'] },
                                format: { comments: false },
                            })).code
                            : raw;

                        this.emitFile({
                            type: 'asset',
                            fileName: [outBase, item.dest, path.basename(file)]
                                .filter(Boolean).join('/'),
                            source,
                        });
                    }
                }
            }
        },
    };
}
