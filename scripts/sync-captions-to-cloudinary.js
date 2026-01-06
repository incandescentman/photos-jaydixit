#!/usr/bin/env node

/**
 * One-time sync of captions from homepage-images.js to Cloudinary metadata.
 *
 * This pushes captions to Cloudinary's contextual metadata (Title/Description)
 * for reference and searchability. The local homepage-images.js remains the
 * source of truth for the site.
 *
 * Usage: node scripts/sync-captions-to-cloudinary.js
 */

import { createRequire } from 'module';
import dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);

let cloudinary;
try {
  cloudinary = require('cloudinary').v2;
} catch (e) {
  console.error('Missing dependency: cloudinary. Install with: npm i cloudinary');
  process.exit(1);
}

// Configure from env
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else {
  console.error('Missing CLOUDINARY_URL environment variable');
  process.exit(1);
}

// Import the homepage images config
const { images } = await import('../src/data/homepage-images.js');

async function syncCaptions() {
  console.log(`Syncing ${images.length} image captions to Cloudinary...\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const img of images) {
    const filename = img.filename;
    const caption = img.caption;

    if (!caption) {
      console.log(`Skipped: ${filename} (no caption)`);
      skipped++;
      continue;
    }

    // Remove extension for Cloudinary public ID
    const publicId = `highlights/${filename.replace(/\.[^.]+$/, '')}`;

    try {
      await cloudinary.uploader.explicit(publicId, {
        type: 'upload',
        context: {
          caption: caption,
          alt: caption,
        },
      });
      console.log(`✓ ${filename}: "${caption}"`);
      success++;
    } catch (err) {
      console.error(`✗ ${filename}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}, Skipped: ${skipped}`);
}

syncCaptions().catch((e) => {
  console.error(e);
  process.exit(1);
});
