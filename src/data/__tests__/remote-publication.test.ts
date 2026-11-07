import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import exifr from 'exifr';
import {
	readRemoteMetadata,
	validatePortfolioBatch,
	validatePortfolioCollisions,
	validateRemoteReceipt,
} from '../../../scripts/photo-publish.js';

const source =
	'src/gallery/photos/events/nobel-prizes-2024/geoffrey-hinton_nobel-lectures-stockholm_2024.jpg';
const makePhoto = (delivery = 'cloudinary') => ({
	sha256: 'a'.repeat(64),
	destinations: {
		portfolio: { enabled: true, delivery, gallery: 'events/test', filename: 'portrait.jpg' },
		cloudinary: { public_id: 'photos/events/test/portrait' },
	},
});
const record = {
	gallery: 'events/test',
	filename: 'portrait.jpg',
	publicId: 'photos/events/test/portrait',
	sha256: 'a'.repeat(64),
};

describe('remote portfolio publication', () => {
	it('rejects local slug collisions for remote delivery even when a webp derivative exists', () => {
		expect(() => validatePortfolioCollisions(makePhoto(), [], ['portrait.webp'])).toThrow(
			'Local portfolio slug collision',
		);
		expect(() =>
			validatePortfolioCollisions(makePhoto('local'), [], ['portrait.jpg']),
		).not.toThrow();
	});
	it('rejects a remote slug for local delivery and permits only matching remote receipt replay', () => {
		expect(() => validatePortfolioCollisions(makePhoto('local'), [record], [])).toThrow(
			'Remote portfolio collision',
		);
		expect(validatePortfolioCollisions(makePhoto(), [record], [])).toBe(record);
		expect(() =>
			validatePortfolioCollisions({ ...makePhoto(), sha256: 'b'.repeat(64) }, [record], []),
		).toThrow('Remote portfolio collision');
	});
	it('rejects duplicate planned slugs and public IDs before uploading', () => {
		expect(() => validatePortfolioBatch([makePhoto(), makePhoto('local')])).toThrow(
			'Duplicate planned portfolio slug',
		);
		const other = makePhoto();
		other.destinations.portfolio.filename = 'other.jpg';
		expect(() => validatePortfolioBatch([makePhoto(), other])).toThrow(
			'Duplicate planned Cloudinary public ID',
		);
	});
	it('requires a verified receipt for the exact source and valid upload dimensions and version', () => {
		const photo = {
			...makePhoto(),
			source,
			receipts: {
				cloudinary: {
					verified_at: '2026-11-07T00:00:00Z',
					source,
					source_sha256: 'a'.repeat(64),
					public_id: 'photos/events/test/portrait',
					width: 100,
					height: 200,
					version: 123,
					format: 'jpg',
				},
			},
		};
		const dimensions = { width: 100, height: 200 };
		expect(validateRemoteReceipt(photo, dimensions)).toBe(photo.receipts.cloudinary);
		for (const [key, value] of Object.entries({
			verified_at: '',
			source: 'other',
			source_sha256: 'b'.repeat(64),
			public_id: 'other',
			width: 99,
			height: 199,
			version: 0,
			format: 'invalid',
		})) {
			const bad = {
				...photo,
				receipts: { cloudinary: { ...photo.receipts.cloudinary, [key]: value } },
			};
			expect(() => validateRemoteReceipt(bad, dimensions), key).toThrow();
		}
		const missingVersion = {
			...photo,
			receipts: { cloudinary: { ...photo.receipts.cloudinary, version: undefined } },
		};
		expect(() => validateRemoteReceipt(missingVersion, dimensions)).toThrow();
	});
	it('preserves the actual embedded attribution and display-compatible EXIF values', async () => {
		const snapshot = await readRemoteMetadata(source);
		const original = await exifr.parse(await readFile(source), { xmp: true, mergeOutput: false });
		expect(snapshot.embedded.dc.creator).toEqual(original.dc.creator);
		expect(snapshot.embedded.dc.rights).toEqual(original.dc.rights);
		expect(snapshot.embedded.xmpRights.WebStatement).toEqual(original.xmpRights.WebStatement);
		for (const key of ['ExposureTime', 'FNumber', 'FocalLength', 'ISO']) {
			expect(snapshot.exif[key]).toEqual(original.exif[key]);
			expect(typeof snapshot.exif[key]).toBe('number');
		}
		expect(new Date(JSON.parse(JSON.stringify(snapshot.exif)).DateTimeOriginal).getTime()).toBe(
			original.exif.DateTimeOriginal.getTime(),
		);
	});
});
