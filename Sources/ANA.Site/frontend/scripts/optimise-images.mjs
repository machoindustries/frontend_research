// scripts/optimise-images.mjs
//
// Replaces grunt-contrib-imagemin (optimizationLevel: 7).
// Uses sharp — maintained, fast, no native binding issues on M2/ARM.
//
// Install: npm i -D sharp glob
//
// Optimises every image the build has emitted into wwwroot/assets, in place.
// Run via: npm run optimise:images — AFTER `npm run build`, since it rewrites
// build output rather than source.
//
// Scope note: this used to point at wwwroot/assets/img only, which is the shared
// flat namespace. Sites that own a namespace — /assets/Ojin/img, /assets/hnhn/img
// — were silently skipped, so OJIN's 40+ committed images had never been through
// it. It now walks the whole output tree.
//
// The path was also process.cwd()-relative, so it only worked when invoked from
// frontend/; it now comes from #paths like everything else.

import sharp from 'sharp';
import { glob } from 'glob';
import path from 'node:path';
import fs from 'node:fs/promises';

import { ASSETS } from '../paths.mjs';

const IMG_DIR = ASSETS;

const QUALITY = {
    jpeg: 80,   // grunt-imagemin level 7 ≈ ~80% quality in sharp terms
    png:  80,
    webp: 80,
};

async function optimise(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const stat = await fs.stat(filePath);
    const originalSize = stat.size;

    try {
        let pipeline = sharp(filePath);

        if (ext === '.jpg' || ext === '.jpeg') {
            pipeline = pipeline.jpeg({ quality: QUALITY.jpeg, mozjpeg: true });
        } else if (ext === '.png') {
            pipeline = pipeline.png({ quality: QUALITY.png, compressionLevel: 9 });
        } else if (ext === '.webp') {
            pipeline = pipeline.webp({ quality: QUALITY.webp });
        } else if (ext === '.gif') {
            // sharp doesn't process animated GIFs — skip, copy as-is
            console.log(`  SKIP  ${path.relative(IMG_DIR, filePath)} (gif)`);
            return;
        } else if (ext === '.svg') {
            // SVGs are already text — no raster optimisation needed
            console.log(`  SKIP  ${path.relative(IMG_DIR, filePath)} (svg)`);
            return;
        } else {
            console.log(`  SKIP  ${path.relative(IMG_DIR, filePath)} (unknown)`);
            return;
        }

        const buffer = await pipeline.toBuffer();
        const saving = originalSize - buffer.length;
        const pct = ((saving / originalSize) * 100).toFixed(1);

        if (saving > 0) {
            await fs.writeFile(filePath, buffer);
            console.log(`  OK    ${path.relative(IMG_DIR, filePath)}  -${pct}%`);
        } else {
            console.log(`  SKIP  ${path.relative(IMG_DIR, filePath)} (already optimal)`);
        }
    } catch (err) {
        console.error(`  ERR   ${path.relative(IMG_DIR, filePath)}`, err.message);
    }
}

async function run() {
    console.log(`\nOptimising images in ${IMG_DIR}\n`);

    const files = await glob(`${IMG_DIR}/**/*.{jpg,jpeg,png,gif,svg,webp}`, {
        absolute: true,
    });

    if (!files.length) {
        console.log('No images found. Run `npm run build` first.');
        process.exit(0);
    }

    console.log(`Found ${files.length} images...\n`);
    await Promise.all(files.map(optimise));
    console.log('\nDone.\n');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
