import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, expansion, material, materialIndex, fitLiquid, waterDensity, railGap, bimetalCurvature, bimetalDeflection, OBJECTS, SOLIDS, LIQUIDS, RAIL, BIMETAL, ALPHA } from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
/** 1,1·10⁻³ style, exponent a multiple of 3. */
const sci = x => {
  const e = Math.floor(Math.log10(Math.abs(x)) / 3) * 3;
  return `${fmt(x / 10 ** e, 2)}·10${String(e).replace(/./g, c => SUP[c])}`;
};
const dig = x => (Math.abs(x) < 0.01 ? 4 : Math.abs(x) < 1 ? 3 : 2);
const signed = (x, d) => `${x > 0 ? "+" : ""}${fmt(x, d)}`;
const UNIT = { length: "mm", area: "cm²", volume: "cm³" };
const STEEL = "#7d8796";
const COPPER = "#c8742a";
const STUFF = { steel: STEEL, aluminium: "#b9c3cf", copper: COPPER, glass: "#9fd3e0", water: "#5b9be8", alcohol: "#e7b9e8" };

/** Largest 1-2-5 value at or below v. */
const niceFloor = v => {
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
};
/** Magnification so the drawn change is about 12 % of the drawn size. */
const magnify = lin => (Math.abs(lin) < 1e-12 ? 1 : clamp(niceFloor(0.12 / Math.abs(lin)), 1, 1e6));

function fit(ctx, text, maxW, size, bold) {
  let sz = size;
  const set = () => (ctx.font = `${bold ? "600 " : ""}${sz}px ${FONT}`);
  set();
  while (sz > 8 && ctx.measureText(text).width > maxW) {
    sz--;
    set();
  }
  return sz;
}
const line = (ctx, text, x, y, maxW, size, opts = {}) => label(ctx, text, x, y, { ...opts, size: fit(ctx, text, maxW, size, opts.bold) });

function formula(s, e) {
  const m = material(s);
  const dT = `${fmt(s.dT, 0)} °C`;
  const d = `${signed(e.delta, dig(e.delta))} ${UNIT[e.kind]}`;
  if (s.object === "rod") return [`Δl = α·l₀·Δt`, `${sci(m.alpha)} × ${fmt(s.l0, 1)} m × ${dT} = ${d}`];
  if (s.object === "plate") return [`ΔS ≈ 2α·S₀·Δt`, `2 × ${sci(m.alpha)} × ${fmt(s.s0, 0)} cm² × ${dT} = ${d}`];
  if (s.object === "block") return [`ΔV ≈ 3α·V₀·Δt (β ≈ 3α)`, `3 × ${sci(m.alpha)} × ${fmt(s.v0, 0)} cm³ × ${dT} = ${d}`];
  if (m.id === "water") {
    const t = s.t0 + s.dT;
    return [`V = V₀·ρ(t₀)/ρ(t)`, `${fmt(s.v0, 0)} × ${fmt(waterDensity(s.t0), 5)} / ${fmt(waterDensity(t), 5)} → ΔV = ${d}`];
  }
  return [`ΔV = β·V₀·Δt`, `${sci(m.beta)} × ${fmt(s.v0, 0)} cm³ × ${dT} = ${d}`];
}

function geom(s, view) {
  const small = view.w < 560 || view.h < 420;
  const pad = small ? 8 : 18;
  const top = small ? 44 : 64; // two header lines
  const note = small ? 14 : 22;
  const ph = s.panel === "none" ? 0 : small ? Math.round(view.h * 0.34) : clamp(view.h * 0.3, 130, 210);
  const panel = { x0: pad, x1: view.w - pad, y1: view.h - note - 4, y0: view.h - note - 4 - ph };
  const scene = { x0: pad, x1: view.w - pad, y0: top, y1: (ph ? panel.y0 : view.h - note) - (small ? 6 : 12) };
  return { small, pad, top, note, panel, scene };
}

function flame(ctx, x, y, size, dT) {
  if (dT > 0) {
    for (const [dx, k] of [[-1, 0.7], [0, 1], [1, 0.7]]) {
      const fx = x + dx * size * 0.7;
      const h = size * 1.6 * k;
      ctx.fillStyle = "rgba(240, 140, 46, 0.85)";
      ctx.beginPath();
      ctx.moveTo(fx, y - h);
      ctx.quadraticCurveTo(fx + size * 0.5, y - h * 0.3, fx, y);
      ctx.quadraticCurveTo(fx - size * 0.5, y - h * 0.3, fx, y - h);
      ctx.fill();
    }
  } else if (dT < 0) {
    label(ctx, "❄ làm lạnh", x, y - size * 0.6, { size: size, align: "center", color: COLORS.blue, bold: true });
  }
}

/** Tint toward red when heated, toward blue when cooled. */
const tint = dT => (dT > 0 ? `rgba(229, 72, 77, ${Math.min(0.45, dT / 400)})` : dT < 0 ? `rgba(47, 111, 237, ${Math.min(0.4, -dT / 120)})` : "rgba(0,0,0,0)");

function drawScene(ctx, s, g, e, M) {
  const { x0, x1, y0, y1 } = g.scene;
  const W = x1 - x0;
  const H = y1 - y0;
  const size = g.small ? 11 : 14;
  const m = material(s);
  const color = STUFF[m.id];
  const grow = 1 + M * e.linear;
  const fl = clamp(H * 0.07, 6, 22);

  if (s.object === "rod") {
    const bh = clamp(H * 0.09, 10, 28);
    const xl = x0 + W * 0.08;
    const L = W * 0.7;
    const cy = y0 + H * 0.42;
    ctx.fillStyle = COLORS.muted; // wall that holds the left end
    ctx.fillRect(xl - 10, cy - bh * 2, 10, bh * 4);
    ctx.fillStyle = color;
    ctx.fillRect(xl, cy - bh / 2, L * grow, bh);
    ctx.fillStyle = tint(s.dT);
    ctx.fillRect(xl, cy - bh / 2, L * grow, bh);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(xl, cy - bh / 2, L * grow, bh);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = COLORS.muted;
    ctx.beginPath();
    ctx.moveTo(xl + L, cy - bh * 1.4);
    ctx.lineTo(xl + L, cy + bh * 1.4);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, `l₀ = ${fmt(s.l0, 1)} m`, xl + L / 2, cy - bh - size * 0.4, { size, align: "center", bold: true });
    const xe = xl + L * grow;
    const ye = cy + bh * 1.2;
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xl + L, ye);
    ctx.lineTo(xe, ye);
    ctx.stroke();
    const dl = `Δl = ${signed(e.delta, dig(e.delta))} mm`;
    ctx.font = `600 ${size}px ${FONT}`;
    const lx = Math.min(Math.max(xl + L, xe) + 6, x1 - ctx.measureText(dl).width);
    label(ctx, dl, lx, lx < Math.max(xl + L, xe) + 6 ? ye + size * 1.1 : ye, { size, color: COLORS.red, bold: true });
    flame(ctx, xl + L * 0.5, Math.min(y1, cy + bh * 1.4 + fl * 2.6), fl, s.dT);
  } else if (s.object === "plate" || s.object === "block") {
    const cube = s.object === "block";
    const a = Math.min(W * 0.36, H * (cube ? 0.5 : 0.62));
    const d = cube ? a * 0.35 : 0;
    const cx = x0 + W * 0.36;
    const cy = y0 + H * 0.46 + d / 2;
    const box = (side, fill) => {
      const l = cx - side / 2;
      const t = cy - side / 2;
      const k = (side / a) * d;
      if (fill) {
        if (cube) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(l, t);
          ctx.lineTo(l + k, t - k);
          ctx.lineTo(l + side + k, t - k);
          ctx.lineTo(l + side + k, t + side - k);
          ctx.lineTo(l + side, t + side);
          ctx.lineTo(l + side, t);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fill();
        }
        ctx.fillStyle = color;
        ctx.fillRect(l, t, side, side);
        ctx.fillStyle = tint(s.dT);
        ctx.fillRect(l, t, side, side);
      }
      ctx.beginPath();
      ctx.rect(l, t, side, side);
      if (cube) {
        ctx.moveTo(l, t);
        ctx.lineTo(l + k, t - k);
        ctx.lineTo(l + side + k, t - k);
        ctx.lineTo(l + side + k, t + side - k);
        ctx.lineTo(l + side, t + side);
        ctx.moveTo(l + side, t);
        ctx.lineTo(l + side + k, t - k);
      }
      ctx.stroke();
    };
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    box(a * grow, true);
    ctx.strokeStyle = COLORS.muted;
    ctx.setLineDash([5, 4]);
    box(a, false);
    ctx.setLineDash([]);
    const x = cx + (a * Math.max(1, grow)) / 2 + d + (g.small ? 8 : 14);
    label(ctx, cube ? `V₀ = ${fmt(s.v0, 0)} cm³` : `S₀ = ${fmt(s.s0, 0)} cm²`, x, cy - size * 0.8, { size, bold: true });
    label(ctx, `${cube ? "ΔV" : "ΔS"} = ${signed(e.delta, dig(e.delta))} ${UNIT[e.kind]}`, x, cy + size * 0.8, { size, bold: true, color: COLORS.red });
    flame(ctx, cx, Math.min(y1, cy + (a * Math.max(1, grow)) / 2 + fl * 2.2), fl, s.dT);
  } else {
    // flask: round bulb and a narrow graduated tube; liquid fills the bulb and part of the tube
    const rb = Math.min(W * 0.16, H * 0.27);
    const tw = Math.max(8, rb * 0.22);
    const th = rb * 1.45;
    const cx = x0 + W * 0.32;
    const cy = y1 - rb - fl * 2.6;
    const neck = cy - rb * 0.92;
    const tt = neck - th;
    const h0 = th * 0.4;
    const level = neck - clamp(h0 + M * e.linear * 2 * rb, 2, th - 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, rb, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - tw / 2, level, tw, cy - level);
    ctx.fillStyle = tint(s.dT);
    ctx.beginPath();
    ctx.arc(cx, cy, rb, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const a = Math.asin(tw / 2 / rb);
    ctx.arc(cx, cy, rb, -Math.PI / 2 + a, (3 * Math.PI) / 2 - a);
    ctx.moveTo(cx - tw / 2, neck);
    ctx.lineTo(cx - tw / 2, tt);
    ctx.moveTo(cx + tw / 2, neck);
    ctx.lineTo(cx + tw / 2, tt);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 8; i++) {
      const y = neck - (th * i) / 8;
      ctx.moveTo(cx + tw / 2, y);
      ctx.lineTo(cx + tw / 2 + 5, y);
    }
    ctx.stroke();
    ctx.strokeStyle = COLORS.muted;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(cx - tw * 1.6, neck - h0);
    ctx.lineTo(cx + tw * 1.6, neck - h0);
    ctx.stroke();
    ctx.setLineDash([]);
    const x = cx + rb + (g.small ? 8 : 16);
    label(ctx, "mực lúc đầu", cx - tw * 1.8, neck - h0, { size: size - 2, color: COLORS.muted, align: "right" });
    label(ctx, `${m.name}, V₀ = ${fmt(s.v0, 0)} cm³`, x, cy - size * 0.8, { size, bold: true });
    label(ctx, `ΔV = ${signed(e.delta, dig(e.delta))} cm³`, x, cy + size * 0.8, { size, bold: true, color: COLORS.red });
    flame(ctx, cx, y1, fl, s.dT);
  }
}

function frame(ctx, p, title, size) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
  line(ctx, title, p.x0 + 8, p.y0 + size * 0.9, p.x1 - p.x0 - 16, size, { bold: true });
}

function drawRail(ctx, s, g) {
  const p = g.panel;
  const size = g.small ? 10 : 13;
  frame(ctx, p, `Khe hở giữa hai thanh ray thép dài ${fmt(RAIL.length, 1)} m (lắp ở ${fmt(s.t0, 0)} °C, khe ${RAIL.gap} mm)`, size);
  const gap = railGap(s.dT);
  const W = p.x1 - p.x0;
  const cx = (p.x0 + p.x1) / 2;
  const y = (p.y0 + p.y1) / 2 + size * 0.3;
  const k = Math.min(8, W * 0.014); // px per mm of gap: the gap is drawn much larger than the rails
  const half = Math.max(0, gap) * k * 0.5;
  const rh = g.small ? 8 : 12;
  ctx.fillStyle = "#9a7b5a";
  for (let i = 0; i < 9; i++) ctx.fillRect(p.x0 + 12 + ((W - 24) * i) / 8 - 4, y + rh / 2, 8, rh * 0.8);
  ctx.fillStyle = STEEL;
  if (gap > 0) {
    ctx.fillRect(p.x0 + 10, y - rh / 2, cx - half - p.x0 - 10, rh);
    ctx.fillRect(cx + half, y - rh / 2, p.x1 - 10 - cx - half, rh);
  } else {
    // the rails push on each other and buckle
    ctx.strokeStyle = STEEL;
    ctx.lineWidth = rh;
    ctx.beginPath();
    ctx.moveTo(p.x0 + 10, y);
    ctx.lineTo(cx - W * 0.18, y);
    ctx.quadraticCurveTo(cx, y - rh * 3.2, cx + W * 0.18, y);
    ctx.lineTo(p.x1 - 10, y);
    ctx.stroke();
  }
  const text = gap > 0 ? `Ở ${fmt(s.t0 + s.dT, 0)} °C khe hở còn ${fmt(gap, 2)} mm` : `Ở ${fmt(s.t0 + s.dT, 0)} °C khe hở đã khép kín: ray bị cong vênh`;
  line(ctx, text, cx, p.y1 - size * 0.9, W - 16, size, { align: "center", color: gap > 0 ? COLORS.ink : COLORS.red, bold: gap <= 0 });
}

function drawBimetal(ctx, s, g) {
  const p = g.panel;
  const size = g.small ? 10 : 13;
  frame(ctx, p, g.small ? "Băng kép đồng (trên) – thép (dưới), độ cong ×5" : "Băng kép đồng (trên) – thép (dưới), dài 10 cm; độ cong vẽ phóng đại ×5", size);
  const a1 = ALPHA(BIMETAL.top);
  const a2 = ALPHA(BIMETAL.bottom);
  const k = bimetalCurvature(a1, a2, s.dT);
  const W = p.x1 - p.x0;
  const L = W * (g.small ? 0.34 : 0.3);
  // total turn of the tangent, exaggerated ×5 (0,9 rad at Δt = 200 °C, the end of the slider)
  const angle = clamp(k * BIMETAL.length * 5, -1, 1);
  const kp = angle / L; // px⁻¹, positive bends down on screen
  const xs = p.x0 + W * 0.08;
  const drop = Math.abs(angle) < 1e-9 ? 0 : (L * (1 - Math.cos(angle))) / angle; // tip offset on screen
  const ys = (p.y0 + p.y1) / 2 + size * 0.5 - drop / 2;
  const lw = g.small ? 5 : 7;
  ctx.fillStyle = COLORS.muted;
  ctx.fillRect(xs - 10, ys - lw * 2.5, 10, lw * 5);
  const pt = (u, off) => {
    const th = kp * u;
    const x = Math.abs(kp) < 1e-9 ? u : Math.sin(th) / kp;
    const y = Math.abs(kp) < 1e-9 ? 0 : (1 - Math.cos(th)) / kp;
    return [xs + x + off * Math.sin(th), ys + y - off * Math.cos(th)];
  };
  for (const [off, color] of [[lw / 2, COPPER], [-lw / 2, STEEL]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const [x, y] = pt((L * i) / 40, off);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  const tip = bimetalDeflection(k) * 1000;
  const tx = xs + L + (g.small ? 10 : 24);
  const msg = g.small
    ? s.dT > 0 ? "cong về phía thép" : s.dT < 0 ? "cong về phía đồng" : "thẳng"
    : s.dT > 0 ? "Nung nóng: cong về phía thép (thép nở ít hơn)" : s.dT < 0 ? "Làm lạnh: cong về phía đồng (đồng co nhiều hơn)" : "Δt = 0: băng kép thẳng";
  const ty = (p.y0 + p.y1) / 2 + size * 0.5;
  line(ctx, g.small ? `đầu lệch ${fmt(Math.abs(tip), 2)} mm` : `Δt = ${fmt(s.dT, 0)} °C, đầu băng lệch ${fmt(Math.abs(tip), 2)} mm`, tx, ty - size * 0.8, p.x1 - tx - 6, size, { bold: true });
  line(ctx, msg, tx, ty + size * 0.8, p.x1 - tx - 6, size, { color: COLORS.purple, bold: g.small });
}

function drawWater(ctx, s, g) {
  const p = g.panel;
  const size = g.small ? 10 : 13;
  frame(ctx, p, "Thể tích 1 g nước từ 0 °C đến 12 °C: nhỏ nhất ở 4 °C (từ bảng khối lượng riêng)", size);
  const gx0 = p.x0 + (g.small ? 44 : 60);
  const gx1 = p.x1 - 12;
  const gy0 = p.y0 + size * 2;
  const gy1 = p.y1 - size * 1.6;
  const vmin = 1;
  const vmax = 1.0006;
  const X = t => gx0 + ((gx1 - gx0) * t) / 12;
  const Y = v => gy1 - ((gy1 - gy0) * (v - vmin)) / (vmax - vmin);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let t = 0; t <= 12; t += 2) {
    ctx.moveTo(X(t), gy0);
    ctx.lineTo(X(t), gy1);
    label(ctx, `${t}`, X(t), gy1 + size * 0.8, { size: size - 1, align: "center", color: COLORS.muted });
  }
  for (const v of [1, 1.0002, 1.0004, 1.0006]) {
    ctx.moveTo(gx0, Y(v));
    ctx.lineTo(gx1, Y(v));
    label(ctx, fmt(v, 4), gx0 - 4, Y(v), { size: size - 2, align: "right", color: COLORS.muted });
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const t = i / 10;
    const y = Y(1 / waterDensity(t));
    if (i) ctx.lineTo(X(t), y);
    else ctx.moveTo(X(t), y);
  }
  ctx.stroke();
  label(ctx, "t (°C)", gx1, gy1 - size * 0.7, { size: size - 1, align: "right", color: COLORS.muted });
  label(ctx, "V (cm³)", gx0 + 4, gy0 + size * 0.5, { size: size - 1, color: COLORS.muted });
  for (const [t, c] of [[s.t0, COLORS.muted], [s.t0 + s.dT, COLORS.red]]) {
    if (t < 0 || t > 12) continue;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(X(t), Y(1 / waterDensity(t)), 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

const commit = (s, api) => {
  const e = expansion(s);
  api.emit("expanded", { object: OBJECTS.findIndex(o => o.id === s.object), material: materialIndex(s), size0: e.size0, deltaT: s.dT, expansion: e.delta, relative: e.rel }, "result");
};
const keep = s => fitLiquid(s);

mount({
  slug: "su-no-vi-nhiet",
  version: "1.0.0",
  title: "Sự nở vì nhiệt",
  hint: "Chọn vật, chất làm vật, kích thước ban đầu và độ tăng nhiệt độ; độ nở được vẽ phóng đại để dễ quan sát.",
  initialState,
  controls: [
    { type: "heading", label: "Vật được nung" },
    { type: "select", key: "object", label: "Loại vật", options: OBJECTS.map(o => ({ value: o.id, label: o.label })), onChange: keep, onCommit: commit },
    { type: "select", key: "solid", label: "Chất rắn", options: SOLIDS.map(m => ({ value: m.id, label: `${m.name} (α = ${sci(m.alpha)} K⁻¹)` })), visible: s => s.object !== "liquid", onCommit: commit },
    {
      type: "select",
      key: "liquid",
      label: "Chất lỏng",
      options: LIQUIDS.map(m => ({ value: m.id, label: m.id === "water" ? `${m.name} (β ≈ ${sci(m.beta)} K⁻¹ ở 20 °C; tính theo bảng ρ)` : `${m.name} (β = ${sci(m.beta)} K⁻¹)` })),
      visible: s => s.object === "liquid",
      onChange: keep,
      onCommit: commit,
    },
    { type: "slider", key: "l0", label: "Chiều dài ban đầu l₀", min: 1, max: 30, step: 0.5, unit: "m", digits: 1, visible: s => s.object === "rod", onCommit: commit },
    { type: "slider", key: "s0", label: "Diện tích ban đầu S₀", min: 100, max: 2500, step: 50, unit: "cm²", digits: 0, visible: s => s.object === "plate", onCommit: commit },
    { type: "slider", key: "v0", label: "Thể tích ban đầu V₀", min: 100, max: 2000, step: 50, unit: "cm³", digits: 0, visible: s => s.object === "block" || s.object === "liquid", onCommit: commit },
    { type: "heading", label: "Nhiệt độ" },
    { type: "slider", key: "t0", label: "Nhiệt độ ban đầu t₀", min: 0, max: 100, step: 1, unit: "°C", digits: 0, onChange: keep, onCommit: commit },
    { type: "slider", key: "dT", label: "Độ tăng nhiệt độ Δt", min: -50, max: 200, step: 1, format: (v, s) => `${signed(v, 0)} °C (t = ${fmt(s.t0 + v, 0)} °C)`, onChange: keep, onCommit: commit },
    { type: "heading", label: "Ví dụ thực tế" },
    {
      type: "select",
      key: "panel",
      label: "Khung minh họa",
      options: [
        { value: "rail", label: "Khe hở đường ray" },
        { value: "bimetal", label: "Băng kép đồng – thép" },
        { value: "water", label: "Sự nở bất thường của nước" },
        { value: "none", label: "Ẩn" },
      ],
    },
  ],
  readouts: [
    { label: "Chất", value: s => material(s).name },
    { label: "Hệ số nở", value: s => (s.object === "liquid" ? (material(s).id === "water" ? "theo bảng ρ(t)" : `β = ${sci(material(s).beta)} K⁻¹`) : s.object === "block" ? `β ≈ 3α = ${sci(3 * material(s).alpha)} K⁻¹` : `α = ${sci(material(s).alpha)} K⁻¹`) },
    { label: "Nhiệt độ", value: s => `${fmt(s.t0, 0)} °C → ${fmt(s.t0 + s.dT, 0)} °C` },
    { label: "Độ nở", value: s => { const e = expansion(s); return `${signed(e.delta, dig(e.delta))} ${UNIT[e.kind]}`; } },
    { label: "Kích thước sau", value: s => { const e = expansion(s); return e.kind === "length" ? `${fmt(e.size, 5)} m` : `${fmt(e.size, 3)} ${UNIT[e.kind]}`; } },
    { label: "Độ nở tương đối", value: s => `${fmt(expansion(s).rel * 100, 4)} %` },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    const e = expansion(s);
    const M = magnify(e.linear);
    const size = g.small ? 12 : 15;
    const [f1, f2] = formula(s, e);
    const W = view.w - 2 * g.pad;
    line(ctx, `${f1}   (t₀ = ${fmt(s.t0, 0)} °C → t = ${fmt(s.t0 + s.dT, 0)} °C)`, g.pad, g.small ? 12 : 20, W, size, { bold: true });
    line(ctx, `= ${f2}`, g.pad, g.small ? 30 : 44, W, size, { color: COLORS.red, bold: true });
    drawScene(ctx, s, g, e, M);
    if (s.panel === "rail") drawRail(ctx, s, g);
    else if (s.panel === "bimetal") drawBimetal(ctx, s, g);
    else if (s.panel === "water") drawWater(ctx, s, g);
    const note = g.small
      ? `Không theo tỉ lệ: độ nở phóng đại ×${fmt(M, 0)}`
      : `Hình không theo tỉ lệ: độ nở được vẽ phóng đại ×${fmt(M, 0)}; đường nét đứt là kích thước ban đầu.${s.object === "liquid" ? " Bỏ qua sự nở của bình." : ""}`;
    line(ctx, note, view.w / 2, view.h - g.note / 2 - 2, view.w - 16, g.small ? 10 : 12, { align: "center", color: COLORS.muted });
  },
});
