import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  TOWN, SCALES, PLACES, place, initialState, denominator, ends, measure, scaleBar, snapPlace, putOn,
  question, startQuestion, nextQuestion, isCorrect,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
/** Whole numbers the way textbooks write a scale: 10 000. */
const big = n => Math.round(n).toLocaleString("vi-VN").replace(/\./g, " ");
const scaleText = denom => `1 : ${big(denom)}`;
const practice = s => s.mode === "practice";
const done = s => s.status === "right";
const solvedCount = s => Math.max(0, Math.round(s.solved) || 0);
const asked = s => (practice(s) ? question(s.qIndex).type : ""); // "real" | "map" | ""
const PLACE_TONES = { school: COLORS.orange, post: COLORS.yellow, market: COLORS.red, home: COLORS.purple, park: COLORS.green, hospital: COLORS.blue };
const BLOCKS = [[150, 150, 130, 70], [320, 150, 130, 70], [150, 260, 130, 90], [320, 250, 130, 100], [550, 150, 110, 60], [770, 150, 80, 90], [550, 440, 150, 40], [150, 440, 200, 40], [760, 30, 90, 40], [200, 20, 180, 50]];

/** Centred paragraph, wrapped to maxW. Returns the y just below it. */
function para(ctx, text, cx, y, { size = 14, maxW = 300, color = COLORS.ink, bold = false, maxLines = 3 } = {}) {
  const lines = sz => {
    ctx.font = `${bold ? "600 " : ""}${sz}px ${FONT}`;
    const out = [""];
    for (const word of text.split(" ")) {
      const next = out.at(-1) ? `${out.at(-1)} ${word}` : word;
      if (ctx.measureText(next).width <= maxW || !out.at(-1)) out[out.length - 1] = next;
      else out.push(word);
    }
    return out;
  };
  let rows = lines(size);
  while (rows.length > maxLines && size > 9) rows = lines(--size);
  rows.forEach((row, i) => label(ctx, row, cx, y + size * 0.7 + i * size * 1.32, { size, color, bold, align: "center" }));
  return y + rows.length * size * 1.32;
}

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(s, view) {
  const small = view.w < 520 || view.h < 400;
  const head = practice(s) ? (small ? 64 : 74) : small ? 40 : 62;
  const foot = small ? 70 : 88;
  // screen px for one centimetre of the map: the largest scale (1 : 5 000, a 20 cm × 10 cm sheet) just fits
  const ppc = Math.max(6, Math.min((view.w - 20) / 20.6, (view.h - head - foot) / 10.8));
  const denom = denominator(s);
  const k = (100 / denom) * ppc; // screen px per metre
  const sheet = { w: TOWN.w * k, h: TOWN.h * k };
  sheet.x = (view.w - sheet.w) / 2;
  sheet.y = head + (view.h - head - foot - sheet.h) / 2;
  const P = p => ({ x: sheet.x + p.x * k, y: sheet.y + p.y * k });
  const { a, b } = ends(s);
  return { small, head, foot, ppc, denom, k, sheet, P, A: P(a), B: P(b) };
}

function drawMap(ctx, s, g) {
  const { sheet, k, P } = g;
  const R = (x, y, w, h) => [sheet.x + x * k, sheet.y + y * k, w * k, h * k];
  ctx.fillStyle = "rgba(31, 42, 68, 0.12)";
  ctx.fillRect(sheet.x + 3, sheet.y + 3, sheet.w, sheet.h);
  ctx.fillStyle = "#fffdf6";
  ctx.fillRect(sheet.x, sheet.y, sheet.w, sheet.h);

  // park, lake, blocks of houses (decoration only)
  ctx.fillStyle = "#d9f0dc";
  ctx.fillRect(...R(410, 330, 180, 150));
  ctx.fillStyle = "#cfe6fb";
  ctx.beginPath();
  ctx.ellipse(sheet.x + 720 * k, sheet.y + 290 * k, 100 * k, 50 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  if (sheet.w >= 200) {
    ctx.fillStyle = "#e8e4da";
    for (const b of BLOCKS) ctx.fillRect(...R(...b));
  }
  if (s.showGrid) {
    ctx.strokeStyle = "rgba(47, 111, 237, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 100; x < TOWN.w; x += 100) {
      ctx.moveTo(sheet.x + x * k, sheet.y);
      ctx.lineTo(sheet.x + x * k, sheet.y + sheet.h);
    }
    for (let y = 100; y < TOWN.h; y += 100) {
      ctx.moveTo(sheet.x, sheet.y + y * k);
      ctx.lineTo(sheet.x + sheet.w, sheet.y + y * k);
    }
    ctx.stroke();
  }
  // roads
  ctx.strokeStyle = "#b9c0cc";
  ctx.lineWidth = clamp(16 * k, 2, 12);
  ctx.lineCap = "butt";
  ctx.beginPath();
  for (const y of [100, 400]) {
    ctx.moveTo(sheet.x, sheet.y + y * k);
    ctx.lineTo(sheet.x + sheet.w, sheet.y + y * k);
  }
  for (const x of [100, 500, 900]) {
    ctx.moveTo(sheet.x + x * k, sheet.y);
    ctx.lineTo(sheet.x + x * k, sheet.y + sheet.h);
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sheet.x, sheet.y, sheet.w, sheet.h);

  // landmarks
  const m = clamp(36 * k, 5, 26);
  const names = sheet.w >= 430 ? "name" : sheet.w >= 150 ? "short" : "";
  for (const p of PLACES) {
    const { x, y } = P(p);
    ctx.fillStyle = PLACE_TONES[p.id];
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - m / 2, y - m / 2, m, m, m * 0.2);
    ctx.fill();
    ctx.stroke();
    if (names) label(ctx, p[names], x, y + (p.y < TOWN.h / 2 ? -1 : 1) * (m / 2 + (names === "name" ? 12 : 9)), { size: names === "name" ? 13 : sheet.w >= 210 ? 10.5 : 9, align: "center", bold: true });
  }
}

function drawRuler(ctx, g, text) {
  const { A, B, ppc, small } = g;
  const len = Math.hypot(B.x - A.x, B.y - A.y);
  const ang = Math.atan2(B.y - A.y, B.x - A.x);
  const side = Math.cos(ang) < 0 ? -1 : 1; // keep the strip, and its numbers, the right way up
  const w = clamp(ppc * 0.9, 14, 26);
  const cms = Math.ceil(len / ppc + 0.3);
  ctx.save();
  ctx.translate(A.x, A.y);
  ctx.rotate(ang);
  ctx.fillStyle = "rgba(245, 197, 24, 0.5)";
  ctx.strokeStyle = "rgba(120, 90, 0, 0.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(-ppc * 0.3, 0, (cms + 0.6) * ppc, side * w);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  const fine = ppc >= 22;
  for (let i = 0; i <= cms * 10; i += fine ? 1 : 5) {
    const h = i % 10 === 0 ? 0.5 : i % 5 === 0 ? 0.36 : 0.22;
    ctx.moveTo((i * ppc) / 10, 0);
    ctx.lineTo((i * ppc) / 10, side * w * h);
  }
  ctx.stroke();
  const every = ppc < 13 ? 5 : ppc < 19 ? 2 : 1;
  for (let c = 0; c <= cms; c += every) {
    ctx.save();
    ctx.translate(c * ppc, side * w * 0.76);
    if (side < 0) ctx.rotate(Math.PI);
    label(ctx, `${c}`, 0, 0, { size: clamp(w * 0.4, 8, 11), align: "center", color: "#5a4300", bold: true });
    ctx.restore();
  }
  ctx.restore();

  // the measured segment and its two ends
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.lineTo(B.x, B.y);
  ctx.stroke();
  for (const [p, color, name] of [[A, COLORS.blue, "A"], [B, COLORS.red, "B"]]) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, small ? 8 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(ctx, name, p.x, p.y + 0.5, { size: small ? 10 : 12, align: "center", bold: true, color: "#fff" });
  }
  // reading, on the side away from the strip
  const nx = Math.sin(ang) * side;
  const ny = -Math.cos(ang) * side;
  const size = small ? 12 : 14;
  ctx.font = `600 ${size}px ${FONT}`;
  const tw = ctx.measureText(text).width + 12;
  const cx = clamp((A.x + B.x) / 2 + nx * (size + 8), tw / 2 + 2, g.sheet.x * 2 + g.sheet.w - tw / 2 - 2);
  const cy = (A.y + B.y) / 2 + ny * (size + 8);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - tw / 2, cy - size * 0.8, tw, size * 1.6, 6);
  ctx.fill();
  ctx.stroke();
  label(ctx, text, cx, cy, { size, align: "center", bold: true });
}

function drawScaleBar(ctx, g, view) {
  const bar = scaleBar(g.denom);
  const x = 14;
  const y = view.h - (g.small ? 12 : 16);
  const w = g.ppc;
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(x, y - 6, w, 6);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + w, y - 6, w, 6);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y - 6, 2 * w, 6);
  const size = g.small ? 10 : 12;
  label(ctx, "0", x, y - 15, { size, align: "center" });
  if (w >= 26) label(ctx, `${bar.half}`, x + w, y - 15, { size, align: "center" });
  label(ctx, `${bar.metres} m`, x + 2 * w, y - 15, { size, align: w >= 26 ? "center" : "left" });
  return x + 2 * w + 30;
}

const report = (s, api) => {
  if (practice(s)) return;
  const r = measure(s);
  api.emit("measured", { mapLength: r.mapRead, realDistance: r.realFromReading, scale: r.denom }, "result");
};
const pick = which => (s, api) => {
  putOn(s, which, s[which === "a" ? "from" : "to"]);
};
const PLACE_OPTIONS = [...PLACES.map(p => ({ value: p.id, label: p.name })), { value: "free", label: "Điểm tự chọn (kéo trên bản đồ)" }];
const unmark = s => {
  s.status = "";
};

mount({
  slug: "ti-le-ban-do",
  version: "1.0.0",
  title: "Tỉ lệ bản đồ",
  hint: "Kéo hai đầu thước A, B trên bản đồ để đo, rồi nhân với mẫu số của tỉ lệ để được khoảng cách thực tế. Đổi tỉ lệ để xem bản đồ to ra hay nhỏ lại.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Hoạt động",
      options: [
        { value: "measure", label: "Đo khoảng cách trên bản đồ" },
        { value: "practice", label: "Luyện tập: bài toán tỉ lệ bản đồ" },
      ],
      onChange: s => {
        if (practice(s)) startQuestion(s);
      },
    },
    { type: "select", key: "scale", label: "Tỉ lệ bản đồ", visible: s => !practice(s), onCommit: report, options: SCALES.map(n => ({ value: n, label: scaleText(n) })) },
    { type: "select", key: "from", label: "Đặt đầu thước A tại", visible: s => !practice(s), onChange: pick("a"), onCommit: report, options: PLACE_OPTIONS },
    { type: "select", key: "to", label: "Đặt đầu thước B tại", visible: s => !practice(s), onChange: pick("b"), onCommit: report, options: PLACE_OPTIONS },
    { type: "checkbox", key: "showGrid", label: "Hiện lưới ô vuông (mỗi ô 100 m × 100 m)" },
    { type: "slider", key: "answerM", label: "Đáp số: khoảng cách thực tế", min: 0, max: 1000, step: 50, unit: "m", digits: 0, visible: s => asked(s) === "real", disabled: done, onChange: unmark },
    { type: "slider", key: "answerCm", label: "Đáp số: độ dài trên bản đồ", min: 0, max: 10, step: 0.5, unit: "cm", digits: 1, visible: s => asked(s) === "map", disabled: done, onChange: unmark },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: practice,
      disabled: done,
      action(s, api) {
        const q = question(s.qIndex);
        const answer = q.type === "real" ? s.answerM : s.answerCm;
        const direction = q.type === "real" ? 1 : 2;
        if (isCorrect(s)) {
          s.status = "right";
          s.solved = solvedCount(s) + 1;
          api.emit("conversion-correct", { direction, answer, scale: q.denom, solved: s.solved }, "goal");
        } else {
          s.status = "wrong";
          api.emit("wrong-answer", { direction, answer, expected: q.answer, scale: q.denom }, "action");
        }
      },
    },
    { type: "button", label: "Câu khác", visible: practice, action: s => nextQuestion(s), event: "new-question", eventKind: "action" },
  ],
  readouts: [
    { label: "Tỉ lệ bản đồ", value: s => scaleText(denominator(s)) },
    { label: "Độ dài AB trên bản đồ", value: s => (asked(s) === "map" && !done(s) ? "?" : `${measure(s).exact ? "" : "≈ "}${fmt(measure(s).mapRead, 1)} cm`) },
    { label: "Khoảng cách thực tế", value: s => (asked(s) === "real" && !done(s) ? "?" : `${measure(s).exact ? "" : "≈ "}${fmt(measure(s).realFromReading, 0)} m`) },
    { label: "Số câu luyện tập đúng", value: s => `${solvedCount(s)}` },
  ],
  pointer: {
    down(p, s, api, view) {
      if (practice(s)) return false; // the ruler is laid on the two places of the question
      const g = geom(s, view);
      const dA = Math.hypot(p.x - g.A.x, p.y - g.A.y);
      const dB = Math.hypot(p.x - g.B.x, p.y - g.B.y);
      if (Math.min(dA, dB) > 28) return false;
      s._drag = dB <= dA ? "b" : "a";
      return true;
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      let x = clamp((p.x - g.sheet.x) / g.k, 0, TOWN.w);
      let y = clamp((p.y - g.sheet.y) / g.k, 0, TOWN.h);
      const near = snapPlace(x, y, Math.min(14 / g.k, 60)); // within 14 px of a landmark, and never more than 60 m
      if (near) [x, y] = [near.x, near.y];
      s[`${s._drag}x`] = x;
      s[`${s._drag}y`] = y;
      s[s._drag === "a" ? "from" : "to"] = near ? near.id : "free";
    },
    up(p, s, api) {
      if (!s._drag) return;
      s._drag = "";
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { small, denom } = g;
    const r = measure(s);
    const q = question(s.qIndex);
    const size = small ? 12 : 15;
    const hideMap = asked(s) === "map" && !done(s);
    const cm = fmt(r.mapRead, 1);

    drawMap(ctx, s, g);
    drawRuler(ctx, g, hideMap ? "? cm" : `${r.exact ? "" : "≈ "}${cm} cm`);

    // words above the map
    if (practice(s)) {
      const [from, to] = [place(q.from).name, place(q.to).name];
      const text =
        q.type === "real"
          ? `Trên bản đồ tỉ lệ ${scaleText(denom)}, khoảng cách từ ${from} đến ${to} đo được ${fmt(q.map, 1)} cm. Ngoài thực tế, khoảng cách đó dài bao nhiêu mét?`
          : `Khoảng cách từ ${from} đến ${to} ngoài thực tế là ${fmt(q.real, 0)} m. Trên bản đồ tỉ lệ ${scaleText(denom)}, khoảng cách đó dài bao nhiêu xăng-ti-mét?`;
      para(ctx, text, view.w / 2, small ? 3 : 8, { size: small ? 12.5 : 16, maxW: view.w - 16, bold: true });
    } else {
      label(ctx, `Tỉ lệ bản đồ ${scaleText(denom)}`, view.w / 2, small ? 12 : 22, { size: small ? 15 : 20, align: "center", bold: true });
      para(ctx, `1 cm trên bản đồ ứng với ${big(denom)} cm = ${big(denom / 100)} m ngoài thực tế`, view.w / 2, small ? 22 : 37, { size, maxW: view.w - 16, color: COLORS.muted, maxLines: 1 });
    }

    // the calculation under the map
    const real = `${cm} × ${big(denom)} = ${big(r.realCm)} cm = ${big(r.realFromReading)} m`;
    const back = `${big(q.real)} m = ${big(q.real * 100)} cm;  ${big(q.real * 100)} : ${big(denom)} = ${fmt(q.map, 1)} cm`;
    const line = !practice(s)
      ? [`Đo trên bản đồ: AB ${r.exact ? "=" : "≈"} ${cm} cm.  Thực tế${r.exact ? "" : " khoảng"}: ${real}.`, COLORS.ink]
      : done(s)
        ? [`Đúng rồi!  ${q.type === "real" ? real : back}.`, COLORS.green]
        : s.status === "wrong"
          ? [q.type === "real" ? "Chưa đúng. Lấy độ dài trên bản đồ nhân với mẫu số của tỉ lệ, rồi đổi cm ra m (100 cm = 1 m)." : "Chưa đúng. Đổi khoảng cách thực tế ra cm, rồi chia cho mẫu số của tỉ lệ.", COLORS.red]
          : ["Chọn đáp số rồi bấm Kiểm tra. Có thể đếm vạch trên thước để kiểm tra lại.", COLORS.muted];
    para(ctx, line[0], view.w / 2, view.h - g.foot + 4, { size, maxW: view.w - 16, color: line[1], bold: true, maxLines: 2 });

    const left = drawScaleBar(ctx, g, view);
    const note = small ? "“cm” đọc theo thước trong hình, không phải cm thật trên màn hình." : "Các số đo “cm” đọc theo thước vẽ trong hình, không phải xăng-ti-mét thật trên màn hình.";
    para(ctx, note, (left + view.w) / 2, view.h - (small ? 30 : 30), { size: small ? 10 : 12, maxW: view.w - left - 8, color: COLORS.muted, maxLines: 2 });
  },
});
