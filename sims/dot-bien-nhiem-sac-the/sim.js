import { mount, COLORS, label } from "../../kit/v1/kit.js";
import {
  ORIGINAL, MAX_GENES, TYPE, SPECIES, NUM_TYPES, TARGETS, initialState, chromosomes, genes, segment, mutated, applyMutation,
  fitSegment, restore, haploid, pairIndex, counts, chromosomeCount, numCode, numName, formula, matchesTarget,
} from "./model.js";

const isSmall = view => view.w < 520 || view.h < 420;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const STRUCT_NAMES = ["Chưa đột biến", "Mất đoạn", "Lặp đoạn", "Đảo đoạn", "Chuyển đoạn"];
const isStructure = s => s.view !== "number";
const aneuploid = s => s.numType === "2n-1" || s.numType === "2n+1";
const geneCounts = s => {
  const c = chromosomes(s);
  return { genes1: genes(c.chr1).length, genes2: genes(c.chr2).length };
};

// ---------- events ----------
const report = (s, api, typeCode) => {
  api.emit("karyotype", { chromosomeCount: chromosomeCount(s), typeCode, ...geneCounts(s) }, "result");
};
const checkGoal = (s, api) => {
  const ok = matchesTarget(s);
  if (ok && s.solved !== s.target) api.emit("target-reached", { target: s.target, chromosomeCount: chromosomeCount(s) }, "goal");
  s.solved = ok ? s.target : 0;
};
// structural mutation buttons
const mutate = type => (s, api) => {
  const seg = segment(s);
  if (!applyMutation(s, type)) return;
  api.emit("mutate", { typeCode: type, start: seg.start + 1, length: seg.len }, "action");
  report(s, api, type);
};
// numerical mutation chosen in the panel
const numberChanged = (s, api) => {
  s.pair = pairIndex(s);
  api.emit("mutate", { typeCode: numCode(s), pair: aneuploid(s) ? s.pair : 0 }, "action");
  report(s, api, numCode(s));
  checkGoal(s, api);
};

// ---------- drawing ----------
/** Draw `text` wrapped to maxW, centred on x, first line at y. Returns the number of lines. */
function para(ctx, text, x, y, maxW, lineH, opts) {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  lines.forEach((l, i) => label(ctx, l, x, y + i * lineH, { ...opts, align: "center" }));
  return lines.length;
}

const geneColour = ch => `hsl(${((ch.charCodeAt(0) - 65) * 47) % 360} 62% 80%)`;

// One chromosome as a row of gene boxes; [a, b) is the highlighted part of the string, if any.
function drawChromosome(ctx, chr, x, y, bw, bh, { faded = false, a = -1, b = -1 } = {}) {
  ctx.save();
  if (faded) ctx.globalAlpha = 0.5;
  let cx = x;
  let selX0 = null;
  let selX1 = null;
  [...chr].forEach((ch, i) => {
    const w = ch === "." ? bw * 0.6 : bw;
    if (i === a) selX0 = cx;
    if (ch === ".") {
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.arc(cx + w / 2, y + bh / 2, Math.min(w, bh) * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = geneColour(ch);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx + 1, y, w - 2, bh, Math.min(6, bh / 4));
      ctx.fill();
      ctx.stroke();
      label(ctx, ch, cx + w / 2, y + bh / 2 + 1, { size: Math.min(18, bw * 0.55), bold: true, align: "center" });
    }
    cx += w;
    if (i === b - 1) selX1 = cx;
  });
  ctx.restore();
  if (selX0 != null && selX1 != null) {
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(selX0 - 2, y - 4, selX1 - selX0 + 4, bh + 8, 6);
    ctx.stroke();
  }
  return { x0: selX0, x1: selX1, end: cx };
}

function drawStructure(ctx, s, view) {
  const small = isSmall(view);
  const pad = small ? 10 : 36;
  const c = chromosomes(s);
  const seg = segment(s);
  const size = small ? 11 : 14;
  label(ctx, "Đột biến cấu trúc nhiễm sắc thể", pad, small ? 11 : 24, { size: small ? 13 : 18, bold: true });
  label(ctx, "Mỗi ô là một gene, ● là tâm động (hình vẽ quy ước).", pad, small ? 27 : 50, { size: small ? 10 : 13, color: COLORS.muted });

  const top = small ? 40 : 76;
  const bottom = small ? 66 : 112;
  const rowH = (view.h - top - bottom) / 3;
  const bw = Math.min(small ? 26 : 62, (view.w - 2 * pad) / (MAX_GENES + 0.6));
  const bh = Math.min(small ? 28 : 56, rowH - (small ? 24 : 40));
  const rows = [
    ["NST 1 ban đầu (để so sánh)", ORIGINAL.chr1, { faded: true }],
    ["NST 1", c.chr1, { a: seg.a, b: seg.b }],
    ["NST 2 (không tương đồng với NST 1)", c.chr2, {}],
  ];
  rows.forEach(([name, chr, opts], r) => {
    const y = top + r * rowH + (small ? 20 : 30);
    label(ctx, `${name}: ${genes(chr).length} gene`, pad, y - (small ? 11 : 16), { size, bold: r > 0, color: r ? COLORS.ink : COLORS.muted });
    const box = drawChromosome(ctx, chr, pad, y, bw, bh, opts);
    if (box.x0 != null) {
      label(ctx, "đoạn được chọn", Math.max((box.x0 + box.x1) / 2, pad + (small ? 40 : 52)), y + bh + (small ? 11 : 15), { size: small ? 10 : 12, color: COLORS.blue, align: "center", bold: true });
    }
  });

  const seen = /^[A-Z]{1,12}$/.test(s.lastSeg) ? s.lastSeg : "";
  const k = seen.length;
  const what = [
    "Chọn một đoạn trên NST 1 rồi bấm một dạng đột biến.",
    `Mất đoạn ${seen}: NST 1 mất ${k} gene.`,
    `Lặp đoạn ${seen}: đoạn này có thêm một bản, NST 1 tăng ${k} gene.`,
    `Đảo đoạn ${seen}: số gene không đổi, trật tự gene bị đảo ngược.`,
    `Chuyển đoạn ${seen} sang NST 2: các gene này đổi nhóm liên kết.`,
  ][seen ? s.lastType : 0] ?? "";
  const by = view.h - bottom + (small ? 18 : 30);
  const lineH = small ? 14 : 22;
  const n = para(ctx, what, view.w / 2, by, view.w - 2 * pad, lineH, { size: small ? 12 : 16, bold: true, color: s.lastType && seen ? COLORS.red : COLORS.ink });
  const hint = seg.hasCentromere
    ? "Đoạn đang chọn chứa tâm động: chỉ có thể đảo đoạn."
    : "Đột biến cấu trúc không làm thay đổi số lượng NST của tế bào.";
  para(ctx, hint, view.w / 2, by + n * lineH + (small ? 0 : 2), view.w - 2 * pad, small ? 12 : 18, { size: small ? 10 : 13, color: COLORS.muted });
}

function notes(s) {
  const key = NUM_TYPES[s.numType] ? s.numType : "2n";
  const pair = pairIndex(s);
  const n = haploid(s);
  const total = chromosomeCount(s);
  const definition = {
    "2n": `Bộ NST lưỡng bội bình thường: 2n = ${total}, mỗi cặp tương đồng có 2 chiếc.`,
    "2n-1": `Thể một (lệch bội): cặp NST số ${pair} chỉ còn 1 chiếc, tế bào có 2n − 1 = ${total} NST.`,
    "2n+1": `Thể ba (lệch bội): cặp NST số ${pair} có 3 chiếc, tế bào có 2n + 1 = ${total} NST.`,
    "3n": `Thể tam bội (đa bội): mỗi nhóm NST tương đồng có 3 chiếc, 3n = 3 × ${n} = ${total} NST.`,
    "4n": `Thể tứ bội (đa bội): mỗi nhóm NST tương đồng có 4 chiếc, 4n = 4 × ${n} = ${total} NST.`,
  }[key];
  let example = "";
  if (s.species === "watermelon") {
    if (key === "3n") example = "Ví dụ: dưa hấu tam bội không hạt, vì giảm phân rối loạn nên hầu như không tạo được hạt.";
    if (key === "4n") example = "Dưa hấu tứ bội được lai với cây lưỡng bội để tạo giống tam bội không hạt.";
  } else if (s.species === "datura") {
    if (key === "2n+1") example = "Cà độc dược có 12 dạng thể ba ứng với 12 cặp NST, mỗi dạng cho quả có hình dạng khác nhau.";
    if (key === "3n" || key === "4n") example = "Cây đa bội thường có tế bào to, cơ quan sinh dưỡng lớn.";
  } else if (s.species === "fly") {
    if (key === "3n" || key === "4n") example = "Thể đa bội hiếm gặp ở động vật, phổ biến ở thực vật.";
  } else if (key === "2n") example = "Người có 22 cặp NST thường và 1 cặp NST giới tính (XX hoặc XY).";
  else if (key === "2n+1") {
    example =
      { 21: "Ví dụ: hội chứng Down, người bệnh có 3 NST số 21 (47 NST).", 18: "Ví dụ: hội chứng Edwards, có 3 NST số 18 (47 NST).", 13: "Ví dụ: hội chứng Patau, có 3 NST số 13 (47 NST).", 23: "Ví dụ: XXX (siêu nữ) hoặc XXY (hội chứng Klinefelter), 47 NST." }[pair] ??
      "Ở người, phần lớn thể ba ở NST thường làm thai không phát triển được.";
  } else if (key === "2n-1") {
    example = pair === 23 ? "Ví dụ: hội chứng Turner, chỉ có 1 NST giới tính X (45 NST)." : "Ở người, thể một ở NST thường làm hợp tử không phát triển được.";
  } else example = "Ở người, hợp tử đa bội không sống được; thể đa bội phổ biến ở thực vật.";
  return [definition, example];
}

function rod(ctx, x, y, w, h, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h * 0.4 - 1, w / 2);
  ctx.roundRect(x, y + h * 0.4, w, h * 0.6, w / 2);
  ctx.fill();
}

function drawNumber(ctx, s, view) {
  const small = isSmall(view);
  const pad = small ? 10 : 36;
  const n = haploid(s);
  const list = counts(s);
  const pair = pairIndex(s);
  const species = SPECIES[s.species] ?? SPECIES.human;
  const poly = s.numType === "3n" || s.numType === "4n";
  label(ctx, `${species.name}: ${formula(s)} NST`, pad, small ? 11 : 24, { size: small ? 13 : 18, bold: true });
  label(ctx, numName(s), view.w - pad, small ? 11 : 24, { size: small ? 13 : 18, bold: true, align: "right", color: numCode(s) ? COLORS.red : COLORS.green });
  label(ctx, small ? "Mỗi nhóm gồm các NST tương đồng; kích thước vẽ quy ước." : "Mỗi nhóm gồm các NST tương đồng, đánh số theo cặp; kích thước và hình dạng vẽ quy ước.", pad, small ? 27 : 50, { size: small ? 10 : 13, color: COLORS.muted });

  const top = small ? 40 : 76;
  const bottom = small ? 84 : 132;
  const maxCols = Math.max(1, Math.floor((view.w - 2 * pad) / (small ? 34 : 62)));
  const rows = Math.ceil(n / maxCols);
  const cols = Math.ceil(n / rows);
  const cellW = Math.min((view.w - 2 * pad) / cols, small ? 60 : 110);
  const rowH = Math.min((view.h - top - bottom) / rows, small ? 110 : 220);
  const gx = (view.w - cellW * cols) / 2;
  const gy = top + (view.h - top - bottom - rowH * rows) / 2;
  const rw = small ? 5 : 9;
  const gap = small ? 2 : 4;
  const labelH = small ? 13 : 20;
  const rodMax = rowH - labelH - (small ? 8 : 16);
  for (let i = 0; i < n; i++) {
    const x = gx + (i % cols) * cellW;
    const y = gy + Math.floor(i / cols) * rowH;
    const hit = !poly && numCode(s) && i + 1 === pair;
    if (hit) {
      ctx.fillStyle = "rgba(229, 72, 77, 0.12)";
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, cellW - 2, rowH - 2, 6);
      ctx.fill();
      ctx.stroke();
    }
    const h = Math.max(14, rodMax * (1 - (0.55 * i) / Math.max(1, n - 1)));
    const groupW = list[i] * rw + (list[i] - 1) * gap;
    for (let j = 0; j < list[i]; j++) {
      rod(ctx, x + (cellW - groupW) / 2 + j * (rw + gap), y + (small ? 4 : 8) + rodMax - h, rw, h, hit ? COLORS.red : poly ? COLORS.purple : COLORS.blue);
    }
    const sex = s.species === "human" && i === 22;
    label(ctx, sex ? "X, Y" : `${i + 1}`, x + cellW / 2, y + rowH - labelH / 2 - 1, { size: small ? 10 : 13, align: "center", bold: hit, color: hit ? COLORS.red : COLORS.muted });
  }

  const [definition, example] = notes(s);
  const lineH = small ? 12 : 19;
  let y = view.h - bottom + (small ? 12 : 20);
  y += lineH * para(ctx, definition, view.w / 2, y, view.w - 2 * pad, lineH, { size: small ? 11 : 15, bold: true });
  if (example) y += lineH * para(ctx, example, view.w / 2, y + 1, view.w - 2 * pad, lineH, { size: small ? 10 : 13, color: COLORS.muted });
  const target = TARGETS.find(t => t.id === s.target);
  if (target) {
    const ok = matchesTarget(s);
    label(ctx, `${ok ? "Đã tạo đúng" : "Cần tạo"}: ${target.label}`, view.w / 2, view.h - (small ? 9 : 16), { size: small ? 11 : 14, bold: true, align: "center", color: ok ? COLORS.green : COLORS.orange });
  }
}

const structural = (text, type) => ({
  type: "button",
  label: text,
  action: mutate(type),
  visible: isStructure,
  disabled: s => !mutated(s, type),
});

mount({
  slug: "dot-bien-nhiem-sac-the",
  version: "1.0.0",
  title: "Đột biến nhiễm sắc thể",
  hint: "Chọn một đoạn trên NST rồi gây đột biến cấu trúc, hoặc chuyển sang đột biến số lượng để tạo thể lệch bội và đa bội.",
  initialState,
  controls: [
    {
      type: "select",
      key: "view",
      label: "Loại đột biến",
      options: [
        { value: "structure", label: "Đột biến cấu trúc NST" },
        { value: "number", label: "Đột biến số lượng NST" },
      ],
    },
    { type: "stepper", key: "segStart", label: "Đoạn bắt đầu từ gene thứ", min: 1, max: MAX_GENES, visible: isStructure, onChange: fitSegment },
    { type: "stepper", key: "segLen", label: "Số gene của đoạn", min: 1, max: 6, visible: isStructure, onChange: fitSegment },
    structural("Mất đoạn", TYPE.deletion),
    structural("Lặp đoạn", TYPE.duplication),
    structural("Đảo đoạn", TYPE.inversion),
    structural("Chuyển đoạn sang NST 2", TYPE.translocation),
    { type: "button", label: "Khôi phục NST ban đầu", action: restore, event: "restore", visible: isStructure, disabled: s => chromosomes(s).chr1 === ORIGINAL.chr1 && chromosomes(s).chr2 === ORIGINAL.chr2 },
    {
      type: "select",
      key: "species",
      label: "Loài",
      options: Object.entries(SPECIES).map(([value, sp]) => ({ value, label: `${sp.name} (2n = ${2 * sp.n})` })),
      visible: s => !isStructure(s),
      onCommit(s, api) {
        s.pair = pairIndex(s);
        report(s, api, numCode(s));
        checkGoal(s, api);
      },
    },
    {
      type: "select",
      key: "numType",
      label: "Bộ NST của tế bào",
      options: [
        { value: "2n", label: "2n – lưỡng bội bình thường" },
        { value: "2n-1", label: "2n − 1 – thể một" },
        { value: "2n+1", label: "2n + 1 – thể ba" },
        { value: "3n", label: "3n – thể tam bội" },
        { value: "4n", label: "4n – thể tứ bội" },
      ],
      visible: s => !isStructure(s),
      onCommit: numberChanged,
    },
    { type: "stepper", key: "pair", label: "Cặp NST bị lệch bội: số", min: 1, max: 23, visible: s => !isStructure(s) && aneuploid(s), onCommit: numberChanged },
    {
      type: "select",
      key: "target",
      label: "Thử thách: tạo bộ NST của",
      options: [{ value: 0, label: "Không có thử thách" }, ...TARGETS.map(t => ({ value: t.id, label: t.label }))],
      visible: s => !isStructure(s),
      onCommit: checkGoal,
    },
  ],
  readouts: [
    { label: "Số NST trong tế bào", value: s => `${formula(s)}` },
    { label: "Đột biến số lượng", value: s => numName(s) },
    { label: "Đột biến cấu trúc gần nhất", value: s => STRUCT_NAMES[s.lastType] ?? STRUCT_NAMES[0] },
    { label: "Trình tự gene NST 1", value: s => chromosomes(s).chr1.replace(".", "●") },
    { label: "Trình tự gene NST 2", value: s => chromosomes(s).chr2.replace(".", "●") },
  ],
  draw(ctx, s, view) {
    if (isStructure(s)) drawStructure(ctx, s, view);
    else drawNumber(ctx, s, view);
  },
});
