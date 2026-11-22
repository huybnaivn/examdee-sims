import { mount, COLORS, clamp, fmt, arrow, label } from "../../kit/v1/kit.js";
import {
  initialState, grow, auxin, auxinShift, changed, advance, finish, tiltOf, lightOf, tipOf, timeOf, hasTip, seesLight, T_END,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const HOURS_PER_SECOND = 9; // playback: one experiment takes 8 s
const R_VIEW = 6.8; // cm from the seed to the edge of the scene
const R_LAMP = 5.9;
const LIGHT = "#f2a900";
const AUXIN = "122, 90, 248"; // COLORS.purple as r, g, b
const POT = { rim: 3, base: 2.2, depth: 3.8 };

// ---------- text ----------
function fitLabel(ctx, text, x, y, maxW, opts) {
  let size = opts.size;
  for (; size > 8; size--) {
    ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  label(ctx, text, x, y, { ...opts, size });
}

/** One paragraph wrapped into a box, at the largest size from `max` down that fits its height. */
function paragraph(ctx, text, box, max, min = 8) {
  let lines;
  let size = max;
  for (; ; size--) {
    ctx.font = `${size}px ${FONT}`;
    lines = [""];
    for (const word of text.split(" ")) {
      const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
      if (lines.at(-1) && ctx.measureText(next).width > box.w) lines.push(word);
      else lines[lines.length - 1] = next;
    }
    if (size <= min || lines.length * size * 1.3 <= box.h) break;
  }
  lines.forEach((line, i) => label(ctx, line, box.x, box.y + size * (0.65 + 1.3 * i), { size, color: COLORS.muted }));
}

function tag(ctx, text, x, y, color) {
  ctx.font = `600 11px ${FONT}`;
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y, w, 19, 9.5);
  ctx.fill();
  label(ctx, text, x, y + 10, { size: 11, bold: true, color: "#fff", align: "center" });
}

const side = angle => (angle > 0 ? "phải" : "trái");
const leaning = (angle, straight) => (Math.abs(angle) < 0.5 ? straight : `lệch ${fmt(Math.abs(angle), 0)}° sang ${side(angle)}`);

function explain(s, g) {
  if (s.clinostat) {
    return `Máy hồi chuyển quay đều: mọi phía của cây nhận kích thích như nhau, auxin phân bố đều nên ${hasTip(s) ? "ngọn và rễ" : "rễ"} mọc thẳng.${hasTip(s) ? "" : " Đỉnh bị cắt nên ngọn ngừng dài ra."}`;
  }
  const shoot = !hasTip(s)
    ? "Cắt bỏ đỉnh: không còn nguồn auxin, ngọn ngừng dài ra và không uốn cong."
    : seesLight(s)
      ? `Auxin dồn về phía khuất sáng, phía đó dài nhanh hơn nên ngọn cong về phía ánh sáng (hướng sáng dương).${
          timeOf(s) > 0 && Math.abs(auxinShift(s, "shoot", g.shootTheta)) < 0.02 ? " Ngọn ngừng uốn khi tác động của ánh sáng và của trọng lực lên auxin cân bằng nhau." : ""
        }`
      : s.oneSided
        ? "Đỉnh bị che kín, không nhận được ánh sáng từ một phía nên ngọn không hướng sáng."
        : "Ánh sáng đều mọi phía: auxin không bị ánh sáng làm lệch.";
  const gravity =
    tiltOf(s) === 0
      ? "Rễ mọc thẳng xuống (hướng trọng lực dương)."
      : `Chậu nghiêng: auxin dồn xuống mặt dưới, ${hasTip(s) ? "làm ngọn cong lên còn rễ cong xuống" : "làm rễ cong xuống"} (auxin nồng độ cao ức chế rễ).`;
  return `${shoot} ${gravity}`;
}

// ---------- scene ----------
function frame(view) {
  const wide = view.w >= 560;
  const head = wide ? 70 : 62;
  const k = Math.min(view.w, view.h - head) / (2 * R_VIEW);
  return { wide, head, k, cx: view.w / 2, cy: head + (view.h - head) / 2 };
}

function stroke(ctx, points, f, color, width, cap = "round") {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [x, y] of points) ctx.lineTo(f.cx + x * f.k, f.cy - y * f.k);
  ctx.stroke();
}

/** The last `dist` cm of a path. */
function tail(points, dist) {
  let i = points.length - 1;
  for (let d = 0; i > 0 && d < dist; i--) d += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return points.slice(i);
}

const tint = share => `rgba(${AUXIN}, ${clamp((share - 0.2) / 0.6, 0.05, 1)})`;

/**
 * Auxin along an organ: each stretch is tinted on the flank that had more auxin when it was formed
 * (the organ then pointed the way that stretch runs), the stronger the bigger the difference.
 */
function flanks(ctx, s, organ, points, f, off, width) {
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (!len) continue;
    const shift = auxinShift(s, organ, Math.atan2(bx - ax, by - ay) / RAD);
    if (Math.abs(shift) < 0.02) continue;
    // the clockwise side of a direction (dx, dy) is (dy, −dx)
    const ox = ((by - ay) / len) * off * Math.sign(shift);
    const oy = (-(bx - ax) / len) * off * Math.sign(shift);
    ctx.strokeStyle = `rgba(${AUXIN}, ${clamp(Math.abs(shift) / 0.3, 0, 1) * 0.9})`;
    ctx.beginPath();
    ctx.moveTo(f.cx + (ax + ox) * f.k, f.cy - (ay + oy) * f.k);
    ctx.lineTo(f.cx + (bx + ox) * f.k, f.cy - (by + oy) * f.k);
    ctx.stroke();
  }
}

function drawLight(ctx, s, f) {
  const ray = (angle, from, to, off, alpha) => {
    const dx = Math.sin(angle * RAD);
    const dy = Math.cos(angle * RAD);
    const at = r => [f.cx + (r * dx + off * dy) * f.k, f.cy - (r * dy - off * dx) * f.k];
    ctx.globalAlpha = alpha;
    arrow(ctx, ...at(from), ...at(to), LIGHT, 2);
    ctx.globalAlpha = 1;
  };
  if (!s.oneSided) {
    for (const angle of [-90, -45, 0, 45, 90]) ray(angle, 6.4, 5.4, 0, 0.9);
    return;
  }
  const angle = lightOf(s);
  for (const off of [-1.7, -0.7, 0.7, 1.7]) ray(angle, 5.3, 4.1, off, s.clinostat ? 0.45 : 0.9);
  const x = f.cx + R_LAMP * Math.sin(angle * RAD) * f.k;
  const y = f.cy - R_LAMP * Math.cos(angle * RAD) * f.k;
  ctx.fillStyle = COLORS.yellow;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 0.5 * f.k, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

function drawClinostat(ctx, f, turn) {
  const X = x => f.cx + x * f.k;
  const Y = y => f.cy - y * f.k;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = Math.max(3, 0.22 * f.k);
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(X(-4.9), Y(0));
  ctx.lineTo(X(-POT.depth), Y(0));
  ctx.stroke();
  ctx.fillStyle = "#cfd6e4";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(X(-6.6), Y(1), 1.7 * f.k, 2 * f.k, 4);
  ctx.fill();
  ctx.stroke();
  // a mark on the shaft that goes round, and the sense of rotation
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(X(-4.35), Y(0.11 * Math.sin(turn)), Math.max(1.5, 0.07 * f.k), 0, TAU);
  ctx.fill();
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(X(-4.35), Y(0), 0.3 * f.k, 0.9 * f.k, 0, 0.6, TAU - 0.6);
  ctx.stroke();
  arrow(ctx, X(-4.1) - 1, Y(0.75), X(-4.1) + 3, Y(0.5), COLORS.blue, 2);
  label(ctx, "Máy hồi chuyển", X(-5.75), Y(-1.5), { size: clamp(f.k * 0.45, 9, 13), color: COLORS.muted, align: "center" });
}

function drawPot(ctx, s, f) {
  ctx.save();
  ctx.translate(f.cx, f.cy);
  ctx.rotate(tiltOf(s) * RAD);
  ctx.scale(f.k, f.k);
  ctx.fillStyle = "#eadbc8"; // cut open, so the root can be seen in the soil
  ctx.strokeStyle = "#a0673a";
  ctx.lineWidth = 0.12;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-POT.rim, 0);
  ctx.lineTo(POT.rim, 0);
  ctx.lineTo(POT.base, POT.depth);
  ctx.lineTo(-POT.base, POT.depth);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#a0673a";
  ctx.fillRect(-POT.rim - 0.2, -0.12, 2 * POT.rim + 0.4, 0.3);
  ctx.restore();
}

function drawSeedling(ctx, s, f, g) {
  const tip = tipOf(s);
  const w = Math.max(3.5, 0.3 * f.k);
  // root, pale with a darker edge so it shows on the soil
  stroke(ctx, g.root, f, "#8a6a3c", Math.max(3, 0.17 * f.k));
  stroke(ctx, g.root, f, "#fff8ea", Math.max(1.6, 0.17 * f.k - 1.6));
  flanks(ctx, s, "root", g.root, f, 0.045, Math.max(1.2, 0.06 * f.k));
  // shoot
  stroke(ctx, g.shoot, f, "#49a961", w, hasTip(s) ? "round" : "butt");
  if (hasTip(s)) flanks(ctx, s, "shoot", g.shoot, f, 0.09, Math.max(1.5, 0.1 * f.k));
  const end = g.shoot.at(-1);
  const dx = Math.sin(g.shootTheta * RAD);
  const dy = Math.cos(g.shootTheta * RAD);
  const along = (a, b) => [[end[0] + a * dx, end[1] + a * dy], [end[0] + b * dx, end[1] + b * dy]];
  if (tip === "cap") stroke(ctx, along(-0.45, 0.06), f, "#2b2f3a", w * 1.5);
  if (tip === "clear") {
    stroke(ctx, along(-0.45, 0.06), f, "#5b9bd8", w * 1.5 + 2);
    stroke(ctx, along(-0.45, 0.06), f, "#e8f3fd", w * 1.5);
    stroke(ctx, tail(g.shoot, 0.5), f, "#49a961", w * 0.8);
  }
  if (tip === "band") {
    const a = g.shoot[0];
    const b = g.shoot[1];
    const at = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    stroke(ctx, [at(0.2), at(0.75)], f, "#2b2f3a", w * 1.5, "butt");
  }
  if (tip === "removed") stroke(ctx, [[end[0] + 0.3 * dy, end[1] - 0.3 * dx], [end[0] - 0.3 * dy, end[1] + 0.3 * dx]], f, COLORS.red, 2);
  // the seed
  ctx.save();
  ctx.translate(f.cx, f.cy);
  ctx.rotate(tiltOf(s) * RAD);
  ctx.fillStyle = "#8a5a2b";
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.3 * f.k, 0.2 * f.k, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Enlarged shoot tip: the two flanks shaded by their share of the auxin. */
function drawInset(ctx, s, view, f, g) {
  const size = clamp(3.1 * f.k, 72, 150);
  const x = view.w - size - 5;
  const y = view.h - size - 5;
  const small = size < 90;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 6);
  ctx.fill();
  ctx.stroke();
  label(ctx, "Auxin ở đỉnh ngọn", x + size / 2, y + (small ? 8 : 13), { size: small ? 8 : 12, color: COLORS.muted, align: "center" });
  const cx = x + size / 2;
  const cy = y + size / 2 + (small ? 5 : 9);
  const w = size * 0.22;
  const h = size * 0.42;
  const a = auxin(s, "shoot", g.shootTheta);
  const angle = g.shootTheta * RAD;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, hasTip(s) ? [w / 2, w / 2, 0, 0] : 0);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = hasTip(s) ? "#e3f4e6" : "#dfe3ea";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  if (hasTip(s)) {
    ctx.fillStyle = tint(a.ccw);
    ctx.fillRect(-w / 2, -h / 2, w / 2, h);
    ctx.fillStyle = tint(a.cw);
    ctx.fillRect(0, -h / 2, w / 2, h);
  }
  ctx.restore();
  ctx.strokeStyle = hasTip(s) ? "#2f7d3a" : COLORS.muted;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  const off = w / 2 + (small ? 13 : 20);
  const text = { size: small ? 10 : 14, bold: true, align: "center", color: COLORS.purple };
  if (hasTip(s)) {
    label(ctx, `${fmt(a.cw * 100, 0)}%`, cx + Math.cos(angle) * off, cy + Math.sin(angle) * off, text);
    label(ctx, `${fmt(a.ccw * 100, 0)}%`, cx - Math.cos(angle) * off, cy - Math.sin(angle) * off, text);
  } else {
    label(ctx, "đã cắt đỉnh:", cx, y + size - (small ? 16 : 24), { size: small ? 8 : 11, align: "center", color: COLORS.red });
    label(ctx, "không có auxin", cx, y + size - (small ? 7 : 10), { size: small ? 8 : 11, align: "center", color: COLORS.red });
  }
}

// ---------- events ----------
const edited = (s, api) => {
  changed(s);
  api.pause(); // a new experiment waits for a prediction and ▶
};
const TIP_OPTIONS = [
  { value: "intact", label: "Để nguyên" },
  { value: "cap", label: "Chụp mũ không trong suốt lên đỉnh" },
  { value: "clear", label: "Chụp mũ trong suốt lên đỉnh" },
  { value: "band", label: "Quấn băng không trong suốt phía dưới đỉnh" },
  { value: "removed", label: "Cắt bỏ đỉnh" },
];

let turn = 0; // decoration only: the clinostat's rotation mark

mount({
  slug: "cam-ung-thuc-vat",
  version: "1.0.0",
  title: "Cảm ứng ở thực vật",
  hint: "Đổi hướng chiếu sáng, xoay chậu hoặc xử lí đỉnh ngọn, dự đoán ngọn cây sẽ mọc thế nào rồi bấm «▶ Chạy» để xem cây mầm sinh trưởng trong 72 giờ.",
  initialState,
  step(s, dt, api) {
    const starting = timeOf(s) === 0 || timeOf(s) >= T_END;
    turn += dt * 3;
    const ended = advance(s, dt * HOURS_PER_SECOND);
    if (starting) api.sync(); // the prediction is now locked
    if (!ended) return;
    api.pause();
    const r = finish(s);
    const round = v => Math.round(v * 10) / 10;
    api.emit("growth-finished", { shootAngle: round(r.shootAngle), rootAngle: round(r.rootAngle), hours: T_END, predicted: r.predicted ? 1 : 0, correct: r.correct ? 1 : 0 }, "result");
    if (r.correct) api.emit("prediction-correct", { shootAngle: round(r.shootAngle) }, "goal");
    api.sync();
  },
  controls: [
    { type: "heading", label: "Ánh sáng" },
    { type: "checkbox", key: "oneSided", label: "Chiếu sáng từ một phía (bỏ chọn: sáng đều mọi phía)", onChange: edited },
    {
      type: "slider",
      key: "lightAngle",
      label: "Hướng nguồn sáng",
      min: -105,
      max: 105,
      step: 15,
      format: v => (v === 0 ? "ngay phía trên" : `lệch ${fmt(Math.abs(v), 0)}° sang ${side(v)}`),
      disabled: s => !s.oneSided,
      onChange: edited,
    },
    { type: "heading", label: "Trọng lực" },
    {
      type: "slider",
      key: "tilt",
      label: "Xoay chậu",
      min: 0,
      max: 180,
      step: 15,
      format: v => `${fmt(v, 0)}°${v === 0 ? " (đặt đứng)" : v === 90 ? " (nằm ngang)" : v === 180 ? " (lộn ngược)" : ""}`,
      disabled: s => s.clinostat,
      onChange: edited,
    },
    { type: "checkbox", key: "clinostat", label: "Đặt chậu nằm ngang trên máy hồi chuyển (clinostat)", onChange: edited },
    { type: "heading", label: "Thí nghiệm với đỉnh ngọn" },
    { type: "select", key: "tip", label: "Xử lí đỉnh ngọn", options: TIP_OPTIONS, onChange: edited },
    { type: "heading", label: "Dự đoán (chọn trước khi chạy thí nghiệm mới)" },
    {
      type: "select",
      key: "predict",
      label: "Sau 72 giờ, ngọn cây sẽ",
      disabled: s => s.tested || timeOf(s) > 0,
      options: [
        { value: "", label: "— Chưa dự đoán —" },
        { value: "light", label: "Uốn cong về phía ánh sáng" },
        { value: "up", label: "Uốn cong lên trên, ngược chiều trọng lực" },
        { value: "straight", label: "Mọc thẳng, không uốn cong" },
        { value: "none", label: "Không dài ra, không uốn cong" },
      ],
    },
  ],
  readouts: [
    { label: "Thời gian", value: s => `${fmt(timeOf(s), 0)} / ${T_END} giờ` },
    { label: "Ngọn (so với hướng thẳng lên)", value: s => leaning(grow(s, s.time).shootAngle, "thẳng đứng") },
    { label: "Rễ (so với hướng thẳng xuống)", value: s => leaning(grow(s, s.time).rootAngle, "thẳng xuống") },
    {
      label: "Auxin ở hai phía của đỉnh ngọn",
      value: s => {
        if (!hasTip(s)) return "không có (đã cắt đỉnh)";
        const a = auxin(s, "shoot", grow(s, s.time).shootTheta);
        return `${fmt(Math.max(a.cw, a.ccw) * 100, 0)}% : ${fmt(Math.min(a.cw, a.ccw) * 100, 0)}%`;
      },
    },
    { label: "Dự đoán", value: s => (s.verdict === "correct" ? "Đúng" : s.verdict === "wrong" ? "Chưa đúng" : "–") },
  ],
  draw(ctx, s, view) {
    const f = frame(view);
    const g = grow(s, s.time);
    const t = timeOf(s);
    const pad = f.wide ? 24 : 6;

    drawLight(ctx, s, f);
    if (s.clinostat) drawClinostat(ctx, f, turn);
    drawPot(ctx, s, f);
    drawSeedling(ctx, s, f, g);

    // gravity, and the honest small print
    const gx = f.wide ? 30 : 12;
    arrow(ctx, gx, view.h - 50, gx, view.h - 14, COLORS.ink, 2.5);
    label(ctx, "Trọng lực", gx + 8, view.h - 34, { size: f.wide ? 13 : 10, color: COLORS.ink });
    label(ctx, f.wide ? "Vệt tím: phía có nhiều auxin hơn · Mô hình đơn giản hoá, không theo tỉ lệ" : "Vệt tím: phía nhiều auxin hơn · không theo tỉ lệ", f.wide ? gx + 80 : gx + 8, view.h - (f.wide ? 34 : 12), { size: f.wide ? 12 : 9, color: COLORS.muted });
    drawInset(ctx, s, view, f, g);

    // header
    const status = `${fmt(t, 0)} giờ · Ngọn: ${leaning(g.shootAngle, "thẳng đứng")} · Rễ: ${leaning(g.rootAngle, "thẳng xuống")}`;
    fitLabel(ctx, status, pad, f.wide ? 22 : 10, view.w - 2 * pad, { size: f.wide ? 17 : 12, bold: true });
    paragraph(ctx, explain(s, g), { x: pad, y: f.wide ? 36 : 19, w: view.w - 2 * pad, h: f.head - (f.wide ? 38 : 20) }, f.wide ? 13 : 10);
    const note =
      s.verdict === "correct"
        ? ["Dự đoán đúng ✓", COLORS.green]
        : s.verdict === "wrong"
          ? ["Dự đoán chưa đúng ✗", COLORS.red]
          : !s.tested && t === 0
            ? [s.predict ? "Đã dự đoán – bấm ▶ Chạy" : "Hãy dự đoán rồi bấm ▶ Chạy", COLORS.blue]
            : null;
    if (note) tag(ctx, note[0], f.cx, view.h - (f.wide ? 66 : 40), note[1]); // below the pot, clear of the lamp
  },
});
