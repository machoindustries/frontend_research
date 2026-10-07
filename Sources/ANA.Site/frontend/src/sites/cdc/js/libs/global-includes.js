
/**
 * Modernizer (Currently is only running a check for Object-Fit CSS support)
 */
// import './modernizr';

/**
 * Foundation 6.3 doesn't completely support jQuery 3.x
 * jQuery-Migrate needs to be imported if you start getting js errors in Foundation
 */
// import 'jquery-migrate';

/**
 * LazySizes library provides lazyloading and image srcset and background image
 * srcset polyfill plugins
 * Uncomment if using:
 */
// import 'lazysizes/plugins/respimg/ls.respimg.js';  // Lightweight image srcset polyfill
// import 'lazysizes/plugins/bgset/ls.bgset.js';  // Background Image srcset polyfill
// import 'lazysizes/lazysizes.js';  // Main library

/**
 * Foundation core library and plugins
 * Uncomment if using: (make sure $(document).foundation() is uncommented)
 * Inside foundation-includes uncomment the plugin imports and init functions for required plugins
 */
import './foundation-includes';

/**
 * Activates the Foundation JS libs
 */
$(document).ready(() => {
  $(document).foundation();
  // $('html').removeClass('loading');
});
