import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import {
  initialState, STAGES, FERMENTATION, stageAtp, aerobicShare, atpPerGlucose, pathway, etcRuns, pickStage,
  AEROBIC_ATP, FERMENT_ATP, CARD_ORDER,
} from "./model.js";

const ATP_C = "#d97706";
const STAGE_FILL = ["#fff4e0", "#e8f4ec", "#e3f0fb", "#efe9fd"];

// Everything is placed from the view size so draw() and the pointer agree.
function geom(view) {
  const W = view.w;
  const H = view.h;
  const small = W < 600 || H < 440;
  const head = small ? 24 : 46;
  const foot = small ? 16 : 22;
  const pill = small ? 20 : 28;
  const pad = small ? 8 : 18;
  const colA = { x: pad, w: Math.min((W - 3 * pad) * (small ? 0.62 : 0.58), 380) };
  const colB = { x: colA.x + colA.w + pad, w: Math.min(W - colA.x - colA.w - 2 * pad, 320) };
  const gap = small ? 14 : 24; // arrow between boxes
  const top = head + pill + gap;
  const boxH = Math.min((H - top - foot - 3 * gap) / 4, small ? 70 : 96);
  const boxes = STAGES.map((_, i) => ({ x: colA.x, y: top + i * (boxH + gap), w: colA.w, h: boxH }));
  return { W, H, small, head, foot, pill, pad, colA, colB, gap, boxH, boxes, glucose: { x: colA.x, y: head, w: colA.w, h: pill } };
}

// Quiz cards sit in column B, in the shuffled order.
function cards(g) {
  const h = Math.min(g.boxH * 0.62, g.small ? 36 : 46);
  const gap = g.small ? 8 : 12;
  const y0 = g.boxes[0].y;
  return CARD_ORDER.map((k, j) => ({ k, x: g.colB.x, y: y0 + j * (h + gap), w: g.colB.w, h }));
}

function box(ctx, b, fill, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.strokeStyle = "rgba(31,42,68,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// A row of coloured tags; the font shrinks until the row fits in maxW.
function chips(ctx, items, x, y, size, maxW) {
  ctx.save();
  const width = sz => {
    ctx.font = `600 ${sz}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    return items.reduce((a, [t]) => a + ctx.measureText(t).width + 15, -5);
  };
  while (size > 8 && width(size) > maxW) size--;
  width(size);
  for (const [text, color] of items) {
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = color + "22";
    ctx.beginPath();
    ctx.roundRect(x, y - size * 0.75, w, size * 1.5, 6);
    ctx.fill();
    label(ctx, text, x + 5, y, { size, bold: true, color });
    x += w + 5;
  }
  ctx.restore();
}

function draw(ctx, s, view) {
  const g = geom(view);
  const a = aerobicShare(s.oxygen);
  const atp = stageAtp();
  const f = FERMENTATION[s.fermentation] ?? FERMENTATION.lactic;
  const size = g.small ? 11 : 13;
  const big = g.small ? 12 : 15;
  const placed = s.quiz ? Math.max(0, Math.min(4, Math.floor(s.placed) || 0)) : 4;

  // equation
  const eq = a === 0
    ? `C₆H₁₂O₆ → ${s.fermentation === "ethanol" ? "2C₂H₅OH + 2CO₂" : "2C₃H₆O₃ (lactic acid)"} + 2 ATP`
    : `C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ${g.small ? "38 ATP" : "năng lượng (38 ATP)"}`;
  label(ctx, eq, g.W / 2, g.small ? 12 : 22, { align: "center", size: big, bold: true });

  // glucose
  const gl = g.glucose;
  box(ctx, gl, "#fff", 1);
  label(ctx, "1 glucose (C₆H₁₂O₆)", gl.x + gl.w / 2, gl.y + gl.h / 2, { align: "center", size, bold: true });
  arrow(ctx, gl.x + gl.w / 2, gl.y + gl.h + 2, gl.x + gl.w / 2, g.boxes[0].y - 2, COLORS.muted, 2);

  // aerobic stages
  g.boxes.forEach((b, i) => {
    const alpha = i === 0 ? 1 : 0.25 + 0.75 * a;
    const known = i < placed;
    box(ctx, b, known ? STAGE_FILL[i] : "#f1f3f8", alpha);
    ctx.save();
    ctx.globalAlpha = alpha;
    const tx = b.x + 10;
    if (!known) {
      label(ctx, `${i + 1}. ?`, tx, b.y + b.h / 2, { size: big, bold: true, color: COLORS.muted });
      ctx.restore();
      return;
    }
    const st = STAGES[i];
    label(ctx, `${i + 1}. ${st.name}`, tx, b.y + b.h * 0.24, { size: big, bold: true });
    ctx.font = `600 ${big}px system-ui, sans-serif`;
    const nameW = ctx.measureText(`${i + 1}. ${st.name}`).width;
    ctx.font = `${size - 1}px system-ui, sans-serif`;
    if (nameW + ctx.measureText(st.place).width + 26 < b.w) {
      label(ctx, st.place, b.x + b.w - 8, b.y + b.h * 0.24, { size: size - 1, align: "right", color: COLORS.muted });
    }
    const items = [[`${atp[i] ? "+" : ""}${atp[i]} ATP`, ATP_C]];
    if (i === 3) {
      items.push([g.small ? "6 O₂" : "nhận 6 O₂", COLORS.blue]);
    } else {
      if (st.nadh) items.push([`${st.nadh} NADH`, COLORS.purple]);
      if (st.fadh2) items.push([`${st.fadh2} FADH₂`, COLORS.purple]);
      if (st.co2) items.push([`${st.co2} CO₂`, COLORS.muted]);
    }
    chips(ctx, items, tx, b.y + b.h * 0.56, size - 1, b.w - 16);
    if (!g.small || b.h > 54) {
      const note = i === 3 ? "10 NADH × 3 + 2 FADH₂ × 2 = 34 ATP; tạo H₂O" : `→ ${st.out}`;
      label(ctx, note, tx, b.y + b.h * 0.84, { size: size - 1, color: COLORS.muted });
    }
    ctx.restore();
    if (i < 3) arrow(ctx, b.x + b.w / 2, b.y + b.h + 2, b.x + b.w / 2, g.boxes[i + 1].y - 2, a > 0 ? COLORS.muted : "#c9d0de", 2);
  });

  // no oxygen: the chain stops
  if (!etcRuns(s.oxygen) && placed === 4) {
    const b = g.boxes[3];
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(b.x + 4, b.y + b.h / 2 - size, b.w - 8, 2 * size);
    label(ctx, g.small ? "Không có O₂: chuỗi dừng" : "Không có O₂ nhận electron: chuỗi dừng", b.x + b.w / 2, b.y + b.h / 2, { align: "center", size, bold: true, color: COLORS.red });
  }

  if (s.quiz) {
    drawQuiz(ctx, s, g, size, big);
  } else {
    drawFermentation(ctx, s, g, a, f, size, big);
  }

  const foot = g.W < 760
    ? "Số ATP theo cách tính trong SGK; thực tế ≈ 30–32"
    : "Số ATP theo cách tính trong SGK (1 NADH → 3 ATP, 1 FADH₂ → 2 ATP); số đo thực tế khoảng 30–32 ATP";
  label(ctx, foot, g.W / 2, g.H - g.foot / 2, { align: "center", size: g.small ? 10 : 12, color: COLORS.muted });
}

function drawFermentation(ctx, s, g, a, f, size, big) {
  const b0 = g.boxes[0];
  const x = g.colB.x;
  const w = g.colB.w;
  const alpha = 0.25 + 0.75 * (1 - a);
  // branch from glycolysis
  const fb = { x, y: g.boxes[1].y, w, h: g.boxes[1].h + g.gap + g.boxes[2].h * 0.5 };
  ctx.save();
  ctx.globalAlpha = alpha;
  arrow(ctx, b0.x + b0.w + 2, b0.y + b0.h / 2, x + w / 2, b0.y + b0.h / 2, COLORS.muted, 2);
  arrow(ctx, x + w / 2, b0.y + b0.h / 2, x + w / 2, fb.y - 2, COLORS.muted, 2);
  ctx.restore();
  label(ctx, g.small ? "thiếu O₂" : "khi thiếu O₂", x + w / 2 + 6, b0.y + b0.h / 2 - 10, { size: size - 1, color: COLORS.muted });
  box(ctx, fb, "#fdecec", alpha);
  ctx.save();
  ctx.globalAlpha = alpha;
  const tx = x + 10;
  const narrow = w < 260;
  const lines = narrow
    ? [
        [f.short, big, true, COLORS.ink],
        ["Tế bào chất", size - 1, false, COLORS.muted],
        ["2 pyruvic acid →", size - 1, true, COLORS.ink],
        [`2 ${f.product}${f.co2 ? " + 2 CO₂" : ""}`, size - 1, true, COLORS.ink],
        ["Chỉ 2 ATP", size - 1, true, ATP_C],
      ]
    : [
        [f.name, big, true, COLORS.ink],
        [`Tế bào chất · ${f.where}`, size - 1, false, COLORS.muted],
        [`2 pyruvic acid → 2 ${f.product}${f.co2 ? " + 2 CO₂" : ""}`, size - 1, true, COLORS.ink],
        ["NADH được dùng lại, không qua ti thể", size - 1, false, COLORS.muted],
        ["Chỉ 2 ATP (của đường phân)", size - 1, true, ATP_C],
      ];
  const step = fb.h / (lines.length + 0.4);
  lines.forEach(([text, sz, bold, color], i) => label(ctx, text, tx, fb.y + step * (i + 0.7), { size: sz, bold, color }));
  ctx.restore();

  // ATP per glucose
  const by = g.boxes[3].y;
  const bh = g.boxes[3].h;
  const atp = atpPerGlucose(s.oxygen);
  label(ctx, "ATP / glucose", x, by + bh * 0.15, { size, color: COLORS.muted });
  label(ctx, `≈ ${fmt(atp, 1)}`, x + w, by + bh * 0.15, { size: big + 3, bold: true, color: ATP_C, align: "right" });
  const barY = by + bh * 0.38;
  const barH = Math.min(14, bh * 0.2);
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(x, barY, w, barH);
  ctx.fillStyle = ATP_C;
  ctx.fillRect(x, barY, (w * atp) / AEROBIC_ATP, barH);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(x + (w * FERMENT_ATP) / AEROBIC_ATP, barY - 3, 2, barH + 6);
  const p = pathway(s.oxygen);
  const text = p === 2 ? "Hô hấp hiếu khí" : p === 0 ? "Chỉ lên men" : w < 220 ? `${fmt(a * 100, 0)} % hiếu khí` : `${fmt(a * 100, 0)} % hiếu khí, ${fmt((1 - a) * 100, 0)} % lên men`;
  label(ctx, text, x, by + bh * 0.82, { size: size - 1, bold: true, color: p === 0 ? COLORS.red : COLORS.green });
}

function drawQuiz(ctx, s, g, size, big) {
  label(ctx, g.colB.w < 300 ? "Chạm theo đúng thứ tự:" : "Chạm vào các giai đoạn theo đúng thứ tự:", g.colB.x, g.boxes[0].y - g.gap / 2, { size, bold: true });
  for (const c of cards(g)) {
    const done = c.k < s.placed;
    ctx.fillStyle = done ? "#eef1f6" : "#fff";
    ctx.strokeStyle = done ? COLORS.grid : COLORS.blue;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 8);
    ctx.fill();
    ctx.stroke();
    label(ctx, STAGES[c.k].name, c.x + c.w / 2, c.y + c.h / 2, { align: "center", size: big - 1, bold: true, color: done ? COLORS.muted : COLORS.ink });
  }
  const last = cards(g).at(-1);
  const msg = s.placed >= 4 ? `Đúng thứ tự! (${s.mistakes} lần chọn sai)` : `Đã xếp ${s.placed}/4 · chọn sai ${s.mistakes} lần`;
  label(ctx, msg, g.colB.x, last.y + last.h + (g.small ? 12 : 20), { size, bold: true, color: s.placed >= 4 ? COLORS.green : COLORS.muted });
}

const report = (s, api) => {
  api.emit("respiration-yield", {
    oxygen: s.oxygen, atpPerGlucose: atpPerGlucose(s.oxygen), pathway: pathway(s.oxygen), aerobicPercent: aerobicShare(s.oxygen) * 100,
  }, "result");
};

const pick = (s, api, k) => {
  const r = pickStage(s, k);
  api.emit("stage-picked", { stage: k + 1, correct: r.correct ? 1 : 0 });
  if (r.done) api.emit("stages-ordered", { mistakes: s.mistakes }, "goal");
};

mount({
  slug: "ho-hap-te-bao",
  version: "1.0.0",
  title: "Hô hấp tế bào",
  hint: "Giảm nồng độ O₂ để xem tế bào chuyển sang lên men. Bật thử thách để xếp các giai đoạn theo đúng thứ tự.",
  initialState,
  controls: [
    { type: "slider", key: "oxygen", label: "Nồng độ O₂ (so với bình thường)", min: 0, max: 100, step: 1, unit: "%", digits: 0, onCommit: report },
    {
      type: "select",
      key: "fermentation",
      label: "Kiểu lên men khi thiếu O₂",
      options: [
        { value: "lactic", label: "Lên men lactic (tế bào cơ, vi khuẩn lactic)" },
        { value: "ethanol", label: "Lên men rượu (nấm men)" },
      ],
    },
    { type: "heading", label: "Thử thách" },
    {
      type: "checkbox",
      key: "quiz",
      label: "Xếp các giai đoạn theo thứ tự",
      onChange: s => Object.assign(s, { placed: 0, mistakes: 0 }),
    },
    {
      type: "select",
      key: "pick",
      label: "Giai đoạn tiếp theo (dùng bàn phím)",
      visible: s => s.quiz,
      options: [{ value: -1, label: "— chọn giai đoạn —" }, ...CARD_ORDER.map(k => ({ value: k, label: STAGES[k].name }))],
      onChange(s, api) {
        const k = s.pick;
        s.pick = -1;
        if (k >= 0) pick(s, api, k);
      },
    },
  ],
  readouts: [
    { label: "ATP / glucose", value: s => `${fmt(atpPerGlucose(s.oxygen), 1)} ATP` },
    { label: "Hô hấp hiếu khí", value: s => `${fmt(aerobicShare(s.oxygen) * 100, 0)} % glucose` },
    { label: "Chuỗi truyền electron", value: s => (etcRuns(s.oxygen) ? "hoạt động" : "dừng (không có O₂)") },
    { label: "Sản phẩm lên men", value: s => (s.fermentation === "ethanol" ? "ethanol + CO₂" : "lactic acid") },
  ],
  pointer: {
    down(p, s, api, view) {
      if (!s.quiz) return false;
      const c = cards(geom(view)).find(c => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
      if (!c) return false;
      pick(s, api, c.k);
    },
  },
  draw,
});
