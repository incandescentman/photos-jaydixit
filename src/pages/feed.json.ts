import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE_FALLBACK = 'https://photos.jaydixit.com';

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site?.origin ?? SITE_FALLBACK;
  const posts = await getCollection('blog', ({ data }) => !data.draft);

  const items = posts
    .map((entry) => {
      const publishDate = entry.data.publishDate ?? entry.data.updateDate ?? new Date(0);
      const url = new URL(`/blog/${entry.id}/`, siteUrl).toString();
      return {
        id: url,
        url,
        title: entry.data.title,
        content_text: entry.data.excerpt ?? '',
        date_published: publishDate.toISOString(),
        tags: entry.data.tags ?? [],
      };
    })
    .sort((a, b) => new Date(b.date_published).valueOf() - new Date(a.date_published).valueOf());

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Jay Dixit Photos — Updates',
    home_page_url: siteUrl,
    feed_url: new URL('/feed.json', siteUrl).toString(),
    description: 'Fresh posts and photography dispatches from Jay Dixit.',
    items,
  };

  return new Response(JSON.stringify(feed, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  });
};
