import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { MATERIALS, OBJECTS, IDS, CYLINDER, initialState, measure, stageOf, measuredIds, bitOf, isCorrect } from "./model.js";

const WATER = "rgba(80, 150, 235, 0.35)";
const WATER_LINE = "#2f6fed";
const GLASS = "#8aa0c0";
const BODY = "#8d96a6"; // every object is painted the same grey
const SIZE = v => (v <= 15 ? "nhỏ" : v <= 30 ? "vừa" : "lớn");

const restart = s => {
  s.stage = 0;
  s.checked = false;
};

function geom(s, view) {
  const small = view.w < 560 || view.h < 400;
  const head = small ? 42 : 66;
  const rowH = small ? 17 : 24;
  const side = view.w >= 660;
  const need = measuredIds(s).length;
  let table = null;
  if (side) table = { x: view.w - 262, y: head + 4, w: 250, rowH, rows: need };
  else {
    const fit = Math.floor((view.h - head - 170) / rowH) - 1; // keep ≥ 170 px of scene
    const rows = Math.min(need, fit);
    if (rows >= 1) table = { x: 8, y: view.h - (rows + 1) * rowH - 6, w: view.w - 16, rowH, rows };
  }
  const x0 = 8;
  const x1 = side ? view.w - 280 : view.w - 8;
  const y0 = head;
  const y1 = table && !side ? table.y - 8 : view.h - 8;
  return { small, side, table, x0, x1, y0, y1, base: y1 - 4 };
}

function drawCylinder(ctx, cx, bottom, h, w, volume, small) {
  const top = bottom - h;
  const inner = { top: top + 10, bottom: bottom - 6 };
  const pxPerMl = (inner.bottom - inner.top) / CYLINDER.capacity;
  const level = inner.bottom - volume * pxPerMl;
  ctx.fillStyle = WATER;
  if (volume > 0) ctx.fillRect(cx - w / 2 + 2, level, w - 4, inner.bottom - level);
  // glass
  ctx.strokeStyle = GLASS;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top);
  ctx.lineTo(cx - w / 2, bottom - 6);
  ctx.lineTo(cx + w / 2, bottom - 6);
  ctx.lineTo(cx + w / 2, top);
  ctx.stroke();
  ctx.fillStyle = GLASS;
  ctx.fillRect(cx - w / 2 - 10, bottom - 6, w + 20, 6);
  // graduations: one tick per mL, longer every 5 mL, numbered every 10 mL (every 20 when cramped)
  const every = pxPerMl >= 2.5 ? 1 : 2;
  const numEvery = pxPerMl * 10 >= 14 ? 10 : 20;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  for (let ml = 0; ml <= CYLINDER.capacity; ml += every) {
    const y = inner.bottom - ml * pxPerMl;
    const len = ml % 10 === 0 ? 14 : ml % 5 === 0 ? 10 : 5;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y);
    ctx.lineTo(cx - w / 2 + len, y);
    ctx.stroke();
    if (ml % numEvery === 0 && ml > 0) label(ctx, String(ml), cx - w / 2 - 4, y, { size: small ? 9 : 11, align: "right", color: COLORS.muted });
  }
  label(ctx, "mL", cx - w / 2 - 4, top + 2, { size: small ? 9 : 11, align: "right", color: COLORS.muted });
  if (volume > 0) {
    ctx.strokeStyle = WATER_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 2, level);
    ctx.lineTo(cx + w / 2 - 2, level);
    ctx.stroke();
  }
  return { level, inner, top };
}

function drawCube(ctx, x, bottom, side) {
  const o = side * 0.25;
  ctx.fillStyle = BODY;
  ctx.strokeStyle = "#4b5260";
  ctx.lineWidth = 1.5;
  ctx.fillRect(x, bottom - side, side, side);
  ctx.strokeRect(x, bottom - side, side, side);
  ctx.fillStyle = "#b3bac6";
  ctx.beginPath();
  ctx.moveTo(x, bottom - side);
  ctx.lineTo(x + o, bottom - side - o);
  ctx.lineTo(x + side + o, bottom - side - o);
  ctx.lineTo(x + side, bottom - side);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6f7784";
  ctx.beginPath();
  ctx.moveTo(x + side, bottom - side);
  ctx.lineTo(x + side + o, bottom - side - o);
  ctx.lineTo(x + side + o, bottom - o);
  ctx.lineTo(x + side, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Wood floats: a thin rod holds it under water (the rod's volume is neglected).
function drawRod(ctx, x, cubeTop, rodTop) {
  ctx.strokeStyle = "#6b4f2a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, cubeTop);
  ctx.lineTo(x, rodTop);
  ctx.stroke();
}

function drawScale(ctx, x, base, w, text, small) {
  ctx.fillStyle = "#dfe4ec";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.fillRect(x, base - 34, w, 34);
  ctx.strokeRect(x, base - 34, w, 34);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(x + 8, base - 30, w - 16, 9);
  ctx.fillStyle = "#1a2a1a";
  ctx.fillRect(x + w * 0.2, base - 18, w * 0.6, 14);
  label(ctx, text, x + w / 2, base - 11, { size: small ? 10 : 12, align: "center", color: "#7dfc9a", bold: true });
}

function drawTable(ctx, s, g) {
  const t = g.table;
  if (!t) return;
  const size = g.small ? 11 : 13;
  const ids = measuredIds(s);
  const cur = ids.filter(id => id === s.object);
  const list = [...cur, ...ids.filter(id => id !== s.object)].slice(0, t.rows);
  if (g.side) list.sort();
  const cols = [0.2, 0.42, 0.66, 1].map(f => t.x + t.w * f - 6);
  const n = list.length + 1;
  ctx.fillStyle = "#fff";
  ctx.fillRect(t.x, t.y, t.w, t.rowH * n);
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(t.x, t.y, t.w, t.rowH);
  ctx.strokeStyle = COLORS.grid;
  ctx.strokeRect(t.x, t.y, t.w, t.rowH * n);
  const cy = i => t.y + t.rowH * (i + 0.5);
  ["Vật", "m (g)", "V (cm³)", "D (g/cm³)"].forEach((h, i) => label(ctx, h, i ? cols[i] : t.x + 6, cy(0), { size, color: COLORS.muted, align: i ? "right" : "left" }));
  list.forEach((id, i) => {
    const r = measure(id, s.method);
    const on = id === s.object;
    const st = { size, bold: on, color: on ? COLORS.blue : COLORS.ink };
    label(ctx, id, t.x + 6, cy(i + 1), st);
    label(ctx, fmt(r.mass, 0), cols[1], cy(i + 1), { ...st, align: "right" });
    label(ctx, fmt(r.volume, 0), cols[2], cy(i + 1), { ...st, align: "right" });
    label(ctx, fmt(r.density, 2), cols[3], cy(i + 1), { ...st, align: "right" });
  });
  if (g.side) {
    const y = t.y + t.rowH * n + 8;
    if (!ids.length) label(ctx, "Chưa đo vật nào.", t.x + 6, y + 6, { size: 13, color: COLORS.muted });
    ["Đo nhiều vật cùng chất, khác kích", "thước: khối lượng riêng có bằng nhau?"].forEach((line, i) =>
      label(ctx, line, t.x + 6, y + 30 + i * 18, { size: 13, color: COLORS.muted }));
  }
}

function referenceTable(box) {
  const h = document.createElement("h2");
  h.textContent = "Bảng khối lượng riêng (gần đúng)";
  const table = document.createElement("table");
  table.style.cssText = "border-collapse:collapse;font-size:13px;width:100%;margin-top:6px";
  table.innerHTML =
    "<tr style='color:#6b7890'><th style='text-align:left'>Chất</th><th style='text-align:right'>kg/m³</th><th style='text-align:right'>g/cm³</th></tr>" +
    Object.values(MATERIALS)
      .map(m => `<tr><td>${m.label}</td><td style="text-align:right">${fmt(m.density, 0)}</td><td style="text-align:right">${fmt(m.density / 1000, 2)}</td></tr>`)
      .join("");
  box.append(h, table);
}

mount({
  slug: "khoi-luong-rieng",
  version: "1.0.0",
  title: "Khối lượng riêng",
  hint: "Chọn một vật, cân để biết khối lượng, rồi thả vào bình để đo thể tích. Tính D = m/V và đoán vật làm bằng chất gì.",
  initialState,
  controls: [
    {
      type: "select",
      key: "object",
      label: "Vật cần đo (cùng được sơn màu xám)",
      options: IDS.map(id => ({ value: id, label: `Vật ${id} (khối ${SIZE(OBJECTS[id].volume)})` })),
      onChange: restart,
    },
    {
      type: "select",
      key: "method",
      label: "Cách đo thể tích",
      options: [
        { value: "cylinder", label: "Bình chia độ: V = V₂ − V₁" },
        { value: "overflow", label: "Bình tràn: V = nước tràn ra" },
      ],
      onChange: restart,
    },
    {
      type: "button",
      label: "1. Cân vật",
      primary: true,
      disabled: s => stageOf(s) >= 1,
      action(s, api) {
        s.stage = 1;
        api.emit("object-weighed", { mass: measure(s.object, s.method).mass });
      },
    },
    {
      type: "button",
      label: "2. Thả vật vào bình, đo thể tích",
      primary: true,
      disabled: s => stageOf(s) !== 1,
      action(s, api) {
        s.stage = 2;
        s.measured = (Number.isInteger(s.measured) ? s.measured : 0) | bitOf(s.object);
        const r = measure(s.object, s.method);
        api.emit("density-measured", { mass: r.mass, volume: r.volume, density: r.density, densityKg: r.densityKg }, "result");
      },
    },
    { type: "heading", label: "Vật làm bằng chất gì?" },
    {
      type: "select",
      key: "guess",
      label: "Em đoán chất làm vật",
      options: Object.entries(MATERIALS).map(([value, m]) => ({ value, label: m.label })),
      onChange: s => (s.checked = false),
    },
    {
      type: "button",
      label: "Kiểm tra",
      disabled: s => stageOf(s) !== 2,
      action(s, api) {
        s.checked = true;
        const ok = isCorrect(s);
        api.emit("material-guessed", { correct: ok ? 1 : 0 });
        if (ok) api.emit("material-identified", { density: measure(s.object, s.method).densityKg }, "goal");
      },
    },
    { type: "custom", render: referenceTable },
  ],
  readouts: [
    { label: "Khối lượng m", value: s => (stageOf(s) >= 1 ? `${fmt(measure(s.object, s.method).mass, 0)} g` : "–") },
    {
      label: "Thể tích V",
      value: s => {
        if (stageOf(s) < 2) return "–";
        const r = measure(s.object, s.method);
        return s.method === "overflow" ? `${fmt(r.volume, 0)} cm³` : `${fmt(r.after, 0)} − ${fmt(r.before, 0)} = ${fmt(r.volume, 0)} cm³`;
      },
    },
    { label: "Khối lượng riêng D", value: s => (stageOf(s) === 2 ? `${fmt(measure(s.object, s.method).density, 2)} g/cm³` : "–") },
    {
      label: "Nhận biết chất",
      value: s => (!s.checked ? "–" : isCorrect(s) ? `Đúng: ${MATERIALS[s.guess].label.toLowerCase()}` : "Chưa đúng, thử lại"),
    },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    const stage = stageOf(s);
    const r = measure(s.object, s.method);
    const fs = g.small ? 13 : 17;
    const line1 =
      stage === 2
        ? `D = m/V = ${fmt(r.mass, 0)} g : ${fmt(r.volume, 0)} cm³ = ${fmt(r.density, 2)} g/cm³ = ${fmt(r.densityKg, 0)} kg/m³`
        : stage === 1
          ? `m = ${fmt(r.mass, 0)} g. Bây giờ đo thể tích V.`
          : "D = m/V. Hãy cân vật trước.";
    label(ctx, line1, view.w / 2, g.small ? 13 : 22, { align: "center", size: stage === 2 && g.small ? 12 : fs, bold: true });
    const note = s.checked
      ? isCorrect(s)
        ? `Đúng! Vật ${s.object} làm bằng ${MATERIALS[s.guess].label.toLowerCase()}.`
        : `Chưa đúng: D của ${MATERIALS[s.guess].label.toLowerCase()} khoảng ${fmt(MATERIALS[s.guess].density / 1000, 2)} g/cm³.`
      : `1 mL = 1 cm³  ·  1 g/cm³ = ${fmt(1000)} kg/m³${g.small ? "" : "  ·  hình không theo tỉ lệ, bỏ qua sai số"}`;
    label(ctx, note, view.w / 2, g.small ? 30 : 47, {
      align: "center",
      size: g.small ? 11 : 13,
      bold: s.checked,
      color: s.checked ? (isCorrect(s) ? COLORS.green : COLORS.red) : COLORS.muted,
    });

    // table top
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x0, g.base);
    ctx.lineTo(g.x1, g.base);
    ctx.stroke();

    const W = g.x1 - g.x0;
    const H = g.base - g.y0;
    const cw = Math.max(44, Math.min(90, W * 0.15));
    const kc = (cw - 12) / Math.cbrt(50); // px per cm of cube edge, biggest object just fits
    const side = Math.cbrt(OBJECTS[s.object].volume) * kc;
    const wood = OBJECTS[s.object].material === "go";
    const labelSize = g.small ? 11 : 13;

    // scale
    const sw = Math.min(150, W * 0.24);
    const sx = g.x0 + 18;
    drawScale(ctx, sx, g.base, sw, stage >= 1 && stage < 2 ? `${r.mass} g` : stage === 2 ? "0 g" : "--- g", g.small);
    label(ctx, "Cân", sx + sw / 2, g.base - 46 - (stage < 2 ? side + side * 0.25 : 0), { size: labelSize, align: "center", color: COLORS.muted });
    if (stage < 2) {
      drawCube(ctx, sx + sw / 2 - side / 2, g.base - 34, side);
      label(ctx, s.object, sx + sw / 2 - side * 0.0, g.base - 34 - side / 2, { size: labelSize, align: "center", bold: true, color: "#fff" });
    }

    const ch = Math.min(H - 20, g.side ? 480 : 320);
    if (s.method === "cylinder") {
      const cx = g.x0 + W * 0.66;
      const volume = stage === 2 ? r.after : r.before;
      const c = drawCylinder(ctx, cx, g.base, ch, cw, volume, g.small);
      if (stage === 2) {
        drawCube(ctx, cx - side / 2 - side * 0.12, c.inner.bottom, side);
        if (wood) drawRod(ctx, cx, c.inner.bottom - side, c.top - 14);
      }
      const tag = stage === 2 ? `V₂ = ${fmt(r.after, 0)} mL` : `V₁ = ${fmt(r.before, 0)} mL`;
      label(ctx, tag, cx + cw / 2 + 8, c.level, { size: labelSize, bold: true, color: WATER_LINE });
      if (stage === 2) label(ctx, `V₁ = ${fmt(r.before, 0)} mL`, cx + cw / 2 + 8, c.level + (g.small ? 16 : 20), { size: labelSize - 1, color: COLORS.muted });
    } else {
      // overflow vessel on a stand, spilling straight into a measuring cylinder
      const cylH = ch * 0.62;
      const vw = Math.max(cw + 16, Math.min(110, W * 0.24));
      const vh = ch * 0.36;
      const standH = cylH - 0.8 * vh + 16;
      const cx = g.x1 - (g.small ? 62 : 84) - cw / 2; // room for the reading on the right
      const spout = g.small ? 34 : 44;
      const vx = cx - cw / 2 + 8 - spout - vw; // spout ends inside the cylinder mouth
      const vBottom = g.base - standH;
      const spoutY = vBottom - 0.8 * vh;
      ctx.fillStyle = "#c9ced8";
      ctx.fillRect(vx + 10, vBottom, vw - 34, standH);
      ctx.fillStyle = WATER;
      ctx.fillRect(vx + 2, spoutY, vw - 4, vBottom - spoutY);
      ctx.strokeStyle = WATER_LINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vx + 2, spoutY);
      ctx.lineTo(vx + vw - 2, spoutY);
      ctx.stroke();
      ctx.strokeStyle = GLASS;
      ctx.beginPath();
      ctx.moveTo(vx, vBottom - vh);
      ctx.lineTo(vx, vBottom);
      ctx.lineTo(vx + vw, vBottom);
      ctx.lineTo(vx + vw, vBottom - vh);
      ctx.moveTo(vx + vw, spoutY);
      ctx.lineTo(vx + vw + spout, spoutY + 10);
      ctx.stroke();
      const c = drawCylinder(ctx, cx, g.base, cylH, cw, stage === 2 ? r.after : 0, g.small);
      if (stage === 2) {
        drawCube(ctx, vx + vw / 2 - side / 2 - side * 0.12, vBottom, side);
        if (wood) drawRod(ctx, vx + vw / 2, vBottom - side, vBottom - vh - 14);
        ctx.fillStyle = WATER_LINE;
        for (let i = 0; i < 3; i++) ctx.fillRect(vx + vw + spout - 2, spoutY + 16 + i * 9, 2, 5);
        label(ctx, `V = ${fmt(r.volume, 0)} mL`, cx + cw / 2 + 6, c.level, { size: labelSize, bold: true, color: WATER_LINE });
      }
      label(ctx, "Bình tràn", vx + vw / 2, vBottom - vh - (wood && stage === 2 ? 26 : 12), { size: labelSize, align: "center", color: COLORS.muted });
    }
    if (g.small) label(ctx, "Hình không theo tỉ lệ", g.x0 + 4, g.y0 + 6, { size: 10, color: COLORS.muted });
    if (stage === 2 && wood) label(ctx, "Gỗ nổi: ấn chìm bằng que mảnh", g.x0 + 4, g.y0 + (g.small ? 20 : 8), { size: labelSize, color: "#6b4f2a" });

    drawTable(ctx, s, g);
  },
});
