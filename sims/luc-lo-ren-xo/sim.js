import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, theory, launch, stop, props, sanitize, RANGES, E, U } from "./model.js";

// Value with an SI prefix, e.g. si(2.27e-4, "m") → "0,227 mm".
const PREFIX = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-2, "c"], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"], [1e-15, "f"]];
const si = (v, unit, digits = 3) => {
  if (!Number.isFinite(v)) return "∞";
  if (v === 0) return `0 ${unit}`;
  const [k, p] = PREFIX.find(([k, p]) => Math.abs(v) >= k * 0.999 && (p !== "c" || unit === "m")) ?? PREFIX.at(-1);
  return `${fmt(v / k, digits)} ${p}${unit}`;
};

const NAMES = { electron: "Electron", proton: "Proton", alpha: "Hạt α", custom: "Hạt tùy chọn" };

// Where the launch point goes on screen and how many px per metre. Fixed per particle,
// so changing v or B visibly changes the radius.
function layout(s, view) {
  const th = theory(s);
  const small = view.w < 520 || view.h < 420;
  const k = (Math.min(view.w, view.h) * 0.27) / th.refRadius; // px per m
  const rPx = th.radius * k;
  const cx = view.w / 2;
  const cy = view.h / 2 + (small ? 6 : 10);
  // centre the circle when it fits on screen, else start near the left edge
  const fits = th.circles && 2 * rPx < Math.min(view.w, view.h) - (small ? 40 : 70);
  const origin = fits ? { x: cx, y: cy + th.sense * rPx } : { x: view.w * 0.12, y: cy };
  const toScreen = (x, y) => ({ x: origin.x + x * k, y: origin.y - y * k });
  return { th, k, small, origin, toScreen };
}

function fieldMarks(ctx, s, view, small) {
  const gap = small ? 34 : 46;
  ctx.strokeStyle = ctx.fillStyle = "#b9c3d6";
  ctx.lineWidth = 1.2;
  for (let x = gap / 2; x < view.w; x += gap) {
    for (let y = gap / 2; y < view.h; y += gap) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.stroke();
      if (s.fieldDir === "out") {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x - 3.2, y - 3.2);
        ctx.lineTo(x + 3.2, y + 3.2);
        ctx.moveTo(x + 3.2, y - 3.2);
        ctx.lineTo(x - 3.2, y + 3.2);
        ctx.stroke();
      }
    }
  }
}

function scaleBar(ctx, k, view, small) {
  // a "nice" length of about a fifth of the width
  const target = view.w / 5 / k;
  const p = 10 ** Math.floor(Math.log10(target));
  const len = [5, 2, 1].map(n => n * p).find(l => l <= target) ?? p;
  const x = 12;
  const y = view.h - 14;
  ctx.fillStyle = "rgba(247, 249, 253, 0.9)";
  ctx.fillRect(x - 4, y - 18, len * k + 8, 26);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len * k, y);
  ctx.lineTo(x + len * k, y - 5);
  ctx.stroke();
  label(ctx, si(len, "m", 2), x + (len * k) / 2, y - 10, { size: small ? 11 : 12, align: "center" });
}

const onChange = s => stop(s); // a new setting waits for the next launch

mount({
  slug: "luc-lo-ren-xo",
  version: "1.0.0",
  title: "Lực Lo-ren-xơ: hạt mang điện trong từ trường",
  hint: "Chọn hạt, tốc độ và từ trường rồi bấm “Phóng hạt”. Hạt chuyển động tròn đều vì lực Lo-ren-xơ luôn vuông góc với vận tốc.",
  initialState,
  sanitize,
  autoplay: true,
  step(s, dt, api) {
    if (step(s, dt)) {
      const th = theory(s);
      api.emit("revolution", { radius: s.measuredRadius, radiusTheory: th.radius, period: s.measuredPeriod, periodTheory: th.period, frequency: 1 / s.measuredPeriod, speed: Math.hypot(s.vx, s.vy) }, "result");
    }
    // leaving the drawn field region ends the flight (flag set by draw, which knows the view)
    if (s._out && !s.exited) s.exited = true;
  },
  controls: [
    {
      type: "select",
      key: "particle",
      label: "Hạt mang điện",
      onChange,
      options: [
        { value: "electron", label: "Electron (q = −e)" },
        { value: "proton", label: "Proton (q = +e)" },
        { value: "alpha", label: "Hạt α (q = +2e)" },
        { value: "custom", label: "Hạt tùy chọn" },
      ],
    },
    { type: "stepper", key: "charge", label: "Điện tích q (đơn vị e)", min: RANGES.charge[0], max: RANGES.charge[1], step: 1, onChange, visible: s => s.particle === "custom" },
    { type: "slider", key: "mass", label: "Khối lượng m", min: RANGES.mass[0], max: RANGES.mass[1], step: 1, unit: "u", digits: 0, onChange, visible: s => s.particle === "custom" },
    { type: "slider", key: "speed", label: "Tốc độ v", min: RANGES.speed[0], max: RANGES.speed[1], step: 0.1, digits: 1, format: v => `${fmt(v, 1)}·10⁶ m/s`, onChange },
    { type: "slider", key: "field", label: "Cảm ứng từ B", min: RANGES.field[0], max: RANGES.field[1], step: 1, unit: "mT", digits: 0, onChange },
    {
      type: "select",
      key: "fieldDir",
      label: "Chiều của từ trường",
      onChange,
      options: [
        { value: "into", label: "Vào trong màn hình (⊗)" },
        { value: "out", label: "Ra ngoài màn hình (⊙)" },
      ],
    },
    {
      type: "button",
      label: "Phóng hạt",
      primary: true,
      action(s, api) {
        launch(s);
        api.play();
        const th = theory(s);
        api.emit("launch", { charge: th.q / E, mass: th.m / U, speed: th.v, field: th.B, fieldOut: s.fieldDir === "out" ? 1 : 0 }, "action");
      },
    },
  ],
  readouts: [
    { label: "Lực Lo-ren-xơ f = |q|vB", value: s => si(theory(s).force, "N") },
    { label: "Bán kính R = mv/(|q|B)", value: s => (theory(s).circles ? si(theory(s).radius, "m") : "∞ (đường thẳng)") },
    { label: "Chu kỳ T = 2πm/(|q|B)", value: s => (theory(s).circles ? si(theory(s).period, "s") : "–") },
    { label: "Tần số f = 1/T", value: s => (theory(s).circles ? si(theory(s).frequency, "Hz") : "–") },
    { label: "R đo được (sau 1 vòng)", value: s => (s.measuredRadius ? si(s.measuredRadius, "m", 4) : "–") },
    { label: "T đo được (sau 1 vòng)", value: s => (s.measuredPeriod ? si(s.measuredPeriod, "s", 4) : "–") },
    { label: "Tốc độ hiện tại", value: s => `${fmt(Math.hypot(s.vx, s.vy) / 1e6, 4)}·10⁶ m/s` },
    { label: "Thời gian", value: s => si(s.time, "s") },
  ],
  draw(ctx, s, view) {
    const { th, k, small, origin, toScreen } = layout(s, view);
    const size = small ? 11 : 13;
    if (th.B > 0) fieldMarks(ctx, s, view, small);

    // path so far: an arc about the centre of curvature, or a straight segment
    const pos = toScreen(s.x, s.y);
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (th.circles && s.turned !== 0) {
      // centre from the current position and velocity: c = r + (−v_y, v_x)/α
      const c = { x: s.x - s.vy / th.alpha, y: s.y + s.vx / th.alpha };
      const r = Math.hypot(s.x - c.x, s.y - c.y);
      const a0 = Math.atan2(-c.y, -c.x);
      const span = Math.sign(s.turned) * Math.min(Math.abs(s.turned), 2 * Math.PI);
      const n = Math.max(8, Math.ceil(Math.abs(span) * 40));
      for (let i = 0; i <= n; i++) {
        const a = a0 + (span * i) / n;
        const p = toScreen(c.x + r * Math.cos(a), c.y + r * Math.sin(a));
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
    } else {
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(pos.x, pos.y);
    }
    ctx.stroke();

    // launcher
    ctx.fillStyle = COLORS.muted;
    ctx.fillRect(origin.x - 26, origin.y - 6, 20, 12);

    // flight ends when the particle leaves the stage
    s._out = pos.x < -20 || pos.x > view.w + 20 || pos.y < -20 || pos.y > view.h + 20;

    // particle with v and F
    const sp = Math.hypot(s.vx, s.vy) || 1;
    const ux = s.vx / sp;
    const uy = s.vy / sp;
    const vl = small ? 38 : 54;
    arrow(ctx, pos.x, pos.y, pos.x + ux * vl, pos.y - uy * vl, COLORS.green, 2.5);
    label(ctx, "v", pos.x + ux * (vl + 10), pos.y - uy * (vl + 10), { size: size + 1, bold: true, color: COLORS.green, align: "center" });
    if (th.circles) {
      // F = q v × B points to the centre: along (−v_y, v_x)·sign(α)
      const fx = -uy * th.sense;
      const fy = ux * th.sense;
      arrow(ctx, pos.x, pos.y, pos.x + fx * vl, pos.y - fy * vl, COLORS.red, 2.5);
      label(ctx, "f", pos.x + fx * (vl + 10), pos.y - fy * (vl + 10), { size: size + 1, bold: true, color: COLORS.red, align: "center" });
    }
    const { q } = props(s);
    ctx.fillStyle = q > 0 ? COLORS.red : q < 0 ? COLORS.blue : COLORS.muted;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, small ? 7 : 9, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, q > 0 ? "+" : q < 0 ? "−" : "0", pos.x, pos.y + 0.5, { size: small ? 11 : 13, bold: true, color: "#fff", align: "center" });

    // header: what is on screen and the conventions
    const dir = s.fieldDir === "out" ? "⊙ ra ngoài" : "⊗ vào trong";
    const head = th.B > 0 ? `${NAMES[s.particle]}, B = ${fmt(s.field, 0)} mT (${dir} màn hình)` : `${NAMES[s.particle]}, B = 0: không có lực từ`;
    ctx.fillStyle = "rgba(247, 249, 253, 0.9)";
    ctx.fillRect(0, 0, view.w, small ? 34 : 44);
    label(ctx, head, 10, small ? 10 : 14, { size, bold: true });
    const sense = th.sense > 0 ? "quay ngược chiều kim đồng hồ" : th.sense < 0 ? "quay cùng chiều kim đồng hồ" : "đi thẳng đều";
    label(ctx, `${sense}${small ? "" : " · chuyển động được làm chậm, bỏ qua trọng lực"}`, 10, small ? 25 : 32, { size: small ? 10 : 12, color: COLORS.muted });

    if (!s.launched) label(ctx, "Bấm “Phóng hạt” để bắt đầu", view.w / 2, view.h - (small ? 40 : 50), { size, align: "center", bold: true, color: COLORS.blue });
    else if (s.exited) label(ctx, "Hạt đã ra khỏi vùng quan sát", view.w / 2, view.h - (small ? 40 : 50), { size, align: "center", bold: true, color: COLORS.orange });
    else if (s.measuredPeriod && !small) label(ctx, `Đo sau 1 vòng: R = ${si(s.measuredRadius, "m", 4)}, T = ${si(s.measuredPeriod, "s", 4)}`, view.w - 10, view.h - 14, { size: 12, align: "right", color: COLORS.ink });
    scaleBar(ctx, k, view, small);
  },
});
