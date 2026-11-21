import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, release, period, equilibrium, energy, AMPLITUDE_MAX } from "./model.js";

const L0 = 0.3; // m, natural length of the spring as drawn

const layout = (s, view) => {
  const wide = view.w > 560;
  const top = 30; // ceiling
  const size = (wide ? 40 : 28) + 16 * Math.sqrt(s.mass); // block side, px
  const scale = (view.h - top - size - 14) / (L0 + equilibrium(s) + AMPLITUDE_MAX);
  const pitch = wide ? 84 : 38; // energy bars sit bottom-left, the spring to their right
  const barsW = 16 + 4 * pitch;
  const cx = wide ? Math.max(view.w * 0.56, barsW + 130) : barsW + 44;
  return { wide, top, size, scale, pitch, cx, Y: y => top + (L0 + y) * scale }; // Y = lower end of the spring
};

// Re-hang the mass at its release point whenever a parameter changes.
const restart = s => {
  release(s, s.x0);
  s._eMax = 0;
};

const dashed = (ctx, x1, x2, y, color) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.setLineDash([]);
};

mount({
  slug: "lo-xo",
  version: "1.0.0",
  title: "Con lắc lò xo",
  hint: "Kéo vật nặng lên hoặc xuống rồi thả tay.",
  initialState,
  step(s, dt, api) {
    const had = s.measuredPeriod;
    step(s, dt);
    // One result per release: the first full oscillation that has been timed.
    if (!had && s.measuredPeriod) {
      api.emit("period-measured", { period: s.measuredPeriod, theory: period(s), mass: s.mass, k: s.k }, "result");
    }
  },
  controls: [
    { type: "slider", key: "mass", label: "Khối lượng m", min: 0.1, max: 1, step: 0.05, unit: "kg", onChange: restart },
    { type: "slider", key: "k", label: "Độ cứng lò xo k", min: 10, max: 100, step: 1, unit: "N/m", onChange: restart },
    { type: "slider", key: "damping", label: "Hệ số cản", min: 0, max: 1, step: 0.05, unit: "N·s/m", onChange: restart },
    {
      type: "select",
      key: "gravity",
      label: "Nơi làm thí nghiệm",
      onChange: restart,
      options: [
        { value: 9.81, label: "Trái Đất (g = 9,81 m/s²)" },
        { value: 1.62, label: "Mặt Trăng (g = 1,62 m/s²)" },
        { value: 3.71, label: "Sao Hỏa (g = 3,71 m/s²)" },
        { value: 24.79, label: "Sao Mộc (g = 24,79 m/s²)" },
      ],
    },
    { type: "slider", key: "x0", label: "Li độ lúc thả x₀", min: -AMPLITUDE_MAX, max: AMPLITUDE_MAX, step: 0.01, unit: "m", onChange: restart },
    { type: "checkbox", key: "showEnergy", label: "Hiện năng lượng" },
  ],
  readouts: [
    { label: "Chu kỳ lý thuyết", value: s => `${fmt(period(s))} s` },
    { label: "Chu kỳ đo được", value: s => (s.measuredPeriod ? `${fmt(s.measuredPeriod)} s` : "–") },
    { label: "Độ dãn ở VTCB Δl₀", value: s => `${fmt(equilibrium(s), 3)} m` },
    { label: "Li độ x", value: s => `${fmt(s.y - equilibrium(s), 3)} m` },
    { label: "Thời gian", value: s => `${fmt(s.time, 1)} s` },
  ],
  pointer: {
    down(p, s, api, view) {
      const { cx, size, Y } = layout(s, view);
      const y = Y(s.y);
      if (Math.abs(p.x - cx) > size / 2 + 14 || p.y < y - 14 || p.y > y + size + 14) return false;
      s._grab = p.y - y;
      api.pause();
      return true;
    },
    move(p, s, api, view) {
      const { top, scale } = layout(s, view);
      const y0 = equilibrium(s);
      s.y = clamp((p.y - s._grab - top) / scale - L0, y0 - AMPLITUDE_MAX, y0 + AMPLITUDE_MAX);
      s.x0 = s.y - y0;
      s.v = 0;
    },
    up(p, s, api) {
      restart(s);
      api.play();
      api.emit("release", { displacement: s.x0 });
    },
  },
  draw(ctx, s, view) {
    const { wide, top, size, pitch, cx, Y } = layout(s, view);
    const y0 = equilibrium(s);
    const yEnd = Y(s.y);
    const left = cx - size / 2;
    const lineEnd = Math.min(view.w - 8, cx + 250);

    // reference levels for the lower end of the spring
    dashed(ctx, left - 26, lineEnd, Y(0), COLORS.muted);
    label(ctx, wide ? "Lò xo không biến dạng" : "Không biến dạng", lineEnd, Y(0) - 10, { size: 12, align: "right", color: COLORS.muted });
    dashed(ctx, left - 26, lineEnd, Y(y0), COLORS.green);
    label(ctx, wide ? "Vị trí cân bằng (O)" : "VTCB", lineEnd, Y(y0) + 11, { size: 12, align: "right", color: COLORS.green, bold: true });

    // equilibrium stretch Δl₀ = m·g/k
    const bx = left - 14;
    ctx.strokeStyle = COLORS.purple;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 4, Y(0));
    ctx.lineTo(bx + 4, Y(0));
    ctx.moveTo(bx, Y(0));
    ctx.lineTo(bx, Y(y0));
    ctx.moveTo(bx - 4, Y(y0));
    ctx.lineTo(bx + 4, Y(y0));
    ctx.stroke();
    // in the narrow layout the energy bars are right below this label: keep it above their title
    const barsTop = view.h - 50 - Math.min(150, view.h * 0.28);
    const dlY = (Y(0) + Y(y0)) / 2;
    label(ctx, `Δl₀ = ${fmt(y0, 3)} m`, bx - 8, wide ? dlY : Math.min(dlY, barsTop - 16), { size: 12, align: "right", color: COLORS.purple, bold: true });

    // support, spring, mass
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(cx - 70, top - 10, 140, 10);
    const coils = 14;
    const lead = 8;
    const pitchY = (yEnd - top - 2 * lead) / coils;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top + lead);
    for (let i = 0; i < coils; i++) ctx.lineTo(cx + (i % 2 ? 1 : -1) * (wide ? 18 : 12), top + lead + (i + 0.5) * pitchY);
    ctx.lineTo(cx, yEnd - lead);
    ctx.lineTo(cx, yEnd);
    ctx.stroke();
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.roundRect(left, yEnd, size, size, 5);
    ctx.fill();
    label(ctx, `${fmt(s.mass)} kg`, cx, yEnd + size / 2, { size: 11, align: "center", color: "#fff", bold: true });

    // displacement from equilibrium
    const ax = cx + size / 2 + 14;
    arrow(ctx, ax, Y(y0), ax, yEnd, COLORS.orange);
    label(ctx, `x = ${fmt(s.y - y0, 3)} m`, ax + 9, (Y(y0) + yEnd) / 2, { size: 12, color: COLORS.orange, bold: true });

    if (s.showEnergy) {
      const e = energy(s);
      s._eMax = Math.max(s._eMax || 0, e.total, 1e-9);
      const bars = [
        ["Wđ", "Động năng", "", e.kinetic, COLORS.green],
        ["Wđh", "Thế năng", "đàn hồi", e.elastic, COLORS.blue],
        ["Wt", "Thế năng", "trọng trường", e.gravitational, COLORS.purple],
        ["W", "Cơ năng", "", e.total, COLORS.orange],
      ];
      const y1 = view.h - (wide ? 38 : 24);
      const maxH = Math.min(150, view.h * 0.28);
      const bw = wide ? 36 : 22;
      bars.forEach(([symbol, name, name2, value, color], i) => {
        const x = 16 + i * pitch + (pitch - bw) / 2;
        const h = clamp(value / s._eMax, 0, 1) * maxH;
        ctx.fillStyle = COLORS.grid;
        ctx.fillRect(x, y1 - maxH, bw, maxH);
        ctx.fillStyle = color;
        ctx.fillRect(x, y1 - h, bw, h);
        const mid = x + bw / 2;
        label(ctx, wide ? name : symbol, mid, y1 + 12, { size: 11, align: "center", color: COLORS.muted });
        if (wide && name2) label(ctx, name2, mid, y1 + 25, { size: 11, align: "center", color: COLORS.muted });
        label(ctx, wide ? `${fmt(value)} J` : fmt(value), mid, y1 - maxH - 10, { size: 11, align: "center" });
      });
      if (!wide) label(ctx, "Năng lượng (J)", 16, y1 - maxH - 26, { size: 11, color: COLORS.muted });
    }
  },
});
