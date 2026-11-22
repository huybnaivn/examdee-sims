import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import { initialState, normalize, angles, isParallel, relation, PAIRS, dirA, dirB, RANGE } from "./model.js";

const RAD = Math.PI / 180;
const SUB = ["₁", "₂", "₃", "₄"];
const name = ([v, i]) => `${v}${SUB[i - 1]}`;

// label() plus a hat over every angle name such as A₁ or B₃ (the textbook writes them with a hat).
function hatLabel(ctx, text, x, y, opts) {
  label(ctx, text, x, y, opts);
  ctx.save();
  ctx.font = `600 ${opts.size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = 1.3;
  for (const m of text.matchAll(/[AB][₁₂₃₄]/g)) {
    const x0 = x + ctx.measureText(text.slice(0, m.index)).width;
    const w = ctx.measureText(text.slice(m.index, m.index + 2)).width;
    const cx = x0 + w / 2;
    const top = y - opts.size * 0.62;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.42, top);
    ctx.quadraticCurveTo(cx, top - opts.size * 0.32, cx + w * 0.42, top);
    ctx.stroke();
  }
  ctx.restore();
}
const deg = v => `${Math.round(v)}°`;
const mod = (x, m) => ((x % m) + m) % m;
const SNAP = 2; // deg: a dragged line snaps parallel to the other one when this close

function geom(s, view) {
  const small = view.w < 520 || view.h < 420;
  const top = small ? 42 : 64; // text band
  const cx = view.w / 2;
  const cy = top + (view.h - top) / 2;
  const d = Math.min(view.w, view.h - top) * 0.2;
  const u = [Math.cos(s.c * RAD), -Math.sin(s.c * RAD)]; // canvas: y down
  const A = { x: cx + d * u[0], y: cy + d * u[1] };
  const B = { x: cx - d * u[0], y: cy - d * u[1] };
  const r = small ? 20 : 28; // arc radius
  const cap = Math.min(view.w, view.h - top) * 0.42;
  return { small, top, A, B, r, cap, view };
}

// Distance along a line from P (both ways) that keeps a handle and the line's name inside the stage.
function handleAt(g, P, dir) {
  const m = 26;
  let t = g.cap;
  for (const a of [dir, dir + 180]) {
    const cx = Math.cos(a * RAD);
    const cy = -Math.sin(a * RAD);
    if (cx > 1e-6) t = Math.min(t, (g.view.w - m - P.x) / cx);
    if (cx < -1e-6) t = Math.min(t, (m - P.x) / cx);
    if (cy > 1e-6) t = Math.min(t, (g.view.h - m - P.y) / cy);
    if (cy < -1e-6) t = Math.min(t, (g.top + m - P.y) / cy);
  }
  return Math.max(g.r + 20, t);
}

const ray = (P, dir, len) => ({ x: P.x + len * Math.cos(dir * RAD), y: P.y - len * Math.sin(dir * RAD) });

// One result per released line; a goal when that release made a ∥ b.
function report(s, api) {
  const par = isParallel(s);
  const g = angles(s);
  api.emit("line-released", { a1: s.a1, a2: g.A[1], b1: s.b1, b2: g.B[1], c: s.c, parallel: par ? 1 : 0 }, "result");
  if (par && !s._par) api.emit("made-parallel", { angle: s.a1 }, "goal");
  s._par = par;
}

function sector(ctx, P, from, span, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(P.x, P.y);
  ctx.arc(P.x, P.y, r, -from * RAD, -(from + span) * RAD, true);
  ctx.closePath();
  ctx.fill();
}

function drawVertex(ctx, s, g, v, P, dir, values, hi) {
  const rays = [dir, s.c, dir + 180, s.c + 180];
  for (let i = 0; i < 4; i++) {
    const mark = hi.find(h => h.v === v && h.i === i + 1);
    const r = mark ? g.r + 6 : g.r;
    if (mark) sector(ctx, P, rays[i], values[i], r, mark.color);
    ctx.strokeStyle = mark ? mark.stroke : COLORS.muted;
    ctx.lineWidth = mark ? 2 : 1;
    ctx.beginPath();
    ctx.arc(P.x, P.y, r * (mark ? 1 : 0.7), -rays[i] * RAD, -(rays[i] + values[i]) * RAD, true);
    ctx.stroke();
    const mid = rays[i] + values[i] / 2;
    const at = ray(P, mid, r + (g.small ? 11 : 15));
    label(ctx, String(i + 1), at.x, at.y, { size: g.small ? 11 : 13, align: "center", bold: !!mark, color: mark ? mark.stroke : COLORS.muted });
    if (s.showValues || mark) {
      const far = ray(P, mid, r + (g.small ? 30 : 40));
      label(ctx, deg(values[i]), far.x, far.y, { size: g.small ? 11 : 13, align: "center", bold: !!mark, color: mark ? mark.stroke : COLORS.ink });
    }
  }
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(P.x, P.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function line(ctx, P, dir, len, color, width) {
  const p = ray(P, dir, len);
  const q = ray(P, dir + 180, len);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(q.x, q.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function sentence(s) {
  const r = relation(s, s.pair);
  const n1 = name(r.x);
  const n2 = name(r.y);
  const head = `Góc ${n1} và góc ${n2}: hai góc ${r.kind}`;
  if (r.always) return [head, r.rel === "eq" ? `${n1} = ${n2} = ${deg(r.v1)}` : `${n1} + ${n2} = ${deg(r.v1)} + ${deg(r.v2)} = 180°`, COLORS.ink];
  if (r.rel === "eq") {
    return r.holds
      ? [head, `${n1} = ${n2} = ${deg(r.v1)} ⇒ a // b`, COLORS.green]
      : [head, `${n1} = ${deg(r.v1)} ≠ ${n2} = ${deg(r.v2)} ⇒ a không song song với b`, COLORS.red];
  }
  const sum = r.v1 + r.v2;
  return r.holds
    ? [head, `${n1} + ${n2} = ${deg(r.v1)} + ${deg(r.v2)} = 180° ⇒ a // b`, COLORS.green]
    : [head, `${n1} + ${n2} = ${deg(sum)} ≠ 180° ⇒ a không song song với b`, COLORS.red];
}

const PAIR_OPTIONS = Object.entries(PAIRS).map(([value, p]) => {
  const kind = p.kind[0].toUpperCase() + p.kind.slice(1);
  return { value, label: `${kind}: góc ${name(p.x)} và góc ${name(p.y)}` };
});

mount({
  slug: "goc-so-le-dong-vi",
  version: "1.0.0",
  title: "Hai đường thẳng song song và các góc tạo bởi một đường cắt",
  hint: "Kéo đường thẳng a hoặc b (chấm tròn ở đầu) để xoay quanh giao điểm. Tìm vị trí để a // b.",
  initialState,
  sanitize(incoming, base) {
    const out = { ...base };
    for (const k of Object.keys(base)) if (typeof incoming[k] === typeof base[k]) out[k] = incoming[k];
    return normalize(out);
  },
  controls: [
    { type: "select", key: "pair", label: "Cặp góc tô màu", options: PAIR_OPTIONS },
    { type: "slider", key: "a1", label: "Góc A₁", min: RANGE.a1[0], max: RANGE.a1[1], step: 1, unit: "°", digits: 0, onCommit: report },
    { type: "slider", key: "b1", label: "Góc B₁", min: RANGE.b1[0], max: RANGE.b1[1], step: 1, unit: "°", digits: 0, onCommit: report },
    { type: "slider", key: "c", label: "Độ nghiêng đường thẳng c", min: RANGE.c[0], max: RANGE.c[1], step: 1, unit: "°", digits: 0 },
    { type: "checkbox", key: "showValues", label: "Hiện số đo cả tám góc" },
  ],
  readouts: [
    { label: "Vị trí của a và b", value: s => (isParallel(s) ? "a // b" : "a cắt b") },
    { label: "Góc A₁, A₂, A₃, A₄", value: s => angles(s).A.map(deg).join(", ") },
    { label: "Góc B₁, B₂, B₃, B₄", value: s => angles(s).B.map(deg).join(", ") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      // distance from p to each line through its vertex, ignoring the area right at the vertex
      const dist = (P, dir) => {
        const dx = p.x - P.x;
        const dy = p.y - P.y;
        return Math.hypot(dx, dy) < g.r + 4 ? Infinity : Math.abs(dx * Math.sin(dir * RAD) + dy * Math.cos(dir * RAD));
      };
      const da = dist(g.A, dirA(s));
      const db = dist(g.B, dirB(s));
      if (Math.min(da, db) > 16) return false;
      s._drag = da <= db ? "a1" : "b1";
      return true;
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      const P = s._drag === "a1" ? g.A : g.B;
      const phi = Math.atan2(-(p.y - P.y), p.x - P.x) / RAD;
      let v = clamp(Math.round(mod(s.c - phi, 180)), ...RANGE[s._drag]);
      const other = s._drag === "a1" ? s.b1 : s.a1;
      if (Math.abs(v - other) <= SNAP) v = other;
      s[s._drag] = v;
    },
    up(p, s, api) {
      api.emit("rotate-line", { line: s._drag === "a1" ? 1 : 2, angle: s[s._drag] }, "action");
      s._drag = null;
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const all = angles(s);
    const r = relation(s, s.pair);
    const hi = [
      { v: r.x[0], i: r.x[1], color: "rgba(240, 140, 46, 0.35)", stroke: COLORS.orange },
      { v: r.y[0], i: r.y[1], color: "rgba(122, 90, 248, 0.3)", stroke: COLORS.purple },
    ];
    const len = view.w + view.h;
    const par = isParallel(s);

    line(ctx, g.A, s.c, len, COLORS.ink, 2);
    line(ctx, g.A, dirA(s), len, COLORS.blue, par ? 3 : 2.5);
    line(ctx, g.B, dirB(s), len, COLORS.green, par ? 3 : 2.5);

    drawVertex(ctx, s, g, "A", g.A, dirA(s), all.A, hi);
    drawVertex(ctx, s, g, "B", g.B, dirB(s), all.B, hi);

    // drag handles at both ends of a and b
    for (const [P, dir, color] of [[g.A, dirA(s), COLORS.blue], [g.B, dirB(s), COLORS.green]]) {
      for (const t of [0, 180]) {
        const h = ray(P, dir + t, handleAt(g, P, dir));
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, g.small ? 6 : 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    // names of lines and points
    const size = g.small ? 13 : 16;
    const na = ray(g.A, dirA(s), handleAt(g, g.A, dirA(s)));
    const nb = ray(g.B, dirB(s), handleAt(g, g.B, dirB(s)));
    label(ctx, "a", na.x, na.y - 16, { size, bold: true, color: COLORS.blue, align: "center" });
    label(ctx, "b", nb.x, nb.y - 16, { size, bold: true, color: COLORS.green, align: "center" });
    const nc = ray(g.A, s.c, handleAt(g, g.A, s.c));
    label(ctx, "c", nc.x + 12, nc.y, { size, bold: true });
    // point name inside the wider of the two upper angles, between the vertex and the arcs
    const at = (P, dir, x1) => ray(P, x1 >= 90 ? dir + x1 / 2 : s.c + (180 - x1) / 2, g.r * 0.55);
    const la = at(g.A, dirA(s), s.a1);
    const lb = at(g.B, dirB(s), s.b1);
    label(ctx, "A", la.x, la.y, { size: size - 2, bold: true, align: "center" });
    label(ctx, "B", lb.x, lb.y, { size: size - 2, bold: true, align: "center" });

    // the highlighted relation and what it says about a and b
    const [head, body, color] = sentence(s);
    ctx.fillStyle = "rgba(247, 249, 253, 0.92)";
    ctx.fillRect(0, 0, view.w, g.top - 4);
    hatLabel(ctx, head, 10, g.small ? 13 : 22, { size: g.small ? 12 : 15, bold: true, color: COLORS.ink });
    hatLabel(ctx, body, 10, g.small ? 31 : 47, { size: g.small ? 12 : 15, color, bold: true });
  },
});
