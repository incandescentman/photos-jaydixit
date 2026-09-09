import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import exifr from 'exifr';

type EmbeddedMetadata = {
	dc?: {
		creator?: unknown;
		rights?: unknown;
	};
	xmpRights?: {
		UsageTerms?: unknown;
		WebStatement?: unknown;
	};
};

type EmbeddedAttributionOptions = {
	moduleKey: string;
	pageFile: string;
	caption: string;
	sourceDetailUrl?: string | null;
};

const metadataByPath = new Map<string, Promise<EmbeddedMetadata | undefined>>();

function xmpText(value: unknown): string | undefined {
	if (typeof value === 'string') return value.trim() || undefined;
	if (Array.isArray(value)) {
		const values = value.map(xmpText).filter((entry): entry is string => Boolean(entry));
		return values.length > 0 ? values.join(', ') : undefined;
	}
	if (value && typeof value === 'object' && 'value' in value) {
		return xmpText(value.value);
	}
	return undefined;
}

function asSentence(value: string) {
	return /[.!?]$/.test(value) ? value : `${value}.`;
}

async function readEmbeddedMetadata(filePath: string): Promise<EmbeddedMetadata | undefined> {
	try {
		const parsed = await exifr.parse(await readFile(filePath), {
			xmp: true,
			tiff: false,
			iptc: false,
			mergeOutput: false,
		});
		return parsed as EmbeddedMetadata | undefined;
	} catch {
		return undefined;
	}
}

/**
 * Produces copy-ready attribution only when the source image itself carries both
 * an embedded creator and explicit usage terms or license statement.
 */
export async function embeddedAttribution({
	moduleKey,
	pageFile,
	caption,
	sourceDetailUrl,
}: EmbeddedAttributionOptions): Promise<string | undefined> {
	if (!sourceDetailUrl) return undefined;

	const imagePath = resolve(dirname(pageFile), moduleKey);
	let metadata = metadataByPath.get(imagePath);
	if (!metadata) {
		metadata = readEmbeddedMetadata(imagePath);
		metadataByPath.set(imagePath, metadata);
	}

	const parsed = await metadata;
	const creator = xmpText(parsed?.dc?.creator);
	const rights = xmpText(parsed?.dc?.rights);
	const usageTerms = xmpText(parsed?.xmpRights?.UsageTerms);
	const webStatement = xmpText(parsed?.xmpRights?.WebStatement);
	const hasExplicitLicense =
		Boolean(usageTerms) || Boolean(rights && /\blicen[cs](?:e|ed|sing)\b/i.test(rights));

	if (!creator || !hasExplicitLicense) return undefined;

	const licenseStatements = [rights, usageTerms]
		.filter((value): value is string => Boolean(value))
		.filter((value, index, entries) => entries.indexOf(value) === index)
		.map(asSentence);

	return [
		`${caption} — Photograph by ${creator}.`,
		...licenseStatements,
		...(webStatement ? [`License: ${webStatement}.`] : []),
		`Source: ${sourceDetailUrl}`,
	].join(' ');
}
