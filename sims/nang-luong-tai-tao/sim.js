import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, outputs, windPower } from "./model.js";

const RAD = Math.PI / 180;
const PANEL_TILT = 30; // ° from horizontal, only for the picture
const V_MAX = 15;

const report = (s, api) => {
  const o = outputs(s);
  api.emit("energy-output", { solarPower: o.solarW, windPower: o.windW, solarKWh: o.solarKWh, windKWh: o.windKWh, total: o.total, need: s.need }, "result");
  const met = o.total >= s.need;
  if (met && !s.goalMet) api.emit("need-met", { total: o.total, need: s.need }, "goal");
  s.goalMet = met;
};

const watts = w => (w >= 1000 ? `${fmt(w / 1000, 2)} kW` : `${fmt(w, 0)} W`);

function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const barH = small ? 58 : 86;
  const colW = view.w / 2;
  const top = small ? 4 : 10;
  const h = view.h - barH - top;
  return {
    small,
    solar: { x: 0, y: top, w: colW, h },
    wind: { x: colW, y: top, w: colW, h },
    bar: { x: small ? 10 : 24, y: view.h - barH, w: view.w - (small ? 20 : 48), h: barH },
  };
}

function drawSolar(ctx, s, g, o) {
  const b = g.solar;
  const size = g.small ? 10 : 13;
  label(ctx, "Pin mặt trời", b.x + b.w / 2, b.y + (g.small ? 9 : 14), { size: g.small ? 12 : 16, bold: true, align: "center" });
  const textH = g.small ? 30 : 46;
  const groundY = b.y + b.h - textH - 6;
  const cx = b.x + b.w * 0.6;
  const H = groundY - b.y - (g.small ? 20 : 30);
  const L = Math.min(b.w * 0.55, H * 0.6) * (0.45 + 0.55 * Math.sqrt(s.area / 40)); // drawn size grows with A
  const cy = groundY - Math.max(14, H * 0.22);

  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x + 8, groundY);
  ctx.lineTo(b.x + b.w - 8, groundY);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, groundY);
  ctx.stroke();

  // panel faces up-left; normal points away from the panel surface
  const t = PANEL_TILT * RAD;
  const u = { x: Math.cos(t), y: -Math.sin(t) }; // along the panel, rising to the right (screen y is down)
  const n = { x: -Math.sin(t), y: -Math.cos(t) }; // up-left
  ctx.strokeStyle = "#1d3b7a";
  ctx.lineWidth = g.small ? 6 : 9;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(cx - (u.x * L) / 2, cy - (u.y * L) / 2);
  ctx.lineTo(cx + (u.x * L) / 2, cy + (u.y * L) / 2);
  ctx.stroke();
  ctx.strokeStyle = "#8fb3f5";
  ctx.lineWidth = 1;
  for (let k = 1; k < 6; k++) {
    const f = k / 6 - 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + u.x * L * f + n.x * 4, cy + u.y * L * f + n.y * 4);
    ctx.lineTo(cx + u.x * L * f - n.x * 4, cy + u.y * L * f - n.y * 4);
    ctx.stroke();
  }

  // normal and sun rays at angle θ to it
  const R = Math.min(b.w * 0.5, (cy - b.y) * 0.8);
  ctx.strokeStyle = COLORS.muted;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + n.x * R, cy + n.y * R);
  ctx.stroke();
  ctx.setLineDash([]);
  const th = s.sunAngle * RAD;
  // the Sun sits at angle θ from the normal, turned towards the left
  const a0 = Math.atan2(n.y, n.x);
  const a1 = a0 - th;
  const d = { x: Math.cos(a1), y: Math.sin(a1) };
  const sun = { x: cx + d.x * R, y: cy + d.y * R };
  ctx.fillStyle = COLORS.yellow;
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, g.small ? 9 : 14, 0, Math.PI * 2);
  ctx.fill();
  for (const off of [-0.25, 0, 0.25]) {
    const ox = u.x * L * off;
    const oy = u.y * L * off;
    arrow(ctx, sun.x + ox - d.x * 14, sun.y + oy - d.y * 14, cx + ox + d.x * 6, cy + oy + d.y * 6, COLORS.orange, 2);
  }
  // θ arc between the normal and the rays
  ctx.strokeStyle = COLORS.purple;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.32, Math.min(a0, a1), Math.max(a0, a1));
  ctx.stroke();
  const am = (a0 + a1) / 2;
  label(ctx, `θ = ${fmt(s.sunAngle, 0)}°`, cx + Math.cos(am) * R * 0.32 - 4, cy + Math.sin(am) * R * 0.32 - 10, { size, color: COLORS.purple, bold: true, align: "right" });

  const ty = b.y + b.h - textH;
  label(ctx, g.small ? `P = ${watts(o.solarW)}` : `P = η·G·A·cos θ = ${watts(o.solarW)}`, b.x + b.w / 2, ty + 6, { size: g.small ? 11 : 14, bold: true, align: "center", color: COLORS.orange });
  label(ctx, `${fmt(o.solarKWh, 2)} kWh/ngày`, b.x + b.w / 2, ty + (g.small ? 20 : 28), { size, align: "center" });
}

function drawWind(ctx, s, g, o) {
  const b = g.wind;
  const size = g.small ? 10 : 13;
  label(ctx, "Tua-bin gió", b.x + b.w / 2, b.y + (g.small ? 9 : 14), { size: g.small ? 12 : 16, bold: true, align: "center" });
  const textH = g.small ? 30 : 46;
  const groundY = b.y + b.h - textH - 6;
  const avail = groundY - b.y - (g.small ? 22 : 34);
  const maxR = Math.min(b.w * 0.3, avail * 0.42);
  const R = maxR * (0.3 + 0.7 * (s.blade / 5));
  const hub = { x: b.x + b.w * 0.58, y: groundY - avail * 0.55 };

  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x + 8, groundY);
  ctx.lineTo(b.x + b.w - 8, groundY);
  ctx.stroke();
  ctx.strokeStyle = "#9aa6bd";
  ctx.lineWidth = g.small ? 4 : 6;
  ctx.beginPath();
  ctx.moveTo(hub.x, hub.y);
  ctx.lineTo(hub.x, groundY);
  ctx.stroke();

  // swept circle
  ctx.strokeStyle = "rgba(47,111,237,0.35)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(hub.x, hub.y, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const rot = s._rot ?? 0.3;
  ctx.fillStyle = "#e8edf6";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    const a = rot + (k * 2 * Math.PI) / 3;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const w = Math.max(3, R * 0.09);
    ctx.beginPath();
    ctx.moveTo(hub.x - sn * w, hub.y + c * w);
    ctx.lineTo(hub.x + c * R, hub.y + sn * R);
    ctx.lineTo(hub.x + sn * w, hub.y - c * w);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(hub.x, hub.y, Math.max(3, R * 0.07), 0, Math.PI * 2);
  ctx.fill();
  label(ctx, `R = ${fmt(s.blade, 1)} m`, hub.x + 6, hub.y + R + 10, { size, color: COLORS.blue });

  // wind arrows, length ∝ v
  const len = (s.windSpeed / V_MAX) * Math.max(20, hub.x - R - b.x - 14);
  for (const k of [-0.5, 0, 0.5]) if (len > 4) arrow(ctx, b.x + 6, hub.y + k * R, b.x + 6 + len, hub.y + k * R, "rgba(31,157,107,0.8)", 2);
  label(ctx, `v = ${fmt(s.windSpeed, 1)} m/s`, b.x + 6, hub.y - R * 0.5 - 12, { size, color: COLORS.green, bold: true });

  // cube law inset: P against v for these blades
  if (b.w >= 250 && avail > 150) {
    const ib = { x: b.x + b.w - 116, y: b.y + 30, w: 100, h: 62 };
    ctx.fillStyle = "#fff";
    ctx.fillRect(ib.x, ib.y, ib.w, ib.h);
    ctx.strokeStyle = COLORS.grid;
    ctx.strokeRect(ib.x, ib.y, ib.w, ib.h);
    const pmax = windPower(s.blade, V_MAX, s.cp) || 1;
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let v = 0; v <= V_MAX; v += 0.5) {
      const x = ib.x + (v / V_MAX) * ib.w;
      const y = ib.y + ib.h - (windPower(s.blade, v, s.cp) / pmax) * ib.h;
      v ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.arc(ib.x + (s.windSpeed / V_MAX) * ib.w, ib.y + ib.h - (o.windW / pmax) * ib.h, 3.5, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, "P ~ v³", ib.x + 4, ib.y + 9, { size: 11, color: COLORS.muted, bold: true });
    label(ctx, "v", ib.x + ib.w - 4, ib.y + ib.h + 8, { size: 11, color: COLORS.muted, align: "right" });
  }

  const ty = b.y + b.h - textH;
  label(ctx, g.small ? `P = ${watts(o.windW)}` : `P = ½ρπR²v³·Cp = ${watts(o.windW)}`, b.x + b.w / 2, ty + 6, { size: g.small ? 11 : 14, bold: true, align: "center", color: COLORS.blue });
  label(ctx, `${fmt(o.windKWh, 2)} kWh/ngày`, b.x + b.w / 2, ty + (g.small ? 20 : 28), { size, align: "center" });
}

function drawBar(ctx, s, g, o) {
  const b = g.bar;
  const size = g.small ? 11 : 13;
  const barY = b.y + (g.small ? 18 : 30);
  const barH = g.small ? 16 : 22;
  const max = Math.max(s.need * 1.5, o.total * 1.1);
  const X = e => b.x + (e / max) * b.w;
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(b.x, barY, b.w, barH);
  ctx.fillStyle = COLORS.orange;
  ctx.fillRect(b.x, barY, X(o.solarKWh) - b.x, barH);
  ctx.fillStyle = COLORS.blue;
  ctx.fillRect(X(o.solarKWh), barY, X(o.total) - X(o.solarKWh), barH);
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(X(s.need), barY - 5);
  ctx.lineTo(X(s.need), barY + barH + 5);
  ctx.stroke();
  const met = o.total >= s.need;
  const status = met ? "đủ dùng" : `thiếu ${fmt(s.need - o.total, 1)} kWh`;
  label(ctx, `Tổng ${fmt(o.total, 1)} kWh/ngày: ${status}`, b.x, b.y + (g.small ? 7 : 12), { size, bold: true, color: met ? COLORS.green : COLORS.red });
  label(ctx, `Nhu cầu ${fmt(s.need, 0)} kWh`, X(s.need), barY + barH + (g.small ? 11 : 15), { size: g.small ? 10 : 12, color: COLORS.red, align: X(s.need) < b.x + 60 ? "left" : "center" });
  if (!g.small) {
    // the need line is never in the right third (scale ≥ 1,5 × need), so the legend sits there
    label(ctx, "■ Gió", b.x + b.w, barY + barH + 15, { size: 12, color: COLORS.blue, align: "right" });
    label(ctx, "■ Mặt trời", b.x + b.w - 50, barY + barH + 15, { size: 12, color: COLORS.orange, align: "right" });
    label(ctx, "Hình không theo tỉ lệ · G = 1000 W/m² · ρ = 1,225 kg/m³", b.x + b.w, b.y + 12, { size: 11, color: COLORS.muted, align: "right" });
  }
}

const commit = c => ({ ...c, onCommit: report });

mount({
  slug: "nang-luong-tai-tao",
  version: "1.0.0",
  title: "Năng lượng tái tạo: pin mặt trời và tua-bin gió",
  hint: "Điều chỉnh pin mặt trời và tua-bin gió để điện năng mỗi ngày đủ cho nhu cầu của hộ gia đình.",
  initialState,
  autoplay: true,
  step(s, dt) {
    // the rotor turns faster in stronger wind (picture only)
    s._rot = ((s._rot ?? 0.3) + dt * Math.min(8, (1.2 * s.windSpeed) / Math.max(0.5, s.blade))) % (Math.PI * 2);
  },
  controls: [
    { type: "heading", label: "Pin mặt trời" },
    commit({ type: "slider", key: "area", label: "Diện tích tấm pin A", min: 1, max: 40, step: 1, unit: "m²", digits: 0 }),
    commit({ type: "slider", key: "efficiency", label: "Hiệu suất η", min: 5, max: 25, step: 1, unit: "%", digits: 0 }),
    commit({ type: "slider", key: "sunAngle", label: "Góc giữa tia nắng và pháp tuyến θ", min: 0, max: 85, step: 1, unit: "°", digits: 0 }),
    commit({ type: "slider", key: "sunHours", label: "Số giờ nắng mỗi ngày", min: 0, max: 8, step: 0.5, unit: "h", digits: 1 }),
    { type: "heading", label: "Tua-bin gió" },
    commit({ type: "slider", key: "blade", label: "Chiều dài cánh R", min: 0.5, max: 5, step: 0.1, unit: "m", digits: 1 }),
    commit({ type: "slider", key: "windSpeed", label: "Tốc độ gió v", min: 0, max: V_MAX, step: 0.5, unit: "m/s", digits: 1 }),
    commit({
      type: "slider", key: "cp", label: "Hệ số công suất Cp", min: 0.05, max: 0.59, step: 0.01,
      format: v => `${fmt(v, 2)} (≤ 16/27)`,
    }),
    commit({ type: "slider", key: "windHours", label: "Số giờ có gió mỗi ngày", min: 0, max: 24, step: 1, unit: "h", digits: 0 }),
    { type: "heading", label: "Hộ gia đình" },
    commit({
      type: "select",
      key: "need",
      label: "Nhu cầu điện mỗi ngày",
      options: [
        { value: 5, label: "Hộ nhỏ: 5 kWh/ngày" },
        { value: 10, label: "Hộ trung bình: 10 kWh/ngày" },
        { value: 15, label: "Hộ đông người: 15 kWh/ngày" },
        { value: 20, label: "Hộ có điều hòa: 20 kWh/ngày" },
      ],
    }),
  ],
  readouts: [
    { label: "Công suất pin mặt trời", value: s => watts(outputs(s).solarW) },
    { label: "Công suất tua-bin gió", value: s => watts(outputs(s).windW) },
    { label: "Điện năng mỗi ngày (mặt trời + gió)", value: s => `${fmt(outputs(s).solarKWh, 2)} + ${fmt(outputs(s).windKWh, 2)} kWh` },
    { label: "Tổng so với nhu cầu", value: s => `${fmt(outputs(s).total, 1)} / ${fmt(s.need, 0)} kWh` },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    const o = outputs(s);
    drawSolar(ctx, s, g, o);
    drawWind(ctx, s, g, o);
    drawBar(ctx, s, g, o);
  },
});
