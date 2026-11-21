import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, moments, isBalanced, G, BEAM_HALF } from "./model.js";

const SIDE_COLOR = { [-1]: COLORS.blue, 1: COLORS.orange };
const D_MIN = 0.1;
const D_MAX = 2;

const layout = (s, view) => {
  // S = pixels per metre. Vertical budget: 0.6·S above the pivot, 1.3·S below, plus the header.
  const S = Math.min((view.w - 40) / (2 * BEAM_HALF + 0.2), (view.h - 126) / 1.9);
  const pivot = { x: view.w / 2, y: 100 + 0.6 * S + Math.max(0, view.h - 126 - 1.9 * S) * 0.5 };
  const weight = side => {
    const m = side < 0 ? s.m1 : s.m2;
    const d = side < 0 ? s.d1 : s.d2;
    const size = Math.max(14, S * (0.12 + 0.07 * Math.sqrt(m)));
    const hx = pivot.x + side * d * S * Math.cos(s.angle);
    const hy = pivot.y + side * d * S * Math.sin(s.angle);
    return { side, m, d, size, hx, hy, top: hy + 0.07 * S };
  };
  return { S, pivot, weights: [weight(-1), weight(1)] };
};

// A paused sim would leave the beam frozen at a stale tilt, so any change resumes it.
const wake = (s, api) => api.play();

mount({
  slug: "don-bay",
  version: "1.0.0",
  title: "Đòn bẩy và mômen lực",
  hint: "Kéo các vật dọc theo thanh hoặc dùng thanh trượt để làm đòn bẩy cân bằng.",
  initialState,
  autoplay: true,
  step(s, dt, api) {
    const was = s.balanced;
    step(s, dt);
    if (s.balanced && !was) {
      api.emit("balance", { m1: s.m1, d1: s.d1, m2: s.m2, d2: s.d2, moment: moments(s).left }, "goal");
    }
  },
  controls: [
    { type: "heading", label: "Vật bên trái" },
    { type: "slider", key: "m1", label: "Khối lượng m₁", min: 0.5, max: 10, step: 0.5, unit: "kg", digits: 1, onChange: wake },
    { type: "slider", key: "d1", label: "Khoảng cách d₁ đến trục quay", min: D_MIN, max: D_MAX, step: 0.05, unit: "m", onChange: wake },
    { type: "heading", label: "Vật bên phải" },
    { type: "slider", key: "m2", label: "Khối lượng m₂", min: 0.5, max: 10, step: 0.5, unit: "kg", digits: 1, onChange: wake },
    { type: "slider", key: "d2", label: "Khoảng cách d₂ đến trục quay", min: D_MIN, max: D_MAX, step: 0.05, unit: "m", onChange: wake },
  ],
  readouts: [
    { label: "Mômen lực bên trái M₁", value: s => `${fmt(moments(s).left)} N·m` },
    { label: "Mômen lực bên phải M₂", value: s => `${fmt(moments(s).right)} N·m` },
    { label: "Tổng mômen M₂ − M₁", value: s => `${fmt(moments(s).net)} N·m` },
    {
      label: "Trạng thái",
      value: s => (isBalanced(s) ? "Cân bằng" : moments(s).net < 0 ? "Nghiêng trái" : "Nghiêng phải"),
    },
  ],
  pointer: {
    down(p, s, api, view) {
      const hit = layout(s, view).weights.find(
        w => Math.hypot(p.x - w.hx, p.y - (w.top + w.size / 2)) < Math.max(w.size, 28)
      );
      if (!hit) return false;
      s._drag = hit.side;
      api.play();
      return true;
    },
    move(p, s, api, view) {
      const { S, pivot } = layout(s, view);
      // snap to the slider step so that exact balance is reachable by dragging
      const d = clamp(Math.round(((p.x - pivot.x) * s._drag) / S / 0.05) * 0.05, D_MIN, D_MAX);
      s[s._drag < 0 ? "d1" : "d2"] = Math.round(d * 100) / 100;
    },
    up(p, s, api) {
      const left = s._drag < 0;
      s._drag = 0;
      api.emit("place", { side: left ? "left" : "right", distance: left ? s.d1 : s.d2 });
    },
  },
  draw(ctx, s, view) {
    const { S, pivot, weights } = layout(s, view);
    const mo = moments(s);
    const ground = pivot.y + 1.22 * S;

    // header: the two moments and the verdict
    label(ctx, `M₁ = ${fmt(mo.left)} N·m`, 16, 22, { color: COLORS.blue, bold: true, size: 15 });
    label(ctx, `P₁·d₁ = ${fmt(s.m1 * G)} N × ${fmt(s.d1)} m`, 16, 42, { color: COLORS.muted, size: 12 });
    label(ctx, `M₂ = ${fmt(mo.right)} N·m`, view.w - 16, 22, { color: COLORS.orange, bold: true, size: 15, align: "right" });
    label(ctx, `P₂·d₂ = ${fmt(s.m2 * G)} N × ${fmt(s.d2)} m`, view.w - 16, 42, { color: COLORS.muted, size: 12, align: "right" });
    const verdict = isBalanced(s)
      ? "Cân bằng: M₁ = M₂"
      : mo.net < 0
        ? "M₁ > M₂: đòn bẩy nghiêng về bên trái"
        : "M₁ < M₂: đòn bẩy nghiêng về bên phải";
    label(ctx, verdict, view.w / 2, 68, { color: isBalanced(s) ? COLORS.green : COLORS.red, bold: true, align: "center" });

    // ground and stand
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, ground);
    ctx.lineTo(view.w - 20, ground);
    ctx.stroke();
    ctx.fillStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(pivot.x + 0.2 * S, ground);
    ctx.lineTo(pivot.x - 0.2 * S, ground);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // distances, measured along the horizontal above the beam
    const yd = pivot.y - 0.42 * S - 18;
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.muted;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pivot.x, yd - 5);
    ctx.lineTo(pivot.x, pivot.y);
    for (const w of weights) {
      ctx.moveTo(w.hx, yd - 5);
      ctx.lineTo(w.hx, w.hy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    weights.forEach((w, i) => {
      const color = SIDE_COLOR[w.side];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pivot.x, yd);
      ctx.lineTo(w.hx, yd);
      ctx.stroke();
      const cx = pivot.x + w.side * Math.max((w.d * S) / 2, 40);
      label(ctx, `d${"₁₂"[i]} = ${fmt(w.d)} m`, cx, yd - 12, { color, size: 12, align: "center", bold: true });
    });

    // beam with a mark every 0,5 m
    const thick = Math.max(6, 0.05 * S);
    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = "#b98a4e";
    ctx.fillRect(-BEAM_HALF * S, -thick, 2 * BEAM_HALF * S, thick);
    ctx.fillStyle = "#fff";
    for (let d = -2; d <= 2; d += 0.5) ctx.fillRect(d * S - 1, -thick, 2, thick);
    ctx.restore();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // hanging weights and their weight vectors
    weights.forEach((w, i) => {
      const color = SIDE_COLOR[w.side];
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w.hx, w.hy);
      ctx.lineTo(w.hx, w.top);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(w.hx - w.size / 2, w.top, w.size, w.size);
      if (w.size >= 40) {
        label(ctx, `${fmt(w.m, 1)} kg`, w.hx, w.top + w.size / 2, { color: "#fff", size: 12, align: "center", bold: true });
      }
      const tip = w.top + w.size + S * (0.1 + 0.025 * w.m);
      arrow(ctx, w.hx, w.top + w.size, w.hx, tip, COLORS.red);
      label(ctx, `P${"₁₂"[i]}`, w.hx + 9, tip - 6, { color: COLORS.red, bold: true, size: 13 });
    });
  },
});
