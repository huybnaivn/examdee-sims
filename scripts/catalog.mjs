// Collect every sims/<slug>/manifest.json into catalog.json (read by the gallery and the BE seed).
// SIMS_BASE_URL is where dist/ is hosted, e.g. https://sims.examdee.vn
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const base = (process.env.SIMS_BASE_URL || "").replace(/\/$/, "");
const catalog = [];
// Usage: node scripts/catalog.mjs [slug ...]   (no args = every sim)
const slugs = process.argv.length > 2 ? process.argv.slice(2) : await readdir(join(root, "sims"));
for (const slug of slugs.sort()) {
  const m = JSON.parse(await readFile(join(root, "sims", slug, "manifest.json"), "utf8"));
  if (m.slug !== slug) throw new Error(`${slug}: manifest.slug is "${m.slug}"`);
  const url = `${base}/${slug}/${m.version}/`;
  catalog.push({ ...m, url: `${url}index.html`, thumbnailUrl: `${url}thumb.png` });
}
await writeFile(join(root, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
console.log(`catalog.json: ${catalog.length} sims`);
