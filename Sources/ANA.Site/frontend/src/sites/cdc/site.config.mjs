// ─── CDC (Project Firstline) ─────────────────────────────────────────────────
//
// A campaign property with its own Razor layout (_CDC.cshtml), ported off
// gulp 3.9.1 + webpack 4 in backlog item 10. Its JS is Foundation end to end
// where the main site's is jQuery plugins, and the two trees share zero files
// and zero npm packages — item 33 checked, which is why there is no shared/.
//
// Output keys are pinned to js/cdc and css/cdc so the served URLs
// (/assets/js/cdc.js, /assets/css/cdc.css) and the <script>/<link> tags in
// _CDC.cshtml and _CDCHack.cshtml stay unchanged.

export default {
    order: 10,

    outBase: '',

    entries: {
        'js/cdc':  'js/campaign.js',
        'css/cdc': 'scss/campaign.scss',
    },

    copy: [],

    // campaign.scss does `@import 'foundation'` and `@import 'util/util'`,
    // both resolved out of the foundation-sites package. A leading ~ means
    // node_modules, the long-standing Sass convention.
    scssLoadPaths: ['~foundation-sites/scss'],

    lint: 'modern',
};
