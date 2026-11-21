import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import {
  initialState, ENZYMES, RANGES, T_END, T_DENATURE, enzymeOf, rate, vmax, saturation, denature, restart, step, product, trajectory, activeNow,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MIN_PER_SECOND = 2; // simulated minutes per real second
const C = { enzyme: COLORS.blue, substrate: COLORS.orange, product: COLORS.green, dead: "#a3abba" };

function fitLabel(ctx, text, x, y, maxW, opts) {
  let size = opts.size;
  for (; size > 8; size--) {
    ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  label(ctx, text, x, y, { ...opts, size });
}

// trajectory() integrates the whole run; keep it while nothing it depends on changes.
let memo = { key: "", value: [] };
function predicted(s) {
  const key = [s.enzyme, s.temp, s.pH, s.substrate, s.amount, s.active].join("|");
  if (memo.key !== key) memo = { key, value: trajectory(s) };
  return memo.value;
}

const report = (s, api) => {
  api.emit("rate-measured", { rate: rate(s), fraction: saturation(s), vmax: vmax(s) }, "result");
};
const commit = (s, api) => {
  restart(s);
  report(s, api);
};

/** Axes in `box`; returns the mapping. */
function axes(ctx, box, o) {
  const size = o.small ? 10 : 12;
  const left = box.x + (o.small ? 26 : 40);
  const right = box.x + box.w - 6;
  const top = box.y + (o.small ? 18 : 26);
  const bottom = box.y + box.h - (o.small ? 24 : 32);
  const X = v => left + ((v - o.x[0]) / (o.x[1] - o.x[0])) * (right - left);
  const Y = v => bottom - ((v - o.y[0]) / (o.y[1] - o.y[0])) * (bottom - top);
  fitLabel(ctx, o.title, box.x, box.y + (o.small ? 6 : 9), box.w, { size: o.small ? 11 : 14, bold: true });
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const steps = Math.round((o.y[1] - o.y[0]) / o.yStep);
  for (let i = 0; i <= steps; i++) {
    const v = o.y[0] + o.yStep * i;
    ctx.beginPath();
    ctx.moveTo(left, Y(v));
    ctx.lineTo(right, Y(v));
    ctx.stroke();
    label(ctx, fmt(v, o.yDigits ?? 1), left - 4, Y(v), { size, align: "right", color: COLORS.muted });
  }
  for (const v of o.xTicks) label(ctx, fmt(v, 1), X(v), bottom + size * 0.9, { size, align: "center", color: COLORS.muted });
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();
  fitLabel(ctx, o.xLabel, (left + right) / 2, bottom + size * 2.1, right - left, { size, align: "center", color: COLORS.muted });
  return { X, Y, left, right, top, bottom, size };
}

function line(ctx, pts, X, Y, color, width = 2.5, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
  ctx.stroke();
  ctx.setLineDash([]);
}

const sweep = (lo, hi, f, n = 140) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n).map(x => [x, f(x)]);

// Deterministic pseudo-random numbers for particle positions: the picture never changes the state.
const hash = i => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function enzymeShape(ctx, x, y, r, live, bound) {
  ctx.fillStyle = live ? C.enzyme : C.dead;
  ctx.beginPath();
  if (live) {
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, 0.45, Math.PI * 2 - 0.45);
  } else {
    // denatured: the active site has lost its shape
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const rr = r * (0.7 + 0.35 * hash(k + x));
      k ? ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)) : ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
    }
  }
  ctx.closePath();
  ctx.fill();
  if (bound) {
    ctx.fillStyle = C.substrate;
    ctx.beginPath();
    ctx.arc(x + r * 0.55, y, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBeaker(ctx, s, box, small) {
  const { x, y, w, h } = box;
  const e = enzymeOf(s);
  const size = small ? 11 : 13;
  const bx = x + 8;
  const bw = w - 16;
  const top = y + (small ? 36 : 56);
  const bottom = y + h - (small ? 40 : 62);
  const liquid = top + (bottom - top) * 0.12;
  fitLabel(ctx, e.label, x + w / 2, y + (small ? 10 : 16), w, { size: small ? 12 : 15, bold: true, align: "center" });
  fitLabel(ctx, `${fmt(s.temp, 0)} °C · pH ${fmt(s.pH, 1)} · ${fmt(s.time, 1)} phút`, x + w / 2, y + (small ? 25 : 38), w, { size, align: "center", color: COLORS.muted });

  ctx.fillStyle = "#e4f0fb";
  ctx.fillRect(bx, liquid, bw, bottom - liquid);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx - 4, top);
  ctx.lineTo(bx, top + 4);
  ctx.lineTo(bx, bottom);
  ctx.lineTo(bx + bw, bottom);
  ctx.lineTo(bx + bw, top);
  ctx.stroke();

  // particles: about 2 per mmol/L of substrate or product, 4 per unit of enzyme
  const r = Math.max(4, Math.min(9, bw / 26));
  const field = { x: bx + r + 2, y: liquid + r + 2, w: bw - 2 * r - 4, h: bottom - liquid - 2 * r - 4 };
  const t = s.time * 0.6;
  const at = (i, speed) => [
    field.x + field.w * (0.5 + 0.5 * Math.sin(hash(i) * 6.28 + t * speed * (0.6 + hash(i + 7)))) ,
    field.y + field.h * (0.5 + 0.5 * Math.cos(hash(i + 3) * 6.28 + t * speed * (0.5 + hash(i + 11)))),
  ];
  const nE = Math.round(s.amount * 4);
  const live = Math.round(nE * activeNow(s));
  const nS = Math.round(s.S * 2);
  const nP = Math.round(product(s) * 2);
  const bound = Math.round(live * saturation(s, s.S));
  ctx.fillStyle = C.product;
  for (let i = 0; i < nP; i++) {
    const [px, py] = at(1000 + i, 1.4);
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(px + d * r * 0.35, py, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = C.substrate;
  for (let i = 0; i < Math.max(0, nS - bound); i++) {
    const [px, py] = at(2000 + i, 1.2);
    ctx.beginPath();
    ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < nE; i++) {
    const [px, py] = at(3000 + i, 0.5);
    enzymeShape(ctx, px, py, r, i < live, i < Math.min(bound, nS));
  }

  // legend under the beaker
  const ly = bottom + (small ? 12 : 18);
  const items = [
    ["Enzyme", C.enzyme],
    ["Cơ chất", C.substrate],
    ["Sản phẩm", C.product],
  ];
  if (live < nE) items.push(["Biến tính", C.dead]);
  ctx.font = `${size - 1}px ${FONT}`;
  const widths = items.map(([t]) => ctx.measureText(t).width + 18);
  const perRow = widths.reduce((acc, wd, i) => (acc.sum + wd <= w ? { sum: acc.sum + wd, n: i + 1 } : acc), { sum: 0, n: 0 }).n || 1;
  items.forEach(([text, color], i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const rowW = widths.slice(row * perRow, row * perRow + perRow).reduce((a, b) => a + b, 0);
    const lx = x + (w - rowW) / 2 + widths.slice(row * perRow, row * perRow + col).reduce((a, b) => a + b, 0);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lx + 5, ly + row * (size + 4), 5, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, text, lx + 13, ly + row * (size + 4), { size: size - 1, color: COLORS.muted });
  });
  if (!small) label(ctx, "Hình minh hoạ, không theo tỉ lệ", x + w / 2, bottom + 54, { size: 11, align: "center", color: COLORS.muted });
}

function drawProduct(ctx, s, box, small) {
  const S0 = Math.max(1, s.substrate);
  const yMax = Math.ceil(S0 / 4) * 4;
  const g = axes(ctx, box, {
    small,
    title: small ? "Sản phẩm (mmol/L) theo thời gian" : `Lượng sản phẩm (${enzymeOf(s).product}) theo thời gian`,
    x: [0, T_END],
    y: [0, yMax],
    xTicks: [0, 10, 20, 30],
    xLabel: "Thời gian (phút)",
    yStep: yMax / 4,
    yDigits: 0,
  });
  line(ctx, predicted(s), g.X, g.Y, COLORS.muted, 1.5, [5, 4]);
  line(ctx, predicted(s).filter(([t]) => t <= s.time + 1e-9).concat([[s.time, product(s)]]), g.X, g.Y, C.product, 3);
  line(ctx, [[0, s.substrate], [T_END, s.substrate]], g.X, g.Y, C.substrate, 1, [2, 3]);
  if (!small) label(ctx, "[P] (mmol/L)", g.left + 6, g.top + 2, { size: 11, color: COLORS.muted });
}

function drawRate(ctx, s, box, small) {
  const e = enzymeOf(s);
  const which = ["substrate", "temp", "pH"].includes(s.curve) ? s.curve : "substrate";
  const fresh = { ...s, active: 1 };
  const yStep = s.amount <= 1.6 ? 0.25 : s.amount <= 3 ? 0.5 : 1;
  const yMax = Math.max(4 * yStep, Math.ceil((s.amount * 1.05) / yStep) * yStep);
  const opts = {
    substrate: { title: "Tốc độ phản ứng theo nồng độ cơ chất", x: RANGES.substrate, xTicks: [0, 5, 10, 15, 20], xLabel: "[S] (mmol/L)" },
    temp: { title: "Tốc độ phản ứng theo nhiệt độ", x: RANGES.temp, xTicks: [0, 20, 37, 60], xLabel: "Nhiệt độ (°C)" },
    pH: { title: "Tốc độ phản ứng theo pH", x: RANGES.pH, xTicks: [0, 2, 4, 6, 8, 10, 12, 14], xLabel: "pH" },
  }[which];
  if (small) opts.title = opts.title.replace("Tốc độ phản ứng", "Tốc độ (mmol/L/phút)");
  const g = axes(ctx, box, { small, ...opts, y: [0, yMax], yStep, yDigits: 2 });
  if (!small) label(ctx, "v (mmol/L/phút)", g.left + 6, g.top + 2, { size: 11, color: COLORS.muted });
  ctx.save();
  ctx.beginPath();
  ctx.rect(g.left, g.top - 4, g.right - g.left, g.bottom - g.top + 4);
  ctx.clip();
  let x0 = s.substrate;
  if (which === "substrate") {
    const V = vmax(s);
    line(ctx, [[0, V], [20, V]], g.X, g.Y, COLORS.red, 1, [5, 4]);
    line(ctx, [[0, V / 2], [e.Km, V / 2], [e.Km, 0]], g.X, g.Y, COLORS.purple, 1, [3, 3]);
    line(ctx, sweep(0, 20, S => rate(s, S)), g.X, g.Y, COLORS.ink);
    ctx.restore();
    label(ctx, "Vmax", g.right - 2, g.Y(V) - 8, { size: g.size, align: "right", color: COLORS.red });
    label(ctx, "Km", g.X(e.Km) + 3, g.bottom - 8, { size: g.size, color: COLORS.purple });
  } else if (which === "temp") {
    x0 = s.temp;
    line(ctx, sweep(0, 70, T => rate({ ...fresh, temp: T })), g.X, g.Y, COLORS.muted, 1.5, [5, 4]);
    line(ctx, sweep(0, 70, T => rate({ ...s, temp: T })), g.X, g.Y, COLORS.ink);
    line(ctx, [[T_DENATURE, 0], [T_DENATURE, yMax]], g.X, g.Y, COLORS.red, 1, [2, 3]);
    ctx.restore();
    if (!small) label(ctx, "biến tính", g.X(T_DENATURE) + 4, g.top + 18, { size: 11, color: COLORS.red });
    if (s.active < 1) label(ctx, "nét đứt: enzyme mới", g.right - 2, g.top + (small ? 4 : 18), { size: g.size, align: "right", color: COLORS.muted });
  } else {
    x0 = s.pH;
    for (const [key, other] of Object.entries(ENZYMES)) {
      if (key === s.enzyme) continue;
      line(ctx, sweep(0, 14, pH => rate({ ...s, enzyme: key, pH })), g.X, g.Y, COLORS.grid, 2);
      label(ctx, other.label.split(" ")[0], g.X(other.pH), g.top + 6, { size: g.size - 1, align: "center", color: COLORS.muted });
    }
    line(ctx, sweep(0, 14, pH => rate({ ...s, pH })), g.X, g.Y, COLORS.ink);
    ctx.restore();
  }
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(g.X(x0), g.Y(rate(s)), 5, 0, Math.PI * 2);
  ctx.fill();
}

mount({
  slug: "enzyme",
  version: "1.0.0",
  title: "Hoạt tính của enzyme",
  hint: "Chọn enzyme, chỉnh nhiệt độ, pH, nồng độ cơ chất và lượng enzyme, rồi bấm Chạy để xem sản phẩm tạo thành theo thời gian.",
  initialState,
  step(s, dt, api) {
    step(s, dt * MIN_PER_SECOND);
    if (s.time >= T_END) api.pause();
  },
  controls: [
    {
      type: "select",
      key: "enzyme",
      label: "Enzyme",
      onChange: s => {
        s.active = 1; // a new solution of another enzyme
        restart(s);
      },
      onCommit: report,
      options: Object.entries(ENZYMES).map(([value, e]) => ({ value, label: `${e.label}, pH tối ưu ${fmt(e.pH, 1)}` })),
    },
    {
      type: "slider",
      key: "temp",
      label: "Nhiệt độ",
      min: 0,
      max: 70,
      step: 1,
      unit: "°C",
      digits: 0,
      onChange: restart,
      onCommit(s, api) {
        if (denature(s)) api.emit("denatured", { temperature: s.temp, active: s.active }, "action");
        commit(s, api);
      },
    },
    { type: "slider", key: "pH", label: "pH", min: 0, max: 14, step: 0.1, digits: 1, onChange: restart, onCommit: commit },
    { type: "slider", key: "substrate", label: "Nồng độ cơ chất ban đầu [S]₀", min: 0, max: 20, step: 0.5, unit: "mmol/L", digits: 1, onChange: restart, onCommit: commit },
    { type: "slider", key: "amount", label: "Lượng enzyme", min: 0, max: 5, step: 0.1, unit: "đơn vị", digits: 1, onChange: restart, onCommit: commit },
    {
      type: "button",
      label: "Thay bằng enzyme mới",
      visible: s => s.active < 1,
      action(s) {
        s.active = 1;
        restart(s);
      },
      event: "new-enzyme",
    },
    { type: "heading", label: "Đồ thị tốc độ" },
    {
      type: "select",
      key: "curve",
      label: "Vẽ tốc độ phản ứng theo",
      options: [
        { value: "substrate", label: "Nồng độ cơ chất" },
        { value: "temp", label: "Nhiệt độ" },
        { value: "pH", label: "pH" },
      ],
    },
  ],
  readouts: [
    { label: "Tốc độ ban đầu v₀", value: s => `${fmt(rate(s), 3)} mmol/L/phút` },
    { label: "Vmax hiện tại", value: s => `${fmt(vmax(s), 3)} mmol/L/phút` },
    { label: "v₀ / Vmax", value: s => `${fmt(saturation(s) * 100, 1)} % (Km = ${fmt(enzymeOf(s).Km, 1)} mmol/L)` },
    { label: "Enzyme còn hoạt động", value: s => `${fmt(activeNow(s) * 100, 0)} %` },
    { label: "Sản phẩm đã tạo", value: s => `${fmt(product(s), 2)} mmol/L` },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560;
    const sceneW = Math.round(view.w * (small ? 0.36 : 0.34));
    drawBeaker(ctx, s, { x: 4, y: 4, w: sceneW - 8, h: view.h - 8 }, small);
    const pad = small ? 6 : 24;
    const gx = sceneW + pad;
    const gw = view.w - gx - (small ? 6 : 20);
    const gap = small ? 8 : 24;
    const top = small ? 4 : 16;
    const gh = (view.h - top - gap - (small ? 2 : 12)) / 2;
    drawProduct(ctx, s, { x: gx, y: top, w: gw, h: gh }, small);
    drawRate(ctx, s, { x: gx, y: top + gh + gap, w: gw, h: gh }, small);
  },
});
