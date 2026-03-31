import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE_FALLBACK = 'https://photos.jaydixit.com';

function getSiteUrl(site: URL | undefined) {
  return site?.origin ?? SITE_FALLBACK;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = getSiteUrl(site);
  const posts = await getCollection('blog', ({ data }) => !data.draft);

  const items = posts
    .map((entry) => {
      const publishDate = entry.data.publishDate ?? entry.data.updateDate ?? new Date(0);
      const url = new URL(`/blog/${entry.id}/`, siteUrl).toString();
      const description = entry.data.excerpt ?? '';

      return {
        title: entry.data.title,
        url,
        publishDate,
        description,
      };
    })
    .sort((a, b) => b.publishDate.valueOf() - a.publishDate.valueOf());

  const rssItems = items
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid>${escapeXml(item.url)}</guid>
      <pubDate>${item.publishDate.toUTCString()}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`,
    )
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>Jay Dixit Photos — Journal</title>
      <link>${escapeXml(siteUrl)}</link>
      <description>Latest stories from the Jay Dixit photography journal.</description>
      ${rssItems}
    </channel>
  </rss>`;

  return new Response(rss, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  });
};
