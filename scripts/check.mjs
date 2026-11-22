// Static contract check: every event a sim emits is declared in its manifest with a valid kind,
// and the kind used in code matches the declaration. Run with `npm run check`.
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const KINDS = ["action", "result", "goal"]; // param and transport belong to the kit
const BUILT_IN = ["param", "play", "pause", "reset"];
let failed = 0;
const fail = (slug, msg) => (failed++, console.log(`FAIL ${slug}: ${msg}`));

for (const slug of (await readdir(join(root, "sims"))).sort()) {
  const dir = join(root, "sims", slug);
  const files = await Promise.all(["manifest.json", "sim.js"].map(f => readFile(join(dir, f), "utf8").catch(() => null)));
  if (files.includes(null)) {
    fail(slug, "manifest.json or sim.js is missing (sim still being written?)");
    continue;
  }
  const manifest = JSON.parse(files[0]);
  const code = files[1];
  const declared = manifest.events ?? {};
  for (const key of ["slug", "version", "title", "subject", "grades", "description", "learningGoals", "state"]) {
    if (manifest[key] == null) fail(slug, `manifest.${key} is missing`);
  }
  // Review status. Only "approved" sims may be seeded into the product catalogue.
  if (!["needs-rework", "approved"].includes(manifest.status)) fail(slug, 'manifest.status must be "needs-rework" or "approved"');
  if (!code.includes(`version: "${manifest.version}"`)) fail(slug, "sim.js version differs from manifest.version");
  for (const [name, e] of Object.entries(declared)) {
    if (BUILT_IN.includes(name)) fail(slug, `"${name}" is a kit event, do not redeclare it`);
    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) fail(slug, `event name "${name}" must be kebab-case`);
    if (!KINDS.includes(e?.kind)) fail(slug, `event "${name}" needs kind ${KINDS.join(" | ")}`);
    if (!e?.description) fail(slug, `event "${name}" needs a description`);
  }
  const used = new Set();
  // emit("name", <data>, "kind") — data may span lines; kind defaults to "action".
  for (const m of code.matchAll(/\.emit\(\s*(["'`])([^"'`]+)\1([\s\S]*?)\)\s*;/g)) {
    const name = m[2];
    const kind = m[3].match(/,\s*["'](param|transport|action|result|goal)["']\s*\)*\s*$/)?.[1] ?? "action";
    if (BUILT_IN.includes(name)) {
      // A custom control may emit the kit's own events, but only with the kit's kind.
      const want = name === "param" ? "param" : "transport";
      if (kind !== want) fail(slug, `"${name}" must be emitted with kind "${want}"`);
      continue;
    }
    used.add(name);
    if (!declared[name]) fail(slug, `emits "${name}" but the manifest does not declare it`);
    else if (declared[name].kind !== kind) fail(slug, `"${name}" is emitted as ${kind}, declared as ${declared[name].kind}`);
  }
  for (const m of code.matchAll(/\bevent:\s*["']([^"']+)["']/g)) {
    used.add(m[1]);
    if (!declared[m[1]]) fail(slug, `button emits "${m[1]}" but the manifest does not declare it`);
  }
  if (/\.emit\(\s*[^"'`\s]/.test(code)) fail(slug, "emit() with a non-literal name cannot be checked; use a string literal");
  for (const name of Object.keys(declared)) if (!used.has(name)) fail(slug, `declares "${name}" but never emits it`);
}
console.log(failed ? `${failed} problem(s)` : "contract ok");
process.exit(failed ? 1 : 0);
