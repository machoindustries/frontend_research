// ─── OJIN (Online Journal of Issues in Nursing) ──────────────────────────────
//
// Ported off Vue CLI in backlog item 34. It was never a Vue problem: the CMS
// build ran vue-cli-service over an entry importing only SCSS and five plain-JS
// modules — no .vue components at all — so the dead toolchain was dropped rather
// than revived and the existing Vite build absorbed the work as two entries.
//
// Output keys keep the files under /assets/Ojin/ next to the committed img/ and
// the two unowned stylesheets (style_ojin.css, ojin-bfoverride.css) that Razor
// loads from that directory. The .umd.min.js name retired with the UMD wrapper.

export default {
    order: 20,

    outBase: 'Ojin',

    entries: {
        'js/ojin':  'js/ojin.js',
        'css/ojin': 'scss/ojin.scss',
    },

    copy: [],

    scssLoadPaths: [],

    // vue.config.js injected breakpointsVars, colors and varsMixins into every
    // stylesheet via additionalData, and 14 of the 20 component files use those
    // variables without importing them. Vite's additionalData was the wrong tool
    // — this config is shared with every site, so it would leak. OJIN's SCSS is
    // all @import (never @use) and Sass @import is global-scope, so importing
    // the three once at the top of scss/ojin.scss covers everything after it.

    // jQuery-idiom DOM code: 39 function expressions, many .each()/.on()
    // callbacks reading `this`. Stylistic rules are off for this tree on
    // purpose — see the jqueryLegacy profile in eslint.config.js.
    lint: 'jquery-legacy',
};
