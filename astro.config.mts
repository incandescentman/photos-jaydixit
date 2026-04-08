import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://astro.build/config
export default defineConfig({
	site: 'https://photos.jaydixit.com',
	output: 'static', // Static output for Vercel deployment (admin features work only in dev)
	server: {
		port: 4322,
	},
	integrations: [mdx(), sitemap()],
	vite: {
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				'~': path.resolve(__dirname, './src'),
			},
		},
	},
});
