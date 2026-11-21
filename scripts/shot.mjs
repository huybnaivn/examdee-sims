// Smoke-test sims in headless Chrome: fail on any runtime error, save sims/<slug>/thumb.png.
// Usage: node scripts/shot.mjs [slug ...]   (no args = every sim)
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extname, join, normalize, resolve } from "node:path";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };

export const serve = (port = 0) =>
  new Promise(done => {
    const server = createServer(async (req, res) => {
      let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (path.endsWith("/")) path += "index.html";
      const file = join(root, path);
      if (!file.startsWith(root)) return res.writeHead(403).end();
      const body = await readFile(file).catch(() => null);
      if (!body) return res.writeHead(404).end();
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }).end(body);
    });
    server.listen(port, "127.0.0.1", () => done(server));
  });

if (import.meta.filename === process.argv[1]) {
  const slugs = process.argv.length > 2 ? process.argv.slice(2) : await readdir(join(root, "sims"));
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  // Own profile dir so several runs can go in parallel.
  const profile = await mkdtemp(join(tmpdir(), "sim-shot-"));
  // Chrome profiles are ~5–10 MB each; a leaked one per crashed run once filled the disk.
  const cleanup = () => rmSync(profile, { recursive: true, force: true });
  process.on("exit", cleanup);
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(130));
  const flags = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1200,750", "--virtual-time-budget=4000", `--user-data-dir=${profile}`];
  let failed = 0;
  for (const slug of slugs) {
    const url = `${base}/sims/${slug}/index.html`;
    // play=1 runs the frame loop so step() is exercised, not just the first draw.
    const { stdout } = await run(CHROME, [...flags, "--dump-dom", `${url}?play=1`], { maxBuffer: 1 << 26 });
    const error = stdout.match(/data-error="([^"]*)"/)?.[1];
    const mounted = stdout.includes('class="sim"');
    await run(CHROME, [...flags, `--screenshot=${join(root, "sims", slug, "thumb.png")}`, url]);
    // Inside the reference host the sim must answer init with its state.
    const host = await run(CHROME, [...flags, "--dump-dom", `${base}/host-demo.html?sim=${slug}&probe=1`], { maxBuffer: 1 << 26 });
    const bridged = host.stdout.includes('"type":"state"');
    // The probe operates a control and presses reset; both must reach the host as events.
    const acted = /"type":"event","kind":"param"/.test(host.stdout) || /"type":"event","kind":"(action|result|goal)"/.test(host.stdout);
    const transported = host.stdout.includes('"type":"event","kind":"transport","name":"reset"');
    const problem =
      error ||
      (!mounted && "did not mount") ||
      (!bridged && "no state reply to host init") ||
      (!acted && "operating a control sent no event to the host") ||
      (!transported && "reset sent no transport event to the host");
    if (problem) failed++;
    console.log(`${problem ? "FAIL" : "ok  "} ${slug}${problem ? ": " + problem : ""}`);
  }
  server.close();
  process.exit(failed ? 1 : 0); // the exit handler removes the profile, also after a throw
}
