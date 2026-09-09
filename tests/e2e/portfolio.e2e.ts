import { expect, test, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

type SmokeRoute = {
	name: string;
	path: string;
	title: RegExp;
	heading?: string | RegExp;
	minImages: number;
	minLightboxLinks?: number;
	lightboxSelector?: string;
};

const routes: SmokeRoute[] = [
	{
		name: 'homepage',
		path: '/',
		title: /Red Carpet Photography for Wikipedia — Jay Dixit/,
		heading: 'Jay Dixit: Red Carpet Photographer',
		minImages: 20,
		minLightboxLinks: 7,
		lightboxSelector: 'a[data-pswp-item]',
	},
	{
		name: 'legacy photo wall',
		path: '/photo-wall/',
		title: /Photo Wall — Jay Dixit/,
		minImages: 20,
		minLightboxLinks: 20,
	},
	{
		name: 'gallery index',
		path: '/gallery/',
		title: /Photo Galleries — Jay Dixit/,
		heading: 'Photo Galleries',
		minImages: 4,
	},
	{
		name: 'red-carpet index',
		path: '/red-carpet/',
		title: /Red Carpet Photos — Jay Dixit/,
		heading: 'Red Carpet Photos',
		minImages: 20,
	},
	{
		name: 'Sundance gallery',
		path: '/gallery/red-carpet/sundance/',
		title: /Sundance Gallery — Jay Dixit/,
		heading: 'Sundance',
		minImages: 1,
		minLightboxLinks: 1,
	},
	{
		name: 'Conan photo detail',
		path: '/gallery/photo/red-carpet/sundance/conan-obrien_sundance_2024/',
		title: /Conan Obrien at Sundance in 2024 — Jay Dixit/,
		heading: 'Conan Obrien at Sundance in 2024',
		minImages: 1,
	},
	{
		name: 'blog index',
		path: '/blog/',
		title: /Blog — Jay Dixit/,
		heading: 'Notes From the Field',
		minImages: 2,
	},
	{
		name: 'about page',
		path: '/about/',
		title: /Jay Dixit/,
		heading: 'Why I Take Photos',
		minImages: 2,
	},
	{
		name: 'contact page',
		path: '/contact/',
		title: /Contact — Jay Dixit/,
		heading: /Let.s Talk/,
		minImages: 1,
	},
];

async function waitForInitialImages(page: Page) {
	await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
	await page.waitForTimeout(500);
}

async function captureReview(page: Page, name: string) {
	const directory = process.env.PHOTOS_REVIEW_SCREENSHOTS;
	if (!directory) return;
	if (await page.locator('.pswp[data-exhibition-viewer]').isVisible()) {
		await expect
			.poll(() =>
				page.evaluate(() => {
					const image = window.pswp?.currSlide?.content.element;
					if (!(image instanceof HTMLImageElement) || !image.complete || !image.naturalWidth)
						return false;
					const bounds = image.getBoundingClientRect();
					return Math.abs(bounds.left + bounds.width / 2 - innerWidth / 2) < 2;
				}),
			)
			.toBe(true);
		await expect
			.poll(() =>
				page
					.locator('.exhibition-thumbnails:not([hidden]) img')
					.evaluateAll((images: HTMLImageElement[]) =>
						images.every((image) => image.complete && image.naturalWidth > 0),
					),
			)
			.toBe(true);
	}
	const { mkdir } = await import('node:fs/promises');
	await mkdir(directory, { recursive: true });
	await page.screenshot({ path: `${directory}/${name}.png` });
}

async function getBrokenCompletedImages(page: Page) {
	return page.evaluate(() =>
		Array.from(document.images)
			.filter((image) => {
				const source = image.currentSrc || image.src;
				if (!source) return false;
				const rect = image.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) return false;
				return image.complete && image.naturalWidth === 0;
			})
			.map((image) => image.currentSrc || image.src || image.alt),
	);
}

test.describe('portfolio smoke checks', () => {
	for (const route of routes) {
		test(`${route.name} renders expected content`, async ({ page }) => {
			await page.goto(route.path);
			await waitForInitialImages(page);

			await expect(page).toHaveTitle(route.title);

			if (route.heading) {
				await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible();
			}

			expect(await page.locator('img').count()).toBeGreaterThanOrEqual(route.minImages);

			if (route.minLightboxLinks) {
				const lightboxSelector = route.lightboxSelector ?? '.portfolio-lightbox';
				expect(await page.locator(lightboxSelector).count()).toBeGreaterThanOrEqual(
					route.minLightboxLinks,
				);
			}

			expect(await getBrokenCompletedImages(page)).toEqual([]);
		});
	}
});

test('site nav renders redesigned desktop and mobile states', async ({ page }) => {
	await page.setViewportSize({ width: 1728, height: 1000 });
	await page.goto('/about/');
	await waitForInitialImages(page);

	const header = page.locator('[data-portfolio-header]');
	const nav = header.locator('.portfolio-nav-primary');
	await expect(nav).toBeVisible();
	await expect(header.getByRole('link', { name: 'Jay Dixit Photos, homepage' })).toHaveAttribute(
		'href',
		'/',
	);
	await expect(nav.getByRole('link', { name: 'About Me' })).toHaveAttribute('aria-current', 'page');
	await expect(nav.getByRole('link', { name: 'Covering the Nobel Prizes' })).toHaveAttribute(
		'href',
		'/nobel-2024',
	);
	await expect(nav.getByRole('link', { name: 'Red Carpet', exact: true })).toHaveCount(0);
	await expect(nav.getByRole('link', { name: 'Why WikiPortraits' })).toHaveAttribute(
		'href',
		'/blog/wikiportraits-story',
	);

	const externalLink = nav.getByRole('link', { name: 'jaydixit.com' });
	await expect(externalLink).toHaveAttribute('target', '_blank');
	await expect(externalLink).toHaveAttribute('rel', /noopener/);

	await page.setViewportSize({ width: 390, height: 820 });
	await page.goto('/about/');

	const toggle = page.locator('[data-portfolio-menu-toggle]');
	await expect(toggle).toBeVisible();
	await toggle.click();

	const mobileMenu = page.locator('[data-portfolio-menu-panel]');
	await expect(mobileMenu).toBeVisible();
	await expect(mobileMenu.getByRole('link', { name: 'About Me' })).toHaveAttribute(
		'aria-current',
		'page',
	);
	await expect(mobileMenu.getByRole('link', { name: 'Covering the Nobel Prizes' })).toHaveAttribute(
		'href',
		'/nobel-2024',
	);
	await expect(mobileMenu.getByRole('link', { name: 'Red Carpet', exact: true })).toHaveCount(0);
	await expect(mobileMenu.locator('.portfolio-menu-social a')).toHaveCount(3);
	await page.keyboard.press('Escape');
	await expect(mobileMenu).toBeHidden();
	await expect(toggle).toBeFocused();
	await toggle.click();
	await page.mouse.click(8, 810);
	await expect(mobileMenu).toBeHidden();
});

test('mobile homepage does not repeat hero photographs in the wall', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await waitForInitialImages(page);

	const heroSources = await page
		.locator('#hero-print-gallery a[data-pswp-item]')
		.evaluateAll((links) => links.map((link) => link.getAttribute('data-full-src')));
	const mobileWallLinks = page.locator(
		'[data-wall-card]:not([data-mobile-duplicate="true"]) a[data-pswp-item]',
	);
	const mobileWallCards = page.locator('[data-wall-card]:not([data-mobile-duplicate="true"])');
	const wallSources = await mobileWallLinks.evaluateAll((links) =>
		links.map((link) => link.getAttribute('data-full-src')),
	);

	await expect(mobileWallLinks).toHaveCount(14);
	expect(
		await page
			.locator('[data-wall-card][data-mobile-duplicate="true"]')
			.evaluateAll((cards) => cards.map((card) => getComputedStyle(card).display)),
	).toEqual(Array(10).fill('none'));
	expect(wallSources.filter((source) => heroSources.includes(source))).toEqual([]);
	await expect(
		page.locator('[data-wall-card]:not([data-mobile-duplicate="true"]) .wall-number-mobile'),
	).toHaveText(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14']);

	for (const [index, caption] of [
		[11, 'Jack Johnson at SXSW 2026'],
		[12, 'Nobel Peace Prize Torchlight Procession in Oslo, 2024'],
		[13, 'Nobel Peace Prize Torchlight Procession in Oslo, 2024'],
	] as const) {
		await expect(mobileWallCards.nth(index)).toHaveClass(/wall-full-landscape/);
		await expect(mobileWallLinks.nth(index)).toHaveAttribute('data-pswp-caption', caption);
	}

	await mobileWallLinks.first().scrollIntoViewIfNeeded();
	await expect(mobileWallLinks.first()).toBeVisible();
	await mobileWallLinks.first().click();
	await expect(page.locator('.pswp__counter')).toHaveText('1 / 14');
});

for (const route of ['/', '/gallery/red-carpet/sundance/']) {
	test(`PhotoSwipe opens on first click and Escape closes on ${route}`, async ({ page }) => {
		await page.goto(route);
		await waitForInitialImages(page);

		const lightboxSelector = route === '/' ? 'a[data-pswp-item]' : '.portfolio-lightbox';
		const firstLightboxLink = page.locator(lightboxSelector).first();
		await expect(firstLightboxLink).toBeVisible();
		await firstLightboxLink.click();

		const lightbox = page.locator('.pswp');
		await expect(lightbox).toBeVisible();
		await expect(page.locator('.pswp img.pswp__img').first()).toBeVisible();
		await expect(lightbox).toHaveClass(/pswp--open/);
		await page.waitForTimeout(750);

		await page.keyboard.press('Escape');
		await expect(lightbox).toBeHidden();
	});
}

test('photo wall is noindexed and internal promoted experiment URLs are absent', async ({
	page,
	request,
}) => {
	await page.goto('/photo-wall/');
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
		'content',
		/^noindex,\s*nofollow$/,
	);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		'https://photos.jaydixit.com/photo-wall/',
	);

	for (const path of ['/experiments/kinetic-editorial/', '/experiments/red-carpet-sequence/']) {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status()).toBe(404);
	}
});

test('experiments page exposes the restored six-city Red Carpets concept lab', async ({ page }) => {
	await page.goto('/experiments/');

	const conceptLab = page.getByRole('link', { name: /Red Carpets — Six Cities/ });
	await expect(conceptLab).toHaveAttribute('href', '/red-carpets/variants/');
	await conceptLab.click();
	await expect(page).toHaveURL(/\/red-carpets\/variants\/?$/);
	await expect(page.locator('.concept-card')).toHaveCount(6);

	await page.goto('/red-carpets/passport/');
	await expect(page.locator('.passport-page')).toHaveCount(6);
	await expect(page.locator('.passport-stamp')).toHaveCount(6);

	await page.goto('/red-carpets/departures/');
	await expect(page.locator('.board-trigger')).toHaveCount(6);

	await page.goto('/red-carpets/the-route/');
	await expect(page.locator('[data-route-map-stop]')).toHaveCount(6);
});

test('red-carpets hero uses the split-flap board as its city navigation', async ({ page }) => {
	await page.goto('/red-carpets/');

	const board = page.locator('.world-route-board');
	await expect(board).toBeVisible();
	await expect(board.locator('.world-board-trigger')).toHaveCount(6);
	await expect(board.locator('.world-board-trigger').first()).toHaveAttribute('href', '#stockholm');
	await expect(board.locator('[data-world-board-text] i').first()).toBeVisible();

	await board.locator('.world-board-trigger').first().click();
	await expect(page).toHaveURL(/#stockholm$/);
});

test('space advances through the red-carpets city chapters', async ({ page }) => {
	await page.goto('/red-carpets/');

	for (const cityId of ['stockholm', 'busan', 'locarno', 'park-city', 'austin', 'toronto']) {
		await page.keyboard.press('Space');
		await expect
			.poll(() =>
				page.evaluate((id) => {
					const chapter = document.getElementById(id);
					const rootStyles = getComputedStyle(document.documentElement);
					const navClearanceValue = rootStyles.getPropertyValue('--nav-clearance').trim();
					const navClearance =
						(Number.parseFloat(navClearanceValue) || 0) *
						(navClearanceValue.endsWith('rem') ? Number.parseFloat(rootStyles.fontSize) || 16 : 1);
					return chapter ? Math.abs(chapter.getBoundingClientRect().top - navClearance) : Infinity;
				}, cityId),
			)
			.toBeLessThan(2);
	}
});

test('red-carpet index renders editorial person cards from generated data', async ({ page }) => {
	await page.goto('/red-carpet/');
	await waitForInitialImages(page);

	const cards = page.locator('.rc-card');
	await expect(cards).toHaveCount(23);
	await expect(cards.filter({ hasText: 'Jack Johnson' })).toHaveCount(1);
	await expect(page.locator('.rc-name').first()).toHaveText('Ana de Armas');
	await expect(page.locator('.rc-count').first()).toContainText(/photo/i);

	await expect
		.poll(() =>
			cards
				.first()
				.locator('img')
				.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
		)
		.toBe(true);
	expect(await getBrokenCompletedImages(page)).toEqual([]);
});

test('TIFF gallery renders the metadata-reviewed 2025 set with truthful captions', async ({
	page,
}) => {
	await page.goto('/gallery/red-carpet/tiff/');
	await waitForInitialImages(page);

	const cards = page.locator('.masonry-item');
	await expect(cards).toHaveCount(7);
	await expect(
		page.locator('.masonry-item', {
			has: page.getByAltText('Jason Bateman at the Toronto Film Festival.'),
		}),
	).toHaveCount(1);
	await expect(
		page.getByAltText('Jason Bateman, Jude Law, and Ben Jackson at the Toronto Film Festival.'),
	).toHaveCount(1);

	for (const card of await cards.all()) {
		await card.scrollIntoViewIfNeeded();
		await expect
			.poll(() =>
				card
					.locator('img')
					.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
			)
			.toBe(true);
	}

	expect(await getBrokenCompletedImages(page)).toEqual([]);
});

test('red-carpet person pages render confirmed Wikimedia provenance only', async ({ page }) => {
	await page.goto('/red-carpet/lisa-gilroy/');
	await waitForInitialImages(page);

	await expect(page.getByText('Currently the lead photo on Wikipedia')).toBeVisible();
	await expect(page.getByText('Photo by Jay Dixit')).toBeVisible();
	await expect(page.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute(
		'href',
		'https://creativecommons.org/licenses/by/4.0/',
	);
	await expect(page.getByRole('link', { name: 'View on Wikimedia Commons' })).toHaveAttribute(
		'href',
		'https://commons.wikimedia.org/wiki/File:Lisa_Gilroy_at_SXSW_in_2025.jpg',
	);

	await page.goto('/red-carpet/nicholas-braun/');
	await waitForInitialImages(page);

	await expect(page.getByText('Currently the lead photo on Wikipedia')).toHaveCount(0);
	await expect(page.getByText('Photo by Jay Dixit')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'View on Wikimedia Commons' })).toHaveCount(0);
});

test('blog index renders editorial post list with live thumbnails', async ({ page }) => {
	await page.goto('/blog/');
	await waitForInitialImages(page);

	const posts = page.locator('.post');
	await expect(posts).toHaveCount(2);
	await expect(page.locator('.post-title').first()).toHaveText('Hello From the Darkroom');
	await expect(page.locator('.post-date').first()).toHaveText('October 1, 2025');
	await expect(
		posts.filter({ hasText: 'The Story of WikiPortraits' }).locator('.post-date'),
	).toHaveText('October 1, 2024');
	await expect(page.locator('.post-more').first()).toContainText('Read story');

	await expect
		.poll(() =>
			page
				.locator('.post-img')
				.evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
		)
		.toBe(true);
	expect(await getBrokenCompletedImages(page)).toEqual([]);
});

test('blog detail and related post dates render in UTC', async ({ page }) => {
	await page.goto('/blog/hello-world/');
	await waitForInitialImages(page);

	await expect(page.locator('article time')).toHaveText('October 1, 2025');
	await expect(
		page.locator('section', { hasText: 'Related essays' }).getByText('Oct 1, 2024'),
	).toBeVisible();
});

test('contact page preserves Formspree form and editorial fields', async ({ page }) => {
	await page.goto('/contact/');

	const form = page.locator('.contact-form');
	await expect(form).toHaveAttribute('action', 'https://formspree.io/f/xeelzjpn');
	await expect(form.locator('input[name="_gotcha"]')).toHaveCount(1);
	await expect(form.locator('.field')).toHaveCount(4);
	await expect(form.getByRole('button', { name: 'Send Message' })).toBeVisible();
});

test('about page renders the approved editorial links and philosophy section', async ({ page }) => {
	await page.goto('/about/');
	await waitForInitialImages(page);

	await expect(page.getByRole('heading', { name: 'Why I Take Photos' })).toBeVisible();
	await expect(page.locator('.ed-link-list .ed-link')).toHaveCount(3);
	await expect(page.getByRole('link', { name: 'Visit jaydixit.com' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Socratic AI' })).toBeVisible();
	await expect(
		page.locator('.ed-link-list').getByRole('link', { name: 'Get in Touch', exact: true }),
	).toBeVisible();
	await expect(page.locator('.ed-quote-photo img')).toBeVisible();
	await expect(page.locator('.ed-card')).toHaveCount(0);
	await expect(page.locator('.ed-ai-card')).toHaveCount(0);
	expect(await getBrokenCompletedImages(page)).toEqual([]);
});

test('before-after page renders source captions and loads comparison images after scroll', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1728, height: 1000 });
	await page.goto('/before-and-after/');
	await waitForInitialImages(page);

	await expect(page).toHaveTitle(/Before & After/);
	await expect(page.getByRole('heading', { name: 'Before & After' })).toBeVisible();
	await expect(
		page.locator('.portfolio-nav-primary').getByRole('link', { name: 'About Me' }),
	).toHaveAttribute('href', '/about');
	await expect(
		page.locator('.portfolio-nav-primary').getByRole('link', { name: 'Covering the Nobel Prizes' }),
	).toHaveAttribute('href', '/nobel-2024');
	await expect(
		page
			.locator('.portfolio-nav-primary')
			.getByRole('link', { name: 'Red Carpets Around the World' }),
	).toHaveCount(0);
	await expect(
		page.locator('.portfolio-nav-primary').getByRole('link', { name: 'Red Carpet', exact: true }),
	).toHaveCount(0);

	const comparisonCards = page.locator('.comparison-card');
	await expect(comparisonCards).toHaveCount(8);
	await expect(comparisonCards.getByRole('heading')).toHaveText([
		'Jason Bateman',
		'Vanessa Kirby',
		'Sydney Sweeney',
		'Lisa Gilroy',
		'Jeremy Strong',
		'Sebastian Stan',
		'John Hopfield',
		'Fondazione Prada, Milan',
	]);
	await expect(page.locator('.comparison-transition')).toHaveCount(8);
	await expect(page.locator('.comparison-caption')).toHaveCount(16);
	await expect(page.locator('.comparison-toc a')).toHaveCount(8);
	await expect(
		page.locator('.comparison-caption', { hasText: 'Jay Dixit, TIFF 2025' }),
	).toBeVisible();
	await expect(
		page.locator('.comparison-caption', { hasText: 'Glenn Francis, 2019' }),
	).toBeVisible();
	await expect(
		page.locator('.comparison-caption', { hasText: 'The Beaverton, 2019' }),
	).toBeVisible();
	await expect(
		page.locator('.comparison-caption', { hasText: 'Jay Dixit, SXSW 2025' }),
	).toBeVisible();
	await expect(
		page.locator('.comparison-caption', {
			hasText: 'Gage Skidmore, San Diego Comic-Con 2019',
		}),
	).toBeVisible();
	await expect(
		page.locator('.comparison-caption', { hasText: 'Jay Dixit, New York City 2024' }),
	).toBeVisible();
	await expect(
		page.locator('.comparison-caption', { hasText: 'Sailko, Milan 2015' }),
	).toBeVisible();
	await expect(
		page.locator('.comparison-caption', { hasText: 'Jay Dixit, Milan 2025' }),
	).toBeVisible();
	await expect(
		page.locator('.comparison-caption', {
			hasText: 'Jay Dixit, TIFF 2024',
		}),
	).toHaveCount(2);

	for (const card of await comparisonCards.all()) {
		await card.scrollIntoViewIfNeeded();
		await page.waitForTimeout(150);
		const comparisonImages = card.locator('.comparison-image');
		await expect(comparisonImages).toHaveCount(2);
		await expect
			.poll(() =>
				comparisonImages.evaluateAll((images) =>
					images.every((image) => image.complete && image.naturalWidth > 0),
				),
			)
			.toBe(true);
	}

	expect(await getBrokenCompletedImages(page)).toEqual([]);
});

for (const width of [390, 1440]) {
	test(`exhibition viewer opens highlights and gallery originals at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text());
		});
		await page.goto('/red-carpet/conan-obrien/');
		const photos = page.locator('[data-person-photo-gallery] a[data-pswp-item]');
		await expect(photos).toHaveCount(3);
		const firstSource = await photos.first().getAttribute('href');
		await photos.first().click();
		const viewer = page.locator('.pswp[data-exhibition-viewer]');
		await expect(viewer).toBeVisible();
		await expect.poll(() => page.evaluate(() => window.pswp?.opener.isOpen)).toBe(true);
		await expect
			.poll(() => page.evaluate(() => window.pswp?.currSlide?.data.src))
			.toBe(firstSource);
		await expect(viewer.locator('.exhibition-caption')).toHaveText(
			'Conan O’Brien at SXSW Office Space Event',
		);
		await expect(
			viewer.getByRole('button', { name: 'About this photograph', exact: true }),
		).toBeHidden();
		const thumbs = viewer.locator('.exhibition-thumbnails');
		if (width === 390) {
			await expect(thumbs).toBeHidden();
			await expect(thumbs.locator('img[src]')).toHaveCount(0);
			await viewer.getByRole('button', { name: 'Show or hide neighboring photographs' }).click();
		}
		await expect(thumbs).toBeVisible();
		await expect
			.poll(() =>
				thumbs
					.locator('img')
					.evaluateAll((images: HTMLImageElement[]) =>
						images.every((image) => image.complete && image.naturalWidth > 0),
					),
			)
			.toBe(true);
		await captureReview(page, `exhibition-conan-${width}`);
		await thumbs.getByRole('button', { name: 'View Conan O’Brien at Sundance 2024' }).click();
		await expect.poll(() => page.evaluate(() => window.pswp?.currIndex)).toBe(2);
		await expect
			.poll(() => page.evaluate(() => window.pswp?.currSlide?.data.src))
			.toBe(await photos.nth(2).getAttribute('href'));
		await viewer.getByRole('button', { name: 'About this photograph', exact: true }).click();
		await expect(viewer.getByRole('link', { name: 'Photo details', exact: true })).toHaveAttribute(
			'href',
			/\/gallery\/photo\/red-carpet\/sundance\/conan-obrien_sundance_2024$/,
		);
		await expect(viewer.getByRole('link', { name: 'View gallery', exact: true })).toHaveAttribute(
			'href',
			/\/gallery\/red-carpet\/sundance$/,
		);
		await expect(viewer.getByRole('button', { name: 'Copy attribution' })).toHaveCount(0);
		await expect(
			viewer.locator('.exhibition-links a[href*="/red-carpet/conan-obrien"]'),
		).toHaveCount(0);
		await captureReview(page, `exhibition-conan-info-${width}`);
		await page.keyboard.press('ArrowLeft');
		await expect.poll(() => page.evaluate(() => window.pswp?.currIndex)).toBe(1);
		await expect(viewer.getByRole('link', { name: 'Photo details', exact: true })).toHaveCount(0);
		await expect(
			viewer.getByRole('button', { name: 'About this photograph', exact: true }),
		).toBeHidden();
		await expect(viewer.locator('.exhibition-context')).toBeHidden();
		const initialZoom = await page.evaluate(() => window.pswp?.currSlide?.currZoomLevel);
		await viewer.getByRole('button', { name: 'Zoom', exact: true }).click();
		await expect
			.poll(() => page.evaluate(() => window.pswp?.currSlide?.currZoomLevel))
			.toBeGreaterThan(initialZoom!);
		await page.keyboard.press('Escape');
		await expect(viewer).toBeHidden();
		await expect(photos.first()).toBeFocused();
		await photos.nth(2).click();
		await expect(viewer).toBeVisible();
		await expect.poll(() => page.evaluate(() => window.pswp?.opener.isOpen)).toBe(true);
		await expect.poll(() => page.evaluate(() => window.pswp?.currIndex)).toBe(2);
		await page.keyboard.press('Escape');
		await expect(viewer).toBeHidden();
		expect(errors).toEqual([]);
	});

	test(`gallery discovery and filtered viewing work at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		const errors: string[] = [];
		// These checks exercise photo discovery, not the external likes/comment services.
		// PHOTOS_NETWORK_DIAGNOSTICS=1 retains the real integrations for a separate audit.
		if (!process.env.PHOTOS_NETWORK_DIAGNOSTICS) {
			await page.route('https://*.supabase.co/rest/v1/photo_user_likes*', async (route) => {
				expect(['GET', 'HEAD']).toContain(route.request().method());
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					headers: { 'content-range': '*/0' },
					body: route.request().method() === 'HEAD' ? '' : '[]',
				});
			});
			await page.route('https://giscus.app/client.js', (route) =>
				route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }),
			);
		}
		if (process.env.PHOTOS_NETWORK_DIAGNOSTICS) {
			const resource = (url: string) => {
				const parsed = new URL(url);
				return parsed.origin + parsed.pathname;
			};
			page.on('requestfailed', (request) =>
				console.log('Request failed:', resource(request.url()), request.failure()?.errorText),
			);
			page.on('response', (response) => {
				if (response.status() >= 400)
					console.log('HTTP error:', response.status(), resource(response.url()));
			});
		}
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text());
		});
		await page.goto('/gallery/');
		await waitForInitialImages(page);
		// Compare every generated and displayed cover with its actual source image.
		// A CSS-only check would miss a crop already baked into the derivative.
		for (const link of await page.locator('[data-gallery-cover-photo]').all()) {
			await link.scrollIntoViewIfNeeded();
			const img = link.locator('img');
			await img.evaluate((image: HTMLImageElement) => image.decode());
			const folder = (await link.getAttribute('href'))!.replace('/gallery/', '');
			const sourceFolder = path.resolve('src/gallery/photos', folder);
			const displayed = await img.evaluate((image: HTMLImageElement) => ({
				filename: decodeURIComponent(new URL(image.currentSrc).pathname.split('/').at(-1)!),
				naturalRatio: image.naturalWidth / image.naturalHeight,
				renderedRatio: image.getBoundingClientRect().width / image.getBoundingClientRect().height,
			}));
			const sourceFile = readdirSync(sourceFolder).find(
				(filename) =>
					/\.(jpe?g|png|gif)$/i.test(filename) &&
					displayed.filename.startsWith(`${path.parse(filename).name}.`),
			);
			expect(sourceFile, `Original source for ${folder}`).toBeTruthy();
			const original = await sharp(path.join(sourceFolder, sourceFile!)).metadata();
			const sourceRatio = original.autoOrient.width / original.autoOrient.height;
			expect(displayed.naturalRatio, `${folder} derivative preserves the source`).toBeCloseTo(
				sourceRatio,
				2,
			);
			expect(displayed.renderedRatio, `${folder} displays the entire source`).toBeCloseTo(
				sourceRatio,
				2,
			);
			await link.hover();
			const bounds = await img.boundingBox();
			const frame = await link.boundingBox();
			expect(bounds!.width).toBeCloseTo(frame!.width, 0);
			expect(bounds!.height).toBeCloseTo(frame!.height, 0);
		}
		await page.evaluate(() => window.scrollTo(0, 0));
		await captureReview(page, `after-gallery-${width}`);
		const cover = page.locator('[data-gallery-cover-photo]').first();
		const destination = await cover.getAttribute('href');
		await cover.click();
		await expect(page).toHaveURL(new RegExp(`${destination}/?$`));
		await expect(page.locator('.pswp')).toHaveCount(0);
		await page.goto('/gallery/events/nobel-prizes-2024/');
		await waitForInitialImages(page);
		await captureReview(page, `after-nobel-gallery-${width}`);
		const disclosure = page.locator('.filter-disclosure');
		if (width === 390) await expect(disclosure).not.toHaveAttribute('open', '');
		else await expect(disclosure).toHaveAttribute('open', '');
		await page.locator('#search').fill('Hassabis');
		const visiblePhotos = page.locator('.masonry-item:not([hidden])');
		await expect(visiblePhotos).toHaveCount(2);
		await visiblePhotos.first().locator('.portfolio-lightbox').click();
		await expect.poll(() => page.evaluate(() => window.pswp?.getNumItems())).toBe(2);
		await expect.poll(() => page.evaluate(() => window.pswp?.opener.isOpen)).toBe(true);
		await expect(page.locator('.exhibition-caption')).toContainText('Hassabis');
		await page.getByRole('button', { name: 'About this photograph', exact: true }).click();
		await expect(page.locator('.exhibition-links a')).toHaveCount(1);
		await expect(page.locator('.exhibition-links a')).toHaveAttribute('href', /\/gallery\/photo\//);
		await page.getByRole('button', { name: 'Close info' }).click();
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('.exhibition-caption')).toContainText('Hassabis');
		await expect.poll(() => page.evaluate(() => window.pswp?.currIndex)).toBe(1);
		await page.keyboard.press('Escape');
		await expect(page.locator('.pswp')).toBeHidden();
		await page.locator('#search').fill('no-matching-photograph');
		await expect(page.locator('[data-gallery-no-results]')).toBeVisible();
		await page.locator('[data-gallery-no-results] [data-reset-filters]').click();
		await expect(visiblePhotos).toHaveCount(24);
		if (width === 390) await disclosure.locator('summary').click();
		const selectedTag = disclosure.locator('.tag-filter').first();
		const tag = await selectedTag.getAttribute('data-tag');
		await selectedTag.click();
		await expect(page.locator('[data-selected-filters]')).toBeVisible();
		await expect.poll(() => visiblePhotos.count()).toBeGreaterThan(0);
		const tags = await visiblePhotos.evaluateAll((items) =>
			items.map((item) => JSON.parse(item.getAttribute('data-tags') || '[]')),
		);
		expect(tags.every((itemTags) => itemTags.includes(tag))).toBe(true);
		if (width === 390) await page.locator('[data-close-filters]').click();
		await page.locator('[data-remove-tag]:not([hidden])').click();
		await expect(visiblePhotos).toHaveCount(24);
		expect(errors).toEqual([]);
	});
}

test('exhibition attribution requires embedded image licensing', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/before-and-after/');
	const photos = page.locator('.comparison-list a[data-pswp-item]');
	await photos.nth(2).click();
	await expect.poll(() => page.evaluate(() => window.pswp?.opener.isOpen)).toBe(true);
	await expect(
		page.getByRole('button', { name: 'About this photograph', exact: true }),
	).toBeHidden();
	await expect(page.getByRole('button', { name: 'Copy attribution' })).toHaveCount(0);
	await page.keyboard.press('ArrowRight');
	await page.getByRole('button', { name: 'About this photograph', exact: true }).click();
	const source = page
		.locator('.exhibition-context')
		.getByRole('link', { name: 'View on Wikimedia Commons' });
	await expect(source).toHaveAttribute('href', /File:Vanessa_Kirby/);
	await expect(page.getByRole('button', { name: 'Copy attribution' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(page.locator('.pswp')).toBeHidden();
	for (const width of [390, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/gallery/events/sxsw-2026/');
		const licensedPhotos = page.locator('a[data-exhibition-attribution]');
		await expect(licensedPhotos).toHaveCount(3);
		await licensedPhotos.first().click();
		await expect.poll(() => page.evaluate(() => window.pswp?.opener.isOpen)).toBe(true);
		await page.getByRole('button', { name: 'About this photograph', exact: true }).click();
		await page.getByRole('button', { name: 'Copy attribution' }).click();
		await expect(page.getByRole('status')).toHaveText('Attribution copied');
		const attribution = await page.evaluate(() => navigator.clipboard.readText());
		expect(attribution).toContain('Jay Dixit');
		expect(attribution).toContain('Attribution-ShareAlike 4.0');
		expect(attribution).toContain('jack-johnson_sxsw_2026_01');
		await page.keyboard.press('Escape');
		await expect(page.locator('.pswp')).toBeHidden();
	}
});

test('laptop introduction and actions have clear space beside every print', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	for (const width of [
		821, 1024, 1180, 1181, 1265, 1280, 1366, 1440, 1500, 1536, 1600, 1601, 1680, 1728, 1920, 2048,
		2049, 2560,
	]) {
		await page.setViewportSize({ width, height: 1000 });
		const compare =
			process.env.PHOTOS_REVIEW_BASELINE && [1280, 1366, 1440, 1536, 1680].includes(width);
		if (compare) {
			await page.goto(process.env.PHOTOS_REVIEW_BASELINE!);
			await waitForInitialImages(page);
			await captureReview(page, `before-home-${width}`);
		}
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
		if (compare) {
			await waitForInitialImages(page);
			await captureReview(page, `after-home-${width}`);
		}
		const overlaps = await page.evaluate(() => {
			const prints = Array.from(document.querySelectorAll('.hero-print')).filter(
				(print) => getComputedStyle(print).display !== 'none',
			);
			return ['.hero-lede', '.hero-actions'].flatMap((selector) => {
				const text = document.querySelector(selector)!.getBoundingClientRect();
				return prints
					.filter((print) => {
						const r = print.getBoundingClientRect();
						return (
							text.left < r.right &&
							text.right + 12 > r.left &&
							text.top < r.bottom &&
							text.bottom > r.top
						);
					})
					.map((print) => `${selector}: ${print.getAttribute('data-pswp-caption')}`);
			});
		});
		expect(overlaps, `Text/photo clearance at ${width}px`).toEqual([]);
	}
});

for (const width of [390, 1440]) {
	for (const route of [
		{ path: '/', selector: '#hero-print-gallery a[data-pswp-item]:visible' },
		{ path: '/before-and-after/', selector: '.comparison-list a[data-pswp-item]' },
		{ path: '/nobel-2024/', selector: 'a[data-nobel-photo]' },
		{ path: '/photo-wall/', selector: '.portfolio-lightbox' },
		{ path: '/blog/wikiportraits-story/', selector: '#blog-lightbox-gallery .portfolio-lightbox' },
		{ path: '/collections/', selector: '#photo-grid a[data-pswp-item]' },
		{ path: '/albums/tiff-2024/', selector: '#cld-gallery a[data-pswp-item]' },
	]) {
		test(`shared exhibition behavior on ${route.path} at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			page.on('console', (message) => {
				if (message.type() === 'error') errors.push(message.text());
			});
			await page.goto(route.path);
			const first = page.locator(route.selector).first();
			const source =
				(await first.getAttribute('data-full-src')) || (await first.getAttribute('href'));
			await first.click();
			const viewer = page.locator('.pswp[data-exhibition-viewer]');
			await expect(viewer).toBeVisible();
			await expect.poll(() => page.evaluate(() => window.pswp?.opener.isOpen)).toBe(true);
			await expect.poll(() => page.evaluate(() => window.pswp?.currSlide?.data.src)).toBe(source);
			if (route.path === '/') {
				await expect(viewer).toHaveClass(/pswp--kinetic-editorial/);
				const transition = await page.evaluate(() => {
					const pswp = window.pswp!;
					const image = pswp.currSlide!.content.element!.getBoundingClientRect();
					return {
						animation: pswp.options.showHideAnimationType,
						duration: pswp.options.showAnimationDuration,
						centerX: image.left + image.width / 2,
						centerY: image.top + image.height / 2,
						viewportWidth: innerWidth,
						viewportHeight: innerHeight,
					};
				});
				expect(transition.animation).toBe('zoom');
				expect(transition.duration).toBeGreaterThan(0);
				expect(Math.abs(transition.centerX - transition.viewportWidth / 2)).toBeLessThan(2);
				expect(Math.abs(transition.centerY - (transition.viewportHeight - 64) / 2)).toBeLessThan(2);
			}
			const count = await page.evaluate(() => window.pswp?.getNumItems());
			if (count! > 1) {
				await page.keyboard.press('ArrowRight');
				await expect.poll(() => page.evaluate(() => window.pswp?.currIndex)).toBe(1);
			}
			await page.keyboard.press('Escape');
			await expect(viewer).toBeHidden();
			await expect(first).toBeFocused();
			expect(errors).toEqual([]);
		});
	}
}

test('gallery prints retain their Packery geometry across responsive widths', async ({ page }) => {
	await page.goto('/gallery/events/nobel-prizes-2024/');
	await waitForInitialImages(page);
	for (const width of [769, 1024, 1099, 1100, 1303, 1304, 1440, 1680, 1920, 2560, 3840, 7680]) {
		await page.setViewportSize({ width, height: 1000 });
		await expect
			.poll(
				() =>
					page.evaluate(() => {
						const container = document.querySelector('#masonry')!.getBoundingClientRect();
						const cards = Array.from(document.querySelectorAll('.masonry-item:not([hidden])')).map(
							(card) => ({
								name: card.getAttribute('data-filename'),
								rect: card.getBoundingClientRect(),
							}),
						);
						const problems: string[] = [];
						cards.forEach((card, index) => {
							if (card.rect.left < container.left - 2 || card.rect.right > container.right + 2)
								problems.push(`Outside gallery: ${card.name}`);
							cards.slice(index + 1).forEach((other) => {
								if (
									card.rect.left + 2 < other.rect.right &&
									card.rect.right - 2 > other.rect.left &&
									card.rect.top + 2 < other.rect.bottom &&
									card.rect.bottom - 2 > other.rect.top
								)
									problems.push(`Overlapping prints: ${card.name}, ${other.name}`);
							});
						});
						return problems;
					}),
				{ message: `Gallery geometry at ${width}px`, timeout: 5000 },
			)
			.toEqual([]);
	}
});

test('report homepage production JavaScript requests at phone and desktop widths', async ({
	page,
}, testInfo) => {
	const { readFile } = await import('node:fs/promises');
	const { gzipSync } = await import('node:zlib');
	const reports = [];
	for (const width of [390, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		await waitForInitialImages(page);
		const urls = await page.evaluate(() =>
			performance
				.getEntriesByType('resource')
				.map((entry) => entry.name)
				.filter(
					(name) =>
						new URL(name).origin === location.origin && /\/_astro\/.*\.js(?:\?|$)/.test(name),
				),
		);
		const files = [...new Set(urls.map((url) => new URL(url).pathname))];
		let gzippedBytes = 0;
		for (const file of files) gzippedBytes += gzipSync(await readFile(`dist${file}`)).length;
		reports.push({ width, gzippedBytes, files });
	}
	await testInfo.attach('production-javascript-requests', {
		body: JSON.stringify(reports, null, 2),
		contentType: 'application/json',
	});
	console.log(
		'Homepage production JavaScript gzip totals:',
		reports.map(({ width, gzippedBytes }) => ({ width, gzippedBytes })),
	);
});
