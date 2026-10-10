import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import path from 'path';
import { fileURLToPath } from 'url';
import { isPublicSearchPage } from './src/lib/indexing';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://astro.build/config
export default defineConfig({
	site: 'https://photos.jaydixit.com',
	output: 'static', // Static output for Vercel deployment (admin features work only in dev)
	compressHTML: true, // Preserve Astro 6 whitespace behavior after the Astro 7 upgrade
	server: {
		port: 4322,
	},
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => isPublicSearchPage(new URL(page).pathname),
			serialize(item) {
				const pathname = new URL(item.url).pathname;
				// These pages set slashless canonicals; keep sitemap entries identical to them.
				if (
					pathname === '/contact/' ||
					pathname === '/popular/' ||
					/^\/(gallery|red-carpet)\/.+\/$/.test(pathname)
				) {
					item.url = item.url.replace(/\/$/, '');
				}
				return item;
			},
		}),
	],
	vite: {
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				'~': path.resolve(__dirname, './src'),
			},
		},
	},
});
