// Build immutable, self-contained releases: dist/<slug>/<version>/ with its own copy of the kit.
// A version that already exists in dist/ is never overwritten; bump manifest.version instead.
// Usage: node scripts/release.mjs [slug ...]   (no args = every sim)
import { cp, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const slugs = process.argv.length > 2 ? process.argv.slice(2) : await readdir(join(root, "sims"));
for (const slug of slugs) {
  const src = join(root, "sims", slug);
  const { version } = JSON.parse(await readFile(join(src, "manifest.json"), "utf8"));
  const dest = join(root, "dist", slug, version);
  if (existsSync(dest)) {
    console.log(`skip ${slug}@${version} (already released)`);
    continue;
  }
  await cp(src, dest, { recursive: true, filter: f => !f.endsWith(".test.js") });
  await cp(join(root, "kit", "v1"), join(dest, "kit"), { recursive: true });
  for (const file of (await readdir(dest)).filter(f => /\.(html|js)$/.test(f))) {
    const text = await readFile(join(dest, file), "utf8");
    await writeFile(join(dest, file), text.replaceAll("../../kit/v1/", "./kit/"));
  }
  console.log(`released ${slug}@${version}`);
}
