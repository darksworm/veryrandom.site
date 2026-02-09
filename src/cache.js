const fs = require('node:fs/promises');
const path = require('node:path');

const CACHE_DIR = path.join(process.cwd(), 'cache', 'pages');

// In-memory page cache keyed by filename
const pageCache = new Map(); // filename -> { mtime, id, html }

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function loadPages() {
  await ensureCacheDir();
  const files = await fs.readdir(CACHE_DIR);
  const htmlFiles = files.filter((name) => name.endsWith('.html'));

  // Remove deleted files from cache
  const currentFiles = new Set(htmlFiles);
  for (const key of pageCache.keys()) {
    if (!currentFiles.has(key)) pageCache.delete(key);
  }

  // Only re-read files that are new or changed
  await Promise.all(
    htmlFiles.map(async (name) => {
      try {
        const filePath = path.join(CACHE_DIR, name);
        const stat = await fs.stat(filePath);
        const mtime = stat.mtimeMs;

        const cached = pageCache.get(name);
        if (cached && cached.mtime === mtime) return;

        const html = await fs.readFile(filePath, 'utf8');
        const id = name.replace(/\.html$/, '');
        pageCache.set(name, { mtime, id, html });
      } catch {
        pageCache.delete(name);
      }
    })
  );

  return [...pageCache.values()].map((entry) => ({ id: entry.id, html: entry.html }));
}

module.exports = {
  CACHE_DIR,
  ensureCacheDir,
  loadPages,
};
