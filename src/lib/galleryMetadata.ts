export type GalleryFileOverride = {
	title?: string;
	caption?: string;
	tags?: string[];
	keywords?: string[];
	people?: string[];
};

export type StructuredGalleryTags = {
	album?: Record<string, unknown>;
	defaults?: GalleryFileOverride & Record<string, unknown>;
	captions?: Record<string, string>;
	overrides?: Record<string, GalleryFileOverride>;
	highlights?: string[];
};

export type LegacyGalleryTags = Record<string, string[]>;
export type GalleryTagsFile = LegacyGalleryTags | StructuredGalleryTags;

const structuredKeys = new Set(['album', 'defaults', 'captions', 'overrides', 'highlights']);

function isStructuredGalleryTags(value: GalleryTagsFile): value is StructuredGalleryTags {
	return Object.keys(value).some((key) => structuredKeys.has(key));
}

function stringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.trim())
		.filter(Boolean);
}

function unique(values: string[]) {
	return [...new Set(values)];
}

export function getGalleryFileMetadata(tagsFile: GalleryTagsFile | undefined, filename: string) {
	if (!tagsFile) return { caption: undefined, tags: [] as string[] };

	if (!isStructuredGalleryTags(tagsFile)) {
		return {
			caption: undefined,
			tags: stringList(tagsFile[filename]),
		};
	}

	const defaults = tagsFile.defaults ?? {};
	const override = tagsFile.overrides?.[filename] ?? {};
	const caption = override.caption ?? tagsFile.captions?.[filename] ?? override.title;
	const tags = unique([
		...stringList(defaults.tags),
		...stringList(defaults.keywords),
		...stringList(override.tags),
		...stringList(override.keywords),
		...stringList(override.people),
	]);

	return { caption, tags };
}

function formatWord(word: string) {
	const normalized = word.toLowerCase();
	const acronymMap: Record<string, string> = {
		sxsw: 'SXSW',
		tiff: 'TIFF',
		nyff: 'NYFF',
		ucb: 'UCB',
		wikiportraits: 'WikiPortraits',
	};

	if (acronymMap[normalized]) return acronymMap[normalized];
	return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatPhrase(value: string) {
	return value
		.split(/[\s-]+/)
		.filter(Boolean)
		.map(formatWord)
		.join(' ');
}

export function buildCaptionAndTags(
	filename: string,
	folderSlug: string,
	tagsFile?: GalleryTagsFile,
	subjectName?: string,
) {
	const baseName = filename.replace(/\.[^/.]+$/, '');
	const parts = baseName.split('_');
	let subject = subjectName ?? '';
	let event = '';
	let year = '';

	if (!subject && parts.length > 0) {
		subject = formatPhrase(parts[0]);
	}

	if (parts.length > 1) {
		const lastPart = parts[parts.length - 1];
		if (/^\d{4}$/.test(lastPart)) {
			year = lastPart;
			if (parts.length > 2) {
				event = formatPhrase(parts.slice(1, -1).join(' '));
			}
		} else {
			event = formatPhrase(parts.slice(1).join(' '));
		}
	}

	let filenameCaption = subject;
	if (event) filenameCaption += ` at ${event}`;
	if (year) filenameCaption += ` in ${year}`;
	if (!filenameCaption) {
		filenameCaption = subject || baseName.replace(/[-_]/g, ' ');
	}

	const fileMetadata = getGalleryFileMetadata(tagsFile, filename);
	let tags = fileMetadata.tags;

	if (tags.length === 0) {
		const tagMatch = baseName.match(/_([^_]+)$/);
		if (tagMatch) {
			tags = tagMatch[1].split('-');
		}
		if (folderSlug) {
			tags.push(...folderSlug.split('/'));
		}
	}

	return {
		caption: fileMetadata.caption ?? filenameCaption,
		tags: unique(tags),
	};
}
