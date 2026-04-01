#!/usr/bin/env node

/**
 * Photo Upload CLI Tool
 * Complete pipeline for photo metadata management, Cloudinary upload, and Astro content generation
 * 
 * Based on cloudinary-setup.org specification
 */

import { Command } from 'commander';
import { v2 as cloudinary } from 'cloudinary';
import fg from 'fast-glob';
import { execa } from 'execa';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import ora from 'ora';
import pLimit from 'p-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Default configuration
const DEFAULT_CONFIG = {
  cloudinary: {
    cloud_name: process.env.PUBLIC_CLOUDINARY_CLOUD_NAME || 'dszpm7yps',
    upload_preset: 'event-photos',
    folder_prefix: 'photos'
  },
  content: {
    output_dir: 'src/content/albums',
    base_url: 'https://photos.jaydixit.com'
  },
  defaults: {
    credit: 'Jay Dixit',
    image_formats: ['jpg', 'jpeg', 'JPG', 'JPEG'],
    min_image_size: 100000,  // 100KB
    max_image_size: 50000000  // 50MB
  },
  metadata: {
    required_fields: ['caption', 'title'],
    embed_on_upload: true,
    tag_namespaces: {
      event: 'Event name',
      cat: 'Category',
      city: 'City location',
      year: 'Year taken'
    }
  },
  transformations: {
    gallery: 't_gallery',
    thumbnail: 't_thumb'
  }
};

/**
 * Load configuration from file or defaults
 */
async function loadConfig(configPath) {
  if (configPath && existsSync(configPath)) {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  }
  
  if (existsSync('.photoconfig.json')) {
    const content = await fs.readFile('.photoconfig.json', 'utf-8');
    return JSON.parse(content);
  }
  
  return DEFAULT_CONFIG;
}

/**
 * Extract EXIF/IPTC metadata using ExifTool
 */
async function extractMetadata(filepath) {
  try {
    const { stdout } = await execa('exiftool', ['-json', filepath]);
    const [data] = JSON.parse(stdout);
    
    return {
      // Core fields
      title: data['XMP-dc:Title'] || data['Title'] || data['IPTC:ObjectName'] || data['ObjectName'],
      caption:
        data['IPTC:Caption-Abstract'] ||
        data['Caption-Abstract'] ||
        data['XMP:Description'] ||
        data['XMP-dc:Description'] ||
        data['Description'] ||
        data['ImageDescription'],
      
      // Keywords → tags
      keywords: parseKeywords(
        data['XMP-dc:Subject'] || 
        data['Subject'] ||
        data['IPTC:Keywords'] || 
        data['Keywords'] ||
        []
      ),
      
      // Location
      city: data['IPTC:City'] || data['City'] || data['XMP-photoshop:City'],
      country: data['IPTC:Country-PrimaryLocationName'] || data['Country-PrimaryLocationName'] || data['XMP-photoshop:Country'],
      gps: parseGPS(data),
      
      // People & Credit
      people: parseArray(data['IPTC:PersonInImage'] || data['PersonInImage'] || data['XMP-iptcExt:PersonInImage']),
      credit: data['IPTC:By-line'] || data['By-line'] || data['XMP-dc:Creator'] || data['Artist'],
      
      // Technical
      dateTaken: data['EXIF:DateTimeOriginal'] || data['CreateDate'],
      camera: data['EXIF:Model'],
      lens: data['EXIF:LensModel']
    };
  } catch (error) {
    console.warn(chalk.yellow(`Could not extract metadata from ${filepath}`));
    return {};
  }
}

/**
 * Parse keywords from various formats
 */
function parseKeywords(keywords) {
  if (!keywords) return [];
  if (Array.isArray(keywords)) return keywords;
  return String(keywords).split(/[;,]/).map(s => s.trim()).filter(Boolean);
}

/**
 * Parse array fields
 */
function parseArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

/**
 * Parse GPS coordinates
 */
function parseGPS(data) {
  const lat = data['EXIF:GPSLatitude'] || data['GPSLatitude'];
  const lng = data['EXIF:GPSLongitude'] || data['GPSLongitude'];
  return lat && lng ? `${lat},${lng}` : null;
}

/**
 * Load tags.json from a directory
 */
async function loadTagsJson(dir) {
  const tagsPath = path.join(dir, 'tags.json');
  try {
    const content = await fs.readFile(tagsPath, 'utf-8');
    const parsed = JSON.parse(content);

    const isStructured =
      parsed.album ||
      parsed.defaults ||
      parsed.overrides ||
      parsed.captions ||
      parsed.highlights;

    if (isStructured) {
      return parsed;
    }

    const overrides = {};
    for (const [filename, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        overrides[filename] = { tags: value };
      } else if (typeof value === 'string') {
        overrides[filename] = { caption: value, title: value };
      }
    }

    return { overrides };
  } catch {
    return null;
  }
}

function getFileOverrides(tagsJson, filename) {
  const captionOverride = tagsJson?.captions?.[filename]
    ? { caption: tagsJson.captions[filename], title: tagsJson.captions[filename] }
    : {};
  const explicitOverrides = tagsJson?.overrides?.[filename] || {};
  const mergedOverrides = { ...captionOverride, ...explicitOverrides };
  return Object.keys(mergedOverrides).length > 0 ? mergedOverrides : null;
}

/**
 * Merge metadata with precedence rules
 */
function mergeMetadata(exif, folderDefaults, fileOverrides) {
  // 1. Start with EXIF as base
  const merged = { ...exif };
  
  // 2. Apply folder defaults (don't override existing)
  if (folderDefaults) {
    Object.keys(folderDefaults).forEach(key => {
      if (!merged[key] || (Array.isArray(merged[key]) && merged[key].length === 0)) {
        merged[key] = folderDefaults[key];
      }
    });
  }
  
  // 3. Apply file-specific overrides (always override)
  if (fileOverrides) {
    Object.assign(merged, fileOverrides);
    
    // Special handling for arrays (tags, people)
    if (fileOverrides.tags) {
      merged.tags = [...new Set([
        ...(merged.keywords || []),
        ...(folderDefaults?.tags || []),
        ...(fileOverrides.tags || [])
      ])];
    }
  }
  
  // Ensure tags from keywords
  if (!merged.tags && merged.keywords) {
    merged.tags = merged.keywords;
  }

  // If only one of title/caption is present, use it for both.
  if (!merged.title && merged.caption) {
    merged.title = merged.caption;
  }
  if (!merged.caption && merged.title) {
    merged.caption = merged.title;
  }
  
  return merged;
}

/**
 * Clean object - remove undefined/null values
 */
function cleanObject(obj) {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function truncateIptcObjectName(value) {
  if (!value) return undefined;
  return String(value).slice(0, 64);
}

function buildEmbeddedSubjects(metadata) {
  return [...new Set([
    ...(metadata.tags || []),
    ...parseArray(metadata.people),
    metadata.event
  ].filter(Boolean).map(value => String(value).trim()).filter(Boolean))];
}

async function stampEmbeddedMetadata(filepath, metadata) {
  const title = metadata.title || metadata.caption;
  const caption = metadata.caption || metadata.title;
  const subjects = buildEmbeddedSubjects(metadata);
  const args = ['-overwrite_original'];

  if (title) {
    args.push(`-XMP-dc:Title=${title}`);
    args.push(`-IPTC:ObjectName=${truncateIptcObjectName(title)}`);
  }

  if (caption) {
    args.push(`-XMP-dc:Description=${caption}`);
    args.push(`-IPTC:Caption-Abstract=${caption}`);
    args.push(`-EXIF:ImageDescription=${caption}`);
  }

  if (metadata.credit) {
    args.push(`-IPTC:By-line=${metadata.credit}`);
  }
  if (metadata.city) {
    args.push(`-IPTC:City=${metadata.city}`);
  }
  if (metadata.country) {
    args.push(`-IPTC:Country-PrimaryLocationName=${metadata.country}`);
  }

  if (subjects.length > 0) {
    args.push('-XMP-dc:Subject=');
    for (const subject of subjects) {
      args.push(`-XMP-dc:Subject+=${subject}`);
    }
  }

  args.push(filepath);
  await execa('exiftool', args);
}

/**
 * Generate public ID from filepath
 */
function generatePublicId(filepath, config, sourceDir) {
  const relativePath = path.relative(sourceDir, filepath);
  const withoutExt = relativePath.replace(/\.[^.]+$/, '');
  return withoutExt;
}

/**
 * Upload single photo to Cloudinary
 */
async function uploadPhoto(filepath, metadata, config, publicId) {
  const uploadParams = {
    folder: config.cloudinary.folder_prefix,
    public_id: publicId,
    use_filename: true,
    unique_filename: false,
    overwrite: true,
    resource_type: 'image',
    
    // Tags (deduplicated)
    tags: metadata.tags || [],
    
    // Context (only non-empty values)
    context: cleanObject({
      caption: metadata.caption,
      title: metadata.title,
      city: metadata.city,
      country: metadata.country,
      venue: metadata.venue,
      people: Array.isArray(metadata.people) ? metadata.people.join(', ') : metadata.people,
      credit: metadata.credit,
      event: metadata.event,
      gps: metadata.gps,
      date_taken: metadata.dateTaken
    }),
    
    // Extra data
    image_metadata: true,
    phash: true,
    colors: true
  };
  
  if (config.cloudinary.upload_preset) {
    uploadParams.upload_preset = config.cloudinary.upload_preset;
  }
  
  return cloudinary.uploader.upload(filepath, uploadParams);
}

/**
 * Validate metadata against requirements
 */
function validateMetadata(metadata, config) {
  const errors = [];
  
  // Check required fields
  if (config.metadata?.required_fields) {
    for (const field of config.metadata.required_fields) {
      if (!metadata[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }
  
  return errors;
}

/**
 * Generate Astro content file
 */
async function generateAlbumContent(photos, tagsJson, uploadResults, config) {
  const album = {
    ...tagsJson.album,
    photos: photos.map(photo => {
      const result = uploadResults[photo.filename];
      const metadata = photo.metadata;
      
      return {
        publicId: result.public_id,
        filename: photo.filename,
        alt: metadata.caption || metadata.title || prettifyFilename(photo.filename),
        title: metadata.title,
        caption: metadata.caption,
        
        // From Cloudinary
        width: result.width,
        height: result.height,
        format: result.format,
        
        // Metadata
        tags: metadata.tags,
        people: metadata.people,
        city: metadata.city,
        country: metadata.country,
        
        // Flags
        highlight: tagsJson.highlights?.includes(photo.filename),
        cover: tagsJson.highlights?.[0] === photo.filename
      };
    }),
    
    photoCount: photos.length,
    uploadedAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
  
  // Ensure output directory exists
  await fs.mkdir(config.content.output_dir, { recursive: true });
  
  // Write to Astro content directory
  const slug = tagsJson.album.slug.replace(/\//g, '-');
  const outputPath = path.join(config.content.output_dir, `${slug}.json`);
  
  await fs.writeFile(outputPath, JSON.stringify(album, null, 2));
  
  return { album, outputPath };
}

/**
 * Prettify filename for display
 */
function prettifyFilename(filename) {
  const nameWithoutExt = path.basename(filename, path.extname(filename));
  return nameWithoutExt
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Check if ExifTool is installed
 */
async function checkExifTool() {
  try {
    await execa('exiftool', ['-ver']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Main upload command
 */
async function uploadCommand(directory, options) {
  const spinner = ora('Loading configuration...').start();
  
  try {
    // Load configuration
    const config = await loadConfig(options.config);
    
    // Check ExifTool
    if (!(await checkExifTool())) {
      spinner.fail('ExifTool is not installed');
      console.error(chalk.red('\nPlease install ExifTool:'));
      console.log('  brew install exiftool');
      console.log('  Or download from: https://exiftool.org/');
      process.exit(1);
    }
    
    // Resolve directory
    const sourceDir = path.resolve(directory);
    
    // Check if directory exists
    if (!existsSync(sourceDir)) {
      spinner.fail(`Directory not found: ${sourceDir}`);
      process.exit(1);
    }
    
    spinner.text = 'Finding images...';
    
    // Find all image files
    const patterns = config.defaults.image_formats.flatMap(ext => [
      `${sourceDir}/**/*.${ext}`,
      `${sourceDir}/*.${ext}`
    ]);
    
    const files = await fg(patterns, { 
      dot: false,
      unique: true,
      onlyFiles: true 
    });
    
    if (files.length === 0) {
      spinner.fail('No images found');
      return;
    }
    
    spinner.succeed(`Found ${files.length} images`);
    
    // Group files by directory
    const filesByDir = {};
    for (const file of files) {
      const dir = path.dirname(file);
      if (!filesByDir[dir]) {
        filesByDir[dir] = { files: [], tagsJson: null };
      }
      filesByDir[dir].files.push(file);
    }
    
    // Load tags.json for each directory
    for (const dir of Object.keys(filesByDir)) {
      filesByDir[dir].tagsJson = await loadTagsJson(dir);
    }
    
    // Process uploads
    const limit = pLimit(3); // 3 concurrent uploads
    const uploadResults = {};
    const allPhotos = [];
    let successCount = 0;
    let failCount = 0;
    
    console.log(chalk.blue('\n📸 Processing photos...\n'));
    
    for (const [dir, { files: dirFiles, tagsJson }] of Object.entries(filesByDir)) {
      const relativeDir = path.relative(sourceDir, dir);
      console.log(chalk.cyan(`\n📁 ${relativeDir || 'root'}`));
      
      if (tagsJson) {
        console.log(chalk.gray(`   Found tags.json`));
      }
      
      for (const file of dirFiles) {
        const filename = path.basename(file);
        const fileSpinner = ora(`Processing ${filename}`).start();
        
        try {
          // Extract metadata
          const exifMetadata = await extractMetadata(file);
          
          // Get overrides from tags.json
          const fileOverrides = getFileOverrides(tagsJson, filename);
          const folderDefaults = tagsJson?.defaults;
          
          // Merge metadata
          const metadata = mergeMetadata(exifMetadata, folderDefaults, fileOverrides);
          
          // Check if excluded
          if (fileOverrides?.exclude) {
            fileSpinner.info(`Skipped ${filename} (excluded)`);
            continue;
          }
          
          // Validate metadata
          const errors = validateMetadata(metadata, config);
          if (errors.length > 0 && !options.force) {
            fileSpinner.warn(`Validation failed: ${errors.join(', ')}`);
            failCount++;
            continue;
          }

          if (!options.dryRun && options.embedMetadata && config.metadata?.embed_on_upload !== false) {
            await stampEmbeddedMetadata(file, metadata);
          }
          
          // Generate public ID
          const publicId = generatePublicId(file, config, sourceDir);
          
          // Upload to Cloudinary (unless dry-run)
          if (!options.dryRun && !options.noUpload) {
            const result = await limit(() => uploadPhoto(file, metadata, config, publicId));
            uploadResults[filename] = result;
            fileSpinner.succeed(`Uploaded ${filename}`);
            
            if (options.verbose) {
              console.log(chalk.gray(`   → ${result.public_id}`));
              if (metadata.tags?.length > 0) {
                console.log(chalk.gray(`   Tags: ${metadata.tags.join(', ')}`));
              }
            }
          } else {
            fileSpinner.info(`Would upload ${filename}`);
            uploadResults[filename] = { 
              public_id: publicId, 
              width: 1920, 
              height: 1080, 
              format: 'jpg' 
            };
          }
          
          // Store photo data
          allPhotos.push({
            filename,
            filepath: file,
            metadata,
            dir,
            tagsJson
          });
          
          successCount++;
        } catch (error) {
          fileSpinner.fail(`Failed: ${error.message}`);
          failCount++;
        }
      }
    }
    
    // Generate Astro content files
    if (!options.noContent && allPhotos.length > 0) {
      console.log(chalk.blue('\n📝 Generating Astro content...\n'));
      
      // Group photos by album (based on tags.json)
      const albumGroups = {};
      for (const photo of allPhotos) {
        if (photo.tagsJson?.album) {
          const albumKey = photo.tagsJson.album.slug || photo.dir;
          if (!albumGroups[albumKey]) {
            albumGroups[albumKey] = {
              tagsJson: photo.tagsJson,
              photos: []
            };
          }
          albumGroups[albumKey].photos.push(photo);
        }
      }
      
      // Generate content for each album
      for (const [albumKey, { tagsJson, photos }] of Object.entries(albumGroups)) {
        try {
          const { album, outputPath } = await generateAlbumContent(
            photos,
            tagsJson,
            uploadResults,
            config
          );
          console.log(chalk.green(`✓ Generated ${path.basename(outputPath)}`));
        } catch (error) {
          console.error(chalk.red(`✗ Failed to generate content: ${error.message}`));
        }
      }
    }
    
    // Summary
    console.log(chalk.blue('\n' + '='.repeat(60)));
    console.log(chalk.green(`✓ Success: ${successCount} photos`));
    if (failCount > 0) {
      console.log(chalk.red(`✗ Failed: ${failCount} photos`));
    }
    console.log(chalk.blue('='.repeat(60) + '\n'));
    
  } catch (error) {
    spinner.fail('Upload failed');
    console.error(chalk.red(error.message));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Validate command
 */
async function validateCommand(directory, options) {
  const config = await loadConfig(options.config);
  const sourceDir = path.resolve(directory);
  
  console.log(chalk.blue('🔍 Validating photos...\n'));
  
  // Find all image files
  const patterns = config.defaults.image_formats.flatMap(ext => [
    `${sourceDir}/**/*.${ext}`,
    `${sourceDir}/*.${ext}`
  ]);
  
  const files = await fg(patterns, { 
    dot: false,
    unique: true,
    onlyFiles: true 
  });
  
  let validCount = 0;
  let invalidCount = 0;
  const filesByDir = {};
  
  for (const file of files) {
    const dir = path.dirname(file);
    if (!filesByDir[dir]) {
      filesByDir[dir] = { files: [], tagsJson: null };
    }
    filesByDir[dir].files.push(file);
  }
  
  for (const dir of Object.keys(filesByDir)) {
    filesByDir[dir].tagsJson = await loadTagsJson(dir);
  }
  
  for (const [dir, { files: dirFiles, tagsJson }] of Object.entries(filesByDir)) {
    const folderDefaults = tagsJson?.defaults;
    
    for (const file of dirFiles) {
      const filename = path.basename(file);
      const exifMetadata = await extractMetadata(file);
      const fileOverrides = getFileOverrides(tagsJson, filename);
      const metadata = mergeMetadata(exifMetadata, folderDefaults, fileOverrides);
      const errors = validateMetadata(metadata, config);
      
      if (errors.length > 0) {
        console.log(chalk.red(`✗ ${filename}`));
        errors.forEach(error => {
          console.log(chalk.gray(`  ${error}`));
        });
        invalidCount++;
      } else {
        const sourceNote = tagsJson ? ' (merged EXIF + tags.json)' : '';
        console.log(chalk.green(`✓ ${filename}${sourceNote}`));
        validCount++;
      }
    }
  }
  
  console.log(chalk.blue('\n' + '='.repeat(60)));
  console.log(chalk.green(`✓ Valid: ${validCount} photos`));
  if (invalidCount > 0) {
    console.log(chalk.red(`✗ Invalid: ${invalidCount} photos`));
  }
  console.log(chalk.blue('='.repeat(60) + '\n'));
}

/**
 * Initialize configuration
 */
async function initCommand() {
  const configPath = '.photoconfig.json';
  
  if (existsSync(configPath)) {
    console.log(chalk.yellow('Configuration file already exists'));
    return;
  }
  
  await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  console.log(chalk.green(`✓ Created ${configPath}`));
  console.log(chalk.gray('Edit this file to customize your settings'));
}

// Create CLI
const program = new Command();

program
  .name('photo-cli')
  .description('Photography pipeline for Cloudinary upload and Astro content generation')
  .version('1.0.0');

program
  .command('upload <directory>')
  .description('Upload photos to Cloudinary, stamp merged metadata into files, and generate Astro content')
  .option('-c, --config <path>', 'configuration file path')
  .option('--no-content', 'skip Astro content generation')
  .option('--no-upload', 'generate content without uploading')
  .option('--no-embed-metadata', 'skip writing merged metadata back into the source files')
  .option('--dry-run', 'preview without making changes')
  .option('--force', 'ignore validation errors')
  .option('-v, --verbose', 'detailed logging')
  .action(uploadCommand);

program
  .command('validate <directory>')
  .description('Validate photo metadata completeness')
  .option('-c, --config <path>', 'configuration file path')
  .action(validateCommand);

program
  .command('init')
  .description('Create configuration file with defaults')
  .action(initCommand);

// Parse arguments
program.parse(process.argv);
