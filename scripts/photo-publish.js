#!/usr/bin/env node

/**
 * Agent-fronted publication planner and resumable executor.
 *
 * Planning is read-only. Execution requires an approved manifest plus the
 * literal confirmation token PUBLISH. It never commits, pushes, or deploys.
 */

import { Command } from 'commander';
import { v2 as cloudinary } from 'cloudinary';
import { execa } from 'execa';
import dotenv from 'dotenv';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { constants, createReadStream, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

dotenv.config({ quiet: true });

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_EXWALKER = '/Users/jay/Dropbox/github/exwalker/exwalker';
const DEFAULT_INVENTORY =
	'/Users/jay/Dropbox/roam/photography/20260823235900-celebrity-photograph-inventory.org';
const PUBLICATION_INVENTORY_SCRIPT = path.join(REPO_ROOT, 'scripts/publication-inventory.js');
const MANIFEST_VERSION = 1;
const PORTFOLIO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif']);
const QUALITY_VALUES = new Set(['unreviewed', 'reject', 'fine', 'great']);

function now() {
	return new Date().toISOString();
}

function collect(value, previous) {
	return [...previous, value];
}

function cleanObject(value) {
	return Object.fromEntries(
		Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''),
	);
}

function slugify(value) {
	return String(value || '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 100);
}

function normalizedGallery(value) {
	const gallery = String(value || '')
		.replace(/^\/+|\/+$/g, '')
		.split('/')
		.filter(Boolean)
		.map(slugify)
		.join('/');
	if (!gallery || gallery.includes('..')) {
		throw new Error('Gallery must be a non-empty relative slug such as red-carpet/tiff-2025');
	}
	return gallery;
}

async function sha256(file) {
	return new Promise((resolve, reject) => {
		const hash = createHash('sha256');
		const stream = createReadStream(file);
		stream.on('error', reject);
		stream.on('data', (chunk) => hash.update(chunk));
		stream.on('end', () => resolve(hash.digest('hex')));
	});
}

async function writeJsonAtomic(file, value) {
	const target = path.resolve(file);
	await fs.mkdir(path.dirname(target), { recursive: true });
	const temporary = `${target}.tmp`;
	await fs.writeFile(temporary, `${JSON.stringify(value, null, '\t')}\n`, 'utf8');
	await fs.rename(temporary, target);
	return target;
}

function normalizeDate(value) {
	if (!value) return null;
	const match = String(value).match(/(\d{4})[:/-](\d{2})[:/-](\d{2})/);
	return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function safeCommonsText(value) {
	return String(value || '')
		.replaceAll('|', '{{!}}')
		.trim();
}

function safeCommonsFilename(value, extension) {
	const base = String(value || '')
		.replace(/[<>[\]{}|#]/g, '')
		.replace(/[\r\n\t]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 210);
	return `${base}${extension.toLowerCase()}`;
}

function normalizeCommonsCategory(value) {
	return String(value || '')
		.replace(/^Category:/i, '')
		.trim();
}

function normalizeCommonsFilename(value) {
	return String(value || '')
		.replace(/^File:/i, '')
		.trim();
}

function buildCommonsDescription(photo) {
	const categories = photo.destinations.commons.categories
		.map((category) => `[[Category:${category}]]`)
		.join('\n');
	return `== {{int:filedesc}} ==
{{Information
|Description={{en|1=${safeCommonsText(photo.metadata.caption)}}}
|Source={{Own}}
|Author=[[User:Jaydixit|Jay Dixit]]
|Date=${photo.metadata.date || ''}
|Permission=
|other_versions=
}}

== {{int:license-header}} ==
${photo.destinations.commons.license}

${categories}
`;
}

function plannedSubjectSlug(metadata, review) {
	const people = (metadata.people || []).map(slugify).filter(Boolean);
	const unidentified = review.unidentified_people || [];
	if (people.length === 0) return 'unidentified-person';
	if (people.length === 1 && unidentified.length === 0) return people[0];
	const named = people.join('-and-');
	return unidentified.length > 0 ? `${named}-with-unidentified-person` : named;
}

function buildPlanRecord(record, options, digest) {
	const metadata = {
		...record.metadata,
		date: normalizeDate(record.capture_date),
		camera: record.camera || {},
	};
	const review = {
		approved: false,
		quality: 'unreviewed',
		favorite: false,
		identity_notes: [],
		unidentified_people: [],
		publication_notes: '',
	};
	const extension = path.extname(record.source).toLowerCase();
	const eventSlug = slugify(metadata.event || 'event');
	const year = metadata.date?.slice(0, 4) || 'undated';
	const subjectSlug = plannedSubjectSlug(metadata, review);
	const stem = `${subjectSlug}_${eventSlug}_${year}_${digest.slice(0, 8)}`;
	const portfolioFilename = `${stem}${extension}`;
	const titleForCommons = metadata.title || metadata.caption || subjectSlug.replaceAll('-', ' ');
	const commonsMode = options.commonsMode || 'new';
	const commonsFilename =
		commonsMode === 'new-version'
			? normalizeCommonsFilename(options.commonsExistingFilename)
			: safeCommonsFilename(
					`${titleForCommons} - photographed by Jay Dixit - ${digest.slice(0, 8)}`,
					extension,
				);
	const categories = [
		...new Set((options.commonsCategory || []).map(normalizeCommonsCategory).filter(Boolean)),
	];
	const commonsGalleryUrls = [...new Set(options.commonsGallery || [])];
	const issues = [...(record.missing_required || []).map((field) => `missing metadata: ${field}`)];

	if (!metadata.date) issues.push('missing or unreadable capture date');
	if (options.portfolio && !PORTFOLIO_EXTENSIONS.has(extension)) {
		issues.push(`portfolio does not ingest ${extension || 'extensionless'} files`);
	}
	if (options.commons && commonsMode === 'new' && categories.length === 0) {
		issues.push('Commons categories have not been supplied');
	}
	for (const url of commonsGalleryUrls) {
		if (!url.startsWith('https://commons.gallery/')) {
			issues.push(`unsupported Commons Gallery URL: ${url}`);
		}
	}

	const result = {
		source: record.source,
		relative_path: record.relative_path,
		asset_id: record.image_data_hash || digest,
		sha256: digest,
		file_size: record.file_size,
		metadata,
		review,
		issues,
		destinations: {
			portfolio: {
				enabled: options.portfolio,
				gallery: options.gallery,
				filename: portfolioFilename,
				path: path.join(REPO_ROOT, 'src/gallery/photos', options.gallery, portfolioFilename),
			},
			commons: {
				enabled: options.commons,
				mode: commonsMode,
				filename: commonsFilename,
				replacement_comment: options.commonsReplacementComment || '',
				categories,
				license: options.license,
				gallery_urls: commonsGalleryUrls,
			},
			cloudinary: {
				enabled: options.cloudinary === 'all',
				derive_public_id_from_portfolio: true,
				public_id: `photos/${options.gallery}/${stem}`,
			},
		},
		receipts: {},
	};
	result.destinations.commons.description = buildCommonsDescription(result);
	return result;
}

async function inspectWithExwalker(source, options) {
	const args = ['inspect', path.resolve(source), '--hash', '--required', options.required];
	if (options.nonRecursive) args.push('--non-recursive');
	const result = await execa(options.exwalker, args, { reject: false });
	let inventory;
	try {
		inventory = JSON.parse(result.stdout);
	} catch (error) {
		throw new Error(`Exwalker did not return valid JSON: ${error.message}`);
	}
	if (inventory.error) throw new Error(inventory.error);
	return inventory;
}

async function planCommand(source, options) {
	const gallery = normalizedGallery(options.gallery);
	const inventory = await inspectWithExwalker(source, options);
	const photos = [];
	for (const record of inventory.photos) {
		if (record.error) {
			photos.push({ ...record, issues: [record.error], review: { approved: false }, receipts: {} });
			continue;
		}
		const digest = record.sha256 || (await sha256(record.source));
		photos.push(buildPlanRecord(record, { ...options, gallery }, digest));
	}

	const manifest = {
		manifest_version: MANIFEST_VERSION,
		generated_at: now(),
		approved_at: null,
		approval_note: '',
		batch: {
			source_root: inventory.root,
			gallery,
			inventory_path: path.resolve(options.inventory),
			required_fields: inventory.required_fields,
			photo_count: photos.length,
			ready_count: photos.filter((photo) => photo.issues?.length === 0).length,
		},
		photos,
	};
	const output = await writeJsonAtomic(options.output, manifest);
	console.log(`Publication plan: ${output}`);
	console.log(`Ready without review: ${manifest.batch.ready_count}/${manifest.batch.photo_count}`);
	console.log(
		'No files were copied or uploaded. Every photograph still requires review.approved = true.',
	);
}

function isStructuredTags(value) {
	return Boolean(
		value &&
			['album', 'defaults', 'captions', 'overrides', 'highlights'].some((key) => key in value),
	);
}

function convertTagsFile(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return { overrides: {} };
	if (isStructuredTags(value)) return { ...value, overrides: { ...(value.overrides || {}) } };
	const overrides = {};
	for (const [filename, tags] of Object.entries(value)) {
		overrides[filename] = { tags: Array.isArray(tags) ? tags : [] };
	}
	return { overrides };
}

async function updateGalleryTags(photos) {
	const grouped = Map.groupBy(
		photos.filter((photo) => photo.destinations.portfolio.enabled),
		(photo) => photo.destinations.portfolio.gallery,
	);
	for (const [gallery, galleryPhotos] of grouped) {
		const galleryDir = path.join(REPO_ROOT, 'src/gallery/photos', gallery);
		const tagsPath = path.join(galleryDir, 'tags.json');
		let current = null;
		if (existsSync(tagsPath)) current = JSON.parse(await fs.readFile(tagsPath, 'utf8'));
		const tags = convertTagsFile(current);
		for (const photo of galleryPhotos) {
			const filename = photo.destinations.portfolio.filename;
			tags.overrides[filename] = {
				title: photo.metadata.title,
				caption: photo.metadata.caption,
				tags: photo.metadata.keywords || [],
				people: photo.metadata.people || [],
			};
		}
		await writeJsonAtomic(tagsPath, tags);
	}
}

async function updatePeopleIndex(photos) {
	const peoplePath = path.join(REPO_ROOT, 'src/data/people.json');
	const people = JSON.parse(await fs.readFile(peoplePath, 'utf8'));
	let changed = false;

	for (const photo of photos.filter((item) => item.destinations.portfolio.enabled)) {
		const namedPeople = photo.metadata.people || [];
		const isGroup = namedPeople.length > 1 || (photo.review.unidentified_people || []).length > 0;
		const photoSlug = path.basename(
			photo.destinations.portfolio.filename,
			path.extname(photo.destinations.portfolio.filename),
		);

		for (const name of namedPeople) {
			const slug = slugify(name);
			let person = people.find(
				(candidate) =>
					candidate.slug === slug || candidate.name.toLowerCase() === name.toLowerCase(),
			);
			if (!person) {
				person = { slug, name, match: [slug] };
				people.push(person);
				changed = true;
			}

			if (isGroup) {
				person.photoSlugs ||= [];
				if (!person.photoSlugs.includes(photoSlug)) {
					person.photoSlugs.push(photoSlug);
					changed = true;
				}
				person.indexExcludedPhotoSlugs ||= [];
				if (!person.indexExcludedPhotoSlugs.includes(photoSlug)) {
					person.indexExcludedPhotoSlugs.push(photoSlug);
					changed = true;
				}
			}
		}
	}

	if (changed) {
		people.sort((a, b) => a.name.localeCompare(b.name));
		await writeJsonAtomic(peoplePath, people);
	}
}

function orgSafe(value) {
	return String(value ?? '')
		.replace(/[\r\n]+/g, ' ')
		.replaceAll(']]', '] ]')
		.trim();
}

function orgLink(file) {
	return `[[file+emacs:${file}][📄 ${orgSafe(path.basename(file))}]]`;
}

function inventoryEntry(photo, inventoryId) {
	const assetId = photo.asset_id || photo.sha256;
	const title = orgSafe(
		photo.metadata.title || photo.metadata.caption || path.basename(photo.source),
	);
	const destinations = [];
	if (photo.receipts.portfolio) {
		destinations.push(`Portfolio local: ${orgLink(photo.receipts.portfolio.path)}`);
	}
	if (photo.receipts.commons?.page_url) {
		destinations.push(
			`Wikimedia Commons: [[${photo.receipts.commons.page_url}][Commons file page]]`,
		);
	}
	if (photo.receipts.cloudinary?.secure_url) {
		destinations.push(
			`Cloudinary: [[${photo.receipts.cloudinary.secure_url}][${orgSafe(photo.receipts.cloudinary.public_id)}]]`,
		);
	}
	for (const receipt of photo.receipts.commons_gallery || []) {
		destinations.push(`Commons Gallery pending: [[${receipt.url}][${receipt.url}]]`);
	}

	const unidentified = (photo.review.unidentified_people || [])
		.map((person) =>
			typeof person === 'string' ? person : person.description || JSON.stringify(person),
		)
		.map(orgSafe)
		.filter(Boolean);
	const notes = [...(photo.review.identity_notes || []), photo.review.publication_notes]
		.map(orgSafe)
		.filter(Boolean);

	const location = [photo.metadata.city, photo.metadata.state, photo.metadata.country]
		.map(orgSafe)
		.filter(Boolean)
		.join(', ');
	const camera = Object.entries(photo.metadata.camera || {})
		.map(([key, value]) => `${orgSafe(key)}: ${orgSafe(value)}`)
		.join('; ');

	return `# BEGIN EXWALKER PHOTO ${assetId}
** ${title}
:PROPERTIES:
:ID: ${inventoryId}
:PHOTO_ASSET_ID: ${assetId}
:SOURCE_SHA256: ${photo.sha256}
:QUALITY: ${photo.review.quality}
:FAVORITE: ${photo.review.favorite ? 'yes' : 'no'}
:CAPTURE_DATE: ${photo.metadata.date || ''}
:EVENT: ${orgSafe(photo.metadata.event)}
:SOURCE_PATH: ${photo.source}
:END:
- People :: ${(photo.metadata.people || []).map(orgSafe).join(', ') || 'Unidentified'}
- Unidentified people :: ${unidentified.join('; ') || 'None'}
- Caption :: ${orgSafe(photo.metadata.caption)}
- Keywords :: ${(photo.metadata.keywords || []).map(orgSafe).join(', ')}
- Location :: ${location || 'Not recorded'}
- Camera :: ${camera || 'Not recorded'}
- Source :: ${orgLink(photo.source)}
- Publication :: ${destinations.join('; ') || 'Not published'}
- Notes :: ${notes.join('; ')}
# END EXWALKER PHOTO ${assetId}
`;
}

async function updateOrgInventory(manifest) {
	const inventoryPath = manifest.batch.inventory_path;
	let content = await fs.readFile(inventoryPath, 'utf8');
	for (const photo of manifest.photos) {
		if (photo.review.quality === 'unreviewed') continue;
		const assetId = photo.asset_id || photo.sha256;
		const start = `# BEGIN EXWALKER PHOTO ${assetId}`;
		const end = `# END EXWALKER PHOTO ${assetId}`;
		const startIndex = content.indexOf(start);
		let inventoryId = photo.inventory_id;
		if (startIndex >= 0) {
			const currentEndIndex = content.indexOf(end, startIndex);
			if (currentEndIndex < 0)
				throw new Error(`Inventory entry is missing its end marker: ${photo.sha256}`);
			const currentEntry = content.slice(startIndex, currentEndIndex + end.length);
			inventoryId ||= currentEntry.match(/^:ID:\s+(.+)$/m)?.[1]?.trim();
		}
		inventoryId ||= randomUUID();
		photo.inventory_id = inventoryId;
		const entry = inventoryEntry(photo, inventoryId);
		if (startIndex >= 0) {
			const endIndex = content.indexOf(end, startIndex);
			content = `${content.slice(0, startIndex)}${entry}${content.slice(endIndex + end.length).replace(/^\n?/, '\n')}`;
		} else if (
			!content.includes(`:PHOTO_ASSET_ID: ${assetId}`) &&
			!content.includes(`:PHOTO_SHA256: ${photo.sha256}`)
		) {
			if (!content.endsWith('\n')) content += '\n';
			content += `\n${entry}`;
		}
	}
	const temporary = `${inventoryPath}.tmp`;
	await fs.writeFile(temporary, content, 'utf8');
	await fs.rename(temporary, inventoryPath);
}

async function ensurePortfolioCopies(photos) {
	for (const photo of photos.filter((item) => item.destinations.portfolio.enabled)) {
		const destination = photo.destinations.portfolio.path;
		await fs.mkdir(path.dirname(destination), { recursive: true });
		if (existsSync(destination)) {
			const existingHash = await sha256(destination);
			if (existingHash !== photo.sha256) {
				throw new Error(
					`Portfolio destination already exists with different contents: ${destination}`,
				);
			}
			photo.receipts.portfolio = {
				status: 'verified-existing',
				path: destination,
				verified_at: now(),
			};
			continue;
		}
		await fs.copyFile(photo.source, destination, constants.COPYFILE_EXCL);
		const copiedHash = await sha256(destination);
		if (copiedHash !== photo.sha256)
			throw new Error(`Copied file failed checksum verification: ${destination}`);
		photo.receipts.portfolio = { status: 'copied', path: destination, verified_at: now() };
	}
	await updateGalleryTags(photos);
	await updatePeopleIndex(photos);
}

async function queryCommons(filename) {
	const url = new URL('https://commons.wikimedia.org/w/api.php');
	url.search = new URLSearchParams({
		action: 'query',
		format: 'json',
		formatversion: '2',
		prop: 'imageinfo',
		iiprop: 'url|sha1|timestamp|size|user',
		titles: `File:${filename}`,
	}).toString();
	const response = await fetch(url, {
		headers: { 'User-Agent': 'exwalker-photo-publisher/1.0 (Jay Dixit)' },
	});
	if (!response.ok) throw new Error(`Commons verification returned HTTP ${response.status}`);
	const payload = await response.json();
	const page = payload.query?.pages?.[0];
	if (!page || page.missing) return null;
	const imageInfo = page.imageinfo?.[0] || {};
	return {
		title: page.title,
		page_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)
			.replace('%3A', ':')
			.replaceAll('%20', '_')}`,
		image_url: imageInfo.url || null,
		sha1: imageInfo.sha1 || null,
		timestamp: imageInfo.timestamp || null,
		width: imageInfo.width || null,
		height: imageInfo.height || null,
		user: imageInfo.user || null,
	};
}

async function uploadToCommons(photo) {
	const commons = photo.destinations.commons;
	const mode = commons.mode || 'new';
	const existing = await queryCommons(commons.filename);
	if (mode === 'new' && existing) {
		return { status: 'verified-existing', ...existing, verified_at: now() };
	}
	if (mode === 'new-version' && !existing) {
		throw new Error(`Commons replacement target does not exist: ${commons.filename}`);
	}

	if (mode === 'new-version') {
		const args = [
			path.join(REPO_ROOT, 'scripts/commons-upload.py'),
			photo.source,
			'--filename',
			commons.filename,
			'--mode',
			'new-version',
			'--replacement-comment',
			commons.replacement_comment,
		];
		const result = await execa('pwb', args, {
			cwd: REPO_ROOT,
			reject: false,
			stdin: 'ignore',
			timeout: 60_000,
		});
		if (result.exitCode !== 0) {
			throw new Error(result.stderr.trim() || result.stdout.trim() || 'Pywikibot upload failed');
		}

		const verified = await queryCommons(commons.filename);
		if (!verified) {
			throw new Error(`Commons replacement could not be verified: ${commons.filename}`);
		}
		if (verified.sha1 === existing.sha1) {
			throw new Error(`Commons replacement did not create a new revision: ${commons.filename}`);
		}
		return {
			status: 'replaced-with-new-version',
			previous: existing,
			...verified,
			verified_at: now(),
		};
	}

	const descPath = path.join(
		os.tmpdir(),
		`exwalker-commons-${process.pid}-${photo.sha256.slice(0, 12)}.txt`,
	);
	await fs.writeFile(descPath, commons.description, 'utf8');
	try {
		const args = [
			path.join(REPO_ROOT, 'scripts/commons-upload.py'),
			photo.source,
			'--filename',
			commons.filename,
			'--description-file',
			descPath,
		];
		const result = await execa('pwb', args, {
			cwd: REPO_ROOT,
			reject: false,
			stdin: 'ignore',
			timeout: 60_000,
		});
		if (result.exitCode !== 0) {
			throw new Error(result.stderr.trim() || result.stdout.trim() || 'Pywikibot upload failed');
		}
	} finally {
		await fs.unlink(descPath).catch(() => {});
	}

	const verified = await queryCommons(commons.filename);
	if (!verified) throw new Error(`Commons upload could not be verified: ${commons.filename}`);
	return { status: 'uploaded', ...verified, verified_at: now() };
}

function configureCloudinary() {
	cloudinary.config(true);
	cloudinary.config({ secure: true });
	const config = cloudinary.config();
	if (!config.cloud_name || !config.api_key || !config.api_secret) {
		throw new Error('Cloudinary credentials are not configured');
	}
}

async function verifyCommonsCategories(manifest) {
	const categories = [
		...new Set(
			manifest.photos
				.filter(
					(photo) =>
						photo.destinations.commons.enabled &&
						(photo.destinations.commons.mode || 'new') === 'new',
				)
				.flatMap((photo) => photo.destinations.commons.categories),
		),
	];
	if (categories.length === 0) return;

	const url = new URL('https://commons.wikimedia.org/w/api.php');
	url.search = new URLSearchParams({
		action: 'query',
		format: 'json',
		formatversion: '2',
		redirects: '1',
		titles: categories.map((category) => `Category:${category}`).join('|'),
	}).toString();
	const response = await fetch(url, {
		headers: { 'User-Agent': 'exwalker-photo-publisher/1.0 (Jay Dixit)' },
	});
	if (!response.ok)
		throw new Error(`Commons category verification returned HTTP ${response.status}`);
	const payload = await response.json();
	const missing = (payload.query?.pages || [])
		.filter((page) => page.missing)
		.map((page) => page.title);
	if (missing.length > 0) throw new Error(`Commons categories do not exist: ${missing.join(', ')}`);
}

async function uploadToCloudinary(photo) {
	configureCloudinary();
	const publicId = photo.destinations.cloudinary.public_id;
	const existing = await cloudinary.api.resource(publicId, { type: 'upload' }).catch((error) => {
		if (error?.error?.http_code === 404 || error?.http_code === 404) return null;
		throw error;
	});
	if (existing) {
		return {
			status: 'verified-existing',
			public_id: existing.public_id,
			secure_url: existing.secure_url,
			verified_at: now(),
		};
	}

	const result = await cloudinary.uploader.upload(photo.source, {
		public_id: publicId,
		unique_filename: false,
		overwrite: false,
		resource_type: 'image',
		tags: photo.metadata.keywords || [],
		context: cleanObject({
			title: photo.metadata.title,
			caption: photo.metadata.caption,
			people: (photo.metadata.people || []).join(', '),
			event: photo.metadata.event,
			date_taken: photo.metadata.date,
			credit: photo.metadata.credit || 'Jay Dixit',
		}),
		image_metadata: true,
	});
	return {
		status: 'uploaded',
		public_id: result.public_id,
		secure_url: result.secure_url,
		verified_at: now(),
	};
}

function validateExecutionManifest(manifest) {
	if (manifest.manifest_version !== MANIFEST_VERSION) {
		throw new Error(`Unsupported manifest version: ${manifest.manifest_version}`);
	}
	if (!manifest.approved_at) throw new Error('Manifest approved_at is empty');
	for (const photo of manifest.photos) {
		if (!photo.review?.approved) throw new Error(`Photograph is not approved: ${photo.source}`);
		if (!QUALITY_VALUES.has(photo.review.quality)) {
			throw new Error(`Unknown quality value for ${photo.source}: ${photo.review.quality}`);
		}
		if (typeof photo.review.favorite !== 'boolean') {
			throw new Error(`Favorite must be true or false: ${photo.source}`);
		}
		const hasDestination = Object.values(photo.destinations).some(
			(destination) => destination.enabled,
		);
		if (photo.review.quality === 'unreviewed') {
			throw new Error(`Photograph quality is still unreviewed: ${photo.source}`);
		}
		if (photo.review.favorite && photo.review.quality !== 'great') {
			throw new Error(`Only a great photograph can also be a favorite: ${photo.source}`);
		}
		if (photo.review.quality === 'reject' && hasDestination) {
			throw new Error(`Rejected photograph still has a publication destination: ${photo.source}`);
		}
		if (photo.review.quality === 'reject') continue;
		if (photo.issues?.length)
			throw new Error(`Photograph still has issues: ${photo.source}: ${photo.issues.join('; ')}`);
		const commons = photo.destinations.commons;
		if (commons.enabled) {
			const mode = commons.mode || 'new';
			if (!['new', 'new-version'].includes(mode)) {
				throw new Error(`Unknown Commons mode for ${photo.source}: ${mode}`);
			}
			if (!commons.filename || path.basename(commons.filename) !== commons.filename) {
				throw new Error(`Commons filename is missing or contains a path: ${photo.source}`);
			}
			if (mode === 'new' && commons.categories.length === 0) {
				throw new Error(`Commons categories are missing: ${photo.source}`);
			}
			if (mode === 'new-version' && !commons.replacement_comment?.trim()) {
				throw new Error(`Commons replacement comment is missing: ${photo.source}`);
			}
		}
		if (!photo.destinations.commons.enabled && photo.destinations.commons.gallery_urls.length > 0) {
			throw new Error(`Commons Gallery requires a Commons upload destination: ${photo.source}`);
		}
	}
}

function refreshDerivedDestinations(manifest) {
	for (const photo of manifest.photos) {
		const portfolio = photo.destinations.portfolio;
		if (portfolio?.gallery) {
			portfolio.gallery = normalizedGallery(portfolio.gallery);
			if (path.basename(portfolio.filename) !== portfolio.filename) {
				throw new Error(`Portfolio filename must not contain a directory: ${portfolio.filename}`);
			}
			portfolio.path = path.join(
				REPO_ROOT,
				'src/gallery/photos',
				portfolio.gallery,
				portfolio.filename,
			);
		}

		const cloudinaryDestination = photo.destinations.cloudinary;
		if (cloudinaryDestination?.derive_public_id_from_portfolio) {
			if (!portfolio?.gallery || !portfolio?.filename) {
				throw new Error(
					`Cloudinary public ID cannot be derived without a portfolio destination: ${photo.source}`,
				);
			}
			cloudinaryDestination.public_id = `photos/${portfolio.gallery}/${path.parse(portfolio.filename).name}`;
		}
	}
}

async function localImageInfo(source) {
	const result = await execa('exiftool', ['-json', '-ImageWidth', '-ImageHeight', source], {
		reject: false,
	});
	if (result.exitCode !== 0) {
		throw new Error(result.stderr.trim() || `Could not inspect image dimensions: ${source}`);
	}
	const info = JSON.parse(result.stdout)?.[0] || {};
	return {
		width: info.ImageWidth || null,
		height: info.ImageHeight || null,
	};
}

async function previewCommand(manifestPath) {
	const resolvedManifest = path.resolve(manifestPath);
	const manifest = JSON.parse(await fs.readFile(resolvedManifest, 'utf8'));
	refreshDerivedDestinations(manifest);
	const previews = [];

	for (const photo of manifest.photos) {
		const currentHash = await sha256(photo.source);
		if (currentHash !== photo.sha256) {
			throw new Error(`Source changed after planning: ${photo.source}`);
		}
		const commons = photo.destinations.commons;
		const remote = commons.enabled ? await queryCommons(commons.filename) : null;
		if (commons.enabled && (commons.mode || 'new') === 'new-version' && !remote) {
			throw new Error(`Commons replacement target does not exist: ${commons.filename}`);
		}
		previews.push({
			source: photo.source,
			asset_id: photo.asset_id,
			source_sha256: currentHash,
			local_image: await localImageInfo(photo.source),
			review: photo.review,
			destinations: {
				portfolio: photo.destinations.portfolio,
				cloudinary: photo.destinations.cloudinary,
				commons: commons.enabled
					? {
							mode: commons.mode || 'new',
							filename: commons.filename,
							replacement_comment: commons.replacement_comment || '',
							current_revision: remote,
						}
					: { enabled: false },
			},
		});
	}

	console.log(
		JSON.stringify(
			{
				manifest: resolvedManifest,
				approved_at: manifest.approved_at,
				approval_note: manifest.approval_note,
				photos: previews,
				execution_gate: 'execute requires the literal --confirm PUBLISH token',
			},
			null,
			2,
		),
	);
}

async function executeCommand(manifestPath, options) {
	if (options.confirm !== 'PUBLISH') {
		throw new Error(
			'Execution requires --confirm PUBLISH after the publication preview is approved',
		);
	}
	const resolvedManifest = path.resolve(manifestPath);
	const manifest = JSON.parse(await fs.readFile(resolvedManifest, 'utf8'));
	refreshDerivedDestinations(manifest);
	validateExecutionManifest(manifest);

	for (const photo of manifest.photos) {
		const currentHash = await sha256(photo.source);
		if (currentHash !== photo.sha256)
			throw new Error(`Source changed after planning: ${photo.source}`);
	}
	await verifyCommonsCategories(manifest);
	if (manifest.photos.some((photo) => photo.destinations.cloudinary.enabled)) configureCloudinary();

	await ensurePortfolioCopies(manifest.photos);
	await updateOrgInventory(manifest);
	await writeJsonAtomic(resolvedManifest, manifest);

	for (const photo of manifest.photos) {
		if (photo.destinations.commons.enabled && !photo.receipts.commons?.verified_at) {
			photo.destinations.commons.description = buildCommonsDescription(photo);
			photo.receipts.commons = await uploadToCommons(photo);
			await writeJsonAtomic(resolvedManifest, manifest);
			await updateOrgInventory(manifest);
		}
		if (photo.destinations.cloudinary.enabled && !photo.receipts.cloudinary?.verified_at) {
			photo.receipts.cloudinary = await uploadToCloudinary(photo);
			await writeJsonAtomic(resolvedManifest, manifest);
			await updateOrgInventory(manifest);
		}
		if (photo.destinations.commons.gallery_urls.length > 0) {
			photo.receipts.commons_gallery = photo.destinations.commons.gallery_urls.map((url) => ({
				url,
				commons_filename: photo.destinations.commons.filename,
				status: 'pending-agent-browser-add',
			}));
			await writeJsonAtomic(resolvedManifest, manifest);
			await updateOrgInventory(manifest);
		}
	}

	manifest.completed_at = now();
	await updateOrgInventory(manifest);
	await writeJsonAtomic(resolvedManifest, manifest);
	const inventoryCommand = manifest.photos.some((photo) => photo.destinations.commons.enabled)
		? 'sync'
		: 'sync-site';
	await execa('node', [PUBLICATION_INVENTORY_SCRIPT, inventoryCommand], {
		cwd: REPO_ROOT,
		stdio: 'inherit',
	});
	console.log(`Publication execution complete: ${resolvedManifest}`);
	console.log('Portfolio changes are local only. Nothing was committed, pushed, or deployed.');
	if (manifest.photos.some((photo) => photo.destinations.commons.gallery_urls.length > 0)) {
		console.log(
			'Commons Gallery additions remain for the agent to complete in the authenticated browser.',
		);
	}
}

const program = new Command();
program
	.name('photo-publish')
	.description('Plan and execute reviewed publication from Exwalker metadata');

program
	.command('plan <source>')
	.description('Create a read-only publication manifest from a Lightroom export')
	.requiredOption('--gallery <slug>', 'portfolio gallery destination')
	.requiredOption('--output <path>', 'manifest output path')
	.option('--inventory <path>', 'Org photograph inventory', DEFAULT_INVENTORY)
	.option('--exwalker <path>', 'Exwalker executable', DEFAULT_EXWALKER)
	.option(
		'--required <fields>',
		'required embedded metadata',
		'title,caption,keywords,people,event',
	)
	.option(
		'--commons-category <category>',
		'approved Wikimedia Commons category; repeat for more than one',
		collect,
		[],
	)
	.option(
		'--commons-gallery <url>',
		'Commons Gallery album URL; repeat for more than one',
		collect,
		[],
	)
	.option('--commons-mode <mode>', 'Commons upload mode: new or new-version', 'new')
	.option('--commons-existing-filename <filename>', 'exact existing Commons filename to replace')
	.option('--commons-replacement-comment <comment>', 'Commons new-version upload comment')
	.option('--license <template>', 'Commons license template', '{{self|cc-by-sa-4.0}}')
	.option('--cloudinary <mode>', 'Cloudinary destination: none or all', 'all')
	.option('--no-portfolio', 'do not plan a local portfolio copy')
	.option('--no-commons', 'do not plan a Wikimedia Commons upload')
	.option('--non-recursive', 'inspect only the named directory')
	.action(async (source, options) => {
		if (!['none', 'all'].includes(options.cloudinary))
			throw new Error('--cloudinary must be none or all');
		if (!['new', 'new-version'].includes(options.commonsMode)) {
			throw new Error('--commons-mode must be new or new-version');
		}
		if (options.commons && options.commonsMode === 'new-version') {
			if (!options.commonsExistingFilename) {
				throw new Error('--commons-existing-filename is required for new-version mode');
			}
			if (!options.commonsReplacementComment) {
				throw new Error('--commons-replacement-comment is required for new-version mode');
			}
		}
		await planCommand(source, options);
	});

program
	.command('preview <manifest>')
	.description('Verify sources and live destinations without copying or uploading')
	.action(previewCommand);

program
	.command('execute <manifest>')
	.description('Execute an approved manifest and persist resumable receipts')
	.requiredOption('--confirm <token>', 'must be the literal token PUBLISH')
	.action(executeCommand);

program.parseAsync(process.argv).catch((error) => {
	console.error(`Error: ${error.message}`);
	process.exitCode = 1;
});
