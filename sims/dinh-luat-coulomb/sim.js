import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, force, interaction, forces, scaleForce } from "./model.js";

const R_MIN = 5; // cm
const R_MAX = 50;
const F_MAX = 360; // N, largest force the controls allow (10 µC, 10 µC, 5 cm)
const F_FLOOR = 0.005; // N, forces near this draw as a very short arrow

const signed = (q, digits = 1) => `${q > 0 ? "+" : q < 0 ? "−" : ""}${fmt(Math.abs(q), digits)}`;
const forceText = f => {
  const { value, unit } = scaleForce(f);
  return `${fmt(value, value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${unit}`;
};
// One result per finished change (slider released or drag ended).
const report = (s, api) =>
  api.emit("force", { force: force(s), q1: s.q1, q2: s.q2, distance: s.distance, sign: Math.sign(s.q1 * s.q2) + 0 }, "result");
const KIND = { attract: "Hút nhau", repel: "Đẩy nhau", none: "Không tương tác" };

// The charges sit symmetrically about the centre; everything is derived from the view size.
function geom(s, view) {
  const small = view.w < 560;
  const maxArrow = Math.min(130, view.w * 0.15);
  const rad = small ? 10 : 24;
  const margin = maxArrow + 2 * rad + (small ? 8 : 16);
  const scale = (view.w - 2 * margin) / R_MAX; // px per cm
  const cx = view.w / 2;
  const cy = Math.round(view.h * 0.52);
  return { small, maxArrow, rad, scale, cx, cy, x1: cx - (s.distance / 2) * scale, x2: cx + (s.distance / 2) * scale };
}

// ponytail: log scale so 9 mN and 360 N are both visible; the exact value is always printed next to it.
const arrowLength = (f, max) => (f > 0 ? (max * Math.log10(1 + f / F_FLOOR)) / Math.log10(1 + F_MAX / F_FLOOR) : 0);

function drawCharge(ctx, x, y, r, q) {
  ctx.fillStyle = q > 0 ? COLORS.red : q < 0 ? COLORS.blue : COLORS.muted;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (q) label(ctx, q > 0 ? "+" : "−", x, y + 1, { color: "#fff", bold: true, size: r * 1.3, align: "center" });
}

mount({
  slug: "dinh-luat-coulomb",
  version: "1.0.0",
  title: "Định luật Cu-lông",
  hint: "Kéo một điện tích để đổi khoảng cách, hoặc dùng các thanh trượt.",
  initialState,
  controls: [
    { type: "slider", key: "q1", label: "Điện tích q₁", min: -10, max: 10, step: 0.5, unit: "µC", digits: 1, onCommit: report },
    { type: "slider", key: "q2", label: "Điện tích q₂", min: -10, max: 10, step: 0.5, unit: "µC", digits: 1, onCommit: report },
    { type: "slider", key: "distance", label: "Khoảng cách r", min: R_MIN, max: R_MAX, step: 0.5, unit: "cm", digits: 1, onCommit: report },
  ],
  readouts: [
    { label: "Lực tương tác F", value: s => forceText(force(s)) },
    { label: "Tương tác", value: s => KIND[interaction(s)] },
    { label: "Hằng số k", value: () => "9·10⁹ N·m²/C²" },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      const reach = g.rad + 18;
      if (Math.abs(p.y - g.cy) > reach || Math.min(Math.abs(p.x - g.x1), Math.abs(p.x - g.x2)) > reach) return false;
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      s.distance = clamp(Math.round(((2 * Math.abs(p.x - g.cx)) / g.scale) * 2) / 2, R_MIN, R_MAX);
    },
    up(p, s, api) {
      api.emit("move", { distance: s.distance, force: force(s) });
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { small, rad, cx, cy, x1, x2 } = g;
    const F = force(s);
    const kind = interaction(s);
    const f = forces(s);
    const size = small ? 12 : 17;
    const kindColor = kind === "attract" ? COLORS.green : kind === "repel" ? COLORS.orange : COLORS.muted;

    // law and result
    const top = small ? 18 : 56;
    label(ctx, `F = k·|q₁·q₂| / r² = ${forceText(F)}`, cx, top, { align: "center", bold: true, size: small ? 15 : 24 });
    if (!small) {
      const part = q => `(${signed(q)}·10⁻⁶)`;
      label(ctx, `= 9·10⁹ · |${part(s.q1)} · ${part(s.q2)}| / ${fmt(s.distance / 100, 3)}²`, cx, top + 34, { align: "center", size: 15, color: COLORS.muted });
    }
    const verdict = { attract: "Hai điện tích trái dấu: hút nhau", repel: "Hai điện tích cùng dấu: đẩy nhau", none: "Có điện tích bằng 0: không có lực tương tác" }[kind];
    label(ctx, verdict, cx, top + (small ? 22 : 68), { align: "center", bold: true, size: small ? 13 : 17, color: kindColor });

    // the line through both charges, a tick every 5 cm
    const half = (R_MAX / 2) * g.scale;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - half - rad, cy);
    ctx.lineTo(cx + half + rad, cy);
    for (let cm = -R_MAX / 2; cm <= R_MAX / 2; cm += 5) {
      ctx.moveTo(cx + cm * g.scale, cy - 5);
      ctx.lineTo(cx + cm * g.scale, cy + 5);
    }
    ctx.stroke();

    drawCharge(ctx, x1, cy, rad, s.q1);
    drawCharge(ctx, x2, cy, rad, s.q2);

    // force vectors start at the rim of each charge; nudged apart if they would cover each other
    const len = arrowLength(F, g.maxArrow);
    const lane = kind === "attract" && 2 * len > x2 - x1 - 2 * rad - 8 ? (small ? 5 : 9) : 0;
    const c1 = COLORS.purple;
    const c2 = COLORS.green;
    const d1 = Math.sign(f.on1);
    const d2 = Math.sign(f.on2);
    arrow(ctx, x1 + d1 * rad, cy - lane, x1 + d1 * (rad + len), cy - lane, c1, small ? 3 : 4);
    arrow(ctx, x2 + d2 * rad, cy + lane, x2 + d2 * (rad + len), cy + lane, c2, small ? 3 : 4);

    // labels hang outwards from each charge so they never meet in the middle
    const up = cy - rad - (small ? 14 : 20);
    const down = cy + rad + (small ? 14 : 20);
    const edge = Math.min(rad, (x2 - x1) / 2 - 6);
    label(ctx, `q₁ = ${signed(s.q1)} µC`, x1 + edge, up, { align: "right", bold: true, size });
    label(ctx, `q₂ = ${signed(s.q2)} µC`, x2 - edge, up, { align: "left", bold: true, size });
    if (F > 0) {
      label(ctx, `F₂₁ = ${forceText(F)}`, x1 + edge, down, { align: "right", bold: true, size, color: c1 });
      label(ctx, `F₁₂ = ${forceText(F)}`, x2 - edge, down, { align: "left", bold: true, size, color: c2 });
    }

    // distance
    const yd = down + (small ? 24 : 36);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, yd - 6);
    ctx.lineTo(x1, yd + 6);
    ctx.moveTo(x2, yd - 6);
    ctx.lineTo(x2, yd + 6);
    ctx.moveTo(x1, yd);
    ctx.lineTo(x2, yd);
    ctx.stroke();
    label(ctx, `r = ${fmt(s.distance, 1)} cm`, cx, yd + (small ? 14 : 18), { align: "center", bold: true, size });

    // notes
    const note = small ? 11 : 13;
    const yn = view.h - (small ? 12 : 24);
    if (!small) {
      label(ctx, "F₂₁: lực do q₂ tác dụng lên q₁.   F₁₂: lực do q₁ tác dụng lên q₂.   Hai lực cùng phương, ngược chiều, cùng độ lớn.", cx, yn - 22, { align: "center", size: note, color: COLORS.muted });
    }
    label(ctx, "Độ dài mũi tên vẽ theo thang lôgarit để dễ quan sát.", cx, yn, { align: "center", size: note, color: COLORS.muted });
  },
});
