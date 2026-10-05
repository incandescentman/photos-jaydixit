import { expect, test, type Page } from '@playwright/test';

const annaPath = '/gallery/photo/red-carpet/tiff/anna-kendrick_tiff_2026_04298/';
const annaCommons =
	'https://commons.wikimedia.org/wiki/File:Anna_Kendrick_at_Toronto_International_Film_Festival_2026_-_photographed_by_Jay_Dixit_-_d90c76eb.jpg';

async function ready(page: Page) {
	await page.evaluate(() => document.fonts.ready);
	for (const config of await page.locator('[data-pswp-config]').all())
		await expect(config).toHaveAttribute('data-pswp-bound', 'true');
}

async function opened(page: Page) {
	await expect(page.locator('.pswp[data-exhibition-viewer]')).toBeVisible();
	await expect.poll(() => page.evaluate(() => Boolean(window.pswp?.opener.isOpen))).toBe(true);
}

async function capture(page: Page, name: string) {
	if (process.env.PHOTOS_REVIEW_SCREENSHOTS) {
		await page.evaluate(async () => {
			await Promise.all(
				Array.from(document.images)
					.filter((image) => {
						const bounds = image.getBoundingClientRect();
						return bounds.top < innerHeight && bounds.bottom > 0;
					})
					.map((image) => image.decode().catch(() => {})),
			);
		});
		await page.screenshot({ path: `${process.env.PHOTOS_REVIEW_SCREENSHOTS}/photos-${name}.png` });
	}
}

for (const viewport of [
	{ width: 1728, height: 1117 },
	{ width: 3008, height: 1692 },
	{ width: 390, height: 844 },
]) {
	test.describe(`${viewport.width}px photograph destinations`, () => {
		test.use({ viewport, hasTouch: viewport.width === 390 });

		test('individual photograph enlarges, retains focus, and has verified reuse links', async ({
			page,
		}) => {
			await page.goto(annaPath, { waitUntil: 'load' });
			await ready(page);
			const photograph = page.locator('[data-photo-detail-gallery] a');
			await expect(
				page.locator('nav[aria-label="Photograph links"] a', { hasText: 'Wikimedia Commons' }),
			).toHaveAttribute('href', annaCommons);
			await capture(page, `detail-${viewport.width}`);
			if (viewport.width === 390) await photograph.tap();
			else {
				await photograph.focus();
				await page.keyboard.press('Enter');
			}
			await opened(page);
			await page.getByRole('button', { name: 'About this photograph', exact: true }).click();
			const info = page.getByRole('complementary', { name: 'About this photograph' });
			await expect(info.getByRole('link', { name: 'View on Wikimedia Commons' })).toHaveAttribute(
				'href',
				annaCommons,
			);
			await expect(info.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
				'href',
				'https://creativecommons.org/licenses/by-sa/4.0',
			);
			await expect(info.getByRole('link', { name: 'Download original' })).toHaveAttribute(
				'href',
				/^https:\/\/upload.wikimedia.org\/wikipedia\/commons\//,
			);
			await expect(info.getByRole('link', { name: 'Anna Kendrick', exact: true })).toHaveAttribute(
				'href',
				/\/red-carpet\/anna-kendrick$/,
			);
			await capture(page, `detail-info-${viewport.width}`);
			await page.keyboard.press('Escape');
			await expect(page.locator('.pswp')).toHaveCount(0);
			await expect(photograph).toBeFocused();
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
				.toBe(true);
		});

		test('Issa sequence joins her existing photograph and supports navigation', async ({
			page,
		}) => {
			await page.goto('/red-carpet/issa-rae/', { waitUntil: 'load' });
			await ready(page);
			const photos = page.locator('[data-person-photo-gallery] a[data-pswp-item]');
			await expect(photos).toHaveCount(5);
			for (const frame of ['04162', '04163', '04164', '04165', '04183'])
				await expect(photos.filter({ has: page.locator(`img[src*="${frame}"]`) })).toHaveCount(1);
			await photos.first().scrollIntoViewIfNeeded();
			await capture(page, `issa-${viewport.width}`);
			if (viewport.width === 390) await photos.first().tap();
			else await photos.first().click();
			await opened(page);
			if (viewport.width === 390) {
				const session = await page.context().newCDPSession(page);
				await session.send('Input.dispatchTouchEvent', {
					type: 'touchStart',
					touchPoints: [{ x: 320, y: 400 }],
				});
				for (const x of [280, 220, 160, 100, 50])
					await session.send('Input.dispatchTouchEvent', {
						type: 'touchMove',
						touchPoints: [{ x, y: 400 }],
					});
				await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
			} else await page.keyboard.press('ArrowRight');
			await expect.poll(() => page.evaluate(() => window.pswp?.currIndex)).toBe(1);
			await capture(page, `issa-viewer-${viewport.width}`);
			await page.getByRole('button', { name: 'About this photograph', exact: true }).click();
			await expect(page.getByRole('link', { name: 'View original placement' })).toHaveAttribute(
				'href',
				/\/#issa-rae-sequence$/,
			);
			await expect(page.getByRole('link', { name: 'Download original' })).toHaveCount(0);
			await page.keyboard.press('Escape');
			await expect(page.locator('.pswp')).toHaveCount(0);
			await expect(photos.first()).toBeFocused();
		});

		test('public Willem portrait is searchable and opens from his subject page', async ({
			page,
		}) => {
			await page.goto('/red-carpet/', { waitUntil: 'load' });
			await page.getByRole('searchbox').fill('Willem');
			const card = page.locator('.rc-card:visible');
			await expect(card).toHaveCount(1);
			await card.click();
			await expect(page).toHaveURL(/\/red-carpet\/willem-dafoe\/?$/);
			await ready(page);
			await capture(page, `willem-${viewport.width}`);
			const photo = page.locator('[data-person-photo-gallery] a[data-pswp-item]');
			await expect(photo).toHaveCount(1);
			await expect(photo).toHaveAttribute(
				'href',
				/highlights\/Willem_Dafoe_at_the_2024_Toronto_International_Film_Festival_02$/,
			);
			await photo.click();
			await opened(page);
			await page.getByRole('button', { name: 'About this photograph', exact: true }).click();
			await expect(page.getByRole('link', { name: 'View original placement' })).toHaveAttribute(
				'href',
				/\/$/,
			);
			await expect(page.getByRole('button', { name: 'Copy attribution' })).toHaveCount(0);
			await expect(page.getByRole('link', { name: 'Photo license' })).toHaveCount(0);
			await page.keyboard.press('Escape');
			await expect(photo).toBeFocused();
		});
	});
}
