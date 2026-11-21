import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, inequalities, holds, satisfiesAll, excluded, regionIn, vertices, classify, optimise, SIGNS, area } from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const TONE = [COLORS.blue, COLORS.red, COLORS.purple];
const HATCH = [Math.PI / 4, -Math.PI / 4, 0]; // a different hatch direction per inequality, so overlaps stay readable
const NUM = ["(1)", "(2)", "(3)"];
const SNAP = 14; // px: a test point dropped this close to a vertex lands on it

const term = (k, v, first) => {
  if (k === 0) return "";
  const body = (Math.abs(k) === 1 ? "" : fmt(Math.abs(k))) + v;
  return first ? (k < 0 ? "−" : "") + body : (k < 0 ? " − " : " + ") + body;
};
const lhs = (a, b) => (a === 0 && b === 0 ? "0x + 0y" : `${term(a, "x", true)}${term(b, "y", a === 0)}`);
const ineqText = e => `${lhs(e.a, e.b)} ${SIGNS[e.sign]} ${fmt(e.c)}`;
const objText = s => `F = ${s.p === 0 && s.q === 0 ? "0" : lhs(s.p, s.q)}`;
const pt = (x, y) => `(${fmt(x)}; ${fmt(y)})`;

/** Max and min of F only make sense here on a bounded region whose boundary belongs to it (≤, ≥ only). */
function objective(s) {
  if (!s.showObj) return null;
  const list = inequalities(s);
  if (list.some(e => e.sign === "lt" || e.sign === "gt")) return { strict: true };
  return optimise(list, s.p, s.q);
}

function fit(ctx, text, maxW, size, bold) {
  let sz = size;
  const set = () => (ctx.font = `${bold ? "600 " : ""}${sz}px ${FONT}`);
  set();
  while (sz > 8 && ctx.measureText(text).width > maxW) {
    sz--;
    set();
  }
  return sz;
}

function geom(s, view) {
  const small = view.w < 560 || view.h < 420;
  const head = small ? 24 : 38; // the system, above the plot
  const foot = small ? 22 : 54; // the objective and the drawing convention, under it
  const size = Math.max(60, Math.min(view.w - 16, view.h - head - foot));
  const x0 = (view.w - size) / 2;
  const y0 = head + Math.max(0, (view.h - head - foot - size) / 2);
  const R = s.zoom;
  const u = size / (2 * R);
  return { small, head, foot, size, x0, y0, R, u, cx: x0 + size / 2, cy: y0 + size / 2 };
}
const toScreen = (g, x, y) => [g.cx + x * g.u, g.cy - y * g.u];
const toWorld = (g, p) => [(p.x - g.cx) / g.u, (g.cy - p.y) / g.u];

const path = (ctx, g, poly) => {
  ctx.beginPath();
  poly.forEach(([x, y], i) => ctx[i ? "lineTo" : "moveTo"](...toScreen(g, x, y)));
  ctx.closePath();
};

// ---------- events ----------

const testPoint = (s, api) => {
  const satisfies = satisfiesAll(inequalities(s), s.px, s.py) ? 1 : 0;
  api.emit("test-point", { x: s.px, y: s.py, satisfies }, "result");
  // the goal: the test point put on the vertex where F is largest or smallest
  const o = objective(s);
  if (!o?.max) return;
  const hit = [o.max, o.min].find(v => Math.hypot(v.x - s.px, v.y - s.py) < 1e-6);
  if (!hit) return;
  const key = [...inequalities(s).flatMap(e => Object.values(e)), s.p, s.q, hit.x, hit.y].join();
  if (key === s._optimum) return; // once per vertex and system, not on every repeated drop
  s._optimum = key;
  api.emit("optimum-found", { x: hit.x, y: hit.y, F: hit.F, isMax: hit === o.max ? 1 : 0 }, "goal");
};

// After a finished change of the system or of F: report max and min once per new combination.
const evaluate = (s, api) => {
  const o = objective(s);
  if (!o?.max) return;
  const key = [...inequalities(s).flatMap(e => Object.values(e)), s.p, s.q].join();
  if (key === s._evaluated) return;
  s._evaluated = key;
  api.emit("objective-evaluated", { max: o.max.F, min: o.min.F }, "result");
};

// ---------- drawing ----------

function drawGrid(ctx, g) {
  const { x0, y0, size, R } = g;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x0, y0, size, size);
  const step = R / 6; // 12 squares across
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = -6; k <= 6; k++) {
    const [x] = toScreen(g, k * step, 0);
    const [, y] = toScreen(g, 0, k * step);
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + size);
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + size, y);
  }
  ctx.stroke();
  arrow(ctx, x0, g.cy, x0 + size, g.cy, COLORS.muted, 1.5);
  arrow(ctx, g.cx, y0 + size, g.cx, y0, COLORS.muted, 1.5);
  const ts = g.small ? 10 : 12;
  label(ctx, "x", x0 + size - 8, g.cy + 12, { size: ts + 1, color: COLORS.muted, align: "center" });
  label(ctx, "y", g.cx + 11, y0 + 9, { size: ts + 1, color: COLORS.muted, align: "center" });
  label(ctx, "O", g.cx - 8, g.cy + 10, { size: ts, color: COLORS.muted, align: "center" });
  for (const k of [-4, -2, 2, 4]) {
    const [x, y] = toScreen(g, k * step, k * step);
    label(ctx, fmt(k * step), x, g.cy + 10, { size: ts, color: COLORS.muted, align: "center" });
    label(ctx, fmt(k * step), g.cx - 5, y, { size: ts, color: COLORS.muted, align: "right" });
  }
}

/** Textbook convention: cross out (gạch bỏ) the half-plane that is NOT a solution of each inequality. */
function drawHatch(ctx, g, e, i) {
  const big = g.R * 2;
  let poly;
  if (e.a === 0 && e.b === 0) poly = holds(e, 0, 0) ? [] : regionIn([], big); // all or nothing
  else poly = regionIn([excluded(e)], big);
  if (poly.length < 3) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(g.x0, g.y0, g.size, g.size);
  ctx.clip();
  path(ctx, g, poly);
  ctx.clip();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = TONE[i];
  ctx.fillRect(g.x0, g.y0, g.size, g.size);
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = TONE[i];
  ctx.lineWidth = 1;
  const a = HATCH[i];
  const [dx, dy] = [Math.cos(a), Math.sin(a)];
  const L = g.size * 1.5;
  const gap = g.small ? 7 : 9;
  ctx.beginPath();
  for (let t = -L; t <= L; t += gap) {
    const mx = g.cx - dy * t;
    const my = g.cy + dx * t;
    ctx.moveTo(mx - dx * L, my - dy * L);
    ctx.lineTo(mx + dx * L, my + dy * L);
  }
  ctx.stroke();
  ctx.restore();
}

/** The boundary line: solid when it belongs to the solution set (≤, ≥), dashed when it does not (<, >). */
function drawLine(ctx, g, e, i) {
  if (e.a === 0 && e.b === 0) return;
  const seg = regionIn([{ ...e, sign: "le" }, { ...e, sign: "ge" }], g.R);
  if (seg.length < 2) return;
  const [P, Q] = [seg[0], seg.at(-1)];
  ctx.save();
  ctx.strokeStyle = TONE[i];
  ctx.lineWidth = g.small ? 2 : 2.5;
  ctx.setLineDash(e.sign === "lt" || e.sign === "gt" ? [8, 6] : []);
  ctx.beginPath();
  ctx.moveTo(...toScreen(g, ...P));
  ctx.lineTo(...toScreen(g, ...Q));
  ctx.stroke();
  ctx.restore();
  // name near one end, pulled inside the plot and to the side of the line
  const t = [0.12, 0.88, 0.28][i];
  const [x, y] = toScreen(g, P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t);
  const len = Math.hypot(e.a, e.b);
  const n = g.small ? 11 : 14;
  label(ctx, `d${"₁₂₃"[i]}`, clamp(x + (e.a / len) * n, g.x0 + 10, g.x0 + g.size - 10), clamp(y - (e.b / len) * n, g.y0 + 9, g.y0 + g.size - 9), { color: TONE[i], bold: true, size: g.small ? 12 : 15, align: "center" });
}

mount({
  slug: "bat-phuong-trinh-hai-an",
  version: "1.0.0",
  title: "Bất phương trình bậc nhất hai ẩn và hệ",
  hint: "Đổi hệ số và dấu của từng bất phương trình. Phần bị gạch không thuộc miền nghiệm, đường nét đứt là bờ không thuộc miền nghiệm. Kéo điểm M để thử, thả M lên đỉnh làm F lớn nhất hoặc nhỏ nhất.",
  initialState,
  controls: [
    { type: "stepper", key: "count", label: "Số bất phương trình", min: 1, max: 3, onCommit: evaluate },
    ...[1, 2, 3].flatMap(i => {
      const on = s => s.count >= i;
      return [
        { type: "heading", label: `Bất phương trình ${NUM[i - 1]}: ax + by … c`, visible: on },
        { type: "stepper", key: `a${i}`, label: "a (hệ số của x)", min: -10, max: 10, visible: on, onCommit: evaluate },
        { type: "stepper", key: `b${i}`, label: "b (hệ số của y)", min: -10, max: 10, visible: on, onCommit: evaluate },
        {
          type: "select",
          key: `s${i}`,
          label: "Dấu",
          visible: on,
          onCommit: evaluate,
          options: Object.entries(SIGNS).map(([value, sign]) => ({ value, label: sign })),
        },
        { type: "stepper", key: `c${i}`, label: "c (vế phải)", min: -20, max: 20, visible: on, onCommit: evaluate },
      ];
    }),
    { type: "heading", label: "Điểm thử M" },
    { type: "slider", key: "px", label: "Hoành độ x", min: -24, max: 24, step: 0.1, digits: 2, onCommit: testPoint },
    { type: "slider", key: "py", label: "Tung độ y", min: -24, max: 24, step: 0.1, digits: 2, onCommit: testPoint },
    {
      type: "select",
      key: "zoom",
      label: "Khung hình",
      options: [6, 12, 24].map(v => ({ value: v, label: `−${v} ≤ x, y ≤ ${v}` })),
    },
    { type: "heading", label: "Biểu thức F = px + qy" },
    { type: "checkbox", key: "showObj", label: "Tìm giá trị lớn nhất, nhỏ nhất của F", onCommit: evaluate },
    { type: "stepper", key: "p", label: "p (hệ số của x)", min: -10, max: 10, visible: s => s.showObj, onCommit: evaluate },
    { type: "stepper", key: "q", label: "q (hệ số của y)", min: -10, max: 10, visible: s => s.showObj, onCommit: evaluate },
  ],
  readouts: [
    {
      label: "Miền nghiệm của hệ",
      value: s => {
        const kind = classify(inequalities(s));
        return kind === "empty" ? "rỗng (hệ vô nghiệm)" : kind === "unbounded" ? "không bị chặn" : `bị chặn, ${vertices(inequalities(s)).length} đỉnh`;
      },
    },
    { label: "M(x; y)", value: s => pt(s.px, s.py) },
    { label: "M thuộc miền nghiệm", value: s => (satisfiesAll(inequalities(s), s.px, s.py) ? "có" : "không") },
    ...[0, 1, 2].map(i => ({
      label: `${NUM[i]} tại M`,
      value: s => {
        const e = inequalities(s)[i];
        if (!e) return "–";
        return `${fmt(e.a * s.px + e.b * s.py)} ${SIGNS[e.sign]} ${fmt(e.c)} ${holds(e, s.px, s.py) ? "đúng" : "sai"}`;
      },
    })),
    { label: "F lớn nhất", value: s => (objective(s)?.max ? `${fmt(objective(s).max.F)} tại ${pt(objective(s).max.x, objective(s).max.y)}` : "–") },
    { label: "F nhỏ nhất", value: s => (objective(s)?.min ? `${fmt(objective(s).min.F)} tại ${pt(objective(s).min.x, objective(s).min.y)}` : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      if (p.x < g.x0 || p.x > g.x0 + g.size || p.y < g.y0 || p.y > g.y0 + g.size) return false;
      this.move(p, s, api, view);
      return true;
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      const [x, y] = toWorld(g, p);
      s.px = clamp(Math.round(x * 10) / 10, -g.R, g.R);
      s.py = clamp(Math.round(y * 10) / 10, -g.R, g.R);
    },
    up(p, s, api, view) {
      const g = geom(s, view);
      const [mx, my] = toScreen(g, s.px, s.py);
      const near = vertices(inequalities(s)).find(v => Math.hypot(...toScreen(g, v.x, v.y).map((c, k) => c - [mx, my][k])) < SNAP);
      if (near) [s.px, s.py] = [near.x, near.y];
      testPoint(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const list = inequalities(s);
    const kind = classify(list);
    const o = objective(s);
    drawGrid(ctx, g);
    list.forEach((e, i) => drawHatch(ctx, g, e, i));

    // the solution region, named when there is room for the word
    const region = regionIn(list, g.R);
    if (kind !== "empty" && region.length >= 3 && area(region) * g.u * g.u > (g.small ? 2500 : 4000)) {
      const [x, y] = region.reduce(([a, b], q) => [a + q[0] / region.length, b + q[1] / region.length], [0, 0]);
      const [lx, ly] = toScreen(g, x, y);
      const [mx, my] = toScreen(g, s.px, s.py);
      const clash = Math.abs(lx - mx) < 50 && Math.abs(ly - my) < 20; // keep clear of the test point
      label(ctx, "Miền nghiệm", lx, ly + (clash ? 20 : 0), { size: g.small ? 11 : 13, bold: true, color: COLORS.green, align: "center" });
    }
    list.forEach((e, i) => drawLine(ctx, g, e, i));

    // vertices: filled when the corner belongs to the region, hollow when it lies on a dashed boundary
    const vs = vertices(list).filter(v => Math.abs(v.x) <= g.R && Math.abs(v.y) <= g.R);
    const mid = vs.reduce(([a, b], v) => [a + v.x / vs.length, b + v.y / vs.length], [0, 0]);
    const ts = g.small ? 10 : 13;
    for (const v of vs) {
      const [x, y] = toScreen(g, v.x, v.y);
      const best = o?.max && v.x === o.max.x && v.y === o.max.y;
      const worst = o?.min && v.x === o.min.x && v.y === o.min.y;
      if (best || worst) {
        ctx.strokeStyle = best ? COLORS.orange : COLORS.muted;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, g.small ? 9 : 11, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = v.inside ? COLORS.ink : "#fff";
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, g.small ? 3.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // label pushed away from the middle of the vertices
      let dx = v.x - mid[0];
      let dy = v.y - mid[1];
      const len = Math.hypot(dx, dy);
      [dx, dy] = len < 1e-9 ? [1, 1] : [dx / len, dy / len];
      const text = o?.max ? `${pt(v.x, v.y)} F = ${fmt(s.p * v.x + s.q * v.y)}` : pt(v.x, v.y);
      ctx.font = `600 ${ts}px ${FONT}`;
      const w = ctx.measureText(text).width;
      const lx = clamp(x + dx * 14 + (dx >= 0 ? 0 : -w), g.x0 + 2, g.x0 + g.size - w - 2);
      const ly = clamp(y - dy * 14, g.y0 + 8, g.y0 + g.size - 8);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(lx - 2, ly - ts * 0.65, w + 4, ts * 1.3);
      label(ctx, text, lx, ly, { size: ts, bold: true, color: best ? COLORS.orange : COLORS.ink });
    }

    // the test point M
    const ok = satisfiesAll(list, s.px, s.py);
    if (Math.abs(s.px) <= g.R && Math.abs(s.py) <= g.R) {
      const [x, y] = toScreen(g, s.px, s.py);
      ctx.fillStyle = ok ? COLORS.green : COLORS.red;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, g.small ? 7 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      label(ctx, "M", x + (x > g.x0 + g.size - 30 ? -14 : 12), y + (y < g.y0 + 24 ? 14 : -12), { size: g.small ? 12 : 14, bold: true, color: ok ? COLORS.green : COLORS.red, align: "center" });
    }

    // the system above the plot
    const head = list.map((e, i) => `${NUM[i]} ${ineqText(e)}`).join(";   ");
    const hs = fit(ctx, head, view.w - 16, g.small ? 13 : 16, true);
    label(ctx, head, view.w / 2, g.y0 - g.head / 2, { size: hs, bold: true, align: "center" });

    // under the plot: F, then the convention
    const lines = [];
    if (s.showObj) {
      const f = objText(s);
      if (kind === "empty") lines.push([`${f}: hệ vô nghiệm`, COLORS.red]);
      else if (o?.strict) lines.push([`${f}: chỉ xét max, min khi mọi bất phương trình dùng ≤ hoặc ≥`, COLORS.muted]);
      else if (!o) lines.push([`${f}: miền nghiệm không bị chặn, không xét max, min tại các đỉnh`, COLORS.muted]);
      else lines.push([`${f}: max = ${fmt(o.max.F)} tại ${pt(o.max.x, o.max.y)}, min = ${fmt(o.min.F)} tại ${pt(o.min.x, o.min.y)}`, COLORS.ink]);
    }
    if (!g.small || !s.showObj) lines.push(["Phần bị gạch không thuộc miền nghiệm; nét đứt: bờ không thuộc miền nghiệm", COLORS.muted]);
    const lh = g.small ? 16 : 22;
    lines.forEach(([t, color], i) => {
      const sz = fit(ctx, t, view.w - 16, g.small ? 11 : 14, i === 0 && s.showObj);
      label(ctx, t, view.w / 2, g.y0 + g.size + (g.small ? 11 : 16) + i * lh, { size: sz, color, bold: i === 0 && s.showObj, align: "center" });
    });
  },
});
