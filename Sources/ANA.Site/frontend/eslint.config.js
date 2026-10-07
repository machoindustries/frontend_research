import js from '@eslint/js';

import { loadSites } from './scripts/load-sites.mjs';

// Sites declare their own lint profile in site.config.mjs, so adding a property
// does not mean remembering to edit this file. `modern` is the default; a site
// on `jquery-legacy` gets the relaxations below.
const sites = await loadSites();

// Globals a site's pages set up with plain <script> tags before its own code
// runs — Swiper and AOS for HNHN, grecaptcha from Google's widget. Declaring
// them per site keeps no-undef meaningful everywhere else.
const siteGlobals = sites
    .filter(({ config }) => config.globals?.length)
    .map(({ rel, config }) => ({
        files: [`${rel}/**/*.js`],
        languageOptions: {
            globals: Object.fromEntries(config.globals.map((g) => [g, 'readonly'])),
        },
    }));

const jqueryLegacy = sites
    .filter(({ config }) => config.lint === 'jquery-legacy')
    .map(({ rel }) => `${rel}/**/*.js`);

export default [
    // 1. Base recommended ruleset
    js.configs.recommended,

    // 2. Project config
    {
        // Every site's browser source. One glob rather than a list per property:
        // they are all plain DOM modules needing the same globals, including the
        // vendor/ shims (jquery-global) and the per-module views that the
        // data-require runtime loads.
        files: ['src/sites/**/*.js'],
        // (the .cjs jQuery shim is handled by its own block below)

        languageOptions: {
            // 2020+ for dynamic import(), used by jit-require.js to load
            // the per-module build outputs at runtime.
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Browser globals
                atob: 'readonly',
                sessionStorage: 'readonly',
                Blob: 'readonly',
                URL: 'readonly',
                location: 'readonly',
                navigator: 'readonly',
                FormData: 'readonly',
                requestAnimationFrame: 'readonly',
                matchMedia: 'readonly',
                alert: 'readonly',
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                Promise: 'readonly',
                fetch: 'readonly',
                // `self` deliberately NOT declared. It is a real browser global
                // (window.self), and declaring it meant no-undef could not catch
                // code using bare `self` where `const self = this` had been lost.
                // That masked a singleton in loading-spinner.js returning window,
                // plus 6 magnificPopup callbacks. Leave it undeclared so the
                // linter flags any recurrence.
                // Project globals
                jQuery: 'readonly',
                $: 'readonly',
            },
        },

        rules: {
            // --- Possible Errors ---
            'no-extra-parens': 'error',
            'no-unexpected-multiline': 'error',

            // --- Best Practices ---
            'accessor-pairs': ['error', { 'getWithoutSet': false, 'setWithoutGet': true }],
            'block-scoped-var': 'warn',
            'consistent-return': 'error',
            'curly': 'error',
            'default-case': 'warn',
            'dot-location': ['warn', 'property'],
            'dot-notation': 'warn',
            'eqeqeq': ['error', 'smart'],
            'guard-for-in': 'warn',
            'no-alert': 'error',
            'no-caller': 'error',
            'no-case-declarations': 'warn',
            'no-div-regex': 'warn',
            'no-else-return': 'warn',
            'no-labels': 'warn',
            'no-empty-pattern': 'warn',
            'no-eq-null': 'warn',
            'no-eval': 'error',
            'no-extend-native': 'error',
            'no-extra-bind': 'warn',
            'no-floating-decimal': 'warn',
            'no-implicit-coercion': ['warn', { 'boolean': true, 'number': true, 'string': true }],
            'no-implied-eval': 'error',
            'no-invalid-this': 'warn',
            'no-iterator': 'error',
            'no-lone-blocks': 'warn',
            'no-loop-func': 'error',
            'no-multi-spaces': 'error',
            'no-multi-str': 'warn',
            'no-new-func': 'error',
            'no-new-wrappers': 'error',
            'no-new': 'error',
            'no-octal-escape': 'error',
            'no-param-reassign': 'error',
            'no-proto': 'error',
            'no-redeclare': 'error',
            'no-return-assign': 'error',
            'no-script-url': 'error',
            'no-self-compare': 'error',
            'no-throw-literal': 'error',
            'no-unused-expressions': 'error',
            'no-useless-call': 'error',
            'no-useless-concat': 'error',
            'no-void': 'warn',
            'no-with': 'warn',
            'radix': 'warn',
            'wrap-iife': ['error', 'outside'],
            'yoda': 'error',

            // --- Variables ---
            'no-delete-var': 'error',
            'no-label-var': 'error',
            'no-shadow-restricted-names': 'error',
            'no-shadow': 'warn',
            'no-undef': 'error',
            'no-unused-vars': ['warn', {
                'vars': 'all',
                'args': 'none',
                'caughtErrorsIgnorePattern': '^_'
            }],
            'no-use-before-define': 'error',

            // --- ES6 — modern practices enforced ---
            'arrow-body-style': ['error', 'always'],
            'arrow-parens': ['error', 'always'],
            'arrow-spacing': ['error', { 'before': true, 'after': true }],
            'constructor-super': 'error',
            'generator-star-spacing': ['error', 'before'],
            'no-confusing-arrow': 'error',
            'no-class-assign': 'error',
            'no-const-assign': 'error',
            'no-dupe-class-members': 'error',
            'no-this-before-super': 'error',
            'no-var': 'error',           // upgraded WARN → ERROR
            'object-shorthand': 'error', // flipped 'never' → 'error' (always)
            'prefer-arrow-callback': 'error',  // upgraded WARN → ERROR
            'prefer-spread': 'error',          // upgraded WARN → ERROR
            'prefer-template': 'error',        // upgraded WARN → ERROR
            'require-yield': 'error',

            // --- Stylistic ---
            'camelcase': ['warn', { 'properties': 'never' }],
            'comma-spacing': ['warn', { 'before': false, 'after': true }],
            'comma-style': ['warn', 'last'],
            'computed-property-spacing': ['warn', 'never'],
            'keyword-spacing': 'error',
            'lines-around-comment': ['warn', { 'beforeBlockComment': true }],
            'max-depth': ['warn', 8],
            'max-len': ['warn', 300],
            'max-nested-callbacks': ['warn', 8],
            'max-params': ['warn', 8],
            // Every module here exports a capitalized *factory*
            // (`export default () => new Foo()`), so `GTMHelper()` without
            // `new` is the correct call. capIsNew:false drops that half of the
            // rule; newIsCap still requires constructors to be capitalized.
            'new-cap': ['warn', { capIsNew: false, newIsCap: true }],
            'new-parens': 'warn',
            'no-array-constructor': 'warn',
            'no-lonely-if': 'warn',
            'no-mixed-spaces-and-tabs': 'warn',
            'no-nested-ternary': 'warn',
            'no-new-object': 'warn',
            'no-unneeded-ternary': 'warn',
            'object-curly-spacing': ['warn', 'always'],
            'operator-linebreak': ['warn', 'after'],
            'quote-props': ['warn', 'consistent-as-needed'],
            'semi-spacing': ['warn', { 'before': false, 'after': true }],
            'semi': ['error', 'always'],
            'space-before-blocks': ['warn', 'always'],
            'space-in-parens': ['warn', 'never'],
            'space-unary-ops': 'error',
        },
    },

    // 3. Node-side code: build scripts and the test suite. Not browser code — these run under
    //    Node 24 as ESM, so they get Node's globals rather than the DOM's.
    {
        // .mjs as well as .js under test/: the DOM harness's worker and its resolve hook are
        // .mjs because Node's module.register() loads hooks as ESM regardless of package type.
        files: ['scripts/**/*.mjs', 'test/**/*.js', 'test/**/*.mjs', 'paths.mjs'],
        languageOptions: {
            globals: {
                console: 'readonly',
                process: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                URL: 'readonly',
                structuredClone: 'readonly',
            },
        },
    },

    // 3b. The CommonJS jQuery shim (see the file for why it is .cjs)
    {
        files: ['src/sites/*/js/vendor/*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                window: 'readonly',
                module: 'writable',
            },
        },
    },

    // 4. Ignore patterns
    {
        ignores: [
            // CDC preview build output (like wwwroot for the site build)
            'preview-dist/**',
            // Node-side build config, same treatment as the root vite.config.js
            'src/sites/*/preview/vite.config.js',
            // vendor/ is third-party by convention and never hand-edited, so
            // linting it only ever reports on code we do not own.
            'src/sites/*/vendor/**',
            'src/sites/*/site.config.mjs',
            'src/sites/*/js/lib/**',
            'src/sites/*/js/modernizr-custom.js',
            'Gruntfile.js',
            'Gruntproject.js',
            'scripts/**',        // optimise-images.mjs etc — Node scripts, not browser source
            'vite.config.js',
            'postcss.config.js',
            'server.js',
            'node_modules/**',
        ],
    },


    // 5. The `jquery-legacy` lint profile — currently OJIN (backlog item 34).
    //
    // This is jQuery-idiom DOM code: 39 function expressions, many of them
    // `.each()` / `.on()` callbacks that read `this` (`Jquery(this).addClass(...)`,
    // `this.innerHTML`). `prefer-arrow-callback` would rewrite those to arrows and
    // silently break every one — exactly the regression `61a129cd3` shipped and
    // item 28 had to undo. `no-invalid-this` flags the same callbacks as false
    // positives. `no-var` is off because var→let changes closure capture in loops,
    // and `no-use-before-define` because the file relies on function hoisting.
    //
    // These are stylistic rules, not correctness ones; everything in
    // js.configs.recommended still applies. The port was verified by output
    // equivalence (all 5 DOM hooks and 382/384 CSS selectors preserved), so
    // rewriting the source to satisfy style rules would trade proven behaviour
    // for a cosmetic win. Revisit if this code is ever substantially rewritten.
    {
        files: jqueryLegacy,
        rules: {
            'prefer-arrow-callback': 'off',
            'no-invalid-this':       'off',
            'no-var':                'off',
            'no-use-before-define':  'off',
            'wrap-iife':             'off',
            // Not auto-fixable, and each would mean editing working code:
            // eqeqeq changes coercion semantics, while block-scoped-var and
            // no-shadow flag the same hoisted-var idiom no-var already allows.
            'eqeqeq':                'off',
            'block-scoped-var':      'off',
            'no-shadow':             'off',
            // The hoisted-var loop idiom, e.g. a second `for (var i = ...)` in
            // one function. no-var is already off for exactly this reason:
            // var→let changes closure capture in loops.
            'no-redeclare':          'off',
            // `cond ? a() : b()` used as a statement. Works, and rewriting it
            // to if/else would be restyling code that is known to behave.
            'no-unused-expressions': 'off',
            // alert() is this era's error reporting and is user-visible
            // behaviour, not a debugging leftover.
            'no-alert':              'off',
        },
    },

    ...siteGlobals,
];