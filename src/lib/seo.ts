import { resolveSocialImage } from '@jaydixit/astro-utils/utils/social-image.ts';
import { serializeJsonLd as serializeSharedJsonLd } from '@jaydixit/astro-utils/utils/json-ld.ts';

type JsonLdRecord = Record<string, unknown>;
type JsonLd = JsonLdRecord | JsonLdRecord[];

export type OgImage = {
	url: string;
	alt?: string;
	width?: number;
	height?: number;
	type?: string;
};

function imageMimeType(format: string | undefined) {
	if (!format) return undefined;
	if (format === 'jpg' || format === 'jpeg') return 'image/jpeg';
	if (format === 'png') return 'image/png';
	if (format === 'webp') return 'image/webp';
	if (format === 'avif') return 'image/avif';
	if (format === 'gif') return 'image/gif';
	if (format === 'svg') return 'image/svg+xml';
	return undefined;
}

export function ogImageFromAsset(
	image: { src: string; width: number; height: number; format?: string },
	alt?: string,
): OgImage {
	return {
		url: image.src,
		alt,
		width: image.width,
		height: image.height,
		type: imageMimeType(image.format),
	};
}

export function resolveCanonicalUrl(source: string | undefined, siteUrl: string, pathname: string) {
	return source ? new URL(source, siteUrl).toString() : new URL(pathname, siteUrl).toString();
}

export function resolveOgImage(
	rawImage: string | undefined,
	siteUrl: string,
	fallbackPath: string,
) {
	return rawImage
		? new URL(rawImage, siteUrl).toString()
		: new URL(fallbackPath, siteUrl).toString();
}

export async function resolveOgImages(
	images: ReadonlyArray<OgImage>,
	siteUrl: string,
): Promise<OgImage[]> {
	const site = new URL(siteUrl);
	return Promise.all(images.map((image) => resolveSocialImage(image, site)));
}

type SeoTagInput = {
	title: string;
	description?: string;
	canonical: string;
	noindex: boolean;
	ogType: string;
	ogImages: ReadonlyArray<OgImage>;
	locale: string;
	siteName: string;
	twitterCard: string;
	twitterHandle?: string;
	publishedTime?: string;
	modifiedTime?: string;
};

export function createSeoTagProps(input: SeoTagInput) {
	return {
		title: input.title,
		description: input.description,
		canonical: input.canonical,
		...(input.noindex ? { noindex: true, nofollow: true } : {}),
		openGraph: {
			type: input.ogType,
			site_name: input.siteName,
			locale: input.locale,
			title: input.title,
			description: input.description,
			url: input.canonical,
			images: input.ogImages,
			...(input.ogType === 'article'
				? {
						article: {
							publishedTime: input.publishedTime,
							modifiedTime: input.modifiedTime,
						},
					}
				: {}),
		},
		twitter: {
			cardType: input.twitterCard,
			site: input.twitterHandle,
			handle: input.twitterHandle,
		},
	};
}

export function serializeJsonLd(data: JsonLd | undefined | null) {
	if (!data) return null;
	return serializeSharedJsonLd(data);
}

export function normalizeDateValue(value: string | Date | undefined) {
	if (!value) return undefined;
	if (value instanceof Date) return value.toISOString();
	const date = new Date(value);
	return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export function normalizeKeywords(value: string[] | string | undefined) {
	if (!value) return undefined;
	if (Array.isArray(value)) {
		return value.filter(Boolean).join(', ');
	}
	return value;
}
