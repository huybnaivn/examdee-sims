import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, energy, radius, transition, HC, N_MAX, VISIBLE } from "./model.js";

const DURATION = 2.2; // s, one transition animation
const S_MIN = 90; // nm, ends of the (logarithmic) spectrum strip
const S_MAX = 8000;
const REGION = { uv: "tử ngoại", visible: "nhìn thấy", ir: "hồng ngoại" };

/** Approximate colour of a spectral line; outside the visible range a conventional colour. */
function lineColor(nm) {
  if (nm < VISIBLE[0]) return "rgb(130, 90, 220)"; // ultraviolet: drawn violet by convention
  if (nm > VISIBLE[1]) return "rgb(150, 30, 30)"; // infrared: drawn dark red by convention
  let [r, g, b] = [0, 0, 0];
  if (nm < 440) [r, b] = [(440 - nm) / 60, 1];
  else if (nm < 490) [g, b] = [(nm - 440) / 50, 1];
  else if (nm < 510) [g, b] = [1, (510 - nm) / 20];
  else if (nm < 580) [r, g] = [(nm - 510) / 70, 1];
  else if (nm < 645) [r, g] = [1, (645 - nm) / 65];
  else r = 1;
  const edge = nm < 420 ? 0.5 + (0.5 * (nm - 380)) / 40 : nm > 700 ? 0.5 + (0.5 * (760 - nm)) / 60 : 1;
  return `rgb(${[r, g, b].map(c => Math.round(235 * c * edge)).join(", ")})`;
}

const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const here = s => (s._t >= 1 ? s.to : s.from); // level the electron is on now

function start(s, api) {
  s._t = 0;
  api.play();
}

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const top = small ? 44 : 70;
  const strip = { x: 16, w: view.w - 32, h: small ? 14 : 20 };
  strip.y = view.h - (small ? 34 : 46) - strip.h;
  const orbits = view.w >= 560 && view.h >= 300; // second picture only when there is room
  const dx0 = small ? 58 : 70;
  const dx1 = orbits ? view.w * 0.56 : view.w - (small ? 64 : 80);
  const y0 = top + 22; // n = 6
  const y1 = strip.y - (small ? 26 : 54); // n = 1
  // Levels by log n, not by energy: the upper levels crowd towards E = 0 but stay clickable.
  const y = n => y1 - ((y1 - y0) * Math.log(n)) / Math.log(N_MAX);
  return { small, top, strip, orbits, dx0, dx1, y0, y1, y, xm: (dx0 + dx1) / 2 + (small ? 10 : 30) };
}

// Wavy photon: from (x, y) going right (dir = 1) or left (−1), length len, period by wavelength.
function photon(ctx, x, y, len, dir, nm, color) {
  const period = Math.max(5, Math.min(26, 4 + 7 * Math.log10(nm / 60)));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let d = 0; d <= len; d += 1) {
    const yy = y + 6 * Math.sin((2 * Math.PI * d) / period);
    d === 0 ? ctx.moveTo(x + dir * d, yy) : ctx.lineTo(x + dir * d, yy);
  }
  ctx.stroke();
  ctx.restore();
  arrow(ctx, x + dir * (len - 2), y, x + dir * (len + 10), y, color, 2.5);
}

function drawSpectrum(ctx, g, tr) {
  const { x, y, w, h } = g.strip;
  const X = nm => x + (w * Math.log(nm / S_MIN)) / Math.log(S_MAX / S_MIN);
  ctx.fillStyle = "#c9cfdb";
  ctx.fillRect(x, y, w, h);
  const grad = ctx.createLinearGradient(X(VISIBLE[0]), 0, X(VISIBLE[1]), 0);
  for (let nm = 380; nm <= 760; nm += 20) grad.addColorStop((Math.log(nm / 380) / Math.log(2)), lineColor(nm));
  ctx.fillStyle = grad;
  ctx.fillRect(X(VISIBLE[0]), y, X(VISIBLE[1]) - X(VISIBLE[0]), h);
  // every line the six levels can give, faint
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1;
  for (let m = 2; m <= N_MAX; m++)
    for (let n = 1; n < m; n++) {
      const xx = X(HC / (energy(m) - energy(n)));
      ctx.beginPath();
      ctx.moveTo(xx, y);
      ctx.lineTo(xx, y + h);
      ctx.stroke();
    }
  ctx.strokeStyle = COLORS.ink;
  ctx.strokeRect(x, y, w, h);
  const size = g.small ? 10 : 12;
  label(ctx, "Tử ngoại", x + 2, y + h + 9, { size, color: COLORS.muted });
  label(ctx, "Nhìn thấy", (X(VISIBLE[0]) + X(VISIBLE[1])) / 2, y + h + 9, { size, color: COLORS.muted, align: "center" });
  label(ctx, "Hồng ngoại", x + w - 2, y + h + 9, { size, color: COLORS.muted, align: "right" });
  label(ctx, g.small ? "λ theo thang lôga" : "Bước sóng λ theo thang lôga (90 nm – 8000 nm)", x + w / 2, y + h + (g.small ? 21 : 26), { size, color: COLORS.muted, align: "center" });
  if (!tr.wavelength) return;
  const xx = X(tr.wavelength);
  // emission: a bright coloured line; absorption: a dark line where light is missing
  ctx.fillStyle = tr.direction > 0 ? lineColor(tr.wavelength) : "#111";
  ctx.fillRect(xx - 2, y - 4, 4, h + 8);
  ctx.strokeStyle = tr.direction > 0 ? COLORS.ink : "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(xx - 2, y - 4, 4, h + 8);
  const text = `${fmt(tr.wavelength, 0)} nm · ${tr.direction > 0 ? "vạch phát xạ" : "vạch hấp thụ (tối)"}`;
  label(ctx, text, Math.min(Math.max(xx, x + 70), x + w - 70), y - 12, { size: size + 1, bold: true, align: "center" });
}

function drawOrbits(ctx, g, s, view, ey) {
  const cx = (g.dx1 + view.w) / 2 + 10;
  const cy = (g.y0 + g.y1) / 2;
  const step = Math.min((view.w - g.dx1 - 40) / 2, (g.y1 - g.y0 + 20) / 2) / N_MAX;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  for (let n = 1; n <= N_MAX; n++) {
    ctx.beginPath();
    ctx.arc(cx, cy, step * n, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  // the electron on the orbit matching its level; radius follows the same easing as the diagram
  const a = -Math.PI / 4;
  const rho = step * ey;
  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.arc(cx + rho * Math.cos(a), cy + rho * Math.sin(a), 6, 0, Math.PI * 2);
  ctx.fill();
  for (const n of [1, N_MAX]) label(ctx, `n = ${n}`, cx, cy + step * n + 10, { size: 11, color: COLORS.muted, align: "center" });
  label(ctx, "Quỹ đạo dừng (không theo tỉ lệ:", cx, g.top - 4, { size: 12, color: COLORS.muted, align: "center" });
  label(ctx, "thực tế rₙ = n²r₀)", cx, g.top + 12, { size: 12, color: COLORS.muted, align: "center" });
}

mount({
  slug: "mau-nguyen-tu-bo",
  version: "1.0.0",
  title: "Mẫu nguyên tử Bo và quang phổ hiđrô",
  hint: "Bấm vào một mức năng lượng để electron chuyển tới mức đó, hoặc chọn mức đầu và mức cuối bằng nút − +. Nút Chạy phát lại lần chuyển mức.",
  initialState,
  step(s, dt, api) {
    if (s.from === s.to) return api.pause();
    if (!(s._t < 1)) s._t = 0; // Chạy from rest or after the end: replay
    s._t = Math.min(1, s._t + dt / DURATION);
    if (s._t >= 1) {
      const tr = transition(s.from, s.to);
      api.emit("transition", { from: tr.from, to: tr.to, energy: tr.energy, wavelength: tr.wavelength, emission: tr.direction > 0 ? 1 : 0 }, "result");
      api.pause();
    }
  },
  controls: [
    { type: "stepper", key: "from", label: "Mức đầu n", min: 1, max: N_MAX, onCommit: start },
    { type: "stepper", key: "to", label: "Mức cuối m", min: 1, max: N_MAX, onCommit: start },
  ],
  readouts: [
    { label: "Năng lượng mức đầu Eₙ = −13,6/n²", value: s => `${fmt(energy(s.from), 3)} eV` },
    { label: "Năng lượng mức cuối", value: s => `${fmt(energy(s.to), 3)} eV` },
    { label: "Năng lượng photon ε = |Eₙ − Eₘ|", value: s => `${fmt(transition(s.from, s.to).energy, 3)} eV` },
    { label: "Bước sóng λ = hc/ε", value: s => (s.from === s.to ? "–" : `${fmt(transition(s.from, s.to).wavelength, 1)} nm`) },
    { label: "Dãy", value: s => (s.from === s.to ? "–" : (transition(s.from, s.to).series ?? "ngoài ba dãy Lai-man, Ban-me, Pa-sen")) },
    { label: "Bán kính quỹ đạo rₙ = n²r₀", value: s => `${fmt(radius(s.from) * 1e11, 1)}·10⁻¹¹ m → ${fmt(radius(s.to) * 1e11, 1)}·10⁻¹¹ m` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      if (p.x < g.dx0 - 50 || p.x > g.dx1 + 60) return false;
      let best = 0;
      for (let n = 1; n <= N_MAX; n++) if (Math.abs(p.y - g.y(n)) < 12 && (!best || Math.abs(p.y - g.y(n)) < Math.abs(p.y - g.y(best)))) best = n;
      const now = here(s);
      if (!best || best === now) return false;
      s.from = now;
      s.to = best;
      api.emit("pick-level", { from: now, to: best });
      start(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const tr = transition(s.from, s.to);
    const size = g.small ? 12 : 14;
    const moving = s._t != null;
    const u = s._t ?? 0;
    const emit = tr.direction > 0;
    // electron progress 0 → 1 between the two levels
    const k = !moving ? 0 : emit ? ease(u / 0.4) : ease((u - 0.6) / 0.4);
    const ey = tr.from + (tr.to - tr.from) * k; // fractional level, for the orbit picture
    const yE = g.y(tr.from) + (g.y(tr.to) - g.y(tr.from)) * k;

    // headline
    if (tr.wavelength) {
      const kind = emit ? "Phát xạ" : "Hấp thụ";
      const ser = tr.series ? `dãy ${tr.series}` : "ngoài 3 dãy chính";
      const l1 = `n = ${tr.from} → n = ${tr.to}: ${kind} photon`;
      const l2 = `ε = ${fmt(tr.energy, 2)} eV · λ = ${fmt(tr.wavelength, 0)} nm · ${ser} (${REGION[tr.region]})`;
      if (g.small) {
        label(ctx, l1, view.w / 2, 12, { size: 13, bold: true, align: "center" });
        label(ctx, l2, view.w / 2, 30, { size: 12, align: "center" });
      } else {
        label(ctx, l1, view.w / 2, 22, { size: 17, bold: true, align: "center" });
        label(ctx, l2, view.w / 2, 46, { size: 15, align: "center" });
      }
    } else {
      label(ctx, "Chọn hai mức khác nhau", view.w / 2, g.small ? 20 : 30, { size: g.small ? 13 : 16, bold: true, align: "center", color: COLORS.muted });
    }

    // energy levels
    const eY = g.y0 - (g.small ? 16 : 22);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.dx0, eY);
    ctx.lineTo(g.dx1, eY);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, "n = ∞", g.dx0 - 6, eY, { size: size - 1, align: "right", color: COLORS.muted });
    label(ctx, "0 eV", g.dx1 + 6, eY, { size: size - 1, color: COLORS.muted });
    const cur = here(s);
    for (let n = 1; n <= N_MAX; n++) {
      const yy = g.y(n);
      const on = n === tr.from || n === tr.to;
      ctx.strokeStyle = on ? COLORS.ink : COLORS.muted;
      ctx.lineWidth = on ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(g.dx0, yy);
      ctx.lineTo(g.dx1, yy);
      ctx.stroke();
      label(ctx, `n = ${n}`, g.dx0 - 6, yy, { size, align: "right", bold: on });
      label(ctx, `${fmt(energy(n), 2)} eV`, g.dx1 + 6, yy, { size: size - 1, color: on ? COLORS.ink : COLORS.muted });
    }
    if (!g.small) label(ctx, "Khoảng cách các mức vẽ không theo tỉ lệ năng lượng", g.dx0, g.y1 + 18, { size: 12, color: COLORS.muted });

    if (tr.wavelength) {
      const col = lineColor(tr.wavelength);
      // transition arrow, dashed until the jump has happened
      ctx.setLineDash(moving && u >= 1 ? [] : [6, 5]);
      arrow(ctx, g.xm, g.y(tr.from), g.xm, g.y(tr.to), COLORS.orange, 2.5);
      ctx.setLineDash([]);
      // photon: emitted from the middle of the jump to the right, or arriving from the left
      const len = Math.min(110, (g.dx1 - g.xm) * 0.7);
      if (emit) {
        const ym = (g.y(tr.from) + g.y(tr.to)) / 2;
        const p = !moving ? 0.5 : ease((u - 0.3) / 0.7);
        if (!moving || u > 0.3) photon(ctx, g.xm + 14 + p * (g.dx1 - g.xm - len - 24), ym, len, 1, tr.wavelength, col);
      } else if (!moving || u < 0.6) {
        const p = !moving ? 0.6 : ease(u / 0.6);
        const xEnd = g.xm - 14 - (1 - p) * (g.xm - g.dx0 - len);
        photon(ctx, xEnd - len, g.y(tr.from), len - 10, 1, tr.wavelength, col);
      }
    }

    // electron
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(g.xm, yE, 8, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, "e", g.xm, yE, { size: 11, bold: true, color: "#fff", align: "center" });
    if (!moving && tr.from === tr.to) label(ctx, `electron ở mức n = ${cur}`, g.xm + 14, yE - 14, { size: size - 1, color: COLORS.muted });

    if (g.orbits) drawOrbits(ctx, g, s, view, tr.wavelength ? ey : tr.from);
    drawSpectrum(ctx, g, tr);
  },
});
