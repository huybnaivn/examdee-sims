import { mount, COLORS, label } from "../../kit/v1/kit.js";
import {
  LIMIT, SIEVE, sieveAt, initialState, tidy, step, answer, classify, isPrime,
  factorize, factorTree, divisors, gcd, lcm, euclidSteps, viaFactors,
} from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const BY_COLOR = { 2: COLORS.blue, 3: COLORS.green, 5: COLORS.orange, 7: COLORS.purple };
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = k => String(k).replace(/\d/g, d => SUP[d]);
// textbook notation: 2³ · 3² · 5 (integers written without thousands separators, as in grade 6)
const power = ([p, k]) => (k > 1 ? `${p}${sup(k)}` : `${p}`);
const formula = f => (f.length ? f.map(power).join(" · ") : "1");
const set = xs => `{${xs.join("; ")}}`;

const reportGcd = (s, api) =>
  api.emit("gcd-lcm", { a: s.a, b: s.b, gcd: gcd(s.a, s.b), lcm: lcm(s.a, s.b) }, "result");
const reportFactor = (s, api) => {
  const f = factorize(s.n);
  api.emit("factorized", { n: s.n, distinctPrimes: f.length, primeFactors: f.reduce((a, [, k]) => a + k, 0) }, "result");
};
const finishSieve = api => api.emit("sieve-finished", { primes: sieveAt(SIEVE.length).primes, limit: LIMIT }, "result");
const KIND_CODE = { neither: 0, prime: 1, composite: 2 };
const reply = kind => (s, api) => {
  const n = s.quizN;
  const right = answer(s, kind);
  api.emit("quiz-answer", { n, answer: KIND_CODE[kind], correct: right ? 1 : 0 }, "action");
  if (right) api.emit("quiz-correct", { n, kind: KIND_CODE[kind], score: s.quizScore, total: s.quizTotal }, "goal");
};

/** Draw tokens left to right, wrapping between tokens; returns the y of the next line. */
function tokens(ctx, parts, x, y, maxW, size, lh) {
  let cx = x;
  // break every part into words so a long line wraps between words
  for (const p of parts.flatMap(q => q.t.split(/(?<= )/).map(t => ({ ...q, t })))) {
    ctx.font = `${p.bold ? "600 " : ""}${size}px ${FONT}`;
    const w = ctx.measureText(p.t).width;
    if (cx > x && cx + w > x + maxW) (cx = x), (y += lh);
    label(ctx, p.t, cx, y, { size, color: p.color ?? COLORS.ink, bold: p.bold });
    cx += w;
  }
  return y + lh;
}
const T = (t, color, bold) => ({ t, color, bold });
const listTokens = (xs, hot, color = COLORS.green) =>
  [T("{")].concat(xs.map((v, i) => T(`${v}${i < xs.length - 1 ? "; " : ""}`, hot(v) ? color : COLORS.ink, hot(v))), [T("}")]);

// ---------- sieve ----------
function drawSieve(ctx, s, view, small) {
  const g = sieveAt(s.sieveIndex);
  const size = small ? 12 : 15;
  const op = g.last;
  const head = !op
    ? "Bảng các số từ 1 đến 100. Bấm ▶ Chạy để sàng."
    : g.done
      ? `11² = 121 > 100, nên các số còn lại đều là số nguyên tố: có ${g.primes} số.`
      : op.type === "one"
        ? "Gạch bỏ 1: số 1 không là số nguyên tố, cũng không là hợp số."
        : op.type === "prime"
          ? `Giữ lại ${op.n} (số nguyên tố), gạch bỏ các bội khác của ${op.n}.`
          : `Gạch bỏ ${op.n} = ${op.by} · ${op.n / op.by} (bội của ${op.by}).`;
  const headEnd = tokens(ctx, [T(head, COLORS.ink, true)], 10, small ? 12 : 20, view.w - 20, size, size + 4);
  const legendH = small ? 0 : 30;
  const top = Math.max(small ? 26 : 40, headEnd - size / 2);
  const cell = Math.floor(Math.min((view.w - 20) / 10, (view.h - top - legendH - 8) / 10));
  const x0 = (view.w - cell * 10) / 2;
  const fs = Math.max(10, Math.min(18, cell * 0.42));
  for (let n = 1; n <= LIMIT; n++) {
    const x = x0 + ((n - 1) % 10) * cell;
    const y = top + Math.floor((n - 1) / 10) * cell;
    const st = g.status[n];
    ctx.fillStyle = st === 1 ? "#eef1f6" : "#fff";
    ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    if (op && op.n === n && !g.done) {
      ctx.strokeStyle = COLORS.yellow;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
    }
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    if (st === 2) {
      ctx.strokeStyle = n === g.current ? COLORS.red : BY_COLOR[n] ?? COLORS.red;
      ctx.lineWidth = n === g.current ? 3 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.38, 0, Math.PI * 2);
      ctx.stroke();
    }
    label(ctx, String(n), cx, cy, { size: fs, align: "center", bold: st === 2, color: st === 1 ? COLORS.muted : COLORS.ink });
    if (st === 1) {
      ctx.strokeStyle = BY_COLOR[g.by[n]] ?? COLORS.muted;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + cell * 0.2, y + cell * 0.8);
      ctx.lineTo(x + cell * 0.8, y + cell * 0.2);
      ctx.stroke();
    }
  }
  if (!small) {
    let lx = x0;
    const ly = top + cell * 10 + 18;
    for (const p of [2, 3, 5, 7]) {
      ctx.strokeStyle = BY_COLOR[p];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, ly + 6);
      ctx.lineTo(lx + 12, ly - 6);
      ctx.stroke();
      label(ctx, `bội của ${p}`, lx + 18, ly, { size: 12, color: COLORS.muted });
      lx += 92;
    }
    label(ctx, "○ số nguyên tố", lx, ly, { size: 12, color: COLORS.muted });
  }
}

// ---------- factor tree ----------
function drawFactor(ctx, s, view, small) {
  const t = factorTree(s.n);
  const f = factorize(s.n);
  const size = small ? 12 : 15;
  let leaves = 0;
  let depth = 0;
  const place = (node, d) => {
    depth = Math.max(depth, d);
    if (node.kids) {
      node.kids.forEach(k => place(k, d + 1));
      node.slot = (node.kids[0].slot + node.kids[1].slot) / 2;
    } else node.slot = leaves++;
    node.d = d;
  };
  place(t, 0);
  const top = small ? 30 : 50;
  const bottom = small ? 46 : 70;
  const levelH = Math.min(small ? 50 : 100, (view.h - top - bottom) / Math.max(1, depth));
  const slotW = Math.min(small ? 46 : 70, (view.w - 20) / leaves);
  const left = (view.w - slotW * leaves) / 2 + slotW / 2;
  const pos = node => [left + node.slot * slotW, top + node.d * levelH];
  const fs = Math.max(11, Math.min(size + 2, slotW * 0.4, levelH * 0.4));
  const r = fs * 0.95;
  label(ctx, small ? "Sơ đồ cây: tách thành hai thừa số" : "Sơ đồ cây: tách mỗi hợp số thành tích hai thừa số, dừng ở số nguyên tố", 10, small ? 12 : 20, { size, bold: true });
  const edges = node => {
    if (!node.kids) return;
    const [x, y] = pos(node);
    for (const k of node.kids) {
      const [kx, ky] = pos(k);
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.lineTo(kx, ky - r);
      ctx.stroke();
      edges(k);
    }
  };
  edges(t);
  const nodes = node => {
    const [x, y] = pos(node);
    const prime = !node.kids && node.n > 1;
    if (prime) {
      ctx.fillStyle = "#fff3e3";
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.font = `600 ${fs}px ${FONT}`;
      const w = ctx.measureText(String(node.n)).width + 10;
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(x - w / 2, y - r, w, 2 * r);
    }
    label(ctx, String(node.n), x, y, { size: prime && node.n > 99 ? fs * 0.8 : fs, align: "center", bold: true, color: prime ? COLORS.orange : COLORS.ink });
    node.kids?.forEach(nodes);
  };
  nodes(t);
  const y = view.h - bottom / 2;
  const text = isPrime(s.n)
    ? `${s.n} là số nguyên tố: chỉ có hai ước là 1 và ${s.n}`
    : `${s.n} = ${formula(f)}`;
  label(ctx, text, view.w / 2, y, { size: size + 3, bold: true, align: "center", color: COLORS.ink });
  if (!small) label(ctx, "Số trong vòng tròn là số nguyên tố", view.w / 2, y + 24, { size: 12, align: "center", color: COLORS.muted });
}

// ---------- ƯCLN and BCNN ----------
function drawGcd(ctx, s, view, small) {
  const { a, b } = s;
  const g = gcd(a, b);
  const l = lcm(a, b);
  const size = small ? 12 : 15;
  const x = 10;
  const maxW = view.w - 20;
  const muted = COLORS.muted;
  let lines; // arrays of tokens
  if (s.method === "factors") {
    const v = viaFactors(a, b);
    const common = v.gcd.map(([p]) => p);
    const all = v.lcm.map(([p]) => p);
    lines = [
      [T(`a = ${a} = ${formula(factorize(a))}`, COLORS.ink, true)],
      [T(`b = ${b} = ${formula(factorize(b))}`, COLORS.ink, true)],
      [T(common.length ? `Thừa số nguyên tố chung: ${common.join(", ")}; lấy số mũ nhỏ nhất` : "Không có thừa số nguyên tố chung", muted)],
      [T(`ƯCLN(${a}, ${b}) = ${common.length ? formula(v.gcd) + " = " : ""}${g}`, COLORS.green, true)],
      [T(all.length ? `Thừa số chung và riêng: ${all.join(", ")}; lấy số mũ lớn nhất` : "Không có thừa số nguyên tố nào", muted)],
      [T(`BCNN(${a}, ${b}) = ${all.length ? formula(v.lcm) + " = " : ""}${l}`, COLORS.blue, true)],
    ];
  } else if (s.method === "list") {
    const da = divisors(a);
    const db = divisors(b);
    const common = da.filter(d => b % d === 0);
    // nonzero multiples up to BCNN; long lists keep the start and the end
    const mult = n => {
      const k = l / n;
      const xs = Array.from({ length: k }, (_, i) => (i + 1) * n);
      return k <= (small ? 8 : 14) ? [0, ...xs, "…"] : [0, ...xs.slice(0, small ? 3 : 5), "…", l, "…"];
    };
    const isL = v => v === l || v === 0;
    lines = [
      [T(`Ư(${a}) = `), ...listTokens(da, d => b % d === 0)],
      [T(`Ư(${b}) = `), ...listTokens(db, d => a % d === 0)],
      [T(`ƯC(${a}, ${b}) = ${set(common)}  ⇒  `), T(`ƯCLN = ${g}`, COLORS.green, true)],
      [T(`B(${a}) = `), ...listTokens(mult(a), isL, COLORS.blue)],
      [T(`B(${b}) = `), ...listTokens(mult(b), isL, COLORS.blue)],
      [T(`BC(${a}, ${b}) = {0; ${l}; ${2 * l}; …}  ⇒  `), T(`BCNN = ${l}`, COLORS.blue, true)],
      [T("BCNN là số nhỏ nhất khác 0 trong tập hợp các bội chung.", muted)],
    ];
  } else {
    const steps = euclidSteps(a, b);
    lines = [
      [T("Chia số lớn cho số nhỏ; rồi chia số chia cho số dư, đến khi số dư bằng 0.", muted)],
      ...steps.map(([x1, y1, q, r]) => [T(`${x1} = ${y1} · ${q} + `), T(String(r), r ? COLORS.ink : COLORS.red, true)]),
      [T(`Số dư cuối cùng khác 0 là ${g}  ⇒  `), T(`ƯCLN(${a}, ${b}) = ${g}`, COLORS.green, true)],
      [T(`BCNN = a · b : ƯCLN = ${a} · ${b} : ${g} = `), T(String(l), COLORS.blue, true)],
    ];
  }
  lines.push([T(`Kiểm tra: ƯCLN · BCNN = ${g} · ${l} = ${g * l} = a · b`, muted)]);
  const top = small ? 14 : 26;
  const lh = Math.max(13, Math.min(small ? 18 : 26, (view.h - top - 4) / (lines.length + 4.5)));
  let y = top;
  for (const line of lines) y = tokens(ctx, line, x, y, maxW, size, lh) + lh * 0.25;
  if (s.method === "factors" && view.h - y > 150) drawVenn(ctx, s, { x, y: y + 4, w: maxW, h: view.h - y - 8 }, small);
}

// Prime factors of a and b, the shared ones (least exponent) in the overlap.
function drawVenn(ctx, s, R, small) {
  const expand = f => f.flatMap(([p, k]) => Array(k).fill(p));
  const common = expand(viaFactors(s.a, s.b).gcd);
  const only = n => {
    const rest = expand(factorize(n));
    for (const p of common) rest.splice(rest.indexOf(p), 1);
    return rest;
  };
  const r = Math.min((R.h - 44) / 2, R.w / 3.3, 170);
  const cx = R.x + R.w / 2;
  const cy = R.y + 18 + r;
  const d = r * 0.6;
  const circles = [[cx - d, COLORS.orange, `a = ${s.a}`], [cx + d, COLORS.purple, `b = ${s.b}`]];
  for (const [x, color, name] of circles) {
    ctx.fillStyle = color + "1a";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(ctx, name, x, cy - r - 10, { size: small ? 12 : 14, bold: true, align: "center", color });
  }
  const fs = Math.max(12, Math.min(20, r * 0.16));
  const region = (xs, x, w, color) => {
    if (!xs.length) return;
    const perRow = Math.max(1, Math.floor(w / (fs * 2.2)));
    const rows = Math.ceil(xs.length / perRow);
    xs.forEach((p, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, xs.length - row * perRow);
      const col = i % perRow;
      label(ctx, String(p), x + (col - (inRow - 1) / 2) * fs * 2.2, cy + (row - (rows - 1) / 2) * fs * 1.4, { size: fs, bold: true, align: "center", color });
    });
  };
  region(only(s.a), cx - d - r * 0.45, r * 0.75, COLORS.ink);
  region(common, cx, (r - d) * 1.6, COLORS.green);
  region(only(s.b), cx + d + r * 0.45, r * 0.75, COLORS.ink);
  const g = gcd(s.a, s.b);
  const text = small
    ? `Phần chung: ƯCLN = ${g}; tất cả: BCNN = ${lcm(s.a, s.b)}`
    : `Tích các thừa số ở phần chung là ƯCLN = ${g}; tích tất cả các thừa số là BCNN = ${lcm(s.a, s.b)}`;
  label(ctx, text, cx, cy + r + 16, { size: small ? 11 : 13, align: "center", color: COLORS.muted });
}

// ---------- quiz ----------
function drawQuiz(ctx, s, view, small) {
  const n = s.quizN;
  const cx = view.w / 2;
  const size = small ? 13 : 16;
  label(ctx, "Số nguyên tố, hợp số, hay không phải cả hai?", cx, small ? 16 : 30, { size, bold: true, align: "center" });
  label(ctx, String(n), cx, view.h * 0.36, { size: Math.min(110, view.h * 0.28), bold: true, align: "center", color: COLORS.blue });
  const y = view.h * 0.62;
  if (s.quizLast) {
    const kind = classify(n);
    const right = s.quizLast === kind;
    label(ctx, right ? "Đúng!" : "Chưa đúng.", cx, y, { size: size + 4, bold: true, align: "center", color: right ? COLORS.green : COLORS.red });
    const d = divisors(n);
    const why =
      kind === "neither"
        ? "1 chỉ có một ước là 1: không là số nguyên tố, cũng không là hợp số."
        : kind === "prime"
          ? `${n} là số nguyên tố: chỉ có hai ước là 1 và ${n}.`
          : `${n} = ${d[1]} · ${n / d[1]} là hợp số: có ${d.length} ước ${set(d)}.`;
    tokens(ctx, [T(why)], 10, y + (small ? 24 : 34), view.w - 20, small ? 12 : 15, small ? 16 : 20);
  } else {
    label(ctx, "Chọn câu trả lời ở bảng bên.", cx, y, { size, align: "center", color: COLORS.muted });
  }
  label(ctx, `Số câu đúng: ${s.quizScore}/${s.quizTotal}`, cx, view.h - (small ? 12 : 22), { size, align: "center", color: COLORS.muted });
}

const is = mode => s => s.mode === mode;
const answered = s => !!s.quizLast;

mount({
  slug: "uoc-boi-so-nguyen-to",
  version: "1.0.0",
  title: "Ước, bội, số nguyên tố, ƯCLN và BCNN",
  hint: "Sàng Ơ-ra-tô-xten tìm các số nguyên tố, phân tích một số ra thừa số nguyên tố, tìm ƯCLN và BCNN của hai số, rồi thử sức với câu đố.",
  initialState,
  sanitize(incoming, base) {
    const out = { ...base };
    for (const key of Object.keys(base)) {
      const v = incoming[key];
      if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) out[key] = v;
    }
    return tidy(out);
  },
  step(s, dt, api) {
    if (s.mode !== "sieve" || s.sieveIndex >= SIEVE.length) return api.pause();
    if (step(s, dt)) {
      api.pause();
      finishSieve(api);
    }
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Hoạt động",
      options: [
        { value: "sieve", label: "Sàng Ơ-ra-tô-xten (1 đến 100)" },
        { value: "factor", label: "Phân tích ra thừa số nguyên tố" },
        { value: "gcd", label: "Tìm ƯCLN và BCNN" },
        { value: "quiz", label: "Đố: số nguyên tố hay hợp số?" },
      ],
    },
    { type: "slider", key: "speed", label: "Tốc độ sàng", min: 1, max: 30, step: 1, unit: "bước/giây", digits: 0, visible: is("sieve") },
    {
      type: "button",
      label: "Sàng lại từ đầu",
      primary: true,
      visible: is("sieve"),
      event: "sieve-restart",
      action(s, api) {
        s.sieveIndex = 0;
        s._acc = 0;
        api.play();
      },
    },
    {
      type: "button",
      label: "Sàng xong ngay",
      visible: is("sieve"),
      disabled: s => s.sieveIndex >= SIEVE.length,
      action(s, api) {
        s.sieveIndex = SIEVE.length;
        api.pause();
        finishSieve(api);
      },
    },
    { type: "slider", key: "n", label: "Số cần phân tích", min: 2, max: 1000, step: 1, digits: 0, visible: is("factor"), onCommit: reportFactor },
    { type: "slider", key: "a", label: "Số a", min: 1, max: 300, step: 1, digits: 0, visible: is("gcd"), onCommit: reportGcd },
    { type: "slider", key: "b", label: "Số b", min: 1, max: 300, step: 1, digits: 0, visible: is("gcd"), onCommit: reportGcd },
    {
      type: "select",
      key: "method",
      label: "Cách tìm",
      visible: is("gcd"),
      options: [
        { value: "factors", label: "Phân tích ra thừa số nguyên tố" },
        { value: "list", label: "Liệt kê ước và bội" },
        { value: "euclid", label: "Thuật toán Ơ-clít (mở rộng)" },
      ],
    },
    { type: "button", label: "Số nguyên tố", visible: is("quiz"), disabled: answered, action: reply("prime") },
    { type: "button", label: "Hợp số", visible: is("quiz"), disabled: answered, action: reply("composite") },
    { type: "button", label: "Không là số nguyên tố, cũng không là hợp số", visible: is("quiz"), disabled: answered, action: reply("neither") },
    {
      type: "button",
      label: "Số khác",
      primary: true,
      visible: is("quiz"),
      event: "quiz-next",
      action(s) {
        let n = s.quizN;
        while (n === s.quizN) n = 1 + Math.floor(Math.random() * LIMIT);
        s.quizN = n;
        s.quizLast = "";
      },
    },
  ],
  readouts: [
    {
      label: "Kết quả",
      value: s =>
        s.mode === "sieve"
          ? `${sieveAt(s.sieveIndex).primes} số nguyên tố đã tìm`
          : s.mode === "factor"
            ? `${s.n} = ${formula(factorize(s.n))}`
            : s.mode === "gcd"
              ? `ƯCLN = ${gcd(s.a, s.b)}; BCNN = ${lcm(s.a, s.b)}`
              : `Đúng ${s.quizScore}/${s.quizTotal}`,
    },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 430;
    if (s.mode === "sieve") drawSieve(ctx, s, view, small);
    else if (s.mode === "factor") drawFactor(ctx, s, view, small);
    else if (s.mode === "gcd") drawGcd(ctx, s, view, small);
    else drawQuiz(ctx, s, view, small);
  },
});
