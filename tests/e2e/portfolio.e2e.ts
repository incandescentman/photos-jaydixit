import { expect, test, type Page } from '@playwright/test';

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
		heading: 'Jay Dixit: Red Carpet Photography for Wikipedia',
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
		title: /Red Carpet → Sundance Gallery — Jay Dixit/,
		heading: 'Red Carpet → Sundance',
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
	await page.goto('/about/');
	await waitForInitialImages(page);

	const nav = page.locator('nav.site-nav');
	await expect(nav).toBeVisible();
	await expect(nav.getByRole('link', { name: 'Jay Dixit Photos' })).toHaveAttribute('href', '/');
	await expect(nav.getByRole('link', { name: 'Why I Shoot' })).toHaveAttribute(
		'aria-current',
		'page',
	);
	await expect(nav.getByRole('link', { name: 'Red Carpet' })).toHaveAttribute(
		'href',
		'/red-carpet',
	);
	await expect(nav.getByRole('link', { name: 'Why WikiPortraits' })).toHaveAttribute(
		'href',
		'/blog/wikiportraits-story',
	);

	const externalLink = nav.getByRole('link', { name: 'jaydixit.com' });
	await expect(externalLink).toHaveAttribute('target', '_blank');
	await expect(externalLink).toHaveAttribute('rel', /noopener/);
	await expect(nav.locator('.site-nav-social a')).toHaveCount(3);

	await page.setViewportSize({ width: 390, height: 820 });
	await page.goto('/about/');

	const toggle = page.locator('nav.site-nav').getByRole('button', { name: 'Menu' });
	await expect(toggle).toBeVisible();
	await toggle.click();

	const mobileMenu = page.locator('#site-nav-mobile-menu');
	await expect(mobileMenu).toBeVisible();
	await expect(mobileMenu.getByRole('link', { name: 'Why I Shoot' })).toHaveAttribute(
		'aria-current',
		'page',
	);
	await expect(mobileMenu.locator('.site-nav-mobile-social a')).toHaveCount(3);
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
	const wallSources = await mobileWallLinks.evaluateAll((links) =>
		links.map((link) => link.getAttribute('data-full-src')),
	);

	await expect(mobileWallLinks).toHaveCount(17);
	expect(
		await page
			.locator('[data-wall-card][data-mobile-duplicate="true"]')
			.evaluateAll((cards) => cards.map((card) => getComputedStyle(card).display)),
	).toEqual(Array(6).fill('none'));
	expect(wallSources.filter((source) => heroSources.includes(source))).toEqual([]);
	await expect(
		page.locator('[data-wall-card]:not([data-mobile-duplicate="true"]) .wall-number-mobile'),
	).toHaveText([
		'1',
		'2',
		'3',
		'4',
		'5',
		'6',
		'7',
		'8',
		'9',
		'10',
		'11',
		'12',
		'13',
		'14',
		'15',
		'16',
		'17',
	]);

	await mobileWallLinks.first().scrollIntoViewIfNeeded();
	await expect(mobileWallLinks.first()).toBeVisible();
	await mobileWallLinks.first().click();
	await expect(page.locator('.pswp__counter')).toHaveText('1 / 17');
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
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
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
	await expect(cards).toHaveCount(22);
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
	await page.goto('/before-and-after/');
	await waitForInitialImages(page);

	await expect(page).toHaveTitle(/Before & After/);
	await expect(page.getByRole('heading', { name: 'Before & After' })).toBeVisible();
	await expect(
		page.locator('.sequence-nav').getByRole('link', { name: 'About Me' }),
	).toHaveAttribute('href', '/about');
	await expect(
		page.locator('.sequence-nav').getByRole('link', { name: 'Red Carpets Around the World' }),
	).toHaveAttribute('href', '/red-carpets');

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
