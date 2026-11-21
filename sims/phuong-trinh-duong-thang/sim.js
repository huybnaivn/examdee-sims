import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import {
  initialState, line1, line2, relation, angleBetween, distance, foot, generalText, parametricText, slopeText, slopeForm, num, LIMIT, VLIMIT,
} from "./model.js";

const HALF = LIMIT + 1;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const snap = (v, lim) => Math.max(-lim, Math.min(lim, Math.round(v * 2) / 2));
const vec = v => `(${num(v[0])}; ${num(v[1])})`;

// Draggable points: [state x key, state y key, name, base point for vectors, shown?]
const HANDLES = [
  ["x1", "y1", "A", null, () => true],
  ["x2", "y2", "B", null, s => s.mode === "two-points"],
  ["ux", "uy", "u", "A", s => s.mode === "point-direction"],
  ["nx", "ny", "n", "A", s => s.mode === "point-normal"],
  ["x3", "y3", "C", null, s => s.showSecond],
  ["x4", "y4", "D", null, s => s.showSecond],
  ["mx", "my", "M", null, s => s.showDistance],
];
const handlePos = (s, h) => (h[3] ? [s.x1 + s[h[0]], s.y1 + s[h[1]]] : [s[h[0]], s[h[1]]]);

function textLines(s) {
  const l1 = line1(s);
  const l2 = s.showSecond ? line2(s) : null;
  const out = [];
  if (!l1) {
    out.push([s.mode === "two-points" ? "A trùng B: chưa xác định được đường thẳng d₁" : "Vectơ bằng vectơ-không: chưa xác định được d₁", COLORS.red, true]);
  } else {
    const [px, py] = parametricText(l1);
    out.push([`d₁: u = ${vec(l1.u)}, n = ${vec(l1.n)}`, COLORS.muted, false]);
    out.push([`Tham số: ${px};  ${py}`, COLORS.blue, false]);
    out.push([`Tổng quát: ${generalText(l1)}`, COLORS.blue, true]);
    out.push([slopeForm(l1) ? `Hệ số góc: ${slopeText(l1)}  (k = ${num(slopeForm(l1).k)})` : `${slopeText(l1)}: d₁ song song Oy, không có hệ số góc`, COLORS.blue, false]);
  }
  if (s.showSecond) {
    if (!l2) out.push(["C trùng D: chưa xác định được d₂", COLORS.red, false]);
    else {
      out.push([`d₂: ${generalText(l2)}`, COLORS.green, true]);
      if (l1) {
        const r = relation(l1, l2);
        if (r.kind === "parallel") out.push(["d₁ // d₂: a₁b₂ − a₂b₁ = 0, hệ vô nghiệm", COLORS.orange, true]);
        else if (r.kind === "coincident") out.push(["d₁ ≡ d₂: hai đường thẳng trùng nhau", COLORS.orange, true]);
        else {
          const I = `I(${num(r.point[0])}; ${num(r.point[1])})`;
          out.push(r.perpendicular
            ? [`d₁ ⊥ d₂ tại ${I}: a₁a₂ + b₁b₂ = 0`, COLORS.purple, true]
            : [`Cắt nhau tại ${I};  cos φ = |a₁a₂ + b₁b₂|/(|n₁|·|n₂|), φ ≈ ${num(angleBetween(l1, l2), 1)}°`, COLORS.red, true]);
        }
      }
    }
  }
  if (s.showDistance && l1) {
    out.push([`d(M, d₁) = |a·x₀ + b·y₀ + c|/√(a² + b²) = ${num(distance(l1, [s.mx, s.my]), 3)}`, COLORS.purple, false]);
  }
  return out;
}

function layout(s, view) {
  const n = textLines(s).length;
  const wide = view.w > view.h * 1.3;
  const lh = wide ? 24 : view.w < 560 || view.h < 430 ? 15 : 21;
  const textH = wide ? 0 : Math.min(n * lh + 8, view.h * 0.42);
  const side = wide ? Math.min(view.h, view.w * 0.55) : Math.min(view.w, view.h - textH);
  const gx = wide ? 0 : (view.w - side) / 2;
  const gy = wide ? (view.h - side) / 2 : textH;
  const scale = side / (2 * HALF);
  const ox = gx + side / 2;
  const oy = gy + side / 2;
  return {
    wide, side, gx, gy, scale, lh,
    text: wide ? { x: side + 16, y: 24, w: view.w - side - 28 } : { x: 10, y: lh / 2 + 4, w: view.w - 20 },
    toX: x => ox + x * scale,
    toY: y => oy - y * scale,
    fromX: px => (px - ox) / scale,
    fromY: py => (oy - py) / scale,
  };
}

// One result per finished change of a line, a goal when d₁ ⊥ d₂ is reached.
const reportLine = (s, api, which) => {
  const l = which === 2 ? line2(s) : line1(s);
  if (l) api.emit("line-equation", { line: which, a: l.a, b: l.b, c: l.c }, "result");
  const l1 = line1(s);
  const l2 = s.showSecond ? line2(s) : null;
  const perp = !!(l1 && l2 && relation(l1, l2).perpendicular);
  if (perp && !s._wasPerp) api.emit("perpendicular", { a1: l1.a, b1: l1.b, a2: l2.a, b2: l2.b }, "goal");
  s._wasPerp = perp;
};
const reportDistance = (s, api) => {
  const l = line1(s);
  if (l && s.showDistance) api.emit("point-distance", { x: s.mx, y: s.my, distance: distance(l, [s.mx, s.my]) }, "result");
};
const report = key => (/^(x3|y3|x4|y4|showSecond)$/.test(key) ? (s, api) => reportLine(s, api, 2) : /^(mx|my|showDistance)$/.test(key) ? reportDistance : (s, api) => reportLine(s, api, 1));

const coord = (key, text, visible, lim = LIMIT) => ({ type: "slider", key, label: text, min: -lim, max: lim, step: 0.5, digits: 1, visible, onCommit: report(key) });

function fit(ctx, text, x, y, w, { size = 14, min = 9, bold = false, color = COLORS.ink } = {}) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  while (size > min && ctx.measureText(text).width > w) ctx.font = `${bold ? "600 " : ""}${--size}px ${FONT}`;
  label(ctx, text, x, y, { size, bold, color });
}

mount({
  slug: "phuong-trinh-duong-thang",
  version: "1.0.0",
  title: "Phương trình đường thẳng",
  hint: "Kéo các điểm A, B, C, D (và đầu vectơ u hoặc n) trên hình. Thử làm cho d₁ vuông góc với d₂.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Xác định d₁ bởi",
      onCommit: report("mode"),
      options: [
        { value: "two-points", label: "Hai điểm A, B" },
        { value: "point-direction", label: "Điểm A và vectơ chỉ phương u" },
        { value: "point-normal", label: "Điểm A và vectơ pháp tuyến n" },
      ],
    },
    { type: "heading", label: "Đường thẳng d₁" },
    coord("x1", "Hoành độ của A"),
    coord("y1", "Tung độ của A"),
    coord("x2", "Hoành độ của B", s => s.mode === "two-points"),
    coord("y2", "Tung độ của B", s => s.mode === "two-points"),
    coord("ux", "u₁ (vectơ chỉ phương)", s => s.mode === "point-direction", VLIMIT),
    coord("uy", "u₂ (vectơ chỉ phương)", s => s.mode === "point-direction", VLIMIT),
    coord("nx", "a (vectơ pháp tuyến)", s => s.mode === "point-normal", VLIMIT),
    coord("ny", "b (vectơ pháp tuyến)", s => s.mode === "point-normal", VLIMIT),
    { type: "checkbox", key: "showSecond", label: "Đường thẳng thứ hai d₂ = CD", onCommit: report("showSecond") },
    coord("x3", "Hoành độ của C", s => s.showSecond),
    coord("y3", "Tung độ của C", s => s.showSecond),
    coord("x4", "Hoành độ của D", s => s.showSecond),
    coord("y4", "Tung độ của D", s => s.showSecond),
    { type: "checkbox", key: "showDistance", label: "Khoảng cách từ điểm M đến d₁", onCommit: report("showDistance") },
    coord("mx", "Hoành độ của M", s => s.showDistance),
    coord("my", "Tung độ của M", s => s.showDistance),
  ],
  readouts: [
    { label: "d₁", value: s => (line1(s) ? generalText(line1(s)) : "–") },
    { label: "Hệ số góc của d₁", value: s => (!line1(s) ? "–" : slopeForm(line1(s)) ? num(slopeForm(line1(s)).k) : "không có") },
    { label: "d₂", value: s => (s.showSecond && line2(s) ? generalText(line2(s)) : "–") },
    {
      label: "Góc giữa d₁ và d₂",
      value: s => (s.showSecond && line1(s) && line2(s) ? `${num(angleBetween(line1(s), line2(s)), 1)}°` : "–"),
    },
    { label: "Khoảng cách từ M đến d₁", value: s => (s.showDistance && line1(s) ? num(distance(line1(s), [s.mx, s.my]), 3) : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      const L = layout(s, view);
      // last drawn is on top, so search from the end
      const i = HANDLES.findLastIndex(h => h[4](s) && Math.hypot(p.x - L.toX(handlePos(s, h)[0]), p.y - L.toY(handlePos(s, h)[1])) < 22);
      s._drag = i;
      return i >= 0;
    },
    move(p, s, api, view) {
      const L = layout(s, view);
      const h = HANDLES[s._drag];
      const x = L.fromX(p.x);
      const y = L.fromY(p.y);
      if (h[3]) {
        s[h[0]] = snap(x - s.x1, VLIMIT);
        s[h[1]] = snap(y - s.y1, VLIMIT);
      } else {
        s[h[0]] = snap(x, LIMIT);
        s[h[1]] = snap(y, LIMIT);
      }
      api.sync();
    },
    up(p, s, api) {
      const h = HANDLES[s._drag];
      api.emit("point-moved", { point: s._drag + 1, x: s[h[0]], y: s[h[1]] });
      s._drag = -1;
      if (h[2] === "M") reportDistance(s, api);
      else reportLine(s, api, h[2] === "C" || h[2] === "D" ? 2 : 1);
    },
  },
  draw(ctx, s, view) {
    const L = layout(s, view);
    const small = view.w < 560 || view.h < 430;
    const l1 = line1(s);
    const l2 = s.showSecond ? line2(s) : null;
    const P = q => [L.toX(q[0]), L.toY(q[1])];

    // grid, clipped to its square
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.gx, L.gy, L.side, L.side);
    ctx.clip();
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.grid;
    for (let i = -HALF; i <= HALF; i++) {
      ctx.beginPath();
      ctx.moveTo(L.toX(i), L.toY(-HALF));
      ctx.lineTo(L.toX(i), L.toY(HALF));
      ctx.moveTo(L.toX(-HALF), L.toY(i));
      ctx.lineTo(L.toX(HALF), L.toY(i));
      ctx.stroke();
    }
    arrow(ctx, L.toX(-HALF), L.toY(0), L.toX(HALF), L.toY(0), COLORS.muted, 1.5);
    arrow(ctx, L.toX(0), L.toY(-HALF), L.toX(0), L.toY(HALF), COLORS.muted, 1.5);
    label(ctx, "x", L.toX(HALF) - 8, L.toY(0) + 12, { color: COLORS.muted, size: 12 });
    label(ctx, "y", L.toX(0) + 8, L.toY(HALF) + 8, { color: COLORS.muted, size: 12 });
    label(ctx, "O", L.toX(0) - 10, L.toY(0) + 11, { color: COLORS.muted, size: 11 });
    if (L.scale > 22) {
      for (let i = -LIMIT; i <= LIMIT; i += 2) {
        if (i === 0) continue;
        label(ctx, num(i), L.toX(i), L.toY(0) + 11, { size: 10, align: "center", color: COLORS.muted });
        label(ctx, num(i), L.toX(0) - 10, L.toY(i), { size: 10, align: "center", color: COLORS.muted });
      }
    }

    const drawLine = (l, color, name) => {
      const d = Math.hypot(l.u[0], l.u[1]);
      const e = [l.u[0] / d, l.u[1] / d];
      const far = 4 * HALF;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(...P([l.p[0] - e[0] * far, l.p[1] - e[1] * far]));
      ctx.lineTo(...P([l.p[0] + e[0] * far, l.p[1] + e[1] * far]));
      ctx.stroke();
      // name near where the line leaves the square on the right/top side
      const t = Math.min(...[0, 1].map(k => (Math.abs(e[k]) < 1e-9 ? Infinity : ((Math.sign(e[k]) * (HALF - 0.7)) - l.p[k]) / e[k])));
      const q = P([l.p[0] + e[0] * t, l.p[1] + e[1] * t]);
      label(ctx, name, q[0] - 12, q[1] + 12, { color, bold: true, size: 15, align: "center" });
    };
    if (l2) drawLine(l2, COLORS.green, "d₂");
    if (l1) drawLine(l1, COLORS.blue, "d₁");

    // intersection, right-angle mark
    if (l1 && l2) {
      const r = relation(l1, l2);
      if (r.kind === "intersect") {
        const [ix, iy] = P(r.point);
        if (r.perpendicular) {
          const e1 = [l1.u[0] / Math.hypot(...l1.u), l1.u[1] / Math.hypot(...l1.u)];
          const e2 = [l2.u[0] / Math.hypot(...l2.u), l2.u[1] / Math.hypot(...l2.u)];
          const q = 12;
          ctx.strokeStyle = COLORS.purple;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ix + e1[0] * q, iy - e1[1] * q);
          ctx.lineTo(ix + (e1[0] + e2[0]) * q, iy - (e1[1] + e2[1]) * q);
          ctx.lineTo(ix + e2[0] * q, iy - e2[1] * q);
          ctx.stroke();
        }
        ctx.fillStyle = COLORS.red;
        ctx.beginPath();
        ctx.arc(ix, iy, 5, 0, Math.PI * 2);
        ctx.fill();
        label(ctx, "I", ix + 8, iy + 12, { color: COLORS.red, bold: true, size: 14 });
      }
    }

    // vectors u and n at A
    if (l1) {
      const A = P([s.x1, s.y1]);
      const tipU = P([s.x1 + l1.u[0], s.y1 + l1.u[1]]);
      const tipN = P([s.x1 + l1.n[0], s.y1 + l1.n[1]]);
      const strongU = s.mode !== "point-normal";
      arrow(ctx, ...A, ...tipU, strongU ? COLORS.orange : "rgba(240, 140, 46, 0.45)", strongU ? 3 : 2);
      arrow(ctx, ...A, ...tipN, !strongU ? COLORS.purple : "rgba(122, 90, 248, 0.45)", !strongU ? 3 : 2);
      label(ctx, "u", tipU[0] + 8, tipU[1] - 8, { color: COLORS.orange, bold: true, size: 14 });
      label(ctx, "n", tipN[0] + 8, tipN[1] - 8, { color: COLORS.purple, bold: true, size: 14 });
    }

    // distance from M
    if (s.showDistance && l1) {
      const M = [s.mx, s.my];
      const F = foot(l1, M);
      ctx.save();
      ctx.strokeStyle = COLORS.purple;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(...P(M));
      ctx.lineTo(...P(F));
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = COLORS.purple;
      ctx.beginPath();
      ctx.arc(...P(F), 3.5, 0, Math.PI * 2);
      ctx.fill();
      const mid = P([(M[0] + F[0]) / 2, (M[1] + F[1]) / 2]);
      label(ctx, num(distance(l1, M), 2), mid[0] + 8, mid[1], { color: COLORS.purple, bold: true, size: 13 });
    }

    // handles (points only; vector tips get a ring)
    for (const h of HANDLES) {
      if (!h[4](s)) continue;
      const [x, y] = P(handlePos(s, h));
      const color = h[2] === "C" || h[2] === "D" ? COLORS.green : h[2] === "M" ? COLORS.purple : h[2] === "u" ? COLORS.orange : h[2] === "n" ? COLORS.purple : COLORS.blue;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
      if (h[3]) continue;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, small ? h[2] : `${h[2]}(${num(s[h[0]])}; ${num(s[h[1]])})`, x + 12, y - 12, { color, bold: true, size: small ? 12 : 13 });
    }
    ctx.restore();

    // formulas
    const { x, y, w } = L.text;
    const size = L.wide ? 15 : small ? 12 : 14;
    const lines = textLines(s);
    const fitN = L.wide ? lines.length : Math.floor((L.gy - 4) / L.lh);
    lines.slice(0, fitN).forEach(([text, color, bold], i) => fit(ctx, text, x, y + i * L.lh, w, { size, color, bold }));
  },
});
