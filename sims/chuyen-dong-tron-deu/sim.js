import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, kinematics, vectors, laps, step, cut, reattach } from "./model.js";

const R_MAX = 2; // m, top of the radius slider
const FLY = 4; // m travelled along the tangent before the run stops
const TAU = 2 * Math.PI;

// Changing the motion while the object is flying away ties it back on.
const retie = s => {
  if (s.cut) reattach(s);
};

const font = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
/** Left-aligned text with a subscript: base + sub + rest, e.g. a, ht, " = 3,7 m/s²". */
function withSub(ctx, base, sub, rest, x, y, color = COLORS.ink, size = 13, bold = false) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.font = font(size, bold);
  ctx.fillText(base, x, y);
  x += ctx.measureText(base).width;
  ctx.font = font(size * 0.72, bold);
  ctx.fillText(sub, x, y + size * 0.3);
  x += ctx.measureText(sub).width;
  ctx.font = font(size, bold);
  ctx.fillText(rest, x, y);
  ctx.restore();
}

mount({
  slug: "chuyen-dong-tron-deu",
  version: "1.0.0",
  title: "Chuyển động tròn đều",
  hint: "Bấm “Chạy” để vật quay. Đổi bán kính, chu kì, tần số hoặc tốc độ rồi thử cắt dây.",
  initialState,
  step(s, dt, api) {
    const k = kinematics(s);
    if (s.cut && k.speed * s.flight >= FLY) return api.pause(); // flown out of the picture
    const before = laps(s);
    step(s, dt);
    // One result per completed revolution, not per frame.
    if (laps(s) > before) {
      api.emit("revolution", { count: laps(s), period: k.period, speed: k.speed, acceleration: k.accel }, "result");
    }
  },
  controls: [
    { type: "slider", key: "radius", label: "Bán kính r", min: 0.5, max: R_MAX, step: 0.1, unit: "m", digits: 1, onChange: retie },
    {
      type: "select",
      key: "input",
      label: "Đại lượng cho trước",
      onChange: retie,
      options: [
        { value: "period", label: "Chu kì T" },
        { value: "frequency", label: "Tần số f" },
        { value: "speed", label: "Tốc độ v" },
      ],
    },
    { type: "slider", key: "period", label: "Chu kì T", min: 1, max: 10, step: 0.1, unit: "s", digits: 1, onChange: retie, visible: s => s.input === "period" },
    { type: "slider", key: "frequency", label: "Tần số f", min: 0.1, max: 1, step: 0.05, unit: "Hz", onChange: retie, visible: s => s.input === "frequency" },
    { type: "slider", key: "speed", label: "Tốc độ v", min: 0.5, max: 8, step: 0.1, unit: "m/s", digits: 1, onChange: retie, visible: s => s.input === "speed" },
    { type: "slider", key: "mass", label: "Khối lượng m", min: 0.1, max: 5, step: 0.1, unit: "kg", digits: 1 },
    { type: "checkbox", key: "showVectors", label: "Hiện vectơ vận tốc và gia tốc hướng tâm" },
    {
      type: "button",
      label: "Cắt dây",
      primary: true,
      visible: s => !s.cut,
      action(s, api) {
        cut(s);
        api.play();
        api.emit("cut", { angle: s.angle % TAU, speed: kinematics(s).speed }, "action");
      },
    },
    { type: "button", label: "Nối lại dây", visible: s => s.cut, action: reattach },
  ],
  readouts: [
    { label: "Tốc độ góc ω", value: s => (s.cut ? "–" : `${fmt(kinematics(s).omega)} rad/s`) },
    { label: "Tốc độ v = ω·r", value: s => `${fmt(kinematics(s).speed)} m/s` },
    { label: "Chu kì T = 2π/ω", value: s => (s.cut ? "–" : `${fmt(kinematics(s).period)} s`) },
    { label: "Tần số f = 1/T", value: s => (s.cut ? "–" : `${fmt(kinematics(s).frequency, 3)} Hz`) },
    { label: "Gia tốc hướng tâm v²/r", value: s => `${fmt(s.cut ? 0 : kinematics(s).accel)} m/s²` },
    { label: "Lực hướng tâm m·v²/r", value: s => `${fmt(s.cut ? 0 : kinematics(s).force)} N` },
    { label: "Góc quay θ (từ trục Ox)", value: s => `${fmt(s.angle)} rad = ${fmt((s.angle * 180) / Math.PI, 0)}°` },
    { label: "Số vòng đã quay", value: s => String(laps(s)) },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560;
    const half = Math.min(view.w, view.h) / 2;
    const scale = (half - 16) / (R_MAX + 0.45);
    const cx = view.w / 2;
    const cy = view.h / 2;
    const k = kinematics(s);
    const p = vectors(s);
    const R = s.radius * scale;
    const X = x => cx + x * scale;
    const Y = y => cy - y * scale; // y up
    const size = small ? 12 : 14;

    // axes and the orbit
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cx - half + 6, cy);
    ctx.lineTo(cx + half - 6, cy);
    ctx.moveTo(cx, cy - half + 6);
    ctx.lineTo(cx, cy + half - 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#c9d2e3";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    label(ctx, "O", cx - 10, cy + 11, { size: 12, color: COLORS.muted });
    label(ctx, "x", cx + half - 12, cy + 10, { size: 12, color: COLORS.muted });

    // angle from Ox (counter-clockwise, so clockwise on a y-down canvas)
    const theta = s.angle % TAU;
    const ar = Math.min(26, R * 0.45);
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, ar, 0, -theta, true);
    ctx.stroke();
    label(ctx, "θ", cx + (ar + 10) * Math.cos(theta / 2), cy - (ar + 10) * Math.sin(theta / 2), { color: COLORS.orange, bold: true, size, align: "center" });

    // string, or the straight path after the cut
    const px = X(s.radius * Math.cos(s.angle)); // point on the circle (release point once cut)
    const py = Y(s.radius * Math.sin(s.angle));
    ctx.lineWidth = 2;
    if (s.cut) {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = COLORS.muted;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = COLORS.orange;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(X(p.x), Y(p.y));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.orange;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = COLORS.ink;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
      // "r" beside the middle of the string, on the side away from the angle arc
      label(ctx, "r", (cx + px) / 2 - 11 * Math.sin(s.angle), (cy + py) / 2 - 11 * Math.cos(s.angle), { size, bold: true, align: "center" });
    }
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, TAU);
    ctx.fill();

    // the object
    const ox = X(p.x);
    const oy = Y(p.y);
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(ox, oy, 7 + 3 * Math.sqrt(s.mass), 0, TAU);
    ctx.fill();

    if (s.showVectors) {
      // Lengths grow with v and a_ht but saturate, so they stay inside the picture.
      const lMax = 0.44 * half;
      const lv = (lMax * k.speed) / (k.speed + 1.5);
      const tx = -Math.sin(s.angle);
      const ty = -Math.cos(s.angle); // screen direction of the velocity
      arrow(ctx, ox, oy, ox + tx * lv, oy + ty * lv, COLORS.green);
      label(ctx, "v", ox + tx * (lv + 11), oy + ty * (lv + 11), { color: COLORS.green, bold: true, size: size + 1, align: "center" });
      if (!s.cut) {
        const la = Math.min((lMax * k.accel) / (k.accel + 3), R * 0.8);
        const ex = ox - Math.cos(s.angle) * la;
        const ey = oy + Math.sin(s.angle) * la;
        arrow(ctx, ox, oy, ex, ey, COLORS.red);
        withSub(ctx, "a", "ht", "", ex + 9 * Math.sin(s.angle) - 4, ey + 9 * Math.cos(s.angle) + 4, COLORS.red, size + 1, true);
      }
      label(ctx, "Độ dài vectơ không theo tỉ lệ", view.w - 8, view.h - 10, { size: 10, color: COLORS.muted, align: "right" });
    }

    // key numbers in the corners (the circle never reaches them)
    label(ctx, `ω = ${s.cut ? "–" : fmt(k.omega) + " rad/s"}`, 8, 13, { size });
    label(ctx, `v = ${fmt(k.speed)} m/s`, 8, 13 + size + 5, { size, color: COLORS.green });
    if (s.cut) {
      label(ctx, "Dây đã cắt", view.w - 8, 13, { size, bold: true, color: COLORS.orange, align: "right" });
      label(ctx, small ? "→ thẳng đều" : "vật chuyển động thẳng đều", view.w - 8, 13 + size + 5, { size, color: COLORS.orange, align: "right" });
    } else {
      label(ctx, `T = ${fmt(k.period)} s`, view.w - 8, 13, { size, align: "right" });
      label(ctx, `f = ${fmt(k.frequency, 3)} Hz`, view.w - 8, 13 + size + 5, { size, align: "right" });
    }
    const yb = view.h - 13;
    withSub(ctx, "a", "ht", ` = ${fmt(s.cut ? 0 : k.accel)} m/s²`, 8, yb - size - 5, COLORS.red, size);
    withSub(ctx, "F", "ht", ` = ${fmt(s.cut ? 0 : k.force)} N`, 8, yb, COLORS.ink, size);
  },
});
