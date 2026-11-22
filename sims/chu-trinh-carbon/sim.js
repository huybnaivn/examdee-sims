import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { START, YEARS, TARGET_PPM, MAX_BURNING, MAX_DEFORESTATION, initialState, fluxes, simulate, total, ppm, peakPpm, meetsTarget, yearOf } from "./model.js";

const SPEED = 10; // simulated years per second
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// One scenario per pair of slider values; the whole 100-year run is recomputed only when they change.
let cache = { key: "", run: null };
const scenario = s => {
  const key = `${s.burning}|${s.deforestation}`;
  if (cache.key !== key) cache = { key, run: simulate(s) };
  return cache.run;
};

const restart = s => {
  s.year = 0;
};

// [long name, short name] – the short one is used when the box is too narrow.
const BOXES = {
  atm: { names: ["Khí quyển", "Khí quyển"], fill: "#e4eefc", x: [0.02, 0.98], row: 0 },
  plants: { names: ["Thực vật", "Thực vật"], fill: "#dff3e6", x: [0.02, 0.22], row: 1 },
  animals: { names: ["Động vật", "Động vật"], fill: "#fdeed9", x: [0.28, 0.46], row: 1 },
  ocean: { names: ["Đại dương", "Đại dương"], fill: "#d8ecf7", x: [0.6, 0.78], row: 1 },
  fossil: { names: ["Nhiên liệu hóa thạch", "Hóa thạch"], fill: "#e3e1e8", x: [0.82, 0.98], row: 1 },
  soil: { names: ["Đất (chất hữu cơ)", "Đất"], fill: "#efe3d3", x: [0.02, 0.53], row: 2 },
};

function layout(view) {
  const small = view.w < 560 || view.h < 430;
  const graphH = clamp(view.h * 0.34, 96, 240);
  const top = small ? 4 : 10;
  const dh = view.h - graphH - top; // height of the diagram
  const bh = clamp(dh * 0.2, 30, 60);
  const ys = [top, top + (dh - bh) / 2, top + dh - bh - 2];
  const box = {};
  for (const [k, b] of Object.entries(BOXES)) box[k] = { x: b.x[0] * view.w, y: ys[b.row], w: (b.x[1] - b.x[0]) * view.w, h: bh };
  return { small, box, graph: { x: small ? 40 : 58, y: top + dh + (small ? 12 : 20), w: view.w - (small ? 52 : 80), h: graphH - (small ? 32 : 52) } };
}

function drawBox(ctx, key, b, text, size) {
  ctx.fillStyle = BOXES[key].fill;
  ctx.strokeStyle = "#b9c4d8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.font = `600 ${size}px ${FONT}`;
  const [long, short] = BOXES[key].names;
  const name = ctx.measureText(long).width <= b.w - 8 ? long : short;
  if (key === "atm") return label(ctx, `${name}: ${text}`, b.x + b.w / 2, b.y + b.h / 2, { size, bold: true, align: "center" });
  label(ctx, name, b.x + b.w / 2, b.y + b.h / 2 - size * 0.62, { size, bold: true, align: "center" });
  label(ctx, text, b.x + b.w / 2, b.y + b.h / 2 + size * 0.68, { size, align: "center", color: COLORS.muted });
}

// A flux arrow with its value (and its name when there is room) on the given side.
function flux(ctx, L, s, value, name, color, x1, y1, x2, y2, side, at = 0.5) {
  const width = value > 0 ? clamp(1.2 + 0.45 * Math.sqrt(value), 1.5, 7) : 1;
  if (value > 0.005) arrow(ctx, x1, y1, x2, y2, color, width);
  else {
    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }
  const size = L.small ? 11 : 13;
  const text = fmt(value, value < 10 ? 1 : 0);
  const x = x1 + (x2 - x1) * at;
  const y = y1 + (y2 - y1) * at;
  if (side === "above") return label(ctx, L.small || !s.showNames ? text : `${name} ${text}`, x, y - 11, { size, align: "center", color });
  const align = side === "left" ? "right" : "left";
  const lx = x + (side === "left" ? -8 : 8);
  if (L.small || !s.showNames) return label(ctx, text, lx, y, { size, align, color, bold: true });
  label(ctx, name, lx, y - 8, { size, align, color });
  label(ctx, text, lx, y + 8, { size, align, color, bold: true });
}

function drawGraph(ctx, L, s, run, year) {
  const g = L.graph;
  const size = L.small ? 10 : 12;
  const lo = 250;
  const hi = Math.max(500, Math.ceil((peakPpm(run) * 1.06) / 50) * 50);
  const X = y => g.x + (y / YEARS) * g.w;
  const Y = v => g.y + g.h - ((v - lo) / (hi - lo)) * g.h;
  ctx.fillStyle = "#fff";
  ctx.fillRect(g.x, g.y, g.w, g.h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const stepY = hi - lo > 500 ? 250 : hi - lo > 250 ? 100 : 50;
  for (let v = Math.ceil(lo / stepY) * stepY; v <= hi; v += stepY) {
    ctx.beginPath();
    ctx.moveTo(g.x, Y(v));
    ctx.lineTo(g.x + g.w, Y(v));
    ctx.stroke();
    label(ctx, fmt(v, 0), g.x - 5, Y(v), { size, align: "right", color: COLORS.muted });
  }
  for (let y = 0; y < YEARS; y += 25) label(ctx, String(y), X(y), g.y + g.h + 9, { size, align: "center", color: COLORS.muted });
  label(ctx, `${YEARS} năm`, g.x + g.w + 10, g.y + g.h + 9, { size, color: COLORS.muted, align: "right" });
  label(ctx, "CO₂ khí quyển (ppm)", g.x, g.y - 9, { size, color: COLORS.muted });
  ctx.strokeStyle = COLORS.muted;
  ctx.strokeRect(g.x, g.y, g.w, g.h);

  // target
  ctx.save();
  ctx.strokeStyle = COLORS.red;
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(g.x, Y(TARGET_PPM));
  ctx.lineTo(g.x + g.w, Y(TARGET_PPM));
  ctx.stroke();
  ctx.restore();
  label(ctx, `Mục tiêu: dưới ${TARGET_PPM} ppm`, g.x + g.w - 4, g.y - 9, { size, align: "right", color: COLORS.red });

  const path = to => {
    ctx.beginPath();
    for (let y = 0; y <= to; y++) ctx[y ? "lineTo" : "moveTo"](X(y), Y(ppm(run[y])));
    ctx.stroke();
  };
  // forecast for the current settings (dashed), then the part already played (solid)
  ctx.save();
  ctx.strokeStyle = "#9db4e6";
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 4]);
  path(YEARS);
  ctx.restore();
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  path(year);
  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.arc(X(year), Y(ppm(run[year])), 4.5, 0, Math.PI * 2);
  ctx.fill();
  const end = ppm(run[year]);
  const right = year > YEARS * 0.7;
  label(ctx, `Năm ${year}: ${fmt(end, 0)} ppm`, X(year) + (right ? -9 : 9), Y(end) + (Y(end) < g.y + 22 ? 14 : -12), { size: size + 1, bold: true, color: COLORS.blue, align: right ? "right" : "left" });
  if (!L.small) label(ctx, "Nét đứt: dự báo với thiết lập hiện tại", g.x + g.w - 8, g.y + g.h - 10, { size: 11, color: COLORS.muted, align: "right" });
}

mount({
  slug: "chu-trinh-carbon",
  version: "1.0.0",
  title: "Chu trình carbon",
  hint: "Chọn mức đốt nhiên liệu hóa thạch và phá rừng rồi bấm Chạy để mô phỏng 100 năm. Mô hình hộp đơn giản hóa, số liệu làm tròn; kích thước các ô không theo tỉ lệ.",
  initialState,
  step(s, dt, api) {
    if (!(s.year >= 0 && s.year < YEARS)) s.year = 0; // Chạy after a finished run plays it again
    s.year = Math.min(YEARS, s.year + dt * SPEED);
    if (s.year < YEARS) return;
    api.pause();
    const run = scenario(s);
    const data = { years: YEARS, co2: ppm(run[YEARS]), peakCo2: peakPpm(run), burning: s.burning, deforestation: s.deforestation };
    api.emit("run-finished", data, "result");
    const reached = { co2: data.co2, target: TARGET_PPM };
    if (meetsTarget(run)) api.emit("co2-below-target", reached, "goal");
  },
  controls: [
    { type: "slider", key: "burning", label: "Đốt nhiên liệu hóa thạch", min: 0, max: MAX_BURNING, step: 1, unit: "GtC/năm", digits: 0, onChange: restart },
    { type: "slider", key: "deforestation", label: "Diện tích rừng bị phá", min: 0, max: MAX_DEFORESTATION, step: 5, unit: "%", digits: 0, onChange: restart },
    { type: "checkbox", key: "showNames", label: "Hiện tên các dòng carbon" },
  ],
  readouts: [
    { label: "Năm", value: s => `${yearOf(s)} / ${YEARS}` },
    { label: "CO₂ khí quyển", value: s => `${fmt(ppm(scenario(s)[yearOf(s)]), 0)} ppm` },
    { label: "Đỉnh CO₂ dự báo", value: s => `${fmt(peakPpm(scenario(s)), 0)} ppm` },
    { label: "Tổng carbon của 6 kho", value: s => `${fmt(total(scenario(s)[yearOf(s)]), 0)} GtC` },
    { label: "Mục tiêu", value: s => (meetsTarget(scenario(s)) ? `Đạt (dưới ${TARGET_PPM} ppm)` : `Chưa đạt (vượt ${TARGET_PPM} ppm)`) },
  ],
  draw(ctx, s, view) {
    const L = layout(view);
    const run = scenario(s);
    const year = yearOf(s);
    const r = run[year];
    const f = fluxes(r, s);
    const { atm, plants, animals, ocean, fossil, soil } = L.box;
    const size = L.small ? 11 : 13;
    const gt = v => `${fmt(v, v < 100 ? 1 : 0)} GtC`;

    const yA = atm.y + atm.h + 2; // lower edge of the atmosphere
    const yM = plants.y - 2; // upper edge of the middle row
    const yB = plants.y + plants.h + 2;
    const yS = soil.y - 2;
    const cx = b => b.x + b.w / 2;

    flux(ctx, L, s, f.photosynthesis, "Quang hợp", COLORS.green, plants.x + plants.w * 0.42, yA, plants.x + plants.w * 0.42, yM, "left");
    flux(ctx, L, s, f.plantRespiration, "Hô hấp", COLORS.orange, plants.x + plants.w * 0.72, yM, plants.x + plants.w * 0.72, yA, "right");
    flux(ctx, L, s, f.eaten, "Ăn", COLORS.green, plants.x + plants.w + 2, plants.y + plants.h / 2, animals.x - 2, plants.y + plants.h / 2, "above");
    flux(ctx, L, s, f.animalRespiration, "Hô hấp", COLORS.orange, cx(animals), yM, cx(animals), yA, "right");
    flux(ctx, L, s, f.litter, "Xác, lá rụng", "#8a6a3a", cx(plants), yB, cx(plants), yS, "right");
    flux(ctx, L, s, f.animalWaste, "Chất thải, xác", "#8a6a3a", cx(animals), yB, cx(animals), yS, "right");
    const xd = soil.x + soil.w - Math.min(22, soil.w * 0.06);
    flux(ctx, L, s, f.decomposition, "Phân giải", COLORS.purple, xd, yS, xd, yA, "right", 0.3);
    flux(ctx, L, s, f.oceanUptake, "Hòa tan", COLORS.blue, ocean.x + ocean.w * 0.38, yA, ocean.x + ocean.w * 0.38, yM, "left");
    flux(ctx, L, s, f.oceanRelease, "Thoát ra", COLORS.orange, ocean.x + ocean.w * 0.7, yM, ocean.x + ocean.w * 0.7, yA, "right");
    flux(ctx, L, s, f.combustion, "Đốt cháy", COLORS.red, cx(fossil), yM, cx(fossil), yA, "left");

    drawBox(ctx, "atm", atm, `${gt(r.atm)} ≈ ${fmt(ppm(r), 0)} ppm CO₂`, size + 1);
    drawBox(ctx, "plants", plants, gt(r.plants), size);
    drawBox(ctx, "animals", animals, gt(r.animals), size);
    drawBox(ctx, "ocean", ocean, gt(r.ocean), size);
    drawBox(ctx, "fossil", fossil, gt(r.fossil), size);
    drawBox(ctx, "soil", soil, gt(r.soil), size);
    // units of the arrows, in the free corner under the ocean and the fossil box
    const nx = ocean.x;
    const ny = soil.y + soil.h / 2;
    label(ctx, L.small ? "Mũi tên: GtC/năm" : "Số trên mũi tên: dòng carbon (GtC/năm)", nx, ny - (L.small ? 0 : 9), { size: L.small ? 10 : 12, color: COLORS.muted });
    if (!L.small) label(ctx, "1 GtC = 1 tỉ tấn carbon; 1 ppm CO₂ ≈ 2,13 GtC", nx, ny + 9, { size: 12, color: COLORS.muted });

    drawGraph(ctx, L, s, run, year);
  },
});
