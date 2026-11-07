import type { ImageMetadata } from 'astro:assets';
import { dirname, resolve } from 'node:path';
import records from '../data/remote-photos.json';
import { validateRemotePhotos } from '../../scripts/lib/remote-photos.js';

export type RemotePhoto = {
	gallery: string;
	filename: string;
	publicId: string;
	version: number;
	width: number;
	height: number;
	format: ImageMetadata['format'];
	sha256: string;
	caption: string;
	tags: string[];
	embedded: {
		dc?: { creator?: unknown; rights?: unknown };
		xmpRights?: { UsageTerms?: unknown; WebStatement?: unknown };
	};
	exif: Record<string, unknown>;
};
export const remotePhotos = validateRemotePhotos(records) as RemotePhoto[];
const cloud = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME;
export function remoteOriginalUrl(photo: RemotePhoto) {
	if (!cloud || !/^[a-zA-Z0-9_-]+$/.test(cloud))
		throw new Error('Missing or invalid Cloudinary cloud name');
	return `https://res.cloudinary.com/${cloud}/image/upload/v${photo.version}/${photo.publicId}.${photo.format}`;
}
export function remotePhotoForPath(moduleKey: string, pageFile: string) {
	const absolute = resolve(dirname(pageFile), moduleKey);
	return remotePhotos.find(
		(photo) => absolute === resolve('src/gallery/photos', photo.gallery, photo.filename),
	);
}
export function remotePhotoForImage(image: unknown): RemotePhoto | undefined {
	if (!image || typeof image !== 'object' || !('src' in image)) return undefined;
	// Astro tracks reads of imported image.src as a request to ship the original.
	// Inspect its untracked clone so adding remote records cannot emit existing originals.
	const metadata = (image as ImageMetadata & { clone?: ImageMetadata }).clone ?? image;
	if (typeof metadata.src !== 'string' || !metadata.src.startsWith('https://res.cloudinary.com/'))
		return undefined;
	return remotePhotos.find((photo) => metadata.src === remoteOriginalUrl(photo));
}
export function withRemotePhotos(
	local: Record<string, { default: ImageMetadata }>,
	prefix: string,
) {
	const merged = { ...local };
	const slugs = new Set(Object.keys(local).map((key) => key.replace(/\.[^.]+$/, '').toLowerCase()));
	for (const photo of remotePhotos) {
		const key = `${prefix}${photo.gallery}/${photo.filename}`;
		if (slugs.has(key.replace(/\.[^.]+$/, '').toLowerCase()))
			throw new Error(`Local/Cloudinary photo collision: ${key}`);
		merged[key] = {
			default: {
				src: remoteOriginalUrl(photo),
				width: photo.width,
				height: photo.height,
				format: photo.format,
			},
		};
	}
	return merged;
}
