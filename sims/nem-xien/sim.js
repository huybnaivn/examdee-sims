import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, ready, launch, ideal, trajectory } from "./model.js";

const M = { l: 50, r: 30, t: 40, b: 48 }; // canvas margins, px
const rad = deg => (deg * Math.PI) / 180;

// Smallest 1-2-5 step (metres) whose ticks are at least 48 px apart.
const tickStep = scale => {
  const p = 10 ** Math.floor(Math.log10(48 / scale));
  return [1, 2, 5, 10].map(m => m * p).find(v => v * scale >= 48);
};

// Same scale on both axes, so the launch angle looks true. Fits the drag-free shot and older shots.
const layout = (s, view) => {
  const id = ideal(s);
  let xmax = Math.max(id.range, 4);
  let ymax = Math.max(id.maxHeight, 2);
  for (const shot of s._shots ?? []) {
    xmax = Math.max(xmax, shot.xmax);
    ymax = Math.max(ymax, shot.ymax);
  }
  const scale = Math.min((view.w - M.l - M.r) / xmax, (view.h - M.t - M.b) / ymax);
  return { scale, X: x => M.l + x * scale, Y: y => view.h - M.b - y * scale };
};

// Keep the finished shot as a faint trace before its parameters change.
const archive = s => {
  if (s.phase !== "landed" || !s._path) return;
  s._shots = [...(s._shots ?? []), { points: s._path, xmax: s.x, ymax: s.maxHeight }].slice(-4);
};
const rearm = (s, api) => {
  archive(s);
  ready(s);
  api.pause();
};
const fire = (s, api) => {
  archive(s);
  launch(s);
  api.emit("launch", { speed: s.speed, angle: s.angle, height: s.height });
};

const polyline = (ctx, points, X, Y) => {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
  ctx.stroke();
};

mount({
  slug: "nem-xien",
  version: "1.0.0",
  title: "Chuyển động ném xiên",
  hint: "Chọn vận tốc, góc ném và độ cao rồi nhấn Ném. Các quỹ đạo cũ được giữ lại để so sánh.",
  initialState,
  step(s, dt, api) {
    if (s.phase !== "flying") {
      if (s._done) return; // landed earlier in this same frame
      fire(s, api); // "Chạy" on a waiting or finished shot throws again
    }
    step(s, dt);
    if (s.phase === "landed") {
      s._done = true;
      api.pause();
      api.emit("land", { range: s.x, maxHeight: s.maxHeight, time: s.time }, "result");
    }
  },
  controls: [
    {
      type: "button",
      label: "Ném",
      primary: true,
      action(s, api) {
        fire(s, api);
        api.play();
      },
    },
    { type: "slider", key: "speed", label: "Vận tốc ban đầu v₀", min: 1, max: 30, step: 0.5, unit: "m/s", digits: 1, onChange: rearm },
    { type: "slider", key: "angle", label: "Góc ném α", min: 0, max: 90, step: 1, unit: "°", onChange: rearm },
    { type: "slider", key: "height", label: "Độ cao ban đầu h", min: 0, max: 20, step: 0.5, unit: "m", digits: 1, onChange: rearm },
    {
      type: "select",
      key: "gravity",
      label: "Nơi làm thí nghiệm",
      onChange: rearm,
      options: [
        { value: 9.81, label: "Trái Đất (g = 9,81 m/s²)" },
        { value: 1.62, label: "Mặt Trăng (g = 1,62 m/s²)" },
        { value: 3.71, label: "Sao Hỏa (g = 3,71 m/s²)" },
        { value: 24.79, label: "Sao Mộc (g = 24,79 m/s²)" },
      ],
    },
    { type: "checkbox", key: "drag", label: "Có lực cản không khí", onChange: rearm },
    { type: "checkbox", key: "showVectors", label: "Hiện vectơ vận tốc" },
  ],
  readouts: [
    { label: "Thời gian bay", value: s => `${fmt(s.time)} s` },
    { label: "Tầm xa", value: s => `${fmt(s.x)} m` },
    { label: "Độ cao cực đại", value: s => `${fmt(s.maxHeight)} m` },
    { label: "Lý thuyết (không lực cản): t", value: s => `${fmt(ideal(s).flightTime)} s` },
    { label: "Lý thuyết: tầm xa L", value: s => `${fmt(ideal(s).range)} m` },
    { label: "Lý thuyết: độ cao cực đại H", value: s => `${fmt(ideal(s).maxHeight)} m` },
  ],
  draw(ctx, s, view) {
    s._done = false;
    const { scale, X, Y } = layout(s, view);
    const path = (s._path = trajectory(s, s.phase === "ready" ? 0 : s.time));
    const ground = Y(0);
    const right = view.w - M.r;

    // grid and axis labels (metres)
    const tick = tickStep(scale);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let y = tick; Y(y) > M.t - 12; y += tick) {
      ctx.beginPath();
      ctx.moveTo(X(0), Y(y));
      ctx.lineTo(right, Y(y));
      ctx.stroke();
      label(ctx, fmt(y), X(0) - 22, Y(y), { size: 11, align: "right", color: COLORS.muted });
    }
    for (let x = 0; X(x) <= right + 1; x += tick) {
      ctx.beginPath();
      ctx.moveTo(X(x), ground);
      ctx.lineTo(X(x), ground + 5);
      ctx.stroke();
      label(ctx, fmt(x), X(x), ground + 15, { size: 11, align: "center", color: COLORS.muted });
    }
    label(ctx, "y (m)", 6, M.t - 24, { size: 11, color: COLORS.muted });
    label(ctx, "x (m)", view.w - 6, ground + 34, { size: 11, align: "right", color: COLORS.muted });

    // ground and launch platform
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(X(0) - 16, Y(s.height), 16, s.height * scale);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, ground, view.w, 2);
    ctx.fillRect(X(0) - 16, Y(s.height), 16, 2);

    // earlier shots, then this one
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#b9c4d8";
    for (const shot of s._shots ?? []) polyline(ctx, shot.points, X, Y);
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.blue;
    polyline(ctx, path, X, Y);

    // launch angle
    const x0 = X(0);
    const y0 = Y(s.height);
    const a = rad(s.angle);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + 50, y0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = COLORS.purple;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x0, y0, 28, -a, 0);
    ctx.stroke();
    label(ctx, "α", x0 + 40 * Math.cos(a / 2), y0 - 40 * Math.sin(a / 2), { color: COLORS.purple, align: "center", bold: true });

    // results of a finished shot
    if (s.phase === "landed") {
      const apex = path.reduce((best, p) => (p[1] > best[1] ? p : best), path[0]);
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(X(apex[0]), Y(apex[1]));
      ctx.lineTo(X(apex[0]), ground);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, `H = ${fmt(s.maxHeight)} m`, X(apex[0]) + 8, (Y(apex[1]) + ground) / 2, { color: COLORS.red, bold: true, size: 13 });
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(x0, ground - 1, s.x * scale, 4);
      label(ctx, `L = ${fmt(s.x)} m`, x0 + (s.x * scale) / 2, ground + 34, { color: COLORS.red, bold: true, size: 13, align: "center" });
    }

    // projectile
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(X(s.x), Y(s.y), 7, 0, Math.PI * 2);
    ctx.fill();

    // velocity and its components: on the projectile in flight, at the launch point otherwise
    if (s.showVectors) {
      const flying = s.phase === "flying";
      const [px, py] = flying ? [X(s.x), Y(s.y)] : [x0, y0];
      const [vx, vy] = flying ? [s.vx, s.vy] : [s.speed * Math.cos(a), s.speed * Math.sin(a)];
      // longest arrow of the whole shot (the impact speed without drag) is `len` px
      const len = Math.min(90, view.h * 0.22);
      const k = len / Math.sqrt(s.speed ** 2 + 2 * s.gravity * s.height);
      const n = flying ? "v" : "v₀";
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(px, py - vy * k, vx * k, vy * k);
      ctx.setLineDash([]);
      arrow(ctx, px, py, px + vx * k, py, COLORS.green);
      arrow(ctx, px, py, px, py - vy * k, COLORS.orange);
      arrow(ctx, px, py, px + vx * k, py - vy * k, COLORS.blue);
      const up = vy >= 0 ? 1 : -1;
      if (Math.abs(vx * k) > 8) label(ctx, `${n}x`, px + vx * k + 6, py - 11 * up, { color: COLORS.green, bold: true, size: 13 });
      if (Math.abs(vy * k) > 8) label(ctx, `${n}y`, px - 6, py - vy * k - 9 * up, { color: COLORS.orange, bold: true, size: 13, align: "right" });
      label(ctx, n, px + vx * k - 4, py - vy * k - 13 * up, { color: COLORS.blue, bold: true, size: 13, align: "center" });
    }
  },
});
