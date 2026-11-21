import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, solve, segment, equationKind } from "./model.js";

const R = 10; // the plot shows |x| ≤ R, |y| ≤ R
const KEYS = ["a1", "b1", "c1", "a2", "b2", "c2"];
const KIND = { unique: "Nghiệm duy nhất", none: "Vô nghiệm", infinite: "Vô số nghiệm" };
const TONE = { unique: COLORS.green, none: COLORS.red, infinite: COLORS.purple };

const term = (k, v, first) => {
  if (k === 0) return "";
  const body = (Math.abs(k) === 1 ? "" : fmt(Math.abs(k))) + v;
  return first ? (k < 0 ? "−" : "") + body : (k < 0 ? " − " : " + ") + body;
};
const equation = (a, b, c) => (a === 0 && b === 0 ? `0x + 0y = ${fmt(c)}` : `${term(a, "x", true)}${term(b, "y", a === 0)} = ${fmt(c)}`);

const exact = v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
/** n/d as a whole number, or as a reduced fraction with its decimal value. */
const ratio = (n, d) => {
  const v = n / d;
  if (Number.isInteger(v)) return fmt(v);
  const g = gcd(n, d);
  return `${n * d < 0 ? "−" : ""}${Math.abs(n) / g}/${Math.abs(d) / g} ${exact(v) ? "=" : "≈"} ${fmt(v)}`;
};
const point = r => `(${fmt(r.x)}; ${fmt(r.y)})`;
/** "=" when both coordinates are shown exactly with two decimals, else "≈". */
const equals = r => (exact(r.x) && exact(r.y) ? "=" : "≈");

/** One short line and a few full lines explaining why the system has that many solutions. */
function explain(s, r) {
  if (r.degenerate) {
    const eqs = [[s.a1, s.b1, s.c1], [s.a2, s.b2, s.c2]];
    const bad = eqs.find(e => equationKind(...e) === (r.kind === "none" ? "empty" : "all"));
    const text = equation(...bad);
    return r.kind === "none"
      ? { short: `${text} vô nghiệm ⟹ hệ vô nghiệm`, lines: [`${text} không có nghiệm nào`, "⟹ hệ vô nghiệm"] }
      : { short: `${text} luôn đúng ⟹ hệ vô số nghiệm`, lines: [`${text} đúng với mọi (x; y)`, "⟹ hệ vô số nghiệm"] };
  }
  if (r.kind === "unique") {
    return {
      strong: 1,
      short: `D = ${fmt(r.D)} ≠ 0: nghiệm duy nhất (x; y) ${equals(r)} ${point(r)}`,
      lines: ["D ≠ 0 ⟹ hệ có nghiệm duy nhất", `x = Dx/D = ${ratio(r.Dx, r.D)}`, `y = Dy/D = ${ratio(r.Dy, r.D)}`, "d₁ cắt d₂ tại một điểm"],
    };
  }
  if (r.kind === "none") {
    return {
      short: `D = 0, Dx = ${fmt(r.Dx)}, Dy = ${fmt(r.Dy)}: hệ vô nghiệm (d₁ // d₂)`,
      lines: ["D = 0, còn Dx ≠ 0 hoặc Dy ≠ 0", "⟹ hệ vô nghiệm", "d₁ // d₂ (song song)"],
    };
  }
  return {
    short: "D = Dx = Dy = 0: hệ vô số nghiệm (d₁ ≡ d₂)",
    lines: ["D = Dx = Dy = 0", "⟹ hệ vô số nghiệm", "d₁ ≡ d₂ (trùng nhau)"],
  };
}

// The textbook ratio test, only meaningful when no denominator is 0.
const ratios = (s, r) =>
  r.degenerate || !s.a2 || !s.b2 || !s.c2
    ? null
    : r.kind === "unique"
      ? "a₁/a₂ ≠ b₁/b₂"
      : r.kind === "none"
        ? "a₁/a₂ = b₁/b₂ ≠ c₁/c₂"
        : "a₁/a₂ = b₁/b₂ = c₁/c₂";

function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const side = !small && view.w >= view.h + 120; // room for a text column on the right
  const top = side ? 14 : small ? 38 : 60;
  const col = side ? 280 : 0;
  const size = Math.max(40, Math.min(view.w - col - 24, view.h - top - 12));
  const x0 = (view.w - col - size) / 2;
  const y0 = top + (view.h - top - 12 - size) / 2;
  return { small, side, size, x0, y0, u: size / (2 * R), cx: x0 + size / 2, cy: y0 + size / 2 };
}

// Report once per finished adjustment (slider released), and only when the system is a new one.
const settle = (s, api) => {
  const key = KEYS.map(k => s[k]).join();
  if (key === s._reported) return;
  s._reported = key;
  const r = solve(s);
  const before = s._kind ?? solve(initialState()).kind;
  s._kind = r.kind;
  if (r.kind === "unique") api.emit("solved", { x: r.x, y: r.y }, "result");
  else if (r.kind !== before) api.emit("special-system", { solutions: r.kind }, "goal");
};

const coef = (key, name) => ({ type: "slider", key, label: name, min: -10, max: 10, step: 1, digits: 0, onCommit: settle });

mount({
  slug: "he-phuong-trinh",
  version: "1.0.0",
  title: "Hệ hai phương trình bậc nhất hai ẩn",
  hint: "Đổi các hệ số để hai đường thẳng cắt nhau, song song hoặc trùng nhau, rồi so sánh với các định thức D, Dx, Dy.",
  initialState,
  controls: [
    { type: "heading", label: "Phương trình thứ nhất" },
    coef("a1", "a₁ (hệ số của x)"),
    coef("b1", "b₁ (hệ số của y)"),
    coef("c1", "c₁ (vế phải)"),
    { type: "heading", label: "Phương trình thứ hai" },
    coef("a2", "a₂ (hệ số của x)"),
    coef("b2", "b₂ (hệ số của y)"),
    coef("c2", "c₂ (vế phải)"),
  ],
  readouts: [
    { label: "D = a₁b₂ − a₂b₁", value: s => fmt(solve(s).D) },
    { label: "Số nghiệm của hệ", value: s => KIND[solve(s).kind] },
    { label: "Nghiệm (x; y)", value: s => (solve(s).kind === "unique" ? `${equals(solve(s)) === "≈" ? "≈ " : ""}${point(solve(s))}` : "–") },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    const { size, x0, y0, u, cx, cy } = g;
    const r = solve(s);
    const info = explain(s, r);
    const eqs = [
      { a: s.a1, b: s.b1, c: s.c1, name: "d₁", color: COLORS.blue },
      { a: s.a2, b: s.b2, c: s.c2, name: "d₂", color: COLORS.red },
    ];
    const X = x => cx + x * u;
    const Y = y => cy - y * u;

    // grid and axes
    ctx.fillStyle = "#fff";
    ctx.fillRect(x0, y0, size, size);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -R; i <= R; i++) {
      ctx.moveTo(X(i), y0);
      ctx.lineTo(X(i), y0 + size);
      ctx.moveTo(x0, Y(i));
      ctx.lineTo(x0 + size, Y(i));
    }
    ctx.stroke();
    arrow(ctx, x0, cy, x0 + size, cy, COLORS.muted, 1.5);
    arrow(ctx, cx, y0 + size, cx, y0, COLORS.muted, 1.5);
    const ts = g.small ? 10 : 12;
    label(ctx, "x", x0 + size - 8, cy + 12, { size: ts + 1, color: COLORS.muted, align: "center" });
    label(ctx, "y", cx + 11, y0 + 9, { size: ts + 1, color: COLORS.muted, align: "center" });
    label(ctx, "O", cx - 8, cy + 10, { size: ts, color: COLORS.muted, align: "center" });
    for (const i of [-5, 5]) {
      label(ctx, fmt(i), X(i), cy + 10, { size: ts, color: COLORS.muted, align: "center" });
      label(ctx, fmt(i), cx - 6, Y(i), { size: ts, color: COLORS.muted, align: "right" });
    }

    // the two lines; when they coincide the second one is dashed so both stay visible
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    eqs.forEach((e, i) => {
      const seg = segment(e.a, e.b, e.c, R);
      if (!seg) return;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = i === 0 ? 4 : 2.5;
      ctx.setLineDash(i === 1 && r.kind === "infinite" ? [9, 7] : []);
      ctx.beginPath();
      ctx.moveTo(X(seg[0][0]), Y(seg[0][1]));
      ctx.lineTo(X(seg[1][0]), Y(seg[1][1]));
      ctx.stroke();
      ctx.setLineDash([]);
      // name near one end, opposite ends for the two lines, pulled inside the plot
      const [px, py] = seg[i === 0 ? 1 : 0];
      const [qx, qy] = seg[i === 0 ? 0 : 1];
      const len = Math.hypot(qx - px, qy - py) || 1;
      const t = Math.min(0.45, 1.6 / len);
      const nx = (-(qy - py) / len) * (i === 0 ? 1 : -1);
      const ny = ((qx - px) / len) * (i === 0 ? 1 : -1);
      label(ctx, e.name, X(px + (qx - px) * t + nx * 0.9), Y(py + (qy - py) * t + ny * 0.9), { color: e.color, bold: true, size: g.small ? 12 : 15, align: "center" });
    });
    ctx.restore();

    // the intersection
    if (r.kind === "unique") {
      if (Math.abs(r.x) <= R && Math.abs(r.y) <= R) {
        const px = X(r.x);
        const py = Y(r.y);
        ctx.strokeStyle = COLORS.muted;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px, cy);
        ctx.lineTo(px, py);
        ctx.lineTo(cx, py);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLORS.ink;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, g.small ? 5 : 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const right = px < x0 + size * 0.7;
        label(ctx, point(r), px + (right ? 10 : -10), py + (py < y0 + 24 ? 14 : -13), { bold: true, size: g.small ? 12 : 15, align: right ? "left" : "right" });
      } else {
        label(ctx, `Giao điểm ${point(r)} nằm ngoài hình vẽ`, x0 + 8, y0 + size - 12, { size: g.small ? 11 : 13, color: COLORS.muted });
      }
    }

    // explanation: a column on the right when there is room, else two lines above the plot
    if (g.side) {
      const x = x0 + size + 22;
      let y = y0 + 16;
      const line = (text, opt = {}, gap = 26) => {
        label(ctx, text, x, y, { size: 15, ...opt });
        y += gap;
      };
      line("Hệ phương trình", { bold: true, size: 17 }, 30);
      for (const e of eqs) line(`(${e.name}): ${equation(e.a, e.b, e.c)}`, { color: e.color, bold: true, size: 17 }, 28);
      y += 14;
      line("Định thức", { bold: true, size: 17 }, 30);
      line(`D = a₁b₂ − a₂b₁ = ${fmt(r.D)}`);
      line(`Dx = c₁b₂ − c₂b₁ = ${fmt(r.Dx)}`);
      line(`Dy = a₁c₂ − a₂c₁ = ${fmt(r.Dy)}`);
      y += 14;
      line("Kết luận", { bold: true, size: 17 }, 30);
      info.lines.forEach((text, i) => line(text, i < (info.strong ?? 2) ? { bold: true, color: TONE[r.kind] } : {}));
      const rt = ratios(s, r);
      if (rt) line(`Tỉ số: ${rt}`, { color: COLORS.muted });
      if (r.degenerate) {
        line("0x + 0y = c không phải là", { color: COLORS.muted, size: 13 }, 18);
        line("phương trình bậc nhất hai ẩn.", { color: COLORS.muted, size: 13 });
      }
    } else {
      const fs = g.small ? 12 : 15;
      const y = g.small ? 11 : 16;
      label(ctx, `(d₁): ${equation(s.a1, s.b1, s.c1)}`, view.w / 2 - 10, y, { size: fs, bold: true, color: COLORS.blue, align: "right" });
      label(ctx, `(d₂): ${equation(s.a2, s.b2, s.c2)}`, view.w / 2 + 10, y, { size: fs, bold: true, color: COLORS.red });
      label(ctx, info.short, view.w / 2, y + (g.small ? 16 : 24), { size: fs, bold: true, color: TONE[r.kind], align: "center" });
    }
  },
});
