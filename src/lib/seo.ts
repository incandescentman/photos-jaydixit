import type { ImageMetadata } from 'astro:assets';
import { resolveSocialImage } from '@jaydixit/astro-utils/utils/social-image.ts';
import { serializeJsonLd as serializeSharedJsonLd } from '@jaydixit/astro-utils/utils/json-ld.ts';
import { socialVariant } from './image-variants';
import siteConfig from '../../site.config.mts';

type JsonLdRecord = Record<string, unknown>;
type JsonLd = JsonLdRecord | JsonLdRecord[];

export const photographer = {
	'@type': 'Person',
	name: siteConfig.owner,
	url: siteConfig.authorUrl,
};

/** License fields are supplied only from the verified publication record. */
export function photoImageObject(input: {
	src: string;
	caption: string;
	width: number;
	height: number;
	creatorName?: string;
	pageUrl?: string | null;
	thumbnail?: string;
	publication?: { licenseUrl: string; commonsUrl: string };
}) {
	const creator =
		!input.creatorName || input.creatorName === siteConfig.owner
			? photographer
			: { '@type': 'Person', name: input.creatorName };
	return {
		'@type': 'ImageObject',
		contentUrl: new URL(input.src, siteConfig.siteUrl).toString(),
		name: input.caption,
		caption: input.caption,
		width: input.width,
		height: input.height,
		creator,
		creditText: `Photo by ${creator.name}`,
		...(input.pageUrl ? { url: new URL(input.pageUrl, siteConfig.siteUrl).toString() } : {}),
		...(input.thumbnail
			? { thumbnailUrl: new URL(input.thumbnail, siteConfig.siteUrl).toString() }
			: {}),
		...(input.publication
			? {
					license: input.publication.licenseUrl,
					acquireLicensePage: input.publication.commonsUrl,
					sameAs: input.publication.commonsUrl,
				}
			: {}),
	};
}

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

// A 1,200 px JPEG card, so social previews never point at the full-size original.
export async function ogImageFromAsset(image: ImageMetadata, alt?: string): Promise<OgImage> {
	const card = await socialVariant(image);
	return {
		url: card.src,
		alt,
		width: card.width,
		height: card.height,
		type: imageMimeType('jpg'),
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
