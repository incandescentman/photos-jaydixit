#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Photo URLs from the live site
const photoUrls = [
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/dixit_nobel-physics-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/vanessa-kirby-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/Lisa_Gilroy_at_SXSW_in_2025-1-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/jay-dixit_red-carpet_01130-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/jeremy-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/jeremy-11-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/judd-apatow-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/jeremy-3-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/vinod-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/conan-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/jay-dixit_red-carpet_05923-1-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/jeremy-6-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/jeremy-4-scaled.jpg',
  'https://photos.jaydixit.com/wp-content/uploads/2025/07/vinod-4-scaled.jpg',
  'https://res.cloudinary.com/dszpm7yps/image/upload/highlights/2024-03-09_SXSW_Conan_Nick-Kroll_Office-Space_events_07141',
  'https://res.cloudinary.com/dszpm7yps/image/upload/highlights/2024-03-09_SXSW_Conan_Nick-Kroll_Office-Space_events_07162',
  'https://res.cloudinary.com/dszpm7yps/image/upload/highlights/2024-03-09_SXSW_Conan_Nick-Kroll_Office-Space_events_07310'
];

const filenameOverrides = {
  'Lisa_Gilroy_at_SXSW_in_2025-1.jpg': 'lisa-gilroy_sxsw_2025.jpg',
  'jay-dixit_red-carpet_05923-1.jpg': 'emma-stone_nyff.jpg'
};

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Delete the file async
      reject(err);
    });
  });
}

async function downloadLivePhotos() {
  const highlightsDir = path.join(process.cwd(), 'src/gallery/highlights');
  
  // Create highlights folder if it doesn't exist
  if (!fs.existsSync(highlightsDir)) {
    fs.mkdirSync(highlightsDir, { recursive: true });
  }
  
  console.log('\nDownloading photos from photos.jaydixit.com...');
  
  for (let i = 0; i < photoUrls.length; i++) {
    const url = photoUrls[i];
    const sourceFilename = path.basename(url).replace('-scaled', '');
    const filename = filenameOverrides[sourceFilename] ?? sourceFilename;
    const filepath = path.join(highlightsDir, filename);
    
    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`  ✓ ${filename} (already exists)`);
      continue;
    }
    
    try {
      await downloadImage(url, filepath);
      console.log(`  ✓ ${filename} (${i + 1}/${photoUrls.length})`);
      
      // Small delay to be nice to the server
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`  ✗ Failed to download ${filename}:`, error.message);
    }
  }
  
  console.log('\n✓ Live photos download complete!');
  console.log(`Photos saved to: ${highlightsDir}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  downloadLivePhotos().catch(console.error);
}
