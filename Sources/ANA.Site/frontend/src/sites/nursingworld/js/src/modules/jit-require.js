import $ from 'jquery';

/**
 * Base URL the per-module build outputs are served from.
 *
 * vite.config.js emits one file per entry in module-entries.json, keyed
 * by its source path — './src/views/foo' becomes /assets/js/src/views/foo.js.
 */
const MODULE_BASE = '/assets/js';

/**
 * Resolve a data-require value to the URL of its built module.
 * './src/views/accordion-item-view' -> '/assets/js/src/views/accordion-item-view.js'
 */
function moduleUrl(ref) {

    return `${MODULE_BASE}/${ref.replace(/^\.\//, '')}.js`;
}

export default function (container) {

    Promise.all($(container).find('[data-require]').toArray().map((el) => {

        const $el = $(el),
            data = $el.data(),
            ref = data.require;

        // Native dynamic import. This replaces a bare `loadjs` global that the
        // pre-Vite Browserify bundle happened to expose via `global.loadjs`;
        // Rollup does not provide it, and the npm loadjs API is a script
        // loader whose success callback receives no module, so it cannot
        // satisfy the `mod.default()` call below. import() returns a real
        // module namespace, which is what this code always expected.
        //
        // @vite-ignore: the specifier is only known at runtime. The target is
        // already emitted as its own entry, so no extra chunk is needed.
        return import(/* @vite-ignore */ moduleUrl(ref))
            .then((mod) => {

                if (!mod || typeof mod.default !== 'function') {

                    throw new Error(`Module ${ ref } has no default export`);
                }

                const instance = mod.default();

                instance.init($el, data);

                // Dropped from production builds by terser (drop_console), so
                // this is a dev-build diagnostic only. In production, silence
                // means success — failures below use console.error, which
                // survives minification.
                console.log('Loaded ', instance, ' from path ', ref);

                return instance;
            })
            .catch((err) => {

                console.error(`jit-require: failed to load ${ ref }`, err);

                return null;
            });

    })).then((modules) => {

        const loaded = modules.filter(Boolean).length;

        if (loaded !== modules.length) {

            console.warn(`jit-require: loaded ${ loaded } of ${ modules.length } module(s).`);
        }
    });
}
