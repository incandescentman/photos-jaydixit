import type PhotoSwipe from 'photoswipe';
import type { SlideData } from 'photoswipe';

const attached = new WeakSet<PhotoSwipe>();
let installed = false;

function plainText(value: unknown): string {
	if (typeof value !== 'string') return '';
	return new DOMParser().parseFromString(value, 'text/html').body.textContent?.trim() ?? '';
}

function captionFor(data: SlideData): string {
	return plainText(data.title || data.element?.getAttribute('data-pswp-caption') || data.alt);
}

function safeUrl(value?: string): string | undefined {
	if (!value) return undefined;
	try {
		const url = new URL(value, location.href);
		if (!['http:', 'https:'].includes(url.protocol)) return undefined;
		return url.origin === 'https://photos.jaydixit.com'
			? new URL(url.pathname + url.search + url.hash, location.origin).href
			: url.href;
	} catch {
		return undefined;
	}
}

function smallThumbnail(item: SlideData): string {
	const image = item.element?.querySelector('img');
	const source = image?.getAttribute('src') || item.msrc || '';
	if (source.includes('res.cloudinary.com/dszpm7yps/image/upload/')) {
		return source.replace(/w_\d+/, 'w_160');
	}
	// Reuse an already-loaded preview; never fetch an unseen full-size original.
	if (image?.complete && image.naturalWidth > 0) {
		const canvas = document.createElement('canvas');
		canvas.width = 160;
		canvas.height = Math.max(1, Math.round((160 * image.naturalHeight) / image.naturalWidth));
		try {
			canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
			return canvas.toDataURL('image/webp', 0.7);
		} catch {
			return '';
		}
	}
	return '';
}

function enhance(pswp: PhotoSwipe) {
	const root = pswp.element;
	if (!root || !pswp.ui || attached.has(pswp)) return;
	attached.add(pswp);
	root.dataset.exhibitionViewer = 'true';
	const openingAnchor = pswp.currSlide?.data.element;
	let closeAfterOpening = false;
	const onEarlyEscape = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && !pswp.opener.isOpen) closeAfterOpening = true;
	};
	document.addEventListener('keydown', onEarlyEscape, true);
	pswp.on('openingAnimationEnd', () => {
		if (closeAfterOpening) pswp.close();
	});
	pswp.on('destroy', () => {
		document.removeEventListener('keydown', onEarlyEscape, true);
		if (openingAnchor?.isConnected) openingAnchor.focus({ preventScroll: true });
	});

	const compact = window.matchMedia('(max-width: 700px)');
	let showThumbnails = !compact.matches;
	let showContext = false;
	let availableThumbnailCount = 0;
	let thumbnailToggle: HTMLElement;
	let contextToggle: HTMLElement;
	const dock = document.createElement('div');
	dock.className = 'exhibition-dock';
	const caption = document.createElement('p');
	caption.className = 'exhibition-caption';
	caption.setAttribute('aria-live', 'polite');
	const strip = document.createElement('nav');
	strip.className = 'exhibition-thumbnails';
	strip.id = 'exhibition-thumbnails';
	strip.setAttribute('aria-label', 'Neighboring photographs');
	dock.append(caption, strip);
	const panel = document.createElement('aside');
	panel.className = 'exhibition-context';
	panel.id = 'exhibition-context';
	panel.setAttribute('aria-label', 'About this photograph');
	panel.hidden = true;
	root.append(dock, panel);

	const setVisibility = () => {
		strip.hidden = !showThumbnails || availableThumbnailCount < 2;
		panel.hidden = !showContext;
		if (!strip.hidden)
			strip.querySelectorAll<HTMLImageElement>('img[data-thumbnail-src]').forEach((image) => {
				if (!image.getAttribute('src') && image.dataset.thumbnailSrc)
					image.src = image.dataset.thumbnailSrc;
			});
		root.classList.toggle('exhibition-thumbnails-open', !strip.hidden);
		thumbnailToggle?.toggleAttribute('hidden', availableThumbnailCount < 2);
		thumbnailToggle?.setAttribute('aria-expanded', String(!strip.hidden));
		contextToggle?.setAttribute('aria-expanded', String(showContext));
	};
	pswp.ui.registerElement({
		name: 'exhibition-thumbnails',
		order: 8,
		isButton: true,
		title: 'Show or hide neighboring photographs',
		html: 'Photos',
		onInit: (el) => {
			thumbnailToggle = el;
			el.setAttribute('aria-controls', strip.id);
			el.hidden = true;
		},
		onClick: () => {
			showThumbnails = !showThumbnails;
			setVisibility();
		},
	});
	pswp.ui.registerElement({
		name: 'exhibition-context',
		order: 9,
		isButton: true,
		title: 'About this photograph',
		html: 'Info',
		onInit: (el) => {
			contextToggle = el;
			el.setAttribute('aria-controls', panel.id);
		},
		onClick: () => {
			showContext = !showContext;
			setVisibility();
		},
	});

	// Registration after initialization appends controls; retain Close at the far right.
	const toolbar = root.querySelector('.pswp__top-bar');
	for (const selector of ['.pswp__button--zoom', '.pswp__button--close']) {
		const button = toolbar?.querySelector(selector);
		if (button) toolbar?.append(button);
	}

	const renderContext = (data: SlideData) => {
		const restorePanelFocus = panel.contains(document.activeElement);
		panel.replaceChildren();
		const close = document.createElement('button');
		close.type = 'button';
		close.className = 'exhibition-context-close';
		close.textContent = 'Close info';
		close.addEventListener('click', () => {
			showContext = false;
			setVisibility();
			contextToggle.focus();
		});
		const title = document.createElement('p');
		title.className = 'exhibition-context-title';
		title.textContent = captionFor(data);
		panel.append(close, title);
		const dataset = data.element?.dataset ?? {};
		const links = document.createElement('div');
		links.className = 'exhibition-links';
		const seen = new Set<string>();
		const addLink = (value: string | undefined, label: string) => {
			const href = safeUrl(value);
			if (!href || seen.has(href)) return;
			const destination = new URL(href);
			if (
				destination.origin === location.origin &&
				destination.pathname.replace(/\/+$/, '') === location.pathname.replace(/\/+$/, '')
			)
				return;
			seen.add(href);
			const a = document.createElement('a');
			a.href = href;
			a.textContent = label;
			if (
				new URL(href).origin !== location.origin &&
				new URL(href).origin !== 'https://photos.jaydixit.com'
			) {
				a.target = '_blank';
				a.rel = 'noopener noreferrer';
			}
			links.append(a);
		};
		addLink(dataset.exhibitionDetails, 'Photo details');
		addLink(dataset.exhibitionPerson, dataset.exhibitionPersonLabel || 'Portraits');
		addLink(dataset.exhibitionGallery, dataset.exhibitionGalleryLabel || 'View gallery');
		addLink(dataset.exhibitionStory, dataset.exhibitionStoryLabel || 'Read the story');
		addLink(dataset.exhibitionCommons, 'View on Wikimedia Commons');
		addLink(dataset.exhibitionLicenseUrl, dataset.exhibitionLicense || 'Photo license');
		panel.append(links);
		contextToggle.hidden = links.childElementCount === 0;
		if (contextToggle.hidden) showContext = false;
		if (restorePanelFocus) {
			if (showContext) close.focus();
			else root.querySelector<HTMLButtonElement>('.pswp__button--close')?.focus();
		}
		const attribution = dataset.exhibitionAttribution?.trim() || undefined;
		if (attribution) {
			const copy = document.createElement('button');
			copy.type = 'button';
			copy.className = 'exhibition-copy';
			copy.textContent = 'Copy attribution';
			const status = document.createElement('p');
			status.className = 'exhibition-copy-status';
			status.setAttribute('role', 'status');
			copy.addEventListener('click', async () => {
				try {
					await navigator.clipboard.writeText(attribution);
					status.textContent = 'Attribution copied';
				} catch {
					status.textContent = 'Select and copy the attribution below.';
					let fallback = panel.querySelector('textarea');
					if (!fallback) {
						fallback = document.createElement('textarea');
						fallback.readOnly = true;
						fallback.setAttribute('aria-label', 'Photo attribution');
						panel.append(fallback);
					}
					fallback.value = attribution;
					fallback.focus();
					fallback.select();
				}
			});
			panel.append(copy, status);
		}
	};

	const update = () => {
		const data = pswp.currSlide?.data ?? pswp.getItemData(pswp.currIndex);
		caption.textContent = captionFor(data);
		renderContext(data);
		const previousFocus = strip.contains(document.activeElement);
		strip.replaceChildren();
		availableThumbnailCount = 0;
		const total = pswp.getNumItems();
		const start = Math.max(0, Math.min(pswp.currIndex - 3, total - 7));
		for (let index = start; index < Math.min(total, start + 7); index++) {
			const item = pswp.getItemData(index);
			const thumbnailSrc = item.element?.dataset.exhibitionThumb || smallThumbnail(item);
			if (!thumbnailSrc) continue;

			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'exhibition-thumbnail';
			button.setAttribute('aria-label', `View ${captionFor(item) || `photograph ${index + 1}`}`);
			button.setAttribute('aria-current', String(index === pswp.currIndex));
			const img = document.createElement('img');
			img.dataset.thumbnailSrc = thumbnailSrc;
			img.alt = '';
			img.decoding = 'async';
			button.append(img);
			button.disabled = !pswp.opener.isOpen;
			button.addEventListener('click', () => pswp.goTo(index));
			strip.append(button);
			availableThumbnailCount++;
		}
		if (previousFocus) strip.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
		setVisibility();
	};
	const onBreakpoint = () => {
		showThumbnails = !compact.matches;
		setVisibility();
	};
	compact.addEventListener('change', onBreakpoint);
	pswp.on('change', update);
	pswp.on('openingAnimationEnd', update);
	pswp.on('destroy', () => compact.removeEventListener('change', onBreakpoint));
	update();
}

export function installExhibitionViewer() {
	if (installed) return;
	installed = true;
	const attach = () => {
		const pswp = (window as Window & { pswp?: PhotoSwipe }).pswp;
		if (pswp) enhance(pswp);
	};
	// PhotoSwipe publishes window.pswp before appending its root to body. Its
	// documented UI registration API also supports registration after uiRegister.
	new MutationObserver(attach).observe(document.body, { childList: true });
	attach();
}
