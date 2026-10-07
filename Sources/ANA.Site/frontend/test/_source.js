/*
 * Comment stripping for source files.
 *
 * Commented-out code is not a reference, and this repo has plenty of it: dead `@import`s, disabled
 * class toggles, an `import` of a module that was deleted. Counting them would make a source scan
 * permanently red on a tree that is perfectly correct. asset-references.test.js strips Razor
 * `@*…*@` for the same reason.
 *
 * Shared because getting it wrong is subtle: a naive `//` strip eats the rest of any line
 * containing a `https://` URL inside a string.
 */

export function stripComments(text) {
    const noBlocks = text.replace(/\/\*[\s\S]*?\*\//g, ' ');

    return noBlocks.split('\n').map((line) => {
        let quote = null;

        for (let i = 0; i < line.length; i++) {
            const c = line[i];

            if (quote) {
                if (c === '\\') i += 1;
                else if (c === quote) quote = null;
            }
            else if (c === '"' || c === "'" || c === '`') quote = c;
            else if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
        }

        return line;
    }).join('\n');
}
