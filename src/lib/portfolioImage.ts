import { getImage as astroGetImage } from 'astro:assets';
import { remoteOriginalUrl, remotePhotoForImage } from './remotePhotos';

/** Cloudinary records bypass Astro's local transformer, so no image bytes enter dist. */
export const getImage: typeof astroGetImage = async (options, ...rest) => {
	const photo = remotePhotoForImage(options.src);
	if (!photo) return astroGetImage(options, ...rest);
	const requestedWidth =
		Number(options.width) ||
		(Number(options.height) ? (Number(options.height) * photo.width) / photo.height : photo.width);
	const width = Math.min(photo.width, Math.max(1, Math.round(requestedWidth)));
	const crop = Boolean(options.width && options.height && options.fit === 'cover');
	const height = crop
		? Math.round((width * Number(options.height)) / Number(options.width))
		: Math.max(1, Math.round((width * photo.height) / photo.width));
	const format = options.format === 'jpeg' ? 'jpg' : options.format || 'auto';
	if (!['auto', 'jpg', 'png', 'webp', 'avif', 'gif'].includes(format))
		throw new Error(`Unsupported Cloudinary format: ${format}`);
	const qualities: Record<string, number> = { low: 25, mid: 50, high: 80, max: 100 };
	const quality =
		options.quality === undefined
			? 85
			: (qualities[String(options.quality)] ?? Number(options.quality));
	if (!Number.isFinite(quality) || quality < 1 || quality > 100)
		throw new Error('Invalid Cloudinary quality');
	const url = (w: number) => {
		const h = Math.max(1, Math.round((w * height) / width));
		const transform = [
			`f_${format}`,
			`q_${quality}`,
			`w_${w}`,
			...(crop
				? [
						`h_${h}`,
						'c_fill',
						options.position === 'attention' || options.position === 'entropy'
							? 'g_auto'
							: 'g_center',
					]
				: ['c_limit']),
		].join(',');
		return remoteOriginalUrl(photo).replace('/image/upload/', `/image/upload/${transform}/`);
	};
	const widths = [
		...new Set((options.widths ?? []).map(Number).filter((w) => w > 0 && w <= photo.width)),
	].sort((a, b) => a - b);
	const values = widths.map((w) => ({
		url: url(w),
		descriptor: `${w}w`,
		transform: { ...options, width: w },
	}));
	const internal = new Set([
		'src',
		'widths',
		'densities',
		'format',
		'quality',
		'inferSize',
		'fit',
		'position',
		'layout',
		'priority',
	]);
	const attributes = Object.fromEntries(
		Object.entries(options).filter(([key]) => !internal.has(key)),
	);
	return {
		rawOptions: options,
		options,
		src: url(width),
		srcSet: {
			values,
			attribute: values.map((value) => `${value.url} ${value.descriptor}`).join(', '),
		},
		attributes: {
			...attributes,
			width,
			height,
			loading: attributes.loading ?? 'lazy',
			decoding: attributes.decoding ?? 'async',
		},
	} as Awaited<ReturnType<typeof astroGetImage>>;
};
