// ─── HNHN (Healthy Nurse, Healthy Nation) ────────────────────────────────────
//
// Migrated off a standalone gulp 5 build that lived inside wwwroot. That build
// did nothing but minify each file in place — no bundling, no module graph — and
// was run by hand: `dist/js/questionnaire.js` was byte-identical to its source,
// so unminified source had been shipping in production.
//
// HNHN is the most separate of the properties: a full ASP.NET area with its own
// Controllers/, Api/ and Services/, its own layout at
// HNHN/Views/Shared/Layouts/_Root.cshtml, and until this migration its own
// asset root at /hnhn/. Output now lands under /assets/hnhn/ like any other
// site, which puts it behind the same caching policy and the same build.

export default {
    order: 30,

    outBase: 'hnhn',

    // hnhn.css and search.css are real entries rather than verbatim copies,
    // because they carry 30 relative url() references to images and fonts.
    // Those resolved only from /hnhn/dist/css/ and break under *any* relocation,
    // so they had to be rewritten regardless — and letting Vite emit the assets
    // does it correctly, into this site's own namespace.
    entries: {
        'css/hnhn':   'scss/hnhn.css',
        'css/search': 'scss/search.css',
    },

    // Classic scripts, minified but not bundled. See scripts/verbatim.mjs for
    // why these cannot become Rollup entries as they stand.
    verbatim: [
        { src: 'js/*.js', dest: 'js' },

        // Swiper is kept as a committed pair rather than taken from npm. Its
        // CSS is byte-identical to stock 11.1.4, but the JS matches no published
        // Swiper build — it differs in real code, not just its banner — so
        // swapping it would be an untested library change riding along with a
        // structural migration. Revisit with a browser pass on the carousels.
        { src: 'vendor/js/*.js',   dest: 'js',  minify: false },
        { src: 'vendor/css/*.css', dest: 'css', minify: false },
    ],

    copy: [
        // Stock vendor files straight from npm, so `npm audit` can see them.
        // Verified against the copies they replace: bootstrap.bundle.min.js,
        // aos.js and aos.css are byte-identical, and bootstrap.min.css differs
        // by exactly one character — the committed copy had the non-breaking
        // space in `.blockquote-footer::before{content:"— "}` mangled into a
        // plain space by an editor round-trip, which npm restores.
        // Output filenames are unchanged, so _Root.cshtml's script order holds.
        { src: '~bootstrap/dist/css/bootstrap.min.css',      dest: 'css', flatten: true },
        { src: '~bootstrap/dist/js/bootstrap.bundle.min.js', dest: 'js',  flatten: true },
        { src: '~aos/dist/aos.css',                          dest: 'css', flatten: true },
        { src: '~aos/dist/aos.js',                           dest: 'js',  flatten: true },

        // Images the CSS does not reference — Razor reaches search_icon.svg and
        // image-bio-placeholder.svg directly. The CSS-referenced ones are
        // emitted by the entries above; same names, same content.
        { src: 'assets/images/**/*', dest: 'img', stripBaseFrom: 'assets/images' },

        // Loaded by the CMS editor, not by any page:
        // HNHN/Extensions/TinyMceSettingsExtensions.cs points AddSiteCss here.
        { src: 'tinymce/*.css', dest: 'tinymce', flatten: true },
    ],

    // hnhn.css is render-blocking in <head>. Vite's default 4KB inline limit
    // turned its 28 background SVGs into data: URIs and grew the file by 56%,
    // while those same images still ship as files for Razor to reference.
    inlineAssets: false,

    // Set up by plain <script> tags in _Root.cshtml before hnhn-scripts.js runs,
    // and by Google's reCAPTCHA widget on the sign-up page.
    globals: ['Swiper', 'AOS', 'grecaptcha'],

    scssLoadPaths: [],

    // Same jQuery idiom as OJIN: $(document).ready callbacks reading `this`,
    // function hoisting, and top-level var/const in shared global scope.
    lint: 'jquery-legacy',
};
