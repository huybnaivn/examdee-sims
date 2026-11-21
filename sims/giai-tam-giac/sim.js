import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, solve, INPUTS, CASES } from "./model.js";

const NAMES = { SSS: "c.c.c", SAS: "c.g.c", ASA: "g.c.g", SSA: "c.c.g" };
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const rad = d => (d * Math.PI) / 180;
const isAngle = k => k === k.toUpperCase();
const given = s => INPUTS[s.mode].map(k => `${k} = ${fmt(s[k], 1)}${isAngle(k) ? "°" : ""}`).join(", ");
const chosen = (s, r = solve(s)) => {
  return r.solutions[Math.min(s.pick, r.solutions.length) - 1];
};

// One result per finished change.
const report = (s, api) => {
  const r = solve(s);
  const t = chosen(s, r);
  api.emit("triangle-solved", { caseCode: CASES.indexOf(s.mode) + 1, solutions: r.solutions.length, area: t ? t.S : 0, ...(t && { a: t.a, b: t.b, c: t.c }) }, "result");
};

// Text that shrinks until it fits `w` px.
function fit(ctx, text, x, y, w, { size = 14, min = 9, ...opt } = {}) {
  ctx.font = `${opt.bold ? "600 " : ""}${size}px ${FONT}`;
  while (size > min && ctx.measureText(text).width > w) ctx.font = `${opt.bold ? "600 " : ""}${--size}px ${FONT}`;
  label(ctx, text, x, y, { size, ...opt });
}

// A at the origin, C on the positive x axis (AC = b), B above it at angle A. Units are cm, y up.
const vertices = t => ({ A: [0, 0], C: [t.b, 0], B: [t.c * Math.cos(rad(t.A)), t.c * Math.sin(rad(t.A))] });

function circumcenter({ A, B, C }) {
  const d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
  const sq = p => p[0] * p[0] + p[1] * p[1];
  return [
    (sq(A) * (B[1] - C[1]) + sq(B) * (C[1] - A[1]) + sq(C) * (A[1] - B[1])) / d,
    (sq(A) * (C[0] - B[0]) + sq(B) * (A[0] - C[0]) + sq(C) * (B[0] - A[0])) / d,
  ];
}

mount({
  slug: "giai-tam-giac",
  version: "1.0.0",
  title: "Định lí côsin, định lí sin và giải tam giác",
  hint: "Chọn ba yếu tố đã biết rồi kéo các thanh trượt. Tam giác được giải từng bước và vẽ đúng tỉ lệ.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Ba yếu tố đã biết",
      options: [
        { value: "SSS", label: "Ba cạnh a, b, c (c.c.c)" },
        { value: "SAS", label: "Hai cạnh b, c và góc xen giữa A (c.g.c)" },
        { value: "ASA", label: "Cạnh a và hai góc kề B, C (g.c.g)" },
        { value: "SSA", label: "Hai cạnh a, b và góc A đối diện a (c.c.g)" },
      ],
      onChange: s => (s.pick = 1),
    },
    ...["a", "b", "c"].map(k => ({ type: "slider", key: k, label: `Cạnh ${k}`, min: 1, max: 12, step: 0.5, unit: "cm", digits: 1, visible: s => INPUTS[s.mode].includes(k) })),
    ...["A", "B", "C"].map(k => ({ type: "slider", key: k, label: `Góc ${k}`, min: 5, max: 175, step: 1, unit: "°", digits: 0, format: v => `${fmt(v, 0)}°`, visible: s => INPUTS[s.mode].includes(k) })),
    {
      type: "select",
      key: "pick",
      label: "Có hai tam giác, vẽ đậm",
      options: [
        { value: 1, label: "Tam giác thứ nhất (B nhọn)" },
        { value: 2, label: "Tam giác thứ hai (B tù)" },
      ],
      visible: s => solve(s).solutions.length === 2,
    },
    { type: "checkbox", key: "circle", label: "Vẽ đường tròn ngoại tiếp" },
  ].map(c => ({ ...c, onCommit: report })),
  readouts: [
    { label: "Số tam giác", value: s => String(solve(s).solutions.length) },
    { label: "a, b, c (cm)", value: s => (chosen(s) ? ["a", "b", "c"].map(k => fmt(chosen(s)[k])).join("; ") : "–") },
    { label: "A, B, C", value: s => (chosen(s) ? ["A", "B", "C"].map(k => `${fmt(chosen(s)[k], 1)}°`).join("; ") : "–") },
    { label: "Diện tích S", value: s => (chosen(s) ? `${fmt(chosen(s).S, 3)} cm²` : "–") },
    { label: "Bán kính ngoại tiếp R", value: s => (chosen(s) ? `${fmt(chosen(s).R, 3)} cm` : "–") },
    { label: "Bán kính nội tiếp r", value: s => (chosen(s) ? `${fmt(chosen(s).r, 3)} cm` : "–") },
  ],
  draw(ctx, s, view) {
    const r = solve(s);
    const t = chosen(s, r);
    const other = r.solutions.find(x => x !== t);
    const small = view.w < 560 || view.h < 430;
    const wide = view.w >= 760;
    const pad = small ? 10 : 18;
    const size = small ? 12 : 14;
    const lineH = small ? 15 : 21;

    // Text block: given, steps, then area and radii.
    const lines = [{ text: `Cho (${NAMES[s.mode]}): ${given(s)}`, bold: true }];
    for (const st of r.steps ?? []) lines.push({ rule: st.rule, text: st.text });
    if (r.error) lines.push({ text: r.error, color: COLORS.red, bold: true });
    if (t) {
      if (r.solutions.length === 2) lines.push({ text: `Tam giác thứ ${s.pick}: B ≈ ${fmt(t.B, 1)}°, C ≈ ${fmt(t.C, 1)}°, c ≈ ${fmt(t.c)}`, color: COLORS.blue, bold: true });
      lines.push(
        { rule: "Diện tích", text: `S = ½ab·sin C ≈ ${fmt(t.S, 3)} cm²` },
        { rule: "Hê-rông", text: `p = ${fmt(t.p, 3)}; S = √(p(p − a)(p − b)(p − c)) ≈ ${fmt(t.heron, 3)} cm²` },
        { rule: "Định lí sin", text: `R = a/(2sin A) ≈ ${fmt(t.R, 3)} cm;  r = S/p ≈ ${fmt(t.r, 3)} cm` }
      );
    }

    // Wide: text on the right. Otherwise text under the figure, as many lines as leave the figure ≥ 120 px.
    let fig;
    let box;
    if (wide) {
      const tw = Math.min(430, view.w * 0.46);
      box = { x: view.w - tw - pad, y: pad + 10, w: tw, n: lines.length };
      fig = { x: pad, y: pad, w: view.w - tw - 3 * pad, h: view.h - 2 * pad - 18 };
    } else {
      const n = Math.max(1, Math.min(lines.length, Math.floor((view.h - 2 * pad - 18 - (small ? 150 : 200)) / lineH)));
      box = { x: pad, y: view.h - pad - 18 - n * lineH + lineH / 2, w: view.w - 2 * pad, n };
      fig = { x: pad, y: pad, w: view.w - 2 * pad, h: view.h - 2 * pad - 18 - n * lineH - 6 };
    }
    const ruleW = small ? 0 : 98;
    lines.slice(0, box.n).forEach((ln, i) => {
      const y = box.y + i * lineH;
      if (ln.rule && ruleW) label(ctx, ln.rule, box.x, y, { size: size - 2, color: COLORS.purple, bold: true });
      const text = ln.rule && !ruleW ? `${ln.rule}: ${ln.text}` : ln.text;
      const x = ln.rule ? box.x + ruleW : box.x;
      fit(ctx, text, x, y, box.w - (x - box.x), { size, color: ln.color ?? COLORS.ink, bold: ln.bold });
    });
    label(ctx, "Hình vẽ đúng tỉ lệ. Cam: yếu tố đã cho; xanh: yếu tố tính được.", pad, view.h - pad, { size: small ? 10 : 12, color: COLORS.muted });

    // Figure: chosen triangle solid, the other SSA triangle dashed; for SSA the ray Ax and the arc (C; a).
    const tris = r.solutions.map(vertices);
    const pts = tris.flatMap(v => [v.A, v.B, v.C]);
    const ssa = s.mode === "SSA";
    const rayLen = Math.max(s.b, ...r.solutions.map(x => x.c)) * 1.15;
    const ray = [rayLen * Math.cos(rad(s.A)), rayLen * Math.sin(rad(s.A))];
    if (ssa) pts.push([0, 0], [s.b, 0], ray, [s.b - s.a, 0], [s.b + s.a, 0], [s.b, s.a]);
    const cc = t && s.circle ? circumcenter(vertices(t)) : null;
    if (cc) pts.push([cc[0] - t.R, cc[1] - t.R], [cc[0] + t.R, cc[1] + t.R]);
    if (!pts.length) {
      label(ctx, "Không vẽ được tam giác", fig.x + fig.w / 2, fig.y + fig.h / 2, { align: "center", color: COLORS.red, size: size + 2, bold: true });
      return;
    }
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const m = small ? 22 : 32; // room for labels
    const k = Math.min((fig.w - 2 * m) / Math.max(x1 - x0, 1e-6), (fig.h - 2 * m) / Math.max(y1 - y0, 1e-6));
    const ox = fig.x + fig.w / 2 - ((x0 + x1) / 2) * k;
    const oy = fig.y + fig.h / 2 + ((y0 + y1) / 2) * k;
    const P = p => [ox + p[0] * k, oy - p[1] * k];

    const line = (a, b, color, width = 2, dash = []) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(...P(a));
      ctx.lineTo(...P(b));
      ctx.stroke();
      ctx.restore();
    };

    if (ssa) {
      line([0, 0], ray, COLORS.muted, 1.5, [5, 5]);
      ctx.save();
      ctx.strokeStyle = COLORS.orange;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(...P([s.b, 0]), s.a * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (!t) line([0, 0], [s.b, 0], COLORS.orange, 3);
    }
    if (cc) {
      ctx.save();
      ctx.strokeStyle = COLORS.purple;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(...P(cc), t.R * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.purple;
      ctx.beginPath();
      ctx.arc(...P(cc), 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      label(ctx, "O", P(cc)[0] + 6, P(cc)[1] - 8, { color: COLORS.purple, size, bold: true });
    }
    if (other) {
      const v = vertices(other);
      line(v.C, v.B, COLORS.muted, 1.5, [6, 5]);
      label(ctx, "B'", P(v.B)[0] + 8, P(v.B)[1] - 10, { color: COLORS.muted, size, bold: true });
    }
    if (!t) {
      label(ctx, "Không có tam giác", fig.x + fig.w / 2, fig.y + 14, { align: "center", color: COLORS.red, size, bold: true });
      label(ctx, "A", P([0, 0])[0] - 12, P([0, 0])[1] + 4, { size, bold: true });
      label(ctx, "C", P([s.b, 0])[0] + 6, P([s.b, 0])[1] + 12, { size, bold: true });
      return;
    }

    const v = vertices(t);
    const given3 = INPUTS[s.mode];
    const col = key => (given3.includes(key) ? COLORS.orange : COLORS.blue);
    ctx.fillStyle = "rgba(47, 111, 237, 0.08)";
    ctx.beginPath();
    [v.A, v.B, v.C].forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))));
    ctx.fill();
    // sides: a = BC, b = CA, c = AB
    const sides = [["a", v.B, v.C], ["b", v.C, v.A], ["c", v.A, v.B]];
    const centroid = P([(v.A[0] + v.B[0] + v.C[0]) / 3, (v.A[1] + v.B[1] + v.C[1]) / 3]);
    for (const [key, p, q] of sides) {
      line(p, q, col(key), given3.includes(key) ? 3.5 : 2.5);
      const [mx, my] = P([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
      const d = Math.hypot(mx - centroid[0], my - centroid[1]) || 1;
      const off = small ? 14 : 20;
      const text = `${key} ${given3.includes(key) ? "=" : "≈"} ${fmt(t[key], given3.includes(key) ? 1 : 2)}`;
      label(ctx, text, mx + ((mx - centroid[0]) / d) * off, my + ((my - centroid[1]) / d) * off, { color: col(key), size, bold: true, align: "center" });
    }
    // angles; values are left out of narrow corners on a small figure
    const minSide = Math.min(t.a, t.b, t.c) * k;
    for (const key of ["A", "B", "C"]) {
      const [px, py] = P(v[key]);
      const others = ["A", "B", "C"].filter(x => x !== key).map(x => P(v[x]));
      const a1 = Math.atan2(others[0][1] - py, others[0][0] - px);
      const a2 = Math.atan2(others[1][1] - py, others[1][0] - px);
      let start = a1;
      let sweep = a2 - a1;
      while (sweep > Math.PI) sweep -= 2 * Math.PI;
      while (sweep < -Math.PI) sweep += 2 * Math.PI;
      if (sweep < 0) [start, sweep] = [a2, -sweep];
      const rr = small ? 16 : 22;
      ctx.strokeStyle = col(key);
      ctx.lineWidth = given3.includes(key) ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(px, py, rr, start, start + sweep);
      ctx.stroke();
      // vertex name outside, angle value inside along the bisector
      const mid = start + sweep / 2;
      const d = Math.hypot(px - centroid[0], py - centroid[1]) || 1;
      label(ctx, key, px + ((px - centroid[0]) / d) * 14, py + ((py - centroid[1]) / d) * 14, { size: size + 1, bold: true, align: "center" });
      if (minSide > 60 || (!small && t[key] > 40)) {
        const vr = rr + (small ? 8 : 12) + (small ? 9 : 12) / Math.max(Math.sin(rad(t[key]) / 2), 0.25);
        label(ctx, `${fmt(t[key], given3.includes(key) ? 0 : 1)}°`, px + Math.cos(mid) * vr, py + Math.sin(mid) * vr, { size: size - 1, color: col(key), bold: true, align: "center" });
      }
    }
  },
});
