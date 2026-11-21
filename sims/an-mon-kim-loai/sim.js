import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { TUBES, DAYS, TOP3, E0, initialState, step, rust, zincLoss, ranks, predictionComplete, predictionCorrect } from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const RUST = "#9a4a1c";
const IRON = "#8d939c";

const rnd = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function wrap(ctx, text, maxW, size, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const NOTES = [
  "Nước cất đun sôi đã đuổi hết oxygen hòa tan, lớp dầu ngăn không khí: không có oxygen nên đinh không gỉ.",
  "CaCl₂ khan hút hết hơi nước: không có nước nên ở nhiệt độ thường đinh hầu như không bị gỉ.",
  "Có cả nước và oxygen: ăn mòn điện hóa giữa sắt và tạp chất carbon trong đinh. Gỉ sắt có thành phần chính Fe₂O₃·nH₂O.",
  "Dung dịch NaCl dẫn điện tốt hơn nước máy nên ăn mòn điện hóa xảy ra nhanh hơn.",
  `Zn hoạt động hơn Fe (E° = ${fmt(E0.Zn, 3)} V < ${fmt(E0.Fe, 2)} V): Zn là anode, bị ăn mòn (Zn → Zn²⁺ + 2e); Fe là cathode nên được bảo vệ. Đây là bảo vệ bằng phương pháp điện hóa, Zn là kim loại hi sinh.`,
  `Fe hoạt động hơn Cu (E° = ${fmt(E0.Fe, 2)} V < +${fmt(E0.Cu, 2)} V): Fe là anode, bị ăn mòn (Fe → Fe²⁺ + 2e); ở cathode Cu: O₂ + 2H₂O + 4e → 4OH⁻. Đinh gỉ nhanh nhất.`,
  "Lớp sơn cách li sắt với nước và oxygen nên đinh không gỉ (bảo vệ bề mặt).",
];
const THEORY = [
  "Ăn mòn hóa học: kim loại phản ứng trực tiếp với chất oxi hóa trong môi trường, electron chuyển thẳng sang chất oxi hóa, không phát sinh dòng điện (ví dụ 3Fe + 2O₂ → Fe₃O₄ khi nung nóng).",
  "Ăn mòn điện hóa: hai điện cực khác bản chất tiếp xúc nhau và cùng nhúng trong dung dịch chất điện li; kim loại hoạt động hơn là anode, bị oxi hóa; có dòng electron từ anode sang cathode.",
];

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 8 : 20;
  const head = small ? 22 : 40; // top line
  const textH = Math.round(Math.min(view.h * (small ? 0.36 : 0.32), small ? 120 : 170));
  const slot = (view.w - 2 * pad) / TUBES.length;
  const tw = Math.min(slot * 0.62, 50);
  const top = head + (small ? 14 : 22); // number labels sit above the tubes
  const bottom = view.h - textH - (small ? 16 : 22); // short names sit under the tubes
  return { small, pad, head, textH, slot, tw, top, bottom };
}

function drawTube(ctx, s, g, i) {
  const t = TUBES[i];
  const cx = g.pad + g.slot * (i + 0.5);
  const { tw, top, bottom } = g;
  const x0 = cx - tw / 2;
  const level = t.water ? top + (bottom - top) * 0.3 : bottom; // liquid surface
  const r = rust(i, s.day);

  if (i === s.focus) {
    ctx.fillStyle = "#e7efff";
    ctx.beginPath();
    ctx.roundRect(cx - g.slot / 2 + 2, top - (g.small ? 14 : 22), g.slot - 4, bottom - top + (g.small ? 30 : 44), 8);
    ctx.fill();
  }

  // glass with a round bottom
  const tube = () => {
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x0, bottom - tw / 2);
    ctx.arc(cx, bottom - tw / 2, tw / 2, Math.PI, 0, true);
    ctx.lineTo(x0 + tw, top);
  };
  ctx.save();
  tube();
  ctx.closePath();
  ctx.clip();
  if (t.water) {
    ctx.fillStyle = t.salt ? "rgba(190, 215, 235, 0.65)" : "rgba(205, 225, 245, 0.6)";
    ctx.fillRect(x0, level, tw, bottom - level + 1);
    if (!t.oxygen) {
      ctx.fillStyle = "rgba(240, 200, 60, 0.75)"; // oil layer
      ctx.fillRect(x0, level - 10, tw, 10);
    }
  } else {
    for (let k = 0; k < 30; k++) {
      ctx.fillStyle = "#f2f2ee";
      ctx.strokeStyle = "#b9bcc4";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(x0 + 3 + rnd(k, 1) * (tw - 6), bottom - 3 - rnd(k, 2) * tw * 0.7, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  // rust flakes settled on the bottom
  if (r > 0) {
    ctx.fillStyle = RUST;
    for (let k = 0; k < Math.round(24 * r); k++) {
      ctx.beginPath();
      ctx.arc(x0 + 3 + rnd(k, 3) * (tw - 6), bottom - 2 - rnd(k, 4) * tw * 0.3, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // the nail, moved left when a second metal shares the tube
  const nw = Math.max(3, tw * 0.15);
  const nx = t.partner ? cx - tw * 0.18 : cx;
  const ny0 = top + (bottom - top) * 0.08;
  const ny1 = t.water ? bottom - tw * 0.45 : bottom - tw * 0.95;
  ctx.fillStyle = t.coated ? "#3f8f5a" : IRON;
  ctx.fillRect(nx - nw / 2, ny0, nw, ny1 - ny0);
  ctx.beginPath();
  ctx.moveTo(nx - nw / 2, ny1);
  ctx.lineTo(nx, ny1 + nw * 1.6);
  ctx.lineTo(nx + nw / 2, ny1);
  ctx.fill();
  ctx.fillRect(nx - nw * 1.3, ny0 - 3, nw * 2.6, 3);
  if (r > 0) {
    const wet = Math.max(level, ny0);
    ctx.fillStyle = RUST;
    ctx.globalAlpha = 0.85 * r;
    ctx.fillRect(nx - nw / 2, wet, nw, ny1 - wet);
    ctx.globalAlpha = 1;
    for (let k = 0; k < Math.round(40 * r); k++) {
      ctx.beginPath();
      ctx.arc(nx - nw / 2 - 1 + rnd(k, 5) * (nw + 2), wet + rnd(k, 6) * (ny1 - wet), 1 + rnd(k, 7) * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (t.partner) {
    const px = cx + tw * 0.2;
    const pw = t.partner === "Zn" ? Math.max(3, tw * 0.22) * (1 - 0.7 * zincLoss(i, s.day)) : Math.max(2, tw * 0.08);
    ctx.fillStyle = t.partner === "Zn" ? "#9fb3c8" : "#c0703a";
    ctx.fillRect(px - pw / 2, ny0 + 6, pw, ny1 - ny0 - 6);
    ctx.strokeStyle = COLORS.ink; // the wire joining the two metals
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(nx, ny0 + 4);
    ctx.lineTo(nx, ny0 - 4);
    ctx.lineTo(px, ny0 - 4);
    ctx.lineTo(px, ny0 + 6);
    ctx.stroke();
    if (!g.small || tw > 30) label(ctx, t.partner, px, (level + ny1) / 2, { size: 10, align: "center", bold: true, color: COLORS.ink });
  }

  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  tube();
  ctx.stroke();
  if (!t.water) {
    ctx.fillStyle = "#b07a4a"; // stopper keeps moist air out
    ctx.fillRect(x0 - 2, top - 6, tw + 4, 10);
  }

  label(ctx, String(i + 1), cx, top - (g.small ? 7 : 11), { size: g.small ? 11 : 14, bold: true, align: "center", color: i === s.focus ? COLORS.blue : COLORS.ink });
  label(ctx, t.short, cx, bottom + (g.small ? 8 : 12), { size: g.small ? 10 : 13, align: "center", color: COLORS.muted });
}

function drawText(ctx, s, g, view) {
  const size = g.small ? 11 : 14;
  const lh = g.small ? 14 : 20;
  const w = view.w - 2 * g.pad;
  const out = [];
  const push = (text, bold, color, sz = size) => wrap(ctx, text, w, sz, bold).forEach(t => out.push([t, bold, color, sz]));
  const i = s.focus;
  const z = TUBES[i].partner === "Zn" ? ` · thanh kẽm hao mòn ${fmt(100 * zincLoss(i, s.day), 0)}%` : "";
  push(`Ống ${i + 1}: ${TUBES[i].name}`, true, COLORS.ink);
  push(`Bề mặt đinh bị gỉ: ${fmt(100 * rust(i, s.day), 0)}%${z}`, false, COLORS.ink);
  if (s.reported) {
    const r = ranks();
    const order = TUBES.map((_, k) => k).filter(k => r[k] < 4).sort((a, b) => r[a] - r[b]);
    const none = TUBES.map((_, k) => k).filter(k => r[k] >= 4);
    push(`Thứ tự gỉ: ống ${order.map(k => k + 1).join(" > ")}; ống ${none.map(k => k + 1).join(", ")} không gỉ.`, true, COLORS.orange);
    if (s.verdict >= 0) push(s.verdict ? "Dự đoán của em đúng ✓" : `Dự đoán chưa đúng. Đúng là ${TOP3.map(k => k + 1).join(" > ")}.`, true, s.verdict ? COLORS.green : COLORS.red);
  }
  if (s.showTheory) THEORY.forEach(t => push(t, false, COLORS.muted));
  else push(NOTES[i], false, COLORS.muted);
  const y0 = view.h - g.textH + lh / 2;
  const max = Math.floor(g.textH / lh);
  out.slice(0, max).forEach(([t, bold, color, sz], k) => label(ctx, t, g.pad, y0 + k * lh, { size: sz, bold, color }));
}

// Called once when time reaches the last day: the rust ranking, and the prediction judged.
function finish(s, api) {
  if (s.reported) return;
  s.reported = true;
  s.verdict = predictionComplete(s) ? Number(predictionCorrect(s)) : -1;
  const data = { day: s.day };
  TUBES.forEach((_, i) => (data[`rust${i + 1}`] = Math.round(1000 * rust(i, s.day)) / 10));
  data.zinc = Math.round(1000 * zincLoss(4, s.day)) / 10;
  [data.first, data.second, data.third] = TOP3.map(k => k + 1);
  data.predicted = s.verdict;
  api.emit("rust-ranking", data, "result");
  if (s.verdict === 1) api.emit("ranking-predicted", { first: s.p1 + 1, second: s.p2 + 1, third: s.p3 + 1 }, "goal");
}

const reopen = s => {
  if (s.day < DAYS) {
    s.reported = false;
    s.verdict = -1;
  }
};

const tubeOptions = [{ value: -1, label: "— chọn —" }, ...TUBES.map((t, i) => ({ value: i, label: `Ống ${i + 1} (${t.short})` }))];
const locked = s => s.day > 0;

mount({
  slug: "an-mon-kim-loai",
  version: "1.0.0",
  title: "Ăn mòn kim loại và chống ăn mòn",
  hint: "Dự đoán ba ống có đinh gỉ nhiều nhất (trước khi bắt đầu), rồi bấm Chạy để thời gian trôi đến ngày 10.",
  initialState,
  step(s, dt, api) {
    if (s.day >= DAYS) {
      s.day = 0; // pressing Chạy after a finished run starts a new one
      reopen(s);
    }
    if (step(s, dt)) {
      api.pause();
      finish(s, api);
    }
  },
  controls: [
    { type: "heading", label: "Thời gian" },
    { type: "slider", key: "day", label: "Số ngày", min: 0, max: DAYS, step: 0.1, unit: "ngày", digits: 1, onChange: reopen, onCommit: (s, api) => s.day >= DAYS && finish(s, api) },
    { type: "heading", label: "Quan sát" },
    { type: "select", key: "focus", label: "Xem giải thích ống", options: TUBES.map((t, i) => ({ value: i, label: `Ống ${i + 1}: ${t.name}` })) },
    { type: "checkbox", key: "showTheory", label: "So sánh ăn mòn hóa học và ăn mòn điện hóa" },
    { type: "heading", label: "Dự đoán (khi số ngày = 0)" },
    { type: "select", key: "p1", label: "Gỉ nhanh nhất", options: tubeOptions, disabled: locked, onChange: reopen },
    { type: "select", key: "p2", label: "Gỉ nhanh thứ hai", options: tubeOptions, disabled: locked, onChange: reopen },
    { type: "select", key: "p3", label: "Gỉ nhanh thứ ba", options: tubeOptions, disabled: locked, onChange: reopen },
  ],
  readouts: [
    { label: "Thời gian", value: s => `${fmt(s.day, 1)} / ${DAYS} ngày` },
    { label: "Dự đoán", value: s => (predictionComplete(s) ? [s.p1, s.p2, s.p3].map(p => p + 1).join(" > ") : "chưa đủ") },
    { label: "Kết quả dự đoán", value: s => (s.verdict === 1 ? "đúng" : s.verdict === 0 ? "chưa đúng" : "–") },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    label(ctx, `Ngày ${fmt(s.day, 1)} / ${DAYS}`, g.pad, g.head / 2 + 2, { size: g.small ? 12 : 16, bold: true });
    label(ctx, g.small ? "Tốc độ gỉ minh họa định tính" : "Tốc độ gỉ tương đối, minh họa định tính; thời gian rút gọn", view.w - g.pad, g.head / 2 + 2, { size: g.small ? 10 : 12, align: "right", color: COLORS.muted });
    TUBES.forEach((_, i) => drawTube(ctx, s, g, i));
    drawText(ctx, s, g, view);
  },
});
