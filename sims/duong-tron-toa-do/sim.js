import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, expandedC, fromExpanded, circle, relative, tangentC, R_MIN, R_MAX } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const AB = 5; // centre coordinates run from −AB to AB
const C_LINE = 30;
const SNAP = 10; // px: a dragged line this close to tangent becomes tangent

// ---------- text ----------
const exact = v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-7;
const eq = v => `${exact(v) ? "=" : "≈"} ${fmt(v)}`;
const pt = p => `(${fmt(p.x)}; ${fmt(p.y)})`;
/** √n written exactly when n is a perfect square (of a 2-decimal number), else √n. */
const root = n => (exact(Math.sqrt(n)) ? fmt(Math.sqrt(n)) : `√${fmt(n)}`);

const poly = terms => {
  const used = terms.filter(([k]) => Math.abs(k) > 1e-12);
  if (!used.length) return "0";
  return used.map(([k, v], i) => (i ? (k < 0 ? " − " : " + ") : k < 0 ? "−" : "") + (Math.abs(k) === 1 && v ? "" : fmt(Math.abs(k))) + v).join("");
};
const square = (v, a) => (a === 0 ? `${v}²` : `(${v} ${a < 0 ? "+" : "−"} ${fmt(Math.abs(a))})²`);
const standard = cir => `${square("x", cir.a)} + ${square("y", cir.b)} = ${exact(cir.r2) ? fmt(cir.r2) : fmt(cir.r2, 4)}`;
const expandedText = cir => `${poly([[1, "x²"], [1, "y²"], [-2 * cir.a, "x"], [-2 * cir.b, "y"], [cir.c, ""]])} = 0`;
const radius = cir => (cir.R === null ? "–" : exact(cir.R) ? fmt(cir.R) : `${root(cir.r2)} ≈ ${fmt(cir.R)}`);

/** Δ: Ax + By + C = 0; a C made tangent by snapping is written exactly as −(Aa + Bb) ± R√(A² + B²). */
function lineText(s, cir) {
  const n2 = s.A * s.A + s.B * s.B;
  if (!exact(s.C) && cir.R !== null && n2 > 0 && !exact(Math.sqrt(n2))) {
    const base = -(s.A * cir.a + s.B * cir.b);
    const k = (s.C - base) / (cir.R * Math.sqrt(n2));
    if (Math.abs(Math.abs(k) - 1) < 1e-9) return `${poly([[s.A, "x"], [s.B, "y"], [base, ""], [Math.sign(k) * cir.R, `√${fmt(n2)}`]])} = 0`;
  }
  return `${poly([[s.A, "x"], [s.B, "y"], [s.C, ""]])} = 0`;
}

const POSITION = {
  cut: "d < R: Δ cắt (C) tại hai điểm",
  tangent: "d = R: Δ tiếp xúc với (C)",
  apart: "d > R: Δ và (C) không có điểm chung",
};
const SHORT = { cut: "cắt nhau", tangent: "tiếp xúc", apart: "không cắt" };

function expandedStatus(cir) {
  const r2 = fmt(cir.r2);
  if (cir.R !== null) return `a² + b² − c = ${r2} > 0: đường tròn tâm I(${fmt(cir.a)}; ${fmt(cir.b)}), R = ${radius(cir)}`;
  return Math.abs(cir.r2) < 1e-9
    ? `a² + b² − c = 0: không phải đường tròn (chỉ có điểm I(${fmt(cir.a)}; ${fmt(cir.b)}))`
    : `a² + b² − c = ${r2} < 0: không phải đường tròn (không có điểm nào)`;
}

// ---------- state links and events ----------

/** Keep R and c consistent: in "expanded" mode c is the input, otherwise R is. */
function link(s) {
  if (s.mode === "expanded") {
    const { R } = fromExpanded(s.a, s.b, s.c);
    if (R !== null) s.R = clamp(R, R_MIN, R_MAX);
  } else {
    s.c = expandedC(s.a, s.b, clamp(s.R, R_MIN, R_MAX));
  }
}

// The goal is reached once each time the line becomes tangent, not on every check while it stays so.
function checkTangent(s, api) {
  if (s.mode !== "line") return;
  const r = relative(circle(s), s.A, s.B, s.C);
  const tangent = r?.kind === "tangent";
  if (tangent && !s._tangent) api.emit("line-tangent", { x: r.H.x, y: r.H.y, R: r.d }, "goal");
  s._tangent = tangent;
}

function circleSet(s, api) {
  link(s);
  const cir = circle(s);
  if (cir.R !== null) api.emit("circle-set", { a: cir.a, b: cir.b, R: cir.R, c: cir.c }, "result");
  checkTangent(s, api);
}

function lineSet(s, api) {
  const r = relative(circle(s), s.A, s.B, s.C);
  if (r) api.emit("line-checked", { d: r.d, R: circle(s).R, points: r.points.length }, "result");
  checkTangent(s, api);
}

const coord = (key, name) => ({ type: "slider", key, label: name, min: -AB, max: AB, step: 0.5, digits: 1, onChange: link, onCommit: circleSet });
const lineCoef = (key, name, min, max, step) => ({
  type: "slider",
  key,
  label: name,
  min,
  max,
  step,
  visible: s => s.mode === "line",
  onCommit: lineSet,
});

// ---------- geometry ----------
function geom(view) {
  const small = view.w < 520 || view.h < 420;
  const ppu = Math.min(view.w, view.h) / (small ? 15 : 17);
  const ox = view.w / 2;
  const oy = view.h / 2;
  return {
    small, ppu, ox, oy,
    X: x => ox + x * ppu,
    Y: y => oy - y * ppu,
    world: p => ({ x: (p.x - ox) / ppu, y: (oy - p.y) / ppu }),
  };
}

const mPoint = (s, cir) => ({ x: cir.a + cir.R * Math.cos(s.phi), y: cir.b + cir.R * Math.sin(s.phi) });

function tag(ctx, text, x, y, opts = {}) {
  const size = opts.size ?? 13;
  ctx.save();
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.bg;
  ctx.strokeText(text, x, y);
  ctx.restore();
  label(ctx, text, x, y, { bold: true, size, ...opts });
}

function dot(ctx, x, y, color, r = 5.5) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

mount({
  slug: "duong-tron-toa-do",
  version: "1.0.0",
  title: "Phương trình đường tròn",
  hint: "Kéo tâm I hoặc điểm M trên đường tròn (hoặc dùng thanh trượt). Ở chế độ có đường thẳng Δ, kéo Δ song song với chính nó; khi Δ đến gần vị trí tiếp xúc, nó được hút vào đúng vị trí đó.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Chế độ",
      onChange: link,
      onCommit: (s, api) => (s.mode === "line" ? lineSet(s, api) : circleSet(s, api)),
      options: [
        { value: "circle", label: "Đường tròn: tâm và bán kính" },
        { value: "expanded", label: "Đường tròn: dạng khai triển" },
        { value: "line", label: "Đường tròn và đường thẳng Δ" },
      ],
    },
    coord("a", "Hoành độ tâm a"),
    coord("b", "Tung độ tâm b"),
    { type: "slider", key: "R", label: "Bán kính R", min: R_MIN, max: R_MAX, step: 0.1, visible: s => s.mode !== "expanded", onChange: link, onCommit: circleSet },
    { type: "slider", key: "c", label: "Hệ số c", min: -40, max: 50, step: 0.25, visible: s => s.mode === "expanded", onChange: link, onCommit: circleSet },
    { type: "heading", label: "Đường thẳng Δ: Ax + By + C = 0", visible: s => s.mode === "line" },
    lineCoef("A", "Hệ số A", -5, 5, 1),
    lineCoef("B", "Hệ số B", -5, 5, 1),
    lineCoef("C", "Hệ số C", -C_LINE, C_LINE, 0.5),
  ],
  readouts: [
    { label: "Tâm I", value: s => `(${fmt(s.a)}; ${fmt(s.b)})` },
    { label: "Bán kính R", value: s => radius(circle(s)) },
    { label: "(x − a)² + (y − b)² = R²", value: s => (circle(s).R === null ? "–" : standard(circle(s))) },
    { label: "x² + y² − 2ax − 2by + c = 0", value: s => expandedText(circle(s)) },
    { label: "a² + b² − c", value: s => `${fmt(circle(s).r2)} ${circle(s).R === null ? "≤ 0: không phải đường tròn" : "> 0"}` },
    { label: "Δ", value: s => (s.mode === "line" ? lineText(s, circle(s)) : "–") },
    {
      label: "d(I, Δ) = |Aa + Bb + C|/√(A² + B²)",
      value: s => {
        if (s.mode !== "line") return "–";
        const r = relative(circle(s), s.A, s.B, s.C);
        if (!r) return "A, B không đồng thời bằng 0";
        return `${fmt(Math.abs(s.A * s.a + s.B * s.b + s.C))}/${root(s.A * s.A + s.B * s.B)} ${eq(r.d)}`;
      },
    },
    { label: "Vị trí của Δ và (C)", value: s => (s.mode === "line" ? (r => (r ? POSITION[r.kind] : "–"))(relative(circle(s), s.A, s.B, s.C)) : "–") },
    {
      label: "Giao điểm",
      value: s => {
        const r = s.mode === "line" && relative(circle(s), s.A, s.B, s.C);
        return r && r.points.length ? r.points.map(pt).join("; ") : "–";
      },
    },
  ],
  pointer: {
    down(p, s, api, view) {
      if (s.mode === "expanded") return false;
      const g = geom(view);
      const cir = circle(s);
      const m = mPoint(s, cir);
      const near = (x, y) => Math.hypot(p.x - g.X(x), p.y - g.Y(y)) < 20;
      if (near(m.x, m.y)) s._drag = "M";
      else if (near(s.a, s.b)) s._drag = "I";
      else if (s.mode === "line" && (s.A || s.B)) {
        const w = g.world(p);
        if ((Math.abs(s.A * w.x + s.B * w.y + s.C) / Math.hypot(s.A, s.B)) * g.ppu > 14) return false;
        s._drag = "line";
      } else return false;
      return true;
    },
    move(p, s, api, view) {
      const g = geom(view);
      const w = g.world(p);
      if (s._drag === "I") {
        s.a = clamp(Math.round(w.x * 2) / 2, -AB, AB);
        s.b = clamp(Math.round(w.y * 2) / 2, -AB, AB);
      } else if (s._drag === "M") {
        s.R = clamp(Math.round(Math.hypot(w.x - s.a, w.y - s.b) * 10) / 10, R_MIN, R_MAX);
        s.phi = Math.atan2(w.y - s.b, w.x - s.a);
      } else if (s._drag === "line") {
        let C = -(s.A * w.x + s.B * w.y);
        const tc = tangentC(circle(s), s.A, s.B, C);
        if ((Math.abs(tc - C) / Math.hypot(s.A, s.B)) * g.ppu < SNAP) C = tc;
        s.C = clamp(C, -C_LINE, C_LINE);
      }
      link(s);
    },
    up(p, s, api) {
      if (s._drag === "line") lineSet(s, api);
      else circleSet(s, api);
      s._drag = null;
    },
  },
  draw(ctx, s, view) {
    const { w, h } = view;
    const g = geom(view);
    const { X, Y, ppu, small } = g;
    const cir = circle(s);
    const xMax = w / 2 / ppu;
    const yMax = h / 2 / ppu;

    // grid and axes
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -Math.floor(xMax); i <= xMax; i++) (ctx.moveTo(X(i), 0), ctx.lineTo(X(i), h));
    for (let i = -Math.floor(yMax); i <= yMax; i++) (ctx.moveTo(0, Y(i)), ctx.lineTo(w, Y(i)));
    ctx.stroke();
    arrow(ctx, 0, g.oy, w - 3, g.oy, COLORS.ink, 1.5);
    arrow(ctx, g.ox, h, g.ox, 3, COLORS.ink, 1.5);
    label(ctx, "x", w - 12, g.oy - 14, { bold: true });
    label(ctx, "y", g.ox + 12, 12, { bold: true });
    label(ctx, "O", g.ox - 10, g.oy + 12, { size: 12, color: COLORS.muted });
    const every = ppu < 34 ? 2 : 1;
    const ticks = { size: 11, color: COLORS.muted };
    for (let i = -Math.floor(xMax - 0.5); i <= xMax - 0.5; i++) if (i && i % every === 0) label(ctx, fmt(i, 0), X(i), g.oy + 12, { ...ticks, align: "center" });
    for (let i = -Math.floor(yMax - 0.5); i <= yMax - 0.5; i++) if (i && i % every === 0) label(ctx, fmt(i, 0), g.ox - 7, Y(i), { ...ticks, align: "right" });

    // circle, radius IM
    if (cir.R !== null) {
      ctx.fillStyle = "rgba(47, 111, 237, 0.07)";
      ctx.strokeStyle = COLORS.blue;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(X(cir.a), Y(cir.b), cir.R * ppu, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (s.mode !== "expanded") {
        const m = mPoint(s, cir);
        ctx.strokeStyle = COLORS.orange;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(X(cir.a), Y(cir.b));
        ctx.lineTo(X(m.x), Y(m.y));
        ctx.stroke();
        dot(ctx, X(m.x), Y(m.y), COLORS.orange, 7);
        const mid = { x: (cir.a + m.x) / 2, y: (cir.b + m.y) / 2 };
        // label beside the middle of IM, on the side away from the centre line
        const nx = -Math.sin(s.phi), ny = Math.cos(s.phi);
        tag(ctx, `R ${eq(cir.R)}`, X(mid.x + nx * 0.45), Y(mid.y + ny * 0.45), { color: COLORS.orange, align: "center", size: 12 });
        tag(ctx, "M", X(m.x) + 10 * Math.cos(s.phi) + 4, Y(m.y) - 10 * Math.sin(s.phi) - 4, { color: COLORS.orange, align: "center" });
      }
    }

    // line Δ, distance IH, intersections
    let r = null;
    let uh = null; // unit vector I → H on screen
    if (s.mode === "line" && (s.A || s.B)) {
      r = relative(cir, s.A, s.B, s.C);
      const n = Math.hypot(s.A, s.B);
      const p0 = { x: (-s.C * s.A) / (n * n), y: (-s.C * s.B) / (n * n) };
      const u = { x: -s.B / n, y: s.A / n };
      const L = 60;
      ctx.strokeStyle = r.kind === "tangent" ? COLORS.green : COLORS.ink;
      ctx.lineWidth = r.kind === "tangent" ? 3 : 2.5;
      ctx.beginPath();
      ctx.moveTo(X(p0.x - L * u.x), Y(p0.y - L * u.y));
      ctx.lineTo(X(p0.x + L * u.x), Y(p0.y + L * u.y));
      ctx.stroke();
      // name Δ where it leaves the view on the right (or top)
      const vis = [];
      for (let t = -L; t <= L; t += 0.05) {
        const q = { x: p0.x + t * u.x, y: p0.y + t * u.y };
        if (Math.abs(q.x) < xMax - 0.6 && Math.abs(q.y) < yMax - 0.6) vis.push(q);
      }
      if (vis.length) {
        const end = vis.reduce((best, q) => (q.x > best.x + 1e-9 || (Math.abs(q.x - best.x) < 1e-9 && q.y > best.y) ? q : best));
        tag(ctx, "Δ", X(end.x) - 6, Y(end.y) - 12, { color: ctx.strokeStyle, align: "right", size: 15 });
      }
      // perpendicular IH
      ctx.strokeStyle = COLORS.purple;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(X(cir.a), Y(cir.b));
      ctx.lineTo(X(r.H.x), Y(r.H.y));
      ctx.stroke();
      ctx.setLineDash([]);
      const hx = X(r.H.x) - X(cir.a), hy = Y(r.H.y) - Y(cir.b);
      const hk = Math.hypot(hx, hy) || 1;
      uh = { x: hx / hk, y: hy / hk };
      if (r.kind !== "tangent") {
        dot(ctx, X(r.H.x), Y(r.H.y), COLORS.purple, 4);
        if (hk > 18) tag(ctx, "H", X(r.H.x) + uh.x * 12, Y(r.H.y) + uh.y * 12, { color: COLORS.purple, size: 12, align: "center" });
      }
      if (hk > 30) {
        // beside the middle of IH, on the side facing away from the centre of the view
        let nx = -uh.y, ny = uh.x;
        if (nx * (X(cir.a) - g.ox) + ny * (Y(cir.b) - g.oy) < 0) (nx = -nx), (ny = -ny);
        tag(ctx, `d ${eq(r.d)}`, (X(cir.a) + X(r.H.x)) / 2 + nx * 14, (Y(cir.b) + Y(r.H.y)) / 2 + ny * 14, { color: COLORS.purple, size: 12, align: nx > 0.3 ? "left" : nx < -0.3 ? "right" : "center" });
      }
      const names = r.kind === "tangent" ? ["H"] : ["E", "F"];
      r.points.forEach((q, i) => {
        dot(ctx, X(q.x), Y(q.y), r.kind === "tangent" ? COLORS.green : COLORS.red, 6);
        const text = small ? names[i] : `${names[i]}${pt(q)}`;
        const out = { x: q.x - cir.a, y: q.y - cir.b }; // label outside the circle
        const k = Math.hypot(out.x, out.y) || 1;
        const lx = X(q.x) + (out.x / k) * 16;
        tag(ctx, text, lx, Y(q.y) - (out.y / k) * 16, { color: r.kind === "tangent" ? COLORS.green : COLORS.red, align: out.x >= 0 ? "left" : "right", size: 12 });
      });
    }

    // centre
    // its label goes in the direction (of 8) farthest from IM and IH
    dot(ctx, X(s.a), Y(s.b), COLORS.purple, cir.R === null ? 6 : 7);
    const busy = [];
    if (cir.R !== null && s.mode !== "expanded") busy.push({ x: Math.cos(s.phi), y: -Math.sin(s.phi) });
    if (uh) busy.push(uh);
    let best = { x: 0, y: 1 }, score = Infinity;
    for (let k = 0; k < 8; k++) {
      const c = { x: Math.round(Math.cos((k * Math.PI) / 4) * 1e6) / 1e6, y: Math.round(Math.sin((k * Math.PI) / 4) * 1e6) / 1e6 };
      const sc = Math.max(-1, ...busy.map(b => c.x * b.x + c.y * b.y));
      if (sc < score - 1e-9) (score = sc), (best = c);
    }
    tag(ctx, small ? "I" : `I(${fmt(s.a)}; ${fmt(s.b)})`, X(s.a) + best.x * 14, Y(s.b) + best.y * 14, {
      color: COLORS.purple,
      align: best.x > 0.3 ? "left" : best.x < -0.3 ? "right" : "center",
    });

    // equation box
    let lines;
    if (s.mode === "expanded") lines = [expandedText(cir), expandedStatus(cir)];
    else if (s.mode === "line") {
      const pos = r ? `d(I, Δ) ${eq(r.d)}, R ${eq(cir.R)}: ${SHORT[r.kind]}` : "A, B không đồng thời bằng 0";
      lines = small ? [pos] : [`(C): ${standard(cir)}`, `Δ: ${lineText(s, cir)}`, pos];
    } else lines = small ? [standard(cir)] : [`(C): ${standard(cir)}`, expandedText(cir)];
    let size = small ? 13 : 16;
    const widest = () =>
      Math.max(...lines.map((t, i) => {
        ctx.font = `${i ? "" : "600 "}${i ? size - 2 : size}px ${FONT}`;
        return ctx.measureText(t).width;
      }));
    size = Math.min(size, (size * (w - 44)) / widest());
    const lh = size * 1.4;
    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.strokeStyle = cir.R === null ? COLORS.red : COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(10, 10, widest() + 24, lh * lines.length + 10, 10);
    ctx.fill();
    ctx.stroke();
    const color = i => (i === 0 ? COLORS.blue : cir.R === null ? COLORS.red : r?.kind === "tangent" && i === lines.length - 1 ? COLORS.green : COLORS.ink);
    lines.forEach((t, i) => label(ctx, t, 22, 15 + lh * (i + 0.5), { size: i ? size - 2 : size, bold: i === 0 || (r?.kind === "tangent" && i === lines.length - 1), color: color(i) }));
  },
});
