/**
 * App Entry Point
 */


// Load site fonts
import './libs/fonts';

import './modules/components/closeAlertBanner';
import './modules/components/disclaimer-for-mobile';
import './modules/components/media-content-social-links';
import './modules/components/filter-resources';
import './modules/core/by-the-number';


// import js libaries that require global scope such as Foundation, LazySizes, etc
import './libs/global-includes';


// import the Module Controller and instantiate it
import ModuleController from './modules/module-controller';

$(document).ready(() => {
  ModuleController.loadModules($('html'));
});


$('#jump-nav-expand, .nav-arrow-link').click(() => {
  $('#jump-nav-expand').parent().toggleClass('expanded');
});
