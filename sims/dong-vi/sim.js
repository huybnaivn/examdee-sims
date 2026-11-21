import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import {
  ELEMENTS, KEYS, TOLERANCE, SAMPLE, initialState, elementById, isotopesOf, percentages, naturalAverage, currentAverage, matches,
  sampleCounts, setPercent, resetMix,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ISO_COLORS = [COLORS.blue, COLORS.orange, COLORS.green];
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = n => String(n).replace(/\d/g, d => SUP[d]);
const fixed = (n, digits) => n.toFixed(digits).replace(".", ",").replace("-", "−");
/** Percent with only the decimals it needs (0,0115 % stays readable, 75,76 % too). */
const pct = p => `${fmt(p, p > 0 && p < 0.1 ? 4 : 2)} %`;
const isoName = (e, x) => `${sup(x.a)}${e.id}`;

/** label() that shrinks the font until the text fits in maxW. */
const fit = (ctx, text, x, y, maxW, opts) => {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: tw > maxW ? (opts.size * maxW) / tw : opts.size });
};

/** Fixed shuffle of the 100 grid cells for each element, so the isotopes look mixed rather than sorted. */
const order = id => {
  let seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 17);
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cells = [...Array(SAMPLE).keys()];
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
};

const outcome = s => {
  const p = percentages(s);
  const data = { average: currentAverage(s), natural: naturalAverage(s) };
  p.forEach((v, i) => (data[KEYS[i]] = v));
  return data;
};

/** After a finished slider move in "tự pha": report the mix, and the match once each time it is reached. */
function commit(s, api) {
  if (!s.custom) return;
  api.emit("mix-committed", outcome(s), "result");
  const hit = matches(s);
  if (hit && !s.matched) {
    api.emit("mix-matched", { average: currentAverage(s), natural: naturalAverage(s), difference: currentAverage(s) - naturalAverage(s) }, "goal");
  }
  s.matched = hit;
}

const sliders = KEYS.map((key, i) => ({
  type: "slider",
  key,
  label: `Đồng vị ${i + 1}`,
  min: 0,
  max: 100,
  step: 0.5,
  visible: s => s.custom && i < isotopesOf(s).length,
  format: (v, s) => `${isoName(elementById(s.element), isotopesOf(s)[i] ?? isotopesOf(s)[0])}: ${fixed(v, 1)} %`,
  onChange(s, api) {
    setPercent(s, i, s[key]);
    api.sync();
  },
  onCommit: commit,
}));

function layout(view) {
  const wide = view.w >= 560 && view.h >= 380;
  const pad = wide ? 16 : 8;
  const head = wide ? 80 : 50; // title, legend and the grid caption
  const foot = wide ? 64 : 24;
  const gridSize = Math.min(view.h - head - foot, view.w * (wide ? 0.42 : 0.44));
  // spare height goes above and below the whole picture, so it stays together on a tall stage
  const dy = Math.max(0, (view.h - head - foot - gridSize) / 2);
  const grid = { x: pad, y: head, size: gridSize };
  const chart = { x0: pad + gridSize + (wide ? 56 : 34), x1: view.w - pad - 4, y0: head + (wide ? 18 : 12), y1: head + gridSize - (wide ? 60 : 40) };
  return { wide, pad, head, foot, dy, h: head + gridSize + foot, grid, chart, size: wide ? 13 : 11 };
}

function drawGrid(ctx, s, g, e, counts) {
  const { x, y, size } = g.grid;
  const cell = size / 10;
  const kinds = [];
  counts.forEach((n, i) => kinds.push(...Array(n).fill(i)));
  const cells = order(e.id);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = COLORS.grid;
  ctx.strokeRect(x, y, size, size);
  const masses = e.isotopes.map(i => i.mass);
  kinds.forEach((k, n) => {
    const c = cells[n];
    // heavier isotope drawn a little larger (not to scale)
    const r = cell * (0.33 + (0.06 * (masses[k] - masses[0])) / Math.max(1, masses.at(-1) - masses[0]));
    ctx.fillStyle = ISO_COLORS[k];
    ctx.beginPath();
    ctx.arc(x + cell * ((c % 10) + 0.5), y + cell * (Math.floor(c / 10) + 0.5), r, 0, Math.PI * 2);
    ctx.fill();
  });
  label(ctx, g.wide ? "Mẫu 100 nguyên tử (số nguyên tử đã làm tròn)" : "Mẫu 100 nguyên tử", x, y - (g.wide ? 11 : 8), { size: g.size - 1, color: COLORS.muted });
}

function drawChart(ctx, s, g, e, p) {
  const { x0, x1, y0, y1 } = g.chart;
  const size = g.size;
  const iso = e.isotopes;
  const lo = Math.floor(iso[0].mass) - 1;
  const hi = Math.ceil(iso.at(-1).mass) + 1;
  const X = m => x0 + ((x1 - x0) * (m - lo)) / (hi - lo);
  const Y = v => y1 - ((y1 - y0) * v) / 100;

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let v = 0; v <= 100; v += 25) {
    ctx.beginPath();
    ctx.moveTo(x0, Y(v));
    ctx.lineTo(x1, Y(v));
    ctx.stroke();
    if (g.wide || v % 50 === 0) label(ctx, `${v}`, x0 - 5, Y(v), { size, align: "right", color: COLORS.muted });
  }
  label(ctx, g.wide ? "% số nguyên tử" : "%", x0 - (g.wide ? 40 : 26), y0 - size * 0.9 - 2, { size, color: COLORS.muted });
  const bw = Math.min(34, (x1 - x0) / (hi - lo) * 0.45);
  iso.forEach((x, i) => {
    ctx.fillStyle = ISO_COLORS[i];
    ctx.fillRect(X(x.mass) - bw / 2, Y(p[i]), bw, Y(0) - Y(p[i]));
    label(ctx, pct(p[i]), X(x.mass), Math.min(Y(p[i]) - size * 0.8, y1 - size * 0.8), { size: size - 1, align: "center", bold: true, color: ISO_COLORS[i] });
    label(ctx, isoName(e, x), X(x.mass), y1 + size, { size, align: "center", bold: true, color: ISO_COLORS[i] });
    if (g.wide) label(ctx, fixed(x.mass, 3), X(x.mass), y1 + size * 2.2, { size: size - 2, align: "center", color: COLORS.muted });
  });
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  // averages: a pointer under the axis
  const pointer = (m, color, text, below) => {
    const x = X(m);
    const yy = y1 + (g.wide ? size * 3.2 : size * 2.1) + below;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, yy - 7);
    ctx.lineTo(x - 6, yy + 3);
    ctx.lineTo(x + 6, yy + 3);
    ctx.closePath();
    ctx.fill();
    const right = x > (x0 + x1) / 2;
    label(ctx, text, x + (right ? -9 : 9), yy, { size: size - 1, bold: true, color, align: right ? "right" : "left" });
    ctx.strokeStyle = color;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const avg = currentAverage(s);
  if (s.custom) {
    pointer(naturalAverage(s), COLORS.muted, `tự nhiên ${fixed(naturalAverage(s), 3)}`, size * 1.4);
    pointer(avg, matches(s) ? COLORS.green : COLORS.red, `Ā = ${fixed(avg, 3)}`, 0);
  } else {
    pointer(avg, COLORS.ink, `Ā = ${fixed(avg, 3)}`, 0);
  }
}

mount({
  slug: "dong-vi",
  version: "1.0.0",
  title: "Đồng vị và nguyên tử khối trung bình",
  hint: "Chọn một nguyên tố để xem các đồng vị của nó. Bật “Tự pha” rồi kéo thanh trượt để pha một mẫu có nguyên tử khối trung bình bằng giá trị tự nhiên.",
  initialState,
  controls: [
    {
      type: "select",
      key: "element",
      label: "Nguyên tố",
      options: ELEMENTS.map(e => ({ value: e.id, label: `${e.name} (${e.id}), ${e.isotopes.length} đồng vị` })),
      onChange: resetMix,
    },
    { type: "checkbox", key: "custom", label: "Tự pha: tự chọn % các đồng vị", onChange: resetMix },
    ...sliders,
  ],
  readouts: [
    { label: "Ā tự nhiên", value: s => `${fixed(naturalAverage(s), 3)} amu` },
    { label: "Ā của mẫu đang xét", value: s => `${fixed(currentAverage(s), 3)} amu` },
    { label: "Chênh lệch", value: s => (s.custom ? `${fixed(currentAverage(s) - naturalAverage(s), 3)} amu` : "–") },
    { label: "Đạt (sai lệch ≤ 0,01 amu)", value: s => (s.custom ? (matches(s) ? "Đạt" : "Chưa") : "–") },
  ],
  draw(ctx, s, view) {
    const g = layout(view);
    const e = elementById(s.element);
    const p = percentages(s);
    const counts = sampleCounts(s);
    const w = view.w - 2 * g.pad;
    ctx.save();
    ctx.translate(0, g.dy);

    // header
    fit(ctx, `${e.name} (${e.id}), Z = ${e.z}${s.custom ? " · tự pha" : " · tự nhiên"}`, g.pad, g.wide ? 18 : 10, w, { size: g.wide ? 17 : 13, bold: true });
    let x = g.pad;
    const ly = g.wide ? 44 : 26;
    e.isotopes.forEach((iso, i) => {
      const text = g.wide ? `${isoName(e, iso)}: ${counts[i]} nguyên tử` : `${isoName(e, iso)}: ${counts[i]}`;
      ctx.fillStyle = ISO_COLORS[i];
      ctx.beginPath();
      ctx.arc(x + 5, ly, 5, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, text, x + 14, ly, { size: g.size, bold: true, color: ISO_COLORS[i] });
      ctx.font = `600 ${g.size}px ${FONT}`;
      x += 14 + ctx.measureText(text).width + (g.wide ? 20 : 10);
    });

    drawGrid(ctx, s, g, e, counts);
    drawChart(ctx, s, g, e, p);

    // the formula with the numbers in it
    const terms = e.isotopes.map((iso, i) => `${fixed(iso.mass, 3)} × ${fmt(p[i], 4)}`).join(" + ");
    const avg = currentAverage(s);
    const fy = g.h - (g.wide ? 40 : 12);
    fit(ctx, `Ā = (${terms}) / 100 = ${fixed(avg, 3)} amu`, g.pad, fy, w, { size: g.wide ? 15 : 12, bold: true });
    if (g.wide) {
      const note = s.custom
        ? matches(s)
          ? "Khớp với nguyên tử khối trung bình tự nhiên!"
          : `Cần ${avg < naturalAverage(s) ? "tăng" : "giảm"} tỉ lệ đồng vị nặng để Ā tiến tới ${fixed(naturalAverage(s), 3)} (sai lệch cho phép ±${fmt(TOLERANCE, 2)}).`
        : "Khối lượng đồng vị (amu) và % số nguyên tử trong tự nhiên; hình nguyên tử không theo tỉ lệ.";
      fit(ctx, note, g.pad, fy + 21, w, { size: 13, color: s.custom ? (matches(s) ? COLORS.green : COLORS.muted) : COLORS.muted });
    }
    ctx.restore();
  },
});
