import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, launch, elements, circularSpeed, G, KM_S, MM_S2, STAR_RADIUS, ELLIPSE_FACTOR } from "./model.js";

const VIEW_MAX = 6; // AU, widest half-extent the canvas zooms out to

const relaunch = s => {
  launch(s);
  s._trail = [];
};

const preset = factor => (s, api) => {
  s.speed = factor * circularSpeed(s.starMass, s.distance);
  relaunch(s);
  api.play();
};

const orbitName = el =>
  el.peri < STAR_RADIUS
    ? "Rơi vào sao"
    : el.ecc < 0.01
      ? "Tròn"
      : el.bound
        ? `Elip (tâm sai e = ${fmt(el.ecc)})`
        : "Hypebol (thoát khỏi sao)";

mount({
  slug: "hap-dan-quy-dao",
  version: "1.0.0",
  title: "Lực hấp dẫn và quỹ đạo",
  hint: "Chọn sao, khoảng cách và tốc độ ban đầu rồi bấm Chạy. 1 AU là khoảng cách Trái Đất – Mặt Trời.",
  initialState,
  timeScale: () => 0.5, // half a year of orbit per second
  step(s, dt, api) {
    const { orbits, crashed } = s;
    step(s, dt);
    (s._trail ??= []).push(s.x, s.y);
    if (s._trail.length > 8000) s._trail.splice(0, 2000);
    if (orbits === 0 && s.orbits === 1) {
      api.emit("orbit", { period: s.measuredPeriod, eccentricity: elements(s).ecc }, "result");
    }
    if (s.crashed && !crashed) {
      api.pause();
      api.emit("crash", {}, "result");
    }
  },
  controls: [
    { type: "slider", key: "starMass", label: "Khối lượng sao M", min: 0.5, max: 3, step: 0.1, unit: "M☉", digits: 1, onChange: relaunch },
    { type: "slider", key: "distance", label: "Khoảng cách ban đầu r₀", min: 0.5, max: 2, step: 0.05, unit: "AU", onChange: relaunch },
    { type: "slider", key: "speed", label: "Tốc độ ban đầu v₀", min: 0, max: 12, step: 0.05, unit: "AU/năm", onChange: relaunch },
    { type: "button", label: "Quỹ đạo tròn: v₀ = √(GM/r₀)", action: preset(1), event: "preset-circular" },
    { type: "button", label: "Quỹ đạo elip: v₀ = 0,8·√(GM/r₀)", action: preset(ELLIPSE_FACTOR), event: "preset-ellipse" },
    { type: "checkbox", key: "showVectors", label: "Hiện vectơ vận tốc và lực hấp dẫn" },
    { type: "checkbox", key: "showPredicted", label: "Hiện quỹ đạo lý thuyết (nét đứt)" },
  ],
  readouts: [
    { label: "Khoảng cách r", value: s => `${fmt(Math.hypot(s.x, s.y))} AU` },
    { label: "Tốc độ v", value: s => `${fmt(Math.hypot(s.vx, s.vy))} AU/năm ≈ ${fmt(Math.hypot(s.vx, s.vy) * KM_S, 1)} km/s` },
    { label: "Tốc độ quỹ đạo tròn tại r₀", value: s => `${fmt(circularSpeed(s.starMass, s.distance))} AU/năm` },
    { label: "Gia tốc hấp dẫn GM/r²", value: s => `${fmt(((G * s.starMass) / (s.x * s.x + s.y * s.y)) * MM_S2)} mm/s²` },
    { label: "Chu kỳ theo Kepler III", value: s => (elements(s).bound ? `${fmt(elements(s).period)} năm` : "–") },
    { label: "Chu kỳ đo được", value: s => (s.measuredPeriod ? `${fmt(s.measuredPeriod)} năm` : "–") },
    { label: "Thời gian", value: s => `${fmt(s.time)} năm` },
  ],
  draw(ctx, s, view) {
    const el = elements(s);
    // Zoom to the whole ellipse when it is closed and not too large; otherwise keep the star centred.
    const fit = el.bound && el.apo <= VIEW_MAX;
    const half = fit ? Math.max(el.a, 0.3) * 1.2 : Math.min(VIEW_MAX, 4 * s.distance);
    const cx = fit ? -el.a * el.ecc * Math.cos(el.omega) : 0;
    const cy = fit ? -el.a * el.ecc * Math.sin(el.omega) : 0;
    const sc = (Math.min(view.w, view.h) / 2 - 30) / half;
    const X = x => view.w / 2 + (x - cx) * sc;
    const Y = y => view.h / 2 - (y - cy) * sc;
    const ui = clamp(Math.min(view.w, view.h) / 600, 0.5, 1); // shrink arrows on small canvases

    // predicted conic, r = p / (1 + e·cos(θ − ω))
    if (s.showPredicted && el.p > 1e-6) {
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 360; i++) {
        const th = (i * Math.PI) / 180;
        const denom = 1 + el.ecc * Math.cos(th - el.omega);
        const r = denom > 0.02 ? el.p / denom : Infinity;
        if (r > 4 * VIEW_MAX) {
          pen = false;
          continue;
        }
        ctx[pen ? "lineTo" : "moveTo"](X(r * Math.cos(th)), Y(r * Math.sin(th)));
        pen = true;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // trace of where the planet has been
    const trail = s._trail ?? [];
    if (trail.length > 2) {
      ctx.strokeStyle = COLORS.blue;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i += 2) ctx.lineTo(X(trail[i]), Y(trail[i + 1]));
      ctx.stroke();
    }

    // radius line, then the star on top of it
    const sx = X(0);
    const sy = Y(0);
    const px = X(s.x);
    const py = Y(s.y);
    if (!s.crashed) {
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    ctx.fillStyle = COLORS.yellow;
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(8, STAR_RADIUS * sc), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // planet and vectors
    if (!s.crashed) {
      if (s.showVectors) {
        const f = clamp(((G * s.starMass) / (el.r * el.r)) * 1.4, 14, 150) * ui;
        const fx = px - (s.x / el.r) * f;
        const fy = py + (s.y / el.r) * f;
        arrow(ctx, px, py, fx, fy, COLORS.red);
        label(ctx, "F", fx - (s.y / el.r) * 12, fy - (s.x / el.r) * 12, { color: COLORS.red, bold: true, align: "center" });
        const v = Math.min(el.speed * 9, 160) * ui;
        const vxs = px + (s.vx / el.speed || 0) * v;
        const vys = py - (s.vy / el.speed || 0) * v;
        arrow(ctx, px, py, vxs, vys, COLORS.green);
        if (v > 8) label(ctx, "v", vxs + (s.vx / el.speed) * 13, vys - (s.vy / el.speed) * 13, { color: COLORS.green, bold: true, align: "center" });
      }
      ctx.fillStyle = COLORS.blue;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // captions
    label(ctx, s.crashed ? "Hành tinh đã rơi vào sao" : `Quỹ đạo: ${orbitName(el)}`, 16, 22, { bold: true, color: s.crashed ? COLORS.red : COLORS.ink });
    const unit = [2, 1, 0.5, 0.2, 0.1].find(u => u * sc <= 140) ?? 0.1;
    const by = view.h - 18;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, by - 4);
    ctx.lineTo(16, by);
    ctx.lineTo(16 + unit * sc, by);
    ctx.lineTo(16 + unit * sc, by - 4);
    ctx.stroke();
    label(ctx, `${fmt(unit)} AU`, 16 + (unit * sc) / 2, by - 12, { size: 12, align: "center", color: COLORS.muted });
  },
});
