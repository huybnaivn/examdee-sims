import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, cells, counts, phasesOf, phaseOf, answerOf, isRight } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const STEP_TIME = 1.5; // seconds per step when playing
// one hue per homologous pair: [from the mother (dark), from the father (light)]
const PAIR = [
  ["#d23f44", "#f5a9ab"],
  ["#2f6fed", "#a4c0f8"],
  ["#1a9466", "#93dcbd"],
  ["#d9831a", "#f7cd8f"],
];
const KIND = { don: "đơn", kep: "kép", mixed: "đơn và kép" };
const size = (pair, L) => L * (1 - 0.18 * pair); // pair 0 is the largest

const NOTES = {
  mitosis: [
    "Mỗi NST ở dạng sợi mảnh, chưa nhân đôi (NST đơn).",
    "Mỗi NST đã nhân đôi thành NST kép gồm 2 chromatid dính nhau ở tâm động.",
    "NST kép co xoắn dần, màng nhân biến mất, thoi phân bào hình thành.",
    "NST kép co xoắn cực đại, xếp thành 1 hàng trên mặt phẳng xích đạo.",
    "Hai chromatid của mỗi NST kép tách nhau ở tâm động, đi về hai cực.",
    "Màng nhân hình thành, tế bào chất phân chia: 2 tế bào con giống hệt tế bào mẹ.",
  ],
  meiosis: [
    "Mỗi NST ở dạng sợi mảnh, chưa nhân đôi (NST đơn).",
    "Mỗi NST đã nhân đôi thành NST kép; NST chỉ nhân đôi một lần trong giảm phân.",
    "Các NST kép tương đồng bắt cặp (tiếp hợp), có thể trao đổi chéo đoạn chromatid.",
    "Các cặp NST kép tương đồng xếp thành 2 hàng; mỗi cặp xếp ngẫu nhiên, độc lập.",
    "Mỗi NST kép trong cặp tương đồng đi về một cực (chưa tách tâm động).",
    "Tạo 2 tế bào, mỗi tế bào có n NST kép.",
    "NST kép co xoắn lại, thoi phân bào hình thành trong mỗi tế bào.",
    "Các NST kép xếp thành 1 hàng trên mặt phẳng xích đạo.",
    "Hai chromatid của mỗi NST kép tách nhau ở tâm động, đi về hai cực.",
    "Tạo 4 tế bào con, mỗi tế bào có n NST đơn (bộ NST giảm đi một nửa).",
  ],
};

const hidden = s => s.quiz && s.answer !== "right";
const typeName = s => (s.type === "meiosis" ? "Giảm phân" : "Nguyên phân");

function go(s, api, dir, manual) {
  const last = phasesOf(s).length - 1;
  const from = phaseOf(s);
  const next = clamp(from + dir, 0, last);
  if (next === from) return;
  // meiosis I: each homologous pair lines up at random when it reaches the plate
  if (s.type === "meiosis" && dir > 0 && next === 3) s.orient = Math.floor(Math.random() * (1 << (s.n2 / 2)));
  s.phase = next;
  s.answer = "";
  if (manual) api.emit("phase-step", { phase: next, direction: dir }, "action");
  if (next === last) {
    const cs = cells(s);
    api.emit("division-complete", { type: s.type === "meiosis" ? 1 : 0, daughterCells: cs.length, chromosomesPerCell: counts(cs[0]).chromosomes }, "result");
  }
}

/** One chromosome, axis along the local y axis rotated by `ang`; centromere at the middle. */
function chromosome(ctx, c, x, y, ang, L, t, thin) {
  const len = size(c.pair, L);
  const w = thin ? Math.max(1.5, t * 0.45) : t;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (thin) ctx.globalAlpha = 0.8;
  const two = c.chromatids.length === 2;
  c.chromatids.forEach((ct, i) => {
    const ox = two ? (i ? 1 : -1) * w * 0.58 : 0;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(ox - w / 2, -len / 2, w, len, w / 2);
    ctx.fillStyle = PAIR[c.pair][ct.base];
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = PAIR[c.pair][ct.tip];
    ctx.fillRect(ox - w / 2, -len / 2, w, len * 0.32);
    ctx.restore();
    ctx.strokeStyle = "rgba(31,42,68,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ox - w / 2, -len / 2, w, len, w / 2);
    ctx.stroke();
  });
  if (!thin) {
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.ellipse(0, 0, two ? w * 1.05 : w * 0.45, w * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Positions on a grid inside a circle of radius R, with a fixed tilt per item. */
function scatter(items, cx, cy, R) {
  const cols = Math.ceil(Math.sqrt(items.length * 1.4));
  const rows = Math.ceil(items.length / cols);
  const cw = (1.5 * R) / cols;
  const ch = (1.5 * R) / rows;
  return {
    cell: Math.min(cw, ch),
    at: items.map((c, i) => ({
      c,
      // the last row, if not full, is centred
      x: cx - 0.75 * R + cw * ((i % cols) + 0.5) + (Math.floor(i / cols) === rows - 1 ? (cw * (rows * cols - items.length)) / 2 : 0),
      y: cy - 0.75 * R + ch * (Math.floor(i / cols) + 0.5),
      ang: ((((i * 47) % 90) - 45) * Math.PI) / 180,
    })),
  };
}

/** A row of chromosomes along x (axis horizontal) centred on cx, ordered by pair. */
function row(items, L, cx, y) {
  const gap = L * 0.3;
  const total = items.reduce((sum, c) => sum + size(c.pair, L), 0) + gap * Math.max(0, items.length - 1);
  let x = cx - total / 2;
  return items.map(c => {
    const len = size(c.pair, L);
    const p = { c, x: x + len / 2, y, ang: Math.PI / 2 };
    x += len + gap;
    return p;
  });
}
const rowFactor = items => items.reduce((sum, c) => sum + 1 - 0.18 * c.pair, 0) + 0.3 * Math.max(0, items.length - 1);
const byPair = list => [...list].sort((a, b) => a.pair - b.pair || a.parent - b.parent);

function drawCell(ctx, cell, box) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = box.w * 0.46;
  const ry = box.h * 0.45;
  const R = Math.min(rx, ry);
  ctx.fillStyle = "#fffaf0";
  ctx.strokeStyle = "#c9b48a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const list = byPair(cell.chromosomes);
  const lay = cell.layout;
  let L;
  let at;
  let thin = false;
  const spindle = lay === "plate" || lay === "plate2" || lay === "poles";
  if (lay === "interphase" || lay === "prophase" || lay === "telophase") {
    const Rn = R * (lay === "prophase" ? 0.88 : 0.8);
    ctx.fillStyle = lay === "prophase" ? "rgba(0,0,0,0)" : "#f3ecdb";
    ctx.strokeStyle = "#b39c6e";
    ctx.lineWidth = 1.5;
    if (lay === "prophase") ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, Rn, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    const g = scatter(list, cx, cy, Rn);
    L = Math.min(g.cell * 0.95, R * 0.6);
    at = g.at;
    thin = lay === "interphase";
  } else if (lay === "synapsis") {
    // homologous pairs side by side (bivalents)
    const pairs = [...new Set(list.map(c => c.pair))].map(p => list.filter(c => c.pair === p));
    const g = scatter(pairs, cx, cy, R * 0.9);
    L = g.cell * 0.85;
    const t = L * 0.16;
    at = g.at.flatMap(({ c: pair, x, y, ang }) =>
      pair.map((c, i) => ({ c, x: x + Math.cos(ang) * (i ? 1 : -1) * t * 1.25, y: y + Math.sin(ang) * (i ? 1 : -1) * t * 1.25, ang }))
    );
  } else {
    const groups = lay === "plate" ? [list] : [list.filter(c => c.pole === -1), list.filter(c => c.pole === 1)];
    L = Math.min(((lay === "poles" ? 1.35 : 1.6) * rx) / Math.max(...groups.map(rowFactor)), ry * 0.6); // rows near the poles must fit the narrower ellipse
    const t = L * 0.16;
    const ys = lay === "plate" ? [cy] : lay === "plate2" ? [cy - t * 1.7, cy + t * 1.7] : [cy - ry * 0.5, cy + ry * 0.5];
    at = groups.flatMap((gr, i) => row(gr, L, cx, ys[i]));
  }
  const t = Math.max(3, L * 0.16);
  if (spindle) {
    const poles = [cy - ry * 0.9, cy + ry * 0.9];
    ctx.strokeStyle = "rgba(107,120,144,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of at) for (const py of poles) {
      if (lay !== "plate" && Math.sign(py - cy) !== p.c.pole) continue;
      ctx.moveTo(cx, py);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    for (const py of poles) {
      ctx.beginPath();
      ctx.arc(cx, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (lay !== "poles") {
      ctx.strokeStyle = "rgba(107,120,144,0.6)";
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.92, cy);
      ctx.lineTo(cx + rx * 0.92, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  for (const p of at) chromosome(ctx, p.c, p.x, p.y, p.ang, L, t, thin);
}

function boxes(k, A) {
  let cols = k;
  let rows = 1;
  if (k === 4 && A.w / A.h < 2.4) cols = rows = 2;
  const w = A.w / cols;
  const h = A.h / rows;
  return Array.from({ length: k }, (_, i) => ({ x: A.x + w * (i % cols), y: A.y + h * Math.floor(i / cols), w, h }));
}

mount({
  slug: "nguyen-phan-giam-phan",
  version: "1.0.0",
  title: "Nguyên phân và giảm phân",
  hint: "Bấm «Bước tiếp» (hoặc Chạy) để đi qua từng kì. Số NST, chromatid và tâm động được đếm trên chính các tế bào trong hình.",
  initialState,
  step(s, dt, api) {
    const last = phasesOf(s).length - 1;
    if (phaseOf(s) === last) {
      // playing again after the end starts a new division
      s.phase = 0;
      s.answer = "";
      s._clock = 0;
      return;
    }
    s._clock = (s._clock ?? 0) + dt;
    if (s._clock < STEP_TIME) return;
    s._clock = 0;
    go(s, api, 1, false);
    if (phaseOf(s) === last) api.pause();
  },
  controls: [
    { type: "button", label: "Bước tiếp ▶", primary: true, disabled: s => phaseOf(s) === phasesOf(s).length - 1, action: (s, api) => go(s, api, 1, true) },
    { type: "button", label: "◀ Bước trước", disabled: s => phaseOf(s) === 0, action: (s, api) => go(s, api, -1, true) },
    {
      type: "select",
      key: "type",
      label: "Quá trình",
      onChange: s => ((s.phase = 0), (s.answer = "")),
      options: [
        { value: "mitosis", label: "Nguyên phân" },
        { value: "meiosis", label: "Giảm phân" },
      ],
    },
    {
      type: "select",
      key: "n2",
      label: "Bộ NST của tế bào",
      onChange: s => (s.answer = ""),
      options: [
        { value: 4, label: "2n = 4" },
        { value: 6, label: "2n = 6" },
        { value: 8, label: "2n = 8" },
      ],
    },
    { type: "checkbox", key: "crossing", label: "Trao đổi chéo ở cặp NST lớn nhất (kì đầu I)", visible: s => s.type === "meiosis" },
    { type: "heading", label: "Câu hỏi" },
    { type: "checkbox", key: "quiz", label: "Tự đoán số NST trong mỗi tế bào", onChange: s => (s.answer = "") },
    { type: "stepper", key: "guess", label: "Số NST mỗi tế bào", min: 1, max: 32, visible: s => s.quiz, onChange: s => (s.answer = "") },
    {
      type: "select",
      key: "guessKind",
      label: "Trạng thái NST",
      visible: s => s.quiz,
      onChange: s => (s.answer = ""),
      options: [
        { value: "kep", label: "NST kép" },
        { value: "don", label: "NST đơn" },
      ],
    },
    {
      type: "button",
      label: "Kiểm tra",
      visible: s => s.quiz,
      action(s, api) {
        s.answer = isRight(s) ? "right" : "wrong";
        if (s.answer === "right") api.emit("count-predicted", { phase: phaseOf(s), chromosomes: s.guess, kep: s.guessKind === "kep" ? 1 : 0 }, "goal");
      },
    },
  ],
  readouts: [
    { label: "Số tế bào", value: s => fmt(cells(s).length, 0) },
    { label: "NST trong mỗi tế bào", value: s => (hidden(s) ? "?" : `${answerOf(s).chromosomes} NST ${KIND[answerOf(s).kind]}`) },
    { label: "Số chromatid mỗi tế bào", value: s => (hidden(s) ? "?" : fmt(answerOf(s).chromatids, 0)) },
    { label: "Số tâm động mỗi tế bào", value: s => (hidden(s) ? "?" : fmt(answerOf(s).centromeres, 0)) },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 380;
    const fs = small ? 11 : 13;
    const pad = 8;
    const ph = phaseOf(s);
    const names = phasesOf(s);

    // header: process, step and a progress strip
    label(ctx, `${typeName(s)} (2n = ${s.n2}) · bước ${ph + 1}/${names.length}`, pad, 11, { size: fs, color: COLORS.muted });
    label(ctx, names[ph], pad, 11 + fs * 1.45, { size: fs + 3, bold: true });
    const stripY = 11 + fs * 2.9;
    const seg = (view.w - 2 * pad) / names.length;
    names.forEach((_, i) => {
      ctx.fillStyle = i < ph ? "#9dbcf7" : i === ph ? COLORS.blue : COLORS.grid;
      ctx.fillRect(pad + seg * i + 1, stripY, seg - 2, 4);
    });

    // footer: counts or the question, then the note and the legend
    const lines = [];
    const a = answerOf(s);
    const k = cells(s).length;
    if (s.quiz) {
      lines.push({ text: "Mỗi tế bào ở bước này có bao nhiêu NST? NST đơn hay kép?", bold: true, color: COLORS.purple });
      if (s.answer === "right") lines.push({ text: `Đúng: ${a.chromosomes} NST ${KIND[a.kind]} · ${a.chromatids} chromatid${small ? "" : ` · ${a.centromeres} tâm động`}`, bold: true, color: COLORS.green });
      else if (s.answer === "wrong") lines.push({ text: small ? "Chưa đúng, hãy đếm lại trong một tế bào." : "Chưa đúng. Đếm số NST trong một tế bào: mỗi NST có một tâm động.", bold: true, color: COLORS.red });
    } else {
      lines.push({ text: `${k > 1 ? `${k} tế bào, mỗi tế bào: ` : "Tế bào có: "}${a.chromosomes} NST ${KIND[a.kind]} · ${a.chromatids} chromatid · ${a.centromeres} tâm động`, bold: true });
    }
    if (!small) lines.push({ text: NOTES[s.type === "meiosis" ? "meiosis" : "mitosis"][ph], color: COLORS.ink });
    lines.push({ text: small ? "Đậm: NST từ mẹ, nhạt: từ bố · không theo tỉ lệ" : "Mỗi cặp NST tương đồng một màu: đậm là NST từ mẹ, nhạt là NST từ bố. Hình minh hoạ, không theo tỉ lệ.", color: COLORS.muted, size: small ? 10 : 12 });
    const lh = fs * 1.45;
    const footTop = view.h - lines.length * lh - 4;
    lines.forEach((l, i) => label(ctx, l.text, pad, footTop + lh * (i + 0.5), { size: l.size ?? fs, bold: l.bold, color: l.color }));

    const area = { x: pad, y: stripY + 10, w: view.w - 2 * pad, h: footTop - stripY - 14 };
    for (const [i, box] of boxes(k, area).entries()) drawCell(ctx, cells(s)[i], box);
  },
});
