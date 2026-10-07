# Frontend tests

```bash
cd Sources/ANA.Site/frontend
npm test                       # the fast checks (~1s)
npm run verify                 # lint + everything, including the rebuild check. Run before committing.
node test/run.js paths         # just the files whose name contains "paths"
```

`node test/run.js css --update-baseline` rewrites the CSS baselines. That is a separate command on
purpose: the diff then lands in a commit and gets reviewed, rather than a test run absorbing a
dropped stylesheet silently.

A `*.slow.test.js` file runs only under `--slow` (which `npm run verify` passes). There is one:
it rebuilds the project into a scratch directory, which costs ~5s.

Exit code 0 = everything passed. No new dependencies: assertions are ~110 lines in `_assert.js` and
the runner is ~60 in `run.js`.

## Why these exist

The Vite migration (backlog items 35 and 36) was verified by byte-identity and equivalence checks
run by hand. Those checks were good, but they were done once, by a person, and they do not run again
when someone edits a manifest six months from now.

Every failure these tests guard against is **silent**. None of them fails a build:

| Check | Would it catch a wrong `stripBase`, or a moved asset? |
|---|---|
| `npm run build` | no — Rollup does not know what Razor asks for |
| `npm run lint` | no — the code is valid |
| `dotnet build` | no — it is a string in a `.cshtml` file |
| looking at the output | only if you already know what should be there |

That is the same shape as the bugs on `feature/log-cleanup-20291001`: a throw before an emit, which
leaves nothing behind to notice. Here it is a file written one directory off, or a URL nobody
requests until a user does.

## How it works

Flat discovery: anything matching `*.test.js` in this directory is a test. Helpers are prefixed `_`
so they can never be collected. Each file runs in its **own child process**, so a crash is
attributable to one file and cannot take the run with it.

There is no bundling step. The sibling harness on `feature/log-cleanup-20291001` browserifies every
test through babelify + aliasify, because the modules there use ES6 `import` plus aliasify aliases
that Node cannot resolve. This branch is ESM on Node 24 with subpath imports, so a test file simply
imports what it is testing.

`_css-inventory.js` parses a compiled stylesheet into selectors, at-rule conditions, `@font-face`
families and `@keyframes` names. `_source.js` strips comments from JS and SCSS — commented-out code
is not a reference, and this repo has plenty of it.

`_dom.js` boots a page the way its layout does, forking `_boot-worker.mjs` **once per boot**.
That is correctness, not speed: ES modules are cached per process, so a second boot re-executes
nothing and silently inherits the first one's module graph. `_assets-hook.mjs` teaches Node's
resolver where `/assets/…` lives, so `jit-require`'s runtime URLs resolve without rewriting the
shipped code.

`_casefs.js` holds the case-sensitive lookups both `asset-references` and `source-casing` depend on.
`fs.existsSync` answers case-insensitively on macOS and Windows, so asking the filesystem to
resolve a path is exactly what let two case bugs ship green.

`_assert.js` keeps that branch's API exactly — same names, same argument order, `name` last,
`doesNotThrow` returning the value so assertions chain. Both branches will carry a `frontend/test/`
and they will conflict on merge; keeping this file mergeable is what stops the repo ending up with
two ways to write a test.

Nothing throws on failure. Assertions are counted, and `assert.done()` prints the tally and sets the
exit code — so **every test file must end with `assert.done()`** or its failures are invisible.

## What is covered

| File | What it pins |
|---|---|
| `paths.test.js` | `stripBaseFor()` — the copy depths every static-copy target depends on, and that a directory outside the root throws instead of guessing. Backlog items 1 and 33 were both this bug class, and it fails silently: wrong depth, clean build, files in the wrong place |
| `load-sites.test.js` | The collectors that turn `site.config.mjs` into Vite inputs: `outBase` prefixing, `flatten` vs `stripBaseFrom`, `~` resolving into node_modules, `exclude` emitting a negative glob, a duplicate alias throwing, `assetOutBase` namespacing, the `inlineAssets` opt-out. Plus invariants on the real manifests — ascending unique `order`, nursingworld first |
| `build-contract.test.js` | The paths Razor, `BundleInitialization.cs` and `jit-require.js` ask for **by name**, against the committed output. Includes the data-require contract from both ends — all 131 manifest modules have a built file with 130 default exports, *and* all 55 `data-require` values live markup actually renders are declared and built — plus that HNHN's five scripts are actually minified — the gulp build they replaced had stopped being run, and unminified source was serving in production |
| `asset-references.test.js` | Every `/assets/` URL referenced from Razor, C# and the built CSS resolves to a real file — **case-sensitively**, by walking directory listings rather than trusting `fs.existsSync`, which answers case-insensitively on macOS and Windows. 141 references, 4 recorded gaps |
| `source-casing.test.js` | Every JS import and SCSS `@import`/`@use` matches the on-disk name **including case** (714 and 263 specifiers). Developers are on case-insensitive filesystems and deploy targets may not be, so this class of bug compiles everywhere anyone tests: `tab-control-view.js` imported `modules/Utils` and macOS bundled a duplicate `Utils`, 4,637 bytes where a correct build emits 2,684 |
| `output-integrity.test.js` | Every relative and `/assets/` import in the **emitted** JS resolves (829 specifiers), no bare specifier survives (item 23 shipped 84 files carrying one), jQuery source appears only in the two files the build copies for it, and each vendor file is byte-identical to the version `package.json` pins. Swiper is asserted to stay vendored rather than npm-sourced, per item 36. Also that the output is a **production** build: no source maps, no `console.log/info/debug/trace` in anything we compile, everything minified — and `jit-require` still keeps `console.error`/`warn`, because when those were stripped a module failing to load made no sound at all (item 22) |
| `css-inventory.test.js` | That each of the 8 stylesheets still styles what it styled — 6,339 selectors plus `@media` conditions, `@font-face` families and `@keyframes` names, against a committed baseline. The safety net for item 4's `@import` → `@use` work, where the intended result is *no change in the compiled CSS*. Also that no uncompiled Sass leaked through |
| `style-hooks.test.js` | That the classes components toggle at runtime are actually styled in the stylesheet **that page's layout loads** — the distinction matters because OJIN does not load `screen.css` (item 25). A curated map per site, asserted both ways, plus `KNOWN_GAPS` for hooks that are toggled but styled nowhere |
| `dom-boot.slow.test.js` | Epic D1: each layout's scripts, run in the order the `.cshtml` renders them, in jsdom against the committed output. All four boot with **zero** errors against a bare fixture — only true since the null guards went into `hnhn-scripts.js`, `filter-resources.js` and `disclaimer-for-mobile.js`. Beyond booting: CDC's Foundation is asserted to have *reflowed* (the ARIA roles its Accordion plugin adds, which no fixture carries) and `ModuleController` to have instantiated both an eager module and a **code-split** one out of `/assets/js/chunks/` — item 10's path. OJIN's five self-initialising modules are counted *differentially* against a boot that skips `ojin.js`, because jQuery registers a `DOMContentLoaded` listener of its own and a raw total would absorb a module that stopped registering; `invoked === registered` also pins the timing trap that would make the whole file vacuous. HNHN's four page scripts each run on their own page's markup, with the repo's jQuery 3.7.1 standing in for the 3.6.0 `_Root` loads from a CDN |
| `dom-load-order.test.js` | D1.2 in its own process: booting without `/bundles/jquery` raises the shim's explicit error, and a missing `data-require` target is named and counted |
| `module-contract.slow.test.js` | D2.1 steps 1–2: all **55** data-require modules import, are callable without `new`, and return an object with `init` — the contract jit-require depends on. Plus **48 of 55** initialise against a bare element; the other 7 are listed with reasons and asserted both ways, so one that starts passing must be promoted — which is how the arrow-constructor fix reported itself. Those 7 are exactly the ones `view-fixtures.slow.test.js` covers, so between the two files all 55 are initialised. Also D2.2: no factory returns `window` and no event payload is `window` (item 28), with the shared emitter's `emit()` wrapped during all 55 inits |
| `late-load.slow.test.js` | D2.3: `carousel-view` and `gallery-view` run their deferred callback **both** when `window.load` has already fired (item 24's regression) and when it has not. The already-fired branch waits for jsdom's own load to pass first — without that the test passed against the bug |
| `view-fixtures.slow.test.js` | D2.1 step 4: the 7 views that need more than a bare element, each against the markup it actually requires — derived by running them and reading what they dereferenced. The fixture *is* the markup contract, so each is paired with a check that removing it breaks the view |
| `behaviour.slow.test.js` | D3's P1 behaviours: the accordion toggles (class *and* `aria-expanded`), a tab activates itself and its panel, Owl builds a slide per hero (item 24's reported symptom), and the video lightbox actually opens Magnific Popup — the library 42 views depend on |
| `factory-calls.test.js` | That `new` is never applied to a module whose default export is an arrow factory — the regression guard for the bug below. Static, so it covers all 29 call sites including the 17 inside `*-item-view` files that no `data-require` renders directly |
| `modernizr.test.js` | That Modernizr is built from `modernizr.config.mjs` rather than downloaded by hand, and that nothing reads a detect the config does not declare — scanned in both directions against the full 322-property Modernizr vocabulary. The detect that matters is `flexbox`: `screen.css` gives `.grid--flex` its `display: flex` only under `.flexbox`, with no fallback, so dropping it turns every flex grid into a block layout silently. The hand-built file's feature set had drifted 16 → 26 → 20 → 27 detects across two years, once dropping seven in a single commit |
| `committed-output.slow.test.js` | That `wwwroot/assets` is byte-for-byte what the current source builds, reporting stale / missing / orphaned files — plus that two consecutive builds are identical, without which a clean diff means nothing (item 32's `unique-id()` tokens changed on every compile). The deploy ships whatever is committed and nothing rebuilds it, so this is the check that "I forgot to rebuild" cannot survive |

## What this does not cover

Anything that needs a browser. Nothing here proves a Swiper carousel initialises, that AOS
animations fire, that the multi-step questionnaire advances, or that reCAPTCHA can reach
`onRecaptchaSuccess`. HNHN's scripts are the least covered code in the repo and the most dependent
on global load order — `hnhn-scripts.js` and `questionnaire.js` query the DOM at module load, and
`sign-up.js` throws at line 5 if its form markup is absent.

A green run means **the build produces what the server asks for, at the paths it asks for**. It does
not mean a page works.

Adding DOM-level tests means porting `_stubs.js` from `feature/log-cleanup-20291001`. Its design
rule is worth keeping: *a stub must never be more generous than the DOM*, or a test passes because
the stub was lenient rather than because the code was right.

## The live bug this suite found — now fixed

`module-contract.slow.test.js` documents 12 modules blocked by a product bug, not a test gap:
**22 files make 29 calls to `new` on an arrow-function default export**, which throws
`TypeError: X is not a constructor` unconditionally in every browser. It covers every account
section plus `address-book-view` and `checkout-address-view`. `jit-require` catches the throw and
logs `console.error`, so the page renders with its add/update lightbox silently dead.

Verified pre-existing at the merge-base `844de8487` — not introduced by the Vite migration.
**Fixed** by dropping the keyword at all 29 call sites: the factories already did the `new`
internally, so the call sites were double-constructing, and calling them plainly is how
`jit-require` itself does it. The two-way assertions reported the fix by failing all 12 at once and
naming each view to promote; the bare-element floor went from 36 to **48 of 55**.
`factory-calls.test.js` is the guard that stops it returning.

## Known gaps

`committed-output.slow.test.js` carries `NOT_BUILT`: committed files the build does not produce, so
they are not reported as orphans. `emptyOutDir` is `false` precisely so they survive (item 16).
Each pattern is asserted to still match something, so a stale exemption cannot mask a future
orphan. One entry is a finding in its own right: the four `css/*.css.map` files, which are stale
dev-build leftovers.

`js/modernizr-custom.js` used to sit in that list, described here as having lost its minification
step. **That was wrong** — both files were minified. They were two unrelated builds: a stale
Modernizr 3.3.0 with 245 detects left in `src/` by the 2022 TFVC import, and a hand-downloaded
3.13.1 with 22 detects in `wwwroot`. Nothing connected them, and nothing in the build graph
referenced the source. Modernizr is now generated from a declared list — see `modernizr.test.js`.

`asset-references.test.js` carries two maps, both asserted in **both** directions so they cannot
rot:

- `KNOWN_GAPS` — individual URLs that do not resolve, with the reason. An unresolved URL missing
  from the map fails; an entry that *starts* resolving also fails, forcing the entry to be deleted.
- `UNAUDITED_STYLESHEETS` — stylesheets this repo ships but does not author (`style_ojin.css` has no
  source at all; `system.css` and `ToolButton.css` are vendored Optimizely CSS). Their internal
  `url()` references are not checked, because nothing changed here can introduce or fix them.

Every entry was verified pre-existing against the merge-base `844de8487` — none was introduced by
the migration. Razor and C# references are never exempted this way: those we do author.

## Adding a test

1. Create `test/<thing>.test.js`.
2. `import * as assert from './_assert.js';`, then import the module under test.
3. A header comment naming what the test pins and, where there is one, the real failure it came
   from. The prose carries the rationale here; assertion names carry the invariant.
4. Finish with `assert.done()` — it prints the tally and sets the exit code.
5. **Break the thing and confirm the test goes red.** A test that cannot fail is worse than no test:
   it reads like coverage. Record in the header what you broke to prove it.
