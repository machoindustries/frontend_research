// OJIN script entry.
//
// Ported from the Vue CLI project's src/entryPointForBackendBuild.js. These are
// the only five JS modules that build shipped: plain DOM code with no imports
// and no framework. Each self-initialises on DOMContentLoaded, which is why the
// old UMD export was never consumed by anything on the page.
import './navigationMenu.js';
import './articleContent.js';
import './articleHeadline.js';
import './search.js';
import './base.js';
