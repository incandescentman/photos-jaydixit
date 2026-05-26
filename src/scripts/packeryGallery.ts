import Packery from 'packery';
import imagesLoaded from 'imagesloaded';

type PackeryInstance = any;

type PhotoSwipeLightboxCtor = (typeof import('photoswipe/lightbox'))['default'];

let photoSwipeLoader: Promise<PhotoSwipeLightboxCtor> | null = null;

async function loadPhotoSwipeLightbox(): Promise<PhotoSwipeLightboxCtor> {
	if (!photoSwipeLoader) {
		photoSwipeLoader = Promise.all([
			import('photoswipe/lightbox'),
			import('photoswipe/style.css'),
		]).then(([module]) => module.default as PhotoSwipeLightboxCtor);
	}
	return photoSwipeLoader;
}

export interface PackeryGalleryOptions {
	container: string | HTMLElement;
	adminMode?: boolean;
	adminQueryParam?: string;
	localStorageKey?: string;
	mobileBreakpoint?: number;
	enableToolbar?: boolean;
	enablePhotoSwipe?: boolean;
}

declare global {
	interface Window {
		pckry?: PackeryInstance;
	}
}

export default function initPackeryGallery(options: PackeryGalleryOptions) {
	if (typeof window === 'undefined') return;

	const {
		container,
		adminMode,
		adminQueryParam = 'admin',
		localStorageKey = 'photoOrder',
		mobileBreakpoint = 768,
		enableToolbar = true,
		enablePhotoSwipe = true,
	} = options;

	const resolveContainer = () =>
		typeof container === 'string' ? document.querySelector<HTMLElement>(container) : container;

	const getAdminMode = () => {
		if (typeof adminMode === 'boolean') return adminMode;
		const searchParams = new URLSearchParams(window.location.search);
		return searchParams.get(adminQueryParam) === 'true';
	};

	const isAdminMode = getAdminMode();

	const onReady = async () => {
		const containerEl = resolveContainer();
		if (!containerEl) return;

		if (isAdminMode && enableToolbar) {
			createAdminToolbar();
		}

		const isMobileLayout = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches;

		if (isMobileLayout) {
			setupMobileFallback(containerEl);

			// Setup resize handler even on mobile to allow switching to desktop
			setupResponsiveLayoutHandler({
				container: containerEl,
				pckry: null,
				mobileBreakpoint,
				initialLayout: 'mobile',
			});

			if (enablePhotoSwipe) {
				setupPhotoSwipe({ container: containerEl, isAdminMode });
			}

			return;
		}

		const pckry: PackeryInstance = new Packery(containerEl, {
			itemSelector: '.masonry-item',
			columnWidth: '.grid-sizer',
			gutter: 8,
			percentPosition: false,
			transitionDuration: '0.35s',
			stagger: 30,
			resize: false,
			initLayout: false,
			horizontal: false,
			originLeft: true,
			originTop: true,
		});

		window.pckry = pckry;

		restoreSavedOrder(containerEl, localStorageKey);

		const { setDirty } = setupAdminFeatures({
			container: containerEl,
			pckry,
			isAdminMode,
			localStorageKey,
		});

		await setupPackeryLifecycle({
			container: containerEl,
			pckry,
			isAdminMode,
			localStorageKey,
			setDirty,
		});

		if (enablePhotoSwipe) {
			setupPhotoSwipe({ container: containerEl, isAdminMode });
		}

		// Setup responsive layout switching
		setupResponsiveLayoutHandler({
			container: containerEl,
			pckry,
			mobileBreakpoint,
			initialLayout: 'packery',
		});
	};

	if (document.readyState === 'loading') {
		document.addEventListener(
			'DOMContentLoaded',
			() => {
				onReady().catch((error) => console.error('initPackeryGallery failed', error));
			},
			{ once: true },
		);
	} else {
		onReady().catch((error) => console.error('initPackeryGallery failed', error));
	}
}

let adminToolbarStylesInjected = false;

function injectAdminToolbarStyles() {
	if (adminToolbarStylesInjected) return;
	const style = document.createElement('style');
	style.setAttribute('data-admin-toolbar', '');
	style.textContent = `
    .admin-toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 72px;
      background: #1e3a8a;
      color: #fff;
      padding: 16px 24px;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .admin-toolbar__left {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-right: auto;
    }

    .admin-toolbar__badge {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      background: rgba(255,255,255,0.2);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.3);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      backdrop-filter: blur(10px);
    }

    .admin-toolbar__title {
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -0.025em;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .admin-toolbar__subtitle {
      font-size: 12px;
      opacity: 0.9;
      margin-top: 2px;
    }

    .admin-toolbar__actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .admin-toolbar__button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 12px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.025em;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid rgba(255,255,255,0.3);
      background: rgba(255,255,255,0.2);
      color: #fff;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }

    .admin-toolbar__button:hover {
      background: rgba(255,255,255,0.3);
      transform: translateY(-1px);
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
    }

    .admin-toolbar__button--ghost {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
    }

    .admin-toolbar__button.is-dirty > span:last-of-type::before {
      content: '*';
      margin-right: 4px;
      font-weight: 700;
      color: #f59e0b;
    }

    .toast-notification {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translate(-50%, 10px);
      padding: 12px 24px;
      border-radius: 8px;
      background: #2d3748;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 100000;
      opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
    }

    .toast-notification.is-visible {
      opacity: 1;
      transform: translate(-50%, 0);
    }

    .toast-notification--success {
      background: #2f855a;
    }

    .toast-notification--error {
      background: #c53030;
    }
  `;
	document.head.appendChild(style);
	adminToolbarStylesInjected = true;
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
	document.querySelectorAll('.toast-notification').forEach((t) => t.remove());
	const toast = document.createElement('div');
	toast.className = `toast-notification toast-notification--${type}`;
	toast.textContent = message;
	document.body.appendChild(toast);

	setTimeout(() => {
		toast.classList.add('is-visible');
	}, 10);

	setTimeout(() => {
		toast.classList.remove('is-visible');
		toast.addEventListener('transitionend', () => toast.remove(), { once: true });
	}, 3500);
}

function createAdminToolbar() {
	document.addEventListener('DOMContentLoaded', function createToolbarOnce() {
		document.removeEventListener('DOMContentLoaded', createToolbarOnce);
		injectAdminToolbarStyles();
		const toolbar = document.createElement('div');
		toolbar.className = 'admin-toolbar';
		toolbar.innerHTML = `
      <div class="admin-toolbar__left">
        <div class="admin-toolbar__badge" aria-hidden="true">✨</div>
        <div>
          <div class="admin-toolbar__title">Admin Mode</div>
          <div class="admin-toolbar__subtitle">Drag to resequence • Changes auto-save</div>
        </div>
      </div>
      <div class="admin-toolbar__actions">
        <button id="save-order" type="button" class="admin-toolbar__button">
          <span aria-hidden="true">💾</span>
          <span>Save Sequence</span>
        </button>
        <button id="reset-order" type="button" class="admin-toolbar__button admin-toolbar__button--ghost">
          <span aria-hidden="true">↺</span>
          <span>Reset</span>
        </button>
        <button id="export-order" type="button" class="admin-toolbar__button admin-toolbar__button--ghost">
          <span aria-hidden="true">📥</span>
          <span>Export</span>
        </button>
      </div>
    `;
		document.body.insertBefore(toolbar, document.body.firstChild);
		document.body.style.paddingTop = '72px';
	});
}

function setupMobileFallback(container: HTMLElement) {
	container.classList.add('masonry-mobile');
	const items = Array.from(container.querySelectorAll<HTMLElement>('.masonry-item'));

	container.style.setProperty('display', 'flex', 'important');
	container.style.setProperty('flex-direction', 'column', 'important');
	container.style.setProperty('align-items', 'stretch', 'important');
	container.style.setProperty('justify-content', 'flex-start', 'important');
	container.style.setProperty('gap', '8px', 'important');
	container.style.setProperty('padding', '0', 'important');
	container.style.setProperty('margin', '0 auto', 'important');

	items.forEach((item) => {
		item.style.setProperty('position', 'relative', 'important');
		item.style.setProperty('left', 'auto', 'important');
		item.style.setProperty('top', 'auto', 'important');
		item.style.setProperty('transform', 'none', 'important');
		item.style.setProperty('width', '100%', 'important');
		item.style.setProperty('max-width', '100%', 'important');
		item.style.setProperty('margin', '0', 'important');
		item.style.setProperty('height', 'auto', 'important');
		item.style.setProperty('display', 'block', 'important');
		item.classList.add('animated-in');
		const img = item.querySelector('img');
		if (img) {
			img.style.setProperty('width', '100%', 'important');
			img.style.setProperty('height', 'auto', 'important');
			img.style.setProperty('object-fit', 'contain', 'important');
			img.style.setProperty('max-height', 'none', 'important');
		}
	});

	const gridSizer = container.querySelector<HTMLElement>('.grid-sizer');
	if (gridSizer) {
		gridSizer.style.display = 'none';
	}

	let loadedCount = 0;
	imagesLoaded(container).on('progress', function instanceProgress(_, image) {
		const item = image.img.closest<HTMLElement>('.masonry-item');
		if (!item || item.classList.contains('animated-in')) return;
		const delay = Math.min(loadedCount, 10) * 40;
		setTimeout(() => item.classList.add('animated-in'), delay);
		loadedCount += 1;
	});

	imagesLoaded(container, function allLoaded() {
		items.forEach((item) => {
			if (!item.classList.contains('animated-in')) {
				item.classList.add('animated-in');
			}
		});
	});
}

function restoreSavedOrder(container: HTMLElement, storageKey: string) {
	const savedOrder = localStorage.getItem(storageKey);
	if (!savedOrder) return;

	try {
		const orderArray: string[] = JSON.parse(savedOrder);
		const items = Array.from(container.querySelectorAll<HTMLElement>('.masonry-item'));

		const filenameMap = new Map<string, HTMLElement>();
		const captionMap = new Map<string, HTMLElement>();
		items.forEach((item) => {
			// Use data-filename attribute (works with both local and Cloudinary URLs)
			const filename = item.getAttribute('data-filename') || '';
			const img = item.querySelector('img');
			const caption = img?.getAttribute('alt') || '';
			if (filename) filenameMap.set(filename, item);
			if (caption) captionMap.set(caption, item);
		});

		const looksLikeFilenames = orderArray.every(
			(value) => typeof value === 'string' && /\.[a-zA-Z0-9]+$/.test(value),
		);

		orderArray.forEach((key) => {
			const item = looksLikeFilenames
				? filenameMap.get(key)
				: filenameMap.get(key) || captionMap.get(key);
			if (item) container.appendChild(item);
		});

		console.log('Restored saved order');
	} catch (error) {
		console.error('Failed to restore order:', error);
	}
}

type AdminFeatureParams = {
	container: HTMLElement;
	pckry: PackeryInstance;
	isAdminMode: boolean;
	localStorageKey: string;
};

function setupAdminFeatures({
	container,
	pckry,
	isAdminMode,
	localStorageKey,
}: AdminFeatureParams) {
	if (!isAdminMode) {
		return { setDirty: () => {} }; // Return a no-op function for non-admin mode
	}

	let isDirty = false;
	const saveButton = document.getElementById('save-order');

	const setDirty = (dirty: boolean) => {
		isDirty = dirty;
		saveButton?.classList.toggle('is-dirty', isDirty);
	};

	container.classList.add('admin-mode');

	const setEditKey = (on: boolean) => {
		document.body.classList.toggle('edit-key-active', on);
	};

	document.addEventListener('keydown', (event) => {
		if (event.key.toLowerCase() === 'e') setEditKey(true);
	});
	document.addEventListener('keyup', (event) => {
		if (event.key.toLowerCase() === 'e') setEditKey(false);
	});

	container.addEventListener(
		'mousedown',
		(event) => {
			const wantEdit =
				event.shiftKey ||
				document.body.classList.contains('edit-key-active') ||
				!!(event.target as HTMLElement | null)?.closest('.edit-btn');
			if (!wantEdit) return;
			const anchor = (event.target as HTMLElement | null)?.closest('a');
			if (anchor) {
				event.preventDefault();
				event.stopPropagation();
			}
		},
		true,
	);

	const saveImageMetadata = async (
		filename: string,
		updates: { caption?: string; size?: string },
	) => {
		try {
			const items = Array.from(container.querySelectorAll<HTMLElement>('.masonry-item'));
			const metadata = items.map((entry) => {
				const img = entry.querySelector('img');
				const entryFilename = entry.getAttribute('data-filename');
				const size = entry.getAttribute('data-size');
				const caption = img?.getAttribute('alt') || '';
				if (entryFilename === filename) {
					return {
						filename: entryFilename,
						caption: updates.caption ?? caption,
						size: updates.size ?? size,
					};
				}
				return {
					filename: entryFilename,
					caption,
					size,
				};
			});

			const response = await fetch('/api/save-order', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(metadata),
			});

			if (response.ok) {
				console.log('Metadata saved successfully');
			}
		} catch (error) {
			console.error('Error saving metadata:', error);
		}
	};

	const openEditPopover = (item: HTMLElement) => {
		document.querySelectorAll('.edit-popover').forEach((el) => el.remove());

		const targetImg = item.querySelector('img');
		const filename =
			item.getAttribute('data-filename') || targetImg?.getAttribute('src')?.split('/').pop() || '';
		const currentSize =
			item.getAttribute('data-size') ||
			(item.classList.contains('wide_tall')
				? 'xlportrait'
				: item.classList.contains('wide')
					? 'landscape'
					: 'portrait');
		const currentCaption = (
			targetImg?.getAttribute('data-caption') ||
			targetImg?.getAttribute('alt') ||
			''
		).replace('Jay Dixit photo: ', '');

		const pop = document.createElement('div');
		pop.className = 'edit-popover w-80 rounded-xl border border-gray-200 bg-white shadow-xl p-4';
		pop.innerHTML = `
        <div class="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Edit Image</div>
        <div class="text-xs text-gray-500 mb-2 truncate">${filename}</div>

        <label class="block text-xs font-medium text-gray-700 mb-1">Caption</label>
        <textarea id="ep-caption" class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y min-h-16" placeholder="Enter image caption...">${currentCaption.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>

        ${
					item.querySelector('.stacked-pair')
						? ''
						: `
          <div class="mt-3">
            <label class="block text-xs font-medium text-gray-700 mb-1">Size</label>
            <div id="ep-size-group" class="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-[11px] font-medium text-gray-700 shadow-inner">
              <button data-size="portrait" type="button" class="px-2.5 py-1 rounded-md hover:bg-white">Portrait</button>
              <button data-size="landscape" type="button" class="px-2.5 py-1 rounded-md hover:bg-white">Landscape</button>
              <button data-size="xlportrait" type="button" class="px-2.5 py-1 rounded-md hover:bg-white">XL Portrait</button>
            </div>
            <div class="mt-1.5 text-[11px] text-gray-400">portrait = 1x1 • landscape = 2x1 • xlportrait = 2x2</div>
          </div>`
				}

        <div class="mt-3 flex items-center justify-end gap-2 border-t border-gray-200 pt-3">
          <button class="cancel inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
          <button class="save inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">Save</button>
        </div>
      `;
		item.appendChild(pop);

		const capInput = pop.querySelector<HTMLTextAreaElement>('#ep-caption');
		const sizeGroup = pop.querySelector<HTMLElement>('#ep-size-group');
		let selectedSize = currentSize;

		setTimeout(() => {
			capInput?.focus();
			capInput?.select();
		}, 0);

		const applySize = (val: string) => {
			item.setAttribute('data-size', val);
			item.classList.remove('regular', 'wide', 'wide_tall');
			item.classList.add(
				val === 'landscape' ? 'wide' : val === 'xlportrait' ? 'wide_tall' : 'regular',
			);
			try {
				pckry.layout();
				if (typeof (pckry as any).shiftLayout === 'function') {
					(pckry as any).shiftLayout();
				}
			} catch (error) {
				console.warn('Packery layout failed after size change', error);
			}
		};

		if (sizeGroup) {
			const updateButtons = () => {
				sizeGroup.querySelectorAll('button').forEach((btn) => {
					const val = btn.getAttribute('data-size');
					const active = val === selectedSize;
					btn.classList.toggle('bg-white', active);
					btn.classList.toggle('text-indigo-600', active);
					btn.classList.toggle('shadow', active);
					btn.classList.toggle('ring-1', active);
					btn.classList.toggle('ring-indigo-200', active);
				});
			};
			sizeGroup.addEventListener('click', (event) => {
				const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
					'button[data-size]',
				);
				if (!button) return;
				const value = button.getAttribute('data-size');
				if (!value) return;
				selectedSize = value;
				updateButtons();
			});
			updateButtons();
		}

		const cleanup = () => {
			document.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('mousedown', onAway, true);
			pop.remove();
		};

		const doSave = async () => {
			const newCaption = (capInput?.value || '').trim();
			const newSize = selectedSize;

			if (targetImg) {
				targetImg.setAttribute('alt', 'Jay Dixit photo: ' + newCaption);
				targetImg.setAttribute('data-caption', newCaption);
			}
			const captionOverlay = item.querySelector('.caption-overlay h3');
			if (captionOverlay) {
				captionOverlay.textContent = newCaption;
			}

			if (sizeGroup) {
				applySize(newSize);
			}

			await saveImageMetadata(filename, { size: newSize, caption: newCaption });
			cleanup();
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') cleanup();
			if (event.key === 'Enter') doSave();
		};
		const onAway = (event: MouseEvent) => {
			if (!pop.contains(event.target as Node)) cleanup();
		};

		document.addEventListener('keydown', onKeyDown);
		setTimeout(() => document.addEventListener('mousedown', onAway, true), 0);

		pop.querySelector('.save')?.addEventListener('click', doSave);
		pop.querySelector('.cancel')?.addEventListener('click', cleanup);
	};

	container.addEventListener(
		'click',
		(event) => {
			const target = event.target as HTMLElement | null;
			const triggeredByBtn = !!target?.closest('.edit-btn');
			const wantEdit =
				triggeredByBtn || event.shiftKey || document.body.classList.contains('edit-key-active');
			if (!wantEdit) return;

			const item = target?.closest<HTMLElement>('.masonry-item');
			if (!item) return;
			if (item.classList.contains('is-dragging')) return;

			event.preventDefault();
			event.stopPropagation();
			if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

			openEditPopover(item);
		},
		true,
	);

	saveButton?.addEventListener('click', async () => {
		const items = pckry.getItemElements();
		const order = items.map((entry) => {
			const img = entry.querySelector('img');
			const src = img?.getAttribute('src') || '';
			const filename = entry.getAttribute('data-filename') || src.split('/').pop();
			const size =
				entry.getAttribute('data-size') ||
				(entry.classList.contains('wide_tall')
					? 'xlportrait'
					: entry.classList.contains('wide')
						? 'landscape'
						: 'portrait');
			return {
				filename,
				caption: img?.getAttribute('alt') || '',
				size,
			};
		});

		const orderFilenames = order.map((entry) => entry.filename).filter(Boolean) as string[];
		localStorage.setItem(localStorageKey, JSON.stringify(orderFilenames));

		try {
			const response = await fetch('/api/save-order', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(order),
			});

			if (response.ok) {
				showToast('Sequence saved to server!', 'success');
				setDirty(false);
			} else {
				const result = await response.json();
				showToast(`Error: ${result.message || 'Could not save to server.'}`, 'error');
			}
		} catch (error) {
			console.error('Error saving to server:', error);
			showToast('Sequence saved locally only.', 'info');
		}
	});

	document.getElementById('reset-order')?.addEventListener('click', () => {
		if (confirm('Reset to default order?')) {
			localStorage.removeItem(localStorageKey);
			window.location.reload();
		}
	});

	document.getElementById('export-order')?.addEventListener('click', () => {
		const items = pckry.getItemElements();
		const order = items.map((entry) => {
			const img = entry.querySelector('img');
			const src = img?.getAttribute('src') || '';
			const filename = entry.getAttribute('data-filename') || src.split('/').pop();
			const size =
				entry.getAttribute('data-size') ||
				(entry.classList.contains('wide_tall')
					? 'xlportrait'
					: entry.classList.contains('wide')
						? 'landscape'
						: 'portrait');
			return {
				filename,
				caption: img?.getAttribute('alt') || '',
				size,
			};
		});

		const dataStr = JSON.stringify(order, null, 2);
		const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
		const exportLink = document.createElement('a');
		exportLink.setAttribute('href', dataUri);
		exportLink.setAttribute('download', 'photo-order.json');
		document.body.appendChild(exportLink);
		exportLink.click();
		document.body.removeChild(exportLink);
	});

	// Return setDirty to be used in other scopes
	return { setDirty };
}

type PackeryLifecycleOptions = {
	container: HTMLElement;
	pckry: PackeryInstance;
	isAdminMode: boolean;
	localStorageKey: string;
	setDirty: (dirty: boolean) => void;
};

async function setupPackeryLifecycle({
	container,
	pckry,
	isAdminMode,
	localStorageKey,
	setDirty,
}: PackeryLifecycleOptions) {
	const allItems = container.querySelectorAll('.masonry-item');
	let loadedCount = 0;

	imagesLoaded(container).on('progress', function (_, image) {
		const item = image.img.closest<HTMLElement>('.masonry-item');
		if (item && !item.classList.contains('animated-in')) {
			setTimeout(() => item.classList.add('animated-in'), loadedCount * 40);
			loadedCount += 1;
		}
		pckry.shiftLayout();
	});

	const DraggabillyCtor = isAdminMode ? (await import('draggabilly')).default : undefined;

	imagesLoaded(container, function () {
		pckry.layout();
		pckry.shiftLayout();

		const items = pckry.getItemElements();
		items.forEach((item) => {
			pckry.fit(item);
		});

		pckry.layout();

		allItems.forEach((item) => {
			if (!item.classList.contains('animated-in')) {
				item.classList.add('animated-in');
			}

			if (isAdminMode && DraggabillyCtor) {
				const draggie = new DraggabillyCtor(item as Element, {
					handle: '.masonry-link',
					containment: container,
				});

				let dragging = false;

				draggie.on('dragStart', () => {
					dragging = true;
					item.classList.add('is-dragging');
					container.classList.add('is-sorting');
					item.querySelectorAll('.masonry-link').forEach((link) => {
						(link as HTMLElement).style.pointerEvents = 'none';
					});
				});

				draggie.on('dragEnd', () => {
					setTimeout(() => {
						dragging = false;
						item.querySelectorAll('.masonry-link').forEach((link) => {
							(link as HTMLElement).style.pointerEvents = '';
						});
					}, 100);

					item.classList.remove('is-dragging');
					container.classList.remove('is-sorting');
				});

				item.addEventListener(
					'click',
					(event) => {
						if (dragging) {
							event.preventDefault();
							event.stopPropagation();
						}
					},
					true,
				);

				pckry.bindDraggabillyEvents(draggie);
			}
		});

		if (isAdminMode) {
			pckry.on('dragItemPositioned', () => {
				const items = pckry.getItemElements();
				const orderFilenames = items
					.map((item) => {
						const img = item.querySelector('img');
						if (!img) return '';
						const src = img.getAttribute('src') || '';
						return src.split('/').pop() || '';
					})
					.filter(Boolean);
				localStorage.setItem(localStorageKey, JSON.stringify(orderFilenames));
				showToast('Sequence auto-saved locally.', 'info');
				setDirty(true);
			});
		}
	});
}

type ResponsiveLayoutHandlerOptions = {
	container: HTMLElement;
	pckry: PackeryInstance | null;
	mobileBreakpoint: number;
	initialLayout: 'packery' | 'mobile';
};

function setupResponsiveLayoutHandler({
	container,
	pckry,
	mobileBreakpoint,
	initialLayout,
}: ResponsiveLayoutHandlerOptions) {
	let currentLayout: 'packery' | 'mobile' = initialLayout;

	const handleResize = () => {
		const isMobile = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches;

		if (isMobile && currentLayout === 'packery') {
			// Switch from Packery to mobile layout
			console.log('Switching to mobile layout');

			// Destroy Packery to remove absolute positioning
			if (pckry && typeof pckry.destroy === 'function') {
				pckry.destroy();
			}

			// Apply mobile fallback
			setupMobileFallback(container);
			currentLayout = 'mobile';
		} else if (!isMobile && currentLayout === 'mobile') {
			// Switch from mobile to Packery layout
			console.log('Switching to Packery layout - reloading page');

			// Reload is safest to reinit Packery properly
			window.location.reload();
		}
	};

	// Debounce resize handler
	const debouncedResize = debounce(handleResize, 250);
	window.addEventListener('resize', debouncedResize);

	// Handle manual Packery resize when in desktop mode
	if (pckry && typeof pckry.layout === 'function') {
		const packeryResize = debounce(() => {
			if (currentLayout === 'packery') {
				pckry.layout();
			}
		}, 150);
		window.addEventListener('resize', packeryResize);
	}
}

type PhotoSwipeOptions = {
	container: HTMLElement;
	isAdminMode: boolean;
};

function setupPhotoSwipe({ container, isAdminMode }: PhotoSwipeOptions) {
	let lightbox: InstanceType<PhotoSwipeLightboxCtor> | null = null;
	let initialization: Promise<InstanceType<PhotoSwipeLightboxCtor>> | null = null;

	const initializeLightbox = async () => {
		if (lightbox) return lightbox;
		if (initialization) return initialization;

		initialization = (async () => {
			const PhotoSwipeLightbox = await loadPhotoSwipeLightbox();
			const nextLightbox = new PhotoSwipeLightbox({
				gallery: '.masonry-items',
				children: '.portfolio-lightbox',
				pswpModule: () => import('photoswipe'),
				padding: { top: 20, bottom: 80, left: 20, right: 20 },
				wheelToZoom: true,
				escKey: true,
				imageClickAction: 'close',
				tapAction: 'toggle-controls',
				doubleTapAction: 'zoom',
				preloaderDelay: 0,
				showHideAnimationType: 'fade',
			});

			if (isAdminMode) {
				nextLightbox.on('clickEvent', (event) => {
					const target = event.originalEvent.target as HTMLElement | null;
					const item = target?.closest('.masonry-item');
					if (item && item.classList.contains('is-dragging')) {
						event.preventDefault();
					}
				});
			}

			nextLightbox.addFilter('itemData', (itemData) => {
				const linkEl = itemData.element as HTMLElement;
				const imgEl = linkEl.querySelector('img');
				const linkWidth = parseInt(linkEl.getAttribute('data-pswp-width') || '', 10);
				const linkHeight = parseInt(linkEl.getAttribute('data-pswp-height') || '', 10);
				const fullSrc =
					linkEl.getAttribute('data-full-src') ||
					imgEl?.getAttribute('data-full-src') ||
					linkEl.getAttribute('href') ||
					itemData.src;
				const responsiveSrcset = linkEl.getAttribute('data-pswp-srcset') || undefined;
				const thumbSrc = imgEl?.currentSrc || imgEl?.getAttribute('src') || undefined;

				const imgDataWidth = imgEl
					? parseInt(imgEl.getAttribute('data-natural-width') || '', 10)
					: NaN;
				const imgDataHeight = imgEl
					? parseInt(imgEl.getAttribute('data-natural-height') || '', 10)
					: NaN;
				const widthCandidates = [
					linkWidth,
					imgDataWidth,
					Number(itemData.w),
					imgEl?.naturalWidth,
					imgEl?.width,
					1600,
				];
				const heightCandidates = [
					linkHeight,
					imgDataHeight,
					Number(itemData.h),
					imgEl?.naturalHeight,
					imgEl?.height,
					1200,
				];
				const resolvedWidth =
					widthCandidates.find((value) => Number.isFinite(value) && Number(value) > 0) ?? 1600;
				const resolvedHeight =
					heightCandidates.find((value) => Number.isFinite(value) && Number(value) > 0) ?? 1200;

				itemData.w = Number(resolvedWidth);
				itemData.h = Number(resolvedHeight);

				if (imgEl) {
					itemData.alt = imgEl.alt;
					const caption = imgEl.getAttribute('data-caption') || imgEl.alt || '';
					if (caption) {
						itemData.title = caption;
					}
				}

				if (fullSrc) {
					itemData.src = fullSrc;
				}

				if (responsiveSrcset) {
					itemData.srcset = responsiveSrcset;
				}

				if (thumbSrc) {
					itemData.msrc = thumbSrc;
				}

				if (linkEl.getAttribute('data-cropped') === 'true') {
					itemData.thumbCropped = true;
				}

				return itemData;
			});

			nextLightbox.on('uiRegister', () => {
				nextLightbox.pswp.ui.registerElement({
					name: 'custom-caption',
					order: 9,
					isButton: false,
					appendTo: 'root',
					onInit: (el, pswp) => {
						el.style.position = 'absolute';
						el.style.left = '0';
						el.style.bottom = '0';
						el.style.width = '100%';
						el.style.maxWidth = '100%';
						el.style.padding = '15px 20px';
						el.style.background = 'rgba(0, 0, 0, 0.75)';
						el.style.color = '#fff';
						el.style.fontSize = '16px';
						el.style.fontFamily =
							'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
						el.style.textAlign = 'center';
						el.style.lineHeight = '1.4';
						el.style.zIndex = '10';

						pswp.on('change', () => {
							const currSlideData = pswp.currSlide?.data;
							if (currSlideData?.title) {
								el.textContent = currSlideData.title;
								el.style.display = 'block';
							} else {
								el.style.display = 'none';
							}
						});

						setTimeout(() => {
							const currSlideData = pswp.currSlide?.data;
							if (currSlideData?.title) {
								el.textContent = currSlideData.title;
								el.style.display = 'block';
							}
						}, 0);
					},
				});
			});

			nextLightbox.init();
			lightbox = nextLightbox;
			return nextLightbox;
		})().catch((error) => {
			initialization = null;
			throw error;
		});

		return initialization;
	};

	const cleanupInitialHandlers = () => {
		container.removeEventListener('click', clickHandler, true);
		container.removeEventListener('keydown', keyHandler);
	};

	const getInitialPoint = (event: MouseEvent | KeyboardEvent) => {
		if (!(event instanceof MouseEvent)) return null;
		if (!event.clientX && !event.clientY) return null;
		return { x: event.clientX, y: event.clientY };
	};

	const openFromInitialEvent = (event: MouseEvent | KeyboardEvent, anchor: HTMLElement) => {
		const links = Array.from(container.querySelectorAll<HTMLElement>('.portfolio-lightbox'));
		const index = links.findIndex((link) => link === anchor || link.contains(anchor));
		if (index < 0) return;

		event.preventDefault();
		event.stopPropagation();

		initializeLightbox()
			.then((readyLightbox) => {
				cleanupInitialHandlers();
				readyLightbox.loadAndOpen(index, { gallery: container }, getInitialPoint(event));
			})
			.catch((error) => {
				console.error('Failed to initialize PhotoSwipe', error);
			});
	};

	const clickHandler = (event: MouseEvent) => {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}

		const target = event.target as HTMLElement | null;
		const anchor = target?.closest<HTMLElement>('.portfolio-lightbox');
		if (!anchor || !container.contains(anchor)) return;

		openFromInitialEvent(event, anchor);
	};

	const keyHandler = (event: KeyboardEvent) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;

		const target = event.target as HTMLElement | null;
		const anchor = target?.closest<HTMLElement>('.portfolio-lightbox');
		if (!anchor || !container.contains(anchor)) return;

		openFromInitialEvent(event, anchor);
	};

	container.addEventListener('click', clickHandler, true);
	container.addEventListener('keydown', keyHandler);
}

// Debounce helper function
function debounce<T extends (...args: any[]) => void>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}
