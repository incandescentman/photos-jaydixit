import { describe, expect, it, vi } from 'vitest';
const { record } = vi.hoisted(() => ({
	record: {
		gallery: 'cloudinary-verification',
		filename: 'jack-johnson_sxsw_2026_03.jpg',
		publicId: 'highlights/jack-johnson_sxsw_2026_03',
		version: 1788332337,
		width: 2654,
		height: 2199,
		format: 'jpg',
		sha256: '0dd0cb296fdd8afdc69617a7109062df31a4b1cda04dfe902fbd8a0bfafdb584',
		caption:
			'Jack Johnson performs at Stubb’s during South by Southwest in Austin, Texas, on March 13, 2026.',
		tags: ['SXSW 2026'],
		embedded: {},
		exif: {},
	},
}));
vi.mock('../remote-photos.json', () => ({ default: [record] }));
import { remotePhotoForImage, remotePhotoForPath, withRemotePhotos } from '../../lib/remotePhotos';
import { validateRemotePhotos } from '../../../scripts/lib/remote-photos.js';

describe('remote gallery source contract', () => {
	it('resolves a registry image by the same module path used for gallery attribution', () => {
		expect(
			remotePhotoForPath(
				'../../gallery/photos/cloudinary-verification/' + record.filename,
				'src/pages/gallery/[...folder].astro',
			),
		).toBe(record);
	});
	it('never touches a tracked local src while checking remote membership', () => {
		const image = {
			clone: { src: '/_astro/local.jpg' },
			get src() {
				throw new Error('Original would be emitted');
			},
		};
		expect(remotePhotoForImage(image)).toBeUndefined();
	});
	it('refuses a remote/local route collision even across file formats', () => {
		const key = '../../gallery/photos/cloudinary-verification/jack-johnson_sxsw_2026_03.webp';
		expect(() =>
			withRemotePhotos({ [key]: { default: {} as never } }, '../../gallery/photos/'),
		).toThrow('collision');
	});
	it('fails closed on invalid dimensions, duplicate routes, traversal, and private source paths', () => {
		expect(validateRemotePhotos([record])).toEqual([record]);
		expect(() => validateRemotePhotos([{ ...record, width: 0 }])).toThrow();
		expect(() => validateRemotePhotos([record, record])).toThrow();
		expect(() => validateRemotePhotos([{ ...record, gallery: '../private' }])).toThrow();
		expect(() => validateRemotePhotos([{ ...record, source: '/private/original.jpg' }])).toThrow();
	});
});
