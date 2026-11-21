import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  initialState, LOADS, STROKE, TARGET, MAX_LIFT, HAND_LIMIT,
  loadMass, weight, pressure, force2, required, lifts, lift, travel, work1, work2, push, letGo, lower,
} from "./model.js";

const OIL = "#f2c46d";
const PUMP_TIME = 0.4; // s for one automatic stroke while playing

// One result when the load first reaches the target height, plus the goal for the car challenge.
function check(s, api) {
  if (s.reached || lift(s) < TARGET - 1e-9) return;
  s.reached = true;
  api.emit("load-lifted", {
    force1: s.force1, force2: force2(s), weight: weight(s), area1: s.area1, area2: s.area2,
    distance1: travel(s), distance2: lift(s), pressure: pressure(s), strokes: s.strokes + (s.h1 > 0 ? 1 : 0),
  }, "result");
  if (s.load === "car" && s.force1 <= HAND_LIMIT) {
    api.emit("car-lifted", { handForce: s.force1, areaRatio: s.area2 / s.area1, mass: loadMass(s) }, "goal");
  }
}

function stroke(s, api, d) {
  if (d <= 0) return;
  api.emit("pump", { stroke: d, lift: lift(s), force1: s.force1 });
  check(s, api);
}

const relift = (s, api) => (lower(s), api.pause());

function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const top = small ? 58 : 92; // formulas
  const bottom = view.h - (small ? 26 : 40);
  const pipeH = small ? 14 : 22;
  const pipeTop = bottom - pipeH;
  const loadH = small ? 44 : 70;
  const ky = Math.min((pipeTop - 52 - loadH - top) / (2 * MAX_LIFT), (pipeTop - 14 - top - 26) / STROKE, 30); // px per cm
  const k = Math.min(view.w * 0.36, 230) / Math.sqrt(1000); // width ∝ diameter ∝ √S
  const w1 = Math.max(10, k * Math.sqrt(s.area1));
  const w2 = Math.max(30, k * Math.sqrt(s.area2));
  const x1 = view.w * (small ? 0.28 : 0.22);
  const x2 = view.w * (small ? 0.64 : 0.6);
  const rest1 = pipeTop - 12 - STROKE * ky; // small piston, not pushed
  const ram = MAX_LIFT * ky + 14; // the large piston is a ram that stays in its cylinder at full lift
  const rest2 = pipeTop - 22 - ram; // top of the large piston, not lifted (= rim of its cylinder)
  return { small, top, bottom, pipeTop, ky, ram, w1, w2, x1, x2, rest1, rest2, y1: rest1 + s.h1 * ky, y2: rest2 - lift(s) * ky, loadH };
}

function drawLoad(ctx, s, cx, base, w, h) {
  ctx.save();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  if (s.load === "crate") {
    const a = Math.min(w, h);
    ctx.fillStyle = "#c58b4c";
    ctx.fillRect(cx - a / 2, base - a, a, a);
    ctx.strokeRect(cx - a / 2, base - a, a, a);
    ctx.beginPath();
    ctx.moveTo(cx - a / 2, base - a);
    ctx.lineTo(cx + a / 2, base);
    ctx.moveTo(cx + a / 2, base - a);
    ctx.lineTo(cx - a / 2, base);
    ctx.stroke();
  } else {
    const car = s.load === "car";
    const L = car ? w : w * 0.8;
    const r = h * (car ? 0.2 : 0.26);
    ctx.fillStyle = car ? COLORS.blue : COLORS.red;
    if (car) {
      ctx.beginPath();
      ctx.moveTo(cx - L / 2, base - r);
      ctx.lineTo(cx - L / 2, base - h * 0.55);
      ctx.lineTo(cx - L * 0.25, base - h * 0.6);
      ctx.lineTo(cx - L * 0.12, base - h);
      ctx.lineTo(cx + L * 0.22, base - h);
      ctx.lineTo(cx + L * 0.36, base - h * 0.6);
      ctx.lineTo(cx + L / 2, base - h * 0.5);
      ctx.lineTo(cx + L / 2, base - r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#cfe0ff";
      ctx.fillRect(cx - L * 0.08, base - h * 0.92, L * 0.26, h * 0.28);
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - L * 0.3, base - r);
      ctx.lineTo(cx - L * 0.1, base - h * 0.62);
      ctx.lineTo(cx + L * 0.25, base - h * 0.62);
      ctx.lineTo(cx + L * 0.3, base - r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + L * 0.25, base - h * 0.62);
      ctx.lineTo(cx + L * 0.32, base - h * 0.95);
      ctx.stroke();
    }
    ctx.fillStyle = COLORS.ink;
    for (const d of car ? [-0.3, 0.3] : [-0.36, 0.36]) {
      ctx.beginPath();
      ctx.arc(cx + d * L, base - r, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

mount({
  slug: "may-nen-thuy-luc",
  version: "1.0.0",
  title: "Máy nén thủy lực và nguyên lí Pa-xcan",
  hint: `Kéo pít-tông nhỏ xuống (hoặc bấm “Ấn một lần”, hay ▶ Chạy để bơm liên tục) để nâng vật lên ${TARGET} cm. Thử thách: nâng ô tô với lực tay không quá ${HAND_LIMIT} N.`,
  initialState,
  step(s, dt, api) {
    if (!lifts(s) || lift(s) >= MAX_LIFT - 1e-9) return api.pause();
    push(s, (STROKE * dt) / PUMP_TIME);
    if (s.h1 >= STROKE - 1e-9 || lift(s) >= MAX_LIFT - 1e-9) letGo(s); // automatic strokes report no action
    check(s, api);
  },
  controls: [
    { type: "button", label: "Ấn pít-tông nhỏ một lần", primary: true, action: (s, api) => (push(s, STROKE), stroke(s, api, letGo(s))), disabled: s => !lifts(s) || lift(s) >= MAX_LIFT - 1e-9 },
    { type: "slider", key: "force1", label: "Lực tay F₁ ấn pít-tông nhỏ", min: 0, max: 1000, step: 5, unit: "N", digits: 0, onCommit: check },
    { type: "slider", key: "area1", label: "Tiết diện pít-tông nhỏ S₁", min: 1, max: 20, step: 1, unit: "cm²", digits: 0, onChange: relift },
    { type: "slider", key: "area2", label: "Tiết diện pít-tông lớn S₂", min: 50, max: 1000, step: 10, unit: "cm²", digits: 0, onChange: relift },
    {
      type: "select",
      key: "load",
      label: "Vật cần nâng",
      onChange: relift,
      options: Object.entries(LOADS).map(([value, l]) => ({ value, label: `${l.name} (${l.mass} kg)` })),
    },
    { type: "button", label: "Hạ vật xuống", action: relift },
  ],
  readouts: [
    { label: "Áp suất p = F₁/S₁", value: s => `${fmt(pressure(s) / 1000, 1)} kPa` },
    { label: "Lực nâng F₂ = p·S₂", value: s => `${fmt(force2(s), 0)} N` },
    { label: "Trọng lượng vật P", value: s => `${fmt(weight(s), 0)} N` },
    { label: "F₁ tối thiểu = P·S₁/S₂", value: s => `${fmt(required(s), 1)} N` },
    { label: "Quãng đường pít-tông nhỏ h₁", value: s => `${fmt(travel(s), 1)} cm` },
    { label: "Độ cao vật được nâng h₂", value: s => `${fmt(lift(s), 2)} cm` },
    { label: "Công A₁ = F₁·h₁ / A₂ = F₂·h₂", value: s => `${fmt(work1(s), 2)} J / ${fmt(work2(s), 2)} J` },
    { label: "Số lần ấn", value: s => String(s.strokes) },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      if (Math.abs(p.x - g.x1) > g.w1 / 2 + 22 || p.y < g.y1 - 50 || p.y > g.y1 + 24) return false;
      api.pause();
      s._grab = p.y - g.y1;
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      const want = clamp((p.y - s._grab - g.rest1) / g.ky, 0, STROKE);
      if (want > s.h1) push(s, want - s.h1);
      check(s, api);
    },
    up(p, s, api) {
      stroke(s, api, letGo(s));
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { small, ky, w1, w2, x1, x2, y1, y2, pipeTop, bottom } = g;
    const size = small ? 11 : 13;
    const ok = lifts(s);

    label(ctx, `p = F₁/S₁ = F₂/S₂ = ${fmt(pressure(s) / 1000, 1)} kPa`, 10, small ? 12 : 20, { size: small ? 12 : 16, bold: true });
    label(ctx, `F₂/F₁ = S₂/S₁ = ${fmt(s.area2 / s.area1, 1)}     S₁h₁ = S₂h₂`, 10, small ? 28 : 44, { size: small ? 11 : 14, color: COLORS.muted });
    label(
      ctx,
      ok ? `F₂ = ${fmt(force2(s), 0)} N ≥ P = ${fmt(weight(s), 0)} N: vật được nâng` : `F₂ = ${fmt(force2(s), 0)} N < P = ${fmt(weight(s), 0)} N: chưa nâng được (cần F₁ ≥ ${fmt(required(s), 0)} N)`,
      10,
      small ? 44 : 68,
      { size, bold: true, color: ok ? COLORS.green : COLORS.red },
    );

    // liquid: two cylinders joined by a pipe; the walls are drawn over it
    const wall = 3;
    const top1 = g.rest1 - 20;
    const top2 = g.rest2 + 2;
    const ramEnd = y2 + g.ram; // bottom face of the large piston
    ctx.fillStyle = OIL;
    ctx.fillRect(x1 - w1 / 2, y1, w1, bottom - y1);
    ctx.fillRect(x2 - w2 / 2, ramEnd, w2, bottom - ramEnd);
    ctx.fillRect(x1, pipeTop, x2 - x1, bottom - pipeTop);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = wall;
    ctx.beginPath();
    ctx.moveTo(x1 - w1 / 2, top1);
    ctx.lineTo(x1 - w1 / 2, bottom);
    ctx.lineTo(x2 + w2 / 2, bottom);
    ctx.lineTo(x2 + w2 / 2, top2);
    ctx.moveTo(x1 + w1 / 2, top1);
    ctx.lineTo(x1 + w1 / 2, pipeTop);
    ctx.lineTo(x2 - w2 / 2, pipeTop);
    ctx.lineTo(x2 - w2 / 2, top2);
    ctx.stroke();
    // one-way valve in the pipe
    const vx = x1 + w1 / 2 + Math.min(30, (x2 - x1) * 0.2);
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(vx - 6, pipeTop + 3);
    ctx.lineTo(vx + 6, (pipeTop + bottom) / 2);
    ctx.lineTo(vx - 6, bottom - 3);
    ctx.closePath();
    ctx.fill();
    if (!small) label(ctx, "van một chiều", vx, bottom + 12, { size: 11, color: COLORS.muted, align: "center" });

    // pressure: equal arrows everywhere in the liquid
    const pa = clamp(8 + pressure(s) / 1e5, 8, 22);
    for (const [px, py] of [[x1, (y1 + bottom) / 2 + 6], [(x1 + x2) / 2, (pipeTop + bottom) / 2], [x2 - w2 / 4, (ramEnd + bottom) / 2]]) {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        arrow(ctx, px, py, px + pa * Math.cos(a), py + pa * Math.sin(a), "rgba(122, 90, 248, 0.8)", 1.5);
      }
    }
    label(ctx, `p = ${fmt(pressure(s) / 1000, 0)} kPa`, (x1 + x2) / 2, pipeTop - 10, { size, align: "center", color: COLORS.purple, bold: true });

    // pistons
    ctx.fillStyle = "#8d98ad";
    ctx.fillRect(x1 - w1 / 2 + wall / 2, y1 - 8, w1 - wall, 8);
    ctx.fillRect(x2 - w2 / 2 + wall / 2, y2, w2 - wall, g.ram);
    ctx.fillStyle = "#6f7a90";
    ctx.fillRect(x2 - w2 / 2 - 6, y2 - 8, w2 + 12, 8); // platform
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x1 - 2, y1 - 34, 4, 26); // rod
    ctx.fillRect(x1 - 14, y1 - 38, 28, 6); // handle
    label(ctx, `S₁ = ${fmt(s.area1, 0)} cm²`, x1 - w1 / 2 - 6, pipeTop - 26, { size, align: "right" });
    label(ctx, `S₂ = ${fmt(s.area2, 0)} cm²`, x2 + w2 / 2 + 6, g.rest2 + 16, { size });

    // forces
    const fLen = f => clamp(14 + Math.sqrt(f) * 1.6, 14, small ? 54 : 80);
    arrow(ctx, x1, y1 - 40 - fLen(s.force1), x1, y1 - 40, COLORS.red, 3);
    label(ctx, `F₁ = ${fmt(s.force1, 0)} N`, x1 + 10, y1 - 46 - fLen(s.force1) / 2, { size, bold: true, color: COLORS.red });
    const loadW = Math.max(w2 * 1.2, small ? 70 : 100);
    // target height and distances moved
    const ty = g.rest2 - TARGET * ky;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x2 - Math.max(w2, loadW) / 2 - 6, ty);
    ctx.lineTo(x2 + Math.max(w2, loadW) / 2 + 6, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, `cần nâng ${TARGET} cm`, x2 + Math.max(w2, loadW) / 2 + 8, ty, { size: small ? 10 : 12, color: COLORS.orange, bold: true });
    drawLoad(ctx, s, x2, y2 - 8, loadW, g.loadH);
    const fy = Math.min(ramEnd + (small ? 26 : 34), bottom - 3);
    const fx = x2 + w2 / 4;
    arrow(ctx, fx, fy, fx, ramEnd + 1, COLORS.green, 3);
    label(ctx, `F₂ = ${fmt(force2(s), 0)} N`, fx + 6, (fy + ramEnd) / 2, { size, bold: true, color: COLORS.green });
    label(ctx, `${LOADS[s.load]?.name ?? ""}: P = ${fmt(weight(s), 0)} N`, x2, y2 - 16 - g.loadH, { size, align: "center" });

    label(ctx, `h₂ = ${fmt(lift(s), 2)} cm`, x2 - w2 / 2 - 10, y2 - 4, { size, bold: true, align: "right" });
    // h₁ of the current stroke, beside the small cylinder
    const mx = x1 - w1 / 2 - 12;
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx - 4, g.rest1);
    ctx.lineTo(mx + 4, g.rest1);
    ctx.moveTo(mx, g.rest1);
    ctx.lineTo(mx, y1);
    ctx.moveTo(mx - 4, y1);
    ctx.lineTo(mx + 4, y1);
    ctx.stroke();
    label(ctx, `h₁ = ${fmt(s.h1, 1)} cm`, mx - 6, (g.rest1 + y1) / 2 + (s.h1 > 0 ? 0 : -10), { size, align: "right" });
    if (s.reached) label(ctx, "Đã nâng tới độ cao cần thiết", view.w - 10, bottom + (small ? 14 : 24), { size, align: "right", bold: true, color: COLORS.green });
    else label(ctx, "Bỏ qua ma sát, khối lượng pít-tông và trọng lượng chất lỏng", view.w - 10, bottom + (small ? 14 : 24), { size: small ? 9 : 11, align: "right", color: COLORS.muted });
  },
});
