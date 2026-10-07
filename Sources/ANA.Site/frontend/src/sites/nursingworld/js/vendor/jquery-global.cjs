/**
 * Resolves bare `jquery` imports to the single global jQuery.
 *
 * jQuery is loaded as a classic script by /bundles/jquery in the Razor layout,
 * before the module entry. It must stay one shared instance: Razor inline
 * scripts, EPiServer and the jQuery plugins all reach for window.jQuery, and
 * plugins register themselves on that global, so a second bundled copy would
 * give modules a jQuery with no plugins attached.
 *
 * This file is CommonJS on purpose (package.json sets "type": "module", hence
 * the .cjs extension). It has to satisfy two kinds of consumer:
 *
 *   ESM  `import $ from 'jquery'`  -> interop takes module.exports as default
 *   CJS  `require('jquery')`       -> gets module.exports directly
 *
 * An ESM version of this shim broke the second case: magnific-popup does
 * `factory(require('jquery'))`, and rolldown handed it the module namespace
 * object rather than the function, so `$(...)` threw "$ is not a function".
 * 42 views import magnific-popup, so that took out a large share of the site.
 */
if (!window.jQuery) {
    throw new Error(
        'jQuery global not found. /bundles/jquery must load before the module entry.'
    );
}

module.exports = window.jQuery;
