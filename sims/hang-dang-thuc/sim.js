import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, IDENTITIES, IDENTITY_KEYS, AB_MAX, NEEDS_A_GE_B, normalize, step as advance, quizItems, quizSolved } from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const PALETTE = {
  "binh-phuong-tong": [COLORS.blue, COLORS.orange, COLORS.green],
  "binh-phuong-hieu": [COLORS.blue, COLORS.orange, COLORS.green],
  "hieu-hai-binh-phuong": [COLORS.blue, COLORS.orange],
  "lap-phuong-tong": [COLORS.blue, COLORS.orange, COLORS.purple, COLORS.green],
};
const NAMES = {
  "binh-phuong-tong": "Bình phương của một tổng",
  "binh-phuong-hieu": "Bình phương của một hiệu",
  "hieu-hai-binh-phuong": "Hiệu hai bình phương",
  "lap-phuong-tong": "Lập phương của một tổng",
};
const ease = t => t * t * (3 - 2 * t);
const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;
const items = s => (IDENTITIES[s.identity].solid ? IDENTITIES[s.identity].blocks(s.a, s.b) : IDENTITIES[s.identity].pieces(s.a, s.b));

// Quiz labels are transient: one term index per piece, −1 = not named yet.
const labelsOf = s => (s._labels?.length === items(s).length ? s._labels : (s._labels = items(s).map(() => -1)));
const resetQuiz = s => {
  s._labels = null;
  s._solved = false;
};

function report(s, api) {
  const I = IDENTITIES[s.identity];
  api.emit("identity-checked", { identity: IDENTITY_KEYS.indexOf(s.identity) + 1, a: s.a, b: s.b, value: I.value(s.a, s.b) }, "result");
}

// The numeric check, as [short, long] variants of two lines.
function numeric(s) {
  const { a, b } = s;
  const A = fmt(a, 2);
  const B = fmt(b, 2);
  const v = x => fmt(x, 3);
  const I = IDENTITIES[s.identity];
  const V = v(I.value(a, b));
  switch (s.identity) {
    case "binh-phuong-tong":
      return [`(${A} + ${B})² = ${V}`, `${A}² + 2·${A}·${B} + ${B}² = ${v(a * a)} + ${v(2 * a * b)} + ${v(b * b)} = ${V}`, `${A}² + 2·${A}·${B} + ${B}² = ${V}`];
    case "binh-phuong-hieu":
      return [`(${A} − ${B})² = ${V}`, `${A}² − 2·${A}·${B} + ${B}² = ${v(a * a)} − ${v(2 * a * b)} + ${v(b * b)} = ${V}`, `${A}² − 2·${A}·${B} + ${B}² = ${V}`];
    case "hieu-hai-binh-phuong":
      return [`${A}² − ${B}² = ${v(a * a)} − ${v(b * b)} = ${V}`, `(${A} − ${B})(${A} + ${B}) = ${v(a - b)}·${v(a + b)} = ${V}`, `(${A} − ${B})(${A} + ${B}) = ${V}`];
    default:
      return [`(${A} + ${B})³ = ${V}`, `${A}³ + 3·${A}²·${B} + 3·${A}·${B}² + ${B}³ = ${v(a ** 3)} + ${v(3 * a * a * b)} + ${v(3 * a * b * b)} + ${v(b ** 3)} = ${V}`, `${A}³ + 3·${A}²·${B} + 3·${A}·${B}² + ${B}³ = ${V}`];
  }
}

function fitText(ctx, options, width, size, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  return options.find(t => ctx.measureText(t).width <= width) ?? options.at(-1);
}

function pieceText(ctx, s, k, x, y, wpx, hpx, value) {
  const I = IDENTITIES[s.identity];
  const lab = s.quiz ? labelsOf(s)[k] : items(s)[k].term;
  const text = lab >= 0 ? I.terms[lab] : "?";
  const size = Math.min(18, Math.max(10, Math.min(wpx, hpx) * 0.3));
  ctx.font = `600 ${size}px ${FONT}`;
  if (Math.min(wpx, hpx) < 14 || ctx.measureText(text).width > wpx - 4) return;
  const showValue = !s.quiz && hpx > size * 3.2;
  label(ctx, text, x, y - (showValue ? size * 0.55 : 0), { size, bold: true, align: "center", color: lab >= 0 ? COLORS.ink : COLORS.muted });
  if (showValue) label(ctx, `= ${fmt(value, 3)}`, x, y + size * 0.6, { size: size * 0.75, align: "center", color: COLORS.muted });
}

// Measure line with end ticks and a name, `out` = unit vector pointing away from the figure.
function dim(ctx, x1, y1, x2, y2, text, out, size) {
  const d = 10;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1 + out[0] * d, y1 + out[1] * d);
  ctx.lineTo(x2 + out[0] * d, y2 + out[1] * d);
  for (const [x, y] of [[x1, y1], [x2, y2]]) {
    ctx.moveTo(x + out[0] * (d - 4), y + out[1] * (d - 4));
    ctx.lineTo(x + out[0] * (d + 4), y + out[1] * (d + 4));
  }
  ctx.stroke();
  if (Math.hypot(x2 - x1, y2 - y1) < 8) return;
  label(ctx, text, (x1 + x2) / 2 + out[0] * (d + 11), (y1 + y2) / 2 + out[1] * (d + 9), { size, align: "center", color: COLORS.ink, bold: true });
}

// ---------- 2D pieces ----------
function layout2d(s, box) {
  const I = IDENTITIES[s.identity];
  const ps = I.pieces(s.a, s.b);
  let W = s.a;
  let H = s.a;
  for (const p of ps) for (const r of [p.from, p.to]) {
    W = Math.max(W, r.x + r.w);
    H = Math.max(H, r.y + r.h);
  }
  const k = Math.min(box.w / W, box.h / H, 60);
  return { ps, k, ox: box.x + (box.w - W * k) / 2, oy: box.y + (box.h - H * k) / 2 };
}

// Where piece n is at the current t: centre, angle (rad), size in px.
function place(L, p, t) {
  const e = ease(t);
  const c0 = [p.from.x + p.from.w / 2, p.from.y + p.from.h / 2];
  const c1 = [p.to.x + p.to.w / 2, p.to.y + p.to.h / 2];
  return {
    x: L.ox + L.k * (c0[0] + (c1[0] - c0[0]) * e),
    y: L.oy + L.k * (c0[1] + (c1[1] - c0[1]) * e),
    rot: ((p.to.rot * Math.PI) / 180) * e,
    w: p.from.w * L.k,
    h: p.from.h * L.k,
  };
}

function draw2d(ctx, s, box, small) {
  const I = IDENTITIES[s.identity];
  const L = layout2d(s, box);
  const colors = PALETTE[s.identity];
  const size = small ? 12 : 14;
  if (I.hole) {
    const h = I.hole(s.a, s.b);
    const fade = 1 - ease(s.t);
    if (fade > 0.02 && h.w > 0) {
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(L.ox + h.x * L.k, L.oy + h.y * L.k, h.w * L.k, h.h * L.k);
      ctx.restore();
      if (h.w * L.k > 30) label(ctx, "b²", L.ox + (h.x + h.w / 2) * L.k, L.oy + (h.y + h.h / 2) * L.k, { size, align: "center", color: COLORS.muted });
    }
  }
  L.ps.forEach((p, n) => {
    if (p.from.w <= 0 || p.from.h <= 0) return;
    const q = place(L, p, s.t);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(q.rot);
    ctx.fillStyle = s.quiz ? "rgba(107, 120, 144, 0.15)" : rgba(colors[p.term], 0.28);
    ctx.strokeStyle = s.quiz ? COLORS.muted : colors[p.term];
    ctx.lineWidth = 2;
    ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
    ctx.strokeRect(-q.w / 2, -q.h / 2, q.w, q.h);
    ctx.restore();
    const turned = Math.abs(Math.sin(q.rot)) > 0.7;
    pieceText(ctx, s, n, q.x, q.y, turned ? q.h : q.w, turned ? q.w : q.h, p.from.w * p.from.h);
  });

  // side lengths of the assembled figure, and of the rectangle after rearranging a² − b²
  const { a, b } = s;
  const X = v => L.ox + v * L.k;
  const Y = v => L.oy + v * L.k;
  if (s.t < 0.02) {
    const cuts = {
      "binh-phuong-tong": [[0, a, "a"], [a, a + b, "b"]],
      "binh-phuong-hieu": [[0, a - b, "a − b"], [a - b, a, "b"]],
      "hieu-hai-binh-phuong": [[0, a - b, "a − b"], [a - b, a, "b"]],
    }[s.identity];
    const left = s.identity === "hieu-hai-binh-phuong" ? [[0, b, "b"], [b, a, "a − b"]] : cuts;
    for (const [u, v, t] of cuts) dim(ctx, X(u), Y(0), X(v), Y(0), t, [0, -1], size);
    for (const [u, v, t] of left) dim(ctx, X(0), Y(u), X(0), Y(v), t, [-1, 0], size);
  } else if (s.t > 0.98 && s.identity === "hieu-hai-binh-phuong") {
    dim(ctx, X(0), Y(0), X(a - b), Y(0), "a − b", [0, -1], size);
    dim(ctx, X(0), Y(0), X(0), Y(a), "a", [-1, 0], size);
    dim(ctx, X(0), Y(a), X(0), Y(a + b), "b", [-1, 0], size);
    dim(ctx, X(a - b), Y(0), X(a - b), Y(a + b), "a + b", [1, 0], size);
  }
  return L;
}

// ---------- 3D blocks ----------
const C30 = Math.cos(Math.PI / 6);
function layout3d(s, box) {
  const blocks = IDENTITIES[s.identity].blocks(s.a, s.b);
  const proj = (x, y, z) => [(x - y) * C30, (x + y) * 0.5 - z];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const k of blocks) for (const B of [k.from, k.to]) for (const i of [0, 1]) for (const j of [0, 1]) for (const l of [0, 1]) {
    const [px, py] = proj(B.x + i * B.dx, B.y + j * B.dy, B.z + l * B.dz);
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  const k = Math.min(box.w / (x1 - x0), box.h / (y1 - y0), 40);
  const ox = box.x + (box.w - (x1 - x0) * k) / 2 - x0 * k;
  const oy = box.y + (box.h - (y1 - y0) * k) / 2 - y0 * k;
  const P = (x, y, z) => {
    const [px, py] = proj(x, y, z);
    return [ox + px * k, oy + py * k];
  };
  return { blocks, P };
}

const lerpBox = (k, t) => {
  const e = ease(t);
  const L = key => k.from[key] + (k.to[key] - k.from[key]) * e;
  return { x: L("x"), y: L("y"), z: L("z"), dx: k.from.dx, dy: k.from.dy, dz: k.from.dz };
};
const faces = (B, P) => {
  const { x, y, z, dx, dy, dz } = B;
  return [
    [P(x, y, z + dz), P(x + dx, y, z + dz), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)], // top
    [P(x + dx, y, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x + dx, y, z + dz)], // +x side
    [P(x, y + dy, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)], // +y side
  ];
};
// back to front: the viewer looks from +x, +y, +z
const order = blocks => blocks.map((k, i) => i).sort((i, j) => blocks[i].cell - blocks[j].cell);

function inQuad(p, q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i];
    const [bx, by] = q[(i + 1) % 4];
    const c = (bx - ax) * (p.y - ay) - (by - ay) * (p.x - ax);
    if (Math.abs(c) < 1e-9) continue;
    if (sign && Math.sign(c) !== sign) return false;
    sign = Math.sign(c);
  }
  return sign !== 0;
}

function draw3d(ctx, s, box, small) {
  const L = layout3d(s, box);
  const colors = PALETTE[s.identity];
  for (const i of order(L.blocks)) {
    const k = L.blocks[i];
    if (k.from.dx * k.from.dy * k.from.dz <= 0) continue;
    const B = lerpBox(k, s.t);
    const f = faces(B, L.P);
    const color = s.quiz ? COLORS.muted : colors[k.term];
    f.forEach((quad, n) => {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      quad.forEach(([x, y], m) => (m ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(color, [0.25, 0.45, 0.6][n]);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    const [cx, cy] = L.P(B.x + B.dx / 2, B.y + B.dy / 2, B.z + B.dz);
    const [rx] = L.P(B.x + B.dx, B.y, B.z);
    const [lx] = L.P(B.x, B.y + B.dy, B.z);
    pieceText(ctx, s, i, cx, cy, rx - lx, (rx - lx) * 0.5, k.from.dx * k.from.dy * k.from.dz);
  }
  if (s.t < 0.02) {
    const { a, b } = s;
    const size = small ? 12 : 14;
    const at = (x, y, z, t, dx, dy) => {
      const [px, py] = L.P(x, y, z);
      label(ctx, t, px + dx, py + dy, { size, bold: true, align: "center" });
    };
    // along the front-bottom edges and the front vertical edge
    at(a / 2, a + b, 0, "a", -6, 12);
    at(a + b / 2, a + b, 0, "b", -6, 12);
    at(a + b, a / 2, 0, "a", 6, 12);
    at(a + b, a + b / 2, 0, "b", 6, 12);
    at(a + b, a + b, a / 2, "a", 12, 0);
    at(a + b, a + b, a + b / 2, "b", 12, 0);
  }
  return L;
}

mount({
  slug: "hang-dang-thuc",
  version: "1.0.0",
  title: "Hằng đẳng thức đáng nhớ",
  hint: "Chọn hằng đẳng thức, đổi a và b. Bật “Tách các mảnh” để xem hình được cắt và ghép lại. Ở chế độ đố, chạm vào từng mảnh để gắn tên.",
  initialState,
  sanitize(incoming, base) {
    const out = { ...base };
    for (const k of Object.keys(base)) if (typeof incoming[k] === typeof base[k]) out[k] = incoming[k];
    return normalize(out);
  },
  step(s, dt, api) {
    if (!advance(s, dt)) api.pause();
  },
  controls: [
    {
      type: "select",
      key: "identity",
      label: "Hằng đẳng thức",
      options: IDENTITY_KEYS.map(k => ({ value: k, label: `${NAMES[k]}: ${IDENTITIES[k].lhs} = ${IDENTITIES[k].rhs}` })),
      onChange: s => (normalize(s), resetQuiz(s)),
      onCommit: report,
    },
    { type: "slider", key: "a", label: "a", min: 0.5, max: AB_MAX, step: 0.5, digits: 1, onChange: normalize, onCommit: report },
    {
      type: "slider",
      key: "b",
      label: "b",
      min: 0,
      max: AB_MAX,
      step: 0.5,
      onChange: normalize,
      onCommit: report,
      format: (v, s) => (NEEDS_A_GE_B.has(s.identity) ? `${fmt(v, 1)} (hình vẽ cần b ≤ a)` : fmt(v, 1)),
    },
    { type: "checkbox", key: "apart", label: "Tách các mảnh / sắp xếp lại", onChange: (s, api) => api.play() },
    {
      type: "checkbox",
      key: "quiz",
      label: "Đố: gắn tên cho từng mảnh",
      onChange(s, api) {
        resetQuiz(s);
        if (s.quiz) {
          s.apart = true;
          api.play();
        }
      },
    },
  ],
  readouts: [
    { label: "Vế trái", value: s => `${IDENTITIES[s.identity].lhs} = ${fmt(IDENTITIES[s.identity].value(s.a, s.b), 3)}` },
    { label: "Vế phải", value: s => `${IDENTITIES[s.identity].rhs} = ${fmt(IDENTITIES[s.identity].parts(s.a, s.b).reduce((x, y) => x + y, 0), 3)}` },
  ],
  pointer: {
    down(p, s, api, view) {
      if (!s.quiz) return false;
      const g = geom(s, view);
      const I = IDENTITIES[s.identity];
      let hit = -1;
      if (I.solid) {
        const L = layout3d(s, g.box);
        for (const i of order(L.blocks).reverse()) {
          const k = L.blocks[i];
          if (k.from.dx * k.from.dy * k.from.dz > 0 && faces(lerpBox(k, s.t), L.P).some(q => inQuad(p, q))) {
            hit = i;
            break;
          }
        }
      } else {
        const L = layout2d(s, g.box);
        L.ps.forEach((piece, n) => {
          if (piece.from.w <= 0 || piece.from.h <= 0) return;
          const q = place(L, piece, s.t);
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const u = dx * Math.cos(q.rot) + dy * Math.sin(q.rot);
          const v = -dx * Math.sin(q.rot) + dy * Math.cos(q.rot);
          if (Math.abs(u) <= q.w / 2 && Math.abs(v) <= q.h / 2) hit = n;
        });
      }
      if (hit < 0) return false;
      const labels = labelsOf(s);
      labels[hit] = (labels[hit] + 1) % I.terms.length;
      s._taps = (s._taps ?? 0) + 1;
      api.emit("label-piece", { piece: hit + 1, term: labels[hit] + 1 }, "action");
      if (!s._solved && quizSolved(s.identity, s.a, s.b, labels) && quizItems(s.identity, s.a, s.b).length) {
        s._solved = true;
        api.emit("pieces-matched", { identity: IDENTITY_KEYS.indexOf(s.identity) + 1, taps: s._taps }, "goal");
      }
      return false; // a tap, not a drag
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const I = IDENTITIES[s.identity];
    const small = g.small;

    label(ctx, `${I.lhs} = ${I.rhs}`, view.w / 2, small ? 14 : 24, { size: small ? 16 : 22, bold: true, align: "center" });
    if (!small) label(ctx, NAMES[s.identity], view.w / 2, 48, { size: 13, align: "center", color: COLORS.muted });

    if (I.solid) draw3d(ctx, s, g.box, small);
    else draw2d(ctx, s, g.box, small);

    // numeric check, or the quiz state
    const size = small ? 12 : 14;
    const [first, long, short] = numeric(s);
    const yb = view.h - (small ? 30 : 44);
    if (s.quiz) {
      const n = quizItems(s.identity, s.a, s.b).length;
      const text = s._solved ? "Chính xác! Mỗi mảnh đã đúng tên." : `Chạm vào mảnh để đổi tên: ${I.terms.join(", ")} (${n} mảnh)`;
      label(ctx, fitText(ctx, [text, s._solved ? "Chính xác!" : "Chạm vào mảnh để gắn tên"], view.w - 12, size, true), view.w / 2, yb + (small ? 8 : 12), {
        size,
        bold: true,
        align: "center",
        color: s._solved ? COLORS.green : COLORS.ink,
      });
    } else {
      label(ctx, first, view.w / 2, yb, { size, bold: true, align: "center" });
      label(ctx, fitText(ctx, [long, short], view.w - 12, size, false), view.w / 2, yb + size + 6, { size, align: "center", color: COLORS.blue });
    }
    if (I.solid && !small) label(ctx, "Hình lập phương vẽ phối cảnh; các khối đúng tỉ lệ a, b.", 10, view.h - 10, { size: 11, color: COLORS.muted });
  },
});

function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const top = small ? 36 : 64;
  const bottom = small ? 46 : 64;
  const side = small ? 34 : 60; // room for the side-length marks
  return { small, box: { x: side, y: top + (small ? 14 : 22), w: view.w - 2 * side, h: view.h - top - bottom - (small ? 14 : 22) } };
}
