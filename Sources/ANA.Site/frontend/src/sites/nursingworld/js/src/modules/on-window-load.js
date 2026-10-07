import $ from 'jquery';

/**
 * Run a callback once the page has fully loaded, including when that has
 * already happened.
 *
 * `window.load` fires exactly once and is not replayed for handlers attached
 * afterwards. That used to be safe: the pre-Vite Browserify bundle was a
 * classic script that executed during parse, long before load. It is no longer
 * safe — entry.js is now a deferred module, and modules/jit-require.js pulls
 * each view in with a dynamic import(), which the load event does not wait for.
 * A view therefore usually initialises *after* load has already fired, so
 * $(window).on('load', ...) would never run.
 *
 * The callback stays asynchronous in both branches so callers cannot come to
 * depend on it running synchronously in the already-loaded case.
 */
export default function onWindowLoad(callback) {

    if (document.readyState === 'complete') {

        window.setTimeout(callback, 0);

        return;
    }

    $(window).on('load', callback);
}
