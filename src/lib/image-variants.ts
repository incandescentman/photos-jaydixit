// Sized copies for the places that used to link a photo's original file: lightbox zoom, social
// cards, structured data, and tool previews. Linking an original, or reading any of its
// properties, makes Astro ship the full-size file with every deployment.
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro:assets';

// PhotoGrid's lightbox already stops at 3,000 px; the other lightboxes now match it.
export const LIGHTBOX_MAX_WIDTH = 3000;

// Astro's image proxy marks an original as used whenever a property is read, except `clone`,
// which returns an untracked copy. Read dimensions from that copy.
export function dimensionsOf(image: ImageMetadata): { width: number; height: number } {
	const meta = (image as ImageMetadata & { clone?: ImageMetadata }).clone ?? image;
	return { width: meta.width, height: meta.height };
}

async function variant(image: ImageMetadata, maxWidth: number, format: 'webp' | 'jpg', quality: number) {
	const width = Math.min(dimensionsOf(image).width, maxWidth);
	const result = await getImage({ src: image, width, format, quality });
	return {
		src: result.src,
		width: Number(result.attributes.width),
		height: Number(result.attributes.height),
	};
}

// Quality 85: Sunjay's choice after comparing WebP 80, 85, and 90 on difficult photos (2026-09-24).
export const lightboxVariant = (image: ImageMetadata, maxWidth = LIGHTBOX_MAX_WIDTH, quality = 85) =>
	variant(image, maxWidth, 'webp', quality);
export const thumbnailVariant = (image: ImageMetadata, maxWidth = 480) => variant(image, maxWidth, 'webp', 78);
// Social cards: a 1,200 px JPEG, the most widely accepted preview format.
export const socialVariant = (image: ImageMetadata) => variant(image, 1200, 'jpg', 82);
