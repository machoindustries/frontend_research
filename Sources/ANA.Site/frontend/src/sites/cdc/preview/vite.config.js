import path from 'node:path';

import { definePreview, loadYamlData } from '#preview-config';
import createHelpers from './helpers/index.js';

// ─── CDC preview (backlog item 10, phase 2) ──────────────────────────────────
//
// The standalone component preview, ported from panini + gulp 3.9.1 to Vituum.
// Deliberately separate from the site build (vite.config.js): this is a 15-page
// static site generator and has no business in the build that produces the live
// site's assets. Same package.json, so one dependency set and one Node pin.
//
//   npm run preview:site -- cdc
//   npm run build:preview:site -- cdc
//
// Only 3 of the 11 ported helpers are actually used (`base`, `favicon`,
// `svgInline`) — precisely the gulp-coupled ones. The other 8 are kept in case
// templates adopt them.

const PREVIEW = __dirname;

export default definePreview({
    previewDir: PREVIEW,
    site: 'cdc',

    // The preview's own copy of the design assets; gulp's images/fonts/static
    // tasks did this. Pages reference them as /assets/img, /assets/fonts and
    // /assets/static via the `base` helper. Subdirectories (logos/, offerings/)
    // are referenced by path and must survive the copy, so these are not
    // flattened — the trap backlog item 1 hit.
    fromPreview: [
        { dir: 'assets/images', dest: 'assets/img'    },
        { dir: 'assets/fonts',  dest: 'assets/fonts'  },
        { dir: 'assets/static', dest: 'assets/static' },
    ],

    // cdc.css / cdc.js come from the site build so the preview shows exactly
    // what ships. The chunks are required too: cdc.js imports them relatively
    // (it is the only bundle using import.meta.glob) and 404s without them.
    fromAssets: [
        { src: 'css/cdc.css',    dest: 'assets/css'        },
        { src: 'js/cdc.js',      dest: 'assets/js'         },
        { src: 'js/chunks/*.js', dest: 'assets/js/chunks'  },
    ],

    helpers: createHelpers({ previewRoot: PREVIEW, assetsRoot: path.join(PREVIEW, 'assets') }),
    globals: loadYamlData(path.join(PREVIEW, 'data')),
});
