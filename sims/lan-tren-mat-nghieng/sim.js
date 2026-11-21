import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, BODIES, accel, finishTime, distance, energy, ranking } from "./model.js";

const COLOR = { block: COLORS.orange, sphere: COLORS.blue, cylinder: COLORS.green, ring: COLORS.purple };
const RAD = Math.PI / 180;
const WT = "#c3cbdb"; // potential energy bars
const RATIO = { block: "0", sphere: "2/7", cylinder: "1/3", ring: "1/2" }; // Wđ quay / Wđ = k/(1+k)

const restart = (s, api) => {
  s.time = 0;
  s.done = false;
  api.pause();
};

// Everything is placed from the view, so the layout scales with the stage.
function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const wide = view.w > 1.3 * view.h && view.w >= 700;
  const top = small ? 34 : 56;
  const barsH = wide ? 0 : small ? Math.max(104, view.h * 0.32) : 150;
  const area = wide
    ? { x: 0, y: top, w: view.w * 0.6, h: view.h - top - 16 }
    : { x: 0, y: top, w: view.w, h: view.h - top - barsH - 10 };
  const bars = wide
    ? { x: view.w * 0.62, y: top + 10, w: view.w * 0.36, h: Math.min(260, view.h - top - 40) }
    : { x: 10, y: view.h - barsH, w: view.w - 20, h: barsH - 8 };
  const a = s.angle * RAD;
  const r = (small ? 7 : 10) + (small ? 4 : 6) * clamp((s.radius - 0.03) / 0.27, 0, 1); // px, not to scale
  const left = small ? 80 : 112; // names
  const right = small ? 64 : 84; // finish times
  const gap = 2 * (small ? 11 : 16) + 10; // lanes are stacked across the slope, room for the biggest body
  const u = { x: Math.cos(a), y: Math.sin(a) }; // down the slope
  const n = { x: Math.sin(a), y: -Math.cos(a) }; // away from the surface
  const spanX = 3 * gap * n.x;
  const spanY = 3 * gap * -n.y;
  const lenPx = Math.max(40, Math.min((area.w - left - right - spanX) / u.x, (area.h - spanY - 2 * r - 14) / u.y));
  const runW = lenPx * u.x;
  const x0 = area.x + left + Math.max(0, (area.w - left - right - spanX - runW) / 2);
  const y0 = area.y + 2 * r + 12 + spanY + Math.max(0, (area.h - spanY - lenPx * u.y - 2 * r - 14) / 2); // start of the lowest lane
  const lanes = BODIES.map((b, i) => {
    const start = { x: x0 + (3 - i) * gap * n.x, y: y0 + (3 - i) * gap * n.y };
    return { b, start, end: { x: start.x + lenPx * u.x, y: start.y + lenPx * u.y } };
  });
  return { small, a, r, lenPx, u, n, lanes, bars };
}

function drawBody(ctx, id, x, y, r, a, turn) {
  const c = COLOR[id];
  ctx.save();
  ctx.translate(x, y);
  if (id === "block") {
    ctx.rotate(a);
    ctx.fillStyle = c;
    ctx.fillRect(-r * 1.1, -r, r * 2.2, r * 2);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-r * 1.1, -r, r * 2.2, r * 2);
    ctx.restore();
    return;
  }
  ctx.rotate(turn);
  if (id === "ring") {
    ctx.strokeStyle = c;
    ctx.lineWidth = Math.max(3, r * 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(r - ctx.lineWidth / 2, 0, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    if (id === "sphere") {
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, "#cfe0ff");
      g.addColorStop(1, c);
      ctx.fillStyle = g;
    } else ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // a mark across the body makes the turning visible
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, 0);
    ctx.lineTo(r * 0.8, 0);
    if (id === "cylinder") {
      ctx.moveTo(0, -r * 0.8);
      ctx.lineTo(0, r * 0.8);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawBars(ctx, s, g) {
  const { x, y, w, h } = g.bars;
  const size = g.small ? 11 : 13;
  const head = g.small ? 36 : 44;
  const nameW = g.small ? 58 : 76;
  const ratioW = g.small ? 34 : 64;
  const rowH = (h - head) / 4;
  const e0 = energy(s, 0).total; // the same mgh for every body
  label(ctx, `Năng lượng (mốc thế năng ở chân dốc): mgh = ${fmt(e0)} J`, x, y + 7, { size, bold: true });
  // legend
  const items = [["Wđ tịnh tiến", COLORS.ink, 1], ["Wđ quay", COLORS.ink, 0.45], ["Wt", WT, 1]];
  let lx = x;
  for (const [text, color, alpha] of items) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(lx, y + head - 17, 10, 10);
    ctx.globalAlpha = 1;
    label(ctx, text, lx + 14, y + head - 12, { size: size - 1, color: COLORS.muted });
    ctx.font = `${size - 1}px system-ui, sans-serif`;
    lx += ctx.measureText(text).width + 26;
  }
  label(ctx, g.small ? "Wq/Wđ" : "Wđ quay/Wđ", x + w, y + head - 12, { size: size - 1, align: "right", color: COLORS.muted });
  const bw = w - nameW - ratioW - 8;
  BODIES.forEach((b, i) => {
    const e = energy(s, b.k);
    const by = y + head + i * rowH + 2;
    const bh = Math.max(6, rowH - 6);
    label(ctx, b.short, x, by + bh / 2, { size, color: COLOR[b.id], bold: true });
    let bx = x + nameW;
    for (const [value, alpha, color] of [[e.translational, 1, COLOR[b.id]], [e.rotational, 0.45, COLOR[b.id]], [e.potential, 1, WT]]) {
      const len = e0 > 0 ? (value / e0) * bw : 0;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(bx, by, len, bh);
      ctx.globalAlpha = 1;
      bx += len;
    }
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + nameW, by, bw, bh);
    label(ctx, RATIO[b.id], x + w, by + bh / 2, { size, align: "right" });
  });
}

mount({
  slug: "lan-tren-mat-nghieng",
  version: "1.0.0",
  title: "Vật lăn trên mặt phẳng nghiêng",
  hint: "Bấm “Thả cả bốn vật” để cho khối hộp, quả cầu đặc, trụ đặc và trụ rỗng cùng xuất phát. Đổi khối lượng, bán kính để thấy thời gian không đổi.",
  initialState,
  timeScale: s => (s.slow ? 0.25 : 1),
  step(s, dt, api) {
    if (s.done) return api.pause();
    if (s.time === 0) api.emit("release", { angle: s.angle, length: s.length, mass: s.mass, radius: s.radius });
    step(s, dt);
    if (s.done) {
      const t = k => finishTime(s, k);
      api.emit("race-finished", { tBlock: t(0), tSphere: t(0.4), tCylinder: t(0.5), tRing: t(1), angle: s.angle, length: s.length }, "result");
      api.pause();
    }
  },
  controls: [
    { type: "button", label: "Thả cả bốn vật", primary: true, action: (s, api) => (restart(s, api), api.play()) },
    { type: "slider", key: "angle", label: "Góc nghiêng α", min: 5, max: 45, step: 1, unit: "°", digits: 0, onChange: restart },
    { type: "slider", key: "length", label: "Chiều dài dốc", min: 0.5, max: 5, step: 0.1, unit: "m", digits: 1, onChange: restart },
    { type: "slider", key: "mass", label: "Khối lượng mỗi vật", min: 0.1, max: 10, step: 0.1, unit: "kg", digits: 1, onChange: restart },
    { type: "slider", key: "radius", label: "Bán kính vật lăn", min: 0.03, max: 0.3, step: 0.01, unit: "m", onChange: restart },
    { type: "checkbox", key: "slow", label: "Chiếu chậm 4 lần" },
  ],
  readouts: [
    { label: "Thời gian", value: s => `${fmt(s.time, 2)} s` },
    ...BODIES.map(b => ({
      label: `${b.short}: a; t`,
      value: s => `${fmt(accel(s, b.k))} m/s²; ${s.time >= finishTime(s, b.k) ? fmt(finishTime(s, b.k)) + " s" : "–"}`,
    })),
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { small, r, u, n } = g;

    label(ctx, "a = g·sin α / (1 + I/(mR²))", 10, small ? 11 : 18, { size: small ? 12 : 15, bold: true });
    label(ctx, small ? "Lăn không trượt; hộp trượt không ma sát; vật không theo tỉ lệ" : "Vật lăn không trượt (v = ωR); khối hộp trượt không ma sát. Kích thước vật không theo tỉ lệ.", 10, small ? 26 : 40, { size: small ? 10 : 12, color: COLORS.muted });

    // ramps: the lowest one is drawn as a solid wedge with the angle α
    const last = g.lanes[3];
    ctx.fillStyle = "#e6eaf3";
    ctx.beginPath();
    ctx.moveTo(last.start.x, last.start.y);
    ctx.lineTo(last.end.x, last.end.y);
    ctx.lineTo(last.start.x, last.end.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 2;
    for (const lane of g.lanes) {
      ctx.beginPath();
      ctx.moveTo(lane.start.x, lane.start.y);
      ctx.lineTo(lane.end.x, lane.end.y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(last.start.x - 10, last.end.y);
    ctx.lineTo(last.end.x + 20, last.end.y);
    ctx.stroke();
    ctx.strokeStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(last.end.x, last.end.y, small ? 22 : 34, Math.PI, Math.PI + g.a);
    ctx.stroke();
    label(ctx, "α", last.end.x - (small ? 30 : 44), last.end.y - (small ? 6 : 9), { color: COLORS.orange, bold: true, size: small ? 12 : 14 });

    // start and finish lines
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const f0 = g.lanes[0].end;
    ctx.moveTo(f0.x + 3 * r * n.x, f0.y + 3 * r * n.y);
    ctx.lineTo(last.end.x, last.end.y);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, "Đích", f0.x + 3 * r * n.x + 4, f0.y + 3 * r * n.y - 6, { size: 11, color: COLORS.red });

    const order = ranking(s).map(b => b.id);
    for (const lane of g.lanes) {
      const { b, start, end } = lane;
      const d = (distance(s, b.k) / s.length) * g.lenPx;
      const x = start.x + d * u.x + r * n.x;
      const y = start.y + d * u.y + r * n.y;
      drawBody(ctx, b.id, x, y, r, g.a, d / r); // turned by arc length / radius on screen: rolling, no slip
      label(ctx, b.short, start.x - 2 * r - 6, start.y - r, { size: small ? 11 : 13, align: "right", color: COLOR[b.id], bold: true });
      if (s.time >= finishTime(s, b.k)) {
        label(ctx, `${order.indexOf(b.id) + 1}. ${fmt(finishTime(s, b.k))} s`, end.x + 2 * r + 6, end.y, { size: small ? 11 : 13, bold: true, color: COLOR[b.id] });
      }
    }

    drawBars(ctx, s, g);
  },
});
