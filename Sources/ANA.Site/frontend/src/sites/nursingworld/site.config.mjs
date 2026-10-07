// ─── nursingworld ────────────────────────────────────────────────────────────
//
// The main site, and the only one carrying the data-require machinery: Razor
// views declare `data-require="src/views/foo"` and modules/jit-require.js loads
// the matching compiled file at runtime with a dynamic import(). That is why
// this site's 131 entry points are generated from a manifest rather than listed,
// and why their output paths are a hard contract — see dynamicEntries below.
//
// Output lands in the shared flat namespace (/assets/js, /assets/css) because
// _Base.cshtml has referenced those URLs since long before the Vite migration.

import fs from 'node:fs';
import path from 'node:path';

export default {
    // First, and must stay first: its 131 entries anchor the shared chunk names.
    order: 0,

    outBase: '',

    entries: {
        'css/screen':     'scss/screen.scss',
        'css/print':      'scss/print.scss',
        // Loaded only inside the Optimizely CMS editing UI.
        'css/editor':     'scss/editor.scss',
        'css/editor-fix': 'scss/editor-fix.scss',
    },

    /**
     * The data-require contract. Each module in module-entries.json must compile
     * to its own output file preserving directory structure, so the runtime can
     * resolve /assets/js/src/views/order-confirmation-page-view.js from the
     * attribute value. Output keys here are load-bearing: 124 hardcoded paths in
     * Razor views depend on them, and they are derived from the JSON rather than
     * from the source tree, which is what makes this site relocatable.
     */
    dynamicEntries(siteDir) {
        const mapping = JSON.parse(
            fs.readFileSync(path.join(siteDir, 'js/module-entries.json'), 'utf-8')
        );

        // main.js compiles to /assets/js/entry.js.
        const entries = { 'js/entry': path.join(siteDir, 'js/main.js') };

        // './main' is covered by the entry above.
        for (const mod of mapping['entry.js'].filter((m) => m !== './main')) {
            const relativePath = mod.replace(/^\.\//, '');
            entries[`js/${relativePath}`] = path.join(siteDir, 'js', `${relativePath}.js`);
        }

        return entries;
    },

    copy: [
        {
            // icons/ fed the Grunt webfont task that was dropped in the
            // migration and must not ship. This was once expressed as `filter:`,
            // which vite-plugin-static-copy does not support — the option was
            // silently ignored and all 59 icons were copied (backlog item 1).
            // A negative glob is honoured by tinyglobby.
            src: 'images/**/*.{png,jpg,gif,svg,ico,webp}',
            exclude: 'images/icons/**',
            dest: 'img',
            // Preserves subdirectories (logos/, content/, ...) which Razor and
            // the compiled CSS reference by path.
            stripBaseFrom: 'images',
        },
        {
            src: 'fonts/**/*.{eot,svg,ttf,woff,woff2}',
            dest: 'fonts',
            // Flat: screen.css references /assets/fonts/<file> directly.
            stripBaseFrom: 'fonts',
        },
        // Vendored files with no npm equivalent.
        //
        // NOTE: js/lib/entry.js is deliberately NOT copied. It is a 6MB pre-Vite
        // Browserify bundle left in lib/ by an old asset move; Rollup emits the
        // real js/entry.js from main.js, so copying it would overwrite the live
        // entry point.
        { src: 'js/lib/StringList.js',    dest: 'js',  flatten: true },
        { src: 'scss/lib/system.css',     dest: 'css', flatten: true },
        { src: 'scss/lib/ToolButton.css', dest: 'css', flatten: true },
    ],

    // Built from a declared feature list rather than downloaded by hand.
    // Served on every page via /bundles/moderniz; see js/modernizr.config.mjs.
    modernizr: {
        config: 'js/modernizr.config.mjs',
        dest:   'js/modernizr-custom.js',
    },

    // screen.scss and friends @import partials by bare path from scss/.
    scssLoadPaths: ['scss'],

    alias: {
        // Bare `import $ from 'jquery'` resolves to the global shim. The shim is
        // CommonJS on purpose: it has to satisfy both `import $ from 'jquery'`
        // and the `require('jquery')` that UMD plugins such as magnific-popup
        // perform. jQuery is NOT external — marking it so left an unresolvable
        // bare "jquery" specifier in the ESM output (backlog item 23).
        'jquery':     'js/vendor/jquery-global.cjs',
        'src':        'js/src',
        'components': 'js/src/components',
        'modules':    'js/src/modules',
        'views':      'js/src/views',
        'values':     'js/src/values',
    },

    lint: 'modern',
};
