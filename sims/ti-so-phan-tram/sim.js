import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { MAX, initialState, solve } from "./model.js";

const exact = v => Math.abs(v - Math.round(v * 100) / 100) < 1e-9;
const eq = v => (exact(v) ? "=" : "≈"); // sign to put in front of a rounded number
const frac = f => (f ? (f[1] === 1 ? `${f[0]}` : `${f[0]}/${f[1]}`) : "–");
const NO = "Không chia được cho 0";

function report(s, api) {
  const r = solve(s);
  if (r.type === "change") {
    api.emit("percent-change", { start: r.whole, percent: r.percent, final: r.final, direction: r.mode === "up" ? 1 : r.mode === "down" ? -1 : 0 }, "result");
  } else if (r.valid) {
    api.emit("percent-solved", { whole: r.whole, percent: r.percent, part: r.part }, "result");
  }
}

// What is asked, the calculation, and the same percentage as a fraction and a decimal.
function lines(s, r) {
  const a = int(s.whole);
  const p = int(s.percent);
  const b = int(s.part);
  let ask, calc;
  if (r.type === "part") {
    ask = `Tìm ${p}% của ${a}`;
    calc = `${a} × ${p} : 100 ${eq(r.part)} ${fmt(r.part)}`;
  } else if (r.type === "whole") {
    ask = `Tìm một số biết ${p}% của nó là ${b}`;
    calc = r.valid ? `${b} × 100 : ${p} ${eq(r.whole)} ${fmt(r.whole)}` : NO;
  } else if (r.type === "percent") {
    ask = `Tìm tỉ số phần trăm của ${b} và ${a}`;
    calc = r.valid ? `${b} : ${a} × 100% ${eq(r.percent)} ${fmt(r.percent)}%` : NO;
  } else {
    ask = { up: `Tăng ${a} thêm ${p}%`, down: `Giảm ${a} đi ${p}%`, updown: `Tăng ${a} thêm ${p}%, rồi giảm kết quả đi ${p}%` }[r.mode];
    calc = r.steps.map(v => fmt(v)).join(" → ");
    if (r.mode === "updown") calc += r.final === a ? " (bằng số ban đầu)" : ` (khác ${a})`;
  }
  let same = "";
  if (r.valid && r.type === "percent") {
    // b/a is exact; its decimal and percentage may be rounded
    const d4 = Math.abs(r.decimal - Math.round(r.decimal * 1e4) / 1e4) < 1e-12 ? "=" : "≈";
    same = `${b}/${a}${frac(r.fraction) !== `${b}/${a}` ? ` = ${frac(r.fraction)}` : ""} ${d4} ${fmt(r.decimal, 4)} ${eq(r.percent)} ${fmt(r.percent)}%`;
  } else if (r.valid) {
    const parts = [`${fmt(r.percent)}%`];
    if (r.type !== "percent") parts.push(`${r.percent}/100`);
    if (r.fraction && frac(r.fraction) !== parts.at(-1)) parts.push(frac(r.fraction));
    if (frac(r.fraction) !== fmt(r.decimal, 4)) parts.push(fmt(r.decimal, 4));
    same = parts.join(" = ");
  }
  return { ask, calc, same };
}
const int = v => clamp(Math.round(v) || 0, 0, MAX);

function drawGrid(ctx, x, y, size, percent, color) {
  const cell = size / 10;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = color;
  for (let i = 0; i < 100 && i < percent; i++) {
    ctx.fillRect(x + (i % 10) * cell, y + Math.floor(i / 10) * cell, cell * Math.min(1, percent - i), cell);
  }
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 1; i < 10; i++) {
    ctx.moveTo(x + i * cell, y);
    ctx.lineTo(x + i * cell, y + size);
    ctx.moveTo(x, y + i * cell);
    ctx.lineTo(x + size, y + i * cell);
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, size, size);
}

// One bar: the whole is the outline (100 %), the part is the coloured piece.
function drawBar(ctx, r, x, y, w, h, size) {
  const found = { part: "part", whole: "whole", percent: "percent" }[r.type];
  const tone = key => (key === found ? COLORS.green : COLORS.ink);
  if (!r.valid && r.type === "whole") {
    ctx.strokeStyle = COLORS.muted;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    label(ctx, "? (100%)", x + w, y + h + 12, { size, align: "right", color: COLORS.muted });
    label(ctx, `${fmt(r.part)} (0%)`, x, y - 11, { size, bold: true, color: COLORS.blue });
    return;
  }
  const scale = w / Math.max(r.whole, r.part, 1e-9);
  const ww = r.whole * scale;
  const pw = r.part * scale;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, ww, h);
  ctx.fillStyle = "rgba(47, 111, 237, 0.75)";
  ctx.fillRect(x, y, Math.min(pw, ww), h);
  if (pw > ww) {
    ctx.fillStyle = COLORS.orange;
    ctx.fillRect(x + ww, y, pw - ww, h);
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, ww, h);
  ctx.beginPath();
  ctx.moveTo(x + pw, y - 4);
  ctx.lineTo(x + pw, y + h + 4);
  ctx.stroke();
  const pct = r.percent === null ? "?" : `${fmt(r.percent)}%`;
  const edge = (px, text) => clamp(px, x + text.length * size * 0.27, x + w - text.length * size * 0.27);
  const top = `${fmt(r.part)} (${pct})`;
  label(ctx, top, edge(x + pw, top), y - 11, { size, align: "center", bold: true, color: found === "whole" ? COLORS.blue : tone(found === "part" ? "part" : "percent") });
  const bottom = `${fmt(r.whole)} (100%)`;
  label(ctx, "0", x, y + h + 12, { size, align: "center", color: COLORS.muted });
  if (ww > 30) label(ctx, bottom, edge(x + ww, bottom), y + h + 12, { size, align: "center", bold: found === "whole", color: tone("whole") });
}

// Increase / decrease: one bar per step, all on the same scale.
function drawSteps(ctx, r, x, y, w, rowH, size) {
  const names = { up: ["Ban đầu", `Tăng ${r.percent}%`], down: ["Ban đầu", `Giảm ${r.percent}%`], updown: ["Ban đầu", `Tăng ${r.percent}%`, `Giảm ${r.percent}%`] }[r.mode];
  const colors = { up: [COLORS.blue, COLORS.green], down: [COLORS.blue, COLORS.red], updown: [COLORS.blue, COLORS.green, COLORS.red] }[r.mode];
  const left = size * 5.6;
  const right = size * 3.4;
  const scale = (w - left - right) / Math.max(...r.steps, 1e-9);
  r.steps.forEach((v, i) => {
    const cy = y + rowH * (i + 0.5);
    label(ctx, names[i], x, cy, { size, color: COLORS.muted });
    ctx.fillStyle = colors[i];
    ctx.fillRect(x + left, cy - rowH * 0.32, v * scale, rowH * 0.64);
    label(ctx, fmt(v), x + left + v * scale + 6, cy, { size, bold: true, color: colors[i] });
  });
  // the starting value, to compare the last bar with
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(x + left + r.whole * scale, y - 2);
  ctx.lineTo(x + left + r.whole * scale, y + rowH * r.steps.length + 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

mount({
  slug: "ti-so-phan-tram",
  version: "1.0.0",
  title: "Tỉ số phần trăm",
  hint: "Chọn dạng bài rồi kéo các thanh trượt. Mỗi ô vuông nhỏ là 1% của số được coi là 100%.",
  initialState,
  controls: [
    {
      type: "select",
      key: "type",
      label: "Dạng bài",
      onCommit: report,
      options: [
        { value: "part", label: "Tìm giá trị phần trăm của một số" },
        { value: "whole", label: "Tìm một số biết giá trị phần trăm của nó" },
        { value: "percent", label: "Tìm tỉ số phần trăm của hai số" },
        { value: "change", label: "Tăng, giảm theo phần trăm" },
      ],
    },
    { type: "slider", key: "part", label: "Giá trị phần trăm b", min: 0, max: MAX, step: 1, digits: 0, visible: s => s.type === "whole" || s.type === "percent", onCommit: report },
    { type: "slider", key: "whole", label: "Số a (coi là 100%)", min: 0, max: MAX, step: 1, digits: 0, visible: s => s.type !== "whole", onCommit: report },
    { type: "slider", key: "percent", label: "Số phần trăm", min: 0, max: 100, step: 1, digits: 0, unit: "%", visible: s => s.type !== "percent", onCommit: report },
    {
      type: "select",
      key: "change",
      label: "Thay đổi",
      visible: s => s.type === "change",
      onCommit: report,
      options: [
        { value: "updown", label: "Tăng rồi giảm cùng số phần trăm" },
        { value: "up", label: "Tăng" },
        { value: "down", label: "Giảm" },
      ],
    },
  ],
  readouts: [
    { label: "Số a (100%)", value: s => (solve(s).whole === null ? "–" : fmt(solve(s).whole)) },
    { label: "Tỉ số phần trăm", value: s => (solve(s).percent === null ? "–" : `${fmt(solve(s).percent)}%`) },
    { label: "Giá trị phần trăm", value: s => (solve(s).valid ? fmt(solve(s).part) : "–") },
    { label: "Phân số tối giản", value: s => frac(solve(s).fraction) },
    { label: "Số thập phân", value: s => (solve(s).decimal === null ? "–" : fmt(solve(s).decimal, 4)) },
  ],
  draw(ctx, s, view) {
    const r = solve(s);
    const small = view.w < 520 || view.h < 400;
    const size = small ? 12 : 15;
    const pad = small ? 14 : 40;
    const t = lines(s, r);
    const mid = view.w / 2;

    label(ctx, t.ask, mid, small ? 13 : 24, { size, align: "center", color: COLORS.muted });
    label(ctx, t.calc, mid, small ? 32 : 54, { size: small ? 16 : 24, align: "center", bold: true, color: r.valid ? COLORS.ink : COLORS.red });
    label(ctx, t.same, mid, small ? 51 : 84, { size, align: "center", color: COLORS.purple, bold: true });

    const top = small ? 64 : 106;
    const change = r.type === "change";
    const rowH = small ? 20 : 30;
    const barsH = change ? rowH * r.steps.length + 8 : small ? 62 : 90;
    const noteH = small ? 18 : 26;
    const grid = clamp(Math.min(view.w - 2 * pad, view.h - top - barsH - noteH - (small ? 4 : 16)), 60, 380);
    const gx = mid - grid / 2;
    const shown = r.percent === null ? 0 : r.percent;
    drawGrid(ctx, gx, top, grid, shown, change ? COLORS.orange : "rgba(47, 111, 237, 0.75)");
    const note = !r.valid
      ? "Không tô được ô nào"
      : change
        ? `${fmt(shown)} ô = ${fmt(shown)}% của ${fmt(r.whole)} = ${fmt(r.part)}`
        : shown > 100
          ? `Hơn 100%: tô kín cả 100 ô (mỗi ô là ${fmt(r.whole / 100, 3)})`
          : `Tô ${fmt(shown)} ô trong 100 ô (mỗi ô là ${fmt(r.whole / 100, 3)})`;
    label(ctx, note, mid, top + grid + noteH / 2 + 2, { size: small ? 11 : 13, align: "center", color: COLORS.muted });

    const bw = Math.min(view.w - 2 * pad, 640);
    const by = top + grid + noteH + 4;
    if (change) drawSteps(ctx, r, mid - bw / 2, by, bw, rowH, size);
    else drawBar(ctx, r, mid - bw / 2, by + (small ? 20 : 26), bw, small ? 20 : 30, size);
  },
});
