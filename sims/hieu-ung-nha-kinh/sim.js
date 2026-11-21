import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import {
  initialState, step as relax, CO2_PRE, albedo, absorptivity, equilibrium, fluxes, baseline, rise, surfaceTemperature, toC,
} from "./model.js";

const SW = COLORS.orange; // sunlight
const IR = COLORS.red; // infrared
const CO2_MIN = 180;
const CO2_MAX = 1200;
const LAYER = 0.42; // height of the greenhouse-gas layer, fraction of the sky (0 = top, 1 = ground)
const CLOUDS = 0.3; // cloud level

const report = (s, api) => {
  const T = equilibrium(s);
  const r = rise(s);
  api.emit("climate-result", { co2: s.co2, cloud: s.cloud, atmosphere: s.atmosphere ? 1 : 0, surfaceTemp: toC(T), rise: r }, "result");
  const under = s.atmosphere && r <= s.target;
  if (under && !s.goalMet) api.emit("target-kept", { co2: s.co2, cloud: s.cloud, rise: r, target: s.target }, "goal");
  s.goalMet = under;
};

// ---------- photons (view only, random, transient) ----------
// x, y in 0..1 of the scene box; y = 0 top of the sky, y = 1 ground.
function photons(s, dt) {
  const list = (s._ph ??= seed());
  const eps = absorptivity(s.co2, s.atmosphere);
  s._spawn = (s._spawn ?? 0) + dt * 5;
  while (s._spawn >= 1 && list.length < 60) {
    s._spawn -= 1;
    list.push({ k: "sw", x: 0.08 + Math.random() * 0.5, y: 0, vx: 0.07, vy: 0.32, tested: false });
  }
  for (const p of list) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.k === "sw" && !p.tested && p.y >= CLOUDS) {
      p.tested = true;
      if (Math.random() < albedo(s.cloud)) p.vy = -p.vy; // reflected by clouds (and the ground, lumped here)
    }
    if (p.k === "sw" && p.y >= 1) {
      // absorbed by the ground, which glows in the infrared
      Object.assign(p, { k: "ir", y: 1, vy: -0.22, vx: (Math.random() - 0.5) * 0.12, tested: false });
    } else if (p.k === "ir" && p.vy < 0 && !p.tested && p.y <= LAYER) {
      p.tested = true;
      if (Math.random() < eps) {
        // absorbed by a greenhouse-gas molecule, then re-emitted up or down
        p.hit = 0.25;
        if (Math.random() < 0.5) p.vy = -p.vy;
      }
    } else if (p.k === "ir" && p.vy > 0 && p.y >= 1) {
      Object.assign(p, { y: 1, vy: -0.22, tested: false });
    }
    if (p.hit) p.hit = Math.max(0, p.hit - dt);
  }
  s._ph = list.filter(p => p.y > -0.05 && p.x > -0.05 && p.x < 1.05);
}

function seed() {
  const list = [];
  for (let i = 0; i < 6; i++) list.push({ k: "sw", x: 0.1 + i * 0.08, y: 0.05 + i * 0.15, vx: 0.07, vy: 0.32, tested: i * 0.15 + 0.05 >= CLOUDS });
  list.push({ k: "sw", x: 0.55, y: 0.2, vx: 0.07, vy: -0.32, tested: true }); // reflected by a cloud
  for (let i = 0; i < 5; i++) list.push({ k: "ir", x: 0.55 + i * 0.08, y: 0.95 - i * 0.12, vx: 0.02 * (i - 2), vy: -0.22, tested: false });
  list.push({ k: "ir", x: 0.82, y: 0.2, vx: 0.01, vy: -0.22, tested: true }); // escaping to space
  list.push({ k: "ir", x: 0.9, y: 0.55, vx: -0.02, vy: 0.22, tested: true, hit: 0.2 }); // re-emitted downwards
  return list;
}

function geom(view) {
  const wide = view.w >= 640;
  const small = view.w < 560 || view.h < 420;
  const scene = wide ? { x: 0, y: 0, w: view.w * 0.56, h: view.h } : { x: 0, y: 0, w: view.w, h: view.h * 0.56 };
  const gx = wide ? scene.w + 52 : small ? 40 : 56;
  const gy = wide ? 44 : scene.h + (small ? 26 : 36);
  const graph = { x: gx, y: gy, w: view.w - gx - (small ? 14 : 22), h: view.h - gy - (small ? 26 : 40) };
  return { wide, small, scene, graph };
}

const wave = (ctx, x, y, angle, len, waves, color, width) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const px = -len + t * len;
    const py = Math.sin(t * waves * Math.PI * 2) * 3;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
};

function drawScene(ctx, s, g) {
  const b = g.scene;
  const groundH = Math.max(22, b.h * 0.12);
  const sky = { x: b.x, y: b.y, w: b.w, h: b.h - groundH };
  const Y = f => sky.y + f * sky.h;
  const X = f => sky.x + f * sky.w;
  const grad = ctx.createLinearGradient(0, sky.y, 0, sky.y + sky.h);
  grad.addColorStop(0, "#0f1a3a");
  grad.addColorStop(0.35, "#4d7bd1");
  grad.addColorStop(1, "#bfe0ff");
  ctx.fillStyle = grad;
  ctx.fillRect(sky.x, sky.y, sky.w, sky.h);

  // ground colour warms with temperature
  const warm = Math.min(1, Math.max(0, (toC(s.temp) + 20) / 60));
  ctx.fillStyle = `rgb(${Math.round(90 + 120 * warm)}, ${Math.round(150 - 50 * warm)}, ${Math.round(80 - 30 * warm)})`;
  ctx.fillRect(b.x, sky.y + sky.h, b.w, groundH);

  // greenhouse-gas layer: molecules, more with more CO₂
  if (s.atmosphere) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(sky.x, Y(LAYER - 0.08), sky.w, sky.h * 0.16);
    const n = Math.round(6 + 18 * ((s.co2 - CO2_MIN) / (CO2_MAX - CO2_MIN)));
    const r = g.small ? 2.5 : 3.5;
    for (let i = 0; i < n; i++) {
      const x = X(((i * 0.618034) % 1) * 0.96 + 0.02);
      const y = Y(LAYER - 0.06 + ((i * 0.381966 * 3) % 1) * 0.12);
      // CO₂: carbon (dark) between two oxygens (red)
      ctx.fillStyle = "#e5484d";
      ctx.beginPath();
      ctx.arc(x - r * 1.6, y, r, 0, Math.PI * 2);
      ctx.arc(x + r * 1.6, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a2a2a";
      ctx.beginPath();
      ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    label(ctx, "Lớp khí nhà kính (CO₂, hơi nước…)", sky.x + 6, Y(LAYER + 0.12), { size: g.small ? 10 : 12, color: "#fff" });
  }

  // clouds
  const nc = Math.round(s.cloud / 20);
  for (let i = 0; i < nc; i++) {
    const cx = X(0.12 + i * 0.19);
    const cy = Y(CLOUDS + (i % 2 ? 0.02 : -0.02));
    const u = Math.max(8, Math.min(20, sky.w / 26));
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(cx - u, cy, u * 0.8, 0, Math.PI * 2);
    ctx.arc(cx, cy - u * 0.4, u, 0, Math.PI * 2);
    ctx.arc(cx + u, cy, u * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sun
  ctx.fillStyle = COLORS.yellow;
  ctx.beginPath();
  ctx.arc(b.x + 4, b.y + 4, g.small ? 22 : 34, 0, Math.PI * 2);
  ctx.fill();

  // photons (a fixed first set, so the opening picture already shows every path)
  if (!s._ph) s._ph = seed();
  const len = g.small ? 14 : 20;
  for (const p of s._ph ?? []) {
    const angle = Math.atan2(p.vy * sky.h, p.vx * sky.w);
    if (p.k === "sw") wave(ctx, X(p.x), Y(p.y), angle, len, 3, SW, 2);
    else wave(ctx, X(p.x), Y(p.y), angle, len * 1.3, 1.2, IR, 2);
    if (p.hit) {
      ctx.fillStyle = `rgba(255,220,120,${p.hit * 3})`;
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // legend + temperature
  const size = g.small ? 10 : 12;
  ctx.font = `${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const lx = b.x + b.w - ctx.measureText("Hồng ngoại (sóng dài)").width - 32;
  wave(ctx, lx + 18, b.y + 12, 0, 18, 3, SW, 2);
  label(ctx, "Ánh sáng (sóng ngắn)", lx + 24, b.y + 12, { size, color: "#fff" });
  wave(ctx, lx + 18, b.y + 28, 0, 18, 1.2, IR, 2);
  label(ctx, "Hồng ngoại (sóng dài)", lx + 24, b.y + 28, { size, color: "#fff" });
  label(ctx, `Mặt đất: ${fmt(toC(s.temp), 1)} °C`, b.x + 8, sky.y + sky.h + groundH / 2, { size: g.small ? 12 : 15, bold: true, color: "#fff" });
  if (!g.small) label(ctx, "Hình minh họa, không theo tỉ lệ", b.x + b.w - 8, sky.y + sky.h + groundH / 2, { size: 11, color: "#fff", align: "right" });
}

function drawGraph(ctx, s, g) {
  const b = g.graph;
  if (b.h < 40 || b.w < 80) return;
  const size = g.small ? 10 : 12;
  const curveAt = co2 => toC(surfaceTemperature(absorptivity(co2, s.atmosphere), s.cloud));
  const base = toC(baseline());
  // the range always shows the curve, the pre-industrial line and the limit
  const ymin = Math.floor(Math.min(curveAt(CO2_MIN), base) - 1);
  const ymax = Math.ceil(Math.max(curveAt(CO2_MAX), base + s.target) + 1);
  const X = c => b.x + ((c - CO2_MIN) / (CO2_MAX - CO2_MIN)) * b.w;
  const Y = t => b.y + b.h - ((t - ymin) / (ymax - ymin)) * b.h;

  ctx.fillStyle = "#fff";
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  label(ctx, "Nhiệt độ bề mặt (°C)", b.x - (g.small ? 30 : 46), b.y - (g.small ? 12 : 18), { size, bold: true });
  const stepT = ymax - ymin > 40 ? 10 : ymax - ymin > 16 ? 5 : 2;
  for (let t = Math.ceil(ymin / stepT) * stepT; t <= ymax; t += stepT) {
    ctx.beginPath();
    ctx.moveTo(b.x, Y(t));
    ctx.lineTo(b.x + b.w, Y(t));
    ctx.stroke();
    label(ctx, fmt(t, 0), b.x - 4, Y(t), { size, align: "right", color: COLORS.muted });
  }
  for (const c of [280, 600, 900, 1200]) label(ctx, fmt(c, 0), X(c), b.y + b.h + (g.small ? 8 : 11), { size, align: "center", color: COLORS.muted });
  label(ctx, "CO₂ (ppm)", b.x + b.w, b.y + b.h + (g.small ? 19 : 26), { size, align: "right", color: COLORS.muted });

  // pre-industrial reference and allowed warming
  const dash = (y, color, text, below) => {
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(b.x, y);
    ctx.lineTo(b.x + b.w, y);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, text, b.x + b.w - 4, y + (below ? 9 : -8), { size, color, align: "right" });
  };
  dash(Y(base), COLORS.muted, `Tiền công nghiệp ${fmt(base, 1)} °C`, true);
  dash(Y(base + s.target), COLORS.red, `Giới hạn +${fmt(s.target, 1)} °C`, false);
  ctx.strokeStyle = COLORS.grid;
  ctx.beginPath();
  ctx.moveTo(X(CO2_PRE), b.y);
  ctx.lineTo(X(CO2_PRE), b.y + b.h);
  ctx.stroke();

  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let c = CO2_MIN; c <= CO2_MAX; c += 10) {
    const y = Y(curveAt(c));
    c === CO2_MIN ? ctx.moveTo(X(c), y) : ctx.lineTo(X(c), y);
  }
  ctx.stroke();
  const T = toC(equilibrium(s));
  const over = rise(s) > s.target;
  ctx.fillStyle = over ? COLORS.red : COLORS.green;
  ctx.beginPath();
  ctx.arc(X(s.co2), Y(T), 6, 0, Math.PI * 2);
  ctx.fill();
  const right = X(s.co2) > b.x + b.w * 0.6;
  label(ctx, `${fmt(T, 1)} °C (${rise(s) >= 0 ? "+" : ""}${fmt(rise(s), 1)})`, X(s.co2) + (right ? -10 : -6), Y(T) - 14, {
    size, bold: true, align: "right", color: over ? COLORS.red : COLORS.green,
  });
}

mount({
  slug: "hieu-ung-nha-kinh",
  version: "1.0.0",
  title: "Hiệu ứng nhà kính",
  hint: "Đổi lượng CO₂ và mây rồi thả tay: mặt đất ấm dần tới nhiệt độ cân bằng mới. Thử giữ mức tăng nhiệt độ không vượt quá giới hạn.",
  initialState,
  autoplay: true,
  step(s, dt) {
    relax(s, dt);
    photons(s, dt);
  },
  controls: [
    { type: "slider", key: "co2", label: "Nồng độ CO₂", min: CO2_MIN, max: CO2_MAX, step: 10, unit: "ppm", digits: 0, onCommit: report },
    { type: "slider", key: "cloud", label: "Lượng mây che phủ", min: 0, max: 100, step: 1, unit: "%", digits: 0, onCommit: report },
    { type: "checkbox", key: "atmosphere", label: "Có khí nhà kính hấp thụ hồng ngoại", onCommit: report },
    {
      type: "select",
      key: "target",
      label: "Giới hạn nhiệt độ tăng",
      onCommit: report,
      options: [
        { value: 1.5, label: "+1,5 °C so với thời tiền công nghiệp" },
        { value: 2, label: "+2 °C so với thời tiền công nghiệp" },
      ],
    },
  ],
  readouts: [
    { label: "Nhiệt độ mặt đất lúc này", value: s => `${fmt(toC(s.temp), 1)} °C` },
    { label: "Nhiệt độ cân bằng", value: s => `${fmt(toC(equilibrium(s)), 1)} °C` },
    { label: "Tăng so với thời tiền công nghiệp", value: s => `${rise(s) >= 0 ? "+" : ""}${fmt(rise(s), 2)} °C` },
    { label: "Hấp thụ hồng ngoại của khí quyển ε", value: s => fmt(absorptivity(s.co2, s.atmosphere), 3) },
    { label: "Năng lượng Mặt Trời được hấp thụ", value: s => `${fmt(fluxes(s.temp, 0, s.cloud).absorbed, 0)} W/m²` },
    { label: "Năng lượng thoát ra vũ trụ", value: s => `${fmt(fluxes(s.temp, absorptivity(s.co2, s.atmosphere), s.cloud).outgoing, 0)} W/m²` },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    drawScene(ctx, s, g);
    drawGraph(ctx, s, g);
  },
});
