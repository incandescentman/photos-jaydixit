import type { APIRoute } from 'astro';
import path from 'node:path';
import { buildLocalPortfolioInventory } from '../../scripts/lib/portfolio-inventory.js';

export const GET = (async () => {
	const inventory = await buildLocalPortfolioInventory(path.resolve('.'));
	return new Response(JSON.stringify(inventory, null, 2), {
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
}) satisfies APIRoute;
