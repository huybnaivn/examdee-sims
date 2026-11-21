import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, fieldAt, probe, probePos, moveProbe, theory, fieldLines, VIEW, ASPECT, SOL_RADIUS, WIRE_R, PROBE_HOME } from "./model.js";

const COPPER = "#c8743a";
const LINE = "#7a5af8";

/** "33,3 µT" or "4,19 mT": three significant figures. */
const tesla = b => {
  const [v, u] = b >= 1e-3 ? [b * 1e3, "mT"] : [b * 1e6, "µT"];
  return `${fmt(v, v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${u}`;
};
const cm = m => `${fmt(m * 100, 1)} cm`;

/** Centred text: the first variant that fits in maxW at `size`, else the last one shrunk to fit. */
function fit(ctx, variants, x, y, maxW, { size, bold = false, color = COLORS.ink }) {
  const font = px => `${bold ? "600 " : ""}${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.font = font(size);
  let text = variants.find(t => ctx.measureText(t).width <= maxW) ?? variants.at(-1);
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { size: w > maxW ? Math.max(8, (size * maxW) / w) : size, bold, color, align: "center" });
}

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(s, view) {
  const small = view.w < 560 || view.h < 420;
  const top = small ? 24 : 54;
  const bottom = small ? 34 : 58;
  const W = VIEW[s.source] ?? VIEW.wire;
  const H = W * ASPECT;
  const scale = Math.min((view.w - 16) / (2 * W), (view.h - top - bottom) / (2 * H));
  const cx = view.w / 2;
  const cy = top + (view.h - top - bottom) / 2;
  return { small, top, bottom, W, H, scale, cx, cy, X: x => cx + x * scale, Y: y => cy - y * scale };
}

// Field-line shapes depend only on the geometry, so they are traced once per geometry.
const lineCache = new Map();
function lines(s) {
  const key = `${s.source}|${s.radius}|${s.length}`;
  if (!lineCache.has(key)) {
    const W = VIEW[s.source];
    let seeds = [];
    if (s.source === "loop") seeds = [0, 0.25, 0.5, 0.72, 0.88].flatMap(f => (f ? [[0, f * s.radius], [0, -f * s.radius]] : [[0, 0]]));
    if (s.source === "solenoid") seeds = [0, 0.3, 0.6, 0.85].flatMap(f => (f ? [[0, f * SOL_RADIUS], [0, -f * SOL_RADIUS]] : [[0, 0]]));
    if (lineCache.size > 40) lineCache.clear();
    lineCache.set(key, fieldLines(s, seeds, W / 160, 1400));
  }
  return lineCache.get(key);
}

/** Points [x, y] (metres) where a conductor crosses the screen, with ⊙ (+1) or ⊗ (−1). */
function crossings(s) {
  const out = s.reversed ? -1 : 1;
  if (s.source === "wire") return [[0, 0, out]];
  if (s.source === "loop") return [[0, s.radius, out], [0, -s.radius, -out]];
  const n = Math.max(6, Math.min(30, Math.round(s.turns / 25)));
  const pts = [];
  for (let k = 0; k < n; k++) {
    const x = -s.length / 2 + (s.length * (k + 0.5)) / n;
    pts.push([x, SOL_RADIUS, out], [x, -SOL_RADIUS, -out]);
  }
  return pts;
}

function drawCrossing(ctx, x, y, r, dir) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COPPER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = ctx.fillStyle = COLORS.ink;
  if (dir > 0) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, r * 0.28), 0, Math.PI * 2);
    ctx.fill();
  } else {
    const c = r * 0.55;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - c, y - c);
    ctx.lineTo(x + c, y + c);
    ctx.moveTo(x + c, y - c);
    ctx.lineTo(x - c, y + c);
    ctx.stroke();
  }
}

/** Arrowheads every `gap` pixels along a polyline, pointing along the field. */
function headsAlong(ctx, pts, flip, gap) {
  let next = gap / 2;
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    while (run + len >= next) {
      const f = (next - run) / len;
      const x = ax + (bx - ax) * f;
      const y = ay + (by - ay) * f;
      const a = Math.atan2(by - ay, bx - ax) + (flip ? Math.PI : 0);
      ctx.beginPath();
      ctx.moveTo(x + 6 * Math.cos(a), y + 6 * Math.sin(a));
      ctx.lineTo(x - 5 * Math.cos(a - 0.5), y - 5 * Math.sin(a - 0.5));
      ctx.lineTo(x - 5 * Math.cos(a + 0.5), y - 5 * Math.sin(a + 0.5));
      ctx.closePath();
      ctx.fill();
      next += gap;
    }
    run += len;
  }
}

function drawLines(ctx, s, g) {
  ctx.strokeStyle = ctx.fillStyle = LINE;
  ctx.lineWidth = 1.6;
  if (s.source === "wire") {
    for (let k = 1; k <= 7; k++) {
      const r = (g.W * k * k) / 40; // spaced wider and wider: the field weakens as 1/r
      const R = r * g.scale;
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, R, 0, Math.PI * 2);
      ctx.stroke();
      for (const a of [Math.PI / 4, (5 * Math.PI) / 4]) {
        const x = g.cx + R * Math.cos(a);
        const y = g.cy - R * Math.sin(a);
        // counter-clockwise on screen when the current comes out
        const t = a + (s.reversed ? -Math.PI / 2 : Math.PI / 2);
        headsAlong(ctx, [[x, y], [x + Math.cos(t), y - Math.sin(t)]], false, 1);
      }
    }
    return;
  }
  for (const line of lines(s)) {
    const pts = line.map(([x, y]) => [g.X(x), g.Y(y)]);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    headsAlong(ctx, pts, s.reversed, g.small ? 110 : 150);
  }
}

function drawCompasses(ctx, s, g, view) {
  const step = g.small ? 34 : 44;
  const half = step * 0.34;
  const holes = crossings(s).map(([x, y]) => [g.X(x), g.Y(y)]);
  const x0 = g.cx - Math.floor((g.cx - 8) / step) * step;
  for (let px = x0; px < view.w - 8; px += step) {
    for (let py = g.cy - Math.floor((g.cy - g.top) / step) * step; py <= view.h - g.bottom; py += step) {
      if (holes.some(([hx, hy]) => Math.hypot(px - hx, py - hy) < half + 9)) continue;
      const [bx, by] = fieldAt(s, (px - g.cx) / g.scale, (g.cy - py) / g.scale);
      const a = Math.atan2(-by, bx); // screen angle
      const c = Math.cos(a) * half;
      const d = Math.sin(a) * half;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#a3acbd";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - c, py - d);
      ctx.stroke();
      ctx.strokeStyle = COLORS.red;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + c, py + d);
      ctx.stroke();
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawConductor(ctx, s, g) {
  const r = g.small ? 6 : 8;
  if (s.source === "loop") {
    ctx.strokeStyle = COPPER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(g.cx, g.cy, s.radius * g.scale * 0.22, s.radius * g.scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (s.source === "solenoid") {
    const x = g.X(-s.length / 2);
    const w = s.length * g.scale;
    ctx.fillStyle = "rgba(200, 116, 58, 0.08)";
    ctx.strokeStyle = "rgba(200, 116, 58, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, g.Y(SOL_RADIUS), w, 2 * SOL_RADIUS * g.scale);
    ctx.strokeRect(x, g.Y(SOL_RADIUS), w, 2 * SOL_RADIUS * g.scale);
  }
  const pts = crossings(s);
  const rr = s.source === "solenoid" ? Math.min(r, ((s.length / (pts.length / 2)) * g.scale) / 2 - 0.5) : Math.max(r, WIRE_R * g.scale);
  for (const [x, y, dir] of pts) drawCrossing(ctx, g.X(x), g.Y(y), rr, dir);
  // poles: field lines leave the north face
  if (s.source !== "wire") {
    const reach = s.source === "loop" ? s.radius * 0.22 * g.scale + 14 : (s.length / 2) * g.scale + 14;
    const yy = g.cy - (g.small ? 14 : 18);
    const [right, left] = s.reversed ? ["S", "N"] : ["N", "S"];
    label(ctx, right, g.cx + reach, yy, { bold: true, size: g.small ? 13 : 16, align: "center", color: right === "N" ? COLORS.red : COLORS.blue });
    label(ctx, left, g.cx - reach, yy, { bold: true, size: g.small ? 13 : 16, align: "center", color: left === "N" ? COLORS.red : COLORS.blue });
  }
}

function drawProbe(ctx, s, g, view) {
  const p = probe(s);
  const x = g.X(p.x);
  const y = g.Y(p.y);
  ctx.strokeStyle = COLORS.ink;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x, y + 14);
  ctx.lineWidth = 1;
  ctx.stroke();
  const a = Math.atan2(-p.by, p.bx);
  const L = g.small ? 30 : 40;
  arrow(ctx, x, y, x + L * Math.cos(a), y + L * Math.sin(a), COLORS.green, 3);
  const text = `B = ${tesla(p.b)}`;
  ctx.font = `600 ${g.small ? 12 : 14}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const tw = ctx.measureText(text).width + 12;
  const th = g.small ? 20 : 24;
  let bx = x + 16;
  let by = y - 16 - th;
  if (bx + tw > view.w - 4) bx = x - 16 - tw;
  if (by < 4) by = y + 16;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, tw, th, 6);
  ctx.fill();
  ctx.stroke();
  label(ctx, text, bx + 6, by + th / 2, { bold: true, size: g.small ? 12 : 14, color: COLORS.green });
}

function headline(s) {
  const B = tesla(theory(s));
  if (s.source === "wire") {
    const r = Math.max(Math.hypot(...probePos(s)), WIRE_R);
    return [`Dây dẫn thẳng dài: B = 2·10⁻⁷·I/r = 2·10⁻⁷·${fmt(s.current, 1)}/${fmt(r, 3)} = ${B}`, `B = 2·10⁻⁷·I/r = ${B} (r = ${cm(r)})`];
  }
  if (s.source === "loop") return [`Tại tâm vòng dây: B = 2π·10⁻⁷·I/R = 2π·10⁻⁷·${fmt(s.current, 1)}/${fmt(s.radius, 3)} = ${B}`, `Tại tâm: B = 2π·10⁻⁷·I/R = ${B}`];
  return [`Trong lòng ống dây: B = 4π·10⁻⁷·N·I/l = 4π·10⁻⁷·${s.turns}·${fmt(s.current, 1)}/${fmt(s.length, 2)} = ${B}`, `Trong ống dây: B = 4π·10⁻⁷·N·I/l = ${B}`];
}

function report(s, api) {
  const p = probe(s);
  api.emit("probe-read", { b: p.b * 1e6, angle: p.angle, x: p.x * 100, y: p.y * 100, current: s.current, formula: theory(s) * 1e6 }, "result");
}

const homeProbe = s => {
  [s.probeU, s.probeV] = PROBE_HOME[s.source] ?? [0, 0];
};

mount({
  slug: "tu-truong-dong-dien",
  version: "1.0.0",
  title: "Từ trường của dòng điện",
  hint: "Kéo đầu dò trên hình để đo cảm ứng từ B. Các kim nam châm nhỏ cho thấy chiều của từ trường.",
  initialState,
  controls: [
    {
      type: "select",
      key: "source",
      label: "Dòng điện chạy trong",
      onChange: homeProbe,
      options: [
        { value: "wire", label: "Dây dẫn thẳng dài (nhìn từ đầu dây)" },
        { value: "loop", label: "Vòng dây tròn" },
        { value: "solenoid", label: "Ống dây" },
      ],
    },
    { type: "slider", key: "current", label: "Cường độ dòng điện I", min: 0.5, max: 20, step: 0.5, unit: "A", digits: 1 },
    {
      type: "button",
      label: "⇄ Đổi chiều dòng điện",
      action(s, api) {
        s.reversed = !s.reversed;
        api.emit("flip", { reversed: s.reversed ? 1 : 0, current: s.current }, "action");
      },
    },
    { type: "slider", key: "radius", label: "Bán kính vòng dây R", min: 0.02, max: 0.08, step: 0.005, format: v => cm(v), visible: s => s.source === "loop" },
    { type: "slider", key: "turns", label: "Số vòng dây N", min: 50, max: 1000, step: 50, digits: 0, visible: s => s.source === "solenoid" },
    { type: "slider", key: "length", label: "Chiều dài ống dây l", min: 0.2, max: 0.5, step: 0.01, format: v => cm(v), visible: s => s.source === "solenoid" },
    { type: "checkbox", key: "showLines", label: "Hiện đường sức từ" },
    { type: "checkbox", key: "showCompass", label: "Hiện kim nam châm thử" },
    { type: "heading", label: "Đầu dò" },
    { type: "slider", key: "probeU", label: "Vị trí ngang x", min: -1, max: 1, step: 0.01, format: (v, s) => cm(probePos(s)[0]), onCommit: report },
    { type: "slider", key: "probeV", label: "Vị trí dọc y", min: -1, max: 1, step: 0.01, format: (v, s) => cm(probePos(s)[1]), onCommit: report },
  ],
  readouts: [
    { label: "Đầu dò đo được", value: s => tesla(probe(s).b) },
    { label: "Hướng của B (so với trục x)", value: s => `${fmt(probe(s).angle, 0)}°` },
    { label: "Theo công thức", value: s => `${tesla(theory(s))} (${s.source === "wire" ? "tại đầu dò" : s.source === "loop" ? "tại tâm" : "ống dây dài"})` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      moveProbe(s, (p.x - g.cx) / g.scale, (g.cy - p.y) / g.scale);
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      moveProbe(s, (p.x - g.cx) / g.scale, (g.cy - p.y) / g.scale);
    },
    up(p, s, api) {
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    if (s.showCompass) drawCompasses(ctx, s, g, view);
    if (s.showLines) drawLines(ctx, s, g);
    drawConductor(ctx, s, g);
    drawProbe(ctx, s, g, view);

    const maxW = view.w - 12;
    fit(ctx, headline(s), view.w / 2, g.small ? 12 : 22, maxW, { size: g.small ? 12 : 15, bold: true });
    if (!g.small && s.source === "solenoid")
      fit(ctx, ["Công thức đúng cho ống dây dài (l lớn hơn nhiều đường kính ống); đầu dò đo từ trường thật của ống dài hữu hạn.", "Công thức đúng cho ống dây dài; đầu dò đo từ trường thật của ống."], view.w / 2, 42, maxW, { size: 12, color: COLORS.muted });

    // scale bar
    const unit = g.W >= 0.3 ? 0.05 : g.W >= 0.15 ? 0.02 : 0.01;
    const sx = 10;
    const sy = view.h - g.bottom + (g.small ? 2 : 4);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(sx - 4, sy - 7, unit * g.scale + 50, 14);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 4);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx + unit * g.scale, sy);
    ctx.lineTo(sx + unit * g.scale, sy - 4);
    ctx.stroke();
    label(ctx, cm(unit), sx + unit * g.scale + 6, sy, { size: 11, color: COLORS.muted });

    const coil = s.source === "loop" ? "vòng dây" : "ống dây";
    const hand =
      s.source === "wire"
        ? ["Quy tắc nắm tay phải: giơ ngón cái theo chiều dòng điện, các ngón tay khum lại chỉ chiều đường sức từ.", "Nắm tay phải: ngón cái theo chiều I, các ngón khum chỉ chiều đường sức."]
        : [`Quy tắc nắm tay phải: khum các ngón tay theo chiều dòng điện trong ${coil}, ngón cái choãi ra chỉ chiều đường sức từ trong lòng ${coil}.`, `Nắm tay phải: các ngón khum theo chiều I, ngón cái chỉ chiều B trong lòng ${coil}.`];
    const note = ["⊙ dòng điện hướng ra, ⊗ hướng vào mặt phẳng hình vẽ · đầu đỏ của kim nam châm là cực Bắc · bỏ qua từ trường Trái Đất", "⊙ I hướng ra, ⊗ I hướng vào mặt hình · đầu đỏ của kim là cực Bắc"];
    const fs = g.small ? 10.5 : 12.5;
    fit(ctx, hand, view.w / 2, view.h - (g.small ? 21 : 34), maxW, { size: fs });
    fit(ctx, note, view.w / 2, view.h - (g.small ? 8 : 14), maxW, { size: fs, color: COLORS.muted });
  },
});
