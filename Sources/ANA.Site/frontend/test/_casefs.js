/*
 * Case-sensitive filesystem lookups.
 *
 * fs.existsSync and fs.statSync answer case-INSENSITIVELY on macOS and Windows, which is the whole
 * problem: a reference to SourceSansPro-SemiBold.woff matches SourceSansPro-Semibold.woff on a
 * developer machine and 404s the moment it is served from a case-sensitive filesystem or CDN, and
 * an import of modules/Utils resolves to utils.js on macOS while a Linux build either fails or
 * bundles a second copy.
 *
 * Both of those were live in this repo. Backlog item 32 found the first class in the SCSS -- which
 * is why fontVersion() in vite.config.js matches filenames case-sensitively -- and the test suite
 * still shipped unable to see either, because it asked the filesystem to resolve paths for it.
 *
 * These walk the real directory entries instead, comparing names as exact strings. Listings are
 * cached, so the per-segment walk costs about the same as a stat.
 */

import fs from 'node:fs';
import path from 'node:path';

const dirCache = new Map();

function entriesOf(dir) {
    if (!dirCache.has(dir)) {
        try { dirCache.set(dir, fs.readdirSync(dir, { withFileTypes: true })); }
        catch { dirCache.set(dir, []); }
    }

    return dirCache.get(dir);
}

/**
 * The real directory entry for an absolute path, or null when no entry's name matches exactly.
 *
 * @param {string} abs absolute path
 * @returns {?import('node:fs').Dirent} the entry, or null
 */
export function entryExact(abs) {
    const dir = path.dirname(abs);

    if (dir === abs) return null;   // reached the filesystem root

    return entriesOf(dir).find((e) => e.name === path.basename(abs)) ?? null;
}

/** Whether an absolute path exists as a file, matched case-sensitively. */
export function isFileExact(abs) {
    return entryExact(abs)?.isFile() === true;
}

/** Whether an absolute path exists as a directory, matched case-sensitively. */
export function isDirExact(abs) {
    return entryExact(abs)?.isDirectory() === true;
}

/**
 * The name on disk that differs from `abs` only in case, if there is one. Used to tell a
 * case-only mistake (actionable, and the real finding) from a reference to something that is
 * simply absent.
 *
 * @param {string} abs absolute path
 * @returns {?string} the on-disk basename, or null
 */
export function caseOnlyMatch(abs) {
    const want = path.basename(abs).toLowerCase();

    return entriesOf(path.dirname(abs)).find((e) => e.name.toLowerCase() === want)?.name ?? null;
}
