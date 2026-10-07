# ANA NursingWorld — Frontend

Build system for [nursingworld.org](https://nursingworld.org) and the ANA family of sites. Migrated from Grunt/Browserify to **Vite** in June 2026.

---

## Requirements

| Tool | Version |
|------|---------|
| Node | 24.14.0 (see `.nvmrc`) |
| npm  | bundled with Node |

Node version is managed via [fnm](https://github.com/Schniz/fnm) (recommended) or nvm.

```bash
# fnm (recommended — works on both Mac and Windows)
fnm use

# nvm
nvm use
```

---

## Setup

```bash
cd Sources/ANA.Site/frontend
npm install
```

---

## Commands

### Development

```bash
npm run dev
```

Starts the Vite dev server with HMR. Proxies all requests to the local .NET/Optimizely app running at `https://localhost:44300`. The .NET solution must be running first.

Asset output during dev is served in-memory by Vite — the `../wwwroot/assets/` directory is not written to during dev mode.

### Production build

```bash
npm run build
```

Compiles and minifies all JS and CSS to `../wwwroot/assets/`.

> **The pipeline does not run this.** `azure-pipelines.yml` is a single
> `dotnet publish` step — no Node, no `npm install`, no `npm run build`. The
> assets that deploy are whatever is committed under `wwwroot/assets/`, built on
> a developer machine. Run this and commit the result as part of any change.

Output structure:

```
wwwroot/assets/
├── js/                        # shared flat namespace: nursingworld + cdc
│   ├── entry.js               # Bootstrap — loaded by _Base.cshtml
│   ├── cdc.js                 # CDC theme — loaded by _CDC.cshtml
│   ├── src/                   # one file per data-require module (131 of them)
│   └── chunks/                # shared code split by Rollup
├── css/
│   ├── screen.css  print.css
│   ├── editor.css  editor-fix.css   # Optimizely CMS editing UI only
│   └── cdc.css
├── img/  fonts/
├── Ojin/                      # sites that own a namespace
│   ├── js/ojin.js  css/ojin.css
│   └── img/
└── hnhn/
    ├── js/   # hnhn-scripts, search, sign-up, questionnaire, auto-complete
    │         # + bootstrap, aos, swiper (vendor)
    ├── css/  # hnhn, search + bootstrap, aos, swiper
    ├── img/  fonts/
    └── tinymce/               # loaded by the CMS editor, not by any page
```

### Preview build output

```bash
npm run preview
```

Serves the production build output locally for inspection. Not a substitute for running the full .NET app.

### Component previews

```bash
npm run preview:site -- cdc        # dev server for one site
npm run build:preview:site -- cdc  # static build into preview-dist/cdc
npm run build:preview:all          # every site that has a preview
```

Standalone reference sites built with [Vituum](https://vituum.dev) + Handlebars —
15 pages for CDC, 8 for OJIN. Each lives in its own `preview/` directory with a
short `vite.config.js` calling `definePreview()` from
`scripts/preview-config.mjs`, and each writes to its own `preview-dist/<site>/`,
which is git-ignored. Nothing the live site serves comes from these builds.

`scripts/preview.mjs` runs them from their own directory, which the Handlebars
plugin requires (it derives partial names with `relative(root, dir)` and then
applies that relative string to absolute paths).

### Lint

```bash
npm run lint
```

Runs ESLint 10 across all source files using flat config (`eslint.config.js`). Lint is configured to warn on style issues and error on correctness issues. The CI build should treat errors as blocking.

To auto-fix eligible violations:

```bash
npx eslint . --fix
```

### Image optimisation

```bash
npm run optimise:images
```

Compresses the built images in `wwwroot/assets/img/` in place, using Sharp. Run it *after* `npm run build`, not before — it rewrites build output, not source.

---

## Project structure

Every web property is a **site**: one directory under `src/sites/`, all of them
the same shape. The shape is the documentation — position tells you what a file
does, so you can open an unfamiliar site and know immediately what you are
looking at.

```
frontend/
├── paths.mjs                  # every cross-tree path; nothing else climbs ../..
├── vite.config.js             # discovers sites — no per-site entries live here
├── eslint.config.js           # globbed, with per-site profiles from the manifests
├── scripts/
│   ├── load-sites.mjs         # finds site.config.mjs and builds Vite's inputs
│   ├── preview-config.mjs     # shared Vituum + Handlebars preview factory
│   ├── preview.mjs            # npm run preview:site -- <name>
│   ├── verbatim.mjs           # minified, unbundled classic scripts
│   └── optimise-images.mjs
└── src/sites/
    ├── nursingworld/          # the main site → /assets/js, /assets/css
    ├── cdc/                   # Project Firstline → /assets/js/cdc.js, css/cdc.css
    ├── ojin/                  # → /assets/Ojin/
    └── hnhn/                  # → /assets/hnhn/
```

Each site:

```
src/sites/<name>/
├── site.config.mjs   # the contract: output namespace, entries, copies, lint profile
├── js/               # ours, ships
├── scss/             # ours, ships
├── vendor/           # third-party, copied verbatim, never hand-edited (not linted)
├── assets/           # images + fonts that ship
└── preview/          # never ships
```

`nursingworld` additionally holds `js/module-entries.json` (the data-require
manifest), `js/lib/` and `scss/lib/` (vendored files with no npm equivalent) and
`js/vendor/jquery-global.cjs` (the jQuery shim).

---

## Adding a site

Create the directory, write `site.config.mjs`, build. Nothing central needs
editing — not `vite.config.js`, not `package.json`, not `eslint.config.js`.

```js
// src/sites/example/site.config.mjs
export default {
    // Input order fixes Rollup's shared-chunk names. Append, never insert:
    // reshuffling renames every js/chunks/*.js and cache-busts them for every
    // visitor under a 30-day max-age, for no change in content.
    order: 40,

    // '' shares the flat /assets namespace; a name owns /assets/<name>/.
    outBase: 'example',

    // Output key → source. The key is the served path and is a contract with Razor.
    entries: { 'css/example': 'scss/example.scss', 'js/example': 'js/example.js' },

    // Minified but NOT bundled — for classic scripts that rely on globals and
    // load order and cannot become ES modules. See scripts/verbatim.mjs.
    verbatim: [{ src: 'js/*.js', dest: 'js' }],

    // '~' resolves in node_modules, so stock vendor files ship from npm and
    // `npm audit` can see them.
    copy: [
        { src: '~bootstrap/dist/css/bootstrap.min.css', dest: 'css', flatten: true },
        { src: 'assets/images/**/*', dest: 'img', stripBaseFrom: 'assets/images' },
    ],

    scssLoadPaths: ['scss'],                  // '~pkg/scss' for a package
    alias: { example: 'js/src' },             // rejected if another site claims it
    globals: ['Swiper'],                      // third-party globals, for no-undef
    inlineAssets: false,                      // opt out of data: URI inlining
    lint: 'modern',                           // or 'jquery-legacy'
};
```

Then verify: `npm run build` must leave **every other site's output
byte-identical** (`git status wwwroot/assets`). If it does not, the new site
perturbed something shared — almost always `order`.

---

## Architecture notes

### Module loading pattern

Razor views use a `data-require` attribute to declare which JS modules they need. `modules/jit-require.js` reads these at runtime and loads the corresponding compiled file from `/assets/js/` with a dynamic `import()`. This is why every module in `module-entries.json` compiles to its own individual output file — Rollup preserves the full directory path so the runtime can resolve it from the `data-require` value.

### jQuery

jQuery **3.7.1** comes from npm and is copied to `/assets/js/jquery.min.js`, which
`BundleInitialization.cs` serves as `/bundles/jquery`. The Razor layouts load that
as a classic `<script>` before the module entry, so there is exactly one jQuery on
the page — Razor inline scripts, EPiServer and the jQuery plugins all share it,
and plugins register themselves on that global.

Modules that `import $ from 'jquery'` resolve through an alias to
`src/sites/nursingworld/js/vendor/jquery-global.cjs`, which re-exports `window.jQuery`. That
shim is CommonJS on purpose: it has to satisfy both `import $ from 'jquery'` and
the `require('jquery')` that UMD plugins such as magnific-popup perform. jQuery is
**not** listed in `rollupOptions.external` — doing so left an unresolvable bare
`jquery` specifier in the ESM output.

jQuery UI is no longer shipped. It was removed after verifying that nothing used
it — not our source, not any `.cshtml`, and not `EPiServer.Forms` 5.9.1, whose
client JS contains no `datepicker` reference. See `MIGRATION-BACKLOG.md` item 21.

### CSS

Each site declares its own CSS entries. nursingworld compiles `screen`, `print`,
`editor` and `editor-fix`; CDC compiles `cdc`; OJIN `Ojin/css/ojin`; HNHN
`hnhn/css/hnhn` and `hnhn/css/search`. The CSNA landing page styles are not a separate entry —
they are imported by `_core.scss` into `screen.css` (backlog item 17). `screen.scss` is the main stylesheet;
`editor.scss` and `editor-fix.scss` are loaded only inside the Optimizely CMS
editing UI; `cdc.scss` builds the CDC theme from `src/sites/cdc/`.

All of them still use Sass `@import`, which Dart Sass 3.0 removes — see
`MIGRATION-BACKLOG.md` item 4.

---

## CI/CD

The frontend build is **not** part of the Azure Pipelines deployment. Both
`azure-pipelines.yml` and `azure-pipeline-poc-ade.yml` consist of one build step:

```yaml
- script: dotnet publish ./Sources/ANA.Site/ANA.Site.csproj --configuration "Release" --output $(publishPath)
```

No `NodeTool@0` task, no `npm install`, no `npm run build`, and no Node version
pinned. Compiled assets reach production only because `wwwroot/assets/` is
committed. Adding a real CI build step is the obvious improvement here, and is
the point at which the Node pin in `.nvmrc` / `engines` would start being
enforced rather than advisory.

See `MIGRATION-BACKLOG.md` for outstanding upgrade work including jQuery audit, Prettier integration, and TypeScript migration planning.