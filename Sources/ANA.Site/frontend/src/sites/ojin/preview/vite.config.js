import { definePreview } from '#preview-config';

// ─── OJIN preview (backlog item 34) ──────────────────────────────────────────
//
// Replaces the Vue demo app that shipped with the original OJIN project. Those
// 28 .vue files were only ever a preview — the CMS build never touched them —
// and their templates turned out to contain no Vue syntax at all: no v-for,
// v-if, v-bind or {{ }}, just static HTML with placeholder copy. The root
// components were pure composition (a wrapper div plus <Component /> tags), so
// each became a page partial and each component became a Handlebars partial.
// That let Vue leave the repo entirely rather than be carried for a preview.
//
// A page .json names a `template` (the layout partial) and a `page` (the body
// partial), which the layout pulls in with {{> (lookup @root 'page')}}.
//
//   npm run preview:site -- ojin
//   npm run build:preview:site -- ojin

export default definePreview({
    previewDir: __dirname,
    site: 'ojin',

    // ojin.css / ojin.js come from the real build, so the preview renders
    // exactly what the CMS serves rather than a second compilation. The images
    // are the committed set the live site already uses — the partials reference
    // them at /assets/Ojin/img/, rewritten from the Vue project's
    // '@/assets/images/' webpack alias.
    fromAssets: [
        { src: 'Ojin/css/ojin.css', dest: 'assets/Ojin/css' },
        { src: 'Ojin/js/ojin.js',   dest: 'assets/Ojin/js'  },
        { src: 'Ojin/img/**/*',     dest: 'assets/Ojin/img' },
    ],

    // Demo-only imagery the live site has no use for, kept here rather than
    // added to wwwroot. Currently one file: the -large variant the articledetail
    // <picture> asks for, which was in the Vue project but never deployed.
    fromPreview: [
        { dir: 'assets/img', dest: 'assets/Ojin/img', flatten: true },
    ],
});
