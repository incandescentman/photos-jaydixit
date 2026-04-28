import justifiedLayout from 'justified-layout';

interface JustifiedLayoutResult {
	/**
	 * Height of the container containing the justified layout.
	 */
	containerHeight: number;
	/**
	 * Number of items that are in rows that aren't fully-packed.
	 */
	widowCount: number;
	/**
	 * Computed positional and sizing properties of a box in the justified layout.
	 */
	boxes: LayoutBox[];
}

/**
 * Computed positional and sizing properties of a box in the layout.
 */
interface LayoutBox {
	/**
	 * Aspect ratio of the box.
	 */
	aspectRatio: number;
	/**
	 * Distance between the top side of the box and the top boundary of the justified layout.
	 */
	top: number;
	/**
	 * Width of the box in a justified layout.
	 */
	width: number;
	/**
	 * Height of the box in a justified layout.
	 */
	height: number;
	/**
	 * Distance between the left side of the box and the left boundary of the justified layout.
	 */
	left: number;
	/**
	 * Whether or not the aspect ratio was forced.
	 */
	forcedAspectRatio?: boolean;
}

export async function setupGallery() {
	if (typeof document === 'undefined') return;

	const container = document.getElementById('photo-grid');
	if (!container) {
		console.error('Photo grid container not found.');
		return;
	}

	const imageLinks = Array.from(container.querySelectorAll('.photo-item')) as HTMLElement[];

	if (imageLinks.length === 0) {
		console.warn('No images found inside the photo grid.');
		return;
	}

	// Wait for all images to load
	const imageElements = await waitForImagesToLoad(container);

	// Get actual image dimensions after loading
	const containerWidth = container.clientWidth || window.innerWidth;
	const isMobileViewport = containerWidth <= 768;

	if (isMobileViewport) {
		applyMobileLayout(imageLinks, container, imageElements);
		return;
	}

	const layout = createLayoutFor(imageElements, containerWidth);
	console.log('Generated layout:', layout);

	applyImagesStyleBasedOnLayout(imageLinks, layout);
	applyContainerStyleBasedOnLayout(container, layout);
}

function createLayoutFor(
	imageElements: HTMLImageElement[],
	containerWidth: number,
): JustifiedLayoutResult {
	const imageSizes = imageElements.map((img) => ({
		width: img.naturalWidth || img.width || 300,
		height: img.naturalHeight || img.height || 200,
	}));

	const isTabletViewport = containerWidth <= 1024;
	const boxSpacing = isTabletViewport ? 6 : 10;

	const layout = justifiedLayout(imageSizes, {
		containerWidth,
		targetRowHeight: 300,
		boxSpacing,
		containerPadding: 0,
	});
	return layout;
}

async function waitForImagesToLoad(container: HTMLElement) {
	const imageElements = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];

	await Promise.all(
		imageElements.map(
			(img) =>
				new Promise((resolve) => {
					if (img.complete) {
						resolve(null);
					} else {
						img.onload = () => resolve(null);
						img.onerror = () => resolve(null);
					}
				}),
		),
	);
	return imageElements;
}

function applyImagesStyleBasedOnLayout(imageLinks: HTMLElement[], layout: JustifiedLayoutResult) {
	imageLinks.forEach((el, i) => {
		if (!layout.boxes[i]) return;
		const { left, top, width, height } = layout.boxes[i];

		el.style.marginBottom = '0';
		el.style.position = 'absolute';
		el.style.left = `${left}px`;
		el.style.top = `${top}px`;
		el.style.width = `${width}px`;
		el.style.height = `${height}px`;
		el.style.display = 'block';
	});
}

function applyContainerStyleBasedOnLayout(container: HTMLElement, layout: JustifiedLayoutResult) {
	// Ensure the parent container has relative positioning
	container.style.display = 'block';
	container.style.flexDirection = '';
	container.style.gap = '0';
	container.style.position = 'relative';
	// Set container height
	container.style.height = `${layout.containerHeight}px`;
}

function applyMobileLayout(
	imageLinks: HTMLElement[],
	container: HTMLElement,
	imageElements: HTMLImageElement[],
) {
	container.style.display = 'flex';
	container.style.flexDirection = 'column';
	container.style.gap = '2px';
	container.style.position = 'relative';
	container.style.height = 'auto';

	imageLinks.forEach((el) => {
		el.style.position = 'relative';
		el.style.left = '0';
		el.style.top = '0';
		el.style.width = '100%';
		el.style.height = 'auto';
		el.style.display = 'block';
		el.style.marginBottom = '0';
	});

	imageElements.forEach((img) => {
		img.style.width = '100%';
		img.style.height = 'auto';
		img.style.display = 'block';
	});
}
// Run setupGallery once the page is loaded
if (typeof window !== 'undefined') {
	const debouncedSetup = debounce(setupGallery, 250);

	document.addEventListener('DOMContentLoaded', setupGallery);
	window.addEventListener('resize', debouncedSetup);
}

// Debounce helper
function debounce<T extends (...args: unknown[]) => unknown>(func: T, wait: number) {
	let timeout: ReturnType<typeof setTimeout>;
	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}
