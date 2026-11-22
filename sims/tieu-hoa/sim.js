import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  ORGANS, PLACEABLE, POOL_NAMES, TOTAL, initialState, newMeal, normalize, step,
  position, enzymesIn, digested, absorbed, matched, matchCount,
} from "./model.js";

const FONT = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const pct = x => `${fmt(100 * x, 0)} %`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** One line, shrunk (down to 8 px) when it is wider than maxW. */
function fitLabel(ctx, text, x, y, maxW, opts) {
  ctx.font = FONT(opts.size, opts.bold);
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: w > maxW ? Math.max(8, (opts.size * maxW) / w) : opts.size });
}

function wrap(ctx, text, maxW, size) {
  ctx.font = FONT(size);
  const lines = [""];
  for (const word of text.split(" ")) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (ctx.measureText(next).width > maxW && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  return lines;
}

const phColor = pH => (pH < 4 ? COLORS.red : pH < 6.9 ? COLORS.orange : pH <= 7.5 ? COLORS.green : COLORS.blue);

// Bars: [pool, text, role]; role 0 = undigested, 1 = intermediate, 2 = final product, 3 / 4 = absorbed.
const ROWS = [
  { name: "Tinh bột", color: "47, 111, 237", parts: [["starch", "tinh bột", 0], ["maltose", "maltose", 1], ["glucose", "glucose", 2], ["absGlucose", "đã hấp thụ", 3]], done: s => digested(s).starch },
  { name: "Protein", color: "229, 72, 77", parts: [["protein", "protein", 0], ["peptide", "peptide", 1], ["amino", "amino acid", 2], ["absAmino", "đã hấp thụ", 3]], done: s => digested(s).protein },
  { name: "Lipid", color: "240, 140, 46", parts: [["lipid", "lipid", 0], ["glyFat", "glycerol + acid béo", 2], ["absGlyFat", "đã hấp thụ", 3]], done: s => digested(s).lipid },
  { name: "Nước", color: "107, 120, 144", parts: [["water", "nước", 2], ["absWaterSmall", "hấp thụ ở ruột non", 3], ["absWaterLarge", "ở ruột già", 4]] },
];
const ALPHA = [1, 0.6, 0.28];
const fill = (rgb, role) => (role === 3 ? COLORS.green : role === 4 ? "#14694a" : `rgba(${rgb}, ${ALPHA[role]})`);

const statusText = s => {
  if (s.t >= TOTAL) {
    const d = digested(s);
    return `Bữa ăn đã đi hết ống tiêu hóa. Đã tiêu hóa hoàn toàn: tinh bột ${pct(d.starch)}, protein ${pct(d.protein)}, lipid ${pct(d.lipid)}.`;
  }
  const organ = ORGANS[position(s.t).i];
  const active = enzymesIn(s, organ).filter(e => e.active);
  const acts =
    active.length > 2
      ? `${active.map(e => e.name.toLowerCase()).join(", ")} đang hoạt động.`
      : active.length
        ? `${active.map(e => `${e.name.toLowerCase()} biến ${POOL_NAMES[e.from]} thành ${POOL_NAMES[e.to]}`).join("; ")}.`
        : "không có enzyme tiêu hóa nào hoạt động.";
  return `${organ.name}: ${acts} ${organ.note}`;
};

const restart = s => newMeal(s);

mount({
  slug: "tieu-hoa",
  version: "1.0.0",
  title: "Hệ tiêu hóa ở người",
  hint: "Bấm Chạy để theo dõi bữa ăn đi qua ống tiêu hóa. Ở chế độ thử thách, hãy đặt mỗi enzyme vào đúng cơ quan.",
  initialState,
  timeScale: s => s.speed,
  step(s, dt, api) {
    if (s.t >= TOTAL) newMeal(s); // "Chạy" after the end starts the same meal again
    step(s, dt);
    if (s.t >= TOTAL) {
      const d = digested(s);
      const a = absorbed(s);
      api.emit("meal-digested", { starchDigested: d.starch, proteinDigested: d.protein, lipidDigested: d.lipid, starchAbsorbed: a.starch, proteinAbsorbed: a.protein, lipidAbsorbed: a.lipid, waterAbsorbed: a.water, hours: s.t }, "result");
      api.pause();
    }
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Chế độ",
      onChange: restart,
      options: [
        { value: "body", label: "Cơ thể người (enzyme ở đúng vị trí)" },
        { value: "quiz", label: "Thử thách: tự đặt enzyme" },
      ],
    },
    { type: "heading", label: "Enzyme này hoạt động ở đâu?", visible: s => s.mode === "quiz" },
    ...PLACEABLE.map(e => ({
      type: "select",
      key: e.key,
      label: e.name,
      visible: s => s.mode === "quiz",
      onChange: restart,
      onCommit(s, api) {
        if (matched(s)) api.emit("enzymes-matched", { enzymes: PLACEABLE.length }, "goal");
      },
      options: [{ value: "none", label: "— chưa đặt —" }, ...ORGANS.map(o => ({ value: o.id, label: o.name }))],
    })),
    { type: "slider", key: "speed", label: "Tốc độ mô phỏng", min: 0.5, max: 4, step: 0.5, format: v => `× ${fmt(v, 1)}` },
    {
      type: "button",
      label: "Ăn bữa mới",
      event: "new-meal",
      action(s, api) {
        newMeal(s);
        api.play();
      },
    },
  ],
  readouts: [
    { label: "Thức ăn đang ở", value: s => (s.t >= TOTAL ? "cuối ruột già" : ORGANS[position(s.t).i].name) },
    { label: "Thời gian từ lúc ăn", value: s => (s.t < 0.1 ? `${fmt(s.t * 3600, 0)} giây` : `${fmt(s.t, 1)} giờ`) },
    { label: "Tinh bột → glucose", value: s => pct(digested(s).starch) },
    { label: "Protein → amino acid", value: s => pct(digested(s).protein) },
    { label: "Lipid → glycerol + acid béo", value: s => pct(digested(s).lipid) },
    { label: "Nước đã hấp thụ", value: s => pct(absorbed(s).water) },
    { label: "Enzyme đặt đúng", value: s => (s.mode === "quiz" ? `${matchCount(s)}/${PLACEABLE.length}${matched(s) ? " ✓" : ""}` : "theo cơ thể người") },
  ],
  draw(ctx, s, view) {
    normalize(s);
    const small = view.w < 560 || view.h < 430;
    const pad = small ? 6 : 16;
    const fs = small ? 10 : 13;
    const barH = small ? 16 : 26;
    const barGap = small ? 4 : 8;
    const lineH = fs + (small ? 2 : 5);
    const statusH = lineH * (small ? 3 : 2) + 4;
    const legendH = small ? 14 : 24;
    const noteH = small ? 12 : 20;
    const below = statusH + ROWS.length * (barH + barGap) + legendH + noteH;
    const boxH = clamp(view.h - 2 * pad - below - 6, 80, 330);
    let y = Math.max(pad, (view.h - boxH - below - 6) / 2);
    const here = position(s.t);
    const done = s.t >= TOTAL;

    // ---- organs ----
    const gap = small ? 6 : 26;
    const bw = (view.w - 2 * pad - 3 * gap) / 4;
    const trackY = y + boxH - (small ? 12 : 20);
    ORGANS.forEach((organ, i) => {
      const x = pad + i * (bw + gap);
      const current = !done && i === here.i;
      roundRect(ctx, x, y, bw, boxH, small ? 8 : 12);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = current ? COLORS.ink : COLORS.grid;
      ctx.lineWidth = current ? 2.5 : 1.5;
      ctx.stroke();
      const cx = x + bw / 2;
      let ty = y + (small ? 11 : 18);
      label(ctx, organ.name, cx, ty, { size: fs + 3, bold: true, align: "center" });
      // pH chip
      ty += small ? 15 : 24;
      const chip = `pH ≈ ${fmt(organ.pH, 1)}`;
      ctx.font = FONT(fs, true);
      const cw = ctx.measureText(chip).width + (small ? 8 : 14);
      roundRect(ctx, cx - cw / 2, ty - lineH / 2 - 1, cw, lineH + 2, (lineH + 2) / 2);
      ctx.fillStyle = phColor(organ.pH);
      ctx.fill();
      label(ctx, chip, cx, ty, { size: fs, bold: true, align: "center", color: "#fff" });
      ty += small ? 14 : 22;
      label(ctx, small ? organ.time : `Thời gian lưu ${organ.time}`, cx, ty, { size: fs, align: "center", color: COLORS.muted });
      // enzymes
      ty += small ? 14 : 24;
      const enzymes = enzymesIn(s, organ);
      const room = Math.floor((trackY - 14 - ty) / lineH) + 1;
      const two = !small && room >= 2 * Math.max(1, enzymes.length); // name and reaction on separate lines
      if (!enzymes.length && room >= 1) {
        fitLabel(ctx, small ? "không có enzyme" : "Không có enzyme tiêu hóa", cx, ty, bw - 8, { size: fs, align: "center", color: COLORS.muted });
      }
      enzymes.slice(0, Math.max(0, room)).forEach(e => {
        const color = e.active ? COLORS.ink : COLORS.red;
        fitLabel(ctx, `${e.active ? "" : "✗ "}${small ? e.short : e.name}`, cx, ty, bw - 8, { size: fs, bold: !small, align: "center", color });
        ty += lineH;
        if (two) {
          const text = e.active ? `${POOL_NAMES[e.from]} → ${POOL_NAMES[e.to]}` : "không hoạt động ở pH này";
          fitLabel(ctx, text, cx, ty, bw - 8, { size: fs - 1, align: "center", color: e.active ? COLORS.muted : COLORS.red });
          ty += lineH + (small ? 0 : 3);
        }
      });
      // the path of the food
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = small ? 4 : 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + 10, trackY);
      ctx.lineTo(x + bw - 10, trackY);
      ctx.stroke();
      if (i < 3) arrow(ctx, x + bw + 1, trackY, x + bw + gap - 1, trackY, COLORS.muted, 2);
    });
    // the food itself shrinks as it is absorbed
    const a = absorbed(s);
    const remaining = 1 - (a.starch + a.protein + a.lipid + a.water) / 4;
    const bx = pad + here.i * (bw + gap) + 10 + (done ? 1 : here.frac) * (bw - 20);
    ctx.fillStyle = "#9a6b3f";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, trackY, (small ? 6 : 10) * (0.45 + 0.55 * remaining), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    y += boxH + 6;

    // ---- what happens here ----
    wrap(ctx, statusText(s), view.w - 2 * pad, fs)
      .slice(0, small ? 3 : 2)
      .forEach((line, i) => label(ctx, line, pad, y + lineH * (i + 0.5), { size: fs }));
    y += statusH;

    // ---- composition of each nutrient ----
    const nameW = small ? 50 : 84;
    const pctW = small ? 40 : 128;
    const x0 = pad + nameW;
    const w = view.w - 2 * pad - nameW - pctW;
    for (const row of ROWS) {
      const cy = y + barH / 2;
      label(ctx, row.name, pad, cy, { size: fs + 1, bold: true });
      ctx.fillStyle = "#fff";
      ctx.fillRect(x0, y, w, barH);
      let x = x0;
      for (const [key, text, role] of row.parts) {
        const pw = s[key] * w;
        ctx.fillStyle = fill(row.color, role);
        ctx.fillRect(x, y, pw, barH);
        ctx.font = FONT(fs - 1);
        if (ctx.measureText(text).width + 6 < pw) {
          label(ctx, text, x + pw / 2, cy, { size: fs - 1, align: "center", color: role === 0 || role >= 3 ? "#fff" : COLORS.ink });
        }
        x += pw;
      }
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y, w, barH);
      const right = row.done ? (small ? pct(row.done(s)) : `tiêu hóa ${pct(row.done(s))}`) : small ? "" : `hấp thụ ${pct(a.water)}`;
      label(ctx, right, view.w - pad, cy, { size: fs + 1, bold: true, align: "right" });
      y += barH + barGap;
    }

    // ---- legend and conventions ----
    const items = [["chưa tiêu hóa", "rgba(31, 42, 68, 1)"], ["chất trung gian", "rgba(31, 42, 68, 0.6)"], ["sản phẩm cuối", "rgba(31, 42, 68, 0.28)"], ["đã hấp thụ", COLORS.green]];
    let lx = pad;
    const ly = y + legendH / 2 - 2;
    const sq = small ? 8 : 11;
    for (const [text, color] of items) {
      ctx.fillStyle = color;
      ctx.fillRect(lx, ly - sq / 2, sq, sq);
      label(ctx, text, lx + sq + 4, ly, { size: fs - 1, color: COLORS.muted });
      ctx.font = FONT(fs - 1);
      lx += sq + 4 + ctx.measureText(text).width + (small ? 9 : 18);
    }
    y += legendH;
    const note = small
      ? "% bên phải: phần đã tiêu hóa hoàn toàn. Sơ đồ không theo tỉ lệ."
      : "Sơ đồ không theo tỉ lệ. pH và thời gian lưu là giá trị điển hình, thay đổi theo bữa ăn và từng người; tốc độ phản ứng chỉ có tính minh họa.";
    fitLabel(ctx, note, pad, y + noteH / 2, view.w - 2 * pad, { size: fs - 1, color: COLORS.muted });
  },
});
