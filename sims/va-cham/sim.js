import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, CART, collisionTime, endTime, before, after, at, extent } from "./model.js";

const CART_COLOR = [COLORS.blue, COLORS.red];
const GROUPS = [
  ["Xe 1", COLORS.blue],
  ["Xe 2", COLORS.red],
  ["Tổng", COLORS.purple],
];

// Any change to the set-up puts the carts back at their starting points.
const rewind = (s, api) => {
  s.time = 0;
  api.pause();
};
const massOnly = { min: 0.5, max: 5, step: 0.5, unit: "kg", digits: 1, onChange: rewind };
const speedOnly = { min: -4, max: 4, step: 0.5, unit: "m/s", digits: 1, onChange: rewind };

// The kit keeps calling step() for the rest of the frame after pause(); without this guard
// the next call would see a finished run and restart it.
let justEnded = false;

const collided = s => s.time > collisionTime(s);
const afterText = (s, pick, unit) => (collided(s) ? `${fmt(pick(after(s)))} ${unit}` : "–");

const niceStep = (max, parts) => {
  const raw = max / parts;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};

/** Paired bars (before faded, after solid) for cart 1, cart 2 and the total. */
function drawBars(ctx, box, small, title, was, now, hit) {
  const { x, y, w, h } = box;
  const values = [...was, ...(now ?? [])];
  const signed = values.some(v => v < -1e-9);
  const top = y + (small ? 20 : 26);
  const bottom = y + h - (small ? 16 : 20);
  const zero = signed ? (top + bottom) / 2 : bottom;
  const room = (signed ? (bottom - top) / 2 : bottom - top) - (small ? 14 : 16);
  const peak = Math.max(...values.map(Math.abs), 1e-9);
  const slot = w / 3;
  const bw = Math.min(40, slot / 2 - 3);
  const size = small ? 9 : 12;
  label(ctx, title, x + w / 2, y + 8, { size: small ? 11 : 14, bold: true, align: "center" });
  GROUPS.forEach(([name, color], i) => {
    const gx = x + slot * (i + 0.5);
    [was[i], hit ? now[i] : null].forEach((value, j) => {
      const bx = gx + (j ? 1 : -bw - 1);
      if (value == null) {
        // not known yet: the collision has not happened (or never will)
        label(ctx, now ? "?" : "–", bx + bw / 2, zero - 9, { size: size + 1, align: "center", color: COLORS.muted });
        return;
      }
      const len = (value / peak) * room; // signed
      ctx.globalAlpha = j ? 1 : 0.4;
      ctx.fillStyle = color;
      ctx.fillRect(bx, Math.min(zero, zero - len), bw, Math.abs(len));
      ctx.globalAlpha = 1;
      label(ctx, fmt(value, small && Math.abs(value) >= 1 ? 1 : 2), bx + bw / 2, zero - len + (len < 0 ? 8 : -7), { size, align: "center" });
    });
    label(ctx, name, gx, y + h - 7, { size: small ? 10 : 12, align: "center", color, bold: true });
  });
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 2, zero);
  ctx.lineTo(x + w - 2, zero);
  ctx.stroke();
}

mount({
  slug: "va-cham",
  version: "1.0.0",
  title: "Va chạm và bảo toàn động lượng",
  hint: "Hai xe chạy trên đường ray không ma sát, chiều dương hướng sang phải. Đặt khối lượng, vận tốc rồi bấm “Bắt đầu chạy”.",
  initialState,
  step(s, dt, api) {
    if (justEnded) return;
    const end = endTime(s);
    if (s.time >= end) s.time = 0; // “Chạy” on a finished run starts a new one
    if (s.time === 0) {
      api.emit("run-start", { m1: s.m1, v1: s.v1, m2: s.m2, v2: s.v2, restitution: s.restitution }, "action");
    }
    const prev = s.time;
    const tc = collisionTime(s);
    s.time = Math.min(end, s.time + dt);
    if (prev <= tc && s.time > tc) {
      const a = after(s);
      api.emit("collision", { v1After: a.v1, v2After: a.v2, momentum: a.p, energyLost: before(s).k - a.k, restitution: s.restitution }, "result");
    }
    if (s.time >= end) {
      api.pause();
      justEnded = true;
      setTimeout(() => (justEnded = false));
    }
  },
  controls: [
    { type: "heading", label: "Xe 1 (bên trái)" },
    { type: "slider", key: "m1", label: "Khối lượng m₁", ...massOnly },
    { type: "slider", key: "v1", label: "Vận tốc ban đầu v₁", ...speedOnly },
    { type: "heading", label: "Xe 2 (bên phải)" },
    { type: "slider", key: "m2", label: "Khối lượng m₂", ...massOnly },
    { type: "slider", key: "v2", label: "Vận tốc ban đầu v₂", ...speedOnly },
    { type: "heading", label: "Loại va chạm" },
    {
      type: "slider",
      key: "restitution",
      label: "Hệ số hồi phục e",
      min: 0,
      max: 1,
      step: 0.05,
      onChange: rewind,
      format: v => (v === 1 ? "1 (đàn hồi)" : v === 0 ? "0 (va chạm mềm)" : fmt(v)),
    },
    {
      type: "button",
      label: "Bắt đầu chạy",
      primary: true,
      action(s, api) {
        s.time = 0;
        api.play();
      },
    },
  ],
  readouts: [
    { label: "Vận tốc sau va chạm v₁′", value: s => afterText(s, a => a.v1, "m/s") },
    { label: "Vận tốc sau va chạm v₂′", value: s => afterText(s, a => a.v2, "m/s") },
    { label: "Tổng động lượng trước", value: s => `${fmt(before(s).p)} kg·m/s` },
    { label: "Tổng động lượng sau", value: s => afterText(s, a => a.p, "kg·m/s") },
    { label: "Tổng động năng trước", value: s => `${fmt(before(s).k)} J` },
    { label: "Tổng động năng sau", value: s => afterText(s, a => a.k, "J") },
    {
      label: "Động năng mất đi",
      value: s => {
        if (!collided(s)) return "–";
        const lost = before(s).k - after(s).k;
        return `${fmt(lost)} J (${fmt((100 * lost) / before(s).k, 0)} %)`;
      },
    },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560;
    const trackH = small ? 108 : clamp(view.h * 0.3, 150, 210);
    const now = at(s, s.time);
    const tc = collisionTime(s);
    const size = small ? 12 : 14;

    // ----- track, scaled so the whole run fits -----
    const box = extent(s);
    const min = box.min - 0.6;
    const max = box.max + 0.6;
    const scale = (view.w - 24) / (max - min);
    const X = x => 12 + (x - min) * scale;
    const ty = trackH - 26;
    const wheel = small ? 4 : 6;
    const bodyH = small ? 20 : 32;
    const bodyTop = ty - 2 * wheel - bodyH;

    const status = tc === Infinity ? "Hai xe không va chạm" : now.collided ? "Sau va chạm" : "Trước va chạm";
    label(ctx, status, 10, 13, { size, bold: true, color: now.collided ? COLORS.green : COLORS.ink });
    label(ctx, `t = ${fmt(Math.min(s.time, endTime(s)))} s`, view.w - 10, 13, { size, align: "right", color: COLORS.muted });

    arrow(ctx, 6, ty, view.w - 6, ty, COLORS.ink, 2); // the rail doubles as the x axis
    const tick = niceStep(max - min, view.w / 56);
    for (let k = Math.ceil(min / tick); k * tick <= max; k++) {
      const x = X(k * tick);
      if (x > view.w - 46) break; // room for the axis name
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, ty);
      ctx.lineTo(x, ty + 5);
      ctx.stroke();
      label(ctx, fmt(k * tick, 1), x, ty + 14, { size: 10, align: "center", color: COLORS.muted });
    }
    label(ctx, "x (m)", view.w - 8, ty + 14, { size: 10, align: "right", color: COLORS.muted });

    // velocity labels are pushed apart so they stay readable when the carts touch
    const textW = small ? 78 : 96;
    let a2 = Math.min(Math.max(X(now.x2 - CART / 2) + 3, textW + 10), view.w - textW - 4);
    const a1 = Math.min(Math.max(X(now.x1 + CART / 2) - 3, textW + 4), a2 - 6);
    a2 = Math.max(a2, a1 + 6);
    [
      [now.x1, now.v1, s.m1, a1, "right", "₁"],
      [now.x2, now.v2, s.m2, a2, "left", "₂"],
    ].forEach(([x, v, m, anchor, align, sub], i) => {
      const color = CART_COLOR[i];
      const left = X(x - CART / 2);
      const w = CART * scale;
      ctx.fillStyle = color;
      ctx.fillRect(left, bodyTop, w, bodyH);
      ctx.fillStyle = COLORS.ink;
      for (const f of [0.22, 0.78]) {
        ctx.beginPath();
        ctx.arc(left + w * f, ty - wheel, Math.min(wheel, w * 0.2), 0, Math.PI * 2);
        ctx.fill();
      }
      if (w >= 34) label(ctx, `${fmt(m, 1)} kg`, left + w / 2, bodyTop + bodyH / 2, { size: small ? 10 : 12, bold: true, color: "#fff", align: "center" });
      const len = clamp(Math.abs(v) * (small ? 9 : 16), 0, small ? 40 : 70) * Math.sign(v);
      const cx = left + w / 2;
      arrow(ctx, cx - len / 2, bodyTop - 9, cx + len / 2, bodyTop - 9, color, 2.5);
      label(ctx, `v${sub}${now.collided ? "′" : ""} = ${fmt(v)} m/s`, anchor, bodyTop - 25, { size, bold: true, color, align });
    });

    // ----- momentum and kinetic energy, before and after -----
    const b = before(s);
    const a = after(s);
    const ly = trackH + 12;
    const lw = small ? 196 : 250;
    let lx = (view.w - lw) / 2;
    [["trước va chạm", 0.4], ["sau va chạm", 1]].forEach(([text, alpha]) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.muted;
      ctx.fillRect(lx, ly - 5, 10, 10);
      ctx.globalAlpha = 1;
      label(ctx, text, lx + 14, ly, { size: small ? 11 : 13, color: COLORS.muted });
      lx += lw / 2 + 6;
    });
    const top = trackH + 24;
    const cw = (view.w - 24) / 2;
    const ch = view.h - top - 2;
    drawBars(ctx, { x: 8, y: top, w: cw, h: ch }, small, "Động lượng (kg·m/s)", [b.p1, b.p2, b.p], a && [a.p1, a.p2, a.p], now.collided);
    drawBars(ctx, { x: 16 + cw, y: top, w: cw, h: ch }, small, "Động năng (J)", [b.k1, b.k2, b.k], a && [a.k1, a.k2, a.k], now.collided);
  },
});
