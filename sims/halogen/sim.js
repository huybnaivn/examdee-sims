import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { HALOGENS, REAGENTS, HALIDES, PAIRS, COLOUR_NAME, predKey, initialState, step, reacts, equation, resultColour, tried, markTried, score, allPredicted, sub } from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const CLEAR = [215, 230, 245, 0.35];
const X2 = i => `${HALOGENS[i].sym}₂`;
const KX = i => `K${HALOGENS[i].sym}`;
const rgba = ([r, g, b, a]) => `rgba(${r}, ${g}, ${b}, ${a})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

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

// Wrapped lines from y0 down to the bottom edge; whatever does not fit is dropped.
function textBlock(ctx, items, x, y0, w, bottom, size, lh) {
  let y = y0;
  for (const [text, bold, color] of items) {
    for (const line of wrap(ctx, text, w, size, bold)) {
      if (y + lh / 2 > bottom) return y;
      label(ctx, line, x, y, { size, bold, color });
      y += lh;
    }
  }
  return y;
}

// Two small bar charts of the documented table, when there is room under the cards.
function drawTrends(ctx, x0, y0, w, h, small) {
  const charts = [
    ["Độ âm điện", h => h.chi, 4, v => fmt(v)],
    ["Bán kính nguyên tử (nm)", h => h.radius, 0.14, v => fmt(v, 3)],
  ];
  const gap = small ? 12 : 30;
  const cw = (w - gap) / 2;
  const top = y0 + (small ? 14 : 20);
  const base = y0 + h - (small ? 14 : 18);
  charts.forEach(([title, get, max, show], c) => {
    const cx = x0 + c * (cw + gap);
    label(ctx, title, cx, y0 + 6, { size: small ? 11 : 13, bold: true, color: COLORS.muted });
    const bw = cw / HALOGENS.length;
    HALOGENS.forEach((el, i) => {
      const v = get(el);
      const bh = ((base - top - 14) * v) / max;
      const bx = cx + i * bw + bw * 0.2;
      ctx.fillStyle = c ? COLORS.blue : COLORS.purple;
      ctx.fillRect(bx, base - bh, bw * 0.6, bh);
      label(ctx, show(v), bx + bw * 0.3, base - bh - 8, { size: small ? 9 : 12, align: "center" });
      label(ctx, el.sym, bx + bw * 0.3, base + (small ? 7 : 10), { size: small ? 10 : 13, align: "center", bold: true });
    });
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.lineTo(cx + cw, base);
    ctx.stroke();
  });
}

function drawProps(ctx, s, view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 8 : 20;
  const cols = view.w < 480 ? 2 : 4;
  const rows = 4 / cols;
  const gap = small ? 6 : 12;
  const cw = (view.w - 2 * pad - gap * (cols - 1)) / cols;
  const ch = Math.min(small ? 74 : 170, (view.h * 0.62 - pad) / rows - gap);
  const rMax = Math.min(cw * 0.16, ch * 0.3);
  HALOGENS.forEach((h, i) => {
    const x = pad + (i % cols) * (cw + gap);
    const y = pad + Math.floor(i / cols) * (ch + gap);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = h.swatch; // colour of the element at room temperature
    ctx.fillRect(x, y, 6, ch);
    // atom drawn to scale with the others
    const r = (rMax * h.radius) / HALOGENS[3].radius;
    const ax = x + cw - rMax - 8;
    const ay = y + (small ? ch / 2 : rMax + 12);
    ctx.fillStyle = "#e7efff";
    ctx.strokeStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(ax, ay, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const tx = x + 14;
    const fs = small ? 11 : 13;
    const lh = small ? 14 : 21;
    label(ctx, X2(i), tx, y + (small ? 13 : 22), { size: small ? 15 : 22, bold: true });
    const lines = small
      ? [`${h.state} · ${h.colour}`, `χ = ${fmt(h.chi)}`, `r = ${fmt(h.radius, 3)} nm`]
      : [h.name, `Z = ${h.Z}`, `Thể: ${h.state}`, `Màu: ${h.colour}`, `Độ âm điện: ${fmt(h.chi)}`, `Bán kính: ${fmt(h.radius, 3)} nm`];
    lines.forEach((t, k) => {
      const ly = y + (small ? 29 : 48) + k * lh;
      if (ly < y + ch - 4) label(ctx, t, tx, ly, { size: fs, color: k === 0 && !small ? COLORS.muted : COLORS.ink });
    });
  });
  const y0 = pad + rows * (ch + gap) + (small ? 6 : 14);
  const end = textBlock(
    ctx,
    [
      ["Từ F đến I: bán kính nguyên tử tăng, độ âm điện giảm.", true, COLORS.ink],
      ["Tính oxi hóa giảm dần: F₂ > Cl₂ > Br₂ > I₂.", true, COLORS.orange],
      ["Nhiệt độ sôi tăng dần nên trạng thái đổi từ khí (F₂, Cl₂) sang lỏng (Br₂) rồi rắn (I₂).", false, COLORS.ink],
      ["Vòng tròn: bán kính nguyên tử vẽ theo cùng tỉ lệ. Dải màu bên trái: màu đơn chất ở điều kiện thường. Độ âm điện theo Pauling.", false, COLORS.muted],
    ],
    pad,
    y0,
    view.w - 2 * pad,
    view.h,
    small ? 11 : 14,
    small ? 14 : 20
  );
  const room = Math.min(view.h - pad - end, 260);
  if (room >= 90) drawTrends(ctx, pad, end + 4, Math.min(view.w - 2 * pad, 700), room - 4, small);
}

function drawExp(ctx, s, view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 8 : 20;
  const textH = Math.round(Math.min(view.h * (small ? 0.36 : 0.3), small ? 120 : 160));
  const sceneB = view.h - textH;
  const h = s.halogen;
  const x = s.halide;
  const p = s.added ? clamp(s.progress, 0, 1) : 0; // no control: clamp a forged value

  // tube and dropper on the left
  const tubeW = small ? 34 : 52;
  const tx = pad + (small ? 30 : 70);
  const dh = small ? 22 : 40; // dropper body
  const dy = small ? 12 : 26;
  const top = dy + dh + (small ? 10 : 24);
  const bottom = Math.min(sceneB - (small ? 22 : 34), top + 300);
  const level = top + (bottom - top) * 0.45;
  const k = clamp((p - 0.3) / 0.5, 0, 1);
  const colour = s.added ? mix(CLEAR, resultColour(h, x), k) : CLEAR;
  const tube = () => {
    ctx.beginPath();
    ctx.moveTo(tx - tubeW / 2, top);
    ctx.lineTo(tx - tubeW / 2, bottom - tubeW / 2);
    ctx.arc(tx, bottom - tubeW / 2, tubeW / 2, Math.PI, 0, true);
    ctx.lineTo(tx + tubeW / 2, top);
  };
  ctx.save();
  tube();
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = rgba(colour);
  ctx.fillRect(tx - tubeW / 2, level, tubeW, bottom - level);
  ctx.restore();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  tube();
  ctx.stroke();
  // dropper with the halogen water
  ctx.fillStyle = rgba([...resultColour(h, h).slice(0, 3), 0.8]);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(tx - 5, dy, 10, dh, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.muted;
  ctx.beginPath();
  ctx.roundRect(tx - 7, dy - 10, 14, 12, 5);
  ctx.fill();
  const tip = dy + dh;
  if (s.added && p < 0.6) {
    ctx.fillStyle = rgba([...resultColour(h, h).slice(0, 3), 0.9]);
    for (let d = 0; d < 3; d++) {
      const u = (p * 5 + d / 3) % 1;
      ctx.beginPath();
      ctx.arc(tx, tip + 4 + u * (level - tip - 4), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  label(ctx, X2(h), tx + 12, dy + 8, { size: small ? 11 : 14, bold: true });
  label(ctx, `dd ${KX(x)}`, tx, bottom + (small ? 10 : 16), { size: small ? 11 : 14, bold: true, align: "center", color: COLORS.muted });

  // grid on the right: rows = halogen added, columns = halide
  const gx0 = tx + tubeW / 2 + (small ? 16 : 50);
  const gw = Math.min(view.w - pad - gx0, 420);
  const headW = small ? 34 : 70;
  const cellW = (gw - headW) / 3;
  const cellH = Math.min(small ? 34 : 56, (sceneB - (small ? 30 : 60)) / 4.2);
  const gy0 = small ? 14 : 40;
  label(ctx, small ? "Có phản ứng?" : "Halogen (hàng) + dung dịch muối (cột): có phản ứng?", gx0, gy0 - (small ? 0 : 14), { size: small ? 10 : 13, color: COLORS.muted });
  const gy = gy0 + (small ? 10 : 4);
  HALIDES.forEach((c, j) => label(ctx, KX(c), gx0 + headW + cellW * (j + 0.5), gy + cellH / 2, { size: small ? 11 : 14, bold: true, align: "center" }));
  REAGENTS.forEach((r, i) => {
    const y = gy + cellH * (i + 1);
    label(ctx, X2(r), gx0 + 4, y + cellH / 2, { size: small ? 11 : 14, bold: true });
    HALIDES.forEach((c, j) => {
      const cx = gx0 + headW + cellW * j;
      const current = r === h && c === x;
      ctx.fillStyle = tried(s, r, c) ? (r === c ? "#f1f3f7" : reacts(r, c) ? "#e3f5ec" : "#fdecec") : "#fff";
      ctx.fillRect(cx + 1, y + 1, cellW - 2, cellH - 2);
      ctx.strokeStyle = current ? COLORS.blue : COLORS.grid;
      ctx.lineWidth = current ? 2.5 : 1;
      ctx.strokeRect(cx + 1, y + 1, cellW - 2, cellH - 2);
      const mid = [cx + cellW / 2, y + cellH / 2];
      const fs = small ? 10 : 13;
      if (tried(s, r, c)) {
        const text = r === c ? "–" : reacts(r, c) ? "✓ có" : "✗ không";
        label(ctx, text, ...mid, { size: fs, align: "center", bold: true, color: r === c ? COLORS.muted : reacts(r, c) ? COLORS.green : COLORS.red });
      } else if (s.practice && r !== c) {
        const v = s[predKey(r, c)];
        label(ctx, v === "yes" ? "đoán: có" : v === "no" ? "đoán: không" : "?", ...mid, { size: fs, align: "center", color: COLORS.muted });
      }
    });
  });

  // explanation under the scene
  const items = [];
  const eq = equation(h, x);
  if (!s.added) items.push([`Bấm “Nhỏ vào ống nghiệm” để nhỏ nước ${HALOGENS[h].name} vào dung dịch ${KX(x)}.`, true, COLORS.ink]);
  else if (eq) {
    items.push([sub(eq), true, COLORS.green]);
    items.push([`Dung dịch ${KX(x)} không màu chuyển ${COLOUR_NAME[x]} do ${X2(x)} sinh ra.`, false, COLORS.ink]);
    items.push([`${X2(h)} có tính oxi hóa mạnh hơn ${X2(x)} nên oxi hóa được ion ${HALOGENS[x].sym}⁻ thành ${X2(x)}.`, false, COLORS.muted]);
  } else if (h === x) {
    items.push(["Không có phản ứng: cùng một halogen.", true, COLORS.red]);
  } else {
    items.push(["Không có phản ứng.", true, COLORS.red]);
    items.push([`Ống chỉ có màu ${COLOUR_NAME[h]} của ${X2(h)} vừa thêm vào. ${X2(h)} có tính oxi hóa yếu hơn ${X2(x)} nên không oxi hóa được ion ${HALOGENS[x].sym}⁻.`, false, COLORS.muted]);
  }
  if (s.score >= 0) items.unshift([s.score === 6 ? "Dự đoán cả bảng: 6/6 đúng ✓" : `Dự đoán cả bảng: ${s.score}/6 đúng.`, true, s.score === 6 ? COLORS.green : COLORS.orange]);
  items.push(["Màu dung dịch minh họa gần đúng. F₂ không dùng vì phản ứng mãnh liệt với nước (2F₂ + 2H₂O → 4HF + O₂).", false, COLORS.muted]);
  const lh = small ? 14 : 20;
  textBlock(ctx, items, pad, Math.max(bottom + (small ? 24 : 40), gy + 4 * cellH + 12) + lh / 2, view.w - 2 * pad, view.h, small ? 11 : 14, lh);
}

const toExp = (s, api) => {
  s.tab = "exp";
  s.added = false;
  s.progress = 0;
  api.pause();
};

const reagentName = { 1: "Nước chlorine (Cl₂)", 2: "Nước bromine (Br₂)", 3: "Nước iodine (I₂)" };

mount({
  slug: "halogen",
  version: "1.0.0",
  title: "Tính chất của nhóm halogen",
  hint: "Xem thẻ tính chất của F₂, Cl₂, Br₂, I₂, rồi nhỏ nước halogen vào dung dịch muối KCl, KBr, KI để xem halogen nào đẩy được halogen nào.",
  initialState,
  step(s, dt, api) {
    if (step(s, dt)) api.pause();
  },
  controls: [
    {
      type: "select",
      key: "tab",
      label: "Hiển thị",
      options: [
        { value: "props", label: "Tính chất và xu hướng" },
        { value: "exp", label: "Thí nghiệm halogen đẩy halogen" },
      ],
    },
    { type: "heading", label: "Thí nghiệm" },
    { type: "select", key: "halogen", label: "Nhỏ vào", options: REAGENTS.map(r => ({ value: r, label: reagentName[r] })), onChange: toExp },
    { type: "select", key: "halide", label: "Ống nghiệm chứa", options: HALIDES.map(c => ({ value: c, label: `Dung dịch ${KX(c)}` })), onChange: toExp },
    {
      type: "button",
      label: "Nhỏ vào ống nghiệm",
      primary: true,
      action(s, api) {
        s.tab = "exp";
        s.added = true;
        s.progress = 0;
        markTried(s, s.halogen, s.halide);
        api.play();
        api.emit("displacement-test", { halogen: s.halogen, halide: s.halide, reacted: Number(reacts(s.halogen, s.halide)) }, "result");
      },
    },
    { type: "checkbox", key: "practice", label: "Dự đoán cả bảng trước khi làm", onChange: s => (s.tab = "exp") },
    ...PAIRS.map(([h, x]) => ({
      type: "select",
      key: predKey(h, x),
      label: `${X2(h)} + dd ${KX(x)}`,
      visible: s => s.practice,
      onChange: s => (s.score = -1),
      options: [
        { value: "?", label: "— chọn —" },
        { value: "yes", label: "Có phản ứng" },
        { value: "no", label: "Không phản ứng" },
      ],
    })),
    {
      type: "button",
      label: "Kiểm tra dự đoán",
      visible: s => s.practice,
      disabled: s => !allPredicted(s),
      action(s, api) {
        if (!allPredicted(s)) return;
        s.tab = "exp";
        s.score = score(s);
        if (s.score === 6) api.emit("grid-predicted", { correct: 6 }, "goal");
      },
    },
  ],
  readouts: [
    { label: "Thí nghiệm", value: s => `${X2(s.halogen)} + dd ${KX(s.halide)}` },
    { label: "Kết quả", value: s => (!s.added ? "–" : reacts(s.halogen, s.halide) ? "có phản ứng" : "không phản ứng") },
    { label: "Đã làm", value: s => `${PAIRS.filter(([h, x]) => tried(s, h, x)).length}/6 cặp khác nhau` },
  ],
  draw(ctx, s, view) {
    if (s.tab === "exp") drawExp(ctx, s, view);
    else drawProps(ctx, s, view);
  },
});
