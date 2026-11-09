#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate tags.json file for a photo gallery folder
 * Usage: node scripts/generate-tags-json.js <folder-path>
 * Example: node scripts/generate-tags-json.js ./src/gallery/photos/red-carpet/tiff
 */

function parseTagsFromFilename(filename) {
  const basename = path.parse(filename).name;
  const tags = [];
  
  // Look for tag patterns like _tag1-tag2 at the end of filename
  const tagMatch = basename.match(/_([^_]+)$/);
  if (tagMatch) {
    tags.push(...tagMatch[1].split('-'));
  }
  
  // Extract subject name (first part before _)
  const parts = basename.split('_');
  if (parts.length > 0) {
    const subject = parts[0].split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    tags.push(subject.toLowerCase());
  }
  
  // Extract event/location (middle parts)
  if (parts.length > 2) {
    const event = parts.slice(1, -1).join(' ').split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    tags.push(event.toLowerCase());
  } else if (parts.length === 2 && !/^\d{4}$/.test(parts[1])) {
    // If second part is not a year, it's an event
    const event = parts[1].split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    tags.push(event.toLowerCase());
  }
  
  // Extract year if present
  const yearMatch = basename.match(/_(\d{4})(?:_|$)/);
  if (yearMatch) {
    tags.push(yearMatch[1]);
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

function generateTagsJson(folderPath) {
  try {
    // Check if folder exists
    if (!fs.existsSync(folderPath)) {
      console.error(`Error: Folder ${folderPath} does not exist`);
      process.exit(1);
    }
    
    // Get all image files
    const files = fs.readdirSync(folderPath);
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|webp|gif)$/i.test(file)
    );
    
    if (imageFiles.length === 0) {
      console.log(`No image files found in ${folderPath}`);
      return;
    }
    
    // Generate tags for each image
    const tagsData = {};
    const folderName = path.basename(folderPath);
    
    imageFiles.forEach(file => {
      const tags = parseTagsFromFilename(file);
      // Add folder name as a tag
      tags.push(folderName);
      tagsData[file] = [...new Set(tags)]; // Remove duplicates
    });
    
    // Write tags.json file
    const tagsPath = path.join(folderPath, 'tags.json');
    fs.writeFileSync(tagsPath, JSON.stringify(tagsData, null, 2));
    
    console.log(`Generated ${tagsPath}`);
    console.log(`Processed ${imageFiles.length} images:`);
    
    // Show summary
    Object.entries(tagsData).forEach(([file, tags]) => {
      console.log(`  ${file}: [${tags.join(', ')}]`);
    });
    
  } catch (error) {
    console.error('Error generating tags.json:', error.message);
    process.exit(1);
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node scripts/generate-tags-json.js <folder-path>');
    console.log('Example: node scripts/generate-tags-json.js ./src/gallery/photos/red-carpet/tiff');
    console.log('Example: node scripts/generate-tags-json.js ./src/gallery/photos/portraits/actors-and-filmmakers');
    process.exit(1);
  }
  
  const folderPath = path.resolve(args[0]);
  generateTagsJson(folderPath);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateTagsJson, parseTagsFromFilename };
