import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, release, energy, height, bottomSpeed, K } from "./model.js";

const H_MIN = 0.2;
const H_MAX = 3.5;
const TRACK_X = 4.1; // m, half-width of the drawn track
const BARS_H = 124; // px, strip at the top reserved for the energy bars

const layout = view => {
  const room = view.h - BARS_H - 44;
  const sc = Math.min((view.w - 24) / (2 * TRACK_X + 0.2), room / height(TRACK_X));
  const ox = view.w / 2;
  const oy = view.h - 30 - Math.max(0, room - height(TRACK_X) * sc) / 2;
  return { sc, ox, oy, X: x => ox + x * sc, Y: y => oy - y * sc };
};

const ballAt = (s, view) => {
  const { sc, X, Y } = layout(view);
  const p = 2 * K * s.x;
  const cos = 1 / Math.sqrt(1 + p * p);
  const r = Math.max(5, Math.min(1, sc / 70) * (7 + 4 * Math.sqrt(s.mass)));
  // centre sits one radius off the track along the normal
  return { x: X(s.x) - p * cos * r, y: Y(height(s.x)) - cos * r, r, p, cos, sc };
};

const restart = s => {
  release(s, Math.sign(s.x) || -1);
  s._lastBottom = 0;
};

mount({
  slug: "bao-toan-co-nang",
  version: "1.0.0",
  title: "Bảo toàn cơ năng",
  hint: "Kéo quả cầu lên thành máng rồi thả tay, hoặc chọn độ cao thả và bấm Chạy.",
  initialState,
  step(s, dt, api) {
    const x0 = s.x;
    step(s, dt);
    if (x0 < 0 === s.x < 0) return;
    // Passing the lowest point. Without friction every pass has the same speed, so report it
    // once per release; with friction each pass is slower and is reported.
    const speed = Math.abs(s.v);
    if (Math.abs(speed - (s._lastBottom || 0)) <= 0.01 * speed) return;
    s._lastBottom = speed;
    api.emit("bottom-speed", { speed, theory: bottomSpeed(s), releaseHeight: s.releaseHeight, gravity: s.gravity }, "result");
  },
  controls: [
    { type: "slider", key: "releaseHeight", label: "Độ cao thả h₀", min: H_MIN, max: H_MAX, step: 0.1, unit: "m", digits: 2, onChange: restart },
    { type: "slider", key: "mass", label: "Khối lượng", min: 0.5, max: 5, step: 0.5, unit: "kg", digits: 1, onChange: restart },
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
    { type: "checkbox", key: "friction", label: "Có ma sát", onChange: restart },
    { type: "slider", key: "mu", label: "Hệ số ma sát trượt μ", min: 0.02, max: 0.3, step: 0.01, onChange: restart },
    { type: "checkbox", key: "showVectors", label: "Hiện vectơ vận tốc" },
  ],
  readouts: [
    { label: "Tốc độ v", value: s => `${fmt(Math.abs(s.v))} m/s` },
    { label: "Độ cao h", value: s => `${fmt(height(s.x))} m` },
    { label: "Tốc độ ở đáy √(2gh₀)", value: s => `${fmt(bottomSpeed(s))} m/s` },
    { label: "Thời gian", value: s => `${fmt(s.time, 1)} s` },
  ],
  pointer: {
    down(p, s, api, view) {
      const b = ballAt(s, view);
      if (Math.hypot(p.x - b.x, p.y - b.y) > b.r + 20) return false;
      api.pause();
      return true;
    },
    move(p, s, api, view) {
      const { sc, ox } = layout(view);
      const x = (p.x - ox) / sc;
      s.releaseHeight = clamp(height(x), H_MIN, H_MAX);
      release(s, x < 0 ? -1 : 1);
      s._lastBottom = 0;
    },
    up(p, s, api) {
      api.play();
      api.emit("release", { height: s.releaseHeight });
    },
  },
  draw(ctx, s, view) {
    const { sc, ox, oy, X, Y } = layout(view);
    const e = energy(s);

    // energy bars, all on the scale of the total
    const rows = [
      ["Động năng", e.kinetic, COLORS.green],
      ["Thế năng", e.potential, COLORS.blue],
      ["Cơ năng", e.mechanical, COLORS.orange],
      ["Nhiệt năng", e.thermal, COLORS.red],
      ["Tổng", e.total, COLORS.purple],
    ];
    const bx = 96;
    const bw = Math.max(60, Math.min(view.w - bx - 84, 440));
    rows.forEach(([name, value, color], i) => {
      const y = 12 + i * 21;
      label(ctx, name, 16, y + 7, { size: 12, color: COLORS.muted });
      ctx.fillStyle = COLORS.grid;
      ctx.fillRect(bx, y, bw, 14);
      ctx.fillStyle = color;
      ctx.fillRect(bx, y, bw * clamp(value / Math.max(e.total, 1e-9), 0, 1), 14);
      label(ctx, `${fmt(value, 1)} J`, bx + bw + 8, y + 7, { size: 12, bold: true });
    });

    // track, with the ground under it
    ctx.beginPath();
    for (let x = -TRACK_X; x <= TRACK_X + 1e-9; x += 0.05) ctx.lineTo(X(x), Y(height(x)));
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.lineTo(X(TRACK_X), oy + 8);
    ctx.lineTo(X(-TRACK_X), oy + 8);
    ctx.closePath();
    ctx.fillStyle = COLORS.grid;
    ctx.fill();
    label(ctx, "h = 0 (mốc thế năng)", ox, oy + 19, { size: 11, color: COLORS.muted, align: "center" });

    // release height
    const x0 = Math.sqrt(s.releaseHeight / K);
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(X(-x0), Y(s.releaseHeight));
    ctx.lineTo(X(x0), Y(s.releaseHeight));
    ctx.stroke();
    label(ctx, `h₀ = ${fmt(s.releaseHeight)} m`, ox, Y(s.releaseHeight) - 10, { size: 12, color: COLORS.orange, align: "center", bold: true });

    // faint predicted path: the stretch of track the ball covers, and where it turns back
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = ctx.fillStyle = COLORS.blue;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const x = -x0 + (i / 30) * x0;
      ctx.lineTo(X(x), Y(height(x)));
    }
    ctx.stroke();
    ctx.lineCap = "butt";
    if (!s.friction && s.time === 0) {
      const ghost = ballAt({ ...s, x: -s.x }, view);
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, ghost.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);

    // current height
    const h = height(s.x);
    ctx.strokeStyle = COLORS.muted;
    ctx.beginPath();
    ctx.moveTo(X(s.x), Y(h));
    ctx.lineTo(X(s.x), oy);
    ctx.stroke();
    ctx.setLineDash([]);
    if (h * sc > 18) {
      // label on the outer side of the line (open ground); near the canvas edge flip it inward, low down
      const side = s.x < 0 ? -1 : 1;
      const outer = (side < 0 ? X(s.x) : view.w - X(s.x)) > 84;
      const dir = outer ? side : -side;
      label(ctx, `h = ${fmt(h)} m`, X(s.x) + dir * 6, outer ? Y(h / 2) : oy - 10, { size: 12, color: COLORS.muted, align: dir < 0 ? "right" : "left" });
    }

    // ball and velocity
    const b = ballAt(s, view);
    if (s.showVectors) {
      const len = s.v * sc * 0.09;
      const tx = b.x + len * b.cos;
      const ty = b.y - len * b.cos * b.p;
      arrow(ctx, b.x, b.y, tx, ty, COLORS.green);
      if (Math.abs(len) > 8) label(ctx, "v", tx + 6 * Math.sign(s.v), ty - 10, { color: COLORS.green, bold: true, align: "center" });
    }
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  },
});
