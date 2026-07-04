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
		name: 'Nobel blog post',
		path: '/blog/nobel-portrait-session/',
		title: /Inside the Nobel Portrait Session — Jay Dixit/,
		heading: 'Inside the Nobel Portrait Session',
		minImages: 2,
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

test('before-after page renders source captions and loads comparison images after scroll', async ({
	page,
}) => {
	await page.goto('/before-after/');
	await waitForInitialImages(page);

	await expect(page).toHaveTitle(/Before & After/);
	await expect(page.getByRole('heading', { name: 'Before & After' })).toBeVisible();

	const comparisonCards = page.locator('.comparison-card');
	await expect(comparisonCards).toHaveCount(5);
	await expect(page.locator('.comparison-arrow')).toHaveCount(5);
	await expect(page.locator('.comparison-source')).toHaveCount(10);
	await expect(
		page.locator('.comparison-source', { hasText: 'Glenn Francis, 2019' }),
	).toBeVisible();
	await expect(
		page.locator('.comparison-source', {
			hasText: 'Jay Dixit, Toronto International Film Festival 2024',
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
