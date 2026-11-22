import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import { CLASSES, REAGENTS, OXIDES, N, NAME_OPTIONS, initialState, indexOf, oxide, pretty, test, name, valenceName, classCode, marks, wasTested, canClassify, runTest, progress, confirmClass, checkName } from "./model.js";

const FONT = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const CLASS_LABEL = { basic: "Oxide base", acidic: "Oxide acid", amphoteric: "Oxide lưỡng tính", neutral: "Oxide trung tính" };
const CLASS_COLOR = { basic: COLORS.blue, acidic: COLORS.red, amphoteric: COLORS.purple, neutral: COLORS.muted };
const REAGENT_LABEL = { water: "Nước + quỳ tím", acid: "Dung dịch HCl", base: "Dung dịch NaOH" };
const REAGENT_TEXT = { water: "nước có quỳ tím", acid: "dung dịch HCl", base: "dung dịch NaOH" };
const REAGENT_SHORT = { water: "nước", acid: "HCl", base: "NaOH" };
const LIQUID = { clear: "#dcebfb", blue: "#4aa3e8", yellow: "#d9a53a" };
const LITMUS = { purple: "#8e6bbf", blue: COLORS.blue, red: COLORS.red };
const SOLID = { white: "#f4f6fa", black: "#2b2b2b", brown: "#8b3a1e" };

// ---------- actions ----------
function pick(s) {
  // the lists follow the oxide: its class if it has one, no name chosen yet
  s.guess = CLASSES[marks(s.classes, 4)[indexOf(s.oxide)] - 1] ?? "";
  s.name = "";
  s._nameWrong = false;
}
function doTest(s, api, reagent) {
  const t = runTest(s, reagent);
  api.emit("test", { oxide: indexOf(s.oxide) + 1, reagent: REAGENTS.indexOf(reagent) + 1, reacts: t.reacts ? 1 : 0 });
}

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(view) {
  const small = view.w < 520 || view.h < 420;
  const m = small ? 6 : 16;
  const cols = view.w >= 640 ? N : 6;
  const rows = Math.ceil(N / cols);
  const gap = small ? 4 : 6;
  const tw = (view.w - 2 * m - gap * (cols - 1)) / cols;
  const th = small ? 22 : 34;
  const tiles = OXIDES.map((o, i) => ({ x: m + (i % cols) * (tw + gap), y: m + Math.floor(i / cols) * (th + gap), w: tw, h: th }));
  const legendY = m + rows * (th + gap) + (small ? 5 : 10);
  const top = legendY + (small ? 11 : 20);
  const cap = small ? 13 : 20; // caption above and below a beaker
  const bh = clamp(view.h - top - (small ? 112 : 190) - 2 * cap, 36, 230);
  const slot = Math.min((view.w - 2 * m) / 3, 250);
  const bw = Math.min(slot - (small ? 16 : 36), bh * 1.15);
  const beakers = REAGENTS.map((r, i) => ({ cx: view.w / 2 + (i - 1) * slot, y: top + cap, w: bw, h: bh, slot }));
  return { small, m, tiles, legendY, top, cap, beakers, textY: top + 2 * cap + bh + (small ? 10 : 18) };
}

// ---------- drawing ----------
/** Word-wrapped text; returns the y of the next row. */
function para(ctx, text, x, y, w, size, opt = {}) {
  ctx.font = FONT(size, opt.bold);
  let row = "";
  const rows = [];
  for (const word of text.split(" ")) {
    const next = row ? `${row} ${word}` : word;
    if (row && ctx.measureText(next).width > w) {
      rows.push(row);
      row = word;
    } else row = next;
  }
  rows.push(row);
  for (const r of rows) {
    label(ctx, r, x, y, { size, ...opt });
    y += size * 1.38;
  }
  return y;
}

function drawTiles(ctx, s, g) {
  const classes = marks(s.classes, 4);
  const size = g.small ? 12 : 15;
  OXIDES.forEach((o, i) => {
    const t = g.tiles[i];
    const cls = CLASSES[classes[i] - 1];
    const selected = o.id === oxide(s.oxide).id;
    ctx.fillStyle = "#fff";
    ctx.fillRect(t.x, t.y, t.w, t.h);
    if (cls) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = CLASS_COLOR[cls];
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = selected ? COLORS.ink : cls ? CLASS_COLOR[cls] : COLORS.grid;
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.strokeRect(t.x, t.y, t.w, t.h);
    label(ctx, pretty(o.id), t.x + t.w / 2, t.y + t.h / 2 + 1, { size, bold: true, align: "center" });
    if (cls) {
      const right = cls === o.cls;
      label(ctx, right ? "✓" : "✗", t.x + t.w - 3, t.y + (g.small ? 6 : 8), { size: g.small ? 9 : 11, bold: true, align: "right", color: right ? COLORS.green : COLORS.red });
    }
  });
  // legend: the colour of each class
  const lsize = g.small ? 10 : 12;
  ctx.font = FONT(lsize);
  const items = CLASSES.map(c => (g.small ? CLASS_LABEL[c].replace("Oxide lưỡng", "lưỡng").replace("Oxide trung", "trung") : CLASS_LABEL[c]));
  const width = items.reduce((sum, text) => sum + ctx.measureText(text).width + 30, -12);
  let x = (ctx.canvas.clientWidth - width) / 2;
  items.forEach((text, i) => {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = CLASS_COLOR[CLASSES[i]];
    ctx.fillRect(x, g.legendY - 5, 12, 10);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = CLASS_COLOR[CLASSES[i]];
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, g.legendY - 5, 12, 10);
    label(ctx, text, x + 16, g.legendY, { size: lsize, color: COLORS.muted });
    x += ctx.measureText(text).width + 30;
  });
}

function drawBeaker(ctx, s, g, b, reagent) {
  const o = oxide(s.oxide);
  const done = wasTested(s, o.id, reagent);
  const t = test(o.id, reagent);
  const x = b.cx - b.w / 2;
  const level = b.y + b.h * 0.38;
  const bottom = b.y + b.h;
  const size = g.small ? 10 : 13;
  const current = done && s.reagent === reagent;

  label(ctx, g.small ? REAGENT_LABEL[reagent].replace("Dung dịch", "dd") : REAGENT_LABEL[reagent], b.cx, b.y - g.cap / 2 - 1, { size, bold: current, align: "center", color: current ? COLORS.ink : COLORS.muted });
  // liquid
  ctx.fillStyle = LIQUID[done ? t.solution : "clear"];
  ctx.fillRect(x + 2, level, b.w - 4, bottom - level - 2);
  if (done && t.left === "solid") {
    // the oxide lies on the bottom
    ctx.fillStyle = SOLID[o.color] ?? SOLID.white;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(b.cx, bottom - 3, b.w * 0.3, Math.min(9, b.h * 0.1), 0, Math.PI, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (done && t.left === "gas") {
    // bubbles leaving the liquid
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      const bx = x + b.w * (0.2 + 0.1 * i);
      const by = level + (bottom - level) * ((i * 37) % 100) / 115 - (i % 3 === 0 ? (bottom - level) * 0.25 : 0);
      ctx.beginPath();
      ctx.arc(bx, Math.max(b.y + 4, by), 2 + (i % 3), 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
  if (reagent === "water") {
    // litmus paper dipped into the water
    ctx.fillStyle = LITMUS[done ? t.litmus : "purple"];
    ctx.fillRect(x + b.w * 0.74, b.y - 3, Math.max(6, b.w * 0.09), b.h * 0.72);
  }
  // glass
  ctx.strokeStyle = current ? COLORS.ink : COLORS.muted;
  ctx.lineWidth = current ? 2.5 : 1.8;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - 3, b.y);
  ctx.lineTo(x, b.y + 3);
  ctx.lineTo(x, bottom);
  ctx.lineTo(x + b.w, bottom);
  ctx.lineTo(x + b.w, b.y + 3);
  ctx.lineTo(x + b.w + 3, b.y);
  ctx.stroke();

  const caption = !done ? (g.small ? "Bấm để thử" : "Chưa thử – bấm để thử") : t.reacts ? "Có phản ứng" : "Không phản ứng";
  label(ctx, caption, b.cx, bottom + g.cap / 2 + 3, { size, bold: done, align: "center", color: !done ? COLORS.muted : t.reacts ? COLORS.green : COLORS.red });
}

function drawDetails(ctx, s, g, view) {
  const o = oxide(s.oxide);
  const i = indexOf(o.id);
  const size = g.small ? 11 : 15;
  const w = Math.min(view.w - 2 * g.m, 760);
  const x = (view.w - w) / 2;
  let y = g.textY;
  const reagent = REAGENTS.includes(s.reagent) ? s.reagent : "water";
  if (wasTested(s, o.id, reagent)) {
    const t = test(o.id, reagent);
    y = para(ctx, `${pretty(o.id)} + ${REAGENT_TEXT[reagent]}: ${t.observation}`, x, y, w, size);
    if (t.reacts) y = para(ctx, pretty(t.equation), x, y, w, size + 1, { bold: true, color: COLORS.blue });
  } else {
    y = para(ctx, `Bấm vào từng cốc để cho ${pretty(o.id)} vào và quan sát hiện tượng.`, x, y, w, size, { color: COLORS.muted });
  }
  y += size * 0.3;
  const code = marks(s.classes, 4)[i];
  const p = progress(s);
  if (p.all) y = para(ctx, `Hoàn thành: cả ${N} oxide đã được xếp đúng loại.`, x, y, w, size, { bold: true, color: COLORS.green });
  else if (code === classCode(o.cls)) y = para(ctx, `Đúng: ${pretty(o.id)} là ${CLASS_LABEL[o.cls].toLowerCase()}.`, x, y, w, size, { bold: true, color: COLORS.green });
  else if (code) y = para(ctx, `Chưa đúng: ${pretty(o.id)} không phải là ${CLASS_LABEL[CLASSES[code - 1]].toLowerCase()}. Hãy xem lại kết quả thử với HCl và với NaOH.`, x, y, w, size, { color: COLORS.red });
  else if (canClassify(s, o.id)) y = para(ctx, "Đã thử với acid và base: hãy chọn loại oxide ở mục Phân loại rồi xác nhận.", x, y, w, size, { color: COLORS.orange, bold: true });
  else y = para(ctx, "Thử với cả dung dịch HCl và dung dịch NaOH rồi mới phân loại.", x, y, w, size, { color: COLORS.muted });
  if (marks(s.named, 1)[i]) {
    const other = valenceName(o.id);
    y = para(ctx, `Tên gọi: ${name(o.id)}${other ? ` (hoặc ${other})` : ""}.`, x, y, w, size, { color: COLORS.ink });
  } else if (s._nameWrong) y = para(ctx, "Tên gọi chưa đúng. Xem lại hóa trị và các tiền tố mono, di, tri, penta.", x, y, w, size, { color: COLORS.red });
  if (y < view.h - 12) label(ctx, "Hình minh họa; màu sắc mang tính tượng trưng.", view.w - g.m, view.h - 8, { size: g.small ? 9 : 11, color: COLORS.muted, align: "right" });
}

const testButton = (reagent, text) => ({ type: "button", label: text, action: (s, api) => doTest(s, api, reagent) });

mount({
  slug: "phan-loai-oxide",
  version: "1.0.0",
  title: "Oxide: phân loại và tính chất",
  hint: "Chọn một oxide, bấm vào từng cốc để thử với nước, acid và base, rồi xếp oxide vào đúng loại.",
  initialState,
  controls: [
    { type: "select", key: "oxide", label: "Oxide", options: OXIDES.map(o => ({ value: o.id, label: pretty(o.id) })), onChange: pick },
    { type: "heading", label: "Thử tính chất" },
    testButton("water", "Cho vào nước (có quỳ tím)"),
    testButton("acid", "Cho vào dung dịch HCl"),
    testButton("base", "Cho vào dung dịch NaOH"),
    { type: "heading", label: "Phân loại" },
    {
      type: "select",
      key: "guess",
      label: "Oxide này thuộc loại",
      options: [{ value: "", label: "— chọn loại oxide —" }, ...CLASSES.map(value => ({ value, label: CLASS_LABEL[value] }))],
      disabled: s => !canClassify(s),
    },
    {
      type: "button",
      label: "Xác nhận phân loại",
      primary: true,
      disabled: s => !canClassify(s) || !s.guess,
      action(s, api) {
        const r = confirmClass(s);
        if (!r) return;
        api.emit("classified", { oxide: indexOf(s.oxide) + 1, classCode: r.code, correct: r.correct ? 1 : 0, correctTotal: progress(s).correct }, "result");
        if (r.completed) api.emit("all-classified", { oxides: N, attempts: s.attempts }, "goal");
      },
    },
    { type: "heading", label: "Gọi tên" },
    {
      type: "select",
      key: "name",
      label: "Tên gọi của oxide này",
      options: [{ value: "", label: "— chọn tên gọi —" }, ...NAME_OPTIONS.map(value => ({ value, label: value }))],
      onChange(s) {
        s._nameWrong = false;
      },
    },
    {
      type: "button",
      label: "Kiểm tra tên gọi",
      disabled: s => !s.name,
      action(s, api) {
        const right = checkName(s);
        s._nameWrong = !right;
        api.emit("name-checked", { oxide: indexOf(s.oxide) + 1, correct: right ? 1 : 0 });
      },
    },
  ],
  readouts: [
    {
      label: "Kết quả thử",
      value: s => REAGENTS.map(r => `${REAGENT_SHORT[r]}: ${!wasTested(s, s.oxide, r) ? "?" : test(s.oxide, r).reacts ? "có" : "không"}`).join("; "),
    },
    { label: "Đã xếp đúng loại", value: s => `${progress(s).correct}/${N}` },
    { label: "Đã gọi đúng tên", value: s => `${progress(s).named}/${N}` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      const tile = g.tiles.findIndex(t => p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h);
      const beaker = g.beakers.findIndex(b => Math.abs(p.x - b.cx) <= b.slot / 2 && p.y >= b.y - g.cap && p.y <= b.y + b.h + g.cap);
      if (tile >= 0) {
        s.oxide = OXIDES[tile].id;
        pick(s);
        api.emit("param", { key: "oxide", value: s.oxide }, "param");
      } else if (beaker >= 0) {
        doTest(s, api, REAGENTS[beaker]);
      }
      api.sync();
      return false;
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    drawTiles(ctx, s, g);
    g.beakers.forEach((b, i) => drawBeaker(ctx, s, g, b, REAGENTS[i]));
    drawDetails(ctx, s, g, view);
  },
});
