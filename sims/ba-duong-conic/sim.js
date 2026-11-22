import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { CURVES, X_MAX, initialState, normalize, shape, pointM, distances, residual, project, target, throughTarget, newChallenge } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const n = (v, digits = 2) => fmt(v, digits);
const exact = v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;
const eqv = v => `${exact(v) ? "=" : "≈"} ${n(v)}`;
const pt = (name, x, y) => `${name}(${n(x)}; ${n(y)})`;
const NAME = { ellipse: "elip", hyperbola: "hypebol", parabola: "parabol" };

const over = (v, q) => (q === 1 ? v : `${v}/${n(q)}`); // x²/1 is written x²
const equation = (s, g) =>
  s.curve === "ellipse"
    ? `${over("x²", g.a * g.a)} + ${over("y²", g.b * g.b)} = 1`
    : s.curve === "hyperbola"
      ? `${over("x²", g.a * g.a)} − ${over("y²", g.b * g.b)} = 1`
      : `y² = ${g.p === 0.5 ? "" : n(2 * g.p)}x`;

// Header text, top to bottom. In a challenge the last rows are the task and its check.
function rows(s, small) {
  const g = shape(s);
  const d = distances(s);
  const out = [];
  if (s.curve === "ellipse") {
    out.push([`Elip (E): ${equation(s, g)};  a = ${n(g.a)}, b = ${n(g.b)}, c = √(a² − b²) ${eqv(g.c)}`, COLORS.ink, true]);
    out.push([`MF₁ + MF₂ = ${n(d.d1)} + ${n(d.d2)} = ${n(d.d1 + d.d2)} = 2a  (sợi dây dài không đổi)`, COLORS.orange, true]);
    if (!s.challenge) out.push([small ? `F₁, F₂(±${n(g.c)}; 0);  tâm sai e = c/a ${eqv(g.e)}` : `${pt("F₁", -g.c, 0)}, ${pt("F₂", g.c, 0)};  đỉnh A₁, A₂(±${n(g.a)}; 0), B₁, B₂(0; ±${n(g.b)});  tâm sai e = c/a ${eqv(g.e)}`, COLORS.muted]);
  } else if (s.curve === "hyperbola") {
    out.push([`Hypebol (H): ${equation(s, g)};  a = ${n(g.a)}, b = ${n(g.b)}, c = √(a² + b²) ${eqv(g.c)}`, COLORS.ink, true]);
    out.push([`|MF₁ − MF₂| = |${n(d.d1)} − ${n(d.d2)}| = ${n(Math.abs(d.d1 - d.d2))} = 2a`, COLORS.orange, true]);
    const slope = `${exact(g.b / g.a) ? "=" : "≈"} ±${n(g.b / g.a)}x`;
    if (!s.challenge) out.push([small ? `F₁, F₂(±${n(g.c)}; 0);  e ${eqv(g.e)};  tiệm cận y ${slope}` : `${pt("F₁", -g.c, 0)}, ${pt("F₂", g.c, 0)};  đỉnh A₁, A₂(±${n(g.a)}; 0);  e = c/a ${eqv(g.e)};  tiệm cận y = ±(b/a)x ${slope}`, COLORS.muted]);
  } else {
    out.push([small ? `(P): ${equation(s, g)};  p = ${n(g.p)};  ${pt("F", g.c, 0)};  Δ: x = ${n(-g.c)}` : `Parabol (P): ${equation(s, g)};  p = ${n(g.p)}, tiêu điểm ${pt("F", g.c, 0)}, đường chuẩn Δ: x = ${n(-g.c)}`, COLORS.ink, true]);
    out.push([`MF = ${n(d.d1)} = MH = d(M, Δ)`, COLORS.orange, true]);
    if (!s.challenge) out.push([`Đỉnh O(0; 0);  trục đối xứng Ox;  tâm sai e = 1${small ? "" : ";  p là khoảng cách từ F đến Δ"}`, COLORS.muted]);
  }
  if (s.challenge) {
    const t = target(s);
    const P = pt("P", t.x, t.y);
    const ok = throughTarget(s);
    const task = s.curve === "parabola" ? `Thử thách: tìm p để parabol đi qua ${P}` : `Thử thách: giữ a = ${n(g.a)}, tìm b để ${NAME[s.curve]} đi qua ${P}`;
    out.push([task, COLORS.purple, true]);
    let check;
    if (s.curve === "parabola") check = `Thay tọa độ P: y² = ${n(t.y * t.y, 3)};  2px = ${n(2 * g.p * t.x, 3)}`;
    else {
      const u = (t.x * t.x) / (g.a * g.a);
      const v = (t.y * t.y) / (g.b * g.b);
      const sum = s.curve === "ellipse" ? u + v : u - v;
      check = `Thay tọa độ P: x²/a² ${s.curve === "ellipse" ? "+" : "−"} y²/b² = ${n(u, 3)} ${s.curve === "ellipse" ? "+" : "−"} ${n(v, 3)} = ${n(sum, 3)}${ok ? "" : " ≠ 1"}`;
    }
    out.push([ok ? `✓ ${check}: ${NAME[s.curve]} đi qua P` : `${check}${s.curve === "parabola" ? ": chưa bằng nhau" : ""}`, ok ? COLORS.green : COLORS.red, ok]);
  }
  return out;
}

// World (unit squares, same scale on both axes) to screen, below the header.
function frame(s, view) {
  const small = view.w < 560 || view.h < 430;
  const lh = small ? 16 : 26;
  const lines = s.challenge ? 4 : 3;
  const top = (small ? 5 : 12) + lines * lh;
  const mid = s.curve === "parabola" ? 4.5 : 0; // the parabola opens to the right
  const k = Math.min(view.w / 19.4, (view.h - top) / 13.4);
  return { small, lh, top, k, ox: view.w / 2 - mid * k, oy: top + (view.h - top) / 2 };
}

function fit(ctx, text, x, y, width, opts) {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: w > width ? Math.max(8, (opts.size * width) / w) : opts.size });
}

function tag(ctx, text, x, y, color, align = "center", size = 13) {
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

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function segment(ctx, a, b, color, width = 2.5, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// One result per committed parameter; the goal when that makes the curve pass through P.
const report = (s, api) => {
  const g = shape(s);
  const data = s.curve === "parabola" ? { curve: 2, p: g.p, focus: g.c, eccentricity: 1 } : { curve: CURVES.indexOf(s.curve), a: g.a, b: g.b, c: g.c, eccentricity: g.e };
  api.emit("conic-set", data, "result");
  if (!s.challenge || !throughTarget(s)) return;
  const t = target(s);
  const reached = { ...data, x: t.x, y: t.y };
  api.emit("through-point", reached, "goal");
};

const challenge = s => {
  if (s.challenge) Object.assign(s, newChallenge(s.curve).set);
  normalize(s, "a");
};
const conic = s => s.curve !== "parabola";

mount({
  slug: "ba-duong-conic",
  version: "1.0.0",
  title: "Ba đường conic: elip, hypebol, parabol",
  hint: "Kéo đầu bút M dọc theo đường cong và theo dõi các khoảng cách. Đổi a, b (hoặc p) để xem tiêu điểm, đỉnh, tâm sai thay đổi.",
  initialState,
  controls: [
    {
      type: "select",
      key: "curve",
      label: "Đường conic",
      onChange: challenge,
      onCommit: report,
      options: [
        { value: "ellipse", label: "Elip: MF₁ + MF₂ = 2a" },
        { value: "hyperbola", label: "Hypebol: |MF₁ − MF₂| = 2a" },
        { value: "parabola", label: "Parabol: MF = d(M, Δ)" },
      ],
    },
    { type: "slider", key: "a", label: "a", min: 1.5, max: 6, step: 0.5, digits: 1, visible: conic, disabled: s => s.challenge, onChange: s => normalize(s, "a"), onCommit: report },
    { type: "slider", key: "b", label: "b", min: 1, max: 5, step: 0.5, digits: 1, visible: conic, onChange: s => normalize(s, "b"), onCommit: report },
    { type: "slider", key: "p", label: "Tham số tiêu p", min: 0.5, max: 4, step: 0.5, digits: 1, visible: s => !conic(s), onChange: s => normalize(s, "p"), onCommit: report },
    { type: "slider", key: "angle", label: "Vị trí của M trên elip", min: 0, max: 360, step: 1, unit: "°", digits: 0, visible: s => s.curve === "ellipse" },
    { type: "slider", key: "my", label: "Tung độ của M", min: -6, max: 6, step: 0.1, digits: 1, visible: s => s.curve !== "ellipse", onChange: s => normalize(s, "my") },
    { type: "checkbox", key: "left", label: "M ở nhánh bên trái", visible: s => s.curve === "hyperbola" },
    { type: "checkbox", key: "challenge", label: "Thử thách: cho đường conic đi qua điểm P", onChange: challenge },
    { type: "button", label: "Điểm P khác", visible: s => s.challenge, action: challenge, event: "new-target", eventKind: "action" },
  ],
  readouts: [
    { label: "Phương trình chính tắc", value: s => equation(s, shape(s)) },
    {
      label: "Tiêu điểm",
      value: s => {
        const g = shape(s);
        return s.curve === "parabola" ? pt("F", g.c, 0) : `F₁, F₂(±${n(g.c)}; 0)`;
      },
    },
    { label: "Tâm sai e", value: s => n(shape(s).e) },
    {
      label: "Tiệm cận / đường chuẩn",
      value: s => {
        const g = shape(s);
        return s.curve === "hyperbola" ? `y = ±${n(g.b / g.a)}x` : s.curve === "parabola" ? `x = ${n(-g.c)}` : "–";
      },
    },
  ],
  pointer: {
    down(p, s, api, view) {
      const f = frame(s, view);
      if (p.y < f.top) return false;
      Object.assign(s, project(s, (p.x - f.ox) / f.k, (f.oy - p.y) / f.k));
      api.sync();
    },
    move(p, s, api, view) {
      const f = frame(s, view);
      Object.assign(s, project(s, (p.x - f.ox) / f.k, (f.oy - p.y) / f.k));
      api.sync();
    },
    up(p, s, api) {
      const m = pointM(s);
      const d = distances(s);
      const data = { x: m.x, y: m.y, d1: d.d1, d2: d.d2 };
      api.emit("pencil-moved", data, "action");
    },
  },
  draw(ctx, s, view) {
    const f = frame(s, view);
    const { small, k, ox, oy, top } = f;
    const g = shape(s);
    const m = pointM(s);
    const d = distances(s);
    const S = (x, y) => [ox + x * k, oy - y * k];
    const size = small ? 11 : 14;
    const padX = small ? 8 : 20;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, view.w, view.h - top);
    ctx.clip();

    // unit grid and axes
    const xl = Math.ceil(-ox / k);
    const xr = Math.floor((view.w - ox) / k);
    const yb = Math.ceil(-(view.h - oy) / k);
    const yt = Math.floor((oy - top) / k);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = xl; x <= xr; x++) {
      ctx.moveTo(ox + x * k, top);
      ctx.lineTo(ox + x * k, view.h);
    }
    for (let y = yb; y <= yt; y++) {
      ctx.moveTo(0, oy - y * k);
      ctx.lineTo(view.w, oy - y * k);
    }
    ctx.stroke();
    arrow(ctx, 0, oy, view.w - 2, oy, COLORS.muted, 1.5);
    arrow(ctx, ox, view.h, ox, top + 2, COLORS.muted, 1.5);
    label(ctx, "x", view.w - 10, oy - 11, { size: size + 1, bold: true, color: COLORS.muted, align: "center" });
    label(ctx, "y", ox + 11, top + 9, { size: size + 1, bold: true, color: COLORS.muted, align: "center" });
    label(ctx, "O", ox - 8, oy + 10, { size, color: COLORS.muted, align: "center" });
    const every = k < 30 ? 2 : 1;
    for (let x = xl; x <= xr; x++) if (x && x % every === 0) label(ctx, n(x), ox + x * k, oy + 10, { size: size - 2, color: COLORS.muted, align: "center" });
    for (let y = yb; y <= yt; y++) if (y && y % every === 0) label(ctx, n(y), ox - 5, oy - y * k, { size: size - 2, color: COLORS.muted, align: "right" });

    const Sm = S(m.x, m.y);
    const curveStyle = () => {
      ctx.strokeStyle = COLORS.blue;
      ctx.lineWidth = 2.5;
    };
    const names = [];
    const mark = (x, y, text, dx, dy, color = COLORS.ink, r = small ? 3 : 4) => {
      const [px, py] = S(x, y);
      dot(ctx, px, py, r, color);
      names.push([text, px + dx, py + dy, color]);
    };
    const fy = small ? 21 : 27; // focus names go under the tick numbers
    const yv = (oy - top) / k + 1; // world half-height of what is visible

    if (s.curve === "ellipse") {
      curveStyle();
      ctx.beginPath();
      ctx.ellipse(ox, oy, g.a * k, g.b * k, 0, 0, Math.PI * 2);
      ctx.stroke();
      // the string F₁ – M – F₂
      segment(ctx, S(-g.c, 0), Sm, COLORS.orange);
      segment(ctx, Sm, S(g.c, 0), COLORS.orange);
      mark(-g.a, 0, "A₁", -12, -11);
      mark(g.a, 0, "A₂", 13, -11);
      mark(0, -g.b, "B₁", 13, 11);
      mark(0, g.b, "B₂", 13, -11);
      mark(-g.c, 0, "F₁", 0, fy, COLORS.red, small ? 4 : 5.5);
      mark(g.c, 0, "F₂", 0, fy, COLORS.red, small ? 4 : 5.5);
    } else if (s.curve === "hyperbola") {
      // basic rectangle and asymptotes y = ±(b/a)x
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(ox - g.a * k, oy - g.b * k, 2 * g.a * k, 2 * g.b * k);
      ctx.setLineDash([]);
      const far = 30;
      for (const sign of [1, -1]) segment(ctx, S(-far, (-sign * far * g.b) / g.a), S(far, (sign * far * g.b) / g.a), COLORS.purple, 1.5, [7, 5]);
      curveStyle();
      for (const side of [1, -1]) {
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const y = -yv + (2 * yv * i) / 120;
          const [px, py] = S(side * g.a * Math.sqrt(1 + (y * y) / (g.b * g.b)), y);
          ctx[i ? "lineTo" : "moveTo"](px, py);
        }
        ctx.stroke();
      }
      segment(ctx, S(-g.c, 0), Sm, COLORS.orange);
      segment(ctx, Sm, S(g.c, 0), COLORS.orange);
      mark(-g.a, 0, "A₁", 13, -11);
      mark(g.a, 0, "A₂", -13, -11);
      mark(-g.c, 0, "F₁", 0, fy, COLORS.red, small ? 4 : 5.5);
      mark(g.c, 0, "F₂", 0, fy, COLORS.red, small ? 4 : 5.5);
      // name one asymptote where it leaves the window
      const xa = Math.min((xr - 0.6) * 1, ((yt - 0.6) * g.a) / g.b);
      if (!small) names.push([`y = ${n(g.b / g.a)}x`, ox + xa * k - 8, oy - ((xa * g.b) / g.a) * k + 14, COLORS.purple, "right"]);
    } else {
      // directrix Δ: x = −p/2
      segment(ctx, S(-g.c, -yv), S(-g.c, yv), COLORS.red, 2, [7, 5]);
      curveStyle();
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const y = -yv + (2 * yv * i) / 160;
        const [px, py] = S((y * y) / (2 * g.p), y);
        ctx[i ? "lineTo" : "moveTo"](px, py);
      }
      ctx.stroke();
      const H = S(-g.c, m.y);
      segment(ctx, S(g.c, 0), Sm, COLORS.orange);
      segment(ctx, H, Sm, COLORS.green);
      // right angle at H
      const q = small ? 5 : 7;
      const up = m.y >= 0 ? 1 : -1;
      ctx.strokeStyle = COLORS.green;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(H[0], up > 0 ? H[1] : H[1] - q, q, q);
      mark(-g.c, m.y, "H", -11, -up * 11, COLORS.green);
      mark(g.c, 0, "F", 0, fy, COLORS.red, small ? 4 : 5.5);
      names.push(["Δ", ox - g.c * k - 10, top + 12, COLORS.red]);
      names.push([n(d.d2), (H[0] + Sm[0]) / 2, H[1] - up * 11, COLORS.green]);
    }

    // lengths of the string, beside the middle of each piece
    if (s.curve !== "parabola") {
      const F1 = S(-g.c, 0);
      const F2 = S(g.c, 0);
      const off = m.y >= 0 ? -11 : 11;
      names.push([n(d.d1), (F1[0] + Sm[0]) / 2 - 6, (F1[1] + Sm[1]) / 2 + off, COLORS.orange, "right"]);
      names.push([n(d.d2), (F2[0] + Sm[0]) / 2 + 6, (F2[1] + Sm[1]) / 2 + off, COLORS.orange, "left"]);
    } else {
      const F = S(g.c, 0);
      names.push([n(d.d1), (F[0] + Sm[0]) / 2 + 8, (F[1] + Sm[1]) / 2 + (m.y >= 0 ? 10 : -10), COLORS.orange, "left"]);
    }

    if (s.challenge) {
      const t = target(s);
      const [px, py] = S(t.x, t.y);
      const r = small ? 6 : 8;
      ctx.fillStyle = throughTarget(s) ? COLORS.green : "#fff";
      ctx.strokeStyle = COLORS.green;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px, py - r);
      ctx.lineTo(px + r, py);
      ctx.lineTo(px, py + r);
      ctx.lineTo(px - r, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      names.push([pt("P", t.x, t.y), px + r + 4, py - r - 4, COLORS.green, "left"]);
    }

    // the pencil point
    dot(ctx, Sm[0], Sm[1], small ? 6 : 8, COLORS.purple);
    names.push(["M", Sm[0] + (m.x >= 0 ? 13 : -13), Sm[1] + (m.y >= 0 ? -13 : 13), COLORS.purple]);
    for (const [text, x, y, color, align] of names) tag(ctx, text, x, y, color, align, size);
    ctx.restore();

    // header
    rows(s, small).forEach(([text, color, bold], i) => {
      fit(ctx, text, padX, (small ? 5 : 12) + f.lh * (i + 0.5), view.w - 2 * padX, { size: small ? 12 : bold ? 16 : 15, color, bold });
    });
  },
});
