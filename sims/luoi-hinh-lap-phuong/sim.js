import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, NETS, GOAL, GRID_W, GRID_H, checkNet, foldNet, surfaceArea, parseCells, parseFound, toggleCell, checkPuzzle, rotate, step } from "./model.js";

// Opposite faces share a colour and a mark (face f and f ^ 1 are opposite, so the pair is f >> 1).
const PAIR = [
  { fill: "#a9c5f7", mark: "●" },
  { fill: "#f7c795", mark: "▲" },
  { fill: "#a5dfc5", mark: "■" },
];
const PLAIN = "#cfd8e8";
const BAD = "#f3a6a8";
const N = NETS.length;

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
/** Font size at which `text` is no wider than maxW (never above `size`). */
function fitted(ctx, text, maxW, size, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  return w > maxW ? Math.max(9, Math.floor((size * maxW) / w)) : size;
}

const isSmall = view => view.w < 560 || view.h < 420;
const netOf = s => NETS[clamp(Math.round(s.net) || 1, 1, N) - 1];
const edge = s => clamp(Number.isFinite(s.edge) ? s.edge : 1, 1, 10);

function square(ctx, x, y, c, fill, mark) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, c, c);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, c, c);
  if (mark && c >= 14) label(ctx, mark, x + c / 2, y + c / 2 + 1, { size: Math.min(16, c * 0.42), align: "center", color: "rgba(31, 42, 68, 0.6)" });
}

// ---------- text ----------

const REASONS = {
  count: "Cần đúng 6 ô vuông.",
  apart: "Chưa được: sáu ô phải kề nhau theo cạnh thành một mảnh liền.",
  block: "Không gấp được: bốn ô tô đỏ chụm quanh một đỉnh, mà mỗi đỉnh hình lập phương chỉ có ba mặt.",
  overlap: "Không gấp được: các ô tô đỏ gấp chồng lên cùng một mặt nên hình lập phương bị hở.",
};
const REASONS_SHORT = {
  count: "Cần đúng 6 ô vuông.",
  apart: "Chưa được: các ô phải liền cạnh.",
  block: "Không gấp được: 4 ô chụm một đỉnh.",
  overlap: "Không gấp được: ô đỏ chồng nhau.",
};

function lines(s, small) {
  const a = edge(s);
  const area = `Stp = 6a² = 6 · ${fmt(a)}² = ${fmt(surfaceArea(a))} cm²`;
  if (s.mode === "gallery") {
    return small
      ? [["11 hình khai triển của hình lập phương", COLORS.ink, true], ["Bấm vào một hình để gấp thử", COLORS.muted]]
      : [["Hình lập phương có đúng 11 hình khai triển khác nhau (không kể xoay và lật).", COLORS.ink, true], ["Bấm vào một hình để gấp thử. Dấu ✓: hình bạn đã tự xếp được trong phần thử thách.", COLORS.muted]];
  }
  if (s.mode === "puzzle") {
    const cells = parseCells(s.cells);
    const count = parseFound(s.found).length;
    const tally = small ? `Đã tìm được ${count}/${N} hình (mục tiêu ${GOAL})` : `Đã tìm được ${count}/${N} hình khai triển khác nhau (mục tiêu: ${GOAL} hình).${count >= GOAL ? " Đạt mục tiêu!" : ""}`;
    let first;
    if (s._full) first = [small ? "Đã đủ 6 ô: bấm một ô để bỏ ra." : "Đã đủ 6 ô vuông: bấm vào một ô đã đặt để bỏ ra.", COLORS.orange, true];
    else if (!s.checked) first = [small ? `Đặt 6 ô liền cạnh (${cells.length}/6) rồi bấm "Kiểm tra"` : `Bấm vào lưới để đặt 6 ô vuông kề cạnh nhau (đã đặt ${cells.length}/6), rồi bấm "Kiểm tra".`, COLORS.ink, true];
    else {
      const res = checkNet(cells);
      if (res.valid) first = [small ? `Đúng! Hình khai triển số ${res.net}.` : `Đúng! Gấp được thành hình lập phương: đây là hình khai triển số ${res.net}. Hai ô cùng màu là hai mặt đối diện.`, COLORS.green, true];
      else first = [(small ? REASONS_SHORT : REASONS)[res.reason], COLORS.red, true];
    }
    return [first, [tally, count >= GOAL ? COLORS.green : COLORS.muted]];
  }
  const pct = `${fmt(clamp(s.fold, 0, 100), 0)}%`;
  return small
    ? [[`Hình số ${Math.round(s.net)}/${N}, gấp ${pct}`, COLORS.ink, true], [`Stp = 6a² = ${fmt(surfaceArea(a))} cm²`, COLORS.muted]]
    : [[`Hình khai triển số ${Math.round(s.net)}/${N}, đã gấp ${pct}`, COLORS.ink, true], [`Hình lập phương cạnh a = ${fmt(a)} cm:  ${area} (bằng diện tích hình khai triển)`, COLORS.muted]];
}

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(s, view) {
  const small = isSmall(view);
  const text = lines(s, small);
  const gap = small ? 16 : 21;
  const top = 8 + text.length * gap;
  const bottom = small ? 16 : 24;
  const box = { x: 10, y: top + 4, w: view.w - 20, h: view.h - top - bottom - 8 };
  const g = { small, text, gap, top, box };
  if (s.mode === "gallery") {
    const cols = box.w > box.h * 2.2 ? 6 : 4;
    const rows = Math.ceil(N / cols);
    const pw = box.w / cols;
    const ph = box.h / rows;
    const c = Math.max(4, Math.min((pw - 14) / 5, (ph - 22) / 3));
    g.panels = NETS.map((net, i) => ({ x: box.x + (i % cols) * pw, y: box.y + Math.floor(i / cols) * ph, w: pw, h: ph, c }));
  } else if (s.mode === "puzzle") {
    const c = Math.max(8, Math.min(box.w / GRID_W, box.h / GRID_H, 90));
    g.grid = { c, x: view.w / 2 - (c * GRID_W) / 2, y: box.y + (box.h - c * GRID_H) / 2 };
  }
  return g;
}

// ---------- the three pictures ----------

function drawFold(ctx, s, g) {
  const net = netOf(s);
  const faces = checkNet(net).faces;
  // net x → right, net y → towards the viewer, so the flat net looks as it does in the gallery
  const turn = p => rotate([p[1], p[0], p[2]], s.yaw, s.pitch);
  const quads = foldNet(net, clamp(s.fold, 0, 100) / 100).map((pts, i) => {
    const r = pts.map(turn);
    return { r, pair: PAIR[faces[i] >> 1], depth: r.reduce((sum, p) => sum + p[2], 0) / 4 };
  });
  // One scale for the whole fold (flat, half folded and closed all fit), so the squares keep their size.
  const span = pts => [0, 1].map(k => Math.max(...pts.map(p => p[k])) - Math.min(...pts.map(p => p[k])));
  const k = 0.94 * Math.min(...[0, 0.5, 1].map(t => {
    const [w, h] = span(foldNet(net, t).flat().map(turn));
    return Math.min(g.box.w / w, g.box.h / Math.max(h, 0.01));
  }));
  const all = quads.flatMap(q => q.r);
  const mid = i => (Math.min(...all.map(p => p[i])) + Math.max(...all.map(p => p[i]))) / 2;
  const [mx, my] = [mid(0), mid(1)];
  const P = p => [g.box.x + g.box.w / 2 + (p[0] - mx) * k, g.box.y + g.box.h / 2 - (p[1] - my) * k];
  ctx.lineJoin = "round";
  for (const q of quads.sort((p, r) => p.depth - r.depth)) {
    ctx.beginPath();
    q.r.forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))));
    ctx.closePath();
    ctx.fillStyle = q.pair.fill;
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const c = P([0, 1, 2].map(i => (q.r[0][i] + q.r[2][i]) / 2));
    if (k >= 30) label(ctx, q.pair.mark, c[0], c[1], { size: Math.min(15, k * 0.25), align: "center", color: "rgba(31, 42, 68, 0.55)" });
  }
}

function drawGallery(ctx, s, g) {
  const found = parseFound(s.found);
  NETS.forEach((net, i) => {
    const p = g.panels[i];
    const faces = checkNet(net).faces;
    const w = Math.max(...net.map(c => c[0])) + 1;
    const h = Math.max(...net.map(c => c[1])) + 1;
    const x0 = p.x + (p.w - w * p.c) / 2;
    const y0 = p.y + 18 + (p.h - 20 - h * p.c) / 2;
    if (i + 1 === Math.round(s.net)) {
      ctx.fillStyle = "#e9eef9";
      ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
    }
    net.forEach(([x, y], j) => square(ctx, x0 + x * p.c, y0 + y * p.c, p.c, PAIR[faces[j] >> 1].fill, g.small ? null : PAIR[faces[j] >> 1].mark));
    label(ctx, `${i + 1}`, p.x + 8, p.y + 11, { size: g.small ? 12 : 14, bold: true });
    if (found.includes(i + 1)) label(ctx, "✓", p.x + (g.small ? 26 : 30), p.y + 11, { size: g.small ? 13 : 15, bold: true, color: COLORS.green });
  });
}

function drawPuzzle(ctx, s, g) {
  const { c, x, y } = g.grid;
  const cells = parseCells(s.cells);
  const res = s.checked ? checkNet(cells) : null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, c * GRID_W, c * GRID_H);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= GRID_W; i++) {
    ctx.moveTo(x + i * c, y);
    ctx.lineTo(x + i * c, y + c * GRID_H);
  }
  for (let j = 0; j <= GRID_H; j++) {
    ctx.moveTo(x, y + j * c);
    ctx.lineTo(x + c * GRID_W, y + j * c);
  }
  ctx.stroke();
  cells.forEach(([cx, cy], i) => {
    const pair = res?.valid ? PAIR[res.faces[i] >> 1] : null;
    square(ctx, x + cx * c, y + cy * c, c, pair ? pair.fill : res?.clash.includes(i) ? BAD : PLAIN, pair?.mark);
  });
}

function pick(s, api) {
  s.mode = "fold";
  s.fold = 0;
  s.dir = 1;
  api.emit("net-selected", { net: s.net }, "action");
  api.play(); // show it folding straight away
}

mount({
  slug: "luoi-hinh-lap-phuong",
  version: "1.0.0",
  title: "Hình khai triển của hình lập phương",
  hint: 'Bấm "Chạy" để gấp hình khai triển thành hình lập phương rồi mở ra. Kéo trên hình để xoay.',
  initialState,
  step(s, dt, api) {
    if (s.mode !== "fold") return api.pause();
    const before = Math.round(s.fold);
    if (step(s, dt)) api.pause(); // flat or closed: stop, the next run goes the other way
    if (Math.round(s.fold) !== before) api.sync(); // keep the slider with the animation
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Hoạt động",
      options: [
        { value: "fold", label: "Gấp và mở hình lập phương" },
        { value: "gallery", label: "11 hình khai triển" },
        { value: "puzzle", label: "Thử thách: tự xếp hình khai triển" },
      ],
      onChange(s) {
        s._full = false;
      },
    },
    { type: "stepper", key: "net", label: "Hình khai triển số", min: 1, max: N, visible: s => s.mode === "fold" },
    {
      type: "slider", key: "fold", label: "Mức gấp", min: 0, max: 100, step: 1, format: v => `${fmt(v, 0)}%`, visible: s => s.mode === "fold",
      onChange(s) {
        s.dir = s.fold >= 100 ? -1 : s.fold <= 0 ? 1 : s.dir;
      },
    },
    { type: "slider", key: "edge", label: "Cạnh a", min: 1, max: 10, step: 0.5, unit: "cm", digits: 1 },
    { type: "slider", key: "yaw", label: "Xoay ngang", min: -180, max: 180, step: 1, format: v => `${fmt(v, 0)}°`, visible: s => s.mode === "fold" },
    { type: "slider", key: "pitch", label: "Nghiêng", min: 5, max: 90, step: 1, format: v => `${fmt(v, 0)}°`, visible: s => s.mode === "fold" },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: s => s.mode === "puzzle",
      disabled: s => parseCells(s.cells).length !== 6,
      action(s, api) {
        s._full = false;
        const before = parseFound(s.found).length;
        const res = checkPuzzle(s);
        api.emit("net-checked", { valid: res.valid ? 1 : 0, net: res.net, isNew: res.isNew ? 1 : 0, found: res.count }, "result");
        if (before < GOAL && res.count >= GOAL) api.emit("five-nets-found", { found: res.count }, "goal");
      },
    },
    {
      type: "button",
      label: "Xóa các ô",
      visible: s => s.mode === "puzzle",
      disabled: s => !parseCells(s.cells).length,
      action(s) {
        s.cells = "";
        s.checked = false;
        s._full = false;
      },
      event: "grid-cleared",
    },
  ],
  readouts: [
    { label: "Diện tích một mặt a²", value: s => `${fmt(edge(s) ** 2)} cm²` },
    { label: "Diện tích toàn phần 6a²", value: s => `${fmt(surfaceArea(edge(s)))} cm²` },
    { label: "Hình khai triển đã tự xếp được", value: s => `${parseFound(s.found).length}/${N}` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      if (s.mode === "gallery") {
        const i = g.panels.findIndex(q => p.x >= q.x && p.x < q.x + q.w && p.y >= q.y && p.y < q.y + q.h);
        if (i < 0) return false;
        s.net = i + 1;
        pick(s, api);
        api.sync();
        return false;
      }
      if (s.mode === "puzzle") {
        const x = Math.floor((p.x - g.grid.x) / g.grid.c);
        const y = Math.floor((p.y - g.grid.y) / g.grid.c);
        if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
        const what = toggleCell(s, x, y);
        s._full = what === "full";
        const count = parseCells(s.cells).length;
        if (what === "placed") api.emit("square-placed", { x, y, count }, "action");
        if (what === "removed") api.emit("square-removed", { x, y, count }, "action");
        api.sync(); // the buttons depend on the number of squares
        return false;
      }
      s._drag = { x: p.x, y: p.y, yaw: s.yaw, pitch: s.pitch };
    },
    move(p, s) {
      const d = s._drag;
      if (!d) return;
      s.yaw = ((((Math.round(d.yaw + (p.x - d.x) * 0.5) + 180) % 360) + 360) % 360) - 180;
      s.pitch = clamp(Math.round(d.pitch + (p.y - d.y) * 0.4), 5, 90);
    },
    up(p, s, api) {
      const d = s._drag;
      s._drag = null;
      if (d && (d.yaw !== s.yaw || d.pitch !== s.pitch)) api.emit("rotate", { yaw: s.yaw, pitch: s.pitch }, "action");
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    if (s.mode === "gallery") drawGallery(ctx, s, g);
    else if (s.mode === "puzzle") drawPuzzle(ctx, s, g);
    else drawFold(ctx, s, g);
    g.text.forEach(([t, color, bold], i) => label(ctx, t, 10, 8 + g.gap * (i + 0.5), { size: fitted(ctx, t, view.w - 20, g.small ? 12 : 14, bold), color, bold }));
    const note = s.mode === "puzzle"
      ? (g.small ? "Bấm ô trống để đặt, bấm ô đã đặt để bỏ" : "Bấm vào ô trống để đặt một ô vuông, bấm vào ô đã đặt để bỏ ra.")
      : g.small ? "Cùng màu, cùng dấu: hai mặt đối diện" : "Hai mặt cùng màu, cùng dấu (●, ▲, ■) là hai mặt đối diện của hình lập phương.";
    label(ctx, note, view.w / 2, view.h - (g.small ? 9 : 12), { align: "center", size: g.small ? 11 : 12, color: COLORS.muted });
  },
});
