import { defineConfig, loadEnv } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { normalizePath } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as sass from 'sass';

import { ASSETS, NODE_MODULES } from '#paths';
import {
    loadSites,
    collectEntries,
    collectCopyTargets,
    collectScssLoadPaths,
    collectAliases,
    assetOutBase,
    assetsInlineLimit,
} from './scripts/load-sites.mjs';
import { verbatimAssets } from './scripts/verbatim.mjs';
import { modernizrAsset } from './scripts/modernizr.mjs';

// ─── Path constants ──────────────────────────────────────────────────────────
//
// Anything reaching outside frontend/ comes from #paths, so a tree that moves
// does not silently relocate build output. See paths.mjs for why.

const RESOURCES_DIR     = normalizePath(ASSETS);

// Each site is a self-contained directory declaring its own entry points,
// static copies, SCSS load paths and aliases in a site.config.mjs. Nothing about
// any individual property is written down here — adding one is creating a
// directory, not editing this file. See README "Adding a site".
const sites = await loadSites();

// ─── font-version(): deterministic @font-face cache-busting ──────────────────
//
// @font-face URLs carry a ?token so a replaced font file is refetched. Everything
// under /assets is served with `Cache-Control: public, max-age=2592000`
// (PreSendHeadersMiddleware.cs), so without a token a rebuilt icons.woff would
// stay stale in browsers for 30 days.
//
// This used to be Sass's `unique-id()`, which returns a fresh random value on
// EVERY compile. That made the build non-deterministic — screen.css and
// editor.css showed as modified after any build, whether or not their inputs had
// changed — and it re-busted every font on every deploy, so users re-downloaded
// all four families each release for no reason.
//
// Hashing the font's own bytes fixes both: the token changes if and only if the
// file changes. Filenames are matched case-SENSITIVELY on purpose; IIS and macOS
// would silently accept a mismatch that 404s on a case-sensitive filesystem.

const FONTS_OUT_DIR = path.resolve(ASSETS, 'fonts');
const fontVersionCache = new Map();

function fontVersion(basename) {
    if (fontVersionCache.has(basename)) return fontVersionCache.get(basename);

    const matches = fs.readdirSync(FONTS_OUT_DIR)
        .filter((f) => f.slice(0, f.lastIndexOf('.')) === basename)
        .sort();

    if (matches.length === 0) {
        // The likely cause is a case mismatch, so look for a name that differs
        // only in case — that is exactly what IIS and macOS would have accepted.
        const near = fs.readdirSync(FONTS_OUT_DIR)
            .map((f) => f.slice(0, f.lastIndexOf('.')))
            .find((n) => n.toLowerCase() === basename.toLowerCase());
        throw new Error(
            `font-version(): no font files named '${basename}.*' in ${FONTS_OUT_DIR}.` +
            (near ? ` Did you mean '${near}'? Font filenames are matched case-sensitively.` : '')
        );
    }

    const hash = crypto.createHash('sha256');
    for (const f of matches) hash.update(fs.readFileSync(path.join(FONTS_OUT_DIR, f)));
    const version = hash.digest('hex').slice(0, 8);

    fontVersionCache.set(basename, version);
    return version;
}

const sassFunctions = {
    'font-version($basename)': (args) => new sass.SassString(
        fontVersion(args[0].assertString('basename').text),
        { quotes: false },
    ),
};

// ─── Prune orphaned hashed chunks ────────────────────────────────────────────
//
// build.emptyOutDir is false because wwwroot/assets also holds committed files
// this build does not produce (fonts/icons.* from the retired Grunt webfont
// task, for one). The side effect is that js/chunks/ accumulates every hashed
// chunk ever emitted: stale copies linger next to current ones, and greping
// the output directory reports content that is no longer served.
//
// Everything in js/chunks/ is generated, so anything not emitted by this build
// is safe to delete.

function pruneOrphanedChunks() {
    let emitted = new Set();
    let outDir = null;

    return {
        name: 'ana-prune-orphaned-chunks',
        apply: 'build',

        generateBundle(options, bundle) {
            // Prune the directory this build is actually writing to, not the configured one.
            // They differ when --outDir points somewhere else, which the committed-output test
            // does to build into a scratch directory; using the constant made a "scratch" build
            // delete live chunks out of wwwroot/assets.
            outDir = options.dir ?? RESOURCES_DIR;

            emitted = new Set(
                Object.keys(bundle)
                    .filter((f) => f.startsWith('js/chunks/'))
                    .map((f) => path.basename(f))
            );
        },

        closeBundle() {
            const chunkDir = path.join(outDir ?? RESOURCES_DIR, 'js', 'chunks');

            if (!emitted.size || !fs.existsSync(chunkDir)) {
                return;
            }

            for (const file of fs.readdirSync(chunkDir)) {
                if (!emitted.has(file)) {
                    fs.unlinkSync(path.join(chunkDir, file));
                    this.info(`pruned orphaned chunk: ${file}`);
                }
            }
        },
    };
}

// ─── Config ──────────────────────────────────────────────────────────────────

export default defineConfig(({ command, mode }) => {
    const isDeploy = mode === 'production';

    return {
        root: __dirname,
        appType: 'custom',

        // Everything this build emits is served from /assets/ (outDir is
        // ../wwwroot/assets). base must match, because Vite's preload helper
        // builds dynamic-import URLs as `base + chunkFileName` — with the
        // default '/' it requested /js/chunks/*.js and 404'd. Static imports
        // are relative and were unaffected, which is why only the CDC bundle
        // (the one using import.meta.glob) broke.
        base: '/assets/',

        css: {
            preprocessorOptions: {
                scss: {
                    functions: sassFunctions,
                    loadPaths: [
                        // Whatever each site declares — nursingworld's scss/ root,
                        // CDC's foundation-sites, and so on.
                        ...collectScssLoadPaths(sites),
                        // Lets SCSS import packages by bare name. _core.scss used
                        // to reach normalize-scss through a relative '../../node_modules'
                        // path, which encoded the tree's depth and broke the moment
                        // phase 3 moved it. Bare specifiers survive relocation.
                        NODE_MODULES,
                    ],
                },
            },
            devSourcemap: !isDeploy,
        },

        resolve: {
            // Declared per site; collectAliases() rejects a name claimed twice.
            // 'services' and 'templates' aliases were dropped in phase 3: both
            // pointed at directories that have never existed in this repo, and
            // nothing imported either prefix.
            alias: collectAliases(sites),
        },

        define: {
            global: 'globalThis',
        },

        build: {
            outDir: RESOURCES_DIR,
            // MUST stay false. wwwroot/assets holds committed files this build
            // does not produce — chiefly fonts/icons.{eot,ttf,woff}, the icon
            // webfont used by 97 CSS rules, whose Grunt build step was dropped
            // in the migration and never replaced (backlog item 16). Setting
            // this true deletes them with no build error.
            emptyOutDir: false,
            sourcemap: !isDeploy,

            // Per-site opt-out from data: URI inlining; see assetsInlineLimit().
            assetsInlineLimit: assetsInlineLimit(sites),

            rollupOptions: {
                // Vite defaults this to false for app builds, which tells Rollup
                // each entry is executed for side effects only — it drops the
                // entry's exports and then tree-shakes the now-unreachable module
                // body. Every view under the template's js/src ends with
                // `export default () => new SomeView()`, and the data-require
                // runtime (modules/jit-require.js) loads them with import() and
                // calls mod.default(). That default export must survive.
                preserveEntrySignatures: 'strict',

                // Every site's entries, keyed by output path. A site with an
                // outBase (OJIN's 'Ojin') has it prefixed here, which is the
                // only thing separating an owned namespace from the shared flat
                // one. These keys are a hard contract with Razor and with the
                // 124 data-require paths, so they must not drift.
                input: collectEntries(sites),

                output: {
                    // Preserve entry key as output path — jit-require.js builds
                    // the import() URL from the data-require value, so these must match
                    entryFileNames: '[name].js',

                    // Shared chunks extracted by Rollup land in js/chunks/
                    // and are loaded automatically as needed
                    chunkFileNames: 'js/chunks/[name]-[hash].js',

                    assetFileNames: (assetInfo) => {
                        // A CSS entry's [name] is its own entry key, which
                        // already carries the site's namespace (Ojin/css/ojin) —
                        // prefixing it again yields Ojin/Ojin/css/ojin.css.
                        if (assetInfo.name?.endsWith('.css')) {
                            return '[name][extname]';
                        }

                        // Everything else here was pulled in *by* a stylesheet
                        // (fonts, background SVGs) and is named by basename only,
                        // so it needs the owning site's namespace or it collides
                        // in the shared /assets/img. Sites on the flat namespace
                        // get '', i.e. exactly today's paths.
                        const base = assetOutBase(sites, assetInfo);
                        const at = (p) => (base ? `${base}/${p}` : p);

                        if (/\.(png|jpe?g|gif|svg|ico|webp)$/.test(assetInfo.name ?? '')) {
                            return at('img/[name][extname]');
                        }
                        if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name ?? '')) {
                            return at('fonts/[name][extname]');
                        }
                        return at('[name][extname]');
                    },
                },

                // jQuery is NOT external. It is aliased above to a shim that
                // re-exports window.jQuery, so every module shares the single
                // global instance loaded by /bundles/jquery. Marking it
                // external instead left an unresolvable bare "jquery"
                // specifier in the esm output (backlog item 23).
            },

            minify: isDeploy ? 'terser' : false,
            terserOptions: isDeploy ? {
                compress: {
                    // Drop debug chatter but KEEP console.warn/error. With
                    // drop_console: true the catch handlers in
                    // modules/jit-require.js were minified to `.catch(()=>null)`,
                    // so a module failing to load produced no output at all —
                    // silence looked identical to success. Errors must survive
                    // a production build.
                    drop_console: ['log', 'info', 'debug', 'trace'],
                },
                format:   { comments: false },
            } : undefined,
        },

        plugins: [
            pruneOrphanedChunks(),

            // Files that must ship as classic scripts rather than ES modules.
            verbatimAssets(sites, isDeploy),

            // Modernizr, built from the feature list nursingworld declares.
            modernizrAsset(sites, isDeploy),

            viteStaticCopy({
                targets: [
                    // Whatever each site declares: nursingworld's images and
                    // fonts, its three vendored lib files, and so on.
                    ...collectCopyTargets(sites),

                    // jQuery 3.7.1, sourced from npm so `npm audit` can see it.
                    // Previously vendored as loose minified files at 1.11.3,
                    // which is affected by CVE-2020-11022 / CVE-2020-11023 and
                    // was invisible to dependency scanning.
                    // Build-level rather than per-site: every property loads the
                    // same single instance via /bundles/jquery, whose output
                    // names are fixed by BundleInitialization.cs.
                    { src: normalizePath(path.resolve(NODE_MODULES, 'jquery/dist/jquery.js')),     dest: 'js', rename: { stripBase: true } },
                    { src: normalizePath(path.resolve(NODE_MODULES, 'jquery/dist/jquery.min.js')), dest: 'js', rename: { stripBase: true } },
                ],
            }),
        ],

        server: {
            proxy: {
                '/': {
                    target: 'https://localhost:44300',
                    changeOrigin: true,
                    secure: false,
                },
            },
            watch: {
                include: ['src/**'],
            },
        },
    };
});