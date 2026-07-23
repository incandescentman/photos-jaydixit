import { expect, test, type Page } from '@playwright/test';

const routes = [
	{
		name: 'homepage',
		path: '/',
		title: /Red Carpet Highlights — Jay Dixit/,
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
		name: 'portrait index',
		path: '/portraits/',
		title: /Portraits — Jay Dixit/,
		heading: 'Portraits',
		minImages: 20,
	},
	{
		name: 'around the world',
		path: '/red-carpets/',
		title: /Red Carpets Around the World — Jay Dixit/,
		heading: 'Red carpets around the world.',
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
		minImages: 3,
	},
	{
		name: 'Nobel blog post',
		path: '/blog/nobel-portrait-session/',
		title: /Inside the Nobel Portrait Session — Jay Dixit/,
		heading: 'Inside the Nobel Portrait Session',
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
				expect(await page.locator('.portfolio-lightbox').count()).toBeGreaterThanOrEqual(
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
	await expect(nav.getByRole('link', { name: 'Portraits', exact: true })).toHaveAttribute(
		'href',
		'/portraits',
	);
	await expect(nav.getByRole('link', { name: 'Red Carpets Around the World' })).toHaveAttribute(
		'href',
		'/red-carpets',
	);
	await expect(nav.getByRole('link', { name: 'Why WikiPortraits' })).toHaveAttribute(
		'href',
		'/blog/wikiportraits-story',
	);

	const externalLink = nav.getByRole('link', { name: 'jaydixit.com' });
	await expect(externalLink).toHaveAttribute('target', '_blank');
	await expect(externalLink).toHaveAttribute('rel', /noopener/);
	await expect(nav.locator('.site-nav-social a')).toHaveCount(3);

	await page.setViewportSize({ width: 1200, height: 820 });
	await page.goto('/red-carpets/');
	await waitForInitialImages(page);
	const desktopNavWidths = await page.locator('.site-nav-inner').evaluate((element) => ({
		client: element.clientWidth,
		scroll: element.scrollWidth,
	}));
	expect(desktopNavWidths.scroll).toBeLessThanOrEqual(desktopNavWidths.client);

	await page.setViewportSize({ width: 390, height: 820 });
	await page.goto('/before-after/');
	await waitForInitialImages(page);

	const toggle = page.getByRole('button', { name: 'Menu' });
	await expect(toggle).toBeVisible();
	await toggle.click();

	const mobileMenu = page.locator('#site-nav-mobile-menu');
	await expect(mobileMenu).toBeVisible();
	await expect(mobileMenu.getByRole('link', { name: 'Before & After' })).toHaveAttribute(
		'aria-current',
		'page',
	);
	await expect(mobileMenu.locator('.site-nav-mobile-social a')).toHaveCount(3);
});

test('red-carpets page renders every city and a scroll-controlled Toronto sequence', async ({
	page,
}) => {
	await page.goto('/red-carpets/');
	await waitForInitialImages(page);

	for (const city of ['Stockholm', 'Busan', 'Locarno', 'Park City', 'Austin', 'Toronto']) {
		await expect(page.locator(`[data-world-city="${city}"]`)).toHaveCount(1);
	}

	await expect(page.locator('[data-toronto-frame]')).toHaveCount(13);
	await expect(page.locator('[data-toronto-frame].is-active')).toHaveCount(1);
	await expect(page.locator('[data-placeholder-frame]')).toHaveCount(2);
	await expect(page.locator('[data-next-stop]')).toHaveCount(5);

	await page.locator('[data-next-stop="busan"]').click();
	await expect(page).toHaveURL(/#busan$/);
	await expect
		.poll(() =>
			page.locator('#busan').evaluate((section) => Math.round(section.getBoundingClientRect().top)),
		)
		.toBeGreaterThan(120);
	await expect
		.poll(() =>
			page.locator('#busan').evaluate((section) => Math.round(section.getBoundingClientRect().top)),
		)
		.toBeLessThan(190);

	const sequence = page.locator('[data-toronto-sequence]');
	await sequence.scrollIntoViewIfNeeded();
	await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
	await expect.poll(() => page.locator('[data-toronto-count]').textContent()).not.toBe('01 / 13');

	expect(await getBrokenCompletedImages(page)).toEqual([]);
});

test('retired around-the-world URL is not preserved', async ({ request }) => {
	const response = await request.get('/around-the-world/', { maxRedirects: 0 });
	expect(response.status()).toBe(404);
});

test('red-carpets concept lab exposes six distinct responsive concepts', async ({ page }) => {
	await page.goto('/red-carpets/variants/');
	await waitForInitialImages(page);
	await expect(page.locator('.concept-card[href="/red-carpets"]')).toHaveCount(1);

	for (const path of [
		'/red-carpets/full-bleed',
		'/red-carpets/passport',
		'/red-carpets/departures',
		'/red-carpets/contact-sheet',
		'/red-carpets/the-route',
	]) {
		await expect(page.locator(`.concept-card[href="${path}"]`)).toHaveCount(1);
	}

	await page.goto('/red-carpets/full-bleed/');
	await expect(page.locator('[data-bleed-chapter]')).toHaveCount(6);
	await expect(page.locator('[data-reel-frame]')).toHaveCount(13);
	await expect(page.locator('[data-placeholder-frame]')).toHaveCount(2);
	await expect(page.locator('[data-bleed-next]')).toHaveCount(5);
	const desktopBusanTitleGap = await page.locator('#busan .bleed-title').evaluate((title) => {
		const country = title.querySelector('p')?.getBoundingClientRect();
		const city = title.querySelector('h2')?.getBoundingClientRect();
		return country && city ? Math.round(city.top - country.bottom) : 0;
	});
	expect(desktopBusanTitleGap).toBeGreaterThanOrEqual(32);
	await page.locator('[data-bleed-next="locarno"]').click();
	await expect(page).toHaveURL(/#locarno$/);
	await expect
		.poll(() =>
			page.locator('#locarno').evaluate((section) => {
				const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop);
				return Math.round(Math.abs(section.getBoundingClientRect().top - margin));
			}),
		)
		.toBeLessThanOrEqual(2);
	await page.locator('[data-toronto-finale]').scrollIntoViewIfNeeded();
	await expect
		.poll(() => page.locator('[data-reel-caption]').textContent())
		.not.toBe('Vanessa Kirby');

	await page.goto('/red-carpets/passport/');
	await expect(page.locator('.passport-page')).toHaveCount(6);
	await expect(page.locator('.passport-stamp')).toHaveCount(6);
	await expect(page.locator('[data-passport-next]')).toHaveCount(5);
	await page.locator('[data-passport-next="locarno"]').click();
	await expect(page).toHaveURL(/#passport-locarno$/);
	await expect
		.poll(() =>
			page.locator('#passport-locarno').evaluate((section) => {
				const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop);
				return Math.round(Math.abs(section.getBoundingClientRect().top - margin));
			}),
		)
		.toBeLessThanOrEqual(2);

	await page.goto('/red-carpets/departures/');
	const stockholm = page.getByRole('button', {
		name: 'Stockholm, Nobel Prize Ceremony. Open portrait.',
	});
	await stockholm.click();
	await expect(stockholm).toHaveAttribute('aria-expanded', 'true');
	await expect(page.locator('#departure-stockholm')).toBeVisible();

	await page.goto('/red-carpets/contact-sheet/');
	await expect(page.locator('.film-frame')).toHaveCount(6);
	await expect(page.locator('.toronto-sheet figure')).toHaveCount(13);
	await expect(page.locator('[data-film-next]')).toHaveCount(5);
	await page.locator('[data-film-next="1"]').click();
	await expect(page).toHaveURL(/#film-locarno$/);
	await expect
		.poll(() =>
			page
				.locator('#film-locarno')
				.evaluate((frame) => Math.round(Math.abs(frame.getBoundingClientRect().left))),
		)
		.toBeLessThanOrEqual(2);

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/red-carpets/full-bleed/#busan');
	const mobileBusanTitleGap = await page.locator('#busan .bleed-title').evaluate((title) => {
		const country = title.querySelector('p')?.getBoundingClientRect();
		const city = title.querySelector('h2')?.getBoundingClientRect();
		return country && city ? Math.round(city.top - country.bottom) : 0;
	});
	expect(mobileBusanTitleGap).toBeGreaterThanOrEqual(32);
	await page.goto('/red-carpets/contact-sheet/');
	await page.locator('[data-film-next="1"]').click();
	await expect
		.poll(() =>
			page.locator('#film-locarno').evaluate((frame) => {
				const margin = Number.parseFloat(getComputedStyle(frame).scrollMarginTop);
				return Math.round(Math.abs(frame.getBoundingClientRect().top - margin));
			}),
		)
		.toBeLessThanOrEqual(2);

	await page.goto('/red-carpets/the-route/');
	await expect(page.locator('[data-route-chapter]')).toHaveCount(6);
	await expect(page.locator('[data-placeholder-frame]')).toHaveCount(2);
	await expect(page.locator('[data-route-reel-frame]')).toHaveCount(13);
	await expect(page.locator('[data-route-map-stop]')).toHaveCount(6);
	await expect(page.locator('#route-map svg')).toHaveAttribute('viewBox', '0 0 1000 386');
	await expect(page.locator('#route-map .map-land')).toHaveCount(1);
	const worldOutline = await page.locator('#route-map .map-land').getAttribute('d');
	expect(worldOutline?.length).toBeGreaterThan(15_000);
	const routeMapBackground = await page
		.locator('#route-map')
		.evaluate((section) => getComputedStyle(section).backgroundColor);
	expect(routeMapBackground).toBe('rgb(238, 230, 216)');
	await expect(page.locator('[data-route-replay]')).toBeVisible();
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.locator('[data-route-finale]').scrollIntoViewIfNeeded();
	await expect
		.poll(() => page.locator('[data-route-status]').textContent(), { timeout: 12_000 })
		.toBe('13 portraits · Toronto');
	await expect(page.locator('[data-route-stage]')).toHaveClass(/is-assembled/);

	await page.goto('/red-carpets/the-route/');
	const widths = await page.evaluate(() => ({
		body: document.body.scrollWidth,
		viewport: window.innerWidth,
	}));
	expect(widths.body).toBeLessThanOrEqual(widths.viewport);
	expect(await getBrokenCompletedImages(page)).toEqual([]);
});

for (const route of ['/', '/gallery/red-carpet/sundance/']) {
	test(`PhotoSwipe opens on first click and Escape closes on ${route}`, async ({ page }) => {
		await page.goto(route);
		await waitForInitialImages(page);

		const firstLightboxLink = page.locator('.portfolio-lightbox').first();
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

test('Nobel related essay thumbnail uses the live Vanessa Kirby asset', async ({ page }) => {
	await page.goto('/blog/nobel-portrait-session/');

	const relatedCard = page.getByRole('link', { name: /Hello From the Darkroom/i });
	await relatedCard.scrollIntoViewIfNeeded();

	const image = relatedCard.getByRole('img', {
		name: 'Vanessa Kirby on the Toronto International Film Festival red carpet',
	});
	await expect(image).toBeVisible();

	await expect
		.poll(() =>
			image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
		)
		.toBe(true);
	await expect
		.poll(() => image.evaluate((element: HTMLImageElement) => element.currentSrc || element.src))
		.toContain('/highlights/vanessa-kirby_tiff_2024');
});

test('portrait index renders editorial person cards from generated data', async ({ page }) => {
	await page.goto('/portraits/');
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

test('portrait person pages render confirmed Wikimedia provenance only', async ({ page }) => {
	await page.goto('/portraits/lisa-gilroy/');
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

	await page.goto('/portraits/nicholas-braun/');
	await waitForInitialImages(page);

	await expect(page.getByText('Currently the lead photo on Wikipedia')).toHaveCount(0);
	await expect(page.getByText('Photo by Jay Dixit')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'View on Wikimedia Commons' })).toHaveCount(0);
});

test('legacy red-carpet URLs redirect to canonical portraits URLs', async ({ page }) => {
	await page.goto('/red-carpet/');
	await expect(page).toHaveURL(/\/portraits\/?$/);
	await expect(page.getByRole('heading', { name: 'Portraits' })).toBeVisible();

	await page.goto('/red-carpet/lisa-gilroy/');
	await expect(page).toHaveURL(/\/portraits\/lisa-gilroy\/?$/);
	await expect(page.getByRole('heading', { name: 'Lisa Gilroy' })).toBeVisible();
});

test('blog index renders editorial post list with live thumbnails', async ({ page }) => {
	await page.goto('/blog/');
	await waitForInitialImages(page);

	const posts = page.locator('.post');
	await expect(posts).toHaveCount(3);
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
	await page.goto('/blog/nobel-portrait-session/');
	await waitForInitialImages(page);

	await expect(page.locator('article time')).toHaveText('September 20, 2025');
	await expect(
		page.locator('section', { hasText: 'Related essays' }).getByText('Oct 1, 2025'),
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

test('about page renders editorial sections without breaking the recognition block', async ({
	page,
}) => {
	await page.goto('/about/');
	await waitForInitialImages(page);

	await expect(page.getByRole('heading', { name: 'Why I Take Photos' })).toBeVisible();
	await expect(page.locator('.ed-card')).toHaveCount(4);
	await expect(page.locator('.ed-ai-card')).toHaveCount(2);
	await expect(page.getByText('Socratic AI')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'OpenAI' })).toBeVisible();
	expect(await getBrokenCompletedImages(page)).toEqual([]);
});

test('before-after page renders source captions and loads comparison images after scroll', async ({
	page,
}) => {
	await page.goto('/before-after/');
	await waitForInitialImages(page);

	await expect(page).toHaveTitle(/Before & After/);
	await expect(page.getByRole('heading', { name: 'Before & After' })).toBeVisible();

	const comparisonCards = page.locator('.ba-pair');
	await expect(comparisonCards).toHaveCount(6);
	await expect(comparisonCards.first().locator('.ba-name')).toHaveText('Jeremy Strong');
	await expect(page.locator('.ba-name', { hasText: 'Jason Bateman' })).toBeVisible();
	await expect(page.locator('.ba-arrow')).toHaveCount(6);
	await expect(page.locator('.ba-cap-src')).toHaveCount(12);
	await expect(page.locator('.ba-cap-src', { hasText: 'Jay Dixit, TIFF 2025' })).toBeVisible();
	await expect(page.locator('.ba-cap-src', { hasText: 'Glenn Francis, 2019' })).toBeVisible();
	await expect(
		page.locator('.ba-cap-src', {
			hasText: 'Jay Dixit, TIFF 2024',
		}),
	).toHaveCount(2);

	for (const card of await comparisonCards.all()) {
		await card.scrollIntoViewIfNeeded();
		await page.waitForTimeout(150);
		await expect(card.locator('img')).toHaveCount(2);
		await expect
			.poll(() =>
				card
					.locator('img')
					.evaluateAll((images) =>
						images.every((image) => image.complete && image.naturalWidth > 0),
					),
			)
			.toBe(true);
	}

	expect(await getBrokenCompletedImages(page)).toEqual([]);
});
