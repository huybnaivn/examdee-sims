import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { RANGE, FIXED, SITUATIONS, initialState, toF, toK, apparent, quizTemp, quizOf, check, shownC } from "./model.js";

const LIQUID = "#d63a3a";
const GLASS = "#9fb0c8";
const font = size => `${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;

const reportTemp = (s, api) => {
  const c = shownC(s);
  api.emit("temperature-shown", { celsius: c, fahrenheit: toF(c), kelvin: toK(c) }, "result");
};

function tube(ctx, x, yTop, yBot, liquidY, w, bulbR) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = GLASS;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, yTop - 8, w, yBot - yTop + 8, w / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = LIQUID;
  ctx.fillRect(x - w / 4, liquidY, w / 2, yBot - liquidY + 2);
  if (bulbR) {
    ctx.beginPath();
    ctx.arc(x, yBot + bulbR - 2, bulbR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// A vertical scale: ticks every `minor`, labels every `major`, mapped through yOf(value in that scale).
function scale(ctx, x, from, to, yOf, minor, major, size, color = COLORS.ink) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, yOf(from));
  ctx.lineTo(x, yOf(to));
  for (let v = Math.ceil(from / minor) * minor; v <= to + 1e-9; v += minor) {
    const len = Math.abs(v % major) < 1e-9 ? 9 : 4;
    ctx.moveTo(x, yOf(v));
    ctx.lineTo(x + len, yOf(v));
  }
  ctx.stroke();
  for (let v = Math.ceil(from / major) * major; v <= to + 1e-9; v += major) label(ctx, fmt(v, 0), x + 12, yOf(v), { size, color });
}

function pill(ctx, text, x, y, size) {
  ctx.font = font(size);
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = LIQUID;
  ctx.beginPath();
  ctx.roundRect(x, y - size * 0.75, w, size * 1.5, 4);
  ctx.fill();
  label(ctx, text, x + 4, y, { size, color: "#fff", bold: true });
}

function drawExplore(ctx, s, view, small) {
  const c = shownC(s);
  const head = small ? 40 : 62;
  const bulbR = small ? 9 : 12;
  const yTop = head + 22;
  const yBot = view.h - 2 * bulbR - 10;
  const [lo, hi] = RANGE;
  const yC = v => yBot - ((v - lo) / (hi - lo)) * (yBot - yTop);
  const size = small ? 10 : 12;
  const tx = small ? 24 : 70;
  const xC = tx + 10;
  const xF = tx + (small ? 86 : 150);
  const xK = tx + (small ? 158 : 260);
  const pxPerC = (yBot - yTop) / (hi - lo);

  // fixed points across all scales
  const fixedEnd = xK + (small ? 40 : 54);
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 1;
  for (const v of [FIXED.ice, FIXED.steam]) {
    ctx.beginPath();
    ctx.moveTo(tx, yC(v));
    ctx.lineTo(fixedEnd, yC(v));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (view.w - fixedEnd > 70) {
    // left out when the reading pill sits on the same line
    const clear = v => Math.abs(yC(v) - yC(c)) > size + 2;
    if (clear(FIXED.steam)) label(ctx, small ? "nước sôi" : "nước sôi (100 °C)", fixedEnd + 4, yC(FIXED.steam), { size, color: COLORS.blue });
    if (clear(FIXED.ice)) label(ctx, small ? "nước đá tan" : "nước đá đang tan (0 °C)", fixedEnd + 4, yC(FIXED.ice), { size, color: COLORS.blue });
  }

  tube(ctx, tx, yTop, yBot, yC(c), small ? 9 : 12, bulbR);
  scale(ctx, xC, lo, hi, yC, pxPerC >= 3 ? 1 : 2, 10, size);
  scale(ctx, xF, toF(lo), toF(hi), f => yC((f - 32) / 1.8), 10, 50, size, "#6a3fc8");
  scale(ctx, xK, toK(lo), toK(hi), k => yC(k - 273), 10, 20, size, "#1f7a5a");
  label(ctx, "°C", xC + 4, head + 6, { size: small ? 12 : 14, bold: true });
  label(ctx, "°F", xF + 4, head + 6, { size: small ? 12 : 14, bold: true, color: "#6a3fc8" });
  label(ctx, "K", xK + 4, head + 6, { size: small ? 12 : 14, bold: true, color: "#1f7a5a" });

  // the current temperature read on every scale
  const y = yC(c);
  ctx.strokeStyle = LIQUID;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tx, y);
  ctx.lineTo(xK + 10, y);
  ctx.stroke();
  pill(ctx, fmt(c, 1), xC + 30, y, size + 1);
  pill(ctx, fmt(toF(c), 1), xF + 34, y, size + 1);
  pill(ctx, fmt(toK(c), 1), xK + 32, y, size + 1);

  if (!small && view.w - fixedEnd > 300) {
    const x = fixedEnd + 190;
    const lines = [
      [`t = ${fmt(c, 1)} °C`, COLORS.ink, true],
      [`t(°F) = 1,8 × ${fmt(c, 1)} + 32 = ${fmt(toF(c), 1)} °F`, "#6a3fc8", false],
      [`T(K) = ${fmt(c, 1)} + 273 = ${fmt(toK(c), 1)} K`, "#1f7a5a", false],
      ["SGK lấy 273; chính xác là 273,15.", COLORS.muted, false],
    ];
    lines.forEach(([t, color, bold], i) => label(ctx, t, x, head + 70 + i * 28, { size: 15, color, bold }));
  }
}

function drawQuiz(ctx, s, view, small) {
  const T = quizOf(s);
  const head = small ? 40 : 62;
  const lo = Math.min(Math.floor(T / 10) * 10 - 10, 80);
  const hi = lo + 30;
  const yTop = head + 26;
  const yBot = view.h - 26;
  const yC = v => yBot - ((v - lo) / (hi - lo)) * (yBot - yTop);
  const per = (yBot - yTop) / (hi - lo);
  const tx = view.w * (small ? 0.34 : 0.3);
  const w = small ? 20 : 26;
  const xs = tx - w / 2 - 6; // the scale is behind the tube, drawn on its left
  const size = small ? 12 : 14;

  tube(ctx, tx, yTop, yBot, yC(T), w, 0);
  // broken ends: this is only part of the thermometer
  ctx.strokeStyle = COLORS.bg;
  ctx.lineWidth = 6;
  for (const y of [yTop - 4, yBot - 2]) {
    ctx.beginPath();
    ctx.moveTo(tx - w, y);
    ctx.lineTo(tx + w, y + 6);
    ctx.stroke();
  }
  // °C scale with every 1 °C division
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let v = lo; v <= hi; v++) {
    const len = v % 10 === 0 ? 16 : v % 5 === 0 ? 11 : 6;
    ctx.moveTo(xs, yC(v));
    ctx.lineTo(xs - len, yC(v));
  }
  ctx.stroke();
  for (let v = lo; v <= hi; v += per * 5 >= 18 ? 5 : 10) label(ctx, fmt(v, 0), xs - 20, yC(v), { size, align: "right", bold: v % 10 === 0 });
  label(ctx, "°C", xs - 20, yTop - 14, { size, align: "right", bold: true });
  label(ctx, "Phóng to một đoạn nhiệt kế, ĐCNN 1 °C", tx + w, yBot + 14, { size: small ? 10 : 12, color: COLORS.muted, align: "center" });

  // Where a slanted look puts the top of the liquid on the scale (parallax), marked on the scale.
  const ym = yC(T);
  if (s.eye !== "level") {
    const ya = yC(apparent(T, s.eye));
    ctx.strokeStyle = COLORS.purple;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xs - 4, ya);
    ctx.lineTo(tx + w / 2 + 8, ya);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Side view (schematic): the scale lies behind the liquid, so only a level eye lines them up.
  const bw = small ? 104 : 170;
  const bh = small ? 110 : 150;
  const bx = Math.min(view.w - bw - 6, tx + w / 2 + (small ? 26 : 70));
  const by = Math.max(head + 4, Math.min(view.h - bh - 30, ym - bh / 2));
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx, by, bw, bh);
  label(ctx, "Nhìn từ bên cạnh", bx + bw / 2, by + 10, { size: small ? 10 : 12, align: "center", color: COLORS.muted });
  const plate = bx + 12;
  const col = bx + (small ? 30 : 40);
  const my = by + bh * 0.55;
  ctx.fillStyle = "#cfd6e2";
  ctx.fillRect(plate - 3, by + 22, 6, bh - 30);
  ctx.fillStyle = LIQUID;
  ctx.fillRect(col - 2, my, 4, by + bh - 8 - my);
  const ex = bx + bw - 18;
  const ey = my + { above: -1, level: 0, below: 1 }[s.eye] * bh * 0.3;
  const hitY = my + (my - ey) * ((col - plate) / (ex - col));
  ctx.strokeStyle = COLORS.purple;
  ctx.setLineDash([5, 3]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ex - 10, ey + ((my - ey) * 10) / (ex - col));
  ctx.lineTo(plate + 3, hitY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.beginPath();
  ctx.ellipse(ex, ey, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(ex - 4, ey, 3, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, "vạch chia", plate + 6, by + 28, { size: 10, color: COLORS.muted });
  label(ctx, "mắt", ex, ey + (ey > my ? -14 : 14), { size: 10, align: "center", color: COLORS.purple });
}

const FEEDBACK = {
  ok: [COLORS.green, s => `Đúng! ${quizOf(s)} °C = ${fmt(toF(quizOf(s)), 1)} °F = ${quizOf(s) + 273} K`],
  eye: [COLORS.red, () => "Đặt mắt ngang với mức chất lỏng rồi đọc lại."],
  value: [COLORS.red, () => "Chưa đúng. Đếm từng vạch chia 1 °C từ số gần nhất."],
};

mount({
  slug: "nhiet-ke-thang-nhiet-do",
  version: "1.0.0",
  title: "Nhiệt kế và thang nhiệt độ",
  hint: "Chọn một tình huống để đọc nhiệt độ trên ba thang Celsius, Fahrenheit, Kelvin. Ở chế độ đố, hãy đặt mắt đúng cách rồi đọc nhiệt kế.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Chế độ",
      options: [
        { value: "explore", label: "Khám phá các thang nhiệt độ" },
        { value: "quiz", label: "Đố đọc nhiệt kế" },
      ],
      onChange: s => (s.feedback = ""),
    },
    {
      type: "select",
      key: "situation",
      label: "Tình huống",
      options: Object.entries(SITUATIONS).map(([value, o]) => ({ value, label: o.c == null ? o.label : `${o.label}` })),
      visible: s => s.mode === "explore",
      onChange: s => {
        const c = SITUATIONS[s.situation]?.c;
        if (c != null) s.tempC = c;
      },
      onCommit: reportTemp,
    },
    {
      type: "slider",
      key: "tempC",
      label: "Nhiệt độ",
      min: RANGE[0],
      max: RANGE[1],
      step: 1,
      unit: "°C",
      digits: 0,
      visible: s => s.mode === "explore",
      onChange: s => {
        if (SITUATIONS[s.situation]?.c !== s.tempC) s.situation = "custom";
      },
      onCommit: reportTemp,
    },
    {
      type: "select",
      key: "eye",
      label: "Vị trí đặt mắt",
      options: [
        { value: "above", label: "Cao hơn mức chất lỏng" },
        { value: "level", label: "Ngang mức chất lỏng" },
        { value: "below", label: "Thấp hơn mức chất lỏng" },
      ],
      visible: s => s.mode === "quiz",
      onChange: s => (s.feedback = ""),
    },
    {
      type: "slider",
      key: "answer",
      label: "Số em đọc được",
      min: RANGE[0],
      max: RANGE[1],
      step: 1,
      unit: "°C",
      digits: 0,
      visible: s => s.mode === "quiz",
      onChange: s => (s.feedback = ""),
    },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: s => s.mode === "quiz",
      action(s, api) {
        const truth = quizOf(s);
        s.feedback = check(s.answer, truth, s.eye);
        const ok = s.feedback === "ok";
        api.emit("reading-checked", { answer: s.answer, truth, eyeLevel: s.eye === "level" ? 1 : 0, correct: ok ? 1 : 0 });
        if (ok) api.emit("correct-reading", { celsius: truth, fahrenheit: toF(truth), kelvin: toK(truth) }, "goal");
      },
    },
    {
      type: "button",
      label: "Câu mới",
      visible: s => s.mode === "quiz",
      event: "quiz-new",
      action(s) {
        const old = quizOf(s);
        do s.quizT = quizTemp(Math.random());
        while (s.quizT === old);
        s.feedback = "";
      },
    },
  ],
  readouts: [
    { label: "Nhiệt độ t", value: s => (s.mode === "quiz" && s.feedback !== "ok" ? "?" : `${fmt(shownC(s), 1)} °C`) },
    { label: "t(°F) = 1,8·t + 32", value: s => (s.mode === "quiz" && s.feedback !== "ok" ? "?" : `${fmt(toF(shownC(s)), 1)} °F`) },
    { label: "T(K) = t + 273", value: s => (s.mode === "quiz" && s.feedback !== "ok" ? "?" : `${fmt(toK(shownC(s)), 1)} K`) },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 400;
    const quiz = s.mode === "quiz";
    const c = shownC(s);
    const line1 = quiz
      ? "Nhiệt kế chỉ bao nhiêu độ C?"
      : `${SITUATIONS[s.situation]?.label ?? SITUATIONS.custom.label}: ${fmt(c, 1)} °C`;
    label(ctx, line1, view.w / 2, small ? 13 : 22, { align: "center", size: small ? 14 : 18, bold: true });
    const fb = quiz ? FEEDBACK[s.feedback] : null;
    const line2 = quiz
      ? fb
        ? fb[1](s)
        : "Chọn vị trí đặt mắt, chọn số đọc rồi bấm Kiểm tra."
      : `= ${fmt(toF(c), 1)} °F = ${fmt(toK(c), 1)} K`;
    label(ctx, line2, view.w / 2, small ? 31 : 47, {
      align: "center",
      size: small ? 12 : 14,
      bold: !!fb || !quiz,
      color: fb ? fb[0] : quiz ? COLORS.muted : COLORS.ink,
    });
    if (quiz) drawQuiz(ctx, s, view, small);
    else drawExplore(ctx, s, view, small);
  },
});
