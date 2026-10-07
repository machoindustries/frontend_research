// ─── Preview runner ──────────────────────────────────────────────────────────
//
//   npm run preview:site -- ojin           dev server
//   npm run build:preview:site -- ojin     static build into preview-dist/ojin
//   npm run build:preview:site -- --all    every preview
//
// Two jobs. First, it replaces the pair of npm scripts each site used to need,
// which grew the manifest by two lines per property forever.
//
// Second, it owns the `cd`. The Handlebars plugin derives partial names with
// relative(root, dir) and then applies that relative string to absolute paths,
// which only resolves when process.cwd() equals the Vite root — so every preview
// must be run from its own directory. That constraint used to be encoded as a
// literal `cd src/templates/campaign/preview &&` in package.json, which is both
// a depth-encoded path and a thing each new site had to remember.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { SRC } from '../paths.mjs';

/**
 * Previews live at <src>/<group>/<site>/preview/vite.config.js. The group level
 * is matched with a wildcard so this keeps working across the templates/ → sites/
 * consolidation rather than needing an edit halfway through it.
 */
function discoverPreviews() {
    const found = new Map();

    for (const group of fs.readdirSync(SRC, { withFileTypes: true })) {
        if (!group.isDirectory()) continue;

        const groupDir = path.join(SRC, group.name);

        for (const site of fs.readdirSync(groupDir, { withFileTypes: true })) {
            if (!site.isDirectory()) continue;

            const previewDir = path.join(groupDir, site.name, 'preview');

            if (fs.existsSync(path.join(previewDir, 'vite.config.js'))) {
                found.set(site.name, previewDir);
            }
        }
    }

    return found;
}

function run(previewDir, build) {
    return new Promise((resolve, reject) => {
        const child = spawn('npx', ['vite', ...(build ? ['build'] : [])], {
            cwd: previewDir,
            stdio: 'inherit',
            shell: process.platform === 'win32',
        });

        child.on('error', reject);
        child.on('exit', (code) => (code === 0 ? resolve() : reject(
            new Error(`vite exited with code ${code} in ${previewDir}`)
        )));
    });
}

const args = process.argv.slice(2);
const build = args.includes('--build');
const all = args.includes('--all');
const names = args.filter((a) => !a.startsWith('--'));

const previews = discoverPreviews();
const available = [...previews.keys()].sort();

if (previews.size === 0) {
    console.error('No previews found. A preview is <site>/preview/vite.config.js.');
    process.exit(1);
}

let targets;

if (all) {
    if (!build) {
        console.error('--all only makes sense with a build; a dev server runs one site.');
        process.exit(1);
    }
    targets = available;
} else if (names.length === 1) {
    targets = names;
} else {
    console.error(
        `Usage: npm run ${build ? 'build:preview:site' : 'preview:site'} -- <site>\n` +
        `Available: ${available.join(', ')}`
    );
    process.exit(1);
}

const unknown = targets.filter((t) => !previews.has(t));

if (unknown.length) {
    console.error(`Unknown preview(s): ${unknown.join(', ')}\nAvailable: ${available.join(', ')}`);
    process.exit(1);
}

for (const name of targets) {
    if (all) console.log(`\n── ${name} ─────────────────────────────────────────`);
    await run(previews.get(name), build);
}
