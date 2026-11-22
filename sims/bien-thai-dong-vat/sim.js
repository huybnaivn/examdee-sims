import { mount, COLORS, label, arrow, fmt } from "../../kit/v1/kit.js";
import {
  ANIMALS, TYPES, THRESHOLD, OUTCOME, initialState, animalOf, placed, isComplete, isCorrect, place, clearTimeline,
  chosenType, classifiedRight, classifiedCount, allClassified, moultOutcome,
} from "./model.js";

const isSmall = view => view.w < 520 || view.h < 420;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const inCycle = s => s.view !== "hormone";
const FACTS = {
  butterfly: "Sâu bướm khác hẳn bướm về hình dạng và cấu tạo; sâu phải qua giai đoạn nhộng mới thành bướm.",
  grasshopper: "Ấu trùng giống con trưởng thành nhưng nhỏ và chưa có cánh; nó lột xác nhiều lần để lớn lên, không qua giai đoạn nhộng.",
  human: "Con sinh ra đã có hình dạng và cấu tạo giống người trưởng thành; không có giai đoạn ấu trùng, không lột xác.",
};

// ---------- events ----------
const placeCard = (s, api, card) => {
  const r = place(s, card);
  if (!r) return;
  const id = ANIMALS[animalOf(s)].id;
  api.emit("place-stage", { animal: id, stage: r.stage, position: r.position, correct: r.correct ? 1 : 0 }, "action");
  if (isComplete(s)) api.emit("cycle-completed", { animal: id, correct: isCorrect(s) ? 1 : 0, stages: r.position }, "result");
};
const checkClassified = (s, api) => {
  const ok = allClassified(s);
  if (ok && !s.classified) api.emit("all-classified", { animals: classifiedCount(s) }, "goal");
  s.classified = ok;
};
const outcomeOf = s => moultOutcome(s.insectStage, s.ecdysone, s.juvenile);
const hormoneReport = (s, api) => {
  api.emit("moult-outcome", { stage: s.insectStage === "pupa" ? 2 : 1, ecdysone: s.ecdysone, juvenile: s.juvenile, outcome: outcomeOf(s) }, "result");
};
const outcomeText = s => {
  const pupa = s.insectStage === "pupa";
  switch (outcomeOf(s)) {
    case OUTCOME.larvalMoult: return "Sâu lột xác thành sâu lớn hơn (vẫn là ấu trùng).";
    case OUTCOME.pupation: return "Sâu lột xác và hóa nhộng.";
    case OUTCOME.adult: return "Nhộng lột xác thành bướm trưởng thành.";
    default:
      if (s.ecdysone < THRESHOLD) return pupa ? "Thiếu ecdysone: nhộng chưa biến đổi." : "Thiếu ecdysone: sâu không lột xác.";
      return "Juvenile còn cao: nhộng bị ức chế, chưa thành bướm.";
  }
};

// ---------- small drawing helpers ----------
function ell(ctx, x, y, rx, ry, fill, rot = 0, stroke = null) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
function line(ctx, pts, colour, width) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.stroke();
}
function para(ctx, text, x, y, maxW, lineH, opts) {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  const lines = [];
  let row = "";
  for (const word of text.split(" ")) {
    const next = row ? `${row} ${word}` : word;
    if (row && ctx.measureText(next).width > maxW) {
      lines.push(row);
      row = word;
    } else row = next;
  }
  lines.push(row);
  lines.forEach((l, i) => label(ctx, l, x, y + i * lineH, { ...opts, align: "center" }));
  return lines.length;
}

const INK = COLORS.ink;
function caterpillar(ctx, x, y, r) {
  for (let i = 0; i < 6; i++) ell(ctx, x - r * 0.75 + i * r * 0.3, y + (i % 2 ? -1 : 1) * r * 0.06, r * 0.2, r * 0.2, i === 5 ? "#3f8f4f" : "#7fcb78", 0, INK);
  ell(ctx, x + r * 0.8, y - r * 0.05, r * 0.035, r * 0.035, INK);
}
function pupa(ctx, x, y, r) {
  line(ctx, [[x, y - r], [x, y - r * 0.6]], INK, 1.5);
  ell(ctx, x, y, r * 0.32, r * 0.62, "#b98a52", 0, INK);
  for (const k of [-0.25, 0.05, 0.3]) line(ctx, [[x - r * 0.27, y + r * k], [x + r * 0.27, y + r * k]], "#7a5a30", 1);
}
function butterfly(ctx, x, y, r) {
  for (const side of [-1, 1]) {
    ell(ctx, x + side * r * 0.45, y - r * 0.25, r * 0.42, r * 0.55, COLORS.orange, side * 0.5, INK);
    ell(ctx, x + side * r * 0.35, y + r * 0.42, r * 0.28, r * 0.34, COLORS.yellow, side * -0.4, INK);
    line(ctx, [[x, y - r * 0.5], [x + side * r * 0.25, y - r * 0.92]], INK, 1.2);
  }
  ell(ctx, x, y, r * 0.08, r * 0.55, INK);
}
function hopper(ctx, x, y, R, wings) {
  line(ctx, [[x + R * 0.3, y + R * 0.15], [x + R * 0.35, y + R * 0.5]], "#3e7d2c", 1.5);
  line(ctx, [[x + R * 0.55, y + R * 0.15], [x + R * 0.65, y + R * 0.5]], "#3e7d2c", 1.5);
  ell(ctx, x, y, R * 0.75, R * 0.2, "#8fca62", 0, INK);
  if (wings) ell(ctx, x - R * 0.2, y - R * 0.16, R * 0.75, R * 0.12, "#c9a24b", -0.06, INK);
  ell(ctx, x + R * 0.75, y - R * 0.05, R * 0.2, R * 0.24, "#5da043", 0, INK);
  ell(ctx, x + R * 0.82, y - R * 0.1, R * 0.05, R * 0.05, INK);
  line(ctx, [[x - R * 0.25, y], [x - R * 0.6, y - R * 0.6], [x - R * 0.75, y + R * 0.5]], "#3e7d2c", Math.max(1.5, R * 0.08));
  line(ctx, [[x + R * 0.9, y - R * 0.25], [x + R * 1.1, y - R * 0.7]], INK, 1);
}
function person(ctx, x, y, R, shirt) {
  ctx.fillStyle = INK;
  ctx.fillRect(x - R * 0.2, y + R * 0.2, R * 0.17, R * 0.72);
  ctx.fillRect(x + R * 0.03, y + R * 0.2, R * 0.17, R * 0.72);
  line(ctx, [[x - R * 0.22, y - R * 0.4], [x - R * 0.42, y + R * 0.15]], "#f3c9a8", Math.max(2, R * 0.12));
  line(ctx, [[x + R * 0.22, y - R * 0.4], [x + R * 0.42, y + R * 0.15]], "#f3c9a8", Math.max(2, R * 0.12));
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.roundRect(x - R * 0.24, y - R * 0.5, R * 0.48, R * 0.75, R * 0.1);
  ctx.fill();
  ell(ctx, x, y - R * 0.72, R * 0.2, R * 0.2, "#f3c9a8", 0, INK);
}

/** Picture of one stage, centred on (x, y), fitting a circle of radius r. */
function icon(ctx, animal, stage, x, y, r) {
  if (animal === "butterfly") {
    if (stage === 0) {
      ell(ctx, x, y + r * 0.15, r * 0.9, r * 0.42, "#9bd3a0", -0.2, "#5da043");
      for (const [dx, dy] of [[-0.3, 0.05], [0, -0.05], [0.3, 0.1]]) ell(ctx, x + r * dx, y + r * dy, r * 0.13, r * 0.13, "#fff7d6", 0, INK);
    } else if (stage === 1) caterpillar(ctx, x, y, r);
    else if (stage === 2) pupa(ctx, x, y, r);
    else butterfly(ctx, x, y, r);
  } else if (animal === "grasshopper") {
    if (stage === 0) {
      ell(ctx, x, y + r * 0.3, r * 0.9, r * 0.38, "#d9c3a0");
      for (let i = 0; i < 4; i++) ell(ctx, x + (i - 1.5) * r * 0.28, y + r * 0.2, r * 0.09, r * 0.26, "#fff3c4", 0.2 * (i - 1.5), INK);
    } else hopper(ctx, x - r * 0.1, y + (stage === 1 ? r * 0.2 : 0), r * (stage === 1 ? 0.55 : 0.85), stage === 2);
  } else if (stage === 0) {
    ell(ctx, x, y, r * 0.45, r * 0.45, "#ffe3d1", 0, INK);
    ell(ctx, x, y, r * 0.15, r * 0.15, "#e5a07f");
  } else if (stage === 1) {
    for (let i = 0; i < 6; i++) ell(ctx, x + r * 0.32 * Math.cos(i * 1.047), y + r * 0.32 * Math.sin(i * 1.047), r * 0.2, r * 0.2, "#ffe3d1", 0, INK);
    ell(ctx, x, y, r * 0.2, r * 0.2, "#ffe3d1", 0, INK);
  } else if (stage === 2) {
    ell(ctx, x, y, r * 0.85, r * 0.85, "#fde7ef", 0, "#e5a0b5");
    ell(ctx, x + r * 0.1, y + r * 0.15, r * 0.3, r * 0.42, "#f3c9a8", 0.5, INK);
    ell(ctx, x - r * 0.12, y + r * 0.45, r * 0.22, r * 0.11, "#f3c9a8", -0.3, INK);
    ell(ctx, x - r * 0.15, y - r * 0.3, r * 0.28, r * 0.28, "#f3c9a8", 0, INK);
  } else if (stage === 3) person(ctx, x, y + r * 0.38, r * 0.6, COLORS.orange);
  else person(ctx, x, y, r, COLORS.blue);
}

// ---------- life-cycle view ----------
function geom(s, view) {
  const small = isSmall(view);
  const animal = animalOf(s);
  const n = ANIMALS[animal].stages.length;
  const pad = small ? 8 : 36;
  const top = small ? 42 : 88;
  const ch = small ? 80 : Math.max(90, Math.min(180, (view.h - top - 200) / 2));
  const cw = Math.min((view.w - 2 * pad) / n, small ? 86 : 170);
  return { small, animal, n, pad, top, ch, cw, x0: (view.w - cw * n) / 2, ySlots: top, yCards: top + ch + (small ? 26 : 50) };
}

function drawCard(ctx, g, x, y, stage, { border = COLORS.muted, width = 1, number = 0 } = {}) {
  const m = g.small ? 3 : 8;
  const nameH = g.small ? 16 : 26;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = border;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.roundRect(x + m, y, g.cw - 2 * m, g.ch, 8);
  ctx.fill();
  ctx.stroke();
  const r = Math.min(g.cw - 2 * m, g.ch - nameH) / 2 - (g.small ? 5 : 10);
  icon(ctx, g.animal, stage, x + g.cw / 2, y + (g.ch - nameH) / 2 + 2, r);
  label(ctx, ANIMALS[g.animal].stages[stage], x + g.cw / 2, y + g.ch - nameH / 2 - 1, { size: g.small ? 10 : 14, align: "center", bold: true });
  if (number) label(ctx, `${number}`, x + m + (g.small ? 6 : 10), y + (g.small ? 9 : 14), { size: g.small ? 10 : 13, color: COLORS.muted, bold: true });
}

function drawCycle(ctx, s, view) {
  const g = geom(s, view);
  const { small, animal, n, pad, cw, ch, x0 } = g;
  const a = ANIMALS[animal];
  const list = placed(s);
  const done = isComplete(s);
  label(ctx, `${a.name}: xếp các giai đoạn theo đúng thứ tự`, pad, small ? 11 : 24, { size: small ? 13 : 18, bold: true });
  label(ctx, small ? "Bấm vào thẻ để đặt vào ô trống kế tiếp. Hình vẽ không theo tỉ lệ." : "Bấm vào một thẻ để đặt nó vào ô trống kế tiếp của dòng thời gian. Hình vẽ minh họa, không theo tỉ lệ.", pad, small ? 27 : 50, { size: small ? 10 : 13, color: COLORS.muted });

  // timeline
  for (let i = 0; i < n; i++) {
    const x = x0 + i * cw;
    if (i < list.length) {
      const right = list[i] === i;
      drawCard(ctx, g, x, g.ySlots, list[i], done ? { border: right ? COLORS.green : COLORS.red, width: 3 } : { border: COLORS.blue, width: 2 });
    } else {
      const m = small ? 3 : 8;
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.roundRect(x + m, g.ySlots, cw - 2 * m, ch, 8);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, `${i + 1}`, x + cw / 2, g.ySlots + ch / 2, { size: small ? 22 : 34, align: "center", color: COLORS.grid, bold: true });
    }
    if (i) label(ctx, "→", x, g.ySlots + ch / 2, { size: small ? 13 : 20, align: "center", color: COLORS.ink, bold: true });
  }
  // cards still to place
  label(ctx, list.length < n ? "Các thẻ chưa xếp:" : "Đã xếp hết các thẻ.", x0 + (small ? 3 : 8), g.yCards - (small ? 10 : 18), { size: small ? 10 : 13, color: COLORS.muted });
  a.cards.forEach((stage, k) => {
    if (list.includes(stage)) return;
    const chosen = Math.round(s.card) === k + 1;
    drawCard(ctx, g, x0 + k * cw, g.yCards, stage, { number: k + 1, border: chosen ? COLORS.blue : COLORS.muted, width: chosen ? 2.5 : 1 });
  });

  // feedback
  const lineH = small ? 12 : 19;
  let y = g.yCards + ch + (small ? 14 : 30);
  if (done) {
    const ok = isCorrect(s);
    label(ctx, ok ? "Đúng thứ tự!" : "Chưa đúng thứ tự. Bấm “Xếp lại” để thử lần nữa.", view.w / 2, y, { size: small ? 12 : 16, bold: true, align: "center", color: ok ? COLORS.green : COLORS.red });
    if (ok) para(ctx, FACTS[animal], view.w / 2, y + lineH + 2, view.w - 2 * pad, lineH, { size: small ? 10 : 13, color: COLORS.ink });
  } else {
    label(ctx, `Đã xếp ${list.length}/${n} giai đoạn.`, view.w / 2, y, { size: small ? 11 : 15, align: "center", color: COLORS.muted });
  }
  // classification of this animal
  const choice = chosenType(s, animal);
  const by = view.h - (small ? 9 : 18);
  if (allClassified(s)) label(ctx, "Đã phân loại đúng cả ba loài!", view.w / 2, by, { size: small ? 11 : 14, bold: true, align: "center", color: COLORS.green });
  else if (TYPES[choice]) {
    const ok = classifiedRight(s, animal);
    label(ctx, `Em phân loại: ${TYPES[choice].toLowerCase()} ${ok ? "✓" : "✗ (chưa đúng)"}`, view.w / 2, by, { size: small ? 11 : 14, bold: true, align: "center", color: ok ? COLORS.green : COLORS.red });
  } else label(ctx, "Hãy chọn kiểu phát triển của loài này ở bảng điều khiển.", view.w / 2, by, { size: small ? 10 : 13, align: "center", color: COLORS.muted });
}

// ---------- hormone view ----------
function drawHormone(ctx, s, view) {
  const small = isSmall(view);
  const pad = small ? 8 : 36;
  label(ctx, "Hormone điều hòa lột xác ở côn trùng", pad, small ? 11 : 24, { size: small ? 13 : 18, bold: true });
  label(ctx, small ? "Mô hình ngưỡng đơn giản: nồng độ theo % mức cao nhất." : "Mô hình ngưỡng đơn giản: nồng độ tính theo % mức cao nhất, ngưỡng tác dụng 50 %. Hình vẽ không theo tỉ lệ.", pad, small ? 27 : 50, { size: small ? 10 : 13, color: COLORS.muted });

  const top = small ? 56 : 120;
  const barH = small ? 118 : Math.max(120, Math.min(300, view.h - top - 250));
  const barW = small ? 22 : 40;
  const bx = pad + (small ? 34 : 60);
  const gap = small ? 84 : 130;
  const bars = [["Ecdysone", s.ecdysone, COLORS.purple, "tuyến trước ngực"], ["Juvenile", s.juvenile, COLORS.green, "thể allata"]];
  bars.forEach(([name, value, colour, gland], i) => {
    const x = bx + i * gap;
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(x, top, barW, barH);
    ctx.fillStyle = colour;
    ctx.fillRect(x, top + barH * (1 - value / 100), barW, (barH * value) / 100);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, top, barW, barH);
    label(ctx, `${fmt(value, 0)} %`, x + barW / 2, top - (small ? 8 : 12), { size: small ? 11 : 15, bold: true, align: "center", color: colour });
    label(ctx, name, x + barW / 2, top + barH + (small ? 10 : 16), { size: small ? 11 : 15, bold: true, align: "center" });
    label(ctx, value >= THRESHOLD ? "cao" : "thấp", x + barW / 2, top + barH + (small ? 23 : 36), { size: small ? 10 : 13, align: "center", color: colour, bold: true });
    label(ctx, `(${gland})`, x + barW / 2, top + barH + (small ? 35 : 55), { size: small ? 9 : 12, align: "center", color: COLORS.muted });
  });
  // threshold
  const tyy = top + barH * (1 - THRESHOLD / 100);
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(bx - 8, tyy);
  ctx.lineTo(bx + gap + barW + 8, tyy);
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, "ngưỡng", bx + barW + gap / 2 - barW / 2, tyy - (small ? 7 : 10), { size: small ? 9 : 12, color: COLORS.red, align: "center" });

  // what happens to the insect
  const rx0 = bx + gap + barW + (small ? 16 : 70);
  const cx = (rx0 + view.w - pad) / 2;
  const r = small ? 26 : Math.min(70, (view.w - pad - rx0) / 6);
  const dx = small ? 58 : r * 2.2;
  const iy = top + (small ? 36 : r + 20);
  const code = outcomeOf(s);
  const pupaNow = s.insectStage === "pupa";
  const drawStage = (kind, x, scale) => (kind === "larva" ? caterpillar : kind === "pupa" ? pupa : butterfly)(ctx, x, iy, r * scale);
  const names = { larva: "Sâu bướm", pupa: "Nhộng", adult: "Bướm" };
  const after = code === OUTCOME.pupation ? "pupa" : code === OUTCOME.adult ? "adult" : s.insectStage === "pupa" ? "pupa" : "larva";
  drawStage(pupaNow ? "pupa" : "larva", cx - dx, 0.8);
  label(ctx, names[pupaNow ? "pupa" : "larva"], cx - dx, iy + r + (small ? 8 : 14), { size: small ? 11 : 14, align: "center", bold: true });
  if (code === OUTCOME.none) {
    label(ctx, "không đổi", cx, iy, { size: small ? 11 : 15, align: "center", color: COLORS.muted, bold: true });
    ctx.globalAlpha = 0.35;
  } else {
    arrow(ctx, cx - dx * 0.4, iy, cx + dx * 0.4, iy, COLORS.purple, small ? 3 : 4);
    label(ctx, "lột xác", cx, iy - (small ? 10 : 16), { size: small ? 10 : 13, align: "center", color: COLORS.purple, bold: true });
  }
  drawStage(after, cx + dx, code === OUTCOME.larvalMoult ? 1.15 : code === OUTCOME.none ? 0.8 : 1);
  ctx.globalAlpha = 1;
  label(ctx, code === OUTCOME.larvalMoult ? "Sâu lớn hơn" : names[after], cx + dx, iy + r + (small ? 8 : 14), { size: small ? 11 : 14, align: "center", bold: true });
  const lineH = small ? 13 : 21;
  para(ctx, outcomeText(s), cx, iy + r + (small ? 30 : 52), view.w - pad - rx0, lineH, { size: small ? 12 : 17, bold: true, color: code === OUTCOME.none ? COLORS.red : COLORS.ink });

  const rules = "Ecdysone gây lột xác. Juvenile cao: sâu lột xác nhưng vẫn là sâu. Juvenile thấp: sâu hóa nhộng, rồi nhộng hóa bướm.";
  para(ctx, rules, view.w / 2, top + barH + (small ? 56 : 100), view.w - 2 * pad, small ? 12 : 19, { size: small ? 10 : 14, color: COLORS.ink });
}

const typeOptions = [{ value: "", label: "– chọn kiểu phát triển –" }, ...Object.entries(TYPES).map(([value, text]) => ({ value, label: text }))];
const classify = (key, name) => ({ type: "select", key, label: name, options: typeOptions, visible: inCycle, onCommit: checkClassified });
const cardFree = s => {
  const stage = ANIMALS[animalOf(s)].cards[Math.round(s.card) - 1];
  return stage != null && !placed(s).includes(stage);
};

mount({
  slug: "bien-thai-dong-vat",
  version: "1.0.0",
  title: "Sinh trưởng và phát triển ở động vật",
  hint: "Xếp các giai đoạn trong vòng đời của từng loài theo đúng thứ tự, rồi phân loại kiểu phát triển của chúng.",
  initialState,
  controls: [
    {
      type: "select",
      key: "view",
      label: "Nội dung",
      options: [
        { value: "cycle", label: "Vòng đời và kiểu phát triển" },
        { value: "hormone", label: "Hormone lột xác ở côn trùng" },
      ],
    },
    {
      type: "select",
      key: "animal",
      label: "Loài",
      options: Object.entries(ANIMALS).map(([value, a]) => ({ value, label: a.name })),
      visible: inCycle,
    },
    { type: "stepper", key: "card", label: "Chọn thẻ số", min: 1, max: 5, visible: inCycle },
    { type: "button", label: "Đặt thẻ đã chọn vào dòng thời gian", primary: true, action: (s, api) => placeCard(s, api, s.card), visible: inCycle, disabled: s => !cardFree(s) },
    { type: "button", label: "Xếp lại", action: clearTimeline, event: "timeline-cleared", visible: inCycle, disabled: s => !placed(s).length },
    { type: "heading", label: "Phân loại kiểu phát triển", visible: inCycle },
    classify("classButterfly", "Bướm"),
    classify("classGrasshopper", "Châu chấu"),
    classify("classHuman", "Người"),
    {
      type: "select",
      key: "insectStage",
      label: "Giai đoạn hiện tại của côn trùng",
      options: [
        { value: "larva", label: "Sâu bướm (ấu trùng)" },
        { value: "pupa", label: "Nhộng" },
      ],
      visible: s => !inCycle(s),
      onCommit: hormoneReport,
    },
    { type: "slider", key: "ecdysone", label: "Nồng độ ecdysone", min: 0, max: 100, step: 5, unit: "%", digits: 0, visible: s => !inCycle(s), onCommit: hormoneReport },
    { type: "slider", key: "juvenile", label: "Nồng độ juvenile", min: 0, max: 100, step: 5, unit: "%", digits: 0, visible: s => !inCycle(s), onCommit: hormoneReport },
  ],
  readouts: [
    {
      label: "Dòng thời gian",
      value: s => {
        const n = ANIMALS[animalOf(s)].stages.length;
        return isComplete(s) ? (isCorrect(s) ? "đúng thứ tự" : "chưa đúng thứ tự") : `đã xếp ${placed(s).length}/${n}`;
      },
    },
    { label: "Số loài phân loại đúng", value: s => `${classifiedCount(s)}/3` },
    { label: "Kết quả theo mô hình hormone", value: outcomeText },
  ],
  pointer: {
    down(p, s, api, view) {
      if (!inCycle(s)) return false;
      const g = geom(s, view);
      const k = Math.floor((p.x - g.x0) / g.cw);
      if (k < 0 || k >= g.n || p.y < g.yCards || p.y > g.yCards + g.ch) return false;
      placeCard(s, api, k + 1);
    },
  },
  draw(ctx, s, view) {
    if (inCycle(s)) drawCycle(ctx, s, view);
    else drawHormone(ctx, s, view);
  },
});
