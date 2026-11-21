import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, smallAnglePeriod, energy, release } from "./model.js";

const MAX_ANGLE = Math.PI / 2;
const layout = (s, view) => {
  const scale = Math.min((view.h - 150) / 2.1, (view.w - 60) / 4.2);
  const pivot = { x: view.w / 2, y: 56 };
  const bob = {
    x: pivot.x + s.length * scale * Math.sin(s.angle),
    y: pivot.y + s.length * scale * Math.cos(s.angle),
    r: 12 + 7 * Math.sqrt(s.mass),
  };
  return { scale, pivot, bob };
};

const restart = s => {
  s.measuredPeriod = 0;
  s.lastCross = -1;
  s._eMax = 0;
};

mount({
  slug: "con-lac",
  version: "1.0.0",
  title: "Con lắc đơn",
  hint: "Kéo quả nặng sang một bên rồi thả tay.",
  initialState,
  step(s, dt, api) {
    const before = s.lastCross;
    step(s, dt);
    // One result per completed swing, not per frame.
    if (s.lastCross !== before && s.measuredPeriod) {
      api.emit("period-measured", { period: s.measuredPeriod, theory: smallAnglePeriod(s), length: s.length, gravity: s.gravity }, "result");
    }
  },
  controls: [
    { type: "slider", key: "length", label: "Chiều dài dây", min: 0.2, max: 2, step: 0.05, unit: "m", onChange: restart },
    { type: "slider", key: "mass", label: "Khối lượng", min: 0.1, max: 5, step: 0.1, unit: "kg", digits: 1, onChange: restart },
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
    { type: "slider", key: "damping", label: "Lực cản", min: 0, max: 1, step: 0.05, onChange: restart },
    { type: "checkbox", key: "showEnergy", label: "Hiện năng lượng" },
    { type: "checkbox", key: "showVectors", label: "Hiện vectơ vận tốc và trọng lực" },
  ],
  readouts: [
    { label: "Chu kỳ lý thuyết (góc nhỏ)", value: s => `${fmt(smallAnglePeriod(s))} s` },
    { label: "Chu kỳ đo được", value: s => (s.measuredPeriod ? `${fmt(s.measuredPeriod)} s` : "–") },
    { label: "Thời gian", value: s => `${fmt(s.time, 1)} s` },
    { label: "Góc lệch", value: s => `${fmt((s.angle * 180) / Math.PI, 1)}°` },
  ],
  pointer: {
    down(p, s, api, view) {
      const { bob } = layout(s, view);
      if (Math.hypot(p.x - bob.x, p.y - bob.y) > bob.r + 18) return false;
      api.pause();
      return true;
    },
    move(p, s, api, view) {
      const { pivot } = layout(s, view);
      s.angle = clamp(Math.atan2(p.x - pivot.x, p.y - pivot.y), -MAX_ANGLE, MAX_ANGLE);
      s.omega = 0;
    },
    up(p, s, api) {
      release(s, s.angle);
      s._eMax = 0;
      api.play();
      api.emit("release", { angle: s.angle });
    },
  },
  draw(ctx, s, view) {
    const { scale, pivot, bob } = layout(s, view);

    // support
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(pivot.x - 90, pivot.y - 14, 180, 10);

    // protractor
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(pivot.x, pivot.y + 2.05 * scale);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let deg = -90; deg <= 90; deg += 10) {
      const a = (deg * Math.PI) / 180;
      const r1 = 78;
      const r2 = deg % 30 === 0 ? 92 : 86;
      ctx.beginPath();
      ctx.moveTo(pivot.x + r1 * Math.sin(a), pivot.y + r1 * Math.cos(a));
      ctx.lineTo(pivot.x + r2 * Math.sin(a), pivot.y + r2 * Math.cos(a));
      ctx.stroke();
    }
    // angle arc
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 60, Math.PI / 2 - Math.max(s.angle, 0), Math.PI / 2 - Math.min(s.angle, 0));
    ctx.stroke();

    // string and bob
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(bob.x, bob.y);
    ctx.stroke();
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, bob.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 5, 0, Math.PI * 2);
    ctx.fill();

    if (s.showVectors) {
      const v = s.length * s.omega * 22;
      arrow(ctx, bob.x, bob.y, bob.x + v * Math.cos(s.angle), bob.y - v * Math.sin(s.angle), COLORS.green);
      arrow(ctx, bob.x, bob.y, bob.x, bob.y + clamp(s.mass * s.gravity * 4, 14, 150), COLORS.red);
      label(ctx, "v", bob.x + v * Math.cos(s.angle) + 10, bob.y - v * Math.sin(s.angle), { color: COLORS.green, bold: true });
      label(ctx, "P", bob.x + 10, bob.y + clamp(s.mass * s.gravity * 4, 14, 150), { color: COLORS.red, bold: true });
    }

    if (s.showEnergy) {
      const e = energy(s);
      s._eMax = Math.max(s._eMax || 0, e.total, 1e-9);
      const bars = [
        ["Động năng", e.kinetic, COLORS.green],
        ["Thế năng", e.potential, COLORS.blue],
        ["Cơ năng", e.total, COLORS.orange],
      ];
      const x0 = 20;
      const y0 = view.h - 24;
      const maxH = Math.min(150, view.h * 0.3);
      bars.forEach(([name, value, color], i) => {
        const x = x0 + i * 74;
        const h = (value / s._eMax) * maxH;
        ctx.fillStyle = COLORS.grid;
        ctx.fillRect(x, y0 - maxH, 36, maxH);
        ctx.fillStyle = color;
        ctx.fillRect(x, y0 - h, 36, h);
        label(ctx, name, x + 18, y0 + 12, { size: 11, align: "center", color: COLORS.muted });
        label(ctx, `${fmt(value)} J`, x + 18, y0 - maxH - 10, { size: 11, align: "center" });
      });
    }
  },
});
