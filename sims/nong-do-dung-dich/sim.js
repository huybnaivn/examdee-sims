import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { SOLUTES, LIMITS, WATER_STEP, initialState, solution, colorDepth, addWater, evaporate, crossedIntoSaturation } from "./model.js";

const font = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;

// Text with subscripts written as _{…}, e.g. "m_{dd} = 220 g". Left-aligned at x.
function rich(ctx, text, x, y, { size = 14, color = COLORS.ink, bold = false } = {}) {
  text.split(/_\{([^}]*)\}/).forEach((part, i) => {
    const sub = i % 2 === 1;
    const sz = sub ? size * 0.72 : size;
    label(ctx, part, x, y + (sub ? size * 0.28 : 0), { size: sz, color, bold });
    ctx.font = font(sz, bold);
    x += ctx.measureText(part).width;
  });
}

// One report per finished change (slider released, solute picked, button pressed), sent at once:
// nothing is left pending that could arrive after a reset.
function settle(s, api) {
  const c = solution(s);
  api.emit(
    "concentration",
    { cPercent: c.cPercent, cM: c.cM, saturated: c.saturated ? 1 : 0, dissolved: c.dissolved, solid: c.solid, water: s.water },
    "result"
  );
  if (crossedIntoSaturation(s)) api.emit("saturated", { solute: s.solute, added: s.added, water: s.water }, "goal");
}

const rand = i => {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

function drawBeaker(ctx, s, c, b, small) {
  const { x, y, w, h } = b;
  const hi = LIMITS.water[1];
  const levelOf = mL => y + h - (h * 0.94 * mL) / hi;
  const top = levelOf(s.water);
  const { rgb } = c.solute;

  // solution
  ctx.fillStyle = "#e4f1fb";
  ctx.fillRect(x, top, w, y + h - top);
  const depth = colorDepth(s);
  if (depth > 0) {
    ctx.fillStyle = `rgba(${rgb.join(",")}, ${0.92 * depth})`;
    ctx.fillRect(x, top, w, y + h - top);
  } else {
    // colourless solutes: dots stand for dissolved particles, more of them when more concentrated
    ctx.fillStyle = "rgba(107, 120, 144, 0.55)";
    const n = Math.min(160, Math.round(c.cM * 14));
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(x + 5 + rand(i + 1) * (w - 10), top + 4 + rand(i + 500) * Math.max(0, y + h - top - 8), small ? 1.5 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // surface
  ctx.strokeStyle = "rgba(31, 42, 68, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + w, top);
  ctx.stroke();

  // undissolved solid heaped at the bottom
  if (c.solid > 0) {
    const hw = (w / 2) * Math.min(0.94, 0.35 + c.solid / 120);
    const hh = Math.min(h * 0.45, 6 + h * 0.3 * Math.sqrt(c.solid / LIMITS.added[1]));
    ctx.fillStyle = c.solute.solid;
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h - 1, hw, hh, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // glass and graduations
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 6);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w + 8, y - 6);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let mL = 100; mL <= hi; mL += 100) {
    const gy = levelOf(mL);
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + (small ? 8 : 14), gy);
    ctx.stroke();
    label(ctx, `${mL}`, x - 6, gy, { size: small ? 10 : 12, align: "right", color: COLORS.muted });
  }
  label(ctx, "mL", x - 6, y + 2, { size: small ? 10 : 12, align: "right", color: COLORS.muted });
}

const NOTE = "Quy ước: coi thể tích dung dịch bằng thể tích nước; khối lượng riêng của nước là 1 g/mL; nhiệt độ 25 °C.";

mount({
  slug: "nong-do-dung-dich",
  version: "1.0.0",
  title: "Nồng độ dung dịch",
  hint: "Chọn chất tan, thay đổi lượng chất tan và lượng nước rồi quan sát nồng độ và trạng thái bão hòa.",
  initialState,
  controls: [
    {
      type: "select",
      key: "solute",
      label: "Chất tan",
      onCommit: settle,
      options: Object.entries(SOLUTES).map(([value, o]) => ({ value, label: `${o.formula} – ${o.name}` })),
    },
    { type: "slider", key: "added", label: "Khối lượng chất tan cho vào", min: LIMITS.added[0], max: LIMITS.added[1], step: 1, unit: "g", digits: 0, onCommit: settle },
    { type: "slider", key: "water", label: "Thể tích nước", min: LIMITS.water[0], max: LIMITS.water[1], step: 10, unit: "mL", digits: 0, onCommit: settle },
    {
      type: "button",
      label: `Làm bay hơi ${WATER_STEP} mL nước`,
      disabled: s => s.water <= LIMITS.water[0],
      action(s, api) {
        evaporate(s);
        api.emit("evaporate", { water: s.water });
        settle(s, api);
      },
    },
    {
      type: "button",
      label: `Thêm ${WATER_STEP} mL nước`,
      disabled: s => s.water >= LIMITS.water[1],
      action(s, api) {
        addWater(s);
        api.emit("add-water", { water: s.water });
        settle(s, api);
      },
    },
  ],
  readouts: [
    { label: "Chất tan đã tan", value: s => `${fmt(solution(s).dissolved, 1)} g` },
    { label: "Khối lượng dung dịch", value: s => `${fmt(solution(s).mass, 1)} g` },
    { label: "Nồng độ phần trăm C%", value: s => `${fmt(solution(s).cPercent)} %` },
    { label: "Nồng độ mol", value: s => `${fmt(solution(s).cM, 3)} mol/L` },
    { label: "Chất rắn không tan", value: s => `${fmt(solution(s).solid, 1)} g` },
    { label: "Trạng thái", value: s => (solution(s).saturated ? "Bão hòa" : "Chưa bão hòa") },
  ],
  draw(ctx, s, view) {
    const c = solution(s);
    const o = c.solute;
    const wide = view.w >= 560;
    const status = c.saturated ? "Dung dịch bão hòa" : "Dung dịch chưa bão hòa";
    const statusColor = c.saturated ? COLORS.orange : COLORS.green;
    const solidText = c.solid > 0 ? `${fmt(c.solid, 1)} g chất rắn không tan ở đáy cốc` : "Chất tan đã tan hết";

    if (wide) {
      const cw = Math.min(420, view.w * 0.5);
      const area = view.w - cw - 20;
      const bw = Math.min(area - 90, 300);
      const bh = Math.min(view.h - 150, bw * 1.4);
      const b = { x: 40 + (area - bw) / 2, y: (view.h - bh) / 2 - 6, w: bw, h: bh };
      drawBeaker(ctx, s, c, b, false);
      label(ctx, `${o.formula} trong nước`, b.x + bw / 2, b.y - 34, { size: 17, bold: true, align: "center" });
      if (o.tint === 0) label(ctx, "Chấm nhỏ: minh họa hạt chất tan", b.x + bw / 2, b.y + bh + 22, { size: 12, align: "center", color: COLORS.muted });

      // card with the worked formulas
      const x = view.w - cw - 4;
      const w = cw - 12;
      const big = w >= 380;
      const size = big ? 15 : 13;
      const gap = big ? 30 : 26;
      const ch = gap * 10 + 92;
      const y = Math.max(6, (view.h - ch) / 2 - 12);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, ch, 12);
      ctx.fill();
      ctx.stroke();
      const tx = x + 16;
      let ty = y + 26;
      const line = (text, opts) => {
        rich(ctx, text, tx, ty, { size, ...opts });
        ty += gap;
      };
      line(`${o.formula} – ${o.name}`, { bold: true, size: size + 2 });
      line(`M = ${fmt(o.molarMass, 1)} g/mol · độ tan ở 25 °C: ${fmt(o.solubility, 1)} g/100 g nước`, { color: COLORS.muted, size: size - 2 });
      line(`m_{ct} (đã tan) = ${fmt(c.dissolved, 1)} g`);
      line(`m_{dd} = m_{ct} + m_{nước} = ${fmt(c.dissolved, 1)} + ${fmt(s.water)} = ${fmt(c.mass, 1)} g`);
      line(`C% = m_{ct} / m_{dd} · 100% = ${fmt(c.cPercent)} %`, { bold: true, color: COLORS.blue });
      line(`n = m_{ct} / M = ${fmt(c.dissolved, 1)} / ${fmt(o.molarMass, 1)} = ${fmt(c.mol, 3)} mol`);
      line(`C_{M} = n / V = ${fmt(c.mol, 3)} / ${fmt(c.volume, 2)} = ${fmt(c.cM, 3)} mol/L`, { bold: true, color: COLORS.purple });
      // how full of solute the water is
      const barW = w - 32;
      ty += 2;
      ctx.fillStyle = COLORS.grid;
      ctx.fillRect(tx, ty - 7, barW, 14);
      ctx.fillStyle = statusColor;
      ctx.fillRect(tx, ty - 7, barW * (c.cap > 0 ? c.dissolved / c.cap : 0), 14);
      ty += gap - 4;
      line(`Đã tan ${fmt(c.dissolved, 1)} g / tối đa ${fmt(c.cap, 1)} g trong ${fmt(s.water)} mL nước`, { color: COLORS.muted, size: size - 2 });
      ty -= 4;
      line(status, { bold: true, color: statusColor });
      ty -= 6;
      line(solidText, { color: statusColor, size: size - 1 });
      // convention note, wrapped onto two lines
      const cut = NOTE.indexOf("; khối") + 1;
      label(ctx, NOTE.slice(0, cut), tx, y + ch - 34, { size: 11, color: COLORS.muted });
      label(ctx, NOTE.slice(cut + 1), tx, y + ch - 18, { size: 11, color: COLORS.muted });
    } else {
      const bw = Math.max(70, view.w * 0.4 - 44);
      const b = { x: 36, y: 16, w: bw, h: Math.max(80, view.h - 58) };
      drawBeaker(ctx, s, c, b, true);
      const tx = b.x + bw + 20;
      const size = view.w - tx < 190 ? 11 : 12;
      const gap = Math.min(24, (b.h - 10) / 8);
      let ty = b.y + 4;
      const line = (text, opts) => {
        rich(ctx, text, tx, ty, { size, ...opts });
        ty += gap;
      };
      line(`${o.formula}`, { bold: true, size: size + 2 });
      line(`Độ tan: ${fmt(o.solubility, 1)} g/100 g nước`, { color: COLORS.muted });
      line(`m_{ct} (đã tan) = ${fmt(c.dissolved, 1)} g`);
      line(`m_{dd} = ${fmt(c.mass, 1)} g`);
      line(`C% = ${fmt(c.cPercent)} %`, { bold: true, color: COLORS.blue, size: size + 1 });
      line(`n = ${fmt(c.mol, 3)} mol; V = ${fmt(c.volume, 2)} L`);
      line(`C_{M} = ${fmt(c.cM, 3)} mol/L`, { bold: true, color: COLORS.purple, size: size + 1 });
      line(status, { bold: true, color: statusColor });
      if (c.solid > 0) line(`Chất rắn không tan: ${fmt(c.solid, 1)} g`, { color: statusColor });
      label(ctx, "Quy ước: V dung dịch = V nước; D nước = 1 g/mL; 25 °C", view.w / 2, view.h - 12, { size: 10, align: "center", color: COLORS.muted });
    }
  },
});
