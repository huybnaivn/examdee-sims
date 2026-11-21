import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import {
  initialState, step, period, position, sectors, speedAt, perihelion, aphelion, focusDistance, semiMinor, addPlanet, sanitizePlanets, PRESETS, KM_S,
} from "./model.js";

const FONT = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const textWidth = (ctx, text, o) => ((ctx.font = FONT(o.size, o.bold)), ctx.measureText(text).width);
// A label nudged sideways so it stays inside `box`.
function boxed(ctx, text, x, y, box, o) {
  const w = textWidth(ctx, text, o);
  const left = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  const dx = Math.max(box.x + 4 - left, Math.min(0, box.x + box.w - 4 - (left + w)));
  label(ctx, text, x + dx, y, o);
}
// The first text that fits the width, else the last one.
const fit = (ctx, texts, width, o) => texts.find(t => textWidth(ctx, t, o) <= width) ?? texts.at(-1);

const nameOf = p => PRESETS.find(q => q.a === p.a && q.e === p.e)?.label;

function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const wide = view.w >= 720;
  const full = { x: 0, y: 0, w: view.w, h: view.h };
  if (!s.showChart) return { small, orbit: full, chart: null };
  if (wide) return { small, orbit: { ...full, w: view.w * 0.6 }, chart: { x: view.w * 0.6 + 4, y: 12, w: view.w * 0.4 - 16, h: view.h - 24 } };
  const oh = Math.round(view.h * 0.6);
  return { small, orbit: { ...full, h: oh }, chart: { x: 6, y: oh, w: view.w - 12, h: view.h - oh - 6 } };
}

// Ellipse centre in the middle of the box; the Sun (focus F₁) sits c = a·e to its right.
function orbitMap(s, box, small) {
  const padX = small ? 34 : 70;
  const padTop = small ? 40 : 58;
  const padBottom = small ? 40 : 56;
  const b = semiMinor(s.a, s.e);
  const k = Math.min((box.w - 2 * padX) / (2 * s.a), (box.h - padTop - padBottom) / (2 * b));
  const cx = box.x + box.w / 2;
  const cy = box.y + padTop + (box.h - padTop - padBottom) / 2;
  const sx = cx + focusDistance(s.a, s.e) * k;
  return { k, cx, cy, sx, P: (x, y) => [sx + x * k, cy - y * k] };
}

function sector(ctx, s, m, t1, t2, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(m.sx, m.cy);
  for (let i = 0; i <= 60; i++) {
    const p = position(s.a, s.e, t1 + ((t2 - t1) * i) / 60);
    ctx.lineTo(...m.P(p.x, p.y));
  }
  ctx.closePath();
  ctx.fill();
}

function drawOrbit(ctx, s, box, small) {
  const m = orbitMap(s, box, small);
  const size = small ? 11 : 13;
  const T = period(s.a);
  const c = focusDistance(s.a, s.e);
  const b = semiMinor(s.a, s.e);

  // equal-time sectors
  if (s.showSectors) {
    const sec = sectors(s);
    sector(ctx, s, m, -sec.dt / 2, sec.dt / 2, "rgba(47, 111, 237, 0.28)");
    sector(ctx, s, m, T / 2 - sec.dt / 2, T / 2 + sec.dt / 2, "rgba(240, 140, 46, 0.32)");
    const ly = box.y + box.h - (small ? 26 : 36);
    const o = { size, bold: true };
    const t1 = small ? `S₁ = ${fmt(sec.near, 3)} AU²` : `S₁ (quanh cận nhật) = ${fmt(sec.near, 3)} AU²`;
    label(ctx, t1, box.x + 8, ly, { ...o, color: COLORS.blue });
    label(ctx, small ? `S₂ = ${fmt(sec.far, 3)} AU²` : `S₂ (quanh viễn nhật) = ${fmt(sec.far, 3)} AU²`, box.x + 8 + textWidth(ctx, t1, o) + 16, ly, { ...o, color: COLORS.orange });
    const ho = { size: small ? 11 : 13 };
    const head = fit(ctx, [
      `Định luật II: trong cùng Δt = ${fmt(sec.dt, 3)} năm, đoạn nối Mặt Trời – hành tinh quét diện tích bằng nhau`,
      `Định luật II: cùng Δt = ${fmt(sec.dt, 3)} năm thì quét diện tích bằng nhau`,
      `Quét trong cùng Δt = ${fmt(sec.dt, 3)} năm`,
    ], box.w - 16, ho);
    label(ctx, head, box.x + 8, box.y + (small ? 26 : 38), { ...ho, color: COLORS.muted });
  }

  // ellipse, major axis, centre O, second focus
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(m.cx, m.cy, s.a * m.k, b * m.k, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = COLORS.grid;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(m.cx - s.a * m.k, m.cy);
  ctx.lineTo(m.cx + s.a * m.k, m.cy);
  ctx.stroke();
  ctx.setLineDash([]);
  // equal time marks every T/16
  ctx.fillStyle = COLORS.muted;
  for (let i = 0; i < 16; i++) {
    const p = position(s.a, s.e, (i * T) / 16);
    ctx.beginPath();
    ctx.arc(...m.P(p.x, p.y), 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(m.cx, m.cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, "O", m.cx, m.cy - 10, { size, color: COLORS.muted, align: "center" });
  if (s.e > 0.05) {
    ctx.strokeStyle = COLORS.muted;
    ctx.beginPath();
    ctx.arc(m.cx - c * m.k, m.cy, 3, 0, Math.PI * 2);
    ctx.stroke();
    label(ctx, "F₂", m.cx - c * m.k, m.cy - 10, { size, color: COLORS.muted, align: "center" });
    // c = a·e
    const y = m.cy + (small ? 12 : 16);
    ctx.strokeStyle = COLORS.purple;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m.cx, y - 4);
    ctx.lineTo(m.cx, y + 4);
    ctx.moveTo(m.cx, y);
    ctx.lineTo(m.sx, y);
    ctx.moveTo(m.sx, y - 4);
    ctx.lineTo(m.sx, y + 4);
    ctx.stroke();
    label(ctx, small ? `c = ${fmt(c)}` : `c = a·e = ${fmt(c)} AU`, (m.cx + m.sx) / 2, y + 11, { size: small ? 10 : 12, color: COLORS.purple, align: "center" });
  }

  // speeds at perihelion (moving up the screen) and aphelion (moving down)
  if (s.showSpeeds) {
    const vp = speedAt(s.a, perihelion(s.a, s.e));
    const va = speedAt(s.a, aphelion(s.a, s.e));
    const L = small ? 34 : 56;
    const [px] = m.P(perihelion(s.a, s.e), 0);
    const [ax] = m.P(-aphelion(s.a, s.e), 0);
    arrow(ctx, px, m.cy, px, m.cy - L, COLORS.green, 2.5);
    arrow(ctx, ax, m.cy, ax, m.cy + Math.max(8, (L * va) / vp), COLORS.green, 2.5);
    boxed(ctx, `vp = ${fmt(vp * KM_S, 1)} km/s`, px, m.cy - L - 9, box, { size, bold: true, color: COLORS.green, align: "center" });
    boxed(ctx, `va = ${fmt(va * KM_S, 1)} km/s`, ax, m.cy + Math.max(8, (L * va) / vp) + 9, box, { size, bold: true, color: COLORS.green, align: "center" });
    if (!small) {
      label(ctx, "cận nhật", px + 6, m.cy + 12, { size: 12, color: COLORS.muted });
      label(ctx, "viễn nhật", ax - 6, m.cy - 12, { size: 12, color: COLORS.muted, align: "right" });
    }
  }

  // Sun and planet
  const p = position(s.a, s.e, s.t);
  const [qx, qy] = m.P(p.x, p.y);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m.sx, m.cy);
  ctx.lineTo(qx, qy);
  ctx.stroke();
  ctx.fillStyle = COLORS.yellow;
  ctx.beginPath();
  ctx.arc(m.sx, m.cy, small ? 7 : 10, 0, Math.PI * 2);
  ctx.fill();
  if (!small) label(ctx, "Mặt Trời (F₁)", m.sx, m.cy - 20, { size: 12, align: "center", color: COLORS.ink });
  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.arc(qx, qy, small ? 5 : 7, 0, Math.PI * 2);
  ctx.fill();

  label(ctx, `a = ${fmt(s.a)} AU, e = ${fmt(s.e)}, T = ${fmt(period(s.a))} năm`, box.x + 8, box.y + (small ? 11 : 16), { size: small ? 11 : 14, bold: true });
  label(ctx, "Mặt Trời và hành tinh không theo tỉ lệ", box.x + 8, box.y + box.h - (small ? 10 : 14), { size: small ? 10 : 11, color: COLORS.muted });
}

function drawChart(ctx, s, box, small) {
  const size = small ? 10 : 12;
  ctx.fillStyle = "#fff";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = COLORS.grid;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  const L = box.x + (small ? 34 : 46), R = box.x + box.w - 12, T = box.y + (small ? 24 : 34), B = box.y + box.h - (small ? 18 : 28);
  const pts = s.planets.map(p => ({ ...p, x: p.a ** 3, y: period(p.a) ** 2 }));
  const cur = { x: s.a ** 3, y: period(s.a) ** 2 };
  const max = Math.max(1, cur.x, ...pts.map(p => p.x), cur.y, ...pts.map(p => p.y)) * 1.12;
  const X = v => L + (v / max) * (R - L);
  const Y = v => B - (v / max) * (B - T);
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(L, T);
  ctx.lineTo(L, B);
  ctx.lineTo(R, B);
  ctx.stroke();
  label(ctx, small ? "Định luật III" : "Định luật III: T² theo a³", box.x + 8, box.y + (small ? 10 : 14), { size: small ? 11 : 13, bold: true });
  label(ctx, "T² (năm²)", L + 6, T + 4, { size, color: COLORS.muted });
  label(ctx, "a³ (AU³)", R, B + (small ? 10 : 15), { size, color: COLORS.muted, align: "right" });
  label(ctx, fmt(max, 0), L - 3, T, { size, color: COLORS.muted, align: "right" });
  label(ctx, "0", L - 3, B, { size, color: COLORS.muted, align: "right" });
  if (pts.length >= 2) {
    ctx.strokeStyle = COLORS.blue;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    ctx.lineTo(X(max), Y(max));
    ctx.stroke();
    ctx.setLineDash([]);
    if (!small) label(ctx, "T²/a³ như nhau với mọi hành tinh", R, B - 12, { size, color: COLORS.blue, align: "right" });
  }
  // current orbit, not yet added
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(X(cur.x), Y(cur.y), 6, 0, Math.PI * 2);
  ctx.stroke();
  for (const p of pts) {
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), 4.5, 0, Math.PI * 2);
    ctx.fill();
    const name = nameOf(p) ?? `a = ${fmt(p.a)}`;
    const right = X(p.x) + 7 + textWidth(ctx, name, { size }) > R;
    if (!small || pts.length < 4) label(ctx, name, X(p.x) + (right ? -7 : 7), Y(p.y) + 9, { size, color: COLORS.ink, align: right ? "right" : "left" });
  }
  if (!pts.length) {
    label(ctx, small ? "Bấm “Thêm vào biểu đồ”" : "Bấm “Thêm vào biểu đồ T²–a³” cho vài quỹ đạo", (L + R) / 2, (T + B) / 2, { size, align: "center", color: COLORS.muted });
  }
}

const compare = (s, api) => {
  if (!s.showSectors) return;
  const sec = sectors(s);
  api.emit("areas-compared", { areaPerihelion: sec.near, areaAphelion: sec.far, sweepTime: sec.dt, ratio: sec.near / sec.far, a: s.a, e: s.e }, "result");
};
const custom = s => {
  s.preset = "custom";
};

mount({
  slug: "dinh-luat-kepler",
  version: "1.0.0",
  title: "Các định luật Kê-ple",
  hint: "Đổi bán trục lớn a và tâm sai e của quỹ đạo, so sánh hai diện tích quét được trong cùng một khoảng thời gian, rồi thêm vài hành tinh vào biểu đồ T² theo a³.",
  initialState,
  autoplay: true,
  step,
  sanitize(incoming, base) {
    const out = {};
    for (const [key, value] of Object.entries(base)) {
      const v = incoming[key];
      if (key === "planets" || typeof v !== typeof value) continue;
      if (typeof v === "number" && !Number.isFinite(v)) continue;
      out[key] = v;
    }
    out.planets = sanitizePlanets(incoming.planets);
    return out;
  },
  controls: [
    {
      type: "select",
      key: "preset",
      label: "Hành tinh",
      options: PRESETS.map(({ value, label }) => ({ value, label })),
      onChange(s) {
        const p = PRESETS.find(q => q.value === s.preset);
        if (p.a) Object.assign(s, { a: p.a, e: p.e, t: 0 });
      },
      onCommit: compare,
    },
    { type: "slider", key: "a", label: "Bán trục lớn a", min: 0.3, max: 6, step: 0.01, unit: "AU", onChange: custom, onCommit: compare },
    { type: "slider", key: "e", label: "Tâm sai e", min: 0, max: 0.9, step: 0.01, onChange: custom, onCommit: compare },
    {
      type: "slider", key: "sweep", label: "Thời gian quét Δt", min: 5, max: 20, step: 1, onCommit: compare,
      format: (v, s) => `${fmt(v, 0)} % T = ${fmt((v / 100) * period(s.a), 3)} năm`,
      visible: s => s.showSectors,
    },
    { type: "checkbox", key: "showSectors", label: "Tô hai diện tích quét trong cùng Δt", onCommit: compare },
    { type: "checkbox", key: "showSpeeds", label: "Hiện tốc độ ở cận nhật và viễn nhật" },
    { type: "checkbox", key: "showChart", label: "Hiện biểu đồ T² theo a³" },
    {
      type: "button",
      label: "Thêm vào biểu đồ T²–a³",
      primary: true,
      action(s, api) {
        addPlanet(s);
        s.showChart = true;
        const T = period(s.a);
        api.emit("planet-added", { a: s.a, e: s.e, period: T, ratio: (T * T) / s.a ** 3, count: s.planets.length }, "result");
      },
    },
    { type: "button", label: "Xóa biểu đồ", action: s => (s.planets = []), event: "clear-chart", visible: s => s.planets.length > 0 },
  ],
  readouts: [
    { label: "Chu kì T", value: s => `${fmt(period(s.a), 3)} năm` },
    { label: "T²/a³", value: s => `${fmt(period(s.a) ** 2 / s.a ** 3, 3)} năm²/AU³` },
    { label: "Cận nhật rp = a − c", value: s => `${fmt(perihelion(s.a, s.e), 3)} AU` },
    { label: "Viễn nhật ra = a + c", value: s => `${fmt(aphelion(s.a, s.e), 3)} AU` },
    { label: "rp·vp và ra·va", value: s => `${fmt(perihelion(s.a, s.e) * speedAt(s.a, perihelion(s.a, s.e)), 3)} và ${fmt(aphelion(s.a, s.e) * speedAt(s.a, aphelion(s.a, s.e)), 3)} AU²/năm` },
    { label: "Tốc độ hiện tại", value: s => { const p = position(s.a, s.e, s.t); return `${fmt(Math.hypot(p.vx, p.vy) * KM_S, 1)} km/s`; } },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    drawOrbit(ctx, s, g.orbit, g.small);
    if (g.chart) drawChart(ctx, s, g.chart, g.small);
  },
});
