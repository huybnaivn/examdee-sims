import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, solve, stiffness, weightOf, guessIsRight, maxExtension, MAX_COUNT, NATURAL, K_MIN, K_MAX } from "./model.js";

const SUB = ["₁", "₂"];
const F_MAX = weightOf(MAX_COUNT) * 1.1; // top of the force axis, N

// New springs: forget the loading history (the weights that hang now still count).
const freshSprings = s => {
  s.maxLoad = weightOf(s.count);
  s.verdict = 0;
};

const report = (s, api) => {
  const r = solve(s);
  api.emit("load-changed", { count: s.count, mass: r.mass, load: r.load, extension: r.extension }, "result");
};

// Everything is placed from the view size.
function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const n = s.setup === "series" ? 2 : 1;
  const range = s.setup === "series" ? 0.7 : 0.36; // m, longest extension the ruler must show
  const lw = small ? Math.max(118, view.w * 0.38) : Math.min(view.w * 0.4, 360); // spring column
  const top = small ? 50 : 84;
  const disc = small ? 5 : 8;
  const stack = 12 + MAX_COUNT * disc;
  const scale = (view.h - top - stack - 22) / (n * NATURAL + range); // px per metre
  const cx = lw * 0.42;
  const rx = lw * 0.8; // left edge of the ruler
  const graph = { x0: lw + (small ? 30 : 56), x1: view.w - (small ? 10 : 28), y0: small ? 42 : 88, y1: view.h - (small ? 28 : 52) };
  return { small, n, range, lw, top, disc, scale, cx, rx, graph, yZero: top + n * NATURAL * scale };
}

function drawSpring(ctx, x, y0, y1, half, width) {
  const lead = 5;
  const coils = 9;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y0 + lead);
  const dy = (y1 - y0 - 2 * lead) / (coils * 2);
  for (let i = 0; i < coils * 2; i++) ctx.lineTo(x + (i % 2 ? -half : half), y0 + lead + dy * (i + 0.5));
  ctx.lineTo(x, y1 - lead);
  ctx.lineTo(x, y1);
  ctx.stroke();
}

function drawRuler(ctx, g, limitExt) {
  const { rx, yZero, scale, small, range } = g;
  const w = small ? 18 : 26;
  const cm = scale / 100; // px per centimetre
  ctx.fillStyle = "#fff6d6";
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.fillRect(rx, yZero - 8, w, range * scale + 14);
  ctx.strokeRect(rx, yZero - 8, w, range * scale + 14);
  const tick = cm >= 4 ? 1 : 2;
  const named = cm >= 5 ? 5 : cm >= 2.6 ? 10 : 20;
  ctx.beginPath();
  for (let c = 0; c <= range * 100 + 0.01; c += tick) {
    const y = yZero + c * cm;
    ctx.moveTo(rx, y);
    ctx.lineTo(rx + (c % named === 0 ? w * 0.42 : c % 5 === 0 ? w * 0.3 : w * 0.18), y);
    if (c % named === 0) label(ctx, String(c), rx + w - 2, y, { size: small ? 8 : 10, align: "right", color: COLORS.muted });
  }
  ctx.stroke();
  if (limitExt <= range) {
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, yZero + limitExt * scale);
    ctx.lineTo(rx + w, yZero + limitExt * scale);
    ctx.stroke();
  }
  label(ctx, "cm", rx + w / 2, yZero - 15, { size: small ? 9 : 11, align: "center", color: COLORS.muted });
}

// Extension at which the first spring of the arrangement reaches its elastic limit.
const limitOf = s => {
  let lo = 0;
  let hi = MAX_COUNT * 4; // quarter weights
  const free = { ...s, maxLoad: 0 };
  if (solve(free, MAX_COUNT).elastic) return Infinity;
  while (hi - lo > 1e-6) {
    const mid = (lo + hi) / 2;
    if (solve(free, mid / 4).elastic) lo = mid;
    else hi = mid;
  }
  return solve(free, lo / 4).extension;
};

function drawGraph(ctx, s, g, now, limitExt) {
  const { x0, x1, y0, y1 } = g.graph;
  const small = g.small;
  const size = small ? 10 : 13;
  const xMax = g.range * 100; // cm
  const X = ext => x0 + ((ext * 100) / xMax) * (x1 - x0);
  const Y = F => y1 - (F / F_MAX) * (y1 - y0);

  // grid and axes
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const xStep = xMax / (x1 - x0) > 0.2 ? 10 : 5;
  for (let c = 0; c <= xMax; c += xStep) {
    ctx.moveTo(X(c / 100), y0);
    ctx.lineTo(X(c / 100), y1);
    label(ctx, String(c), X(c / 100), y1 + (small ? 9 : 13), { size, align: "center", color: COLORS.muted });
  }
  for (let F = 0; F <= F_MAX; F++) {
    ctx.moveTo(x0, Y(F));
    ctx.lineTo(x1, Y(F));
    label(ctx, String(F), x0 - 6, Y(F), { size, align: "right", color: COLORS.muted });
  }
  ctx.stroke();
  arrow(ctx, x0, y1, x0, y0 - (small ? 10 : 16), COLORS.ink, 1.5);
  arrow(ctx, x0, y1, x1 + (small ? 6 : 16), y1, COLORS.ink, 1.5);
  label(ctx, "F (N)", small ? x0 + 8 : x0 - 8, y0 - (small ? 10 : 16), { size, bold: true, align: small ? "left" : "right" });
  label(ctx, "Δl (cm)", x1, y1 + (small ? 20 : 32), { size, bold: true, align: "right" });

  // elastic limit
  if (limitExt <= g.range) {
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(X(limitExt), y1);
    ctx.lineTo(X(limitExt), y0);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, small ? "giới hạn" : "giới hạn đàn hồi", X(limitExt) + 4, y0 + 8, { size: small ? 9 : 12, color: COLORS.orange });
  }

  // loading curve of fresh springs: straight (Hooke) up to the limit, then bent
  const free = { ...s, maxLoad: 0 };
  ctx.lineWidth = 2;
  for (const elastic of [true, false]) {
    ctx.strokeStyle = elastic ? COLORS.blue : COLORS.orange;
    ctx.beginPath();
    let pen = false;
    for (let c = 0; c <= MAX_COUNT + 1e-9; c += 0.05) {
      const r = solve(free, c);
      const next = solve(free, Math.min(MAX_COUNT, c + 0.05));
      if (r.elastic !== elastic && next.elastic !== elastic) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(X(r.extension), Y(r.load));
      else ctx.moveTo(X(r.extension), Y(r.load));
      pen = true;
    }
    ctx.stroke();
  }
  // unloading line of overstretched springs (parallel to Hooke's line, shifted by the permanent set)
  if (!now.elastic) {
    const a = solve(s, 0);
    const b = solve(s, s.maxLoad / weightOf(1));
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(X(a.extension), Y(0));
    ctx.lineTo(X(b.extension), Y(b.load));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // one point per weight, the present one highlighted with guides to both axes
  for (let c = 0; c <= s.count; c++) {
    const r = solve(s, c);
    ctx.fillStyle = c === s.count ? COLORS.red : COLORS.ink;
    ctx.beginPath();
    ctx.arc(X(r.extension), Y(r.load), c === s.count ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x0, Y(now.load));
  ctx.lineTo(X(now.extension), Y(now.load));
  ctx.lineTo(X(now.extension), y1);
  ctx.stroke();
  ctx.setLineDash([]);

  // what the slope means
  const hidden = s.setup === "unknown" && s.verdict !== 1;
  const kText = hidden ? "?" : `${fmt(now.k, 1)} N/m`;
  const lines = [small ? `k = F/Δl = ${kText}` : `Hệ số góc đoạn thẳng: k = F/Δl = ${kText}`];
  if (s.setup === "series") lines.push("1/k = 1/k₁ + 1/k₂");
  if (s.setup === "parallel") lines.push("k = k₁ + k₂");
  let color = COLORS.blue;
  if (s.setup === "unknown" && s.verdict === 1) lines.push("Đúng rồi!"), (color = COLORS.green);
  if (s.setup === "unknown" && s.verdict === -1) lines.push(small ? "Chưa đúng, hãy đo lại" : "Chưa đúng: đo lại F và Δl trong giới hạn đàn hồi"), (color = COLORS.red);
  if (!now.elastic) lines.push(small ? `biến dạng dư ${fmt(now.permanent * 100, 1)} cm` : `Đã vượt giới hạn: biến dạng dư ${fmt(now.permanent * 100, 1)} cm`);
  // above the plot, so the text never covers the curve
  const shown = small ? [lines[0], ...lines.slice(1).slice(-1)] : lines;
  shown.forEach((text, i) => {
    const warn = !now.elastic && text === lines.at(-1);
    label(ctx, text, x1, (small ? 8 : 14) + i * (small ? 13 : 20), { size: small ? 10 : 14, align: "right", bold: i === 0, color: warn ? COLORS.red : i === 0 ? COLORS.blue : color });
  });
}

mount({
  slug: "luc-dan-hoi",
  version: "1.0.0",
  title: "Lực đàn hồi và định luật Húc",
  hint: "Thêm, bớt quả nặng 50 g và đọc độ dãn trên thước. Lấy P = 10·m.",
  initialState,
  controls: [
    {
      type: "select",
      key: "setup",
      label: "Thí nghiệm",
      options: [
        { value: "single", label: "Một lò xo" },
        { value: "series", label: "Hai lò xo ghép nối tiếp" },
        { value: "parallel", label: "Hai lò xo ghép song song" },
        { value: "unknown", label: "Lò xo chưa biết độ cứng" },
      ],
      onChange: freshSprings,
    },
    {
      type: "stepper",
      key: "count",
      label: "Số quả nặng",
      min: 0,
      max: MAX_COUNT,
      format: v => `${v} quả`,
      onChange: s => {
        s.maxLoad = Math.max(s.maxLoad, weightOf(s.count));
      },
      onCommit: report,
    },
    { type: "slider", key: "k1", label: "Độ cứng k₁", min: K_MIN, max: K_MAX, step: 5, unit: "N/m", digits: 0, onChange: freshSprings, visible: s => s.setup !== "unknown" },
    { type: "slider", key: "k2", label: "Độ cứng k₂", min: K_MIN, max: K_MAX, step: 5, unit: "N/m", digits: 0, onChange: freshSprings, visible: s => s.setup === "series" || s.setup === "parallel" },
    {
      type: "slider",
      key: "guess",
      label: "Độ cứng em đo được",
      min: 10,
      max: 100,
      step: 1,
      unit: "N/m",
      digits: 0,
      visible: s => s.setup === "unknown",
      onChange: s => {
        s.verdict = 0;
      },
    },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: s => s.setup === "unknown",
      action(s, api) {
        const was = s.verdict;
        s.verdict = guessIsRight(s) ? 1 : -1;
        if (s.verdict === 1 && was !== 1) api.emit("stiffness-found", { stiffness: stiffness(s), answer: s.guess }, "goal");
      },
    },
    {
      type: "button",
      label: "Thay lò xo mới (bỏ hết quả nặng)",
      visible: s => s.setup === "unknown" || !solve(s).elastic,
      event: "spring-replaced",
      action(s) {
        if (s.setup === "unknown") {
          // another unknown stiffness, 20–80 N/m in steps of 5, never the same twice in a row
          const steps = (K_MAX - K_MIN) / 5;
          s.kx = K_MIN + 5 * ((Math.round((stiffness(s) - K_MIN) / 5) + 1 + Math.floor(Math.random() * steps)) % (steps + 1));
        }
        s.count = 0;
        s.maxLoad = 0;
        s.verdict = 0;
      },
    },
  ],
  readouts: [
    { label: "Khối lượng treo m", value: s => `${fmt(solve(s).mass * 1000, 0)} g` },
    { label: "Lực đàn hồi F = P = 10·m", value: s => `${fmt(solve(s).load)} N` },
    { label: "Độ dãn Δl", value: s => `${fmt(solve(s).extension * 100, 1)} cm` },
    { label: "Độ cứng k của hệ", value: s => (s.setup === "unknown" && s.verdict !== 1 ? "?" : `${fmt(stiffness(s), 1)} N/m`) },
    { label: "Trạng thái", value: s => (solve(s).elastic ? "Trong giới hạn đàn hồi" : `Biến dạng dư ${fmt(solve(s).permanent * 100, 1)} cm`) },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    const now = solve(s);
    const limitExt = limitOf(s);
    const { small, cx, rx, top, scale, yZero, disc } = g;
    const size = small ? 11 : 15;

    // what the numbers are
    const lh = small ? 13 : 22;
    const y = small ? 9 : 18;
    label(ctx, small ? `P = 10·m = ${fmt(now.load)} N` : `P = 10·m = 10 · ${fmt(now.mass, 2)} = ${fmt(now.load)} N`, 8, y, { size, bold: true, color: COLORS.red });
    label(ctx, `Δl = ${fmt(now.extension * 100, 1)} cm`, 8, y + lh, { size, bold: true, color: COLORS.blue });
    if (!now.elastic) label(ctx, small ? "Vượt giới hạn đàn hồi!" : "Vượt giới hạn đàn hồi: lò xo bị dãn hỏng", 8, y + 2 * lh, { size: small ? 10 : 13, color: COLORS.orange, bold: true });
    else if (!small) label(ctx, "Lò xo dãn tỉ lệ thuận với lực: F = k·Δl", 8, y + 2 * lh, { size: 13, color: COLORS.muted });

    drawRuler(ctx, g, limitExt);

    // support
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(cx - (small ? 34 : 60), top - 8, small ? 68 : 120, 8);

    // springs
    const half = small ? 8 : 13;
    const stiffLine = k => 1.5 + (2 * (k - K_MIN)) / (K_MAX - K_MIN); // a stiffer spring is drawn with thicker wire
    const end = yZero + now.extension * scale; // lower end of the arrangement = ruler reading
    const name = i => (s.setup === "unknown" ? "k = ?" : s.setup === "single" ? (small ? "k₁" : `k₁ = ${fmt(s.k1)} N/m`) : small || s.setup === "parallel" ? `k${SUB[i]}` : `k${SUB[i]} = ${fmt(now.parts[i].k)} N/m`);
    if (s.setup === "parallel") {
      const d = small ? 15 : 30;
      [-1, 1].forEach((side, i) => {
        drawSpring(ctx, cx + side * d, top, end, half * 0.8, stiffLine(now.parts[i].k));
        label(ctx, name(i), cx + side * (d + half + 4), (top + end) / 2, { size: small ? 10 : 13, align: side < 0 ? "right" : "left", color: COLORS.muted });
      });
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(cx - d - half, end - 2, 2 * (d + half), 4);
    } else if (s.setup === "series") {
      const mid = top + (NATURAL + now.parts[0].extension) * scale;
      drawSpring(ctx, cx, top, mid, half, stiffLine(now.parts[0].k));
      drawSpring(ctx, cx, mid, end, half, stiffLine(now.parts[1].k));
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.arc(cx, mid, 3.5, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, name(0), cx - half - 5, (top + mid) / 2, { size: small ? 10 : 13, align: "right", color: COLORS.muted });
      label(ctx, name(1), cx - half - 5, (mid + end) / 2, { size: small ? 10 : 13, align: "right", color: COLORS.muted });
    } else {
      drawSpring(ctx, cx, top, end, half, stiffLine(now.k));
      label(ctx, name(0), cx - half - 5, (top + end) / 2, { size: small ? 10 : 13, align: "right", color: COLORS.muted });
    }

    // pointer to the ruler (the ruler's zero is the lower end of the unloaded, undamaged springs)
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, end);
    ctx.lineTo(rx - 2, end);
    ctx.stroke();
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.moveTo(rx, end);
    ctx.lineTo(rx - 7, end - 4);
    ctx.lineTo(rx - 7, end + 4);
    ctx.fill();

    // hanger and weights
    const ww = small ? 26 : 40;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, end);
    ctx.lineTo(cx, end + 10 + s.count * disc);
    ctx.stroke();
    for (let i = 0; i < s.count; i++) {
      ctx.fillStyle = i % 2 ? "#8d99b0" : COLORS.muted;
      ctx.fillRect(cx - ww / 2, end + 10 + i * disc, ww, disc - 1);
    }

    // forces on the weights (equal and opposite at rest)
    if (now.load > 0) {
      const ax = cx - (s.setup === "parallel" ? (small ? 15 : 30) + half : ww / 2) - (small ? 8 : 16);
      const ay = end + 10 + (s.count * disc) / 2;
      const len = now.load * (small ? 7 : 12);
      arrow(ctx, ax, ay, ax, ay - len, COLORS.blue, small ? 2 : 3);
      arrow(ctx, ax, ay, ax, ay + len, COLORS.red, small ? 2 : 3);
      label(ctx, "Fđh", ax - 5, ay - len + 6, { size: small ? 10 : 13, bold: true, color: COLORS.blue, align: "right" });
      label(ctx, "P", ax - 5, ay + len - 6, { size: small ? 10 : 13, bold: true, color: COLORS.red, align: "right" });
    }

    drawGraph(ctx, s, g, now, limitExt);
  },
});
