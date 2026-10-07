// ─── Modernizr ───────────────────────────────────────────────────────────────
//
// Builds Modernizr from a declared feature list instead of shipping a blob
// somebody downloaded. See src/sites/nursingworld/js/modernizr.config.mjs for
// what is declared and why; this file only turns that into an output file.
//
// Like the verbatim assets next door, the result must be a CLASSIC script: it is
// loaded by _Base.cshtml:90 as <script src="/bundles/moderniz"> with no
// type="module", and it has to run BEFORE entry.js because js/lib/modernizr.js
// is `export default window.Modernizr` — a snapshot taken at module-evaluation
// time. Making it a Rollup entry would wrap it in module scope and defer it,
// which is the trap backlog items 22 and 10 both hit.
//
// It is emitted through this.emitFile rather than written directly so it lands
// in whatever outDir the build is using. committed-output.slow.test.js builds
// into a scratch directory to diff against wwwroot, and a plugin that wrote to
// wwwroot unconditionally would make that comparison compare a file against
// itself.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { minify } from 'terser';

const require = createRequire(import.meta.url);

/**
 * @param {Array}   sites    from loadSites()
 * @param {boolean} isDeploy whether to minify, matching build.minify
 */
export function modernizrAsset(sites, isDeploy) {
    return {
        name: 'ana-modernizr',
        apply: 'build',

        async generateBundle() {
            for (const { name, dir, config } of sites) {
                if (!config.modernizr) continue;

                const { config: configPath, dest } = config.modernizr;
                const full = path.join(dir, configPath);

                if (!fs.existsSync(full)) {
                    this.error(`${name}: modernizr config "${configPath}" does not exist`);
                }

                const declared = (await import(pathToFileURL(full).href)).default;

                // modernizr is CommonJS and callback-based.
                const modernizr = require('modernizr');
                const raw = await new Promise((resolve, reject) => {
                    try {
                        modernizr.build(declared, resolve);
                    } catch (err) {
                        reject(err);
                    }
                });

                // A build that silently produced nothing would ship an empty file
                // and take every <html> feature class with it -- including the
                // .flexbox that screen.css depends on for its grid.
                if (!raw || raw.length < 1000) {
                    this.error(`${name}: modernizr build returned ${raw ? raw.length : 0} bytes`);
                }

                /*
                 * Modernizr emits a /*! ... !*\/ JSON metadata block per detect --
                 * 24 of them, 8.2KB after minification, on a render-blocking
                 * script that every page loads. They are stripped and replaced
                 * with one line recording the same thing that matters: what
                 * version was built, from how many detects, and from where.
                 */
                const version = /modernizr v([\d.]+)/.exec(raw)?.[1] ?? 'unknown';
                const banner = `/*! modernizr v${version} | ${declared['feature-detects'].length}`
                    + ` detects | built from ${configPath} | MIT */\n`;

                const source = isDeploy
                    ? banner + (await minify(raw, {
                        // Matches the bundled output and verbatim.mjs: drop debug
                        // chatter, keep warn/error so a failure is never silent.
                        compress: { drop_console: ['log', 'info', 'debug', 'trace'] },
                        format: { comments: false },
                    })).code
                    : raw;

                const outBase = config.outBase ?? '';

                this.emitFile({
                    type: 'asset',
                    fileName: [outBase, dest].filter(Boolean).join('/'),
                    source,
                });
            }
        },
    };
}
