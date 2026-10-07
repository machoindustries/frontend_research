/*
 * A structural inventory of a compiled stylesheet: what it styles, not how.
 *
 * This exists for backlog item 4 -- the Sass `@import` -> `@use` migration -- where the intended
 * result is *no change in the compiled CSS*. "No change" is not something anyone can verify by
 * looking at a 277KB minified file, and a byte comparison is too strict: a minifier is free to
 * reorder declarations or shorten a colour and the stylesheet is still equivalent.
 *
 * So the baseline records the things whose loss would actually break a page -- a selector that
 * stops existing, an @media condition that changes, a @font-face that loses its src, a @keyframes
 * that disappears -- and ignores declaration-level churn.
 *
 * Hand-written rather than using a CSS parser because this suite takes no new dependencies, and
 * because the job is small: find block preludes, and read @font-face bodies. It tracks string
 * state so a brace inside url("…") or a data: URI cannot be mistaken for a block.
 */

/** Scans past a quoted string starting at `i`, returning the index after the closing quote. */
function skipString(css, i) {
    const quote = css[i];
    i += 1;

    while (i < css.length) {
        if (css[i] === '\\') i += 2;
        else if (css[i] === quote) return i + 1;
        else i += 1;
    }

    return i;
}

/** Index just past the `}` matching the `{` at `open`. */
function matchBrace(css, open) {
    let depth = 0;

    for (let i = open; i < css.length; i++) {
        const c = css[i];

        if (c === '"' || c === "'") { i = skipString(css, i) - 1; continue; }
        if (c === '{') depth += 1;
        else if (c === '}') {
            depth -= 1;
            if (depth === 0) return i + 1;
        }
    }

    return css.length;
}

const collapse = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * @param {string} css a compiled stylesheet
 * @returns {{selectors: string[], atRules: string[], fontFaces: string[], keyframes: string[]}}
 *   each sorted and de-duplicated, so the comparison is order-insensitive
 */
export function inventory(css) {
    const selectors = new Set();
    const atRules = new Set();
    const fontFaces = new Set();
    const keyframes = new Set();

    let buf = '';
    let i = 0;

    while (i < css.length) {
        const c = css[i];

        if (c === '"' || c === "'") {
            const end = skipString(css, i);

            buf += css.slice(i, end);
            i = end;
            continue;
        }

        if (c === '{') {
            const prelude = collapse(buf);

            buf = '';

            if (/^@font-face/i.test(prelude)) {
                const body = css.slice(i, matchBrace(css, i));
                const family = /font-family\s*:\s*([^;}]+)/i.exec(body)?.[1];
                // Record the src filenames, not the whole value: cache-bust tokens change
                // legitimately whenever a font's bytes change (item 32) and would otherwise
                // report as a baseline difference.
                const srcs = [...body.matchAll(/url\(\s*["']?([^"')?#]+)/gi)].map((m) => m[1].trim());

                fontFaces.add(`${collapse(family ?? '?')} :: ${srcs.sort().join(' ')}`);
            }
            else if (/^@(-\w+-)?keyframes/i.test(prelude)) {
                keyframes.add(prelude);
                // Percentage steps inside are declaration-level detail; skip the block.
                i = matchBrace(css, i);
                continue;
            }
            else if (prelude.startsWith('@')) {
                // @media / @supports / @container: the condition is the contract. Its contents
                // are scanned as normal, so nested selectors are recorded too.
                atRules.add(prelude);
            }
            else if (prelude) {
                for (const sel of prelude.split(',')) {
                    const s = collapse(sel);

                    if (s) selectors.add(s);
                }
            }

            i += 1;
            continue;
        }

        if (c === '}') { buf = ''; i += 1; continue; }

        // A statement at-rule such as @import or @charset ends at a semicolon.
        if (c === ';') {
            const statement = collapse(buf);

            if (statement.startsWith('@')) atRules.add(statement);

            buf = '';
            i += 1;
            continue;
        }

        buf += c;
        i += 1;
    }

    const sorted = (set) => [...set].sort();

    return {
        selectors: sorted(selectors),
        atRules: sorted(atRules),
        fontFaces: sorted(fontFaces),
        keyframes: sorted(keyframes),
    };
}
