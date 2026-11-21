import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import {
  initialState, step, TILT, YEAR, POLAR_CIRCLE, orbitAngle, declination, dayLength, noonAltitude, wrapDay, SEASONS, dateLabel,
} from "./model.js";

const RAD = Math.PI / 180;
const NIGHT = "#2b3552";
const DAY_SIDE = "#8fc3ff";
const ORANGE = COLORS.orange;
const BLUE = COLORS.blue;

const info = s => {
  const dec = declination(s.day);
  return { dec, len: dayLength(s.latitude, dec), alt: noonAltitude(s.latitude, dec) };
};

// One result each time a date (or latitude) is settled.
const report = (s, api) => {
  const { dec, len, alt } = info(s);
  api.emit("day-measured", { day: Math.floor(s.day), latitude: s.latitude, declination: dec, dayLength: len, noonAltitude: alt }, "result");
};

function geom(view) {
  const small = view.w < 600 || view.h < 440;
  const th = Math.round(view.h * (small ? 0.54 : 0.58));
  const ow = Math.round(view.w * 0.6);
  const orbit = { x: 0, y: 0, w: ow, h: th };
  const globe = { x: ow, y: 0, w: view.w - ow, h: th };
  const graph = { x: small ? 34 : 52, y: th + (small ? 24 : 34), w: view.w - (small ? 70 : 104), h: view.h - th - (small ? 44 : 62) };
  const cx = orbit.x + orbit.w / 2;
  const cy = orbit.y + orbit.h / 2 + (small ? 4 : 8);
  const rx = Math.max(30, Math.min(orbit.w / 2 - (small ? 20 : 90), (orbit.h / 2 - 24) / 0.42));
  return { small, orbit, globe, graph, cx, cy, rx, ry: rx * 0.42 };
}

// within a few days of a solstice or equinox (the year wraps)
const near = (a, b) => Math.abs(((a - b + YEAR * 1.5) % YEAR) - YEAR / 2) < 6;

const earthAt = (g, day) => {
  const a = orbitAngle(day);
  return { x: g.cx + g.rx * Math.cos(a), y: g.cy - g.ry * Math.sin(a), a };
};

function drawOrbit(ctx, s, g) {
  const { cx, cy, rx, ry, small } = g;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  // direction of motion
  arrow(ctx, cx + rx * Math.cos(-0.35) , cy - ry * Math.sin(-0.35), cx + rx * Math.cos(-0.15), cy - ry * Math.sin(-0.15), COLORS.muted, 2);

  // solstices and equinoxes
  for (const m of SEASONS) {
    const p = earthAt(g, m.day);
    ctx.fillStyle = COLORS.muted;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    if (near(s.day, m.day)) continue; // the Earth sits here: its name goes in the title instead
    const dx = Math.cos(p.a);
    const dy = -Math.sin(p.a);
    // on a narrow stage the side labels go above the point so they stay inside the orbit view
    const side = Math.abs(dx) >= 0.3;
    const tx = small && side ? p.x : p.x + dx * (small ? 14 : 24);
    const ty = small && side ? p.y - 20 : p.y + dy * (small ? 13 : 20);
    const align = !side || small ? "center" : dx > 0 ? "left" : "right";
    label(ctx, m.name, tx, ty - (small ? 0 : 7), { size: small ? 10 : 12, align, color: COLORS.muted, bold: true });
    if (!small) label(ctx, dateLabel(m.day), tx, ty + 8, { size: 11, align, color: COLORS.muted });
  }

  const e = earthAt(g, s.day);
  const er = small ? 10 : 16;
  const sun = () => {
    const sr = small ? 14 : 22;
    const glow = ctx.createRadialGradient(cx, cy, sr * 0.5, cx, cy, sr * 2);
    glow.addColorStop(0, "rgba(245,197,24,0.55)");
    glow.addColorStop(1, "rgba(245,197,24,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, sr * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    ctx.arc(cx, cy, sr, 0, Math.PI * 2);
    ctx.fill();
    if (!small) label(ctx, "Mặt Trời", cx, cy + sr + 12, { size: 11, align: "center", color: COLORS.muted });
  };
  const earth = () => {
    ctx.fillStyle = NIGHT;
    ctx.beginPath();
    ctx.arc(e.x, e.y, er, 0, Math.PI * 2);
    ctx.fill();
    // lit half faces the Sun
    const toSun = Math.atan2(cy - e.y, cx - e.x);
    ctx.fillStyle = DAY_SIDE;
    ctx.beginPath();
    ctx.arc(e.x, e.y, er, toSun - Math.PI / 2, toSun + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    // axis: always leans the same way in space
    const L = er + (small ? 7 : 10);
    const ax = Math.sin(TILT * RAD) * L;
    const ay = Math.cos(TILT * RAD) * L;
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.x - ax, e.y + ay);
    ctx.lineTo(e.x + ax, e.y - ay);
    ctx.stroke();
    label(ctx, "B", e.x + ax + 2, e.y - ay - 6, { size: small ? 10 : 12, color: COLORS.red, bold: true });
  };
  // the far half of the orbit is behind the Sun
  if (Math.sin(e.a) > 0) (earth(), sun());
  else (sun(), earth());

  const here = SEASONS.find(m => near(s.day, m.day));
  label(ctx, `Ngày ${dateLabel(s.day)}${here ? ` · ${here.name}` : ""}`, g.orbit.x + 8, g.orbit.y + (small ? 11 : 16), { size: small ? 12 : 15, bold: true });
  label(ctx, small ? "Hình không theo tỉ lệ" : "Hình không theo tỉ lệ · công thức gần đúng, mốc ngày có thể lệch 1–2 ngày", g.orbit.x + 8, g.orbit.y + g.orbit.h - (small ? 8 : 12), { size: small ? 10 : 11, color: COLORS.muted });
}

function drawGlobe(ctx, s, g) {
  const { globe: b, small } = g;
  const { dec } = info(s);
  const r = Math.max(20, Math.min(b.w * 0.36, b.h * 0.33));
  const cx = b.x + b.w / 2 + (small ? 4 : 10);
  const cy = b.y + b.h / 2 + (small ? 4 : 6);

  // sunlight from the left
  for (const k of [-0.6, 0, 0.6]) arrow(ctx, cx - r - (small ? 26 : 60), cy + k * r, cx - r - 4, cy + k * r, "rgba(240,140,46,0.7)", 2);
  if (!small) label(ctx, "Ánh sáng Mặt Trời", b.x + 4, cy - r - 10, { size: 11, color: COLORS.orange });

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = NIGHT;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.fillStyle = DAY_SIDE;
  ctx.fillRect(cx - r, cy - r, r, 2 * r);
  ctx.restore();

  // axis leans towards the Sun by δ (north pole up)
  const n = { x: -Math.sin(dec * RAD), y: -Math.cos(dec * RAD) };
  const e = { x: Math.cos(dec * RAD), y: -Math.sin(dec * RAD) };
  const circle = (lat, color, width, dash = []) => {
    const c = { x: cx + n.x * r * Math.sin(lat * RAD), y: cy + n.y * r * Math.sin(lat * RAD) };
    const h = r * Math.cos(lat * RAD);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(c.x - e.x * h, c.y - e.y * h);
    ctx.lineTo(c.x + e.x * h, c.y + e.y * h);
    ctx.stroke();
    ctx.setLineDash([]);
    return { c, h };
  };
  circle(0, "rgba(255,255,255,0.6)", 1);
  circle(POLAR_CIRCLE, "rgba(255,255,255,0.45)", 1, [3, 3]);
  circle(-POLAR_CIRCLE, "rgba(255,255,255,0.45)", 1, [3, 3]);

  // chosen latitude: part on the day side and part on the night side
  const { c, h } = circle(s.latitude, COLORS.yellow, 3);
  const a = { x: c.x - e.x * h, y: c.y - e.y * h };
  const z = { x: c.x + e.x * h, y: c.y + e.y * h };
  if (Math.abs(z.x - a.x) > 0.5) {
    const t = Math.min(1, Math.max(0, (cx - a.x) / (z.x - a.x)));
    const m = { x: a.x + (z.x - a.x) * t, y: a.y + (z.y - a.y) * t };
    const [day, night] = a.x < z.x ? [[a, m], [m, z]] : [[m, a], [z, m]];
    ctx.lineWidth = 4;
    ctx.strokeStyle = ORANGE;
    ctx.beginPath();
    ctx.moveTo(day[0].x, day[0].y);
    ctx.lineTo(day[1].x, day[1].y);
    ctx.stroke();
    ctx.strokeStyle = "#c9b8ff";
    ctx.beginPath();
    ctx.moveTo(night[0].x, night[0].y);
    ctx.lineTo(night[1].x, night[1].y);
    ctx.stroke();
  }

  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - n.x * r * 1.22, cy - n.y * r * 1.22);
  ctx.lineTo(cx + n.x * r * 1.22, cy + n.y * r * 1.22);
  ctx.stroke();
  label(ctx, "B", cx + n.x * r * 1.22 + 4, cy + n.y * r * 1.22 - 4, { size: small ? 10 : 12, color: COLORS.red, bold: true });

  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  label(ctx, "Ngày", cx - r / 2, cy + r + (small ? 9 : 13), { size: small ? 10 : 12, align: "center", color: COLORS.muted });
  label(ctx, "Đêm", cx + r / 2, cy + r + (small ? 9 : 13), { size: small ? 10 : 12, align: "center", color: COLORS.muted });
}

function drawGraph(ctx, s, g) {
  const { graph: b, small } = g;
  if (b.h < 30) return;
  const X = d => b.x + ((d - 1) / (YEAR - 1)) * b.w;
  const Yh = hours => b.y + b.h - (hours / 24) * b.h;
  const Ya = deg => b.y + b.h - (Math.max(0, deg) / 90) * b.h;
  const size = small ? 10 : 12;

  ctx.fillStyle = "#fff";
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (const k of [0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h * k);
    ctx.lineTo(b.x + b.w, b.y + b.h * k);
    ctx.stroke();
  }
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  label(ctx, "24 h", b.x - 4, b.y, { size, align: "right", color: ORANGE });
  label(ctx, "12 h", b.x - 4, b.y + b.h / 2, { size, align: "right", color: ORANGE });
  label(ctx, "0", b.x - 4, b.y + b.h, { size, align: "right", color: COLORS.muted });
  label(ctx, "90°", b.x + b.w + 4, b.y, { size, color: BLUE });
  label(ctx, "45°", b.x + b.w + 4, b.y + b.h / 2, { size, color: BLUE });
  for (const [m, d] of [[1, 1], [4, 91], [7, 182], [10, 274]]) label(ctx, `T${m}`, X(d), b.y + b.h + (small ? 8 : 11), { size, align: "center", color: COLORS.muted });

  for (const m of SEASONS) {
    ctx.strokeStyle = COLORS.grid;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(X(m.day), b.y);
    ctx.lineTo(X(m.day), b.y + b.h);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const curve = (f, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let d = 1; d <= YEAR; d += 2) {
      const y = f(declination(d));
      d === 1 ? ctx.moveTo(X(d), y) : ctx.lineTo(X(d), y);
    }
    ctx.stroke();
  };
  curve(dec => Yh(dayLength(s.latitude, dec)), ORANGE);
  curve(dec => Ya(noonAltitude(s.latitude, dec)), BLUE);

  const { len, alt } = info(s);
  const x = X(s.day);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, b.y);
  ctx.lineTo(x, b.y + b.h);
  ctx.stroke();
  for (const [y, color] of [[Yh(len), ORANGE], [Ya(alt), BLUE]]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const ly = b.y - (small ? 10 : 14);
  label(ctx, small ? "— Ban ngày (h)" : "— Thời gian ban ngày (h)", b.x, ly, { size, color: ORANGE, bold: true });
  label(ctx, small ? "— Độ cao trưa (°)" : "— Độ cao Mặt Trời lúc trưa (°)", b.x + b.w, ly, { size, color: BLUE, bold: true, align: "right" });
}

const graphDay = (p, g) => 1 + ((p.x - g.graph.x) / g.graph.w) * (YEAR - 1);

mount({
  slug: "ngay-dem-va-mua",
  version: "1.0.0",
  title: "Ngày, đêm và các mùa trên Trái Đất",
  hint: "Kéo Trái Đất trên quỹ đạo hoặc bấm vào đồ thị để chọn ngày; bấm Chạy để Trái Đất chuyển động quanh Mặt Trời.",
  initialState,
  step,
  controls: [
    {
      type: "slider", key: "day", label: "Ngày trong năm", min: 1, max: 365, step: 1,
      format: v => `${dateLabel(v)} (ngày thứ ${Math.floor(v)})`,
      onCommit: report,
    },
    {
      type: "select",
      key: "latitude",
      label: "Vĩ độ nơi quan sát",
      onCommit: report,
      options: [
        { value: 21.03, label: "Hà Nội (21° B)" },
        { value: 10.82, label: "TP Hồ Chí Minh (10,8° B)" },
        { value: 0, label: "Xích đạo (0°)" },
        { value: POLAR_CIRCLE, label: "Vòng cực Bắc (66,56° B)" },
        { value: 80, label: "Vùng cực (80° B)" },
      ],
    },
  ],
  readouts: [
    { label: "Ngày", value: s => dateLabel(s.day) },
    { label: "Xích vĩ Mặt Trời δ", value: s => `${fmt(declination(s.day), 1)}°` },
    { label: "Thời gian ban ngày", value: s => `${fmt(info(s).len, 1)} h` },
    { label: "Thời gian ban đêm", value: s => `${fmt(24 - info(s).len, 1)} h` },
    {
      label: "Độ cao Mặt Trời lúc trưa",
      value: s => (info(s).alt < 0 ? "Mặt Trời không mọc" : `${fmt(info(s).alt, 1)}°`),
    },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      const e = earthAt(g, s.day);
      const b = g.graph;
      if (Math.hypot(p.x - e.x, p.y - e.y) < 26) s._drag = "orbit";
      else if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y - 6 && p.y <= b.y + b.h + 6) {
        s._drag = "graph";
        s.day = wrapDay(Math.round(graphDay(p, g)));
      } else return false;
      api.pause();
    },
    move(p, s, api, view) {
      const g = geom(view);
      if (s._drag === "graph") s.day = Math.min(YEAR, Math.max(1, Math.round(graphDay(p, g))));
      else {
        const a = Math.atan2(-(p.y - g.cy) / g.ry, (p.x - g.cx) / g.rx);
        s.day = wrapDay(Math.round((a * YEAR) / (2 * Math.PI) - 10));
      }
    },
    up(p, s, api) {
      s._drag = null;
      api.emit("move-date", { day: Math.floor(s.day) });
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    drawOrbit(ctx, s, g);
    drawGlobe(ctx, s, g);
    drawGraph(ctx, s, g);
  },
});
