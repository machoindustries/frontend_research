// ─── Shared preview config factory ───────────────────────────────────────────
//
// The component previews (CDC, OJIN, and any site added later) are static
// Vituum + Handlebars sites, deliberately kept out of the build that produces
// the live site's assets — see backlog item 10, phase 2.
//
// They are near-identical: the same Vituum input workaround, the same flat
// partials directory, the same trick of copying the *built* CSS/JS out of
// wwwroot so the preview renders exactly what the CMS serves rather than a
// second compilation. Before this factory those ~100 lines were duplicated per
// site, and the duplication had already produced a live bug: CDC wrote to
// `preview-dist/` root with `emptyOutDir: true`, so building the CDC preview
// silently deleted the OJIN one. Each preview now gets its own subdirectory.
//
// Each site's preview/vite.config.js declares only what differs.

import { defineConfig, normalizePath } from 'vite';
import vituum from 'vituum';
import handlebars from '@vituum/vite-plugin-handlebars';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import * as yaml from 'js-yaml';
import path from 'node:path';
import fs from 'node:fs';

import { ASSETS, PREVIEW_DIST, stripBaseFor } from '../paths.mjs';

/**
 * Loads a directory of YAML into Handlebars globals keyed by filename, so
 * `data/cta-banner.yml` is addressed as {{cta-banner.cta-banner-1}}.
 *
 * This reproduces panini's namespacing, which CDC's 27 data files still rely on.
 * Vituum's own `data` option reads JSON only, so loading happens here instead —
 * which is what lets those files stay editable as YAML rather than being
 * converted once and then maintained in a worse format.
 */
export function loadYamlData(dir) {
    const globals = {};

    for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.yml') && !file.endsWith('.yaml')) {
            continue;
        }

        const key = file.replace(/\.ya?ml$/, '');

        try {
            globals[key] = yaml.load(fs.readFileSync(path.join(dir, file), 'utf8')) || {};
        } catch (err) {
            console.warn(`[preview] failed to parse ${file}: ${err.message}`);
            globals[key] = {};
        }
    }

    return globals;
}

/**
 * @param {object}   o
 * @param {string}   o.previewDir  absolute path of the site's preview/ directory
 *                                 (pass `import.meta.dirname`)
 * @param {string}   o.site        site name; the preview builds to preview-dist/<site>
 * @param {Array}    o.fromAssets  built files to mirror in, as { src, dest } where
 *                                 `src` is relative to wwwroot/assets. Always flattened.
 * @param {Array}    o.fromPreview the preview's own design assets, as
 *                                 { dir, glob, dest, flatten } relative to previewDir.
 * @param {object}   [o.helpers]   extra Handlebars helpers
 * @param {object}   [o.globals]   extra Handlebars globals (page data, etc.)
 */
export function definePreview({
    previewDir,
    site,
    fromAssets = [],
    fromPreview = [],
    helpers,
    globals = {},
}) {
    const targets = [
        ...fromPreview.map(({ dir, glob = '**/*', dest, flatten = false }) => ({
            src: normalizePath(path.join(previewDir, dir, glob)),
            dest,
            // `true` flattens the tree; a number preserves subdirectories below
            // that depth. CDC's images/ has logos/ and offerings/ subdirectories
            // that its templates reference by path, so it must not flatten.
            rename: { stripBase: flatten ? true : stripBaseFor(path.join(previewDir, dir), previewDir) },
        })),

        ...fromAssets.map(({ src, dest }) => ({
            src: normalizePath(path.join(ASSETS, src)),
            dest,
            rename: { stripBase: true },
        })),
    ];

    return defineConfig({
        root: previewDir,
        base: '/',

        plugins: [
            vituum({
                // Vituum's built-in input glob is hardcoded to ./src/pages/**;
                // user input is appended rather than replacing it, so a preview's
                // own pages must be declared here or rolldown gets no entrypoints
                // at all.
                input: ['./pages/**/*.json'],
                pages: { dir: './pages' },
            }),

            viteStaticCopy({ targets }),

            handlebars({
                // Flat partials directory so `{{> header}}` resolves by bare name.
                // Panini (CDC) registered by basename and the OJIN .vue imports
                // referenced them the same way; Vituum registers by path relative
                // to the partials directory, so flattening is what preserves both.
                root: 'partials',
                partials: { directory: 'partials', extname: false },
                ...(helpers ? { helpers } : {}),
                globals: { format: 'hbs', ...globals },
            }),
        ],

        build: {
            outDir: path.join(PREVIEW_DIST, site),
            emptyOutDir: true,
        },
    });
}
