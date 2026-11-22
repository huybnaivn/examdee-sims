import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, analyse, groupedMode, N } from "./model.js";

const MEAN = COLORS.blue;
const MED = COLORS.purple;
const QUART = COLORS.orange;
const MODE = COLORS.green;
const iv = (cls, i) => `[${cls.bounds[i]}; ${cls.bounds[i + 1]})`;
const f1 = v => fmt(v, 1);
const f2 = v => fmt(v, 2);

const cache = { key: "", value: null };
const data = s => {
  const key = `${s.seed}|${s.width}`;
  if (cache.key !== key) Object.assign(cache, { key, value: analyse(s) });
  return cache.value;
};
const picked = (s, d) => (Number.isInteger(s.pick) && s.pick >= 1 && s.pick <= d.cls.k ? s.pick - 1 : -1);
const solved = (s, d) => d.grouped.modal.includes(picked(s, d));
const modeOf = (s, d) => groupedMode(d.cls, picked(s, d));
const rawModes = raw => (raw.modes.length > 3 ? `${raw.modes.length} giá trị` : raw.modes.join("; "));

function report(s, api) {
  const d = data(s);
  api.emit("grouped-estimates", { classes: d.cls.k, width: d.cls.width, mean: d.grouped.mean, median: d.grouped.median }, "result");
}

// The goal fires once each time the learner settles on a modal class.
function checkPick(s, api) {
  const d = data(s);
  if (s.pick > d.cls.k) s.pick = d.cls.k;
  const ok = solved(s, d);
  if (ok && s._goalAt !== s.pick) api.emit("modal-class", { classIndex: s.pick, lower: d.cls.bounds[s.pick - 1], mode: modeOf(s, d) }, "goal");
  s._goalAt = ok ? s.pick : 0;
}

function geom(view, d) {
  const small = view.w < 560 || view.h < 420;
  const top = small ? 40 : 58;
  const tableW = !small && view.w >= 760 ? 250 : 0;
  const x0 = small ? 34 : 46;
  const x1 = view.w - tableW - (small ? 12 : 24);
  const colW = (x1 - x0) / d.cls.k;
  const freq = !small && colW >= 66 && view.h >= 480; // frequency table under the chart
  const strip = view.h >= 330 ? (small ? 26 : 40) : 0; // raw values as dots
  const legend = small ? 14 : 20;
  const yAxis = view.h - legend - (freq ? 52 : 0) - strip - (small ? 18 : 24);
  const yTop = top + (small ? 30 : 44); // marker names live above, in up to three rows
  const X = v => x0 + ((v - d.cls.bounds[0]) / (d.cls.bounds[d.cls.k] - d.cls.bounds[0])) * (x1 - x0);
  return { small, top, tableW, x0, x1, colW, freq, strip, legend, yAxis, yTop, X };
}

mount({
  slug: "thong-ke-ghep-nhom",
  version: "1.0.0",
  title: "Mẫu số liệu ghép nhóm",
  hint: "Đổi độ dài nhóm để ghép lại số liệu. So sánh các giá trị ước lượng từ bảng ghép nhóm với giá trị tính từ số liệu gốc. Bấm vào cột của nhóm chứa mốt.",
  initialState,
  controls: [
    { type: "slider", key: "width", label: "Độ dài mỗi nhóm h", min: 3, max: 10, step: 1, unit: "cm", onChange: s => (s.pick = 0), onCommit: report },
    {
      type: "button",
      label: "Mẫu số liệu khác",
      action: (s, api) => {
        s.seed = (s.seed % 999) + 1;
        s.pick = 0;
        s._goalAt = 0;
        report(s, api);
      },
      event: "new-sample",
    },
    { type: "heading", label: "Nhóm chứa mốt" },
    { type: "stepper", key: "pick", label: "Em chọn nhóm thứ (0 = chưa chọn)", min: 0, max: 20, onChange: checkPick },
  ],
  readouts: [
    { label: "Cỡ mẫu, số nhóm", value: s => `n = ${N}, k = ${data(s).cls.k}` },
    { label: "Số trung bình (ghép nhóm | gốc)", value: s => { const d = data(s); return `${f2(d.grouped.mean)} | ${f2(d.raw.mean)}`; } },
    { label: "Trung vị Me", value: s => { const d = data(s); return `${f2(d.grouped.median)} | ${f2(d.raw.median)}`; } },
    { label: "Tứ phân vị Q₁", value: s => { const d = data(s); return `${f2(d.grouped.q1)} | ${f2(d.raw.q1)}`; } },
    { label: "Tứ phân vị Q₃", value: s => { const d = data(s); return `${f2(d.grouped.q3)} | ${f2(d.raw.q3)}`; } },
    { label: "Mốt Mo", value: s => { const d = data(s); return `${solved(s, d) ? f2(modeOf(s, d)) : "?"} | ${rawModes(d.raw)}`; } },
  ],
  pointer: {
    down(p, s, api, view) {
      const d = data(s);
      const g = geom(view, d);
      if (p.x < g.x0 || p.x > g.x1 || p.y < g.yTop - 10 || p.y > g.yAxis + 4) return false;
      s.pick = Math.min(d.cls.k, Math.floor((p.x - g.x0) / g.colW) + 1);
      api.emit("class-picked", { classIndex: s.pick, correct: solved(s, d) ? 1 : 0 }, "action");
      checkPick(s, api);
    },
  },
  draw(ctx, s, view) {
    const d = data(s);
    const { cls, grouped: gs, raw } = d;
    const g = geom(view, d);
    const fs = g.small ? 11 : 13;
    const pick = picked(s, d);
    const ok = solved(s, d);
    const maxCount = Math.max(...cls.counts);
    const Y = c => g.yAxis - (c / maxCount) * (g.yAxis - g.yTop - fs - 6);

    // count gridlines
    const stepC = maxCount > 12 ? 5 : maxCount > 6 ? 2 : 1;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let c = 0; c <= maxCount; c += stepC) {
      ctx.beginPath();
      ctx.moveTo(g.x0, Y(c));
      ctx.lineTo(g.x1, Y(c));
      ctx.stroke();
      label(ctx, String(c), g.x0 - 6, Y(c), { align: "right", size: fs - 1, color: COLORS.muted });
    }

    // histogram
    cls.counts.forEach((m, i) => {
      const xa = g.X(cls.bounds[i]);
      const xb = g.X(cls.bounds[i + 1]);
      const chosen = i === pick;
      ctx.fillStyle = chosen ? (ok ? "rgba(31, 157, 107, 0.55)" : "rgba(229, 72, 77, 0.4)") : "rgba(47, 111, 237, 0.3)";
      ctx.fillRect(xa, Y(m), xb - xa, g.yAxis - Y(m));
      ctx.strokeStyle = chosen ? (ok ? MODE : COLORS.red) : COLORS.blue;
      ctx.lineWidth = chosen ? 2.5 : 1.5;
      ctx.strokeRect(xa, Y(m), xb - xa, g.yAxis - Y(m));
      if (m > 0) label(ctx, String(m), (xa + xb) / 2, Y(m) - fs / 2 - 3, { align: "center", size: fs, bold: true });
    });
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(g.x0, g.yAxis);
    ctx.lineTo(g.x1, g.yAxis);
    ctx.stroke();
    const every = g.colW < (g.small ? 26 : 32) ? 2 : 1;
    cls.bounds.forEach((b, i) => {
      if (i % every) return;
      label(ctx, String(b), g.X(b), g.yAxis + (g.small ? 9 : 11), { align: "center", size: fs - 1, color: COLORS.muted });
    });

    // grouped estimates as vertical lines, names in two rows above the bars
    const marks = [
      ["Q₁", gs.q1, QUART, [5, 4]],
      ["Me", gs.median, MED, []],
      ["x̄", gs.mean, MEAN, []],
      ["Q₃", gs.q3, QUART, [5, 4]],
      ...(ok ? [["Mo", modeOf(s, d), MODE, []]] : []),
    ];
    const placed = [];
    for (const [name, v, color, dash] of marks.sort((p, q) => p[1] - q[1])) {
      const x = g.X(v);
      let row = 0;
      while (row < 2 && placed.some(([px, r]) => r === row && Math.abs(px - x) < (g.small ? 22 : 28))) row++;
      placed.push([x, row]);
      const yl = g.yTop - (g.small ? 26 : 36) + row * (g.small ? 10 : 13);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(x, yl + 7);
      ctx.lineTo(x, g.yAxis);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, name, x, yl, { align: "center", size: fs, bold: true, color });
    }

    // raw values as stacked dots, with the exact mean and median as triangles
    if (g.strip) {
      const y0 = g.yAxis + (g.small ? 18 : 24);
      const r = g.small ? 2 : 2.6;
      const stack = new Map();
      ctx.fillStyle = COLORS.ink;
      for (const v of raw.sorted) {
        const n = stack.get(v) ?? 0;
        stack.set(v, n + 1);
        ctx.beginPath();
        ctx.arc(g.X(v), y0 + n * (2 * r + 1), r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const [v, color] of [[raw.median, MED], [raw.mean, MEAN]]) {
        const x = g.X(v);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y0 - 5);
        ctx.lineTo(x - 5, y0 - 12);
        ctx.lineTo(x + 5, y0 - 12);
        ctx.closePath();
        ctx.fill();
      }
    }

    // frequency table
    if (g.freq) {
      const rowH = 24;
      const y = view.h - g.legend - 2 * rowH - 4;
      ctx.fillStyle = "#fff";
      ctx.fillRect(g.x0, y, g.x1 - g.x0, 2 * rowH);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(g.x0, y, g.x1 - g.x0, 2 * rowH);
      label(ctx, "Nhóm", g.x0 - 6, y + rowH / 2, { align: "right", size: fs - 1, color: COLORS.muted });
      label(ctx, "Tần số", g.x0 - 6, y + 1.5 * rowH, { align: "right", size: fs - 1, color: COLORS.muted });
      cls.counts.forEach((m, i) => {
        const xa = g.x0 + i * g.colW;
        if (i) {
          ctx.beginPath();
          ctx.moveTo(xa, y);
          ctx.lineTo(xa, y + 2 * rowH);
          ctx.stroke();
        }
        label(ctx, iv(cls, i), xa + g.colW / 2, y + rowH / 2, { align: "center", size: fs - 1 });
        label(ctx, String(m), xa + g.colW / 2, y + 1.5 * rowH, { align: "center", size: fs, bold: true });
      });
    }

    // comparison table at the right
    if (g.tableW) {
      const x = view.w - g.tableW - 4;
      const rowH = 30;
      const rows = [
        ["", "Ghép nhóm", "Số liệu gốc"],
        ["Số trung bình", f2(gs.mean), f2(raw.mean)],
        ["Trung vị Me", f2(gs.median), f2(raw.median)],
        ["Q₁", f2(gs.q1), f2(raw.q1)],
        ["Q₃", f2(gs.q3), f2(raw.q3)],
        ["Mốt Mo", ok ? f2(modeOf(s, d)) : "?", rawModes(raw)],
      ];
      const y = g.yTop;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, y, g.tableW, rowH * rows.length);
      ctx.fillStyle = COLORS.grid;
      ctx.fillRect(x, y, g.tableW, rowH);
      ctx.strokeStyle = COLORS.grid;
      ctx.strokeRect(x, y, g.tableW, rowH * rows.length);
      const colors = [null, MEAN, MED, QUART, QUART, MODE];
      rows.forEach((row, r) => {
        const cy = y + rowH * (r + 0.5);
        label(ctx, row[0], x + 8, cy, { size: 12, bold: r > 0, color: colors[r] ?? COLORS.ink });
        label(ctx, row[1], x + 150, cy, { align: "right", size: 13, bold: r === 0 });
        label(ctx, row[2], x + g.tableW - 8, cy, { align: "right", size: 13, bold: r === 0, color: r ? COLORS.muted : COLORS.ink });
      });
      const notes = ["Số liệu gốc: Q₁, Q₃ là trung vị", "của nửa dưới và nửa trên mẫu."];
      notes.forEach((t, i) => label(ctx, t, x + 2, y + rowH * rows.length + 16 + i * 16, { size: 11, color: COLORS.muted }));
    }

    // headline, the task, the legend
    const head = `Chiều cao của ${N} học sinh (cm): ${cls.k} nhóm, độ dài h = ${cls.width}`;
    label(ctx, head, view.w / 2, g.small ? 12 : 20, { align: "center", size: g.small ? 13 : 18, bold: true });
    let task = "Bấm vào cột của nhóm chứa mốt";
    let color = COLORS.muted;
    if (pick >= 0 && ok) [task, color] = [`Đúng! Nhóm chứa mốt ${iv(cls, pick)}, Mo ≈ ${f1(modeOf(s, d))} cm`, MODE];
    else if (pick >= 0) [task, color] = [`Nhóm ${iv(cls, pick)} chưa có tần số lớn nhất, thử lại`, COLORS.red];
    label(ctx, task, view.w / 2, g.small ? 29 : 42, { align: "center", size: g.small ? 11 : 14, bold: pick >= 0, color });
    const legend = g.small ? "Đường: ước lượng từ bảng · ▲: từ số liệu gốc" : "Đường thẳng đứng: ước lượng từ bảng ghép nhóm · ▲ và chấm: số liệu gốc (làm tròn đến 1 cm)";
    label(ctx, legend, g.x0, view.h - g.legend / 2 - 2, { size: g.small ? 10 : 12, color: COLORS.muted });
  },
});
