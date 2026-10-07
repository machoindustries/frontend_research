# Icon font sources

These 59 SVGs are the source for the `icons` webfont served at
`/assets/fonts/icons.{eot,ttf,woff}` and mapped in
`src/templates/default/scss/settings/_icons.scss` (`$s-icons`). **97 CSS rules use it.**

## There is currently no build step

The Grunt `webfont` task that generated the font was dropped in the Vite
migration, and nothing replaced it. The three font files survive only because
they are committed and `build.emptyOutDir` is `false`. Editing an SVG here does
**not** change what the browser gets.

Consequences:

- Do not delete `wwwroot/assets/fonts/icons.*`.
- Do not set `emptyOutDir: true` without first restoring a build step.

## If you rebuild the font

`$s-icons` hardcodes codepoints `\f101`–`\f13b`, so a regenerated font must
assign exactly the same ones or all 97 rules render the wrong glyph — silently,
with no build error.

The original ordering has been recovered and verified: **codepoints are assigned
sequentially from `\f101` in order of the full filename including the `.svg`
extension.** That matters wherever a base name has suffixed variants, because
`-` (0x2d) sorts before `.` (0x2e):

    icon-file-doc.svg   \f11b
    icon-file-pdf.svg   \f11c
    icon-file-xls.svg   \f11d
    icon-file.svg       \f11e     <- after its variants, not before

Sorting by basename instead misplaces 10 glyphs (`icon-file`, `icon-tick`,
`icon-twitter`, `icon-workshop` and their variants).

Verify any rebuild by regenerating the map and diffing it against `$s-icons`
before shipping.

## Filenames

`icon-external link.svg` was renamed to `icon-external-link.svg` — the space
would not have matched the `'icon-external-link'` key in `$s-icons`. Keep names
hyphenated and lowercase.
