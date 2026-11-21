import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, stepRocket, burnTime, thrust, mass, fuelLeft, formulaSpeed, tsiolkovsky, burstSpeed, recoilSpeed, gOf, G } from "./model.js";

const RECOIL_SHOW = 1.2; // s of recoil animation
const SPACE = "#101a33";

const rocketOnly = s => s.mode === "rocket";
const recoilOnly = s => s.mode === "recoil";
const m0 = s => s.dryMass + s.fuelMass;
const vFinal = s => tsiolkovsky(s.exhaustSpeed, m0(s), s.dryMass); // without gravity

function clear(s, api) {
  Object.assign(s, { time: 0, v: 0, x: 0, pGas: 0, launched: false, done: false });
  s._trail = [];
  s._scroll = 0;
  api.pause();
}

function launch(s, api) {
  Object.assign(s, { time: 0, v: 0, x: 0, pGas: 0, launched: true, done: false });
  s._trail = [[0, 0]];
  s._scroll = 0;
  if (rocketOnly(s)) {
    api.emit("launch", { dryMass: s.dryMass, fuelMass: s.fuelMass, exhaustSpeed: s.exhaustSpeed, massFlow: s.massFlow, gravity: gOf(s) });
  } else {
    api.emit("fire", { gunMass: s.gunMass, bulletMass: s.bulletMass, bulletSpeed: s.bulletSpeed });
    const p2 = (s.bulletMass / 1000) * s.bulletSpeed;
    api.emit("recoil", { gunSpeed: recoilSpeed(s), bulletSpeed: s.bulletSpeed, gunMomentum: s.gunMass * recoilSpeed(s), bulletMomentum: p2, totalMomentum: s.gunMass * recoilSpeed(s) + p2 }, "result");
  }
}

function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const sceneW = small ? Math.max(120, view.w * 0.36) : Math.min(view.w * 0.38, 340);
  return { small, scene: { x: 0, y: 0, w: sceneW, h: view.h }, right: { x: sceneW, y: 0, w: view.w - sceneW, h: view.h } };
}

// ---------- rocket ----------
function drawRocketScene(ctx, s, g) {
  const { x: X, w: W, h: H } = g.scene;
  const sky = s.gravity;
  ctx.fillStyle = sky ? "#dcebff" : SPACE;
  ctx.fillRect(X, 0, W, H);
  // background moves past the rocket; the camera follows it
  const scroll = s._scroll ?? 0;
  ctx.fillStyle = sky ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.75)";
  for (let i = 0; i < 26; i++) {
    const bx = X + ((i * 73) % W);
    const by = (((i * 131) % H) + scroll) % H;
    if (sky) {
      ctx.beginPath();
      ctx.ellipse(bx, by, 14, 5, 0, 0, Math.PI * 2);
      if (i % 3 === 0) ctx.fill();
    } else ctx.fillRect(bx, by, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
  }
  const rh = Math.min(H * 0.34, g.small ? 110 : 150);
  const rw = rh * 0.26;
  const cx = X + W / 2;
  const groundY = H - (g.small ? 18 : 28);
  const climb = s.x * 0.5; // px per m near the pad
  const base = sky ? Math.max(H * 0.62, groundY - climb) : H * 0.62; // bottom of the rocket body
  const gy = base + climb; // the pad, sinking out of view once the camera follows the rocket
  if (sky && gy < H) {
    ctx.fillStyle = "#7cae6a";
    ctx.fillRect(X, gy, W, H - gy);
    ctx.fillStyle = COLORS.muted;
    ctx.fillRect(cx - rw * 1.2, gy - 4, rw * 2.4, 4);
  }
  const burning = s.launched && !s.done && fuelLeft(s) > 0;
  // gas: puffs leave the nozzle downwards
  if (burning) {
    const len = rh * (0.35 + 0.5 * clamp(s.massFlow / 500, 0, 1));
    const flame = ctx.createLinearGradient(0, base, 0, base + len);
    flame.addColorStop(0, "rgba(255,210,80,0.95)");
    flame.addColorStop(1, "rgba(240,90,40,0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(cx - rw * 0.35, base);
    ctx.lineTo(cx + rw * 0.35, base);
    ctx.lineTo(cx, base + len);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 10; i++) {
      const ph = (s.time * 3 * (burnTime(s) / 30 + 0.5) + i / 10) % 1;
      ctx.fillStyle = `rgba(200,200,210,${0.7 * (1 - ph)})`;
      ctx.beginPath();
      ctx.arc(cx + Math.sin(i * 2.4) * rw * 0.5 * ph, base + len * 0.6 + ph * rh * 0.8, 3 + 6 * ph, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // body, nose, fins
  const top = base - rh;
  ctx.fillStyle = "#e9edf5";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.fillRect(cx - rw / 2, top + rw * 0.9, rw, rh - rw * 0.9);
  ctx.strokeRect(cx - rw / 2, top + rw * 0.9, rw, rh - rw * 0.9);
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.moveTo(cx - rw / 2, top + rw * 0.9);
  ctx.quadraticCurveTo(cx - rw / 2, top + rw * 0.2, cx, top);
  ctx.quadraticCurveTo(cx + rw / 2, top + rw * 0.2, cx + rw / 2, top + rw * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + (d * rw) / 2, base - rh * 0.22);
    ctx.lineTo(cx + d * rw, base + 2);
    ctx.lineTo(cx + (d * rw) / 2, base);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // fuel tank window: the orange part is the fuel left
  const tx = cx - rw * 0.28;
  const tTop = top + rw * 1.3;
  const tH = rh - rw * 1.3 - rh * 0.12;
  const frac = s.fuelMass > 0 ? fuelLeft(s) / s.fuelMass : 0;
  ctx.fillStyle = "#fff";
  ctx.fillRect(tx, tTop, rw * 0.56, tH);
  ctx.fillStyle = COLORS.orange;
  ctx.fillRect(tx, tTop + tH * (1 - frac), rw * 0.56, tH * frac);
  ctx.strokeRect(tx, tTop, rw * 0.56, tH);

  // forces: thrust on the rocket, weight with gravity
  const fMax = Math.max(thrust(s), m0(s) * gOf(s));
  const fLen = f => 12 + (rh * 0.6 * f) / fMax;
  if (burning || !s.launched) {
    arrow(ctx, cx + rw * 1.25, base - rh * 0.3, cx + rw * 1.25, base - rh * 0.3 - fLen(thrust(s)), COLORS.green, 2.5);
    label(ctx, "F", cx + rw * 1.25 + 7, base - rh * 0.3 - fLen(thrust(s)) + 6, { color: sky ? COLORS.green : "#5fe0a8", bold: true, size: 13 });
  }
  if (sky) {
    const P = mass(s) * G;
    arrow(ctx, cx - rw * 1.25, base - rh * 0.5, cx - rw * 1.25, base - rh * 0.5 + fLen(P), COLORS.red, 2.5);
    label(ctx, "P", cx - rw * 1.25 - 13, base - rh * 0.5 + fLen(P) - 4, { color: COLORS.red, bold: true, size: 13 });
    if (s.x <= 0 && thrust(s) <= P) {
      label(ctx, "F < P: chưa rời bệ", cx, 14, { align: "center", color: COLORS.red, bold: true, size: g.small ? 11 : 13 });
    }
  }
  const ink = sky ? COLORS.ink : "#fff";
  label(ctx, `nhiên liệu ${fmt(fuelLeft(s), 0)} kg`, cx, top - 12, { align: "center", color: ink, size: g.small ? 10 : 12 });
  if (!sky) label(ctx, "không trọng lực", X + 6, H - 10, { color: "#9fb0d0", size: 10 });
}

function drawGraph(ctx, s, box, small) {
  const { x, y, w, h } = box;
  const tb = burnTime(s);
  const vmax = vFinal(s) * 1.08;
  const pad = { l: small ? 34 : 50, b: 18, t: 18 };
  const X = t => x + pad.l + ((w - pad.l - 8) * t) / tb;
  const Y = v => y + h - pad.b - ((h - pad.b - pad.t) * v) / vmax;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(vmax));
  ctx.lineTo(X(0), Y(0));
  ctx.lineTo(X(tb), Y(0));
  ctx.stroke();
  label(ctx, "v (m/s)", x + 2, y + 8, { size: 11, color: COLORS.muted });
  label(ctx, `t (s), cháy hết sau ${fmt(tb, 1)} s`, X(tb), Y(0) + 11, { size: 10, color: COLORS.muted, align: "right" });
  label(ctx, fmt(vFinal(s), 0), X(0) - 4, Y(vFinal(s)), { size: 10, align: "right", color: COLORS.muted });
  // formula curve, free space
  ctx.strokeStyle = COLORS.blue;
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const t = (tb * i) / 60;
    const v = tsiolkovsky(s.exhaustSpeed, m0(s), m0(s) - s.massFlow * t);
    i ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // simulated rocket
  const trail = s._trail?.length ? [...s._trail, [s.time, s.v]] : [[s.time, s.v]];
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  trail.forEach(([t, v], i) => (i ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v))));
  ctx.stroke();
  ctx.fillStyle = COLORS.orange;
  ctx.beginPath();
  ctx.arc(X(s.time), Y(s.v), 4, 0, Math.PI * 2);
  ctx.fill();
  const lx = X(0) + 8;
  label(ctx, "- - v = u·ln(m₀/m)", lx, y + pad.t + 6, { size: small ? 10 : 12, color: COLORS.blue, bold: true });
  label(ctx, s.gravity ? "— mô phỏng (có trọng lực)" : "— mô phỏng từng bước", lx, y + pad.t + (small ? 20 : 24), { size: small ? 10 : 12, color: COLORS.orange, bold: true });
}

function drawMomentum(ctx, s, box, small) {
  const { x, y, w, h } = box;
  const pr = mass(s) * s.v;
  const rows = [
    [small ? "Tên lửa" : "Tên lửa m·v", pr, COLORS.orange],
    [small ? "Khí" : "Khí phụt ra", s.pGas, "#8a94a8"],
    ["Tổng", pr + s.pGas, COLORS.ink],
  ];
  const scale = Math.max(Math.abs(pr), Math.abs(s.pGas), 1);
  const nameW = small ? 50 : 86;
  const mid = x + nameW + (w - nameW - 8) / 2;
  const half = (w - nameW - 8) / 2;
  label(ctx, small ? "Động lượng (10³ kg·m/s)" : "Động lượng (10³ kg·m/s), chiều dương hướng lên", x, y + 6, { size: 12, bold: true });
  const rowH = (h - 20) / 3;
  rows.forEach(([name, p, color], i) => {
    const cy = y + 22 + rowH * (i + 0.5);
    label(ctx, name, x, cy, { size: 12, color: COLORS.muted });
    ctx.fillStyle = color;
    const len = (p / scale) * (half - (small ? 52 : 70)); // leave room for the number
    ctx.fillRect(Math.min(mid, mid + len), cy - 7, Math.abs(len), 14);
    label(ctx, fmt(p / 1000, 0), mid + (len >= 0 ? Math.max(len, 0) + 6 : len - 6), cy, { size: 11, align: len >= 0 ? "left" : "right" });
  });
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(mid, y + 20);
  ctx.lineTo(mid, y + h);
  ctx.stroke();
}

// ---------- recoil ----------
function drawRecoil(ctx, s, view, small) {
  const W = view.w;
  const H = view.h;
  const v1 = recoilSpeed(s);
  const p2 = (s.bulletMass / 1000) * s.bulletSpeed;
  const t = s.launched ? s.time : 0;
  const size = small ? 12 : 15;
  label(ctx, "m₁v₁ + m₂v₂ = 0  ⇒  v₁ = −m₂v₂/m₁", 12, small ? 14 : 24, { size, bold: true });
  label(ctx, small ? "Súng trên giá trượt không ma sát. Hình không theo tỉ lệ." : "Súng đặt trên giá trượt không ma sát, ban đầu đứng yên. Hình không theo tỉ lệ (quãng đường của súng được phóng to).", 12, small ? 32 : 48, { size: small ? 10 : 12, color: COLORS.muted });
  const floor = H * (small ? 0.55 : 0.5);
  const gw = clamp(W * 0.3, 110, 240);
  const gx0 = W * 0.42;
  const shift = clamp(v1 * t * 40, -gx0 + gw + 6, 0); // drawn displacement of the gun
  const gx = gx0 + shift; // muzzle
  const gh = gw * 0.16;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, floor);
  ctx.lineTo(W - 8, floor);
  ctx.stroke();
  // sled, body, barrel, stock
  ctx.fillStyle = "#cdd5e4";
  ctx.fillRect(gx - gw, floor - 10, gw * 0.9, 10);
  ctx.fillStyle = "#3a4560";
  const by = floor - 10 - gh * 1.6;
  ctx.fillRect(gx - gw * 0.55, by - gh * 0.3, gw * 0.55, gh * 0.6); // barrel
  ctx.fillRect(gx - gw * 0.8, by - gh * 0.5, gw * 0.3, gh * 1.2); // body
  ctx.beginPath();
  ctx.moveTo(gx - gw * 0.8, by - gh * 0.4);
  ctx.lineTo(gx - gw, by + gh * 0.2);
  ctx.lineTo(gx - gw, by + gh * 1.1);
  ctx.lineTo(gx - gw * 0.8, by + gh * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(gx - gw * 0.72, by + gh * 0.7, gw * 0.08, floor - 10 - by - gh * 0.7);
  label(ctx, `m₁ = ${fmt(s.gunMass, 1)} kg`, gx - gw * 0.55, floor + 14, { align: "center", size: small ? 11 : 13 });
  // bullet
  const bx = gx + 4 + t * W * 0.8;
  if (bx < W + 20) {
    ctx.fillStyle = "#b8862b";
    ctx.beginPath();
    ctx.moveTo(bx, by - 4);
    ctx.lineTo(bx + 12, by - 4);
    ctx.arc(bx + 12, by, 4, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(bx, by + 4);
    ctx.closePath();
    ctx.fill();
  }
  label(ctx, `m₂ = ${fmt(s.bulletMass, 0)} g`, clamp(bx + 8, 50, W - 50), by - 18, { align: "center", size: small ? 11 : 13 });

  // momentum arrows: equal length, opposite directions
  const ay = floor + (small ? 40 : 56);
  const L = Math.min(W * 0.3, 60 + 3 * p2);
  if (s.launched) {
    arrow(ctx, W / 2, ay, W / 2 - L, ay, COLORS.red, 3);
    arrow(ctx, W / 2, ay, W / 2 + L, ay, COLORS.blue, 3);
    label(ctx, `p₁ = m₁v₁ = ${fmt(s.gunMass * v1, 2)}`, W / 2 - 6, ay - 14, { align: "right", color: COLORS.red, size: small ? 11 : 13, bold: true });
    label(ctx, `p₂ = m₂v₂ = ${fmt(p2, 2)}`, W / 2 + 6, ay - 14, { color: COLORS.blue, size: small ? 11 : 13, bold: true });
    label(ctx, `v₁ = ${fmt(v1, 2)} m/s     v₂ = ${fmt(s.bulletSpeed, 0)} m/s     p₁ + p₂ = ${fmt(s.gunMass * v1 + p2, 2)} kg·m/s`, W / 2, ay + 22, { align: "center", size: small ? 10 : 13 });
  } else {
    label(ctx, "Trước khi bắn: súng và đạn đứng yên, tổng động lượng bằng 0. Bấm “Bắn”.", W / 2, ay, { align: "center", size: small ? 10 : 13, color: COLORS.muted });
  }
}

mount({
  slug: "ten-lua",
  version: "1.0.0",
  title: "Chuyển động bằng phản lực",
  hint: "Bấm “Phóng” để tên lửa phụt khí; chọn “Súng giật” để xem chuyển động bằng phản lực đơn giản nhất.",
  initialState,
  timeScale: s => (rocketOnly(s) ? Math.max(1, burnTime(s) / 8) : 1),
  step(s, dt, api) {
    if (s.done) return api.pause();
    if (!s.launched) launch(s, api);
    if (recoilOnly(s)) {
      s.time = clamp(s.time + dt, 0, RECOIL_SHOW);
      if (s.time >= RECOIL_SHOW) (s.done = true), api.pause();
      return;
    }
    stepRocket(s, dt);
    s._scroll = ((s._scroll ?? 0) + dt * (s.v / Math.max(vFinal(s), 1)) * 2400) % 1e6;
    s._trail ??= [];
    const lastT = s._trail.at(-1)?.[0] ?? -1;
    if (s.time - lastT > burnTime(s) / 120) s._trail.push([s.time, s.v]);
    if (s.done) {
      api.emit("burnout", { finalSpeed: s.v, formulaSpeed: formulaSpeed(s), burnTime: burnTime(s), exhaustSpeed: s.exhaustSpeed, massRatio: m0(s) / s.dryMass, gravity: gOf(s), height: s.x }, "result");
      api.pause();
    }
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Thí nghiệm",
      options: [
        { value: "rocket", label: "Tên lửa phụt khí" },
        { value: "recoil", label: "Súng giật khi bắn" },
      ],
      onChange: clear,
    },
    { type: "button", label: "Phóng", primary: true, action: (s, api) => (launch(s, api), api.play()), visible: rocketOnly },
    { type: "slider", key: "dryMass", label: "Khối lượng vỏ tên lửa", min: 200, max: 3000, step: 50, unit: "kg", digits: 0, onChange: clear, visible: rocketOnly },
    { type: "slider", key: "fuelMass", label: "Khối lượng nhiên liệu", min: 500, max: 9000, step: 100, unit: "kg", digits: 0, onChange: clear, visible: rocketOnly },
    { type: "slider", key: "exhaustSpeed", label: "Tốc độ khí phụt u", min: 500, max: 4500, step: 100, unit: "m/s", digits: 0, onChange: clear, visible: rocketOnly },
    { type: "slider", key: "massFlow", label: "Lưu lượng khí μ", min: 10, max: 500, step: 10, unit: "kg/s", digits: 0, onChange: clear, visible: rocketOnly },
    { type: "checkbox", key: "gravity", label: "Phóng từ mặt đất (có trọng lực)", onChange: clear, visible: rocketOnly },
    { type: "stepper", key: "bursts", label: "Số lượt phụt N (tính từng phần)", min: 1, max: 50, visible: rocketOnly },
    { type: "button", label: "Bắn", primary: true, action: (s, api) => (launch(s, api), api.play()), visible: recoilOnly },
    { type: "slider", key: "gunMass", label: "Khối lượng súng m₁", min: 1, max: 10, step: 0.5, unit: "kg", digits: 1, onChange: clear, visible: recoilOnly },
    { type: "slider", key: "bulletMass", label: "Khối lượng đạn m₂", min: 2, max: 50, step: 1, unit: "g", digits: 0, onChange: clear, visible: recoilOnly },
    { type: "slider", key: "bulletSpeed", label: "Vận tốc đạn v₂", min: 100, max: 1000, step: 10, unit: "m/s", digits: 0, onChange: clear, visible: recoilOnly },
  ],
  readouts: [
    { label: "Thời gian", value: s => `${fmt(s.time, 1)} s` },
    { label: "Vận tốc tên lửa / súng", value: s => `${fmt(rocketOnly(s) ? s.v : s.launched ? recoilSpeed(s) : 0, rocketOnly(s) ? 0 : 2)} m/s` },
    { label: "Nhiên liệu còn lại", value: s => (rocketOnly(s) ? `${fmt(fuelLeft(s), 0)} kg` : "–") },
    { label: "Lực đẩy F = u·μ", value: s => (rocketOnly(s) ? `${fmt(thrust(s) / 1000, 1)} kN` : "–") },
    { label: "Trọng lượng P = m·g", value: s => (rocketOnly(s) && s.gravity ? `${fmt((mass(s) * G) / 1000, 1)} kN` : "–") },
    { label: "Δv = u·ln(m₀/m)", value: s => (rocketOnly(s) ? `${fmt(formulaSpeed(s), 0)} m/s` : "–") },
    {
      label: "Δv khi phụt hết trong N lượt",
      value: s => (rocketOnly(s) ? `${fmt(burstSpeed(s.exhaustSpeed, m0(s), s.fuelMass, s.bursts), 0)} m/s (N = ${s.bursts})` : "–"),
    },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    if (recoilOnly(s)) return drawRecoil(ctx, s, view, g.small);
    drawRocketScene(ctx, s, g);
    const r = g.right;
    const pad = g.small ? 8 : 16;
    const showBars = view.h >= 300;
    const barsH = showBars ? (g.small ? 96 : 130) : 0;
    const head = g.small ? 34 : 52;
    label(ctx, "Δv = u·ln(m₀/m)", r.x + pad, g.small ? 12 : 20, { size: g.small ? 12 : 16, bold: true });
    label(ctx, `= ${fmt(s.exhaustSpeed, 0)}·ln(${fmt(m0(s), 0)}/${fmt(mass(s), 0)}) = ${fmt(formulaSpeed(s), 0)} m/s`, r.x + pad, g.small ? 26 : 40, { size: g.small ? 10 : 13, color: COLORS.muted });
    drawGraph(ctx, s, { x: r.x + pad, y: head, w: r.w - 2 * pad, h: r.h - head - barsH - pad }, g.small);
    if (showBars) drawMomentum(ctx, s, { x: r.x + pad, y: r.h - barsH - 4, w: r.w - 2 * pad, h: barsH }, g.small);
  },
});
