import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';

// Escape special regex characters in a string
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// This endpoint only works in development mode
// In production, the site is static and cannot write files
// Setting to true allows static build to succeed; endpoint won't work in production
export const prerender = true;

export const POST: APIRoute = async ({ request }) => {
  try {
    // Robust body parsing: accept application/json or raw text JSON
    const contentType = request.headers.get('content-type') || '';
    let data: unknown = null;

    try {
      if (contentType.includes('application/json')) {
        data = await request.json();
      } else {
        const raw = await request.text();
        data = raw ? JSON.parse(raw) : null;
      }
    } catch (parseErr: unknown) {
      const message = parseErr instanceof Error ? parseErr.message : 'Unknown parse error';
      console.error('save-order: JSON parse error:', message);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON', details: message || 'Could not parse request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const summary = Array.isArray(data)
      ? `array(len=${data.length})`
      : data && typeof data === 'object'
        ? `object(keys=${Object.keys(data as Record<string, unknown>).join(',')})`
        : `${typeof data}`;
    console.log('save-order: content-type=', contentType, ' body=', summary);

    // Support multiple shapes: array body, { order: [...] }, or any object containing an array
    const extractFirstArray = (value: Record<string, unknown>): unknown[] | null => {
      for (const entry of Object.values(value)) {
        if (Array.isArray(entry)) {
          return entry;
        }
      }
      return null;
    };

    const orderCandidate: unknown =
      Array.isArray(data)
        ? data
        : data && typeof data === 'object'
          ? Array.isArray((data as Record<string, unknown>).order)
            ? (data as Record<string, unknown>).order
            : extractFirstArray(data as Record<string, unknown>)
          : null;

    if (!Array.isArray(orderCandidate)) {
      const diag = data && typeof data === 'object' ? Object.keys(data) : typeof data;
      return new Response(
        JSON.stringify({ error: 'Invalid order format', details: 'Expected body to be an array or { order: [...] }', diag }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    type OrderEntry = {
      filename: string;
      caption?: string;
      size?: string;
      [key: string]: unknown;
    };

    const order = (orderCandidate as unknown[]).filter(
      (item): item is OrderEntry =>
        typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).filename === 'string'
    );

    if (order.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid entries', details: 'Could not find any items with filename property' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Save the order to a JSON file (includes size and caption)
    const orderFilePath = path.join(process.cwd(), 'src/data/saved-order.json');
    await fs.writeFile(orderFilePath, JSON.stringify(order, null, 2), 'utf-8');

    console.log('Saved photo sequence:', order.length, 'items');
    
    // Also update the homepage-images.js file if sizes have changed
    if (order.some(item => item.size)) {
      try {
        const imagesPath = path.join(process.cwd(), 'src/data/homepage-images.js');
        const imagesContent = await fs.readFile(imagesPath, 'utf-8');
        
        // Create a map of filename to size
        const sizeMap = new Map<string, string>();
        order.forEach(item => {
          if (item.size) {
            sizeMap.set(item.filename, item.size);
          }
        });
        
        // Update sizes in the file
        let updatedContent = imagesContent;
        sizeMap.forEach((size, filename) => {
          const escapedFilename = escapeRegex(filename);
          const regex = new RegExp(`(filename: '${escapedFilename}'[^}]*?size: )'[^']*'`, 'g');
          updatedContent = updatedContent.replace(regex, `$1'${size}'`);
        });
        
        await fs.writeFile(imagesPath, updatedContent, 'utf-8');
        console.log('Updated homepage-images.js with new sizes');
      } catch (err) {
        console.error('Failed to update homepage-images.js:', err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Sequence saved successfully', count: order.length, note: 'Saved to src/data/saved-order.json' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error saving sequence:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to save sequence', details: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({ 
      status: 'ready',
      message: 'Save order endpoint is available' 
    }), 
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
