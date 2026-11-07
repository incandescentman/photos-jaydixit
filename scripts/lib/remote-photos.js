/** Public delivery records contain verified metadata, never private source paths. */
export function validateRemotePhotos(records) {
	if (!Array.isArray(records)) throw new Error('Remote photos must be an array');
	const slugs = new Set();
	const ids = new Set();
	for (const photo of records) {
		if (!photo || typeof photo !== 'object') throw new Error('Invalid remote photo');
		if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(photo.gallery))
			throw new Error('Invalid remote gallery');
		if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/.test(photo.filename))
			throw new Error('Invalid remote filename');
		if (
			typeof photo.publicId !== 'string' ||
			!/^[a-zA-Z0-9_/-]+$/.test(photo.publicId) ||
			photo.publicId.split('/').some((p) => !p || p === '.' || p === '..')
		)
			throw new Error('Invalid Cloudinary public ID');
		for (const key of ['width', 'height', 'version']) {
			if (!Number.isSafeInteger(photo[key]) || photo[key] <= 0)
				throw new Error(`Invalid remote ${key}`);
		}
		if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(photo.format))
			throw new Error('Invalid remote format');
		if (!/^[a-f0-9]{64}$/.test(photo.sha256)) throw new Error('Missing remote source hash');
		if (typeof photo.caption !== 'string' || !photo.caption.trim())
			throw new Error('Missing remote caption');
		if (!Array.isArray(photo.tags) || photo.tags.some((tag) => typeof tag !== 'string'))
			throw new Error('Invalid remote tags');
		if (
			!photo.embedded ||
			typeof photo.embedded !== 'object' ||
			!photo.exif ||
			typeof photo.exif !== 'object'
		)
			throw new Error('Missing remote metadata snapshot');
		const allowed = new Set([
			'gallery',
			'filename',
			'publicId',
			'version',
			'width',
			'height',
			'format',
			'sha256',
			'caption',
			'tags',
			'embedded',
			'exif',
		]);
		if (Object.keys(photo).some((key) => !allowed.has(key)))
			throw new Error('Unexpected field in public remote record');
		const slug = `${photo.gallery}/${photo.filename.replace(/\.[^.]+$/, '')}`.toLowerCase();
		if (slugs.has(slug) || ids.has(photo.publicId))
			throw new Error(`Duplicate remote photo: ${slug}`);
		slugs.add(slug);
		ids.add(photo.publicId);
	}
	return records;
}
