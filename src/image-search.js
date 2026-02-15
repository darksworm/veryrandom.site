#!/usr/bin/env node
// Search Pexels for images. Returns URLs ready to use in <img> tags.
//
// Usage: node src/image-search.js "query" [count] [orientation]
//   query:       search terms (required)
//   count:       number of images (default: 3, max: 10)
//   orientation: landscape | portrait | square (default: landscape)
//
// Output: one image block per result, with src URL, alt text, and attribution.
//
// Requires PEXELS_API_KEY in .env

const dotenv = require('dotenv');
dotenv.config({ override: true });

const PEXELS_API = 'https://api.pexels.com/v1/search';

async function search(query, count, orientation) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    process.stderr.write('[image-search] No PEXELS_API_KEY set\n');
    process.exit(1);
  }

  const params = new URLSearchParams({
    query,
    per_page: String(count),
    orientation,
  });

  const res = await fetch(`${PEXELS_API}?${params}`, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text();
    process.stderr.write(`[image-search] Pexels ${res.status}: ${body.slice(0, 200)}\n`);
    process.exit(1);
  }

  const data = await res.json();

  if (!data.photos || data.photos.length === 0) {
    process.stdout.write('No images found for: ' + query + '\n');
    return;
  }

  const lines = data.photos.map((photo, i) => {
    const src = photo.src.large;       // 940px wide
    const thumb = photo.src.medium;    // scaled to fit 350x350
    const full = photo.src.large2x;    // 1880px wide
    const alt = photo.alt || query;
    const name = photo.photographer;
    const profileUrl = photo.photographer_url;

    return [
      `IMAGE ${i + 1}:`,
      `  src: ${src}`,
      `  src_full: ${full}`,
      `  thumb: ${thumb}`,
      `  alt: ${alt}`,
      `  credit: Photo by ${name} on Pexels`,
      `  credit_html: Photo by <a href="${profileUrl}">${name}</a> on <a href="https://www.pexels.com">Pexels</a>`,
    ].join('\n');
  });

  process.stdout.write(lines.join('\n\n') + '\n');
}

const query = process.argv[2];
if (!query) {
  process.stderr.write('Usage: node src/image-search.js "query" [count] [orientation]\n');
  process.exit(1);
}

const count = Math.min(parseInt(process.argv[3] || '3', 10), 10);
const orientation = process.argv[4] || 'landscape';

search(query, count, orientation).catch(err => {
  process.stderr.write(`[image-search] Error: ${err.message}\n`);
  process.exit(1);
});
