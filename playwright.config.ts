import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4326);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const webServer = process.env.PLAYWRIGHT_BASE_URL
	? undefined
	: {
			// Astro 7 auto-backgrounds preview servers in detected agent environments.
			// Keep this process attached so Playwright can manage its lifecycle.
			command: `pnpm build && ASTRO_PREVIEW_BACKGROUND=1 pnpm exec astro preview --host 127.0.0.1 --port ${port}`,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			url: baseURL,
		};

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: true,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL,
		screenshot: 'only-on-failure',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	...(webServer ? { webServer } : {}),
});
