import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { RANGE, initialState, analyze, evaluate } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const STEP = 0.5;

// Vietnamese number with a real minus sign, never "−0".
const num = (v, digits = 2) => {
  const k = 10 ** digits;
  return fmt(Math.round(v * k) / k + 0, digits).replace("-", "−");
};
const exact = v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-7;
const eq = v => `${exact(v) ? "=" : "≈"} ${num(v)}`;
const point = (x, y) => `(${num(x)}; ${num(y)})`;

const poly = terms => {
  const used = terms.filter(([k]) => k !== 0);
  if (!used.length) return "y = 0";
  return "y = " + used.map(([k, v], i) => (i ? (k < 0 ? " − " : " + ") : k < 0 ? "−" : "") + (Math.abs(k) === 1 && v ? "" : num(Math.abs(k))) + v).join("");
};
const formula = s => poly(s.kind === "linear" ? [[s.a, "x"], [s.b, ""]] : [[s.a, "x²"], [s.b, "x"], [s.c, ""]]);

const rootsText = r =>
  r.allReal
    ? "Mọi x (vô số nghiệm)"
    : r.roots.length === 0
      ? "Vô nghiệm"
      : r.roots.length === 2
        ? `x₁ ${eq(r.roots[0])}; x₂ ${eq(r.roots[1])}`
        : r.type === "quadratic"
          ? `x₁ = x₂ ${eq(r.roots[0])}`
          : `x ${eq(r.roots[0])}`;

const note = r => {
  if (r.type === "constant") return r.yIntercept === 0 ? "Đồ thị trùng với trục Ox" : "Hàm hằng: đồ thị song song với trục Ox";
  if (r.degenerate) return "a = 0: đồ thị là một đường thẳng";
  if (r.type === "linear") return r.slope > 0 ? "a > 0: hàm số đồng biến" : "a < 0: hàm số nghịch biến";
  if (r.delta > 0) return `Δ = ${num(r.delta)} > 0: hai nghiệm phân biệt`;
  return r.delta === 0 ? "Δ = 0: nghiệm kép" : `Δ = ${num(r.delta)} < 0: vô nghiệm`;
};

// Text with a white halo so it stays readable over the grid and the curve.
function tag(ctx, text, x, y, opts = {}) {
  ctx.save();
  ctx.font = `${opts.bold === false ? "" : "600 "}${opts.size ?? 13}px ${FONT}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.bg;
  ctx.strokeText(text, x, y);
  ctx.restore();
  label(ctx, text, x, y, { size: 13, bold: true, ...opts });
}

// One result per finished change. Keys that do not exist for this graph (a second root, the
// vertex of a line) are left out.
const report = (s, api) => {
  const r = analyze(s);
  const data = { rootCount: r.roots.length, allReal: r.allReal ? 1 : 0 };
  r.roots.forEach((x, i) => (data[`root${i + 1}`] = x));
  if (r.vertex) Object.assign(data, { vertexX: r.vertex.x, vertexY: r.vertex.y, delta: r.delta });
  api.emit("graph-analyzed", data, "result");
};

const coefficient = (key, name) => ({ type: "slider", key, label: name, min: -RANGE, max: RANGE, step: STEP, digits: 1, onCommit: report });

// The kit cannot hide a control, so the c slider (quadratic only) is a custom one.
const cSlider = {
  type: "custom",
  render(box, api) {
    const row = document.createElement("label");
    row.className = "row slider";
    const head = document.createElement("span");
    head.className = "row-head";
    const name = document.createElement("span");
    name.textContent = "Hệ số c";
    const out = document.createElement("output");
    head.append(name, out);
    const input = Object.assign(document.createElement("input"), { type: "range", min: -RANGE, max: RANGE, step: STEP });
    row.append(head, input);
    box.append(row);
    const show = () => {
      input.value = api.state.c;
      out.textContent = fmt(api.state.c, 1);
    };
    input.addEventListener("input", () => {
      api.state.c = Number(input.value);
      show();
      api.redraw();
    });
    input.addEventListener("change", () => {
      report(api.state, api);
      api.emit("param", { key: "c", value: api.state.c }, "param");
    });
    return () => {
      api.state.c = clamp(api.state.c, -RANGE, RANGE); // not a kit slider, so clamp host state here
      box.style.display = api.state.kind === "linear" ? "none" : "";
      show();
    };
  },
};

mount({
  slug: "do-thi-ham-so",
  version: "1.0.0",
  title: "Đồ thị hàm số bậc nhất và bậc hai",
  hint: "Chọn dạng hàm số rồi thay đổi các hệ số để xem đồ thị, nghiệm và đỉnh thay đổi thế nào.",
  initialState,
  controls: [
    {
      type: "select",
      key: "kind",
      label: "Dạng hàm số",
      onChange: (s, api) => api.sync(),
      onCommit: report,
      options: [
        { value: "linear", label: "Bậc nhất: y = ax + b" },
        { value: "quadratic", label: "Bậc hai: y = ax² + bx + c" },
      ],
    },
    coefficient("a", "Hệ số a"),
    coefficient("b", "Hệ số b"),
    cSlider,
  ],
  readouts: [
    { label: "Hàm số", value: formula },
    {
      label: "Δ = b² − 4ac",
      value: s => {
        const { delta } = analyze(s);
        return delta === null ? "–" : `${num(delta)} ${delta > 0 ? "> 0" : delta < 0 ? "< 0" : ""}`.trim();
      },
    },
    { label: "Nghiệm (y = 0)", value: s => rootsText(analyze(s)) },
    { label: "Giao với trục Oy", value: s => point(0, analyze(s).yIntercept) },
    {
      label: "Đỉnh I",
      value: s => {
        const { vertex } = analyze(s);
        return vertex ? point(vertex.x, vertex.y) : "–";
      },
    },
    {
      label: "Trục đối xứng",
      value: s => {
        const { vertex } = analyze(s);
        return vertex ? `x = ${num(vertex.x)}` : "–";
      },
    },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const r = analyze(s);
    const ppu = Math.min(w, h) / 12; // pixels per unit, same on both axes
    const X = x => w / 2 + x * ppu;
    const Y = y => h / 2 - y * ppu;
    const xMax = w / 2 / ppu;
    const yMax = h / 2 / ppu;
    const visible = (x, y) => Math.abs(x) <= xMax && Math.abs(y) <= yMax;

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -Math.floor(xMax); i <= xMax; i++) {
      ctx.moveTo(X(i), 0);
      ctx.lineTo(X(i), h);
    }
    for (let i = -Math.floor(yMax); i <= yMax; i++) {
      ctx.moveTo(0, Y(i));
      ctx.lineTo(w, Y(i));
    }
    ctx.stroke();

    // axes
    arrow(ctx, 0, h / 2, w - 3, h / 2, COLORS.ink, 1.5);
    arrow(ctx, w / 2, h, w / 2, 3, COLORS.ink, 1.5);
    label(ctx, "x", w - 12, h / 2 - 14, { bold: true });
    label(ctx, "y", w / 2 + 12, 12, { bold: true });
    label(ctx, "O", w / 2 - 11, h / 2 + 12, { size: 12, color: COLORS.muted });
    const every = ppu < 34 ? 2 : 1;
    const ticks = { size: 11, color: COLORS.muted };
    for (let i = -Math.floor(xMax - 0.4); i <= xMax - 0.4; i++) {
      if (i && i % every === 0) label(ctx, num(i, 0), X(i), h / 2 + 12, { ...ticks, align: "center" });
    }
    for (let i = -Math.floor(yMax - 0.4); i <= yMax - 0.4; i++) {
      if (i && i % every === 0) label(ctx, num(i, 0), w / 2 - 7, Y(i), { ...ticks, align: "right" });
    }

    const up = r.type === "quadratic" ? s.a > 0 : true;
    const below = h / 2 + 30; // under the tick numbers
    const above = h / 2 - 16;

    // axis of symmetry
    if (r.vertex && Math.abs(r.vertex.x) <= xMax) {
      ctx.strokeStyle = COLORS.purple;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(X(r.vertex.x), 0);
      ctx.lineTo(X(r.vertex.x), h);
      ctx.stroke();
      ctx.setLineDash([]);
      tag(ctx, `x = ${num(r.vertex.x)}`, X(r.vertex.x) - 7, up ? h - 14 : 14, { color: COLORS.purple, align: "right", size: 12 });
    }

    // curve
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let px = 0; px <= w + 2; px += 2) {
      const py = clamp(Y(evaluate(s, (px - w / 2) / ppu)), -h, 2 * h);
      if (px) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();

    const dot = (x, y, color) => {
      if (!visible(x, y)) return false;
      ctx.fillStyle = color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(x), Y(y), 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return true;
    };

    // intersection with Oy
    const slope = r.type === "quadratic" ? s.b : (r.slope ?? 0);
    const atVertex = r.vertex && r.vertex.x === 0;
    if (dot(0, r.yIntercept, COLORS.green) && r.yIntercept !== 0 && !atVertex) {
      tag(ctx, point(0, r.yIntercept), X(0) + 10, Y(r.yIntercept) + (slope > 0 ? 15 : -15), { color: COLORS.green });
    }

    // vertex
    if (r.vertex && dot(r.vertex.x, r.vertex.y, COLORS.purple)) {
      const text = `I${point(r.vertex.x, r.vertex.y)}`;
      if (r.delta === 0) tag(ctx, text, X(r.vertex.x) + 9, up ? below : above, { color: COLORS.purple });
      else tag(ctx, text, X(r.vertex.x) + 9, Y(r.vertex.y) + (up ? 18 : -18), { color: COLORS.purple });
    }

    // roots
    const names = r.roots.length === 2 ? ["x₁", "x₂"] : [r.type === "quadratic" ? "x₁ = x₂" : "x"];
    r.roots.forEach((x, i) => {
      if (!dot(x, 0, COLORS.red)) return;
      // free side of the axis: outside the parabola, or behind the line
      const y = (r.type === "quadratic" ? up : r.slope < 0) ? below : above;
      const right = i === 1;
      tag(ctx, `${names[i]} ${eq(x)}`, X(x) + (right ? 8 : -8), y, { color: COLORS.red, align: right ? "left" : "right" });
    });

    // formula box; on a narrow canvas only the formula, kept clear of the y axis
    const small = w < 520;
    const lines = small ? [formula(s)] : [formula(s), note(r)];
    let size = small ? 14 : 17;
    const widest = () => Math.max(...lines.map((text, i) => {
      ctx.font = i ? `${size - 3}px ${FONT}` : `600 ${size}px ${FONT}`;
      return ctx.measureText(text).width;
    }));
    if (small) size = Math.min(size, (size * (w / 2 - 50)) / widest());
    const boxW = widest() + 24;
    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(10, 10, boxW, size * (lines.length * 1.3 + 0.3) + 8, 10);
    ctx.fill();
    ctx.stroke();
    label(ctx, lines[0], 22, 14 + size * 0.85, { size, bold: true, color: COLORS.blue });
    if (lines[1]) label(ctx, lines[1], 22, 14 + size * 2.15, { size: size - 3, color: COLORS.muted });
  },
});
