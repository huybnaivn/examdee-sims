import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  initialState, C_WATER, BOIL, PRESETS, PRICE_KWH, GAS_PRICE, heatNeeded, boilTime, elapsed, tempAt, boiled,
  energySupplied, toKwh, gasMass, cost, summary, other, restart, step, predictionOk,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SPEED = 60; // one real second shows one minute of heating
const NAMES = { kettle: "Ấm điện", gas: "Bếp gas" };
const isGas = s => s.appliance === "gas";
const kJ = j => `${fmt(j / 1000, 1)} kJ`;
const dur = t => (t < 60 ? `${fmt(t, 0)} giây` : `${Math.floor(Math.round(t) / 60)} phút ${Math.round(t) % 60} giây`);
const dong = d => `${fmt(d, 0)} đ`;

// First of the candidate texts that fits maxW (the last one is used when none fits).
function fit(ctx, texts, maxW, size, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  return texts.find(t => ctx.measureText(t).width <= maxW) ?? texts.at(-1);
}

function drawScene(ctx, s, g) {
  const { sw, small, h } = g;
  const t = elapsed(s);
  const temp = tempAt(s, t);
  const heating = t > 0 && !boiled(s);
  const size = small ? 11 : 14;
  label(ctx, small || t < 60 ? `Đã đun ${fmt(t, 0)} s` : `Đã đun ${fmt(t, 0)} s (${dur(t)})`, sw / 2, small ? 11 : 20, { size, align: "center", color: COLORS.muted });
  label(ctx, `${fmt(temp, 1)} °C`, sw / 2, small ? 29 : 48, { size: small ? 17 : 26, align: "center", bold: true, color: temp >= BOIL ? COLORS.red : COLORS.ink });
  label(ctx, small ? "1 s thực = 1 phút đun" : "1 giây thực = 1 phút đun nước", sw / 2, h - 9, { size: small ? 10 : 12, align: "center", color: COLORS.muted });

  const hz = small ? 30 : 56; // heater zone under the kettle
  const top = small ? 64 : 110; // highest the kettle shoulder may go
  const low = h - (small ? 34 : 46) - hz; // lowest the kettle bottom may go
  const kw = Math.min(sw * 0.46, (low - top) * 1.1);
  const kh = Math.min(low - top, kw * 1.1);
  const yb = low - (low - top - kh) / 2; // kettle and heater centred in the free height
  const yt = yb - kh;
  const cx = sw * 0.5;

  // heat source
  if (isGas(s)) {
    const n = 5;
    const fh = hz * 0.5 * (0.55 + (0.45 * (s.power - 800)) / 1700);
    ctx.fillStyle = heating ? COLORS.blue : "#b9cdf7";
    for (let i = 0; i < n; i++) {
      const x = cx + (kw * 0.7 * (i - (n - 1) / 2)) / (n - 1);
      ctx.beginPath();
      ctx.moveTo(x - kw * 0.06, yb + hz * 0.55);
      ctx.quadraticCurveTo(x - kw * 0.07, yb + hz * 0.55 - fh * 0.5, x, yb + hz * 0.55 - fh);
      ctx.quadraticCurveTo(x + kw * 0.07, yb + hz * 0.55 - fh * 0.5, x + kw * 0.06, yb + hz * 0.55);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(cx - kw * 0.5, yb + hz * 0.55, kw, hz * 0.3);
    ctx.fillRect(cx - kw * 0.62, yb + 1, kw * 0.06, hz * 0.55); // pan supports
    ctx.fillRect(cx + kw * 0.56, yb + 1, kw * 0.06, hz * 0.55);
  } else {
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.roundRect(cx - kw * 0.58, yb + 2, kw * 1.16, hz * 0.4, 4);
    ctx.fill();
    ctx.fillStyle = heating ? COLORS.orange : COLORS.muted; // heating element
    ctx.fillRect(cx - kw * 0.42, yb + 2, kw * 0.84, Math.max(3, hz * 0.1));
    ctx.strokeStyle = COLORS.ink; // cable
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + kw * 0.58, yb + hz * 0.25);
    ctx.bezierCurveTo(cx + kw * 0.8, yb + hz * 0.25, cx + kw * 0.7, yb + hz * 0.75, cx + kw * 0.95, yb + hz * 0.7);
    ctx.stroke();
  }
  label(ctx, `${NAMES[isGas(s) ? "gas" : "kettle"]} · ${fmt(s.power, 0)} W`, sw / 2, yb + hz + (small ? 6 : 10), { size: small ? 11 : 14, align: "center", bold: true });

  // kettle body (cutaway), wider at the bottom
  const body = new Path2D();
  body.moveTo(cx - kw * 0.36, yt);
  body.lineTo(cx + kw * 0.36, yt);
  body.quadraticCurveTo(cx + kw * 0.5, yt + kh * 0.5, cx + kw * 0.5, yb);
  body.lineTo(cx - kw * 0.5, yb);
  body.quadraticCurveTo(cx - kw * 0.5, yt + kh * 0.5, cx - kw * 0.36, yt);
  body.closePath();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath(); // spout
  ctx.moveTo(cx - kw * 0.46, yt + kh * 0.45);
  ctx.lineTo(cx - kw * 0.72, yt + kh * 0.08);
  ctx.lineTo(cx - kw * 0.6, yt + kh * 0.05);
  ctx.lineTo(cx - kw * 0.41, yt + kh * 0.25);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.stroke();
  ctx.beginPath(); // handle over the lid
  ctx.ellipse(cx, yt, kw * 0.3, Math.min(kh * 0.3, yt - (small ? 42 : 68), kw * 0.3), 0, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  const level = yb - kh * (0.25 + (0.65 * (s.mass - 0.5)) / 2.5);
  const f = clamp((temp - 10) / 90, 0, 1); // cold blue to hot red
  ctx.fillStyle = `rgba(${Math.round(47 + 182 * f)}, ${Math.round(111 - 39 * f)}, ${Math.round(237 - 160 * f)}, 0.6)`;
  ctx.fillRect(cx - kw, level, 2 * kw, yb - level);
  // bubbles from about 50 °C, more of them near the boil
  const count = Math.round(16 * clamp((temp - 50) / 50, 0, 1));
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < count; i++) {
    const u = (i * 0.618) % 1;
    const v = (i * 0.37 + t / SPEED) % 1;
    ctx.beginPath();
    ctx.arc(cx + (u - 0.5) * kw * 0.8, yb - 4 - v * (yb - level - 8), 1.5 + (i % 3), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.stroke(body);
  ctx.fillStyle = COLORS.ink; // lid knob
  ctx.fillRect(cx - kw * 0.06, yt - 6, kw * 0.12, 6);
  if (temp >= BOIL) {
    // steam
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const x = cx - kw * 0.66 - i * 7;
      const y = yt + kh * 0.02 - i * 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - 8, y - 8, x + 6, y - 14, x - 3, y - 24);
      ctx.stroke();
    }
  }
  // wasted heat leaves for the surroundings
  if (t > 0 && s.efficiency < 100) {
    const len = (small ? 16 : 26) + ((100 - s.efficiency) / 60) * (small ? 14 : 30);
    arrow(ctx, cx - kw * 0.58, yb - 2, cx - kw * 0.58 - len * 0.8, yb - 2 - len * 0.45, COLORS.orange, 2.5);
    if (!small) label(ctx, "hao phí", cx - kw * 0.58 - len * 0.8, yb - len * 0.45 - 14, { size: 12, color: COLORS.orange, align: "center" });
  }

  // thermometer, 0–100 °C
  const tx = sw - (small ? 12 : 26);
  const y100 = yt;
  const y0 = yb - 6;
  const ty = c => y0 + ((y100 - y0) * c) / 100;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(tx - 4, y100 - 8, 8, y0 - y100 + 14, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(tx - 2, ty(temp), 4, y0 - ty(temp) + 6);
  ctx.beginPath();
  ctx.arc(tx, y0 + 10, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let c = 0; c <= 100; c += 10) {
    ctx.beginPath();
    ctx.moveTo(tx - 5, ty(c));
    ctx.lineTo(tx - (c % 50 === 0 ? 11 : 8), ty(c));
    ctx.stroke();
    if (c % 50 === 0) label(ctx, String(c), tx - 13, ty(c), { size: small ? 9 : 11, align: "right", color: COLORS.muted });
  }
}

function drawGraph(ctx, s, g, x, y, w, h) {
  const end = boilTime(s);
  const t = elapsed(s);
  const tMax = [300, 600, 1200, 1800, 3600].find(v => v >= end) ?? 3600; // coarse, so the axis does not give the answer away
  const x0 = x + 30;
  const x1 = x + w - 30;
  const y0 = y + h - 18;
  const y1 = y + 24;
  const px = v => x0 + ((x1 - x0) * v) / tMax;
  const py = c => y0 + ((y1 - y0) * c) / 100;
  const size = g.small ? 9 : 11;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let c = 0; c <= 100; c += 25) {
    ctx.beginPath();
    ctx.moveTo(x0, py(c));
    ctx.lineTo(x1, py(c));
    ctx.stroke();
    if (c % 50 === 0) label(ctx, String(c), x0 - 5, py(c), { size, align: "right", color: COLORS.muted });
  }
  for (let k = 0; k <= 5; k++) {
    const v = (tMax * k) / 5;
    ctx.beginPath();
    ctx.moveTo(px(v), y0);
    ctx.lineTo(px(v), y1);
    ctx.stroke();
    label(ctx, fmt(v / 60, 0), px(v), y0 + 9, { size, align: "center", color: COLORS.muted });
  }
  label(ctx, "°C", x0 - 5, y1 - 15, { size, align: "right", color: COLORS.muted });
  label(ctx, "phút", x1 + 4, y0, { size, color: COLORS.muted });
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.stroke();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = COLORS.red;
  ctx.beginPath();
  ctx.moveTo(x0, py(BOIL));
  ctx.lineTo(x1, py(BOIL));
  ctx.stroke();
  if (s.guess > 0 && s.guess <= tMax) {
    ctx.strokeStyle = COLORS.purple;
    ctx.beginPath();
    ctx.moveTo(px(s.guess), y0);
    ctx.lineTo(px(s.guess), y1);
    ctx.stroke();
    label(ctx, "dự đoán", px(s.guess) + (s.guess > tMax * 0.7 ? -4 : 4), y0 - 8, { size, color: COLORS.purple, align: s.guess > tMax * 0.7 ? "right" : "left" });
  }
  ctx.setLineDash([]);
  label(ctx, g.small ? "sôi" : "100 °C: nước sôi", x1 - 2, py(BOIL) + 9, { size, color: COLORS.red, align: "right" });
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(px(0), py(s.startTemp));
  ctx.lineTo(px(t), py(tempAt(s, t)));
  ctx.stroke();
  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.arc(px(t), py(tempAt(s, t)), 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawTable(ctx, s, x, y, w, rowH) {
  const done = boiled(s);
  const row = (st, known) => {
    const r = summary(st);
    return [
      `${NAMES[st.appliance === "gas" ? "gas" : "kettle"]} ${fmt(st.power, 0)} W`,
      `${fmt(st.efficiency, 0)} %`,
      known ? `${fmt(r.time, 0)} s` : "?",
      known ? `${fmt(r.kwh, 3)} kW·h` : "?",
      known ? dong(r.cost) : "?",
    ];
  };
  const rows = [["Thiết bị", "H", "Thời gian", "Năng lượng", "Chi phí"], row(s, done), row(other(s), true)];
  const first = w * 0.3;
  const cw = (w - first) / 4;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, rowH * 3);
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(x, y, w, rowH);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, rowH * 3);
  ctx.beginPath();
  ctx.moveTo(x, y + 2 * rowH);
  ctx.lineTo(x + w, y + 2 * rowH);
  ctx.stroke();
  rows.forEach((cells, r) =>
    cells.forEach((text, c) => {
      const opt = { size: 13, bold: r === 0 || (r === 1 && c > 0), color: r === 1 ? COLORS.blue : r === 0 ? COLORS.muted : COLORS.ink };
      if (c === 0) label(ctx, text, x + 8, y + rowH * (r + 0.5), opt);
      else label(ctx, text, x + first + cw * (c - 0.5), y + rowH * (r + 0.5), { ...opt, align: "center" });
    })
  );
  label(ctx, fit(ctx, [`Đun cùng lượng nước; dòng dưới là thiết bị kia ở mức điển hình. Giá minh họa: điện ${fmt(PRICE_KWH, 0)} đ/kW·h, gas ${fmt(GAS_PRICE, 0)} đ/kg.`, `Giá minh họa: điện ${fmt(PRICE_KWH, 0)} đ/kW·h, gas ${fmt(GAS_PRICE, 0)} đ/kg.`], w, 12), x, y + rowH * 3 + 12, { size: 12, color: COLORS.muted });
}

mount({
  slug: "dun-nuoc-hieu-suat",
  version: "1.0.0",
  title: "Nhiệt lượng và hiệu suất đun nước",
  hint: "Tính trước thời gian đun sôi, kéo thanh dự đoán rồi bấm Chạy để kiểm tra.",
  initialState,
  timeScale: () => SPEED,
  step(s, dt, api) {
    if (!step(s, dt)) return;
    api.pause();
    const r = summary(s);
    api.emit("boiled", { time: r.time, energyKwh: r.kwh, efficiency: s.efficiency, heat: r.heat, cost: r.cost }, "result");
    if (predictionOk(s.guess, r.time)) api.emit("prediction-correct", { guess: s.guess, time: r.time }, "goal");
  },
  controls: [
    {
      type: "select",
      key: "appliance",
      label: "Thiết bị đun",
      options: [
        { value: "kettle", label: "Ấm điện" },
        { value: "gas", label: "Bếp gas" },
      ],
      onChange: s => restart(Object.assign(s, PRESETS[s.appliance])),
    },
    { type: "slider", key: "mass", label: "Khối lượng nước m", min: 0.5, max: 3, step: 0.1, unit: "kg", digits: 1, onChange: restart },
    { type: "slider", key: "startTemp", label: "Nhiệt độ ban đầu t₁", min: 10, max: 40, step: 1, unit: "°C", digits: 0, onChange: restart },
    { type: "slider", key: "power", label: "Công suất P", min: 800, max: 2500, step: 100, unit: "W", digits: 0, onChange: restart },
    { type: "slider", key: "efficiency", label: "Hiệu suất H", min: 40, max: 100, step: 5, unit: "%", digits: 0, onChange: restart },
    {
      type: "slider",
      key: "guess",
      label: "Dự đoán thời gian sôi",
      min: 0,
      max: 3600,
      step: 10,
      format: v => (v ? `${fmt(v, 0)} s` : "chưa đoán"),
      disabled: s => elapsed(s) > 0 && !boiled(s),
    },
  ],
  readouts: [
    { label: "Nhiệt lượng nước cần thu Q", value: s => kJ(heatNeeded(s.mass, s.startTemp)) },
    { label: "Năng lượng đã cung cấp", value: s => `${fmt(toKwh(energySupplied(s, elapsed(s))), 3)} kW·h` },
    { label: "Chi phí (giá minh họa)", value: s => dong(cost(s.appliance, energySupplied(s, elapsed(s)))) },
    { label: "Thời gian đun sôi", value: s => (boiled(s) ? `${fmt(boilTime(s), 0)} s` : "?") },
    {
      label: "Dự đoán của em",
      value: s => (!s.guess ? "–" : !boiled(s) ? `${fmt(s.guess, 0)} s` : predictionOk(s.guess, boilTime(s)) ? "đúng" : `lệch ${fmt(Math.abs(s.guess - boilTime(s)), 0)} s`),
    },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 420;
    const sw = small ? view.w * 0.4 : Math.min(view.w * 0.42, 400);
    const g = { small, sw, h: view.h };
    drawScene(ctx, s, g);

    const x = sw + (small ? 6 : 22);
    const w = view.w - x - 10;
    const size = small ? 11 : 14;
    const lh = small ? 16 : 24;
    const t = elapsed(s);
    const r = summary(s);
    const used = energySupplied(s, t);
    const H = s.efficiency / 100;
    const dT = `(${BOIL} − ${fmt(s.startTemp, 0)})`;
    let y = small ? 10 : 20;
    const line = (texts, color = COLORS.ink) => {
      label(ctx, fit(ctx, texts, w, size), x, y, { size, color });
      y += lh;
    };
    line([`Nhiệt lượng nước thu vào: Q = m·c·Δt = ${fmt(s.mass, 1)} × ${fmt(C_WATER, 0)} × ${dT} = ${fmt(r.heat, 0)} J`, `Nước thu vào: Q = m·c·Δt = ${fmt(s.mass, 1)} × ${fmt(C_WATER, 0)} × ${dT} = ${fmt(r.heat, 0)} J`, `Q = m·c·Δt = ${fmt(s.mass, 1)} × ${fmt(C_WATER, 0)} × ${dT} = ${fmt(r.heat, 0)} J`, `Q = m·c·Δt = ${kJ(r.heat)}`]);
    line(
      isGas(s)
        ? [`Nhiệt lượng bếp tỏa ra: Qtp = P·t = ${fmt(s.power, 0)} × ${fmt(t, 0)} = ${fmt(used, 0)} J (đốt ${fmt(gasMass(used) * 1000, 1)} g gas)`, `Bếp tỏa ra: Qtp = P·t = ${fmt(s.power, 0)} × ${fmt(t, 0)} = ${fmt(used, 0)} J (${fmt(gasMass(used) * 1000, 1)} g gas)`, `Qtp = P·t = ${kJ(used)} (${fmt(gasMass(used) * 1000, 1)} g gas)`, `Qtp = P·t = ${kJ(used)}`]
        : [`Điện năng tiêu thụ: A = P·t = ${fmt(s.power, 0)} × ${fmt(t, 0)} = ${fmt(used, 0)} J = ${fmt(toKwh(used), 3)} kW·h`, `A = P·t = ${fmt(used, 0)} J = ${fmt(toKwh(used), 3)} kW·h`, `A = P·t = ${fmt(toKwh(used), 3)} kW·h`],
      COLORS.ink
    );
    const total = isGas(s) ? "Qtp" : "A";
    line(
      boiled(s)
        ? [`Thời gian đun sôi: t = Q/(H·P) = ${fmt(r.heat, 0)}/(${fmt(H, 2)} × ${fmt(s.power, 0)}) = ${fmt(r.time, 0)} s (${dur(r.time)})`, `t = Q/(H·P) = ${fmt(r.time, 0)} s (${dur(r.time)})`, `t = Q/(H·P) = ${fmt(r.time, 0)} s`]
        : [`Hiệu suất H = Q/${total} = ${fmt(s.efficiency, 0)} %  ⇒  thời gian đun sôi t = Q/(H·P) = ?`, `H = Q/${total} = ${fmt(s.efficiency, 0)} %  ⇒  t = Q/(H·P) = ?`, `t = Q/(H·P) = ?`],
      boiled(s) ? COLORS.green : COLORS.blue
    );

    // energy supplied so far, split into the useful share H and the wasted share 1 − H
    const bh = small ? 14 : 20;
    const p = r.time > 0 ? t / r.time : 0;
    y += small ? 0 : 4;
    ctx.fillStyle = "#dff3ea";
    ctx.fillRect(x, y, w * H, bh);
    ctx.fillStyle = "#fde9d3";
    ctx.fillRect(x + w * H, y, w * (1 - H), bh);
    ctx.fillStyle = COLORS.green;
    ctx.fillRect(x, y, w * H * p, bh);
    ctx.fillStyle = COLORS.orange;
    ctx.fillRect(x + w * H, y, w * (1 - H) * p, bh);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, bh);
    y += bh + (small ? 10 : 14);
    label(ctx, fit(ctx, [`Nước thu vào (có ích): ${kJ(used * H)}`, `Có ích: ${kJ(used * H)}`], w * 0.55, size), x, y, { size, color: COLORS.green });
    label(ctx, fit(ctx, [`Hao phí ra môi trường: ${kJ(used * (1 - H))}`, `Hao phí: ${kJ(used * (1 - H))}`], w * 0.45, size), x + w, y, { size, color: COLORS.orange, align: "right" });
    y += small ? 10 : 18;

    // the comparison table is secondary: it is dropped when the graph would get too little room
    const rowH = 26;
    const table = !small && w >= 380 && view.h - y - (rowH * 3 + 34) >= 150;
    const bottom = table ? view.h - rowH * 3 - 34 : view.h - 4;
    if (bottom - y >= 70) drawGraph(ctx, s, g, x, y, w, bottom - y);
    if (table) drawTable(ctx, s, x, bottom + 8, w, rowH);
  },
});
