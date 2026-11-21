import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { LIMIT, NAMES, initialState, describe, images, classify, signedArea, moveVertex, usePreset, sanitize } from "./model.js";

const ORIGINAL = COLORS.blue;
const MIDDLE = COLORS.purple;
const IMAGE = COLORS.red;
const AXES = { ox: "trục Ox", oy: "trục Oy", yx: "đường thẳng y = x" };

const pt = (x, y) => `(${fmt(x)}; ${fmt(y)})`;
const centre = t => (t.cx || t.cy ? `I${pt(t.cx, t.cy)}` : "O");
const line = t => AXES[t.axis] ?? `đường thẳng ${t.axis === "vertical" ? "x" : "y"} = ${fmt(t.m)}`;

function name(t) {
  if (t.kind === "translate") return `Phép tịnh tiến theo vectơ v = ${pt(t.tx, t.ty)}`;
  if (t.kind === "reflect") return `Phép đối xứng trục, trục là ${line(t)}`;
  if (t.kind === "central") return `Phép đối xứng tâm ${centre(t)}`;
  return `Phép quay tâm ${centre(t)}, góc ${fmt(t.angle, 0)}°`;
}

function equivalent(c) {
  if (c.type === "identity") return "phép đồng nhất (hình không đổi)";
  if (c.type === "translate") return `phép tịnh tiến theo ${pt(c.tx, c.ty)}`;
  if (c.type === "central") return `phép đối xứng tâm ${c.cx || c.cy ? pt(c.cx, c.cy) : "O"} (quay 180°)`;
  if (c.type === "rotate") return `phép quay tâm ${c.cx || c.cy ? pt(c.cx, c.cy) : "O"}, góc ${fmt(c.angle, 1)}°`;
  if (c.type === "reflect") return "một phép đối xứng trục";
  return `phép đối xứng trục rồi tịnh tiến ${pt(...c.shift)} dọc theo trục`;
}

const list = (pts, mark) => pts.map((p, i) => `${NAMES[i]}${mark}${pt(p[0], p[1])}`).join(" ");

// ---------- events ----------
const report = (s, api) => {
  const img = images(s).final[0];
  api.emit("image", { x: img[0], y: img[1], code: describe(s, 1).code, code2: s.compose ? describe(s, 2).code : 0 }, "result");
};
const transformChanged = (s, api) => {
  api.emit("transform-changed", { code: describe(s, 1).code, code2: s.compose ? describe(s, 2).code : 0 }, "action");
  report(s, api);
};
const vertexDropped = (s, api) => {
  const p = s.points[s.sel];
  api.emit("vertex-moved", { vertex: s.sel + 1, x: p[0], y: p[1] }, "action");
  report(s, api);
};

// ---------- layout ----------
function fitHalf(s) {
  const { first, second } = images(s);
  let m = 5;
  for (const p of [...s.points, ...first, ...(second ?? [])]) m = Math.max(m, Math.abs(p[0]), Math.abs(p[1]));
  for (const n of s.compose ? [1, 2] : [1]) {
    const t = describe(s, n);
    m = Math.max(m, Math.abs(t.cx), Math.abs(t.cy), t.kind === "reflect" ? Math.abs(t.m) : 0);
  }
  return Math.min(30, Math.ceil(m) + 1);
}

function layout(s, view) {
  const small = view.w < 520 || view.h < 400;
  const side = view.w - view.h >= 150 ? Math.min(250, view.w - view.h) : 0; // room for a coordinate list
  const head = small ? 22 : 30;
  const half = s._half ?? fitHalf(s);
  const areaW = view.w - side;
  const scale = Math.min(areaW - 16, view.h - head - 10) / (2 * half);
  const ox = areaW / 2;
  const oy = head + (view.h - head) / 2;
  return { small, side, half, scale, X: x => ox + x * scale, Y: y => oy - y * scale, fromX: px => (px - ox) / scale, fromY: py => (oy - py) / scale, ox, oy };
}

// ---------- drawing ----------
function polygon(ctx, L, pts, color, { dashed = false, fill = 0.18 } = {}) {
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(L.X(x), L.Y(y)) : ctx.moveTo(L.X(x), L.Y(y))));
  ctx.closePath();
  ctx.globalAlpha = fill;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.restore();
}

function dashedLine(ctx, x1, y1, x2, y2, color, width = 1.2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function grid(ctx, L, view) {
  const h = L.half;
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.grid;
  ctx.beginPath();
  for (let i = -h; i <= h; i++) {
    ctx.moveTo(L.X(i), L.Y(-h));
    ctx.lineTo(L.X(i), L.Y(h));
    ctx.moveTo(L.X(-h), L.Y(i));
    ctx.lineTo(L.X(h), L.Y(i));
  }
  ctx.stroke();
  arrow(ctx, L.X(-h), L.Y(0), L.X(h) + 8, L.Y(0), COLORS.muted, 1.5);
  arrow(ctx, L.X(0), L.Y(-h), L.X(0), L.Y(h) - 8, COLORS.muted, 1.5);
  const t = L.small ? 10 : 11;
  label(ctx, "x", L.X(h) + 4, L.Y(0) + 12, { size: t + 2, color: COLORS.muted });
  label(ctx, "y", L.X(0) + 9, L.Y(h) - 4, { size: t + 2, color: COLORS.muted });
  label(ctx, "O", L.X(0) - 9, L.Y(0) + 10, { size: t + 1, color: COLORS.muted, align: "center" });
  const every = L.scale * 2 >= 26 ? 2 : L.scale * 5 >= 26 ? 5 : 10;
  for (let i = -h + 1; i < h; i++) {
    if (!i || i % every) continue;
    label(ctx, fmt(i), L.X(i), L.Y(0) + 10, { size: t, align: "center", color: COLORS.muted });
    label(ctx, fmt(i), L.X(0) - 5, L.Y(i), { size: t, align: "right", color: COLORS.muted });
  }
}

// The line, centre or vector of one transformation, drawn for its first vertex `from` → `to`.
function guide(ctx, L, t, from, to, color, second) {
  const h = L.half;
  if (t.kind === "reflect") {
    const ends = {
      ox: [[-h, 0], [h, 0]],
      oy: [[0, -h], [0, h]],
      yx: [[-h, -h], [h, h]],
      vertical: [[t.m, -h], [t.m, h]],
      horizontal: [[-h, t.m], [h, t.m]],
    }[t.axis];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(L.X(ends[0][0]), L.Y(ends[0][1]));
    ctx.lineTo(L.X(ends[1][0]), L.Y(ends[1][1]));
    ctx.stroke();
    ctx.restore();
    const tag = { ox: "", oy: "", yx: "y = x", vertical: `x = ${fmt(t.m)}`, horizontal: `y = ${fmt(t.m)}` }[t.axis];
    // the second line is labelled at its other end, so two parallel lines never share a label spot
    const end = ends[second ? 0 : 1];
    const flat = t.axis === "horizontal";
    if (tag) label(ctx, `${second ? "d′" : "d"}: ${tag}`, L.X(end[0]) + (flat ? (second ? 4 : -4) : 6), L.Y(end[1]) + (flat ? -10 : second ? -10 : 10), { size: L.small ? 11 : 13, color, bold: true, align: flat && !second ? "right" : "left" });
    return;
  }
  if (t.kind === "translate") {
    arrow(ctx, L.X(from[0]), L.Y(from[1]), L.X(to[0]), L.Y(to[1]), color, 2.5);
    label(ctx, "v", (L.X(from[0]) + L.X(to[0])) / 2 + 8, (L.Y(from[1]) + L.Y(to[1])) / 2 - 10, { size: 15, color, bold: true });
    return;
  }
  // rotation and central symmetry: the centre, and the turn of the first vertex
  const cx = L.X(t.cx);
  const cy = L.Y(t.cy);
  dashedLine(ctx, cx, cy, L.X(from[0]), L.Y(from[1]), color, 1.5);
  dashedLine(ctx, cx, cy, L.X(to[0]), L.Y(to[1]), color, 1.5);
  const a0 = Math.atan2(-(from[1] - t.cy), from[0] - t.cx);
  const turn = t.kind === "central" ? 180 : t.angle;
  if (Math.hypot(from[0] - t.cx, from[1] - t.cy) > 0.01 && turn % 360) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const r = Math.min(26, Math.hypot(L.X(from[0]) - cx, L.Y(from[1]) - cy) * 0.6);
    ctx.arc(cx, cy, r, a0, a0 - (turn * Math.PI) / 180, turn > 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  if (t.cx || t.cy) label(ctx, "I", cx + 8, cy + 10, { size: 14, color, bold: true });
}

function names(ctx, L, pts, mark, color, avoid) {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  pts.forEach((p, i) => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const k = Math.hypot(dx, dy) || 1;
    const x = L.X(p[0]) + (dx / k) * 13;
    const y = L.Y(p[1]) - (dy / k) * 13;
    if (avoid?.some(q => Math.hypot(L.X(q[0]) - L.X(p[0]), L.Y(q[1]) - L.Y(p[1])) < 2)) return; // same spot: one name is enough
    label(ctx, NAMES[i] + mark, x, y, { size: L.small ? 12 : 14, align: "center", bold: true, color });
  });
}

function links(ctx, L, a, b, color) {
  a.forEach((p, i) => dashedLine(ctx, L.X(p[0]), L.Y(p[1]), L.X(b[i][0]), L.Y(b[i][1]), color, 1));
}

// ---------- controls ----------
function group(k, heading) {
  const v = key => s => s[`kind${k}`] === key;
  const on = k ? s => s.compose : () => true;
  const both = (...f) => s => f.every(g => g(s));
  const turn = s => s[`kind${k}`] === "rotate" || s[`kind${k}`] === "central";
  const num = (key, text, min, max, step, more = {}) => ({ type: "slider", key: key + k, label: text, min, max, step, digits: 1, onCommit: transformChanged, ...more });
  return [
    { type: "heading", label: heading, visible: on },
    {
      type: "select",
      key: `kind${k}`,
      label: k ? "Sau đó thực hiện" : "Phép biến hình",
      visible: on,
      onCommit: transformChanged,
      options: [
        { value: "translate", label: "Phép tịnh tiến" },
        { value: "reflect", label: "Phép đối xứng trục" },
        { value: "rotate", label: "Phép quay" },
        { value: "central", label: "Phép đối xứng tâm" },
      ],
    },
    num("tx", "Hoành độ của vectơ v", -6, 6, 1, { visible: both(on, v("translate")) }),
    num("ty", "Tung độ của vectơ v", -6, 6, 1, { visible: both(on, v("translate")) }),
    {
      type: "select",
      key: `axis${k}`,
      label: "Trục đối xứng d",
      visible: both(on, v("reflect")),
      onCommit: transformChanged,
      options: [
        { value: "ox", label: "Trục Ox" },
        { value: "oy", label: "Trục Oy" },
        { value: "yx", label: "Đường thẳng y = x" },
        { value: "vertical", label: "Đường thẳng x = m (song song Oy)" },
        { value: "horizontal", label: "Đường thẳng y = m (song song Ox)" },
      ],
    },
    num("m", "m", -5, 5, 0.5, { visible: both(on, v("reflect"), s => s[`axis${k}`] === "vertical" || s[`axis${k}`] === "horizontal") }),
    {
      type: "select",
      key: `center${k}`,
      label: "Tâm",
      visible: both(on, turn),
      onCommit: transformChanged,
      options: [
        { value: "origin", label: "Gốc tọa độ O" },
        { value: "point", label: "Điểm I tự chọn" },
      ],
    },
    num("cx", "Hoành độ của I", -5, 5, 1, { visible: both(on, turn, s => s[`center${k}`] === "point") }),
    num("cy", "Tung độ của I", -5, 5, 1, { visible: both(on, turn, s => s[`center${k}`] === "point") }),
    {
      type: "select",
      key: `angle${k}`,
      label: "Góc quay",
      visible: both(on, v("rotate")),
      onCommit: transformChanged,
      options: [
        { value: 90, label: "90°" },
        { value: 180, label: "180°" },
        { value: 270, label: "270° (bằng −90°)" },
        { value: 0, label: "Góc tùy ý" },
      ],
    },
    num("free", "Góc tùy ý (dương: ngược chiều kim đồng hồ)", -180, 180, 5, { digits: 0, unit: "°", visible: both(on, v("rotate"), s => s[`angle${k}`] === 0) }),
  ];
}

// Buttons A, B, C… to pick the vertex the two sliders move (rebuilt when the vertex count changes).
const vertexPicker = {
  type: "custom",
  render(box, api) {
    box.append(Object.assign(document.createElement("span"), { textContent: "Đỉnh đang chọn (hoặc kéo đỉnh trên hình)" }));
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px";
    box.append(row);
    return () => {
      const s = api.state;
      if (row.childElementCount !== s.points.length) {
        row.replaceChildren(
          ...s.points.map((_, i) => {
            const b = Object.assign(document.createElement("button"), { type: "button", textContent: NAMES[i] });
            b.style.flex = "1";
            b.addEventListener("click", () => {
              api.state.sel = i;
              [api.state.vx, api.state.vy] = api.state.points[i];
              api.sync();
              api.emit("param", { key: "sel", value: i }, "param");
            });
            return b;
          })
        );
      }
      [...row.children].forEach((b, i) => b.classList.toggle("primary", i === s.sel));
    };
  },
};

const moveSelected = s => moveVertex(s, s.sel, s.vx, s.vy);

mount({
  slug: "phep-bien-hinh",
  version: "1.0.0",
  title: "Phép tịnh tiến, đối xứng và quay",
  hint: "Kéo các đỉnh của hình xanh. Hình đỏ là ảnh của nó qua phép biến hình đã chọn; đường nét đứt nối mỗi đỉnh với ảnh của nó.",
  initialState,
  sanitize,
  controls: [
    {
      type: "select",
      key: "preset",
      label: "Hình ban đầu",
      onChange: (s, api) => usePreset(s, s.preset),
      onCommit: report,
      options: [
        { value: "triangle", label: "Tam giác ABC" },
        { value: "quad", label: "Tứ giác ABCD" },
        { value: "pentagon", label: "Ngũ giác ABCDE" },
      ],
    },
    vertexPicker,
    { type: "slider", key: "vx", label: "Hoành độ của đỉnh", min: -LIMIT, max: LIMIT, step: 1, digits: 0, onChange: moveSelected, onCommit: vertexDropped },
    { type: "slider", key: "vy", label: "Tung độ của đỉnh", min: -LIMIT, max: LIMIT, step: 1, digits: 0, onChange: moveSelected, onCommit: vertexDropped },
    ...group("", "Phép biến hình"),
    { type: "checkbox", key: "compose", label: "Thực hiện liên tiếp hai phép biến hình", onCommit: transformChanged },
    ...group("2", "Phép thứ hai"),
  ],
  readouts: [
    { label: "Hình gốc", value: s => list(s.points, "") },
    { label: "Ảnh", value: s => list(images(s).final, s.compose ? "″" : "′") },
    { label: "Diện tích hình gốc / ảnh", value: s => `${fmt(Math.abs(signedArea(s.points)))} / ${fmt(Math.abs(signedArea(images(s).final)))}` },
    { label: "Tương đương với", value: s => equivalent(classify(images(s).M)) },
  ],
  pointer: {
    down(p, s, api, view) {
      const L = layout(s, view);
      let best = -1;
      let dist = 20;
      s.points.forEach((q, i) => {
        const d = Math.hypot(p.x - L.X(q[0]), p.y - L.Y(q[1]));
        if (d < dist) [best, dist] = [i, d];
      });
      if (best < 0) return false;
      s._drag = best;
      s._half = L.half; // keep the zoom while dragging
      moveVertex(s, best, ...s.points[best]);
      api.sync();
      return true;
    },
    move(p, s, api, view) {
      const L = layout(s, view);
      moveVertex(s, s._drag, L.fromX(p.x), L.fromY(p.y));
      api.sync();
    },
    up(p, s, api) {
      s._drag = null;
      s._half = null;
      vertexDropped(s, api);
    },
  },
  draw(ctx, s, view) {
    const L = layout(s, view);
    const t1 = describe(s, 1);
    const t2 = s.compose ? describe(s, 2) : null;
    const { first, second, final } = images(s);
    grid(ctx, L, view);

    guide(ctx, L, t1, s.points[0], first[0], s.compose ? MIDDLE : IMAGE, false);
    if (t2) guide(ctx, L, t2, first[0], second[0], IMAGE, true);
    links(ctx, L, s.points, first, s.compose ? MIDDLE : IMAGE);
    if (second) links(ctx, L, first, second, IMAGE);

    polygon(ctx, L, s.points, ORIGINAL);
    if (second) polygon(ctx, L, first, MIDDLE, { dashed: true, fill: 0.08 });
    polygon(ctx, L, final, IMAGE);

    names(ctx, L, s.points, "", ORIGINAL);
    if (second) names(ctx, L, first, "′", MIDDLE);
    names(ctx, L, final, second ? "″" : "′", IMAGE);

    // drag handles
    s.points.forEach((q, i) => {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = ORIGINAL;
      ctx.lineWidth = i === s.sel ? 3 : 2;
      ctx.beginPath();
      ctx.arc(L.X(q[0]), L.Y(q[1]), i === s.sel ? 7 : 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // what is applied, on top
    const size = L.small ? 12 : 15;
    const head = t2 ? `${name(t1)}, rồi ${name(t2).charAt(0).toLowerCase()}${name(t2).slice(1)}` : name(t1);
    ctx.save();
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    const fits = ctx.measureText(head).width < view.w - 16;
    ctx.restore();
    label(ctx, fits ? head : t2 ? "Thực hiện liên tiếp hai phép biến hình (xem bên dưới)" : head, view.w / 2, L.small ? 11 : 16, { size: fits ? size : size - 1, align: "center", bold: true });

    // coordinate list beside the grid when there is room
    if (L.side) {
      const x = view.w - L.side + 8;
      let y = 54;
      const row = (text, color, bold = false) => {
        label(ctx, text, x, y, { size: 14, color, bold });
        y += 21;
      };
      row("Tọa độ các đỉnh", COLORS.ink, true);
      s.points.forEach((p, i) => {
        const chain = [`${NAMES[i]}${pt(...p)}`, second ? `${NAMES[i]}′${pt(...first[i])}` : null, `${NAMES[i]}${second ? "″" : "′"}${pt(...final[i])}`].filter(Boolean);
        row(chain[0], ORIGINAL);
        if (second) row(`→ ${chain[1]}`, MIDDLE);
        row(`→ ${chain.at(-1)}`, IMAGE);
        y += 4;
      });
    }
  },
});
