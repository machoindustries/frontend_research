// ─── Site discovery ──────────────────────────────────────────────────────────
//
// Finds every <site>/site.config.mjs and turns the declarations into the shapes
// Vite wants: rollup inputs, static-copy targets, SCSS load paths and aliases.
//
// This exists so that adding a property is creating a directory, rather than
// editing the same four central files it used to take — vite.config.js (three
// constants, an entry map and copy targets), package.json, eslint.config.js and
// a cloned preview config. Every one of those was a place to forget something.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizePath } from 'vite';

import { FRONTEND, SRC, NODE_MODULES, stripBaseFor } from '../paths.mjs';

const MANIFEST = 'site.config.mjs';

/**
 * Sites live at <src>/<group>/<site>/site.config.mjs. The group level is a
 * wildcard rather than a fixed name so discovery is unaffected by how the tree
 * is grouped — which is the point: the folder layout is for humans, and the
 * manifest is what the build reads.
 */
export async function loadSites() {
    const found = [];

    for (const group of fs.readdirSync(SRC, { withFileTypes: true })) {
        if (!group.isDirectory()) continue;

        const groupDir = path.join(SRC, group.name);

        for (const entry of fs.readdirSync(groupDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;

            const dir = path.join(groupDir, entry.name);

            if (!fs.existsSync(path.join(dir, MANIFEST))) continue;

            const mod = await import(pathToFileURL(path.join(dir, MANIFEST)).href);

            found.push({
                name: entry.name,
                dir,
                // Posix-separated and relative to frontend/, because config globs
                // (ESLint's `files`, for one) are always written that way.
                rel: normalizePath(path.relative(FRONTEND, dir)),
                config: mod.default,
            });
        }
    }

    if (found.length === 0) {
        throw new Error(`No sites found: expected at least one ${SRC}/*/*/${MANIFEST}`);
    }

    // Rollup derives shared-chunk names from the order entries are declared, so
    // input order is load-bearing: reshuffling it renames every js/chunks/*.js
    // file and cache-busts them for every visitor, even though nothing about
    // their content changed. Sites therefore pin an explicit `order`, and adding
    // a new one at the end leaves the existing chunk names untouched. `name` is
    // the tiebreaker only so filesystem order can never leak into the build.
    return found.sort((a, b) =>
        (a.config.order ?? 100) - (b.config.order ?? 100) || a.name.localeCompare(b.name)
    );
}

/** Prefixes an output key with the site's namespace, if it has one. */
function out(outBase, key) {
    return outBase ? `${outBase}/${key}` : key;
}

/** Rollup `input`: output key → absolute source path. */
export function collectEntries(sites) {
    const input = {};

    for (const { dir, config } of sites) {
        const { outBase = '' } = config;

        if (config.dynamicEntries) {
            for (const [key, abs] of Object.entries(config.dynamicEntries(dir))) {
                input[out(outBase, key)] = abs;
            }
        }

        for (const [key, src] of Object.entries(config.entries ?? {})) {
            input[out(outBase, key)] = path.join(dir, src);
        }
    }

    return input;
}

/** viteStaticCopy targets. */
export function collectCopyTargets(sites) {
    const targets = [];

    for (const { name, dir, config } of sites) {
        const { outBase = '' } = config;

        for (const item of config.copy ?? []) {
            // A leading ~ means node_modules, so a site can ship a stock vendor
            // file straight from npm instead of committing its own copy.
            const from = (p) => (p.startsWith('~')
                ? path.join(NODE_MODULES, p.slice(1))
                : path.join(dir, p));

            const src = [normalizePath(from(item.src))];

            if (item.exclude) {
                src.push(`!${normalizePath(from(item.exclude))}`);
            }

            // `flatten` drops every directory; `stripBaseFrom` names the
            // directory to strip and keeps what is below it. Getting this wrong
            // does not error, it just puts files in the wrong place — so the
            // depth is computed, never written down (backlog item 1).
            let stripBase;

            if (item.flatten) {
                stripBase = true;
            } else if (item.stripBaseFrom) {
                stripBase = stripBaseFor(from(item.stripBaseFrom));
            } else {
                throw new Error(
                    `${name}: copy target "${item.src}" needs either flatten or stripBaseFrom.`
                );
            }

            targets.push({ src, dest: out(outBase, item.dest), rename: { stripBase } });
        }
    }

    return targets;
}

/**
 * SCSS loadPaths. Entries are relative to the site directory; a leading ~ means
 * node_modules, the long-standing Sass convention.
 */
export function collectScssLoadPaths(sites) {
    return sites.flatMap(({ dir, config }) =>
        (config.scssLoadPaths ?? []).map((p) =>
            p.startsWith('~') ? path.join(NODE_MODULES, p.slice(1)) : path.join(dir, p)
        )
    );
}

/** resolve.alias. Values are paths relative to the declaring site. */
export function collectAliases(sites) {
    const alias = {};

    for (const { name, dir, config } of sites) {
        for (const [from, to] of Object.entries(config.alias ?? {})) {
            if (alias[from]) {
                throw new Error(`Alias "${from}" is declared by more than one site (${name}).`);
            }
            alias[from] = path.join(dir, to);
        }
    }

    return alias;
}

/**
 * Which site an emitted asset belongs to.
 *
 * Rollup's assetFileNames is a single global callback, but an image a site's CSS
 * references must land in that site's namespace — HNHN's squiggles belong at
 * /assets/hnhn/img/, not in the shared /assets/img/ where they would collide
 * with nursingworld's. The owning site is recovered from the asset's original
 * source path.
 *
 * Sites in the shared flat namespace (outBase '') are unaffected, so this
 * changes nothing for nursingworld or CDC.
 */
export function assetOutBase(sites, assetInfo) {
    const origins = assetInfo.originalFileNames ?? [];

    for (const origin of origins) {
        const normalized = normalizePath(origin);
        const owner = sites.find(({ rel }) => normalized.startsWith(`${rel}/`));

        if (owner?.config.outBase) return owner.config.outBase;
    }

    return '';
}

/**
 * build.assetsInlineLimit as a predicate.
 *
 * Vite inlines assets under 4KB as data: URIs by default. For a stylesheet in
 * <head> that is a bad trade — HNHN's hnhn.css grew 43.6KB → 68.2KB when its 28
 * background SVGs were inlined, delaying first paint on every page, while the
 * same images still had to be emitted as files because Razor references them
 * directly. A site opts out with `inlineAssets: false`.
 */
export function assetsInlineLimit(sites) {
    const noInline = sites.filter(({ config }) => config.inlineAssets === false);

    if (noInline.length === 0) return undefined;

    return (filePath) => {
        const normalized = normalizePath(filePath);
        // `false` forces a file; `undefined` defers to Vite's size heuristic.
        return noInline.some(({ rel }) => normalized.includes(`/${rel}/`)) ? false : undefined;
    };
}
