import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const EXTENSION_PRIORITY = ['jpg', 'jpeg', 'webp', 'png', 'gif'];
const SUPPORTED_EXTENSIONS = new Set(EXTENSION_PRIORITY);

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

async function sha256File(file) {
	return sha256(await fs.readFile(file));
}

async function walkFiles(root) {
	const files = [];
	async function visit(directory) {
		for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
			const fullPath = path.join(directory, entry.name);
			if (entry.isDirectory()) await visit(fullPath);
			else if (entry.isFile()) files.push(fullPath);
		}
	}
	try {
		await visit(root);
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
	return files;
}

function extensionRank(file) {
	const extension = path.extname(file).slice(1).toLowerCase();
	const rank = EXTENSION_PRIORITY.indexOf(extension);
	return rank === -1 ? EXTENSION_PRIORITY.length : rank;
}

function canonicalImages(files, root) {
	const groups = new Map();
	for (const file of files) {
		const extension = path.extname(file).slice(1).toLowerCase();
		if (!SUPPORTED_EXTENSIONS.has(extension)) continue;
		const relative = path.relative(root, file).split(path.sep).join('/');
		const key = relative.replace(/\.[^/.]+$/, '').toLowerCase();
		const variants = groups.get(key) || [];
		variants.push({ file, relative });
		groups.set(key, variants);
	}
	return [...groups.values()].map(
		(variants) =>
			variants.sort((left, right) => {
				const rank = extensionRank(left.file) - extensionRank(right.file);
				return rank || left.relative.localeCompare(right.relative);
			})[0],
	);
}

function stringList(value) {
	return Array.isArray(value)
		? value
				.filter((item) => typeof item === 'string')
				.map((item) => item.trim())
				.filter(Boolean)
		: [];
}

function formatWord(word) {
	const normalized = word.toLowerCase();
	const acronymMap = {
		sxsw: 'SXSW',
		tiff: 'TIFF',
		nyff: 'NYFF',
		ucb: 'UCB',
		wikiportraits: 'WikiPortraits',
	};
	return acronymMap[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatPhrase(value) {
	return value
		.split(/[\s-]+/)
		.filter(Boolean)
		.map(formatWord)
		.join(' ');
}

function galleryMetadata(tagsFile, filename) {
	if (!tagsFile) return { caption: undefined, tags: [], people: [] };
	const structuredKeys = new Set(['album', 'defaults', 'captions', 'overrides', 'highlights']);
	const structured = Object.keys(tagsFile).some((key) => structuredKeys.has(key));
	if (!structured) return { caption: undefined, tags: stringList(tagsFile[filename]), people: [] };
	const defaults = tagsFile.defaults || {};
	const override = tagsFile.overrides?.[filename] || {};
	return {
		caption: override.caption ?? tagsFile.captions?.[filename] ?? override.title,
		tags: [
			...new Set([
				...stringList(defaults.tags),
				...stringList(defaults.keywords),
				...stringList(override.tags),
				...stringList(override.keywords),
				...stringList(override.people),
			]),
		],
		people: stringList(override.people),
	};
}

function filenameCaption(filename, subjectName) {
	const baseName = filename.replace(/\.[^/.]+$/, '');
	const parts = baseName.split('_');
	let subject = subjectName || formatPhrase(parts[0] || '');
	let event = '';
	let year = '';
	if (parts.length > 1) {
		const lastPart = parts.at(-1);
		if (/^\d{4}$/.test(lastPart)) {
			year = lastPart;
			if (parts.length > 2) event = formatPhrase(parts.slice(1, -1).join(' '));
		} else event = formatPhrase(parts.slice(1).join(' '));
	}
	let caption = subject;
	if (event) caption += ` at ${event}`;
	if (year) caption += ` in ${year}`;
	return caption || baseName.replace(/[-_]/g, ' ');
}

function matchesPerson(filename, person) {
	const photoSlug = filename.replace(/\.[^/.]+$/, '').toLowerCase();
	const subjectSlug = photoSlug.split('_')[0];
	if ((person.photoSlugs || []).some((slug) => slug.trim().toLowerCase() === photoSlug))
		return true;
	return (person.match || []).some((pattern) => {
		const normalized = pattern.trim().toLowerCase();
		if (subjectSlug === normalized) return true;
		if (!subjectSlug.startsWith(`${normalized}-`)) return false;
		return /^\d+$/.test(subjectSlug.slice(normalized.length + 1));
	});
}

function encodedRoute(parts) {
	return parts.map(encodeURIComponent).join('/');
}

function uniqueObjects(values, key) {
	return [...new Map(values.map((value) => [key(value), value])).values()];
}

function mergeExactDuplicates(records) {
	const groups = new Map();
	for (const record of records) {
		const key = record.source_sha256
			? `sha256:${record.source_sha256}`
			: `asset:${record.asset_key}`;
		const existing = groups.get(key);
		if (!existing) {
			groups.set(key, {
				...record,
				asset_key: record.source_sha256 ? `photo/${record.source_sha256}` : record.asset_key,
				source_kinds: [record.source_kind],
				source_paths: record.source_path ? [record.source_path] : [],
				filenames: [record.filename],
			});
			continue;
		}
		existing.source_kinds = [...new Set([...existing.source_kinds, record.source_kind])];
		existing.source_kind = existing.source_kinds.join('+');
		existing.source_paths = [
			...new Set([...existing.source_paths, ...(record.source_path ? [record.source_path] : [])]),
		];
		existing.source_path = existing.source_paths[0] || null;
		existing.filenames = [...new Set([...existing.filenames, record.filename])];
		existing.people = [...new Set([...existing.people, ...record.people])];
		existing.tags = [...new Set([...existing.tags, ...record.tags])];
		existing.surfaces = uniqueObjects(
			[...existing.surfaces, ...record.surfaces],
			(surface) => `${surface.kind}|${surface.url}`,
		);
		existing.cloudinary_public_id ||= record.cloudinary_public_id;
	}
	return [...groups.values()];
}

async function readTagsByFolder(galleryRoot) {
	const tags = new Map();
	for (const file of await walkFiles(galleryRoot)) {
		if (path.basename(file) !== 'tags.json') continue;
		const folder = path.relative(galleryRoot, path.dirname(file)).split(path.sep).join('/');
		tags.set(folder, JSON.parse(await fs.readFile(file, 'utf8')));
	}
	return tags;
}

export async function buildLocalPortfolioInventory(repoRoot) {
	const galleryRoot = path.join(repoRoot, 'src/gallery/photos');
	const highlightsRoot = path.join(repoRoot, 'src/gallery/highlights');
	const people = JSON.parse(await fs.readFile(path.join(repoRoot, 'src/data/people.json'), 'utf8'));
	const homepageModule = await import(
		`${pathToFileURL(path.join(repoRoot, 'src/data/homepage-images.js')).href}?inventory`
	);
	const homepageImages = homepageModule.images;
	const homepageByFilename = new Map(homepageImages.map((image) => [image.filename, image]));
	const tagsByFolder = await readTagsByFolder(galleryRoot);
	const records = [];

	for (const image of canonicalImages(await walkFiles(galleryRoot), galleryRoot)) {
		const folder = path.dirname(image.relative) === '.' ? '' : path.dirname(image.relative);
		const filename = path.basename(image.relative);
		const slug = filename.replace(/\.[^/.]+$/, '');
		const metadata = galleryMetadata(tagsByFolder.get(folder), filename);
		const matchedPeople = people.filter((person) => matchesPerson(filename, person));
		const homepage = homepageByFilename.get(filename);
		const surfaces = [
			{
				kind: 'gallery',
				url: `https://photos.jaydixit.com/gallery/${encodedRoute(folder.split('/'))}`,
			},
			{
				kind: 'photo-detail',
				url: `https://photos.jaydixit.com/gallery/photo/${encodedRoute([...folder.split('/'), slug])}`,
			},
			...matchedPeople.map((person) => ({
				kind: 'person',
				url: `https://photos.jaydixit.com/red-carpet/${encodeURIComponent(person.slug)}`,
			})),
		];
		if (homepage) surfaces.push({ kind: 'homepage', url: 'https://photos.jaydixit.com/' });
		records.push({
			asset_key: `gallery/${image.relative}`,
			source_kind: 'gallery',
			source_path: `src/gallery/photos/${image.relative}`,
			filename,
			caption: homepage?.caption || metadata.caption || filenameCaption(filename),
			people: [...new Set([...metadata.people, ...matchedPeople.map((person) => person.name)])],
			tags: metadata.tags,
			cloudinary_public_id: homepage ? homepage.cloudinaryPublicId || `highlights/${slug}` : null,
			source_sha256: await sha256File(image.file),
			surfaces,
		});
	}

	const localHighlightFilenames = new Set();
	for (const image of canonicalImages(await walkFiles(highlightsRoot), highlightsRoot)) {
		const filename = path.basename(image.relative);
		const slug = filename.replace(/\.[^/.]+$/, '');
		localHighlightFilenames.add(filename);
		const homepage = homepageByFilename.get(filename);
		const matchedPeople = people.filter((person) => matchesPerson(filename, person));
		const surfaces = matchedPeople.map((person) => ({
			kind: 'person',
			url: `https://photos.jaydixit.com/red-carpet/${encodeURIComponent(person.slug)}`,
		}));
		if (homepage) surfaces.unshift({ kind: 'homepage', url: 'https://photos.jaydixit.com/' });
		records.push({
			asset_key: `highlights/${image.relative}`,
			source_kind: 'highlight',
			source_path: `src/gallery/highlights/${image.relative}`,
			filename,
			caption: homepage?.caption || filenameCaption(filename),
			people: matchedPeople.map((person) => person.name),
			tags: [],
			cloudinary_public_id: homepage ? homepage.cloudinaryPublicId || `highlights/${slug}` : null,
			source_sha256: await sha256File(image.file),
			surfaces,
		});
	}

	for (const homepage of homepageImages) {
		if (localHighlightFilenames.has(homepage.filename)) continue;
		const galleryRecord = records.find(
			(record) => record.source_kind === 'gallery' && record.filename === homepage.filename,
		);
		if (galleryRecord) continue;
		const slug = homepage.filename.replace(/\.[^/.]+$/, '');
		const matchedPeople = people.filter((person) => matchesPerson(homepage.filename, person));
		records.push({
			asset_key: `cloudinary/${homepage.cloudinaryPublicId || `highlights/${slug}`}`,
			source_kind: 'cloudinary-only',
			source_path: null,
			filename: homepage.filename,
			caption: homepage.caption || filenameCaption(homepage.filename),
			people: matchedPeople.map((person) => person.name),
			tags: [],
			cloudinary_public_id: homepage.cloudinaryPublicId || `highlights/${slug}`,
			source_sha256: null,
			surfaces: [
				{ kind: 'homepage', url: 'https://photos.jaydixit.com/' },
				...matchedPeople.map((person) => ({
					kind: 'person',
					url: `https://photos.jaydixit.com/red-carpet/${encodeURIComponent(person.slug)}`,
				})),
			],
		});
	}

	const mergedRecords = mergeExactDuplicates(records).sort((left, right) =>
		left.asset_key.localeCompare(right.asset_key),
	);
	const fingerprint = sha256(JSON.stringify(mergedRecords));
	return {
		manifest_version: 1,
		generated_at: new Date().toISOString(),
		fingerprint,
		record_count: mergedRecords.length,
		records: mergedRecords,
	};
}
