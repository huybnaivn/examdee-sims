import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, solve, viete, quickRoots, twoNumbers, isMatch, newProblem, equation } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const n = (v, digits = 2) => fmt(v, digits);
const par = v => (v < 0 ? `(${n(v)})` : n(v)); // negative numbers in brackets inside a formula
const exact = v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;
const eqv = v => `${exact(v) ? "=" : "≈"} ${n(v)}`;

const poly = (a, b, c, x = "x") => {
  const terms = [[a, x + "²"], [b, x], [c, ""]].filter(([k]) => k !== 0);
  if (!terms.length) return "0";
  return terms.map(([k, v], i) => (i ? (k < 0 ? " − " : " + ") : k < 0 ? "−" : "") + (Math.abs(k) === 1 && v ? "" : n(Math.abs(k))) + v).join("");
};

const row = (text, color = COLORS.ink, bold = false) => ({ text, color, bold });

// ax² + bx + c = 0 with a = 0: what is left is a first-degree equation.
function linearRows(q, r) {
  if (r.type === "linear") {
    return [row(`a = 0: còn lại phương trình bậc nhất ${poly(0, q.b, q.c)} = 0`, COLORS.orange), row(`x = −c/b = ${n(-q.c)}/${par(q.b)} ${eqv(r.roots[0])}`)];
  }
  return [
    row("a = 0 và b = 0: không còn ẩn x trong phương trình", COLORS.orange),
    q.c === 0 ? row("0x = 0: phương trình nghiệm đúng với mọi x", COLORS.green) : row(`0x = ${n(-q.c)}: phương trình vô nghiệm`, COLORS.red),
  ];
}

// The solution by Δ (prime = false) or by Δ′ (prime = true), one textbook step per row.
function formulaRows(q, r, prime) {
  const D = prime ? r.deltaPrime : r.delta;
  const name = prime ? "Δ′" : "Δ";
  const B = prime ? q.b / 2 : q.b;
  const bName = prime ? "b′" : "b";
  const den = prime ? q.a : 2 * q.a;
  const denName = prime ? "a" : "(2a)";
  const rows = [
    prime
      ? row(`b = ${n(q.b)} = 2b′ nên b′ = ${n(B)};  Δ′ = b′² − ac = ${par(B)}² − ${par(q.a)}·${par(q.c)} = ${n(D)}`)
      : row(`Δ = b² − 4ac = ${par(q.b)}² − 4·${par(q.a)}·${par(q.c)} = ${n(D)}`),
  ];
  if (D < 0) return [...rows, row(`${name} < 0: phương trình vô nghiệm`, COLORS.red)];
  if (D === 0) {
    return [...rows, row(`${name} = 0: phương trình có nghiệm kép`, COLORS.orange), row(`x₁ = x₂ = −${bName}/${denName} = ${n(-B)}/${par(den)} ${eqv(r.roots[0])}`)];
  }
  const root = Number.isInteger(Math.sqrt(D)) ? n(Math.sqrt(D)) : `√${n(D)}`;
  return [
    ...rows,
    row(`${name} > 0: phương trình có hai nghiệm phân biệt`, COLORS.green),
    row(`x₁ = (−${bName} + √${name})/${denName} = (${n(-B)} + ${root})/${par(den)} ${eqv(r.roots[0])}`),
    row(`x₂ = (−${bName} − √${name})/${denName} = (${n(-B)} − ${root})/${par(den)} ${eqv(r.roots[1])}`),
  ];
}

function vieteRows(q, r) {
  const vt = viete(q.a, q.b, q.c);
  if (!vt) return [row(`Δ = ${n(r.delta)} < 0: phương trình vô nghiệm, không áp dụng được hệ thức Vi-ét`, COLORS.red)];
  const [x1, x2 = x1] = r.roots;
  const quick = quickRoots(q.a, q.b, q.c);
  const rows = [
    row(`Δ = ${n(r.delta)} ≥ 0 nên phương trình có hai nghiệm x₁, x₂${r.delta === 0 ? " (nghiệm kép)" : ""}`, COLORS.green),
    row(`S = x₁ + x₂ = −b/a = ${n(-q.b)}/${par(q.a)} ${eqv(vt.sum)};  thử lại: ${n(x1)} + ${par(x2)} ${eqv(x1 + x2)} ✓`),
    row(`P = x₁·x₂ = c/a = ${n(q.c)}/${par(q.a)} ${eqv(vt.product)};  thử lại: ${n(x1)}·${par(x2)} ${eqv(x1 * x2)} ✓`),
  ];
  if (quick?.rule === "plus") {
    rows.push(row(`Nhẩm nghiệm: a + b + c = ${n(q.a)} + ${par(q.b)} + ${par(q.c)} = 0 ⇒ hai nghiệm là 1 và c/a ${eqv(quick.roots[1])}`, COLORS.purple));
  } else if (quick) {
    rows.push(row(`Nhẩm nghiệm: a − b + c = ${n(q.a)} − ${par(q.b)} + ${par(q.c)} = 0 ⇒ hai nghiệm là −1 và −c/a ${eqv(quick.roots[1])}`, COLORS.purple));
  } else {
    rows.push(row(`a + b + c = ${n(q.a + q.b + q.c)} ≠ 0; a − b + c = ${n(q.a - q.b + q.c)} ≠ 0: không nhẩm nghiệm được`, COLORS.muted));
  }
  return rows;
}

function reverseRows(s) {
  const d = s.sum * s.sum - 4 * s.product;
  const t = twoNumbers(s.sum, s.product);
  const ok = isMatch(s);
  const rows = [
    row(`Tìm hai số u, v biết u + v = ${n(s.sum)} và u·v = ${n(s.product)}`, COLORS.ink, true),
    row(`u, v là hai nghiệm của phương trình ${poly(1, -s.sum, s.product, "X")} = 0`),
    t
      ? row(`Điều kiện: S² − 4P = ${n(s.sum * s.sum)} − ${par(4 * s.product)} = ${n(d)} ≥ 0: tìm được hai số`, COLORS.green)
      : row(`S² − 4P = ${n(s.sum * s.sum)} − ${par(4 * s.product)} = ${n(d)} < 0: không có hai số nào thỏa mãn`, COLORS.red),
    row(
      `Em chọn u = ${n(s.u)}, v = ${n(s.v)}:  u + v = ${n(s.u + s.v)} ${s.u + s.v === s.sum ? "✓" : "✗"};  u·v = ${n(s.u * s.v)} ${s.u * s.v === s.product ? "✓" : "✗"}${ok ? "  Đúng rồi!" : ""}`,
      ok ? COLORS.green : COLORS.orange,
      ok
    ),
  ];
  if (s.showAnswer && t) rows.push(row(`Đáp án: hai số là ${n(t[0])} và ${n(t[1])}${t.every(exact) ? "" : " (giá trị gần đúng)"}`, COLORS.red));
  return rows;
}

function steps(s) {
  if (s.mode === "reverse") return reverseRows(s);
  const q = equation(s);
  const r = solve(q.a, q.b, q.c);
  const head = row(`${poly(q.a, q.b, q.c)} = 0   (a = ${n(q.a)}; b = ${n(q.b)}; c = ${n(q.c)})`, COLORS.ink, true);
  if (r.type !== "quadratic") return [head, ...linearRows(q, r)];
  if (s.mode === "viete") return [head, ...vieteRows(q, r)];
  if (s.mode === "deltaPrime" && q.b % 2 !== 0) {
    return [head, row(`b = ${n(q.b)} là số lẻ nên dùng công thức nghiệm với Δ (Δ′ chỉ gọn khi b chẵn)`, COLORS.orange), ...formulaRows(q, r, false)];
  }
  return [head, ...formulaRows(q, r, s.mode === "deltaPrime")];
}

// One line of text, shrunk when it would run past `width`.
function line(ctx, r, x, y, width, size) {
  ctx.font = `${r.bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(r.text).width;
  label(ctx, r.text, x, y, { color: r.color, bold: r.bold, size: w > width ? Math.max(8, (size * width) / w) : size });
}

// Text with a halo so it stays readable over the grid and the curve.
function tag(ctx, text, x, y, color, align, size) {
  ctx.save();
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.bg;
  ctx.strokeText(text, x, y);
  ctx.restore();
  label(ctx, text, x, y, { color, align, size, bold: true });
}

const niceStep = raw => {
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
};

// Graph of y = ax² + bx + c in rectangle R, windowed around the marked points and the vertex.
// The two axes have different scales; the tick numbers say so.
function plot(ctx, R, q, marks, names, small, axisOfSymmetry) {
  const f = x => q.a * x * x + q.b * x + q.c;
  const xs = [0, ...marks.map(m => m.x)];
  if (q.a !== 0) xs.push(-q.b / (2 * q.a));
  let lo = Math.min(...xs);
  let hi = Math.max(...xs);
  if (hi - lo < 4) [lo, hi] = [(lo + hi) / 2 - 2, (lo + hi) / 2 + 2];
  const x0 = lo - 0.3 * (hi - lo);
  const x1 = hi + 0.3 * (hi - lo);
  let y0 = 0;
  let y1 = 0;
  for (let i = 0; i <= 80; i++) {
    const y = f(x0 + ((x1 - x0) * i) / 80);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  if (y1 - y0 < 1e-9) [y0, y1] = [-1, 1];
  const pad = 0.12 * (y1 - y0);
  y0 -= pad;
  y1 += pad;
  // labels under the axis (the learner's u and v) need room below it
  const room = small ? 36 : 44;
  if (marks.some(m => m.below) && R.h > 2 * room) y0 = Math.min(y0, (-y1 * room) / (R.h - room));
  const sx = x => R.x + ((x - x0) / (x1 - x0)) * R.w;
  const sy = y => R.y + R.h - ((y - y0) / (y1 - y0)) * R.h;
  const size = small ? 10 : 12;

  ctx.save();
  ctx.beginPath();
  ctx.rect(R.x, R.y, R.w, R.h);
  ctx.clip();
  ctx.fillStyle = "#fff";
  ctx.fillRect(R.x, R.y, R.w, R.h);
  // grid and tick numbers
  const ax = clamp(sx(0), R.x, R.x + R.w);
  const ay = clamp(sy(0), R.y, R.y + R.h);
  const dx = niceStep((x1 - x0) / Math.max(2, R.w / 56));
  const dy = niceStep((y1 - y0) / Math.max(2, R.h / 36));
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.ceil(x0 / dx) * dx; x <= x1; x += dx) {
    ctx.moveTo(sx(x), R.y);
    ctx.lineTo(sx(x), R.y + R.h);
  }
  for (let y = Math.ceil(y0 / dy) * dy; y <= y1; y += dy) {
    ctx.moveTo(R.x, sy(y));
    ctx.lineTo(R.x + R.w, sy(y));
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(R.x, ay);
  ctx.lineTo(R.x + R.w, ay);
  ctx.moveTo(ax, R.y);
  ctx.lineTo(ax, R.y + R.h);
  ctx.stroke();
  const below = ay + 12 < R.y + R.h - 2 ? ay + 10 : ay - 10;
  for (let x = Math.ceil(x0 / dx) * dx; x <= x1; x += dx) {
    if (Math.abs(x) > dx / 2) label(ctx, n(x), sx(x), below, { size, align: "center", color: COLORS.muted });
  }
  for (let y = Math.ceil(y0 / dy) * dy; y <= y1; y += dy) {
    if (Math.abs(y) > dy / 2) label(ctx, n(y), ax - 5 > R.x + 24 ? ax - 5 : ax + 5, sy(y), { size, align: ax - 5 > R.x + 24 ? "right" : "left", color: COLORS.muted });
  }
  label(ctx, names[0], R.x + R.w - 6, ay - 10 > R.y + 4 ? ay - 10 : ay + 10, { size: size + 1, align: "right", bold: true, color: COLORS.muted });
  label(ctx, "y", ax + 8, R.y + 9, { size: size + 1, bold: true, color: COLORS.muted });

  if (axisOfSymmetry != null) {
    ctx.strokeStyle = COLORS.purple;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(sx(axisOfSymmetry), R.y);
    ctx.lineTo(sx(axisOfSymmetry), R.y + R.h);
    ctx.stroke();
    ctx.setLineDash([]);
    tag(ctx, `x = S/2 = ${n(axisOfSymmetry)}`, sx(axisOfSymmetry) + 6, R.y + 28, COLORS.purple, "left", size);
  }

  // the curve
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const x = x0 + ((x1 - x0) * i) / 200;
    ctx[i ? "lineTo" : "moveTo"](sx(x), sy(f(x)));
  }
  ctx.stroke();

  // marked points on the horizontal axis
  marks.forEach(m => {
    const others = marks.filter(o => o.below === m.below && o !== m);
    const left = others.length && m.x <= Math.min(...others.map(o => o.x));
    const right = others.length && !left && m.x >= Math.max(...others.map(o => o.x));
    if (m.drop) {
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx(m.x), ay);
      ctx.lineTo(sx(m.x), sy(f(m.x)));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = m.color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(m.x), ay, small ? 4.5 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const tx = clamp(sx(m.x) + (left ? -9 : right ? 9 : 0), R.x + 4, R.x + R.w - 4);
    tag(ctx, m.text, tx, ay + (m.below ? (small ? 22 : 27) : -(small ? 13 : 16)), m.color, left ? "right" : right ? "left" : "center", size + 1);
  });
  tag(ctx, `${names[1]} = ${poly(q.a, q.b, q.c, names[0])}`, ax < R.x + R.w / 2 ? R.x + R.w - 8 : R.x + 8, R.y + (ay > R.y + R.h / 2 ? 12 : R.h - 12), COLORS.blue, ax < R.x + R.w / 2 ? "right" : "left", size + 1);
  ctx.restore();
  ctx.strokeStyle = COLORS.grid;
  ctx.strokeRect(R.x, R.y, R.w, R.h);
}

// One result per committed coefficient. Keys that do not exist for this equation are left out.
const report = (s, api) => {
  const r = solve(s.a, s.b, s.c);
  const vt = viete(s.a, s.b, s.c);
  const data = { a: s.a, b: s.b, c: s.c, rootCount: r.rootCount, ...(r.type === "quadratic" && { delta: r.delta }), ...(vt && { sum: vt.sum, product: vt.product }) };
  api.emit("equation-solved", data, "result");
};

// The goal is reported when the learner's own adjustment of u or v makes both conditions true.
const check = (s, api) => {
  if (!isMatch(s)) return;
  const data = { sum: s.sum, product: s.product, u: s.u, v: s.v };
  api.emit("two-numbers-found", data, "goal");
};

const solving = s => s.mode !== "reverse";
const reverse = s => s.mode === "reverse";
const signed = v => n(v);

mount({
  slug: "phuong-trinh-bac-hai-viet",
  version: "1.0.0",
  title: "Phương trình bậc hai và hệ thức Vi-ét",
  hint: "Chọn nội dung, đổi các hệ số a, b, c và đọc từng bước giải. Ở phần tìm hai số, chỉnh u và v cho đúng tổng và tích.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Nội dung",
      options: [
        { value: "delta", label: "Công thức nghiệm (Δ)" },
        { value: "deltaPrime", label: "Công thức nghiệm thu gọn (Δ′)" },
        { value: "viete", label: "Hệ thức Vi-ét và nhẩm nghiệm" },
        { value: "reverse", label: "Tìm hai số biết tổng và tích" },
      ],
    },
    { type: "stepper", key: "a", label: "Hệ số a", min: -9, max: 9, format: signed, visible: solving, onCommit: report },
    { type: "stepper", key: "b", label: "Hệ số b", min: -9, max: 9, format: signed, visible: solving, onCommit: report },
    { type: "stepper", key: "c", label: "Hệ số c", min: -9, max: 9, format: signed, visible: solving, onCommit: report },
    { type: "slider", key: "sum", label: "Tổng S = u + v", min: -12, max: 12, step: 1, digits: 0, visible: reverse },
    { type: "slider", key: "product", label: "Tích P = u·v", min: -36, max: 36, step: 1, digits: 0, visible: reverse },
    { type: "stepper", key: "u", label: "Số thứ nhất u", min: -15, max: 15, format: signed, visible: reverse, onCommit: check },
    { type: "stepper", key: "v", label: "Số thứ hai v", min: -15, max: 15, format: signed, visible: reverse, onCommit: check },
    { type: "checkbox", key: "showAnswer", label: "Hiện đáp án", visible: reverse },
    {
      type: "button",
      label: "Đề mới",
      visible: reverse,
      event: "new-problem",
      eventKind: "action",
      action(s) {
        Object.assign(s, newProblem(), { u: 0, v: 0, showAnswer: false });
      },
    },
  ],
  readouts: [
    {
      label: "Biệt thức Δ",
      value: s => {
        const q = equation(s);
        return q.a === 0 ? "–" : n(solve(q.a, q.b, q.c).delta);
      },
    },
    {
      label: "Số nghiệm",
      value: s => {
        const q = equation(s);
        const r = solve(q.a, q.b, q.c);
        if (r.rootCount === 2) return "2 nghiệm phân biệt";
        if (r.rootCount === 1) return r.type === "quadratic" ? "nghiệm kép" : "1 nghiệm";
        return r.rootCount === 0 ? "vô nghiệm" : "vô số nghiệm";
      },
    },
    {
      label: "Tổng hai nghiệm S = −b/a",
      value: s => {
        const q = equation(s);
        const vt = viete(q.a, q.b, q.c);
        return vt ? n(vt.sum) : "–";
      },
    },
    {
      label: "Tích hai nghiệm P = c/a",
      value: s => {
        const q = equation(s);
        const vt = viete(q.a, q.b, q.c);
        return vt ? n(vt.product) : "–";
      },
    },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 430;
    const size = small ? 12 : 16;
    const lh = small ? 17 : 27;
    const padX = small ? 10 : 22;
    let y = small ? 13 : 26;
    for (const r of steps(s)) {
      line(ctx, r, padX, y, view.w - 2 * padX, r.bold ? size + 1 : size);
      y += lh;
    }
    const R = { x: padX, y: y - lh / 2 + 4, w: view.w - 2 * padX, h: view.h - (y - lh / 2 + 4) - (small ? 6 : 16) };
    if (R.h < 50) return;
    const q = equation(s);
    const r = solve(q.a, q.b, q.c);
    let marks;
    if (reverse(s)) {
      marks = [
        { x: s.u, color: COLORS.orange, text: `u = ${n(s.u)}`, below: true, drop: true },
        { x: s.v, color: COLORS.orange, text: `v = ${n(s.v)}`, below: true, drop: true },
      ];
      if (s.u === s.v) marks = [{ ...marks[0], text: `u = v = ${n(s.u)}` }];
      if (s.showAnswer) marks.push(...r.roots.map(x => ({ x, color: COLORS.red, text: n(x) })));
    } else {
      const names = r.rootCount === 1 ? [r.type === "quadratic" ? "x₁ = x₂" : "x"] : ["x₁", "x₂"];
      marks = r.roots.map((x, i) => ({ x, color: COLORS.red, text: `${names[i]} ${eqv(x)}` }));
    }
    const vt = s.mode === "viete" ? viete(q.a, q.b, q.c) : null;
    plot(ctx, R, q, marks, reverse(s) ? ["X", "y"] : ["x", "y"], small, vt ? vt.sum / 2 : null);
  },
});
