/*
 * The `<script src>` list a Razor layout renders, in document order.
 *
 * Read from the .cshtml rather than written down in a test, because the order IS the contract:
 * jQuery must be a classic script before the module entry, since the shim reads window.jQuery at
 * module-evaluation time (item 23). A list maintained in a test file would drift from the layout
 * silently, and the test would then be asserting a load order nothing uses.
 */

import fs from 'node:fs';
import path from 'node:path';

/* Server-side bundle routes; BundleInitialization.cs serves these from real files. */
const BUNDLE_ROUTES = {
    '/bundles/jquery': 'js/jquery.min.js',
    '/bundles/moderniz': 'js/modernizr-custom.js',
    '/bundles/modernizr': 'js/modernizr-custom.js',
};

export function layoutScripts(siteRoot, assets, layout) {
    // Razor comments hold dead script tags, as they do for OJIN's articleContent.js.
    const html = fs.readFileSync(path.join(siteRoot, layout), 'utf8').replace(/@\*[\s\S]*?\*@/g, '');
    const out = [];

    for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
        const src = /\ssrc\s*=\s*"([^"]+)"/i.exec(m[1])?.[1];

        if (!src) continue;   // an inline block, not a dependency

        const external = /^(https?:)?\/\//.test(src);
        const mapped = external
            ? null
            : BUNDLE_ROUTES[src] ?? (src.startsWith('/assets/') ? src.slice('/assets/'.length) : null);

        out.push({
            src,
            file: mapped ? path.join(assets, mapped) : null,
            module: /type\s*=\s*"module"/i.test(m[1]),
            external,
        });
    }

    return out;
}
