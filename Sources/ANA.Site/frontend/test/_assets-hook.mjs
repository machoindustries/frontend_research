/*
 * An ESM resolve hook that maps the URLs the shipped code requests onto the files on disk.
 *
 * modules/jit-require.js builds its specifier at runtime as `/assets/js/<ref>.js` and calls
 * import() on it. In a browser that is a URL; in Node an absolute specifier is a path from the
 * filesystem root, so every per-module load would fail with ENOENT and the DOM tests would only
 * ever prove that nothing loads.
 *
 * Rewriting the built files to use relative paths instead would mean testing something other than
 * what ships, which is the whole point of running these against the committed output. So the URL
 * stays exactly as the browser sees it and the resolver is taught where /assets lives.
 *
 * Registered by _dom.js via module.register(); the wwwroot path arrives through `data` because
 * hooks run on their own thread and do not share the main thread's module scope.
 */

let assetsBase = null;

export async function initialize({ base }) {
    assetsBase = base;
}

export async function resolve(specifier, context, next) {
    if (assetsBase && specifier.startsWith('/assets/')) {
        return {
            url: assetsBase + specifier.slice('/assets'.length),
            shortCircuit: true,
        };
    }

    return next(specifier, context);
}
