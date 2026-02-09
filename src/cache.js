const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const CACHE_DIR = path.join(process.cwd(), 'cache', 'pages');

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function makeId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

async function savePage(page) {
  await ensureCacheDir();
  const id = page.id || makeId();
  const payload = {
    id,
    createdAt: page.createdAt || new Date().toISOString(),
    ...page,
    id,
  };

  const filePath = path.join(CACHE_DIR, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

async function loadPages({ limit } = {}) {
  await ensureCacheDir();
  const files = await fs.readdir(CACHE_DIR);
  const jsonFiles = files.filter((name) => name.endsWith('.json'));

  const raw = await Promise.all(
    jsonFiles.map(async (name) => {
      try {
        const filePath = path.join(CACHE_DIR, name);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
      } catch {
        return null;
      }
    })
  );

  const pages = raw
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (typeof limit === 'number' && limit > 0) {
    return pages.slice(0, limit);
  }

  return pages;
}

async function getCacheCount() {
  await ensureCacheDir();
  const files = await fs.readdir(CACHE_DIR);
  return files.filter((name) => name.endsWith('.json')).length;
}

module.exports = {
  CACHE_DIR,
  ensureCacheDir,
  getCacheCount,
  loadPages,
  savePage,
};
