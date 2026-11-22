import { mount, COLORS, clamp, label } from "../../kit/v1/kit.js";
import {
  initialState, CELLS, ORGANELLES, LAYOUT, has, present, hitTest, compare,
  quizTotal, quizStep, quizScore, quizDone, quizAnswered, quizTarget, submitAnswer, nextQuestion, restartQuiz,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const TAU = Math.PI * 2;
const MEMBRANE_HINT = COLORS.purple;
const BODY_FILL = {
  prokaryote: { "thanh-te-bao": "#b9a16b", "mang-sinh-chat": "#eda63a", "te-bao-chat": "#f3f1d2" },
  animal: { "mang-sinh-chat": "#eda63a", "te-bao-chat": "#fdeee3" },
  plant: { "thanh-te-bao": "#7fb069", "mang-sinh-chat": "#eda63a", "te-bao-chat": "#f4f8dc" },
};
const cellOptions = Object.entries(CELLS).map(([value, c]) => ({ value, label: c.name }));
const organelleOptions = first => [{ value: "", label: first }, ...Object.entries(ORGANELLES).map(([value, o]) => ({ value, label: o.name }))];

// ---------- text ----------
function fitLabel(ctx, text, x, y, maxW, opts) {
  let size = opts.size;
  for (; size > 8; size--) {
    ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  label(ctx, text, x, y, { ...opts, size });
}

function wrap(ctx, blocks, width, base) {
  const rows = [];
  for (const b of blocks) {
    const size = Math.round(base * (b.scale ?? 1));
    ctx.font = `${b.bold ? "600 " : ""}${size}px ${FONT}`;
    let line = "";
    for (const word of b.text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        rows.push({ text: line, size, bold: b.bold, color: b.color, h: size * 1.32 });
        line = word;
      } else line = next;
    }
    rows.push({ text: line, size, bold: b.bold, color: b.color, h: size * 1.75 }); // a gap after each block
  }
  return rows;
}

/** Paragraphs wrapped into a box, at the largest size from `max` down that fits its height. */
function paragraphs(ctx, blocks, box, max, min = 9) {
  let rows;
  for (let size = max; ; size--) {
    rows = wrap(ctx, blocks, box.w, size);
    if (size <= min || rows.reduce((sum, r) => sum + r.h, 0) <= box.h) break;
  }
  let y = box.y;
  for (const r of rows) {
    label(ctx, r.text, box.x, y + r.size * 0.6, r);
    y += r.h;
  }
}

function tag(ctx, text, x, y, color, view) {
  ctx.font = `600 12px ${FONT}`;
  const w = ctx.measureText(text).width + 14;
  const h = 20;
  const left = clamp(x - w / 2, 2, view.w - w - 2);
  const top = clamp(y - h / 2, 2, view.h - h - 2);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 10);
  ctx.fill();
  ctx.stroke();
  label(ctx, text, left + w / 2, top + h / 2 + 0.5, { size: 12, bold: true, color: "#fff", align: "center" });
}

// ---------- the diagram ----------
// Each drawing is made in the frame of its ellipse: origin at the centre, radii rx and ry, units of the diagram.
const ART = {
  nhan(ctx, { rx }) {
    ctx.fillStyle = "#d3c0f3";
    ctx.strokeStyle = "#6b4bb5";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.setLineDash([2.2, 0.9]); // gaps stand for the nuclear pores
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#7a5af8";
    ctx.beginPath();
    ctx.arc(-rx * 0.25, rx * 0.2, rx * 0.3, 0, TAU);
    ctx.fill();
  },
  "vung-nhan"(ctx, { rx, ry }) {
    ctx.strokeStyle = "#6b4bb5";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * TAU;
      const r = 0.68 + 0.2 * Math.sin(7 * t) + 0.1 * Math.sin(3 * t + 1);
      ctx.lineTo(rx * r * Math.cos(t), ry * r * Math.sin(t));
    }
    ctx.closePath();
    ctx.stroke();
  },
  plasmid(ctx, { rx }) {
    ctx.strokeStyle = "#6b4bb5";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.7, 0, TAU);
    ctx.stroke();
  },
  ribosome(ctx, { rx }) {
    ctx.fillStyle = "#5b4636";
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
  },
  "luoi-noi-chat"(ctx, { rx, ry }) {
    ctx.strokeStyle = "#4f86d1";
    ctx.lineWidth = Math.min(1.3, rx * 0.2);
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const x0 = rx * (-0.72 + i * 0.48);
      const half = ry * 0.92 * Math.sqrt(1 - (x0 / rx) ** 2);
      ctx.beginPath();
      for (let j = 0; j <= 20; j++) {
        const y = -half + (2 * half * j) / 20;
        ctx.lineTo(x0 + Math.sin(y * 0.9 + i * 1.7) * rx * 0.13, y);
      }
      ctx.stroke();
    }
  },
  "bo-may-golgi"(ctx, { rx, ry }) {
    ctx.strokeStyle = ctx.fillStyle = "#d07a1f";
    ctx.lineWidth = Math.min(1.3, ry * 0.28);
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const y = ry * (-0.75 + i * 0.42);
      const half = rx * (0.82 - 0.1 * Math.abs(i - 1.5));
      ctx.beginPath();
      ctx.moveTo(-half, y);
      ctx.quadraticCurveTo(0, y + ry * 0.45, half, y);
      ctx.stroke();
    }
    for (const [x, y] of [[0.92, -0.55], [-0.95, 0.55]]) {
      ctx.beginPath();
      ctx.arc(rx * x, ry * y, 0.8, 0, TAU);
      ctx.fill();
    }
  },
  "ti-the"(ctx, { rx, ry }) {
    ctx.fillStyle = "#f7b977";
    ctx.strokeStyle = "#b3541e";
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath(); // the folded inner membrane
    for (let i = 0; i <= 8; i++) ctx.lineTo(rx * (-0.72 + 0.18 * i), ry * (i % 2 ? 0.55 : -0.55));
    ctx.stroke();
  },
  "luc-lap"(ctx, { rx, ry }) {
    ctx.fillStyle = "#86cc7a";
    ctx.strokeStyle = "#2f7d3a";
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2f7d3a"; // grana
    for (const x of [-0.5, 0, 0.5]) ctx.fillRect(rx * x - rx * 0.11, -ry * (x ? 0.42 : 0.6), rx * 0.22, ry * (x ? 0.84 : 1.2));
  },
  "khong-bao"(ctx, { rx, ry }) {
    ctx.fillStyle = "#d3eafc";
    ctx.strokeStyle = "#6fa8d6";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  },
  lysosome(ctx, { rx }) {
    ctx.fillStyle = "#f09a9a";
    ctx.strokeStyle = "#b23b3b";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.stroke();
  },
  "trung-the"(ctx, { rx }) {
    ctx.fillStyle = "#8a6d3b"; // two centrioles at right angles
    ctx.fillRect(-rx * 0.85, -rx * 0.25, rx * 0.95, rx * 0.6);
    ctx.fillRect(rx * 0.25, -rx * 0.8, rx * 0.6, rx * 1.5);
  },
  roi(ctx, { rx, ry }) {
    ctx.strokeStyle = "#8a7a55";
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = -rx + (2 * rx * i) / 40;
      ctx.lineTo(x, ry * 0.6 * Math.sin((x + rx) * 0.95));
    }
    ctx.stroke();
  },
};

function bodyPath(ctx, b, d) {
  ctx.beginPath();
  if (b.kind === "ellipse") ctx.ellipse(b.cx, b.cy, b.a - d, b.b - d, 0, 0, TAU);
  else ctx.roundRect(b.cx - b.a + d, b.cy - b.b + d, 2 * (b.a - d), 2 * (b.b - d), Math.max(b.r - d, 0));
}

const frameOf = box => {
  const k = Math.min(box.w / 100, box.h / 80);
  return { k, ox: box.x + (box.w - 100 * k) / 2, oy: box.y + (box.h - 80 * k) / 2 };
};

/** Where a structure's name tag goes, in diagram units, and whether the tag sits above that point. */
function anchor(cell, id) {
  const { body, layers, parts, free } = LAYOUT[cell];
  const part = parts.find(p => p[0] === id);
  if (part) {
    const p = part[1][0];
    return { x: p.x, y: p.y - Math.hypot(p.rx * Math.sin(p.rot), p.ry * Math.cos(p.rot)), above: true };
  }
  if (id === "te-bao-chat") return { x: free[0], y: free[1] };
  const i = layers.findIndex(l => l[0] === id);
  return { x: body.cx, y: body.cy - body.b + ((layers[i - 1]?.[1] ?? 0) + layers[i][1]) / 2 };
}

/** One cell. `o.mark`: { id, color, text } highlights a structure and tags it; `o.membranes` outlines membrane-bound organelles. */
function drawCell(ctx, cell, box, view, o = {}) {
  const { body, layers, parts } = LAYOUT[cell];
  const { k, ox, oy } = frameOf(box);
  const mark = o.mark && has(cell, o.mark.id) ? o.mark : null;
  const depths = [0, ...layers.map(l => l[1])];
  const ids = [...layers.map(l => l[0]), "te-bao-chat"];
  const thin = 1.6 / k; // about 1,6 px, in diagram units

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(k, k);
  ids.forEach((id, i) => {
    bodyPath(ctx, body, depths[i]);
    ctx.fillStyle = BODY_FILL[cell][id];
    ctx.fill();
  });
  bodyPath(ctx, body, 0);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = thin * 0.6;
  ctx.stroke();
  const layer = mark ? ids.indexOf(mark.id) : -1;
  if (layer === ids.length - 1) {
    bodyPath(ctx, body, depths[layer]);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = mark.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (layer >= 0) {
    bodyPath(ctx, body, (depths[layer] + depths[layer + 1]) / 2);
    ctx.strokeStyle = mark.color;
    ctx.lineWidth = depths[layer + 1] - depths[layer] + thin;
    ctx.stroke();
  }
  for (const [id, ellipses] of parts) {
    for (const p of ellipses) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ART[id](ctx, p);
      const outline = (color, grow, width, dash) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rx + grow, p.ry + grow, 0, 0, TAU);
        ctx.stroke();
      };
      if (o.membranes && ORGANELLES[id].membrane) outline(MEMBRANE_HINT, 0.9, thin, [1.6, 1.1]);
      if (mark?.id === id) outline(mark.color, 1.4, thin * 1.6, []);
      ctx.restore();
    }
  }
  ctx.restore();
  if (mark?.text) {
    const a = anchor(cell, mark.id);
    tag(ctx, mark.text, ox + a.x * k, oy + a.y * k - (a.above ? 16 : 0), mark.color, view);
  }
}

// ---------- screens ----------
function layout(view) {
  const wide = view.w >= 560;
  const pad = wide ? 24 : 6;
  const top = wide ? 64 : 20;
  if (wide && view.w > view.h * 1.6) {
    // a low, wide stage: text beside the diagram
    const dw = view.w * 0.6 - pad;
    return { wide, diagram: { x: pad, y: top, w: dw, h: view.h - top - 12 }, info: { x: pad + dw + 20, y: top + 8, w: view.w - dw - 2 * pad - 20, h: view.h - top - 20 } };
  }
  const dh = Math.round((view.h - top) * (wide ? 0.68 : 0.6));
  const gap = wide ? 18 : 7;
  return { wide, diagram: { x: pad, y: top, w: view.w - 2 * pad, h: dh }, info: { x: pad + 2, y: top + dh + gap, w: Math.min(view.w - 2 * pad - 4, 760), h: view.h - top - dh - gap - 4 } };
}

function exploreInfo(s) {
  const o = ORGANELLES[s.selected];
  if (!o) return [{ text: "Chạm vào một thành phần của tế bào (hoặc chọn trong danh sách) để xem tên và chức năng.", color: COLORS.muted }];
  const blocks = [{ text: o.name, bold: true, scale: 1.2 }];
  if (!has(s.cell, s.selected)) blocks.push({ text: `${CELLS[s.cell].name} không có thành phần này.`, color: COLORS.red, bold: true });
  blocks.push({ text: o.fn });
  if (o.notes?.[s.cell]) blocks.push({ text: o.notes[s.cell] });
  blocks.push({ text: `Có ở: ${o.cells.map(c => CELLS[c].name.toLowerCase()).join(", ")}.`, color: COLORS.muted });
  return blocks;
}

function quizInfo(s) {
  const total = quizTotal(s);
  const score = quizScore(s);
  if (quizDone(s)) {
    return [
      { text: "Hoàn thành!", bold: true, scale: 1.2, color: score === total ? COLORS.green : COLORS.ink },
      { text: `Bạn gọi đúng tên ${score}/${total} thành phần của ${CELLS[s.cell].name.toLowerCase()}.` },
      { text: score === total ? "Xuất sắc – đúng tất cả!" : "Bấm «Làm bài mới» để thử lại với thứ tự khác.", color: COLORS.muted },
    ];
  }
  const head = `Câu ${quizStep(s) + 1}/${total}`;
  if (!quizAnswered(s)) {
    return [
      { text: head, bold: true, scale: 1.2 },
      { text: "Thành phần được đánh dấu «?» trên hình tên là gì? Chọn tên trong danh sách «Thành phần được đánh dấu»." },
      { text: `Đã đúng ${score} câu.`, color: COLORS.muted },
    ];
  }
  const target = ORGANELLES[quizTarget(s)];
  const correct = s.answer === quizTarget(s);
  return [
    { text: `${head}: ${correct ? "đúng!" : "chưa đúng"}`, bold: true, scale: 1.2, color: correct ? COLORS.green : COLORS.red },
    { text: correct ? `Đây là ${target.name.toLowerCase()}.` : `Bạn chọn «${ORGANELLES[s.answer].name}», nhưng đây là ${target.name.toLowerCase()}.` },
    { text: target.fn, color: COLORS.muted },
  ];
}

function quizMark(s) {
  const id = quizTarget(s);
  if (!id) return null;
  if (!quizAnswered(s)) return { id, color: COLORS.orange, text: "?" };
  return { id, color: s.answer === id ? COLORS.green : COLORS.red, text: ORGANELLES[id].name };
}

function drawDiagramScreen(ctx, s, view) {
  const { wide, diagram, info } = layout(view);
  const quiz = s.mode === "quiz";
  const walled = present(s.cell).filter(id => ORGANELLES[id].membrane).length;
  const sub = quiz
    ? "Gọi tên thành phần được đánh dấu «?»"
    : !s.membranes
      ? "Chạm vào một thành phần để xem tên và chức năng"
      : walled
        ? `Viền tím nét đứt: ${walled} loại bào quan có màng bao bọc`
        : "Tế bào nhân sơ không có bào quan có màng bao bọc";
  if (wide) {
    label(ctx, CELLS[s.cell].name, diagram.x, 28, { size: 19, bold: true });
    label(ctx, sub, diagram.x, 51, { size: 13, color: s.membranes && !quiz ? MEMBRANE_HINT : COLORS.muted });
    label(ctx, "Hình vẽ sơ đồ, không theo tỉ lệ", view.w - 24, 51, { size: 12, color: COLORS.muted, align: "right" });
  } else {
    fitLabel(ctx, `${CELLS[s.cell].name} · ${sub}`, 6, 10, view.w - 12, { size: 12, bold: true });
    const y = diagram.y + diagram.h;
    label(ctx, "Sơ đồ,", view.w - 5, y - 16, { size: 9, color: COLORS.muted, align: "right" });
    label(ctx, "không theo tỉ lệ", view.w - 5, y - 5, { size: 9, color: COLORS.muted, align: "right" });
  }
  const mark = quiz ? quizMark(s) : ORGANELLES[s.selected] ? { id: s.selected, color: COLORS.orange, text: ORGANELLES[s.selected].name } : null;
  drawCell(ctx, s.cell, diagram, view, { mark, membranes: s.membranes && !quiz });
  paragraphs(ctx, quiz ? quizInfo(s) : exploreInfo(s), info, wide ? 15 : 12);
}

function drawCompare(ctx, s, view) {
  const wide = view.w >= 560;
  const pad = wide ? 24 : 8;
  const c = compare(s.cell, s.other);
  let x = pad;
  if (wide) {
    const dw = view.w * 0.36;
    const h = (view.h - 24) / 2;
    [s.cell, s.other].forEach((cell, i) => {
      label(ctx, CELLS[cell].name, pad, 26 + i * h, { size: 15, bold: true });
      drawCell(ctx, cell, { x: pad, y: 40 + i * h, w: dw - pad, h: h - 34 }, view);
    });
    label(ctx, "Hình vẽ sơ đồ, không theo tỉ lệ", pad, view.h - 12, { size: 11, color: COLORS.muted });
    x = dw + 20;
  }
  const w = view.w - x - pad;
  const top = wide ? 26 : 10;
  const title =
    s.cell === s.other
      ? "Hãy chọn hai loại tế bào khác nhau để so sánh"
      : `Khác nhau ở ${c.differences} thành phần (hàng tô màu), giống nhau ở ${c.shared}`;
  fitLabel(ctx, title, x, top, w, { size: wide ? 15 : 12, bold: true });

  const y0 = top + (wide ? 20 : 11);
  const foot = wide ? 30 : 13;
  const rh = Math.min(wide ? 36 : 26, (view.h - y0 - foot) / (c.rows.length + 1));
  const size = clamp(Math.floor(rh * 0.56), 9, 15);
  const cols = [x + 8, x + w * 0.64, x + w * 0.87];
  ctx.fillStyle = "#e9eef8";
  ctx.fillRect(x, y0, w, rh);
  label(ctx, "Thành phần", cols[0], y0 + rh / 2, { size, bold: true });
  label(ctx, CELLS[s.cell].short, cols[1], y0 + rh / 2, { size, bold: true, align: "center" });
  label(ctx, CELLS[s.other].short, cols[2], y0 + rh / 2, { size, bold: true, align: "center" });
  c.rows.forEach((row, i) => {
    const y = y0 + rh * (i + 1);
    ctx.fillStyle = row.a !== row.b ? "#ffe9c7" : "#fff";
    ctx.fillRect(x, y, w, rh);
    label(ctx, ORGANELLES[row.id].name, cols[0], y + rh / 2, { size });
    [row.a, row.b].forEach((yes, j) =>
      label(ctx, yes ? "Có" : "Không", cols[j + 1], y + rh / 2, { size, bold: yes, color: yes ? COLORS.green : COLORS.red, align: "center" })
    );
  });
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= c.rows.length + 1; i++) {
    ctx.moveTo(x, y0 + rh * i);
    ctx.lineTo(x + w, y0 + rh * i);
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.muted;
  ctx.strokeRect(x, y0, w, rh * (c.rows.length + 1));
  label(ctx, "Theo các tế bào điển hình trong sách giáo khoa", x, y0 + rh * (c.rows.length + 1) + foot / 2 + 1, { size: wide ? 12 : 9, color: COLORS.muted });
}

// ---------- events ----------
const picked = (s, api) => {
  if (ORGANELLES[s.selected]) api.emit("organelle-selected", { organelle: s.selected, cell: s.cell, present: has(s.cell, s.selected) }, "action");
};
const compared = (s, api) => {
  if (s.mode !== "compare" || s.cell === s.other) return;
  const c = compare(s.cell, s.other);
  api.emit("comparison-shown", { first: CELLS[s.cell].index, second: CELLS[s.other].index, differences: c.differences, shared: c.shared }, "result");
};
const answered = (s, api) => {
  const r = submitAnswer(s);
  if (!r?.finished) return;
  api.emit("quiz-finished", { score: r.score, total: r.total }, "result");
  if (r.score === r.total) api.emit("quiz-perfect", { total: r.total }, "goal");
};
const restart = s => restartQuiz(s); // the questions belong to one cell type

mount({
  slug: "cau-truc-te-bao",
  version: "1.0.0",
  title: "Cấu trúc tế bào",
  hint: "Chạm vào từng thành phần của tế bào để xem tên và chức năng, so sánh tế bào nhân sơ, tế bào động vật và tế bào thực vật, rồi thử gọi tên các thành phần.",
  initialState,
  controls: [
    { type: "select", key: "cell", label: "Loại tế bào", options: cellOptions, onChange: restart, onCommit: compared },
    {
      type: "select",
      key: "mode",
      label: "Hoạt động",
      onChange: restart,
      onCommit: compared,
      options: [
        { value: "explore", label: "Khám phá: tên và chức năng" },
        { value: "compare", label: "So sánh hai loại tế bào" },
        { value: "quiz", label: "Trắc nghiệm: gọi tên thành phần" },
      ],
    },
    { type: "checkbox", key: "membranes", label: "Viền tím các bào quan có màng bao bọc", visible: s => s.mode === "explore" },
    { type: "select", key: "selected", label: "Thành phần đang chọn", options: organelleOptions("— Chưa chọn —"), visible: s => s.mode === "explore", onCommit: picked },
    { type: "select", key: "other", label: "So sánh với", options: cellOptions, visible: s => s.mode === "compare", onCommit: compared },
    {
      type: "select",
      key: "answer",
      label: "Thành phần được đánh dấu «?» là",
      options: organelleOptions("— Chọn tên —"),
      visible: s => s.mode === "quiz" && !quizDone(s),
      disabled: s => quizAnswered(s),
      onCommit: answered,
    },
    { type: "button", label: "Câu tiếp theo", primary: true, visible: s => s.mode === "quiz" && quizAnswered(s), action: nextQuestion, event: "quiz-next" },
    { type: "button", label: "Làm bài mới", visible: s => s.mode === "quiz", action: s => restartQuiz(s, true), event: "quiz-restart" },
  ],
  readouts: [
    { label: "Nhóm tế bào", value: s => (s.cell === "prokaryote" ? "Nhân sơ: chưa có màng nhân" : "Nhân thực: có nhân hoàn chỉnh") },
    { label: "Số thành phần trong hình", value: s => String(present(s.cell).length) },
    { label: "Trắc nghiệm", value: s => (s.mode === "quiz" ? `Đúng ${quizScore(s)}/${quizTotal(s)}` : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      if (s.mode !== "explore") return false;
      const { k, ox, oy } = frameOf(layout(view).diagram);
      s.selected = hitTest(s.cell, (p.x - ox) / k, (p.y - oy) / k);
      picked(s, api);
      api.sync();
    },
  },
  draw(ctx, s, view) {
    if (s.mode === "compare") drawCompare(ctx, s, view);
    else drawDiagramScreen(ctx, s, view);
  },
});
