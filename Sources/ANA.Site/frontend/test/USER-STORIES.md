# Frontend asset tests — user stories

**Purpose.** Before anyone commits `wwwroot/assets/`, prove with tests that the committed CSS and JS
still do what the server and pages expect, so a release needs less hand-testing of frontend assets.
This sits alongside the manual pre-release smoke tests and does not replace them: the smoke tests
check that a page looks and behaves right to a person; these check that the build output works.

**Where it runs.** On a developer machine before committing build output. Not in Azure Pipelines.

**In scope.** nursingworld (`_Base`, `_ProductLayout`, Hub), CDC / Project Firstline (`_CDC*`),
OJIN (`_OJINBase*`), HNHN (`HNHN/…/_Root`). **Out of scope:** `Microsite/`, `HNHN_OLD/`, and anything
needing a real browser engine (layout, paint, real network).

**Layers.**

| Layer | Runs against | Tooling |
|---|---|---|
| **B — Build checks** | committed `wwwroot/assets`, the source tree, and a scratch rebuild | Node only, existing `_assert.js` / `run.js` |
| **D — DOM checks** | the **committed, minified** output loaded into jsdom in the order the Razor layout loads it | Node + jsdom (new devDependency, see Decision 1) |

The DOM layer tests the committed output, not the source, on purpose. Every bug in backlog items
22–24, 27 and 28 came from the build or minifier, not the source, so testing the source would have
missed all of them.

**Status key:** ✅ already covered by `frontend/test/` · ◐ partly covered · ○ new.
**Priority:** **P1** = must be green before the Vite branch merges · **P2** = should follow soon after.

---

## Epic B1 — The committed output is the output of the current source

The deploy ships whatever is committed. The biggest risk in a developer-machine workflow is
committing source changes without rebuilding, or rebuilding on a machine that produces different
output.

### B1.1 Committed assets match a fresh build ○ P1
*As a developer about to commit, I want a check that `wwwroot/assets` is exactly what the current
source builds, so I can't ship stale or hand-edited output.*

- Given a clean tree, when the test builds into a scratch directory (not `wwwroot`),
  then every file the build emits is byte-identical to the committed copy.
- The failure lists files that are **stale** (differ), **missing** (emitted but not committed) and
  **orphaned** (committed under a generated path like `js/chunks/` but no longer emitted).
- Committed files the build does not produce (e.g. `fonts/icons.*`, backlog item 16) are not
  reported as orphans and are never touched. `emptyOutDir` must stay `false`.
- Runs in under ~30s. (A production build takes ~15s.)
- *Proven red by:* editing one SCSS partial without rebuilding.

### B1.2 The build is deterministic ○ P2
*As a developer, I want two builds of the same source to be byte-identical, so a clean B1.1 diff
means something and cache-busting tokens don't churn for no reason (item 32).*

- Two consecutive builds into separate scratch directories produce identical trees.

### B1.3 The build does not depend on a case-insensitive file system ○ P1
*As a developer on Windows or macOS, I want filename-case mistakes caught explicitly, because my
file system hides them and another machine's won't.*

- Every JS import specifier (static and dynamic), SCSS `@import`/`@use`, CSS `url()` and Razor
  `/assets/…` reference matches the on-disk name **including case**.
- **Currently fails:** `views/tab-control-view.js` imports `modules/Utils` (the file is `utils.js`).
  On Linux the build fails outright. On Windows it succeeds but bundles a **second copy** of
  `Utils` into `tab-control-view.js`, which is why the committed output differs from a Linux build.
- *Proven red by:* the existing `modules/Utils` import.

### B1.4 Dependencies install reproducibly ○ P1
*As a developer, I want `npm ci` to work, so everyone builds against the same dependency versions.*

- `package.json` and `package-lock.json` agree. **Currently fails:** `npm ci` refuses to install.
- The running Node major matches `.nvmrc` (warning, not a failure).

---

## Epic B2 — The JS output is loadable as served

### B2.1 Every import in the output resolves ○ P1
*As a developer, I want every emitted JS file's imports to point at a file that exists, so a pruned
or renamed chunk can't 404 in the browser.*

- Every static `import … from "x"` and dynamic `import("x")` in every emitted `.js` file is either
  relative and resolves to a committed file, or is an `/assets/…` URL that resolves.
- **No bare specifiers** (e.g. `"jquery"`) anywhere in the output (item 23: 84 files carried one).

### B2.2 Exactly one jQuery ○ P1
*As a developer, I want jQuery to come from one place, so plugins registered on `window.jQuery` are
visible to every module (items 23, 27).*

- No emitted module or chunk contains a bundled copy of jQuery.
- `js/jquery.min.js` matches the pinned version in `package.json` (3.7.1). HNHN's vendor files
  (`bootstrap.bundle.min.js`, `aos.js`) match their pins as well.

### B2.3 Output is a production build ○ P1
*As a developer, I want to know the committed output was built in production mode.*

- JS is minified; no `sourceMappingURL` comments; no `console.log/info/debug` survive.
- `console.error` and `console.warn` **do** survive in `jit-require` (item 27: when they were
  stripped, module failures made no sound at all).
- See Decision 3 on the committed `.css.map` files.

### B2.4 The data-require contract, from Razor to output ◐ P1
*As a developer, I want every `data-require` value a view actually renders to load a real module, so
a renamed view or manifest edit can't silently disable a component.*

- Already covered: every manifest entry has a built file; 131 outputs, 130 with a default export.
- **New:** every `data-require` value in in-scope `.cshtml` files (ignoring Razor `@* … *@` comments)
  is in `module-entries.json` and has a built file.
- Unknown targets are listed in a two-way `KNOWN_GAPS` map, the same pattern as
  `asset-references.test.js` (currently `account-member-upload-view`, which sits inside a comment).

### B2.5 Entry points and namespaces ✅
Covered by `build-contract.test.js` (layout entry files, HNHN minification, no doubled `Ojin/Ojin`)
and `load-sites.test.js` (manifest invariants, chunk-name `order`). Keep as is.

---

## Epic B3 — The CSS output is the CSS we meant to ship

These are the main safety net for the remaining Sass work (`@import` → `@use`, backlog item 4),
where the intended result is **no change in the compiled CSS**.

### B3.1 Selector inventory does not change unexpectedly ○ P1
*As a developer changing how CSS is built, I want any added or removed selector flagged, so a
refactor that silently drops styles fails before anyone eyeballs a page.*

- For each stylesheet (`screen`, `print`, `editor`, `editor-fix`, `cdc`, `Ojin/ojin`, `hnhn/hnhn`,
  `hnhn/search`), a committed baseline records: every selector, `@media` / `@supports` condition,
  `@font-face` family+src, and `@keyframes` name.
- The test fails with a readable diff (added / removed per stylesheet) when the built CSS differs.
- Updating the baseline is a deliberate step (`node test/run.js css --update-baseline`), so the
  diff shows up in code review.
- *Proven red by:* deleting one partial's `@import` from `_core.scss`.

### B3.2 No Sass leaked into the CSS ○ P1
*As a developer, I want to know every stylesheet actually compiled.*

- No `$variable`, `@mixin`, `@include`, `@use`, or `@import` of a `.scss` partial in any built CSS.
- Every stylesheet is non-empty and minified.

### B3.3 Classes the JS depends on exist in the CSS the page loads ○ P2
*As a developer, I want the CSS hooks that components toggle at runtime (e.g. `owl-carousel`,
`mfp-*`, `nav-open`, `no--scroll`, `flip-icon`) to exist in the stylesheet that page's layout loads,
so a component can't run against missing styles (item 25: OJIN doesn't load `screen.css`).*

- A small, explicit map of component → required classes → stylesheet, asserted both ways.

### B3.4 Every `url()` and `/assets/` reference resolves ◐ P1
Covered by `asset-references.test.js`. **Currently red with 3 gaps:** the two `SourceSansPro-SemiBold`
fonts in `Views/Shared/ConsentGate.cshtml`, and the Microsite favicon casing (`microsite/` vs
`Microsite/`). The test should stop scanning `Microsite/`, and the ConsentGate fonts need fixing or
listing in `KNOWN_GAPS`.

---

## Epic D1 — The page boots the way the layout loads it (jsdom)

The harness reads each layout's `<script>` tags **from the `.cshtml` itself** (so it can't drift
from the real load order), loads classic scripts into the window in that order, then imports the
module entry from the committed output. `/assets/…` URLs are mapped onto `wwwroot/assets` on disk.
During each run it captures `console.error`, `console.warn`, uncaught errors and unhandled
rejections.

*Spike result:* the committed `entry.js` boots in jsdom and `jit-require` loads real per-module
files. A `page-view` fixture without the `data-logged-in-user-*` body attributes fails inside
`gtm-helper` — the kind of markup contract these stories are meant to pin.

### D1.1 nursingworld boots cleanly ○ P1
*As a developer, I want `_Base` pages to start with zero script errors.*

- Given a fixture with `_Base`'s body (`data-require="./src/views/page-view"` plus the
  `data-logged-in-user-*` and `data-page-heading` attributes), when `/bundles/jquery`,
  `/bundles/moderniz` and then `entry.js` load,
  then no errors, no unhandled rejections, and `jit-require` loads every module (no
  "loaded N of M" warning).
- Repeated for an anonymous and a logged-in profile (empty vs populated user attributes).

### D1.2 Load order failures are loud ○ P1
*As a developer, I want a missing or reordered jQuery to fail with a clear error, not silently.*

- When `entry.js` loads without `/bundles/jquery`, the shim's explicit "jQuery global not found"
  error is raised (item 23).
- When a `data-require` target doesn't exist, `jit-require` logs `failed to load <name>` and warns
  "loaded N-1 of N", and the other modules on the page still initialise.

### D1.3 CDC boots cleanly ○ P1
- `_CDC` fixture: jQuery, then `cdc.js` as a module. No errors; Foundation is initialised.
  `ModuleController` loads its dynamic modules, which come from `/assets/js/chunks/` and 404'd when
  `base` was wrong.

### D1.4 OJIN boots cleanly ○ P1
- `_OJINBase` fixture: jQuery, then `Ojin/js/ojin.js`. No errors. The five self-initialising modules
  (navigation menu, article content, headline, search, base) run on `DOMContentLoaded`.

### D1.5 HNHN scripts run in `_Root` order ○ P1
- jQuery, then `bootstrap.bundle.min.js`, `swiper-bundle.min.js`, `aos.js`, `hnhn-scripts.js` on a
  `_Root` fixture: no errors.
- Each page-specific script (`search`, `sign-up`, `questionnaire`, `auto-complete`) runs without
  error on a fixture with **its own page's markup**.
- `grecaptcha` is a documented stub. Note: `_Root` loads jQuery **3.6.0 from code.jquery.com**,
  not the local 3.7.1, and the harness has to pick one (see Decision 4).

---

## Epic D2 — Every live module initialises

### D2.1 Every live `data-require` target loads and initialises ○ P1
*As a developer, I want each of the ~56 modules Razor actually renders to import, construct and
`init()` against its real markup, so a build change can't strip exports (item 24) or break factories
(item 27) in a module nobody clicks during manual testing.*

- For each target: the import succeeds; `default` is a function that works **without `new`**;
  it returns an object with `init`; `init($el, data)` doesn't throw; no errors are captured.
- Markup comes from fixtures based on the view that renders it (see Decision 2).
- Order of work: commerce and global chrome first (`page-view`, `primary-nav`, `global-nav`,
  `header-*`, `mini-cart`, `add-to-cart`, `product-detail`, `cart-*`, `checkout-*`,
  `order-*`, `payment-details`, `form-view` ×19, `tab-control` ×8, `video` ×6,
  `container-block` ×5), then account pages, then the rest.

### D2.2 Nothing emits `window` as a component ○ P1
*As a developer, I want a guard against the `self` → `window` class of bug (item 28).*

- The harness wraps the global emitter. Across every D2.1 run, no event payload and no factory
  return value is `window`.
- The loading-spinner singleton exposes `request()` and is not `window`.

### D2.3 Late-loading modules still initialise ○ P1
*As a developer, I want modules that wait on `window.load` to work when they load after it (item 24).*

- With `document.readyState === 'complete'` before import, `carousel-view` and `gallery-view`
  still run their init callback (`modules/on-window-load`).

---

## Epic D3 — Core behaviours (best effort in jsdom)

jsdom has no layout engine, so these check DOM state (classes, attributes, element counts), not
appearance. Each one is chosen because a manual tester would otherwise have to click it.

| Story | Behaviour asserted | P |
|---|---|---|
| D3.1 Accordion | trigger toggles the open state / `aria-expanded` | P1 |
| D3.2 Tabs (`tab-control-view`) | clicking a tab activates it and its panel | P1 |
| D3.3 Hero carousel | with **2+ heroes**, Owl initialises and builds slides (item 24's reported symptom) | P1 |
| D3.4 Video lightbox | `video-view` opens Magnific Popup (one of the 42 views using it, item 27) | P1 |
| D3.5 Primary nav | toggle emits `primarynavview:toggled`; page-view applies `nav-open` | P2 |
| D3.6 Scroll-to-top | click targets `#top` | P2 |
| D3.7 HNHN questionnaire | "next" advances one step | P2 |
| D3.8 HNHN sign-up | a valid submit reaches `onRecaptchaSuccess` with the stub | P2 |
| D3.9 OJIN nav menu | toggle opens/closes the menu | P2 |
| D3.10 CDC filter-resources | toggling a category flips the `flip-icon` class (item 26) | P2 |

---

## Epic E — Running it

### E1 One command before commit ○ P1
*As a developer, I want one command that tells me whether my build output is safe to commit.*

- `npm run verify` runs lint, then the B tests, then the D tests, and prints one summary with a
  non-zero exit on any failure. `npm test` stays fast (no rebuild); B1.1/B1.2 run under `verify`.
- Works the same on Windows and macOS (path separators; no reliance on case-insensitivity).

### E2 Tests that can fail ○ P1
*As a maintainer, I want every new test file to record what was broken to prove it goes red,* as the
existing suite already does.

### E3 Stubs are no more generous than the DOM ○ P1
*As a maintainer, I want anything the harness fakes (`grecaptcha`, `dataLayer`, `matchMedia`,
YouTube/Vimeo, XHR endpoints) listed in one file and kept minimal,* so a test can't pass because a
stub was lenient. Unexpected network calls fail the test rather than resolving silently.

---

## Decisions needed

1. **Add `jsdom` as a devDependency.** The test README currently says "no new dependencies".
   The DOM layer needs a real DOM to be honest. The other option is porting `_stubs.js` from
   `feature/log-cleanup-20291001`, which isn't in this repo. *Recommend jsdom.*
2. **Where fixture markup comes from.** (a) Hand-reduced from each `.cshtml`, or (b) HTML saved from
   rendered INTE pages for the top ~10 page types, trimmed, with hand-reduced fixtures for the rest.
   (b) is more faithful (real CMS data, real body attributes). *Recommend (b) for P1 pages.*
3. **The committed `.css.map` files** (`screen`, `print`, `editor`, `editor-fix`). A production build
   doesn't emit source maps, so these look like leftovers from a dev build. Delete them and have
   B2.3 forbid them, or keep them on purpose?
4. **HNHN's jQuery.** `_Root` loads 3.6.0 from code.jquery.com while everything else uses the local
   3.7.1. Should the harness test against 3.6.0 (matches production) or should HNHN move to
   `/bundles/jquery`? (Moving it is a code change outside this test work.)

## Found while scoping

| Finding | Effect | Story |
|---|---|---|
| `tab-control-view.js` imports `modules/Utils`; file is `utils.js` | Linux build fails; Windows build bundles a duplicate `Utils` | B1.3 |
| `package-lock.json` out of sync with `package.json` | `npm ci` fails | B1.4 |
| `ConsentGate.cshtml` references two `SourceSansPro-SemiBold` fonts that don't exist | 404s; existing test is red | B3.4 |
| Microsite favicon referenced as `microsite/`, folder is `Microsite/` | Existing test red on Linux; out of scope anyway | B3.4 |
| Fresh Linux build (with the casing fix) reproduces all committed CSS, CDC, OJIN and HNHN output byte-for-byte | B1.1 is workable as specified | B1.1 |
