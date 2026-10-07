# Frontend Migration Backlog

Outstanding work from the Grunt/Browserify → Vite migration (`bfccb8a9`, 2026-06-25)
and the ESLint 7 → 10 flat-config pass that followed (`24d380b0`…`ee0231eb`).

Reconstructed 2026-09-11 from the current tree — the original backlog referenced
by `README.md` was never committed. Every item below was verified against the
working tree, not recalled.

**Branch:** `feature/vite-frontend-upgrade-20260624` — 5 ahead / 87 behind `develop`.

---

## P1 — Correctness

### 1. Static-copy output paths — RESOLVED 2026-09-11

`viteStaticCopy` builds its destination as `dest + dir`, where `dir` is the
matched file's path **relative to the Vite root** (`collectCopyTargets`, plugin
`dist/index.js`). Every target therefore nested its output under `_client/...`,
and `rename:` could not flatten it because `rename` only ever rewrites the
basename.

**Fix:** each target now uses the plugin's supported `rename: { stripBase }`.
Images use `stripBase: 2` — stripping `_client/images` while *preserving*
subdirectories (`logos/`, `HNHN/`, `OJINImages/`, ...), which Razor and the
compiled CSS reference by path. Fonts use `stripBase: 2`; the `scripts/lib`
and `styles/lib` targets use `stripBase: true` for a flat copy.

The 207 stale nested files under `wwwroot/assets/*/_client/` were deleted. All
nine copied lib files were confirmed byte-identical to the flat artifacts they
replace, so the served output is unchanged.

**Verified:** after the fix, appending a marker to
`_client/scripts/lib/StringList.js` and rebuilding propagates it to
`/assets/js/StringList.js` — the silent-loss failure described above is gone.
51 of 52 `url(/assets/...)` references in the built CSS resolve (see item 15).

Three latent bugs surfaced while fixing this, each previously masked by the
nesting:

- **`_client/scripts/lib/entry.js` is a 6MB pre-Vite Browserify bundle**, left
  in `lib/` by an old asset move and referenced by nothing. Its copy target
  landed harmlessly at a nested path before; flattened, it would have
  overwritten the real 1.8KB Rollup `js/entry.js` — the site's entry point.
  The target is now removed, with a comment explaining why.
- **The `filter:` option on the images target does nothing.**
  `vite-plugin-static-copy` never destructures `filter` and it is absent from
  the type definitions, so it was silently ignored and all 59 files under
  `_client/images/icons/` were being copied (they are tracked in git at the
  nested path). The Grunt build shipped none of them. Replaced with a negative
  glob (`!.../icons/**`), which tinyglobby honours.
- **`fonts/icons.{eot,ttf,woff}` are Grunt webfont output that nothing
  regenerates.** `screen.css` still references them and they survive only
  because `emptyOutDir` is `false`. They must not be deleted until the icon
  font is either rebuilt or inlined. Tracked as item 16.

### 2. Vendored jQuery / jQuery UI — RESOLVED 2026-09-11

jQuery **1.11.3 → 3.7.1**, jQuery UI **1.12.1 → 1.13.3**, both now installed
from npm (pinned exactly) instead of vendored as loose minified files. This
closes CVE-2020-11022 / CVE-2020-11023 and the jQuery UI XSS issues
(CVE-2021-41182/41183/41184), and makes both visible to `npm audit` — the
scan previously could not see the oldest code the site shipped.

**Audit findings before upgrading.** The codebase turned out to be unusually
clean for a jQuery 3 move. Across `_client/scripts/src/`, all `.cshtml` views
and the remaining vendored libs there was no `.andSelf()`, `$.browser`,
`.live()`/`.die()`, `.pipe()`, `$.Deferred`, or `jqXHR.success/error/complete`.
All 278 `.bind(` hits were native `Function.prototype.bind`. Only four call
sites needed changing:

- `.size()` (removed in 3.0) → `.length` — `episerver-forms-view.js:28,37`,
  `cta-block-view.js:73`
- `.unbind('click')` (deprecated) → `.off('click')` —
  `accordion-item-view.js:170`

`$.ajax({ success: ... })` as an *option* is still supported and was left
alone; `api-proxy.js`'s `queueItem.success/error` are its own callback
objects, not jqXHR methods.

**jQuery UI is built datepicker-only.** The vendored 1.12.1 file was not the
full library but a 36KB custom build (core + datepicker). Shipping
`jquery-ui-dist` instead would have added ~218KB to *every* page, since
`_Base.cshtml` loads `/bundles/jqueryui` globally. `datepicker.js` declares
only three dependencies, so `_client/scripts/vendor/jquery-ui-datepicker.js`
imports them and Rollup emits `js/jquery-ui.min.js` at **37,248 bytes** —
parity with the old 36,675. `jquery.min.js` also shrank, 95,992 → 87,533.

**Output paths are unchanged**, so `BundleInitialization.cs` needed no edit:
`/bundles/jquery` still resolves to `/assets/js/jquery.min.js` and
`/bundles/jqueryui` to `/assets/js/jquery-ui.min.js`. This only works because
item 1 fixed the static-copy paths first — before that, edits under
`scripts/lib/` never reached the served location.

**Verified** with a jsdom smoke test loading both files as plain script tags,
in bundle order: jQuery reports 3.7.1, `$.ui.version` 1.13.3, `.datepicker()`
applies the `hasDatepicker` class, creates `ui-datepicker-div`, and
`.data('datepicker').settings.dateFormat` is writable — the exact operation
`episerver-forms-view.js:53` performs.

Removed: the four vendored `scripts/lib/jquery*.js` files, and the stale
`wwwroot/assets/js/jquery-ui.js` (still 1.12.1, referenced by nothing, no
longer produced — it would have kept serving vulnerable code at that URL).

**Still needs a browser pass** — jsdom does not exercise layout or real
events. Check in particular: EPiServer Forms datepickers, `chosen-js` (1.6.2),
`owl.carousel` (2.2.0) and `magnific-popup`. See items 18-20.

### 3. Rebase on `develop` — RESOLVED 2026-09-11

Rebased onto `origin/develop` and force-pushed. Six files conflicted. The
notable one: develop had added a `csnalanding.scss` entry to `Gruntfile.js` and
`grunt_tasks/styles.js` for the new CSNA landing page, both of which this branch
deletes — resolving the delete alone would have left that page with no
rebuildable stylesheet. The entry was ported to `vite.config.js`.

Also dropped in the process: a personal sandbox `appsettings.Development.json`
(which had replaced the shared dev connection strings and would have clobbered
develop's new Auth0 block) and an accidental 576-line root `package-lock.json`
from an `npm install` run at the repo root.

---

## P2 — Migration debt

### 4. Sass deprecations before Dart Sass 3.0 — PARTLY DONE 2026-09-11

Five separate deprecations break at Dart Sass 3.0, not just `@import`. Two are
now fixed in our code; the `@import` → `@use` migration was attempted, failed
verification, and was reverted.

**Method.** Every step was checked by compiling all five entry points
(`screen`, `print`, `editor`, `editor-fix`, `cdc`) unminified before and after
and diffing, normalising out the `?u…` font cache-bust token that Sass
regenerates on every compile. The harness was validated against itself first —
five IDENTICAL with no changes — so a pass means something.

**Done, verified byte-identical:**

- `division` — the `/` operator replaced with `math.div()` across 15 files
- `if-function` — legacy `if()` replaced with CSS syntax

`color` reported nothing to migrate: all five `color-functions` warnings come
from `foundation-sites`, not us.

**`module` (@import → @use) was attempted and reverted.** Run with
`--migrate-deps` over the main-site entry points, it rewrote 117 of our files —
and collapsed `screen.css` from **414,424 bytes to 1,372**. The build did not
error; it silently produced almost nothing, which is exactly the failure mode
the output comparison exists to catch. Our SCSS was reverted with `git checkout`
and `node_modules` restored with `npm ci`; the harness then confirmed all five
entry points back to IDENTICAL.

The structural reason is visible in the tree: `screen.scss` is a single
`@import "_core"`, and `_core.scss` fans out to ~180 partials that freely
reference each other's variables and mixins through `@import`'s flat global
scope. `@use` namespaces members and requires explicit `@forward` chains, so a
faithful migration means designing those chains by hand. It is a real refactor,
not a tool run.

A second constraint: `--migrate-deps` rewrites `node_modules/foundation-sites`
and `normalize-scss` in place, which is both wrong and lost on the next install.
Any future attempt must pass our files as explicit entry points and solve the
dependency boundary deliberately.

**Remaining, measured by origin:**

| origin | count | kinds |
|---|---|---|
| our SCSS | 25 | `import` 15, `global-builtin` 10 |
| `foundation-sites` / `normalize-scss` | 24 | `if-function` 8, `slash-div` 6, `global-builtin` 5, `color-functions` 5 |

The 24 in dependencies cannot be fixed here — they need upstream releases, or
for CDC to move off Foundation 6.6.3. Not urgent either way: sass is pinned at
`^1.101.0` and 3.0 has not shipped.

### 5. `.nvmrc` — RESOLVED 2026-09-11

Created at `frontend/.nvmrc`, pinned to `24.14.0` to match the README's claim.

Verified rather than assumed: `nvm use` now resolves the version from the file,
and `npm run build` completes cleanly on 24.14.0 (the backlog previously only
recorded a passing build on 26.8.1). Worth noting why this mattered — the
default shell Node on the machine that last touched this branch is **v14.21.3**,
which cannot run Vite 8 at all. `fnm use` / `nvm use` silently no-op when no
`.nvmrc` is present, so the workflow the README documented was doing nothing.

**Remaining:** `frontend/package.json` has no `engines` field, so nothing
enforces the pin during CI or `npm install`. Add
`"engines": { "node": ">=24.14.0" }` to close the gap.

### 6. Grunt leftovers in the parent `package.json` — RESOLVED 2026-09-11

`grunt` 1.6.1 and `grunt-cli` removed from `Sources/ANA.Site/package.json`.
Nothing referenced them: that manifest's only scripts delegate into `frontend/`,
and there is no Gruntfile anywhere outside `frontend-cdc/` (which has its own).
Also dropped the now-stale `grunt_tasks/**` ignore from
`frontend/eslint.config.js` — that directory was deleted during the rebase.

Remaining `grunt` mentions in `README.md` and `postcss.config.js` are historical
prose describing the migration, and were left.

**Not acted on, but worth a decision:** the same manifest still carries `gulp`
5.0.0 and `gulp-cli` 3.0.0, and they look equally dead — the one gulpfile under
`ANA.Site` is `wwwroot/hnhn/gulpfile.js`, which has its *own* `package.json`
declaring gulp, gulp-cli, gulp-clean-css and gulp-uglify. `dotenv` has no
consumer at this level either. `less` is plausibly still wanted: `Styles/`
contains `.less` sources alongside the `.css` files the views link. Left alone
because removing them widens this item beyond Grunt and could break an
undocumented workflow.

### 7. Dead browserify config — RESOLVED 2026-09-11

Removed the `browserify` and `browserify-shim` blocks from
`frontend/package.json`. Rollup ignored both; the shim map
(jquery/chosen-js/waypoints/hoverIntent) is now expressed through the jQuery
alias (item 23) and the static-copy targets.

`_client/scripts/browserify-mapping.json` was live — read by
`buildEntryPoints()` to generate the per-module Rollup entries — so it was
renamed rather than deleted, to **`module-entries.json`**. References updated in
`vite.config.js`, `README.md` and the `jit-require.js` comment. Verified the
build is byte-for-byte equivalent afterwards: still 131 per-module outputs, 130
with a default export.

Also corrected two stale comments in `vite.config.js` and one in `README.md`
that still described `loadjs` as the runtime loader; it has been dynamic
`import()` since item 22.

### 8. Unused packages in `dependencies` — RESOLVED 2026-09-11

The original entry said these were build-only packages misclassified into
`dependencies`. That was wrong in a useful way: `express`, `yargs`, `glob-all`,
`fs-readdir-recursive` and `lodash` are not build-only — they are **not used at
all**. Nothing in `_client/`, `scripts/`, `vite.config.js` or
`eslint.config.js` imports any of them. So they were removed outright rather
than moved to `devDependencies`.

`loadjs` was removed for the same reason: item 22 replaced it with a native
dynamic `import()`, leaving it referenced only in comments. Its obsolete
`loadjs: 'readonly'` global was dropped from `eslint.config.js` too.

`dependencies` is now exactly `jquery` and `jquery-ui` — the only two packages
genuinely shipped to the browser. They belong there rather than in
`devDependencies`, which the original entry did not distinguish.

Effect: `npm ci` installs 230 packages instead of ~375, and `npm audit`
advisories drop from 10 to 7 (express accounted for most of the difference).
Verified with a clean `npm ci` followed by build and lint.

### 9. Legacy dependencies — RESOLVED 2026-09-11

Landed as three commits, split by risk so a regression is easy to isolate.

**Five packages were not outdated — they were unused.** `dotenv` 2.0.0,
`jsonfile` 2.4.0, `slash` 1.0.0, `events` 1.1.1 and `util` 0.10.4 are imported
by nothing. `events` and `util` were the two this item flagged as "check whether
anything still imports them before upgrading": nothing does, and every apparent
match was the English word (`utils.js`, `_tools-utils.scss`, "events" in prose).
Removed rather than upgraded. `express` had already gone under item 8.

**Upgraded:**

| Package | From | To | Notes |
|---|---|---|---|
| `cssnano` | 8.0.2 | 9.0.4 | dev-only; production minification verified |
| `eventemitter3` | 1.2.0 | 5.0.4 | required a source change — see below |
| `velocity-animate` | 1.2.3 | 1.5.2 | same major; defaults to real jQuery when present |
| `owl.carousel` | 2.2.0 | 2.3.4 | the jQuery-3-compatible release (item 18) |

**`eventemitter3` would have broken every component.** `BaseComponent`'s
constructor called `this.setMaxListeners(0)`, commented as turning off a memory
leak warning. That was never true — eventemitter3 has no listener limit and
never warns. The method was a no-op stub (`return this;`) in 1.x and was removed
in 2.0, so it is `undefined` in 5.0.4. Since every view and component extends
`BaseComponent`, upgrading alone would have thrown in that constructor on every
page: the same failure class as items 22-24, equally invisible to the build. The
call was removed and replaced with a comment explaining why.

**`owl.carousel` 2.3.4 changes initialisation semantics.** It adds
`checkVisibility`, defaulting to `true`, which makes a carousel skip work while
it is not visible. 2.2.0 had no such check — zero occurrences in its source.
Carousels rendered inside collapsed or tabbed containers would therefore behave
differently after the upgrade, and `HeroArea.cshtml` wraps the hero carousel in
a `[data-tabs]` element.

Rather than change behaviour during a dependency bump, the 2.2.0 semantics are
pinned: `modules/owl-config.js` sets
`$.fn.owlCarousel.Constructor.Defaults.checkVisibility = false` once, and all
eight owl views now import that module instead of `owl.carousel` directly. A
single default was chosen over editing ten call sites because four of them pass
external options objects (`this.owlCarouselOptions`, `carouselConfig`) where an
edit is easy to miss. Verified in the build: the emitted chunk contains
`Defaults.checkVisibility=!1` and all 8 views reference it.

Leaving `checkVisibility` at upstream's `true` is the better long-term default —
revisit under item 18, with a browser pass over every carousel that can start
hidden.

**Still needs a browser pass.** jsdom cannot validate owl (no layout, and its
timers keep the event loop alive), so the carousel upgrade is verified only at
build level. Check `/ancc` and any gallery/tab/accordion carousel.

### 10. Fold `frontend-cdc/` into the Vite build — RESOLVED 2026-09-11

CDC's two shipped assets are now built by Vite from `src/templates/campaign/`,
replacing gulp 3.9.1 + webpack. The three-hop pipeline (gulp build on legacy
Node → hand-copy into `_client/**/lib/` → static-copy into wwwroot) is gone;
`js/cdc` and `css/cdc` are ordinary Rollup entries, with output keys pinned so
`/assets/js/cdc.js` and `/assets/css/cdc.css` are unchanged.

**Dependency surface was a fifth of what the manifest claimed.** Only four
packages are actually imported — `foundation-sites`, `webfontloader`,
`pubsub-js`, `@terwanerik/scrolltrigger`. `lazysizes`, `jquery-migrate` and the
granular Foundation modules are all commented out in source; `lodash`,
`throttle-debounce`, `what-input` and `core-js` are unreferenced.

**Payload dropped 41%:** 301,436 bytes → 176,752 (cdc.js plus its static
chunks), because jQuery 3.5.1 is no longer bundled and Rollup tree-shakes better
than webpack 4. CSS went 227,304 → 168,102 with **an identical selector set** —
2,116 selectors before and after, differing by exactly the one dead rule below.

Four real defects surfaced, each of which the old toolchain hid:

- **`module-controller.js` used webpack's dynamic `require()`**
  (`require(\`./core/${name}\`)`), which webpack resolved by bundling the whole
  directory as a context module. Rollup cannot. Replaced with
  `import.meta.glob`, preserving the eager/lazy split exactly — `core/*` is
  bundled into cdc.js, `dynamic/*` code-splits (`modal` now has its own chunk).
- **`resource-modal.js` assigned to a bare `module`** (`module.$el = ...`).
  Under webpack that hit the injected CommonJS module object and worked by
  accident; in an ES module it is a `ReferenceError`. It ships — the Razor
  layouts carry `data-module-core="resource-modal"`. Rewritten to instance
  state, with `self` captured for the two jQuery `function()` callbacks where
  `this` is the DOM element. Behaviour is unchanged because exactly one element
  per page carries that attribute.
- **`cdc.js` is now ESM**, so both CDC layouts needed `type="module"` — the
  same trap as item 22, caught before it shipped this time.
- **Invalid CSS in `global/_base.scss`**: a `.card-link-icon` block nested
  inside `a[target="_blank"]:after`, compiling to a descendant of a generated
  pseudo-element. It can never match, so it had no effect; node-sass and cssnano
  passed it silently, lightningcss rejects it. Removed rather than relocated —
  lifting it would start hiding elements that are visible today.

**jQuery unified.** CDC bundled a private 3.5.1 via `ProvidePlugin` +
`expose-loader` while `_CDC.cshtml` loaded 3.6.0 from CDN on the next line —
two instances per page. Both layouts now load `/bundles/jquery` (3.7.1) before
slick and the inline slick call, with cdc.js deferred as a module after them.
`campaign.js` uses `$(document).ready()`, which jQuery replays, so deferral is
safe (unlike `window.load` — item 24).

Verified: no `require(`, no bare `module.`, no webpack runtime, no bare import
specifiers across cdc.js and its chunks; all three core modules present in the
glob map. Main-site invariants unchanged — 131 per-module outputs, 130 default
exports, every live `data-require` target resolving.

**Scope note.** This item covered the CDC theme only, and is closed. The
"phase 3" in the planning doc — moving `_client/` into
`src/templates/default/` + `src/shared/` — is the *main site* restructure, not
CDC work. It is optional, independent, and governed by the 124 hardcoded
`data-require` paths.

**Phase 2 done — panini → Vituum, gulp retired.** `frontend-cdc/` is deleted.
The preview lives at `src/templates/campaign/preview/` and builds with
`npm run build:preview:cdc` (dev server: `npm run preview:cdc`). Gulp 3.9.1,
webpack, Babel 7.9 and ESLint 6 are gone from the repo entirely.

Vituum 2.0.2 proved an unusually close fit. Its Handlebars plugin renders a
**pure-JSON page** as `{{> (lookup @root 'template')}}` — structurally identical
to panini's `{{> (partial this.template)}}` — so each page's front matter became
a JSON file, with `template` pointing at the layout and the content partial
carried in a new `page` key. It also requires `vite ^8.0`, exactly what this
project runs.

Mapping notes for anyone touching it later:

- **Partials were flattened.** Panini registered by basename, so `{{> header}}`
  worked from any subdirectory; Vituum registers by path relative to the
  partials directory. The 102 source files hold only 100 unique basenames — the
  two duplicates (`header.html`, `main-nav.html`) are byte-identical — so a flat
  directory is lossless.
- **Data stays YAML.** Vituum reads JSON only, so the 27 `.yml` files are parsed
  in the config and passed as `globals` keyed by filename, preserving panini's
  `{{cta-banner.cta-banner-1}}` addressing without converting them.
- **The config lives in the preview directory** and the npm scripts `cd` there.
  The Handlebars plugin derives partial names with `relative(root, dir)` and
  then uses that relative string against absolute paths, which only resolves
  when `process.cwd()` equals the Vite root.
- **Only 3 of the 11 helpers were actually used** (`base`, `favicon`,
  `svgInline`) — precisely the gulp-coupled ones. All three are rewired; the
  other 8 are kept in case templates adopt them. `svgInline` now builds the
  symbol sprite from `assets/icons/*.svg` directly, rather than reading a file
  some plugin would have to emit first — which also removed the need for
  `vite-svg-sprite-wrapper`.

Two pre-existing defects surfaced:

- `data/side-promo.yml` had a quoted scalar whose continuation lines sat at the
  same indentation as their key — invalid YAML. Panini's parser tolerated it,
  js-yaml does not. Re-indented; the only content edit in the port.
- The layout declares `<!doctype html5>`, so the preview renders in quirks mode.
  Left alone — see item 29.

**Browser pass done — two issues found and fixed:**

- **Chunk 404s (`/js/chunks/*.js`).** Vite's preload helper builds
  dynamic-import URLs as `base + chunkFileName`, and `base` defaulted to `/`
  while everything here is served from `/assets/`. Static imports are relative
  and were unaffected, so only the CDC bundle broke — it is the only one using
  `import.meta.glob`. Fixed by setting `base: '/assets/'`. The main site was
  never affected because `jit-require.js` builds its own absolute URL under
  `@vite-ignore`.

- **`Cannot read properties of null (reading 'getAttribute')`** —
  **pre-existing, not from this port.** `filter-resources.js` read
  `document.getElementById('api-search').getAttribute('name')` unguarded.
  `#api-search` exists only on the resource-search page; everywhere else that
  threw. Verified identical in the pre-port bundle, introduced by
  `366d32400 Search updates`.

  It mattered more than a stray console error: the throw is at line 35 of a
  170-line `$(document).ready()` handler, so everything after it never ran —
  including the filter-expand and form-submit fixes committed earlier in
  `ed752a502`. Those were dead on every CDC page without `#api-search`. Guarded
  with an early return.


---

## P3 — Cleanup

### 11. IE-era dead files — RESOLVED 2026-09-11

Removed 11 files: `screen-ie8.scss`, `screen-ie9.scss`, the four
`es5-shim`/`es5-sham` sources under `scripts/lib/`, their four committed copies
under `wwwroot/assets/js/`, and `scripts/lib/bower/jquery.js`. The four stale
`<None Include>` entries for the es5 shims were dropped from `ANA.Site.csproj`
as well. None had any reference in a Razor view, SCSS chain or the Vite config.

**`lib/modernizr.js` was kept — the original entry was wrong about it.** It is
not a vendored copy of Modernizr; it is a one-line ESM shim
(`export default window.Modernizr;`) imported by
`components/object-fit-polyfill.js` and `views/view-more-view.js`, and it appears
in two built outputs. The live Modernizr is a separate 14KB
`wwwroot/assets/js/modernizr-custom.js`, served as `/bundles/moderniz` and
loaded by both `_Base.cshtml` and `_HubRoot.cshtml`.

**Modernizr is now built from a declared list.** The 90KB
`src/sites/nursingworld/js/modernizr-custom.js` was briefly recorded as a source
file whose minification step the migration had lost. That was wrong: it was
already minified, and it was Modernizr **3.3.0 with 245 detects**, while the
deployed file is **3.13.1 with 22**. They were unrelated — the source was a
leftover of the 2022 TFVC import, referenced by nothing in the build graph.

The deployed file was downloaded by hand from modernizr.com and pasted into
`wwwroot`, which the history shows the cost of: its feature set drifted
16 → 26 → 20 → 27 detects over two years, commit `326600490` dropped seven of
them with no stated reason, and the banner alternated between 3.12.0 and 3.13.1
depending on who committed last (the generated code was byte-identical, so that
churn was pure diff noise).

It is now generated by `scripts/modernizr.mjs` from
`src/sites/nursingworld/js/modernizr.config.mjs`, which declares the same 22
detects and records that only **three** are read by anything in this repo:
`flexbox` (`_base-layout.scss:70`), `objectfit` (`object-fit-polyfill.js:35`)
and `requestanimationframe` (`view-more-view.js:156`). The other 19 are retained
deliberately — each also writes a class onto `<html>`, and CMS-authored content
is outside this repo's view, so trimming them is a product decision rather than
a build cleanup.

Verified equivalent to the file it replaces: booted in jsdom under real-browser
conditions, both produce the same 25 detect keys, the same values and the same
33 `<html>` classes. (They diverge on `csstransforms` only when `CSS.supports`
is absent, a path no supported browser takes and that nothing in this repo
reads.) Output is 13,239 bytes against the old 14,126 — the per-detect metadata
comments Modernizr emits are stripped, which is 8.2KB on a render-blocking
script every page loads. The stale 3.3.0 file was deleted.

`flexbox` is the detect that matters: `screen.css` gives `.grid--flex` its
`display: flex` only under `.flexbox`, with no `.no-flexbox` fallback, so losing
that detect turns every flex grid on the site into a block layout with nothing
logged. `test/modernizr.test.js` asserts in both directions that the declared
list covers everything the CSS and JS read.

One knock-on: the CDC preview layout hardcodes several absolute production URLs,
including `https://www.nursingworld.org/.../assets/js/es5-shim.min.js` and
(after item 21) `.../assets/js/jquery-ui.min.js`. Both point at production and
will 404 once this deploys. They only affect the standalone preview, not the
site; worth tidying whenever that layout is next touched.

### 12. Lint warnings — RESOLVED 2026-09-11 (9 → 3)

The CDC port brought four new warnings, all fixed: an unused caught error in
`module-controller.js` (renamed `_err`), `!= null` on an element lookup in
`filter-resources.js` (now a plain truthiness check), and two `no-invalid-this`
in jQuery callbacks where `this` is the clicked element (inline disables, the
same pattern `map-component.js` already uses).

Two of the five `max-len` warnings are gone: the boolean chains at
`page-view.js:116` and `:119` are now split one condition per line. **The built
output is byte-identical before and after**, which is how the reformat was
verified rather than assumed.

**Three `max-len` warnings remain, deliberately.** They are HTML-building
template literals of 317-433 characters in
`account-continuing-education-awards-view.js`,
`account-enrollments-view.js` and `checkout-address-view.js`. A first attempt to
split them into concatenated literals broke the build, and a careless split
would silently change the generated markup. Given that an ESLint cleanup pass
already broke this codebase badly once (item 28), reformatting working
HTML-generation code to satisfy a 300-character style limit is not worth the
risk. Leave them, or raise the limit — but do not mechanically rewrite them.

### 13. In-code TODOs — RESOLVED 2026-09-11 (documented; none actionable)

Both `vite.config.js` TODOs were cleared by item 2. What remains is recorded
rather than fixed, because none can be acted on now:

- `modules/utils.js:142` — replace the `window.appInsights` check with a real
  App Insights SDK import. Blocked on the SDK being added in CMS 13.
- `views/cta-block-view.js:96` — `HACK: No way to call this again as its an
  IIFE`. It re-fetches `EPiServerFormsSamples.js` to re-run an EPiServer IIFE
  after loading a form. A workaround for third-party code we do not control.
- `scss/components/hero/_hero-large.scss:7,10` and `scss/global/_vars.scss:50,56`
  — four TODOs inherited with the CDC theme in item 10. They mark placeholder
  values needing design input, not defects.

### 14. README inaccuracies — RESOLVED 2026-09-11

Corrected, and the audit found more than the original entry listed:

- `editor-fix.css` → `editor-fix.scss` in the project structure (the `.css` in
  the *output* tree was right and stayed)
- The jQuery section described jQuery as a Rollup `external` loaded from
  `scripts/lib/jquery.js`. All of that is now wrong — rewritten to describe
  3.7.1 from npm, served via `/bundles/jquery`, with modules resolving through
  the `vendor/jquery-global.cjs` alias, plus why it is CJS and why `external`
  was removed (items 2, 20, 23, 27).
- "Four SCSS entry points" → six (`screen`, `print`, `editor`, `editor-fix`,
  `csnalanding`, `cdc`), with a pointer to item 4 for the `@import` debt
- Output tree gained `csnalanding.css` and `cdc.css`
- Project structure gained `scripts/vendor/`, `src/templates/campaign/` and
  `csnalanding.scss`, and lost the claim that `styles/lib/` holds `cdc.css`
- Added a **CDC component preview** section for `preview:cdc` /
  `build:preview:cdc`

---

### 15. Dangling image reference — RESOLVED 2026-09-11

`_c-media-block.scss` referenced `/assets/img/overlay-black-50.png`, which was
never committed. The rule was deleted rather than the image re-sourced, because
it was unreachable anyway: it sat inside `.no-cssgradients &`, a Modernizr
fallback that only applies to browsers without CSS gradient support (IE9 and
older). Those cannot run this site at all — `entry.js` is an ES module using
`Object.hasOwn`. The `linear-gradient` it was falling back from is three lines
above and is the real implementation.

All **50 of 50** `url(/assets/...)` references in the built CSS now resolve.

### 16. `fonts/icons.*` has no build step — DOCUMENTED 2026-09-11

Not fixed, deliberately, but the blocker that made it unfixable is gone.

The state: 59 source SVGs in `_client/images/icons/`, a hardcoded codepoint map
in `settings/_icons.scss` (`$s-icons`, `\f101`–`\f13b`), **97 CSS rules** using
`font-family: icons`, and no build step since the Grunt `webfont` task was
dropped. The three font files survive only because they are committed and
`emptyOutDir` is `false`.

Rebuilding was risky because the codepoints are hardcoded: a regenerated font
that assigns them differently makes 97 rules render the wrong glyph, silently
and with no build error. A naive alphabetical rebuild misplaces **10** of them.

**The original ordering has been recovered and verified.** Codepoints are
assigned sequentially from `\f101` in order of the *full filename including the
`.svg` extension* — which matters wherever a base name has suffixed variants,
since `-` (0x2d) sorts before `.` (0x2e):

    icon-file-doc.svg  \f11b     icon-file.svg  \f11e   (after its variants)

Regenerating the map that way reproduces `$s-icons` exactly, 59/59, zero drift.
The recipe is written up in `_client/images/icons/README.md` next to the source
it applies to, so whoever restores a build step has a verifiable target rather
than a guess.

Two concrete fixes landed:

- `icon-external link.svg` renamed to `icon-external-link.svg`. The space would
  never have matched the `'icon-external-link'` key in `$s-icons`, and that icon
  is live (`elements/_e-state-org-item.scss:85`). Verified the rename does not
  shift its codepoint (`\f119` either way). Source names and map keys now
  correspond exactly, 59/59.
- The `emptyOutDir: false` constraint is documented in `vite.config.js` at the
  setting itself, rather than only in this file.

---

### 17. Duplicate `csnalanding.scss` — RESOLVED 2026-09-11

Removed the standalone copy; the partial imported by `_core.scss` is now the
single source.

The history settled which was which. `styles/csnalanding/csnalanding.scss` came
first (2026-06-19, Pinkesh Jain, *"Bundle and Minify csnalandingpage.css"*) — an
explicit decision to fold the CSNA styles into `screen.css`. The standalone
`styles/csnalanding.scss` arrived three weeks later in `ff1895ee0 "IP Updates"`
as a 276-line byte-identical copy, and that commit touched no build config,
which points to duplication rather than intent. Confirmed with the author.

Deleted: `styles/csnalanding.scss`, the `css/csnalanding` entry in
`vite.config.js`, the built `wwwroot/assets/css/csnalanding.css` (and its
`.map`), and two `ANA.Site.csproj` lines. The reason the partial is the single
source is now noted at the `@import` in `_core.scss`, where anyone tempted to
add a second copy would see it.

Nothing visible changes: no view ever linked `csnalanding.css`. Verified after
the rebuild that all **16** `csna-*` classes used by `CSNALandingPage.cshtml`
are present in `screen.css`.

Note for later: this leaves the CSNA rules shipping on every page via
`screen.css` for the sake of one page. That was the standing decision from June
and is unchanged here; splitting it back out is a separate call, and would need
a CSNA page load to verify — which requires Auth0 credentials.

---

### 18. jQuery plugin versions — RESOLVED 2026-09-11

The original table was out of date on every row. Two were already upgraded under
item 9 (`owl.carousel` 2.3.4, `velocity-animate` 1.5.2), and two more were
already resolving to newer versions than the manifest implied, because the caret
ranges allowed it:

| Plugin | was declared | actually installed |
|---|---|---|
| `chosen-js` | `^1.6.2` | **1.8.7** — jQuery 3 support landed in 1.8 |
| `magnific-popup` | `^1.1.0` | **1.2.0** |
| `waypoints` | `^4.0.1` | 4.0.1 |

The declared floors are raised to `^1.8.7` and `^1.2.0` so the manifest states
what is actually installed and tested. No package changed as a result — the
lockfile already pinned these.

**No shipped plugin code uses a jQuery-3-removed API.** A scan for `.andSelf()`,
`.size()`, `$.browser`, `.live()`, `.die()`, `.unload()` and `.load()` across all
five packages produced only false positives: waypoints' hits are in `test/lib/`
fixtures (jasmine-jquery, require.js), magnific-popup's are in a
`website/third-party-libs/zepto.js` copy used by its docs site, and
owl.carousel's `.load(` is its own Lazy-plugin method rather than jQuery's
removed event shorthand. `$.isArray` appears in waypoints and velocity —
deprecated in jQuery 3, removed only in 4.0, so it still works.

**Two of the five may be unreachable.** `chosen-js` is imported only by
`contact-search-view`, and `waypoints` only by `sticky-nav-view`,
`timeline-view` and `page-section-nav-view`. None of those four is mounted by any
`data-require` in the repo, nor imported by a module that is — see item 30. If
they are genuinely dead then both plugins are dead weight, but that cannot be
concluded from the repo alone, because Optimizely content can carry
`data-require` in CMS-authored markup.

**Browser pass, for what remains:** `owl.carousel` is already confirmed working
(the `/ancc` heroes). `velocity-animate` reaches 19 source files through
`modules/animate` and `magnific-popup` 47, so account, cart and checkout pages
exercise them heavily — those are the ones worth a look. `chosen-js` and
`waypoints` cannot be exercised until item 30 settles whether their views are
reachable.

### 19. `jqueryval` bundle — RESOLVED 2026-09-11

Removed. `BundleInitialization.cs` registered `/bundles/jqueryval` from
`Scripts/jquery.validate.min.js` (1.13.1) and its unobtrusive adapter, and no
view ever rendered it. Both files are deleted along with the registration.

Two related dead things went with it:

- **`jquery-validation` 1.19.4 and `jquery-validation-unobtrusive` 3.2.6** were
  in `devDependencies` but imported by nothing in current source — their only
  consumer was the pre-Vite Browserify bundle. Removed.
- **`_client/scripts/lib/entry.js`**, that 6MB Browserify bundle, is deleted.
  It has been orphaned since item 1 dropped its static-copy target, and it was
  the sole reference to the npm validators. The served `/assets/js/entry.js` is
  built from `main.js` and is unaffected.

**Client-side validation is absent, and this did not change that.** Six views
emit validation markup (`ValidationMessageFor` / `ValidationSummary`):
`Login/Login`, `Login/RegisterAccount`, `Login/ExternalLoginConfirmation`,
`BackendLogin/Index`, `Shared/EditorTemplates/AddressRegion` and
`ExistingPagesReport/index`. Those attributes need a validator on the page to do
anything, and none was ever loaded — the bundle that would have supplied it was
never rendered. Server-side model validation still runs, so the forms are
correct, just without instant client feedback.

Restoring it is a product decision rather than cleanup: install a current
`jquery-validation`, add an entry, and render it on those pages. Worth pairing
with item 31, since both concern scripts loaded outside the bundle system.

### 20. jQuery versions across the layouts — RESOLVED 2026-09-11

The original entry claimed four versions with the CDC layouts implicated. That
was wrong on the security point; the audit corrected it:

| Layout | Before | After |
|---|---|---|
| `_Base.cshtml` | 3.7.1 via `/bundles/jquery` | unchanged |
| `_HubRoot.cshtml` | 3.7.1 **loaded twice** | 3.7.1 once |
| `_OJINBase.cshtml`, `_OJINBase1.cshtml` | **3.2.1 from cdnjs** | 3.7.1 via `/bundles/jquery` |
| `_CDC.cshtml`, `_CDCHack.cshtml` | 3.6.0 from code.jquery.com | unchanged, deliberately |

**OJIN was the real exposure.** Both layouts pulled jQuery 3.2.1 from cdnjs —
affected by CVE-2020-11022 / CVE-2020-11023 (fixed in 3.5.0) — and, unlike the
CDC tags, with **no SRI `integrity` attribute**. They now use
`/bundles/jquery`, which `BundleInitialization.cs` registers unconditionally and
serves from `/assets/js/jquery.min.js` (3.7.1). jQuery still loads before
`bootstrap.bundle.min.js`, and Bootstrap 4.6 accepts jQuery `1.9.1 - 3`.

Nothing on those pages uses jQuery directly: the OJIN views contain no `$(`,
the layouts have no inline jQuery, and `ojin.umd.min.js` does not reference it.
Bootstrap is the only consumer, which keeps the 3.2.1 → 3.7.1 risk low.

**CDC was left alone on purpose.** It loads 3.6.0 from `code.jquery.com` *with*
an SRI hash, and `cdc.js` bundles its own jQuery 3.5.1 (from
`frontend-cdc/build/package.json`). Both are at or above 3.5.0, so neither is
CVE-affected. Changing them would disturb the `cdc.js` / slick-carousel ordering
for no security benefit. Revisit under item 10 when `frontend-cdc` is folded in.

**`_HubRoot` loaded jQuery twice.** The `<head>` pulled the unminified 285KB
`/assets/js/jquery.js` (via a tag with a `tytpe` typo), then `/bundles/jquery`
loaded again near `</body>` — so jQuery executed twice and the second instance
replaced the first, discarding anything registered on the first. The head tag is
now `/bundles/jquery` and the later duplicate is gone: one execution, still
early enough for `hubsearch.js` and anything injected through
`RequiredClientResources("Header")`, and 285KB → 87KB.

The head position was kept rather than deleted outright because
`RequiredClientResources` can inject CMS-authored scripts that cannot be audited
from this repo. `hubsearch.js` itself only defines functions and defers to
`DOMContentLoaded`, so it would have been safe either way.

`/assets/js/jquery.js` (unminified) is now referenced by nothing. It is current
and harmless, so it is still built; drop the copy target in `vite.config.js` if
the committed 285KB is worth reclaiming.

### 21. jQuery UI — RESOLVED 2026-09-11, removed

Removed entirely. It shipped **37,248 bytes on every page** and nothing used it.

The original entry said this "could not be settled from this repo alone, since
the EPiServer package internals are not here." That turned out to be wrong —
the package is in the NuGet cache, and its client resources are inspectable:

- `EPiServer.Forms` 5.9.1 ships four JS files inside
  `contentFiles/.../EPiServer.Forms.zip`, and **`EPiServerForms.js` contains
  zero references to `datepicker`**. Forms does not use jQuery UI.
- `$$epiforms` is not a jQuery UI handle at all — the prerequisite script sets it
  with `jQuery.noConflict()`, so it is simply an alias for jQuery.
- The prerequisite is 2,754 bytes and bundles no jQuery of its own.
- None of the 12 element blocks in `Views/Shared/ElementBlocks/` renders a
  datepicker, and no `.cshtml` anywhere references one.
- No jQuery UI API (`.datepicker()`, `$.ui.*`, `.sortable()`, `.dialog()`,
  `.tabs()`, `.autocomplete()` and the rest) appears anywhere in our source.

Removed in six places: the `jqueryui` bundle registration, the `<script>` tags in
`_Base.cshtml` and `_HubRoot.cshtml`, the `js/jquery-ui.min` Vite entry, the
`vendor/jquery-ui-datepicker.js` build entry, the `jquery-ui` npm dependency, the
built `wwwroot/assets/js/jquery-ui.min.js` (and its orphaned sourcemap), and two
stale `<None Include>` lines in `ANA.Site.csproj`.

jQuery itself is untouched — 3.7.1 via `/bundles/jquery`, still loaded by all six
layouts.

**Left in place:** `episerver-forms-view.js` still reads
`.data('datepicker').settings.dateFormat`. That code would now fail if it ran,
but it does not run — the view is not mounted by any `data-require` (item 30).
Resolve it with item 30 rather than separately: if the view turns out to be
genuinely dead it goes away entirely, and if it is mounted from CMS content then
its datepicker assumption needs revisiting regardless.

**Residual risk:** CMS-authored content calling `.datepicker()` — the same blind
spot as item 30. It would surface as a console `TypeError`, not a silent
failure. Reverting is a single-commit revert.

### 22. Front-end JS was dead since the Vite migration — RESOLVED 2026-09-11

Found from a browser console error, not from the build, which was green
throughout: `Uncaught SyntaxError: Cannot use import statement outside a
module (entry.js)`.

Two separate regressions, both introduced by `bfccb8a9c` (2026-06-25) and
both invisible to `npm run build` and `npm run lint`:

**1. `entry.js` is ESM but was loaded as a classic script.** Before the
migration it was a Browserify IIFE; the migration changed the output format
to ESM and no one updated the script tags. `_Base.cshtml:211` and
`_HubRoot.cshtml:274` now carry `type="module"`. Until this, *no front-end
JavaScript ran at all* on any page using those layouts.

**2. `jit-require.js` depended on a `loadjs` global that no longer exists.**
The old Browserify bundle exposed the library via `global.loadjs`, which
Browserify maps to `window`. `jit-require.js` (unchanged since the original
TFVC import) referenced that bare global. Rollup treats it as an undeclared
free variable and does not bundle it.

Importing the npm `loadjs` would not have fixed it either: its success
callback is invoked as `(args.success || devnull)(args)` — it receives the
args object, not a module — so the existing `mod.default()` call would throw.
It is a script loader, not a module loader.

Replaced with a native dynamic `import()`, which returns a real module
namespace with `.default` — what the code always expected. This matters
because `data-require` is the site's primary JS mechanism: **126 occurrences
across 79 views**, mapping to 131 per-module build outputs.

Also raised `ecmaVersion` 2018 → 2022 in `eslint.config.js` (dynamic
`import()` is ES2020; the old setting produced a parse error), and deleted 7
orphaned hashed chunks left behind by `emptyOutDir: false`, including the
stale `jit-require-ysoJtdzb.js` that still carried the `loadjs` reference.

**Lesson for the rest of this backlog:** a green build proves files are
emitted, not that the page works. Items verified only by rebuilding should
get a browser pass before this branch merges.

---

### 23. Bare `jquery` specifier unresolvable in the browser — RESOLVED 2026-09-11

Surfaced immediately after item 22, once JS actually executed:
`Uncaught TypeError: Failed to resolve module specifier "jquery"`.

`rollupOptions` listed `external: ['jquery']` with `globals: { jquery: '$' }`.
That pairing only applies to `umd`/`iife` output — for the `esm` output this
build emits, Rollup leaves the bare specifier in place, and browsers cannot
resolve bare specifiers without an import map. 84 emitted files carried it.

The constraint is that jQuery must remain **one shared instance**: Razor
inline scripts, EPiServer and the jQuery plugins all reach for
`window.jQuery`, and plugins register themselves on that global. An import
map pointing at an ESM jQuery build would have given modules a *different*
instance, missing every plugin — a subtler bug than the one being fixed.

So `jquery` is now aliased to `_client/scripts/vendor/jquery-global.js`, which
re-exports `window.jQuery` (and throws a clear error if the global is absent,
i.e. if `/bundles/jquery` ever stops loading first). Verified across all 158
emitted files: no bare specifiers remain.

**Also added `pruneOrphanedChunks()` to `vite.config.js`.** Because
`emptyOutDir` is `false` (required — see item 16), `js/chunks/` accumulated
every hashed chunk ever emitted. This produced two false readings while
diagnosing item 22 and this item, since greping the output directory returned
stale chunks that are no longer served. Everything in `js/chunks/` is
generated, so the plugin deletes anything the current build did not emit. 17
orphans were removed across the two fixes.

---

### 24. `data-require` modules had no default export — RESOLVED 2026-09-11

Reported as "enable two or more heroes in the CMS and you get no slides, and by
proxy no owl carousel". owl.carousel was not the cause: the whole
`data-require` runtime was dead, and the hero carousel was simply where it got
noticed.

**Root cause.** Vite defaults `preserveEntrySignatures` to `false` for app
builds (`vite/dist/node/chunks/node.js:32460` —
`ssr ? "allow-extension" : libOptions ? "strict" : false`). `false` tells Rollup
each entry is executed for side effects only, so its exports are dropped and the
module body, now unreachable, is tree-shaken away.

Every view ends with `export default () => new SomeView()`, and
`modules/jit-require.js` calls `mod.default()`. The built
`hero-carousel-view.js` was 149 bytes of bare imports with no export and no
class. Measured across the build: **130 of 131 modules had no `export` at
all.** All 56 live `data-require` targets were failing.

Fixed by setting `preserveEntrySignatures: 'strict'` in `rollupOptions`.
`hero-carousel-view.js` went 149 → 1,943 bytes with the class restored; 131/131
modules now export, 130 with a default (the exception, `components/gtm-config.js`,
is a named-export config module and not a `data-require` target).

**Second, independent bug fixed alongside it.** `carousel-view.js` and
`gallery-view.js` initialised owl inside `$(window).on('load', ...)`. That event
fires once and is not replayed. It used to be safe because the Browserify bundle
was a classic script executing during parse; it no longer is, because `entry.js`
is a deferred module *and* `jit-require` uses dynamic `import()`, which the
`load` event does not wait for. Both now use
`modules/on-window-load.js`, which invokes the callback immediately (async) when
`document.readyState === 'complete'`. These were the only two such handlers.

`hero-carousel-view.js` was never affected by this second bug — it calls
`owlCarousel()` directly in `initChildren()`.

**owl.carousel is cleared.** It is bundled, registers `$.fn.owlCarousel` on the
global, its CSS is compiled into `screen.css`, and it uses no jQuery-3-removed
APIs (its two `.load(` hits are its own Lazy-plugin method, not the removed
jQuery event shorthand). Items 18 and 21 remain open and unrelated.

Also widened the ESLint browser-globals glob to cover `_client/scripts/vendor/`,
which was never linted — `jquery-global.js` had an undetected `no-undef` on
`window` from item 23.

**This is the third bug in a row that a green build could not detect** (items
22, 23, 24). Every remaining item in this backlog that is verified only by
rebuilding should get a browser pass before merge.

---

### 25. `data-require` on OJIN pages — RESOLVED 2026-09-11

Removed the five attributes. They were all in one file,
`Views/Ojin/OjinSearchPage/Index.cshtml`, and none had ever run: neither
`_OJINBase.cshtml` nor `_OJINBase1.cshtml` loads `/assets/js/entry.js`, so the
`jit-require` runtime that reads the attribute never executes on OJIN.

Enabling them was considered and rejected on evidence. **OJIN pages do not load
`screen.css`** — only Bootstrap 4.6 and `ojin.css` — and the five attributes
split unevenly against that:

| attribute | styles available on OJIN? |
|---|---|
| `search-filters-view` | yes — `c-search-results` has 40 rules in `ojin.css` |
| `search-box-view` | yes — `e-search-box` has 6 |
| `container-block-view` ×2 | **no** — `owl-carousel` appears 0 times |
| `dropdown-component` | **no** — `dropdown-hover` appears 0 times |

So adding `entry.js` would have produced two visually broken carousels and an
unstyled dropdown, in exchange for progressive enhancement on a page that
already works: the search form is a plain `method="post"`, handled server-side.

Left in place deliberately: the orphaned config attributes those modules read —
`data-carousel-mobile` / `-desktop` / `-slide-items-*` on the two container
blocks, and `data-search-input` on the search input. They are inert now, and
tidying them was outside what was agreed. `data-search-input` is also a generic
enough hook that it may be read elsewhere.

Verified: exactly 5 attributes removed from one file, site-wide `data-require`
count 124 → 119, and 56 of the 57 remaining unique targets resolve to a built
file. The one that does not is `account-member-upload-view`, which sits inside a
Razor comment and has no source file — known since item 24.

### 26. `vector-arrow.svg` — RESOLVED 2026-09-11

The asset 404'd on the live site too, so the four `<img>` tags were replaced
with the existing `.chevron` CSS class rather than sourcing a new file.

`.chevron` needed extracting first. The carousel drew a chevron from a rotated
border box, but that rule is scoped to `.resource-carousel .slide-arrow` and did
nothing elsewhere, so a bare class swap would have rendered an empty span. The
same geometry now lives in `scss/components/_chevron.scss`, unscoped, with
`up`/`down`/`left`/`right` modifiers. The carousel's own rules are more specific
and still win, so its arrows are unchanged.

The four spans keep their original classes (`category-icon`,
`sub-category-icon`, `toggle-icon`, `search-title-mobile__icon`), which supply
padding and — importantly — are what `filter-resources.js` toggles `flip-icon`
on. `.flip-icon { transform: rotate(180deg) }` rotates the element, and
`.chevron` is `display: inline-block`, so the flip still works: the arrow points
down when collapsed and up when expanded, as the missing asset was meant to.

Also dropped the stale `<None Include="wwwroot\assets\img\vector-arrow.svg" />`
from `ANA.Site.csproj` — it pointed at a file that was never committed.

All 7 images referenced by CDC views now resolve.

---

### 27. `new` on factory exports, and jQuery CJS interop — RESOLVED 2026-09-11

Two runtime bugs found once `drop_console` stopped swallowing errors. Both were
latent in the source and only became reachable when item 24 made
`data-require` modules actually initialise.

**`X_default is not a constructor` — 79 call sites.** Every module here ends
with `export default () => new Foo();` — a *factory*, not the class, and
`jit-require` correctly calls `mod.default()` without `new`. But 79 call sites
across 61 files did `new GTMHelper()`, `new NavTrayComponent()`,
`new ResponsiveTableComponent()` and so on against those same factory exports.

It worked for years by accident: Babel in the Browserify build transpiled the
arrow factories to `function () {...}`, and `new fn()` where `fn` returns an
object evaluates to that object. Vite emits native arrows, which cannot be
constructed at all. Rewritten to plain calls — provably equivalent wherever it
previously worked.

`new-cap` was then reconfigured to `{ capIsNew: false }`: a capitalized factory
called without `new` is this codebase's convention, not a mistake.

**`$ is not a function` — the jQuery shim broke CJS consumers.** The
`jquery-global` shim from item 23 was an ES module exporting `default`. That
satisfies `import $ from 'jquery'`, but magnific-popup does
`factory(require('jquery'))`, and rolldown handed the CJS require the *module
namespace object* rather than the function. **42 views import
magnific-popup**, so this took out a large share of the site.

Rewritten as `vendor/jquery-global.cjs` with `module.exports = window.jQuery`,
which satisfies both: ESM interop takes `module.exports` as the default, and
`require()` gets the function directly. `.cjs` is required because
`package.json` sets `"type": "module"`.

owl.carousel was never affected — it reads `window.jQuery` itself rather than
importing jquery, which is why the heroes kept working while other components
did not.

**These were invisible for the same reason each time:** `npm run build` defaults
to production, and `drop_console: true` minified the `jit-require` catch handler
to `.catch(() => null)`. A module failing to load produced no output at all. See
the drop_console change — warnings and errors now survive a production build.

---

### 28. ESLint pass 61a129cd3 broke `this` bindings — RESOLVED 2026-09-11

Reported as `this.loadingSpinner.request is not a function` on the find-a-magnet
map page. The cause was not the map: the ESLint cleanup commit on this branch
(`61a129cd3 "cleanup: ESLint lint pass"`) replaced `this` with `self` and
removed `const self = this` captures, and `self` is a real browser global
(`window.self`), so nothing ever flagged it.

**`loading-spinner.js` returned `window`.** The singleton ended with
`LoadingSpinnerInstance = self;` (was `this` in the original TFVC import).
A constructor that returns an object yields that object, so
`new LoadingSpinner()` evaluated to `window` and every caller got
`window.request is not a function`. **54 call sites construct this class**, so
the loading spinner was broken site-wide wherever a component actually
initialised.

**Lost `const self = this` captures — 8 sites in 7 files.** Inside a
magnificPopup `open () {}` callback `this` is the popup, not the component, so
these methods captured the instance first. ESLint removed the capture as
"unused" because it could not trace usage inside an object-literal method,
leaving bare `self` → `window`. Restored in `add-update-address`,
`add-update-presentation`, `add-update-professional-service`,
`add-update-publication`, `order-history-item-view` (×2), `add-to-cart-view` and
`cart-page-view`.

**12 bare `self` references passed `window` as an event payload.** These sat
inside `success: (data) => {}` arrows where `this` is already the component, so
they became `this` — `globalEmitter.emit('...:dataupdated', self)` was emitting
`window` to every subscriber.

**Prevention:** `self` was removed from the ESLint `globals` block. Declaring it
was what let `no-undef` ignore all of the above. With it gone the linter found
12 sites my own grep-based audit had missed, because my audit was per-file
(does this file declare `self` anywhere?) rather than per-scope. Any recurrence
now fails lint.

The same commit also mangled two ternaries in `loading-spinner.js` into
if-branches containing both the then- and else-statements; those were already
corrected by a later commit on the branch.

---

### 29. CDC preview quirks mode + malformed attributes — RESOLVED 2026-09-11

Filed as "leave alone", then corrected: the reasoning was backwards.

`layout-default.hbs` declared `<!doctype html5>`, which is not a recognised
doctype, so the preview rendered in **quirks mode**. The original note said
fixing it would change how all 15 pages lay out and so should be a deliberate
decision. But live CDC pages render in *standards* mode — `_CDC.cshtml` nests
inside `_Base.cshtml`, which declares `<!DOCTYPE html>`. The preview was
therefore showing components under different layout rules than production, which
makes it misleading as a design reference. Corrected to `<!doctype html>`; the
change makes the preview match the real site rather than diverge from it.

Eight malformed attributes in `partials/about.hbs` also surfaced once Vite began
parsing the HTML: seven `data-gtm-event-label-title"=""` (a stray quote inside
the attribute name) and one `data-gtm-event-label-title}}"=""` (a leftover
Handlebars fragment). Both forms exist verbatim in the panini source, so they
predate the port; gulp never parsed the HTML and so never noticed. Corrected to
`data-gtm-event-label-title=""`, matching the well-formed instances elsewhere in
the same file.

The preview build now emits no parse warnings. The one remaining message —
`favicon favicon.html not found` — is accurate: `assets/favicon/` has only a
README, so the gulp favicon task had no source either and the helper has always
returned an empty string. It now warns once per run rather than once per page.

---

### 30. Views mounted by nothing in the repo — PARTIALLY RESOLVED 2026-09-12

**The original count was wrong, in both directions.** Two corrections:

1. *Reachability was only checked one level deep.* Redoing it as a proper
   transitive closure from the mount roots (every `data-require` value plus
   `main.js`'s own import graph) puts 127 of 157 modules reachable.

2. *The `data-require` scan missed two syntactic forms.* The regex assumed
   `data-require="./src/..."` with plain quotes, so it skipped
   `PersonBlock.cshtml:54`, which emits the attribute through
   `Html.Raw(" data-require=\"./src/views/person-view\"")` inside a `hasBio`
   conditional, and `NewsListingPage/Index.cshtml:22`, written
   `data-require = "./src/views/form-view"` with spaces around the `=`.
   **`person-view` is mounted and was never a candidate.** It is the one this
   nearly got wrong: `PersonBlockAbout.cshtml` renders all three of its hooks
   with no mount attribute, which looks exactly like a dropped-attribute bug —
   but that block shows the description inline (`c-person__description--show`)
   and has no modal to open, so it correctly needs no JS.

Corrected figures: **57 mounted directly, 127 reachable transitively, 25 view
modules unreachable.** Of those 25, three groups.

**Group A — dead, removed in this commit (2).** Neither is in
`module-entries.json`, so neither has ever been built; nothing, CMS markup
included, could load them.

- `account-certifications-view` — 161 real lines, and the only one of the 25
  `account-*` views missing from the entry map. It could not build even if
  listed: it imports `views/account-certifications-item-view`, **which does not
  exist on disk**. Its endpoint is absent too — no `getcertifications` action
  exists on `PersonalDevelopmentController`, whose 15 actions are all
  `...ProfessionalService/Publications/Creds/Education/Preceptorship/Presentation`.
  Abandoned in the TFS changeset-1810 import (`b5e4984fb`). Its sole collaborator
  `components/add-update-certification-component` had no other importer and went
  with it.

**Group B — kept, not dead (1).**

- `template-view` — a deliberate 23-line empty scaffold (`initChildren`/
  `addListeners` stubs) for authoring new views. Unreachable by design. Keep.

**Group C — still open, needs the CMS (23).** All built and in the entry map, so
CMS-authored markup *can* mount them:

`breadcrumb-view`, `carousel-view`, `cart-login-status-view`, `clear-form-view`,
`contact-search-view`, `cookie-message-view`, `cta-block-view`,
`cta-download-view`, `episerver-forms-view`, `gallery-view`,
`order-history-item-view`, `page-section-nav-view`, `primary-hero-view`,
`product-detail-carousel-view`, `product-request-more-information-view`,
`quick-info-view`, `resource-library-view`, `statement-product-view`,
`sticky-nav-view`, `tabs-view`, `test-view`, `timeline-view`, `view-more-view`.

Three of them — `carousel-view` (5 files), `person-view` and
`product-detail-carousel-view` — carry `data-require` in the designer prototypes
under `frontend/views/`, which is where the Razor blocks were derived from. That
is circumstantial support for CMS mounting, not proof.

**To settle Group C**, run the three queries in
`item30-cms-data-require.sql` against the CMS database (read-only). Query C is
the fast screen: if `tblContentProperty` holds **no** rows containing
`data-require` at all, every one of the 23 is dead and can go. Otherwise Query A
gives a per-view occurrence count and Query B shows which content items mount
them. Note that Commerce catalog content lives in a separate database — if the
product views (`statement-product-view`,
`product-request-more-information-view`, `product-detail-carousel-view`) come
back zero, check the catalog meta fields before deleting those three.

Two other items depend on this answer: **item 18** (`chosen-js` and `waypoints`
are reachable only through four of these views) and **item 21**
(`episerver-forms-view` calls `.data('datepicker')`, now a no-op since jQuery UI
was removed — harmless if the view never mounts).

Verification of the removal: rebuilt and hashed all 174 built JS/CSS files before
and after. **All 174 JS files byte-identical.** `screen.css` and `editor.css`
differ only in four per-build font cache-bust tokens (`?ufp82qc` → `?u85nh87`)
and are identical once those are normalised — pre-existing build
non-determinism, unrelated to this change; both were restored to HEAD.
`npm run lint` clean (0 errors, 3 known `max-len` warnings).

---

### 31. Six views loading jQuery 1.11.1 — RESOLVED 2026-09-11

Six views emitted `<script src="~/Scripts/jquery-1.11.1.js">` inline, a version
affected by CVE-2020-11022 / CVE-2020-11023 — the pair items 2 and 20 were meant
to close. Those items audited layouts and bundle registrations; none of these is
either, which is how they survived. Item 20's statement that no CVE-affected
jQuery remained "in any layout" was accurate as written and still missed this.

**It really was being served.** `Scripts/` sits outside `wwwroot`, so the
obvious guess is that these 404'd — but `Startup.cs:386` calls
`app.UseCustomStaticFileDirectories(env, ["Styles", "Scripts", ...])`, the csproj
publishes `Scripts\**\*.*`, and the directory is in the build output. The
vulnerable code loaded and ran.

And it ran *first*: none of these views declares a `Layout`, so they render into
the body while `_Base.cshtml` still loaded `/bundles/jquery` near `</body>`.
Their inline jQuery — 44, 17 and 8 `$()` call sites in the three sampled —
executed against 1.11.1, with 3.7.1 only replacing the global afterwards.

**Fixed the way item 20 fixed `_HubRoot.cshtml`:** `/bundles/jquery` now loads in
`_Base.cshtml`'s `<head>` (before `/bundles/moderniz`), the duplicate near
`</body>` is gone, and all six inline loads are deleted. `/bundles/jqueryui`
still follows jQuery.

Audited the inline code before moving it onto 3.7.1: **zero** uses of anything
removed in jQuery 3 (`.size()`, `.andSelf()`, `$.browser`, `.live()`, `.die()`,
`.load()`/`.unload()`/`.error()` event shorthands, `jqXHR.success/error`). The
only version-sensitive call is `.ready()` — 6 uses, which jQuery 3 still
supports and replays if the DOM is already ready.

Also deleted five unreferenced and publicly-served jQuery copies from
`Scripts/`: `jquery-1.11.1.js`, `jquery-1.6.4{,.min,-vsdoc}.js` and
`jquery-1.10.2.intellisense.js`. `Scripts/js/` stays — `adddate.js` is live.
`bootstrap.js` and the two signalR files are unreferenced but not
security-flagged, so they were left.

**Every layout on the site now loads exactly one jQuery, 3.7.1 via
`/bundles/jquery`,** and no CVE-affected version is reachable from any view.

**Needs a browser pass.** `_Base.cshtml` backs every page, and the six account /
OJIN blocks now run their inline jQuery against 3.7.1 for the first time.

---

## Open questions

### Q1. Two Vite projects — ANSWERED 2026-09-11: stay separate

`Sources/CohoRedesignHtml/` (`ana-static`) does **not** need migrating into
`frontend/`. Two Vite configs in the solution is the accepted end state, not
debt. This item is closed; no work planned.

Verified while confirming there was nothing to untangle: the two projects are
already fully decoupled. `Sources/ANA.Site/` contains zero references to
`CohoRedesignHtml` or `ana-static`, the project is not in `ANA.Web.sln`, and it
builds to its own base (`/ana-static/dist/`) rather than into `wwwroot`. The CDC
preview (item 10, phase 2) borrowed nothing from it in the end either — the
sprite is built inline rather than via `vite-svg-sprite-wrapper`, and templating
went to Vituum rather than `vite-plugin-handlebars`.

One consequence worth remembering rather than acting on: the two will hit the
Dart Sass 3.0 `@import` removal (item 4) independently, on different schedules —
`ana-static` pins sass exactly at `1.77.6` while `frontend` floats `^1.101.0`.
That is now expected, not an inconsistency to fix.

### 32. Non-deterministic font cache-bust tokens — RESOLVED 2026-09-12

`_resources-typography.scss` built its `@font-face` cache-buster from Sass's
`unique-id()`, which returns a fresh value on **every compile**. HEAD's tokens
(`ufp82sv`, `ufp82tq`, `ufp82uo`, `ufp82vm`) show the counter plainly.

Two consequences, one cosmetic and one not:

- **The build was not reproducible.** `screen.css` and `editor.css` came out
  different after every run regardless of whether their inputs changed, so
  `git status` could not answer "did my change affect the CSS?". This is what
  made verifying item 30's removal awkward, and it is why both files sat dirty
  in the working tree at the start of several sessions.
- **Every deploy re-busted every font.** Everything under `/assets` is served
  `Cache-Control: public, max-age=2592000` by
  `PreSendHeadersMiddleware.cs:30-35`, so the token is load-bearing — but a
  token that changes when nothing changed forced every returning visitor to
  re-download all four families on each release.

**Fixed** by replacing `unique-id()` with a `font-version($basename)` Sass
function registered through `css.preprocessorOptions.scss.functions` in
`vite.config.js`. It sha256-hashes the font's own bytes (all extensions sharing
the basename) and returns the first 8 hex characters, memoised per build. The
token now changes if and only if the font file changes — which is what the
original intent required.

`additionalData` would have been the more obvious hook and is unusable here:
several partials under `_client/styles/` begin with `@use`, which Sass requires
to precede any other statement, so prepending a declaration to every file breaks
the compile.

**Found a live bug while doing it.** The `$s-fonts` map asked for
`SourceSansPro-SemiBold`; the files on disk are `SourceSansPro-Semibold`. The
shipped CSS has been requesting a filename that does not exist since the fonts
were added. It goes unnoticed because IIS and macOS resolve paths
case-insensitively — but it would 404 on any case-sensitive filesystem, which is
a live risk if this ever runs on Linux containers or is fronted by a
case-sensitive CDN. Corrected, and `font-version()` now matches filenames
**case-sensitively** so a recurrence fails the build with a message naming the
correct spelling instead of shipping a latent 404.

Verified: two consecutive builds are byte-identical; each emitted token matches
an independently computed `sha256` of the font bytes; and the only differences
from HEAD in `screen.css` are the tokens themselves plus the `Semibold` casing —
the rest of the stylesheet compares equal. Build and lint clean (0 errors, 3
known `max-len` warnings).

**Adjacent, not done:** `@font-face` still offers only `eot`/`woff`/`ttf`, though
`woff2` is on disk for all four families. Adding it first in the `src` list would
cut font transfer roughly in half for every modern browser. Left alone here to
keep this change to the determinism fix.

---

### 33. Phase 3 — main site moved into the template structure — RESOLVED 2026-09-12

`_client/` is gone. The tree now matches the target shape, one self-contained
`js/` + `scss/` pair per template:

```
src/templates/
├── default/    nursingworld → js/entry.js, css/screen.css   (was _client/)
│   ├── js/     main.js, module-entries.json, lib/, vendor/, src/
│   ├── scss/   screen · print · editor · editor-fix + partials
│   ├── images/ fonts/ favicon.ico
└── campaign/   CDC → js/cdc.js, css/cdc.css
```

This mirrors the Razor layer, where each layout already loads exactly one pair
and the templates share nothing but `/bundles/jquery`. Source layout under
`default/js/` deliberately mirrors the output layout under `/assets/js/` —
`js/src/views/foo.js` builds to `js/src/views/foo.js` — because the
`data-require` contract pins those output paths.

510 files moved with `git mv`, so history follows them.

**The governing constraint held.** Entry keys derive from `module-entries.json`,
not from source location, so repointing the path constants was enough:
`SCRIPTS_MAIN`, `STYLES_DIR`, `IMAGES_DIR`, `FONTS_DIR` and the resolver aliases.
Verified the only way that means anything here — **all 486 files in
`wwwroot/assets` are byte-identical to the pre-move build.** Plus the stated
acceptance checks: 131 per-module outputs, 130 with a default export, and all 57
live `data-require` values resolving to a real built file. (A 58th value,
`account-member-upload-view`, sits inside a Razor comment in
`AccountMemberUploadBlock/Index.cshtml:230` and has no source module — it is
commented out, not broken.)

**One thing actually broke, and it was the depth-encoding kind.**
`scss/_core.scss` imported `"../../node_modules/normalize-scss/sass/normalize"`
— a relative path encoding how deep the tree sat, which a move invalidates by
definition. Rather than re-count the `../`, `node_modules` was added to
`css.preprocessorOptions.scss.loadPaths` and the import became the bare
`"normalize-scss/sass/normalize"`, which survives any future relocation. It was
the *only* escape: every other relative import stayed inside the moved tree and
travelled with it. `rename.stripBase` also had to go 2 → 4, since it counts
leading segments of the match's root-relative directory and the trees are now
four deep.

**`src/shared/` was NOT created, on evidence.** The plan assumed CDC and the
main site duplicate a reset and helpers. They do not: the two trees share
**zero** identical files and **zero** npm packages. Default resets with
`normalize-scss`, campaign with Foundation's own; campaign's JS is Foundation
end to end, default's is jQuery plugins. There is nothing to extract, so
`shared/` would have been an empty directory asserting a relationship that does
not exist. Revisit only if real duplication appears.

**Incidental fixes.** Two aliases, `services` and `templates`, pointed at
directories that have never existed in this repo and that nothing imported;
dropped rather than carried forward, along with the stale `.gitignore` entry for
the latter. `npm run optimise:images` pointed at `scripts/optimise-images.mjs`
while the file sat in `_client/scripts/` — broken before this move, since
`frontend/scripts/` did not exist. The script is build tooling rather than
template source, so it now lives at `frontend/scripts/`, where the npm script and
the existing `scripts/**/*.mjs` lint glob both already expected it. The README
also described it as compressing source images; it rewrites **built** output in
`wwwroot/assets/img/` in place and must run *after* a build.

Six `frontend\_client\` paths in `ANA.Site.csproj` were repointed. Build, CDC
preview build and lint all clean (0 errors, 3 known `max-len` warnings).

**Remaining for the structure:** `src/sites/` — HNHN is portable now (its gulp 5
build only minifies per file), OJIN is blocked on locating its source. See the
`sites/` discussion in item 10.

---

### 34. OJIN ported off Vue CLI into the Vite build — RESOLVED 2026-09-12

The OJIN frontend lived outside this repo and had not been built in years. The
source turned up at `~/Downloads/OJIN_frontend`, and it settled the question
that had blocked `src/sites/`.

**It was never a Vue problem.** The CMS build ran
`vue-cli-service build --target lib --formats umd-min ./src/entryPointForBackendBuild.js`,
and that entry imports **only SCSS and five plain-JS modules** — no `.vue`
components at all. The 28 Vue SFCs were the preview app
(`build:demo` → `distForDemos/`). That is why the shipped bundle contained zero
`Vue` references and why OJIN pages work with no Vue on them: Vue CLI was being
used as an SCSS+JS bundler. So the dead toolchain (Vue 2.6, Vue CLI 4.5,
webpack 4, babel) was dropped rather than revived, and nothing replaced it — the
existing Vite build absorbed the work as two entries.

**The source was provably the right one.** `distForCMS/ojin.umd.min.js` hashes
`c1fbd7ee…`, byte-identical to the artifact committed here, so there was no
question of porting a stale copy. The CSS had moved on — the source was *newer*
than the 2023 build and already contained the six `#tinymce` rules that appeared
only in the deployed file, so nothing had to be hand-carried.

Ported to `src/sites/ojin/` as `js/` + `scss/`, output pinned to
`Ojin/js/ojin.js` and `Ojin/css/ojin.css` so the files stay beside the committed
`img/` and the two unowned stylesheets Razor loads from that directory. Both
layouts now point at `ojin.js`; the `.umd.min.js` name retired with the wrapper
it described, and its stale `<None Include>` left `ANA.Site.csproj`.

**Verified by equivalence, not by a green build:**
- **CSS** — expanding comma groups, **382 of 384** deployed selectors are
  preserved. The two absent are `:-ms-input-placeholder` prefixes for IE10/11,
  which our browserslist (`last 2 versions`, `>0.2%`) drops and replaces with
  `::-webkit-input-placeholder` and `:placeholder-shown`.
- **JS** — all five DOM hooks (`.ojin-nav__bar`, `.ojin-tabs`,
  `.ojin-articleHeadline`, `.c-search-results__categories`, `script`) identical.
  24,320 → 5,366 bytes; everything dropped was webpack UMD runtime
  (`document.currentScript`, `document.domain`), not application code.
- Nothing else in `wwwroot/assets` changed — adding entries did not perturb
  Rollup's chunking of the other 484 files.

**A live 404 fixed on the way.** `ojin.css` carried
`url(img/chevron-down.69e7caea.svg)` — relative, because Vue CLI emitted the CSS
and `img/` as siblings. Deployment put the CSS in a `css/` subfolder without a
sibling `img/`, so it has been resolving to `/assets/Ojin/css/img/…` and 404ing.
The chevron on `.ojin-figTable__table-th` (article figure tables) has been
missing in production. The port uses an absolute `/assets/Ojin/img/…`, matching
how the default template references images.

**A build-config dependency that is invisible in the files.** `vue.config.js`
injected `breakpointsVars`, `colors` and `varsMixins` into every stylesheet via
`additionalData`, and 14 of the 20 component files use those variables without
importing them. Vite's `additionalData` was the wrong tool — this config is
shared with default and campaign, so it would leak into both. Since OJIN's SCSS
is all `@import` (never `@use`) and Sass `@import` is global-scope, importing the
three once at the top of `scss/ojin.scss` covers everything after it. The same
`@use`-ordering constraint from item 32, cutting the other way.

**ESLint: stylistic rules are off for this tree, deliberately.** The code is
jQuery idiom — 39 function expressions, many `.each()`/`.on()` callbacks reading
`this` (`Jquery(this).addClass(…)`, `this.innerHTML`). `prefer-arrow-callback`
would rewrite those to arrows and break every one silently: precisely what
`61a129cd3` shipped and item 28 had to undo. `no-invalid-this`, `no-var`,
`no-use-before-define` and `wrap-iife` are off for the same
change-working-code-for-cosmetics reason; `js.configs.recommended` still applies
in full. The safe whitespace rules were auto-fixed, and the only non-whitespace
change `--fix` made — two concatenations becoming template literals — was
checked against the built output to confirm it emits the same strings.
`sessionStorage` was missing from the shared browser globals and was added.

**Preview rebuilt on Vituum, and Vue left the repo entirely.** The 28 `.vue`
files were only ever the preview, and their templates turned out to contain **no
Vue syntax at all** — no `v-for`, `v-if`, `v-bind`, `@click` or `{{ }}`, just
static HTML with placeholder copy. (The 167 `:` that look like bindings are CSS
colons, e.g. `media="(max-width:767px)"`.) The eight root components were pure
composition: a wrapper `div` and a list of `<Component />` tags. So each root
became a page body partial, each of the 20 components became a Handlebars
partial, and nothing needed translating — which is why carrying Vue for the
preview would have bought nothing.

`src/sites/ojin/preview/` mirrors `campaign/preview/`: a page `.json` names a
`template` (layout partial) and a `page` (body partial), which the layout pulls
in with `{{> (lookup @root 'page')}}`. All 8 pages render, no unresolved
`{{> …}}` remain, and all **135** image references resolve. `ojin.css` and
`ojin.js` are copied from the real build output rather than recompiled, so the
preview shows exactly what the CMS serves; the layout also reproduces
`_OJINBase.cshtml`'s script order, jQuery first, since `ojin.js` captures
`window.$` at module scope.

The partials' `@/assets/images/` (a webpack alias) became `/assets/Ojin/img/`.
One demo-only image the live site never had — the `-large` variant
`articledetail`'s `<picture>` asks for — is kept under `preview/assets/img/`
rather than added to `wwwroot`, so demo content stays out of production assets.

    npm run preview:ojin        dev server
    npm run build:preview:ojin  static build into preview-dist/ojin

**Still unowned:** `style_ojin.css` (28KB) and `ojin-bfoverride.css`, loaded by
`OjinArticlePage/Index.cshtml`, exist nowhere in the Vue project. They remain
committed artifacts with no source.

---

### 35. A drop-in pattern for sites, and HNHN ported onto it — RESOLVED 2026-09-18

Adding a property used to mean editing four central files — `vite.config.js`
(constants, the entry map, copy targets), `package.json` (two npm scripts),
`eslint.config.js` (ignores and a rule profile) and a cloned ~100-line preview
config. Each was a place to forget something. It is now: create a directory,
write `site.config.mjs`, build.

**The `templates/` vs `sites/` split was not describing anything.** Its stated
rule — "separate properties with their own Razor layouts, rather than themes of
the main site" — does not survive contact with the repo: `campaign` and `ojin`
both have their own layout, their own `js/` + `scss/`, their own `preview/`. The
only real difference was output namespace, which was invisible in the folder name
and lived in the input map. HNHN fitted neither name. `src/templates/{default,
campaign}` are now `src/sites/{nursingworld,cdc}`, four peers with one shape, and
what used to be implied by a directory name is declared in the manifest.

**Verified by byte-identity, not by a green build.** Every step of the refactor
left `wwwroot/assets` unchanged — 0 modified files, 131 per-module outputs, 130
with a default export, and both previews byte-identical to their pre-refactor
output (121 and 45 files). The .NET build and lint stayed clean throughout.

**Input order turned out to be load-bearing.** The first manifest-driven build
changed 94 files. Rollup derives shared-chunk names from the order entries are
declared, and alphabetical discovery reshuffled it — renaming every
`js/chunks/*.js` and cache-busting them for every visitor under a 30-day
`max-age`, for no change in content. Sites now pin an explicit `order` and
append rather than insert. Only the byte-identity gate made this visible.

**Three bugs found on the way:**

- **`build:preview:cdc` deleted `preview-dist/ojin`.** CDC wrote to the root of
  `preview-dist/` with `emptyOutDir: true`; OJIN wrote to a subdirectory of it.
  Reproduced, then fixed by giving each preview its own directory.
- **22 OJIN images were committed twice**, byte-identical, as both template
  source and build output. They are CMS upload targets
  (`ArticleContentImportController.cs:212`), not template source; the source copy
  is gone.
- **`frontend/.node-version` pinned Node 5.12.0** beside `.nvmrc`'s 24.14.0.
  fnm reads both with tool-dependent precedence. Replaced by `engines`.

**Depth-encoded paths are gone.** `TEMPLATE_DEPTH = 4`, two `stripBase: 2`
literals and the `'../../../../../wwwroot/assets'` climb duplicated in both
preview configs now come from `paths.mjs`, with copy depth *computed* by
`stripBaseFor()`. This is the bug class behind items 1 and 33, and it fails
silently — it misplaces files without erroring. It caught its author immediately:
a hand-guess of 4 for `src/sites/hnhn/assets/images` was wrong, and the function
returned the correct 5.

---

### 36. HNHN migrated off gulp into the Vite build — RESOLVED 2026-09-18

HNHN was a fourth property on a third build system: its own `package.json` and
`gulpfile.js` *inside wwwroot*, invisible to `frontend/` and to both pipelines.
The gulpfile only minified each file in place — no bundling, no module graph.

**Nobody had been running it.** `dist/js/questionnaire.js` was byte-identical to
its source: someone had edited the source and hand-copied it, so **unminified
source has been serving in production**. `radial-progress-chart.js` and `aos.css`
were the same. This is why the port was verified against `src/`, never `dist/`.

**The scripts stay classic scripts.** None of the five hand-written files has an
`import` or `export`; they declare top-level `const`/`function` into shared global
scope and depend on load order, with `hnhn-scripts.js` calling `new Swiper` and
`AOS.init` against globals from the `<script>` tags above it. Making them Rollup
entries would scope each one and require `type="module"`, which also defers —
items 22 and 10 both hit that. They are minified and copied instead
(`scripts/verbatim.mjs`), and modularizing them is a separate change.

`sign-up.js` settled the question independently: `onRecaptchaSuccess` is invoked
from Razor via `data-callback="onRecaptchaSuccess"`, so it *must* be a global. As
an ES module, reCAPTCHA could never have called it.

**Vendor libraries: three of four swapped to npm, one deliberately not.**
`bootstrap.bundle.min.js`, `aos.js` and `aos.css` are byte-identical to stock.
`bootstrap.min.css` differs by exactly one character — the committed copy had the
non-breaking space in `.blockquote-footer::before{content:"— "}` mangled to a
plain space by an editor round-trip, which npm restores. **Swiper was kept
vendored**: its CSS is byte-identical to stock 11.1.4 but its JS matches no
published Swiper build, differing in real code rather than a banner. Swapping it
would be an untested library change riding along with a structural migration.

**URLs moved to `/assets/hnhn/`** (24 references across 8 `.cshtml` and
`TinyMceSettingsExtensions.cs`). The 30 relative `url()` references in `hnhn.css`
resolved only from `/hnhn/dist/css/` and would break under *any* relocation, so
they had to be rewritten regardless — which is why the two stylesheets are real
Vite entries rather than verbatim copies, letting Vite emit and rewrite them
correctly into the site's own namespace.

**Two behaviours had to be held down explicitly:**

- **Asset inlining.** Vite's default 4KB limit turned 28 background SVGs into
  data: URIs and grew `hnhn.css` 43.6KB → 68.2KB — render-blocking CSS in
  `<head>`, while the same images still shipped as files for Razor. Opted out via
  `inlineAssets: false`.
- **Namespaced asset output.** `assetFileNames` is one global callback, so
  HNHN's images would have landed in the shared `/assets/img/`. It now recovers
  the owning site from the asset's source path. Sites on the flat namespace are
  unaffected.

**Verified by equivalence.** CSS: 457 → 457 selectors for `hnhn.css` and 50 → 50
for `search.css`, every difference minifier normalisation (`> div` → `>div`,
`[x="y"]` → `[x=y]`, `::before` → `:before`, `100%` → `to`). JS: every DOM hook
preserved in all five files (28, 56, 7, 12, 4), across both minification and the
lint autofix. All 41 asset references resolve. Six `console.log` calls dropped
per the build's policy; the one `console.error` survives (item 22).

**Two real defects fixed, found by lint:** `sign-up.js` had `key = key;` inside a
`formData.forEach` — a parameter assigned to itself — and `questionnaire.js`
reassigned its `forEach` index parameter. Both replaced with the expression they
computed. The remaining stylistic rules were turned off for the `jquery-legacy`
profile rather than applied, on item 34's reasoning: `eqeqeq` changes coercion,
and `no-redeclare` flags the hoisted-`var` loop idiom that `no-var` is already
off for.

**Deleted:** `radial-progress-chart.js` (needs `window.d3`, never loaded, zero
references), `all.min.css` (unreferenced — `_Root.cshtml` uses the CDN), 12 orphan
jQuery-UI sprites, all 7 files of `HNHN/Assets/scss/` (verbatim Optimizely Alloy
starter boilerplate — `.jumbotronblock`, `.teaserblock`, a teal `#1cb898` palette
appearing nowhere in HNHN), and `wwwroot/hnhn/` entirely. That last one closes
item 6's loose end: `gulp` and `gulp-cli` are gone from
`Sources/ANA.Site/package.json`, since that gulpfile was the only one left.

**Still open:**

- **The stale cache-bust is gone, and nothing replaced it.** `hnhn.css?v011425`
  was a hand-typed date stamp, already stale — the CSS was committed after the
  token was last bumped, so returning visitors were being served a stale
  stylesheet under `max-age=2592000`. It was dropped rather than bumped, which
  puts HNHN exactly where `screen.css`, `cdc.css` and `ojin.css` already are:
  unhashed filenames under a 30-day cache. Content-hashed CSS URLs are an
  estate-wide gap, not an HNHN one.
- **Font Awesome 6.5.2 still loads from `cdnjs`** (`_Root.cshtml:92`). Serving it
  locally means copying its webfonts too; left as its own change.
- **jQuery 3.6.0 still loads from `code.jquery.com`** on HNHN pages, while the
  rest of the estate is on 3.7.1 via `/bundles/jquery`. Consolidating is a
  behaviour change needing a browser pass.
- **A browser pass on HNHN has not been done.** The carousels, AOS animations,
  multi-step questionnaire, sign-up reCAPTCHA flow and search autocomplete all
  depend on global load order, which is exactly what copy-through preserves —
  but that is an argument for why it *should* work, not evidence that it does.

---

## Out of scope — adjacent, not this branch

Nothing currently. Both former entries were promoted on 2026-09-11:
`frontend-cdc/` is now item 10, and the two-Vite-config question is now Q1.
