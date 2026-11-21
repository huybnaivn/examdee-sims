import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, cross, observed, breed, clear, bredOf, expectedDominant, dominantKey, phenotype, phenotypeName, ratio, MAX_OFFSPRING } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FLOWER = { d: "#8e4ec6", r: "#ffffff" };
const FLOWER_INCOMPLETE = { d: "#e5484d", h: "#f4a3b8", r: "#ffffff" };
const flowerColor = (key, s) => (s.incomplete ? FLOWER_INCOMPLETE : FLOWER)[key[0]];
const percent = (x, digits = 1) => `${fmt(x * 100, digits)}%`;

// observed() replays the generator, so keep the last answer while nothing it depends on changes.
let memo = { key: "", value: {} };
function seen(s) {
  const key = [s.seed, bredOf(s), s.genes, s.incomplete, s.motherA, s.motherB, s.fatherA, s.fatherB].join("|");
  if (memo.key !== key) memo = { key, value: observed(s) };
  return memo.value;
}

const restart = s => {
  s.bred = 0; // the offspring bred so far belong to another cross
};

/** A pea plant: flower colour shows gene A, stem height shows gene B (medium when only one gene). */
function plant(ctx, x, base, size, key, s) {
  const stem = size * (key.length < 2 ? 0.6 : key[1] === "d" ? 0.9 : 0.4);
  const r = Math.max(3, size * 0.2);
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.lineTo(x, base - stem);
  ctx.stroke();
  ctx.fillStyle = flowerColor(key, s);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, base - stem - r * 0.6, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Write "a : b : c", wrapping between terms. Returns the y of the next line. */
function flow(ctx, terms, x, y, maxW, size) {
  ctx.font = `600 ${size}px ${FONT}`;
  let line = "";
  terms.forEach((term, i) => {
    const piece = i < terms.length - 1 ? `${term} : ` : term;
    if (line && ctx.measureText(line + piece).width > maxW) {
      label(ctx, line, x, y, { size, bold: true });
      y += size * 1.4;
      line = "";
    }
    line += piece;
  });
  label(ctx, line, x, y, { size, bold: true });
  return y + size * 1.4;
}

const terms = (classes, name) =>
  classes.length === 1 ? [`100% ${name(classes[0])}`] : ratio(classes.map(c => c.count)).map((n, i) => `${n} ${name(classes[i])}`);

function drawSquare(ctx, s, c, x, y, hdr, cell) {
  const rows = c.motherGametes.length;
  const cols = c.fatherGametes.length;
  const size = Math.max(9, Math.min(17, cell * 0.27));
  const icon = cell >= 44;
  // header cells: gametes
  ctx.fillStyle = "#fdeced";
  ctx.fillRect(x, y + hdr, hdr, cell * rows);
  ctx.fillStyle = "#e9f0fe";
  ctx.fillRect(x + hdr, y, cell * cols, hdr);
  label(ctx, "♀", x + hdr * 0.3, y + hdr * 0.7, { size: Math.min(15, hdr * 0.5), color: COLORS.red, align: "center", bold: true });
  label(ctx, "♂", x + hdr * 0.7, y + hdr * 0.3, { size: Math.min(15, hdr * 0.5), color: COLORS.blue, align: "center", bold: true });
  c.fatherGametes.forEach((g, j) => label(ctx, g, x + hdr + cell * (j + 0.5), y + hdr / 2, { size, bold: true, align: "center", color: COLORS.blue }));
  c.motherGametes.forEach((g, i) => label(ctx, g, x + hdr / 2, y + hdr + cell * (i + 0.5), { size, bold: true, align: "center", color: COLORS.red }));
  // offspring cells, tinted with the flower colour
  c.grid.forEach((row, i) =>
    row.forEach((genotype, j) => {
      const cx = x + hdr + cell * j;
      const cy = y + hdr + cell * i;
      const key = phenotype(genotype, s.incomplete);
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx, cy, cell, cell);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = flowerColor(key, s);
      ctx.fillRect(cx, cy, cell, cell);
      ctx.globalAlpha = 1;
      label(ctx, genotype, cx + cell / 2, cy + (icon ? cell * 0.22 : cell / 2), { size, bold: true, align: "center" });
      if (icon) plant(ctx, cx + cell / 2, cy + cell * 0.94, cell * 0.5, key, s);
    })
  );
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= rows; i++) {
    ctx.moveTo(x, y + hdr + cell * i);
    ctx.lineTo(x + hdr + cell * cols, y + hdr + cell * i);
  }
  for (let j = 0; j <= cols; j++) {
    ctx.moveTo(x + hdr + cell * j, y);
    ctx.lineTo(x + hdr + cell * j, y + hdr + cell * rows);
  }
  ctx.moveTo(x, y);
  ctx.lineTo(x + hdr, y + hdr);
  ctx.stroke();
  ctx.strokeRect(x, y, hdr + cell * cols, hdr + cell * rows);
}

function drawChart(ctx, s, c, box, small) {
  const n = bredOf(s);
  const counts = seen(s);
  const size = small ? 10 : 12;
  const two = s.genes === 2;
  const top = box.y + (small ? 30 : 50);
  const bottom = box.y + box.h - (two ? size * 2.6 : size * 1.4) - 4;
  const expected = c.phenotypes.map(p => p.count / c.total);
  const actual = c.phenotypes.map(p => (n ? (counts[p.key] ?? 0) / n : 0));
  const max = Math.max(...expected, ...actual);
  const gw = box.w / c.phenotypes.length;
  const bw = Math.min(gw * 0.34, 46);
  const digits = bw >= 40 ? 1 : 0; // two labels side by side must not collide

  if (!small) label(ctx, "Tỉ lệ kiểu hình ở đời con", box.x, box.y + 8, { size: 14, bold: true });
  const ly = box.y + (small ? 7 : 28);
  ctx.fillStyle = COLORS.grid;
  ctx.strokeStyle = COLORS.muted;
  ctx.fillRect(box.x, ly - 5, 10, 10);
  ctx.strokeRect(box.x, ly - 5, 10, 10);
  label(ctx, "Lí thuyết", box.x + 15, ly, { size, color: COLORS.muted });
  ctx.fillStyle = COLORS.blue;
  ctx.fillRect(box.x + 78, ly - 5, 10, 10);
  label(ctx, n ? `Quan sát (${fmt(n, 0)} cá thể con)` : "Quan sát: chưa lai tạo đời con", box.x + 93, ly, { size, color: COLORS.muted });

  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.x, bottom);
  ctx.lineTo(box.x + box.w, bottom);
  ctx.stroke();

  c.phenotypes.forEach((p, i) => {
    const cx = box.x + gw * (i + 0.5);
    const he = (expected[i] / max) * (bottom - top);
    const ho = (actual[i] / max) * (bottom - top);
    ctx.fillStyle = COLORS.grid;
    ctx.strokeStyle = COLORS.muted;
    ctx.fillRect(cx - bw - 1, bottom - he, bw, he);
    ctx.strokeRect(cx - bw - 1, bottom - he, bw, he);
    label(ctx, percent(expected[i], digits), cx - bw / 2 - 1, bottom - he - 8, { size, align: "center", color: COLORS.muted });
    if (n) {
      ctx.fillStyle = COLORS.blue;
      ctx.fillRect(cx + 1, bottom - ho, bw, ho);
      label(ctx, percent(actual[i], digits), cx + bw / 2 + 1, bottom - ho - 8, { size, align: "center", color: COLORS.blue, bold: true });
    }
    // flower-colour dot, then the name (two lines when there are two traits)
    const [first, second] = p.name.split(", ");
    const text = two ? first + "," : first;
    ctx.font = `${size}px ${FONT}`;
    const tw = ctx.measureText(text).width;
    const dot = tw + 14 < gw; // drop the dot when the groups are narrow
    if (dot) {
      ctx.fillStyle = flowerColor(p.key, s);
      ctx.strokeStyle = COLORS.muted;
      ctx.beginPath();
      ctx.arc(cx - tw / 2 - 3, bottom + size * 0.9, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    label(ctx, text, cx + (dot ? 5 : 0), bottom + size * 0.9, { size, align: "center" });
    if (two) label(ctx, second, cx, bottom + size * 2.1, { size, align: "center" });
  });
}

mount({
  slug: "lai-menden",
  version: "1.0.0",
  title: "Phép lai Men-đen",
  hint: "Chọn kiểu gene của bố mẹ rồi bấm «Lai tạo đời con» để so sánh tỉ lệ quan sát được với tỉ lệ lí thuyết.",
  initialState,
  controls: [
    {
      type: "select",
      key: "genes",
      label: "Số cặp gene",
      onChange: restart,
      options: [
        { value: 1, label: "Một cặp gene (A, a)" },
        { value: 2, label: "Hai cặp gene phân li độc lập (A, a và B, b)" },
      ],
    },
    { type: "checkbox", key: "incomplete", label: "Allele A trội không hoàn toàn so với a", onChange: restart },
    { type: "heading", label: "Kiểu gene của bố mẹ (P)" },
    ...[["mother", "Mẹ (♀)"], ["father", "Bố (♂)"]].flatMap(([who, name]) => [
      {
        type: "select",
        key: who + "A",
        label: `${name}: cặp gene A, a`,
        onChange: restart,
        options: [
          { value: "AA", label: "AA – đồng hợp trội" },
          { value: "Aa", label: "Aa – dị hợp" },
          { value: "aa", label: "aa – đồng hợp lặn" },
        ],
      },
      {
        type: "select",
        key: who + "B",
        label: `${name}: cặp gene B, b`,
        onChange: restart,
        visible: s => s.genes === 2,
        options: [
          { value: "BB", label: "BB – đồng hợp trội" },
          { value: "Bb", label: "Bb – dị hợp" },
          { value: "bb", label: "bb – đồng hợp lặn" },
        ],
      },
    ]),
    { type: "heading", label: "Lai tạo" },
    { type: "slider", key: "batch", label: "Số cá thể con mỗi lần lai", min: 10, max: 1000, step: 10, digits: 0 },
    {
      type: "button",
      label: "Lai tạo đời con",
      primary: true,
      disabled: s => bredOf(s) >= MAX_OFFSPRING,
      action(s, api) {
        const r = breed(s, s.batch);
        if (!r.count) return;
        api.emit("breed", { count: r.count }, "action");
        api.emit("batch-result", { count: r.count, observed: r.observed, expected: r.expected, total: s.bred }, "result");
      },
    },
    { type: "button", label: "Xoá kết quả", action: clear, event: "clear-offspring", disabled: s => bredOf(s) === 0 },
  ],
  readouts: [
    { label: "Số cá thể con đã tạo", value: s => fmt(bredOf(s), 0) },
    { label: "Kiểu hình trội – lí thuyết", value: s => `${percent(expectedDominant(s), 2)} (${phenotypeName(dominantKey(s), s.incomplete)})` },
    {
      label: "Kiểu hình trội – quan sát",
      value: s => (bredOf(s) ? `${percent((seen(s)[dominantKey(s)] ?? 0) / bredOf(s), 2)} (${fmt(seen(s)[dominantKey(s)] ?? 0, 0)} cá thể)` : "–"),
    },
  ],
  draw(ctx, s, view) {
    const c = cross(s);
    const small = view.w < 560;
    const pad = small ? 8 : 24;
    const rows = c.motherGametes.length;
    const cols = c.fatherGametes.length;
    const size = small ? 11 : 14;

    // left (or top-left): the cross and its Punnett square
    const leftW = view.w * 0.42;
    const y0 = small ? 26 : 86;
    const availH = small ? view.h * 0.5 - y0 : view.h - y0 - 84;
    const hdr = small ? 20 : 40;
    const cell = Math.max(14, Math.min((leftW - pad - hdr) / cols, (availH - hdr) / rows, 104));
    const sqW = hdr + cell * cols;
    const sqX = small ? pad : pad + (leftW - pad - sqW) / 2;
    label(ctx, `P:  ♀ ${c.mother}  ×  ♂ ${c.father}`, small ? pad : pad + (leftW - pad) / 2, small ? 12 : 34, { size: small ? 13 : 19, bold: true, align: small ? "left" : "center" });
    if (!small) label(ctx, "Sơ đồ lai (bảng Punnett)", pad + (leftW - pad) / 2, 62, { size: 12, color: COLORS.muted, align: "center" });
    drawSquare(ctx, s, c, sqX, y0, hdr, cell);
    const sqBottom = y0 + hdr + cell * rows;
    if (!small) {
      // notes under the square, each only if it fits the column
      ctx.font = `12px ${FONT}`;
      const notes = [
        "Cột trái: giao tử của ♀; hàng trên: giao tử của ♂",
        `Mỗi ô của sơ đồ có xác suất như nhau: 1/${c.total}`,
        s.genes === 2 ? "Hình vẽ: gene A quy định màu hoa, gene B quy định chiều cao thân" : "Hình vẽ: gene A quy định màu hoa",
      ].filter(text => ctx.measureText(text).width <= leftW - pad);
      notes.forEach((text, i) => label(ctx, text, pad + (leftW - pad) / 2, sqBottom + 20 + 19 * i, { size: 12, color: COLORS.muted, align: "center" }));
    }

    // right: expected ratios, then the bar chart
    const rx = small ? sqX + sqW + 10 : leftW + pad;
    const rw = view.w - rx - pad;
    let y = small ? 30 : 34;
    label(ctx, "Tỉ lệ kiểu gene (lí thuyết)", rx, y, { size: size - 1, color: COLORS.muted });
    y = flow(ctx, terms(c.genotypes, g => g.genotype), rx, y + size * 1.45, rw, size);
    y += small ? 4 : 10;
    label(ctx, "Tỉ lệ kiểu hình (lí thuyết)", rx, y, { size: size - 1, color: COLORS.muted });
    y = flow(ctx, terms(c.phenotypes, p => p.name), rx, y + size * 1.45, rw, size);

    const cy = small ? Math.max(y, sqBottom + 10) : y + 16;
    const cx = small ? pad : rx;
    drawChart(ctx, s, c, { x: cx, y: cy, w: view.w - cx - pad, h: view.h - cy - (small ? 2 : 16) }, small);
  },
});
