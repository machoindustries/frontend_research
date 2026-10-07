/**
 * Handlebars helpers for the CDC preview, ported from panini.
 *
 * Eight of the original eleven were registered but never used by any layout,
 * page or partial; only `base`, `favicon` and `svgInline` appear in templates
 * (plus `partial`, which panini used for the dynamic content include and which
 * vituum replaces with `{{> (lookup @root 'page')}}`). The unused ones are kept
 * here so templates that adopt them later still work.
 *
 * The three real ones previously read gulpfile.js/config; they are rewired to
 * the preview's own output layout.
 */
import fs from 'node:fs';
import path from 'node:path';

// Where the preview serves built assets from. Mirrors the gulp config's
// tasks.{js,css,images,static}.dest under a single /assets root.
const BASES = {
    js: '/assets/js/',
    css: '/assets/css/',
    images: '/assets/img/',
    static: '/assets/static/',
};

// Warn once per run rather than once per page: with 15 pages the same missing
// asset would otherwise print 15 times.
const warned = new Set();

const readIfPresent = (file, label) => {
    if (file && fs.existsSync(file)) {
        return fs.readFileSync(file, 'utf8');
    }

    if (!warned.has(label)) {
        warned.add(label);
        console.warn(`[cdc-preview] ${label} not found; injecting an empty string instead`);
    }

    return '';
};

export default function createHelpers({ previewRoot, assetsRoot }) {
    return {
        // {{base 'js'}} -> '/assets/js/'
        base: (type) => {return BASES[type] || '/';},

        // {{{favicon 'favicon.html'}}} -> inlines the generated favicon markup
        favicon: (name) =>
            {return readIfPresent(path.join(assetsRoot, 'favicon', name), `favicon ${name}`);},

        // {{{svgInline 'icons.svg'}}} -> inlines the symbol sprite sheet.
        //
        // gulp ran gulp-svg-sprite over src/icons/*.svg to emit a symbol sprite
        // and this helper read it back off disk. The sprite is built here
        // instead: it avoids a plugin whose output would have to exist before
        // the Handlebars transform runs, and keeps the helper self-contained.
        svgInline: () => {
            const iconDir = path.join(assetsRoot, 'icons');

            if (!fs.existsSync(iconDir)) {
                console.warn('[cdc-preview] icons directory not found; sprite omitted');

                return '';
            }

            const symbols = fs.readdirSync(iconDir)
                .filter((file) => {return file.endsWith('.svg');})
                .map((file) => {
                    const svg = fs.readFileSync(path.join(iconDir, file), 'utf8');
                    const id = path.basename(file, '.svg');
                    const viewBox = (svg.match(/viewBox="([^"]*)"/) || [])[1];
                    const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

                    return `<symbol id="${id}"${viewBox ? ` viewBox="${viewBox}"` : ''}>${body}</symbol>`;
                });

            if (!symbols.length) {
                return '';
            }

            return '<div class="svg-sprite-sheet visuallyhidden" aria-hidden="true">' +
                `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg></div>`;
        },

        // {{svgSprite 'name' 'title'}} -> a <use> reference into the sprite sheet
        svgSprite: (icon, title) =>
            {return `<span class="svg-sprite -${icon}"><svg role="img" aria-label="${title}">` +
            `<use xlink:href="#${icon}"></use></svg></span>`;},

        // --- registered by panini but unused in the current templates ---
        classAttr: (...args) => {
            const names = args.slice(0, -1).filter(Boolean);

            return names.length ? ` class="${names.join(' ')}"` : '';
        },
        ifObject: function ifObject(item, options) {
            return typeof item === 'object' ? options.fn(this) : options.inverse(this);
        },
        ifValue: function ifValue(a, b, options) {
            return a === b ? options.fn(this) : options.inverse(this);
        },
        join: (...args) => {return args.slice(0, -1).filter(Boolean).join(', ');},
        or: (...args) => {return args.slice(0, -1).some(Boolean);},
        stringToArray: (str, sep = ' ') => {return String(str || '').split(sep);},
        partial: (name) => {return name;},

        previewRoot: () => {return previewRoot;},
    };
}
