// Keep search results focused on published portfolio content. Preview and utility
// routes stay accessible, with the same policy used by page metadata and sitemap.
export function isPublicSearchPage(pathname: string) {
	const path = pathname.replace(/\/+$/, '') || '/';
	const excluded = new Set([
		'/before-after',
		'/photo-wall',
		'/prototype-documentary',
		'/salient-photography-demo',
		'/upload-to-commons',
		'/blog/hello-world',
	]);
	return (
		!excluded.has(path) &&
		!/^\/(portraits|experiments|collections)(?:\/|$)/.test(path) &&
		!path.startsWith('/red-carpets/')
	);
}
