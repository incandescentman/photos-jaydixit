import { describe, expect, it } from 'vitest';
import { buildCommonsDescription } from '../../../scripts/photo-publish.js';

describe('Commons WikiPortraits attribution', () => {
	it.each([undefined, '', '   '])('defaults to the bare template for %j', (campaign) => {
		const description = buildCommonsDescription({
			metadata: { caption: 'Art Spiegelman at DOC NYC in 2026.', event_date: '2026-11-13' },
			destinations: {
				commons: {
					categories: ['Photographs by Jay Dixit'],
					license: '{{self|cc-by-sa-4.0}}',
					campaign_wikitext: campaign,
				},
			},
		});
		expect(description.match(/\{\{WikiPortraits\}\}/g)).toHaveLength(1);
		expect(description).toContain('[[Category:Photographs by Jay Dixit]]');
		expect(description).toContain('{{self|cc-by-sa-4.0}}');
	});

	it.each(['{{WikiPortraits TIFF 2026}}', '{{WikiPortraits SXSW 2025}}'])(
		'uses the event template %s instead of the bare template',
		(campaign) => {
			const description = buildCommonsDescription({
				metadata: { caption: 'Event portrait in 2026.' },
				destinations: { commons: { categories: [], campaign_wikitext: campaign } },
			});
			expect(description).toContain(campaign);
			expect(description).not.toContain('{{WikiPortraits}}');
		},
	);
});
