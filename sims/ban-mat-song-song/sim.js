import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { CORNERS, PRISM, PERISCOPE_H, initialState, slab, prism, periscope, criticalAngle } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MAX_ANGLE = 85;
const rad = d => (d * Math.PI) / 180;
const deg = v => `${fmt(v, 1)}°`;
const isSmall = view => view.w < 520 || view.h < 400;
const tint = n => `rgba(47, 111, 237, ${0.06 + (n - 1) * 0.16})`;
const unit = ([x, y]) => {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
};

// ---------- events ----------

// One result per finished change; the periscope goal fires once each time the learner gets it working.
function commit(s, api) {
  if (s.mode === "slab") {
    const r = slab(s);
    const data = { incidence: r.i, refraction: r.r, shift: r.shift, thickness: r.e, n: r.n };
    api.emit("slab-refraction", data, "result");
  } else if (s.mode === "prism") {
    const p = prism(s);
    const data = { n: p.n, criticalAngle: p.critical, reflections: p.tir, deviation: p.turned, works: p.works ? 1 : 0 };
    api.emit("prism-turn", data, "result");
  } else {
    const p = periscope(s);
    if (p.works && !s.solved) {
      const data = { n: s.prismN, reflections: p.tir };
      api.emit("periscope-working", data, "goal");
    }
    s.solved = p.works;
  }
}

// ---------- world (cm, y up) to screen ----------

/** Uniform scale that fits the window [x0, x1] × [y0, y1] between the text bands. */
function fit(view, [x0, x1, y0, y1], top, bottom) {
  const sc = Math.min((view.w - 12) / (x1 - x0), (view.h - top - bottom) / (y1 - y0));
  const ox = view.w / 2 - ((x0 + x1) / 2) * sc;
  const oy = top + (view.h - top - bottom) / 2 + ((y0 + y1) / 2) * sc;
  return { sc, P: ([x, y]) => [ox + x * sc, oy - y * sc], W: ([px, py]) => [(px - ox) / sc, (oy - py) / sc] };
}

function frame(s, view) {
  const small = isSmall(view);
  const top = small ? 22 : 36;
  const bottom = small ? 38 : 56;
  const e = Math.max(0.1, s.thickness);
  const win = s.mode === "slab"
    ? [-9, 17, e / 2 - 11, e / 2 + 11]
    : s.mode === "prism"
      ? s.turn === 180 ? [-7, 5, -4.5, 4.5] : [-5.5, 7.5, -5, 5.5]
      : [-13.5, 15.5, -5, PERISCOPE_H + 5];
  return { small, top, bottom, size: small ? 12 : 14, ...fit(view, win, top, bottom) };
}

// ---------- drawing helpers ----------

function path(ctx, pts, close) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

/** A light ray along screen points, with an arrowhead on every stretch long enough to carry one. */
function ray(ctx, pts, color = COLORS.red) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = ctx.lineCap = "round";
  path(ctx, pts);
  ctx.stroke();
  for (let k = 0; k < pts.length - 1; k++) {
    const [a, b] = [pts[k], pts[k + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 34) continue;
    const at = Math.min(0.55, 120 / len); // near the start of the very long first and last stretches
    arrow(ctx, a[0], a[1], a[0] + (b[0] - a[0]) * at, a[1] + (b[1] - a[1]) * at, color, 3);
  }
}

function dashed(ctx, a, b, color = COLORS.muted, width = 1.5, dash = [6, 5]) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  path(ctx, [a, b]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * The angle at screen point o between the normal (up: vert = −1, down: vert = +1)
 * and a ray leaning to the left (side = −1) or right (side = +1).
 */
function angleMark(ctx, o, r, vert, side, angle, text, color, size, across = false) {
  const a = rad(angle);
  const dir = t => [side * Math.sin(t), vert * Math.cos(t)];
  const t0 = Math.atan2(vert, 0);
  const t1 = Math.atan2(vert * Math.cos(a), side * Math.sin(a));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(o[0], o[1], r, Math.min(t0, t1), Math.max(t0, t1));
  ctx.stroke();
  if (across) {
    // on the other side of the normal, where no ray passes
    label(ctx, text, o[0] - side * 7, o[1] + vert * Math.max(r * 0.75, 9), { size, color, bold: true, align: side > 0 ? "right" : "left" });
    return;
  }
  // between the normal and the ray when there is room, otherwise outside the ray
  const inside = angle >= 60;
  const [dx, dy] = inside ? dir(a / 2) : dir(Math.min(a + 0.5, Math.PI / 2));
  const rho = inside ? r + 24 : r + 10;
  label(ctx, text, o[0] + dx * rho, o[1] + dy * rho + (inside ? 0 : vert * 4), { size, color, bold: true, align: inside ? "center" : side < 0 ? "right" : "left" });
}

/** Text across the bottom band: the outcome (shrunk to fit) and a note about what the picture leaves out. */
function captions(ctx, view, g, text, color, note) {
  ctx.font = `600 ${g.size + 1}px ${FONT}`;
  const size = Math.min(g.size + 1, ((g.size + 1) * (view.w - 16)) / ctx.measureText(text).width);
  label(ctx, text, view.w / 2, view.h - g.bottom + (g.small ? 13 : 20), { size, color, bold: true, align: "center" });
  const noteSize = g.small ? 11 : 12;
  ctx.font = `${noteSize}px ${FONT}`;
  label(ctx, note, view.w / 2, view.h - (g.small ? 9 : 14), { size: Math.min(noteSize, (noteSize * (view.w - 16)) / ctx.measureText(note).width), color: COLORS.muted, align: "center" });
}

/** Keep the rays out of the text bands. */
const clipBand = (ctx, view, g) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, g.top, view.w, view.h - g.top - g.bottom);
  ctx.clip();
};

// ---------- the three scenes ----------

function drawSlab(ctx, s, view, g) {
  const { P, sc, size, small } = g;
  const r = slab(s);
  const A = P(r.A);
  const B = P(r.B);
  const yTop = A[1];
  const yBottom = B[1];

  ctx.fillStyle = tint(r.n);
  ctx.fillRect(0, yTop, view.w, yBottom - yTop);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  for (const y of [yTop, yBottom]) {
    path(ctx, [[0, y], [view.w, y]]);
    ctx.stroke();
  }
  label(ctx, small ? `Bản mặt song song, n = ${fmt(r.n)}` : `Bản mặt song song: chiết suất n = ${fmt(r.n)}, bề dày e = ${fmt(r.e, 1)} cm`, 10, g.top / 2 + 1, { size, bold: true });
  label(ctx, "Không khí", view.w - 10, yTop - 12, { size: size - 1, color: COLORS.muted, align: "right" });
  label(ctx, "Không khí", view.w - 10, yBottom + 12, { size: size - 1, color: COLORS.muted, align: "right" });

  // thickness e, at the left edge (the rays never pass there)
  const ex = small ? 10 : 20;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.2;
  path(ctx, [[ex, yTop + 3], [ex, yBottom - 3]]);
  ctx.stroke();
  if (yBottom - yTop > 22) label(ctx, `e = ${fmt(r.e, 1)} cm`, ex + 6, (yTop + yBottom) / 2, { size: size - 1, color: COLORS.muted });

  clipBand(ctx, view, g);

  // normals at the two points of incidence
  const nl = Math.min(4.5 * sc, 70);
  dashed(ctx, [A[0], A[1] - nl], [A[0], A[1] + nl * 0.75]);
  dashed(ctx, [B[0], B[1] - nl * 0.75], [B[0], B[1] + nl]);

  // the incident ray continued straight on: where the light would go without the slab
  const far = 60;
  const dir = [r.dir[0], -r.dir[1]]; // screen direction
  dashed(ctx, A, [A[0] + dir[0] * far * sc, A[1] + dir[1] * far * sc], COLORS.red, 1.5, [3, 6]);

  ray(ctx, [[A[0] - dir[0] * far * sc, A[1] - dir[1] * far * sc], A]);
  ray(ctx, [A, B]);
  ray(ctx, [B, [B[0] + dir[0] * far * sc, B[1] + dir[1] * far * sc]]);

  // lateral shift d: the distance between the emerging ray and the incident line
  const w = [A[0] - B[0], A[1] - B[1]];
  const along = w[0] * dir[0] + w[1] * dir[1];
  const perp = [w[0] - along * dir[0], w[1] - along * dir[1]];
  const shiftPx = Math.hypot(...perp);
  if (shiftPx > 5) {
    const k = Math.min(3.2 * sc, (view.h - g.bottom - B[1] - 14) / Math.max(dir[1], 0.05));
    const p1 = [B[0] + dir[0] * k, B[1] + dir[1] * k];
    const p2 = [p1[0] + perp[0], p1[1] + perp[1]];
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 3;
    path(ctx, [p1, p2]);
    ctx.stroke();
    const u = unit(perp);
    for (const p of [p1, p2]) {
      path(ctx, [[p[0] - dir[0] * 5, p[1] - dir[1] * 5], [p[0] + dir[0] * 5, p[1] + dir[1] * 5]]);
      ctx.stroke();
    }
    const right = p2[0] + 12 + 80 < view.w;
    label(ctx, small ? "d" : `d = ${fmt(r.shift)} cm`, right ? p2[0] + u[0] * 4 + 10 : p1[0] - 10, right ? p2[1] + u[1] * 4 - 8 : p1[1] + 4, { size, color: COLORS.orange, bold: true, align: right ? "left" : "right" });
  }

  const ar = clamp(sc * 1.7, 20, 42);
  // a narrow stage has room for the symbols only; the values are in the readouts
  const named = (name, value) => (small ? name : `${name} = ${deg(value)}`);
  angleMark(ctx, A, ar, -1, -1, r.i, named("i", r.i), COLORS.blue, size);
  angleMark(ctx, A, Math.min(ar, (yBottom - yTop) * 0.7), 1, 1, r.r, named("r", r.r), COLORS.purple, size, true);
  angleMark(ctx, B, ar, 1, 1, r.i, named("i′", r.i), COLORS.green, size, true);
  ctx.restore();

  for (const p of [A, B]) {
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  label(ctx, "I", A[0] + 8, A[1] - 10, { size, bold: true });
  label(ctx, "J", B[0] + 8, B[1] - 10, { size, bold: true });

  const text = r.shift < 0.005
    ? "Tia ló trùng với đường kéo dài của tia tới: độ dời d = 0"
    : small
      ? `Tia ló song song tia tới, độ dời d = ${fmt(r.shift)} cm`
      : `Tia ló song song với tia tới; độ dời ngang d = e·sin(i − r)/cos r = ${fmt(r.shift)} cm`;
  captions(ctx, view, g, text, COLORS.ink, small ? "Đúng tỉ lệ. Bỏ qua tia phản xạ ở hai mặt." : "Hình vẽ đúng tỉ lệ. Bỏ qua tia phản xạ một phần ở hai mặt. Kéo phía trên bản để đổi góc tới.");
}

function drawGlass(ctx, g, pts, n) {
  path(ctx, pts.map(g.P), true);
  ctx.fillStyle = tint(n);
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/** Normal and angle labels at every total reflection of a traced ray. */
function markReflections(ctx, g, t, count) {
  t.steps.forEach((step, k) => {
    if (step.kind !== "tir") return;
    const p = t.points[k + 1];
    const din = unit([p[0] - t.points[k][0], p[1] - t.points[k][1]]);
    const dout = unit([t.points[k + 2][0] - p[0], t.points[k + 2][1] - p[1]]);
    const m = unit([dout[0] - din[0], dout[1] - din[1]]); // normal, pointing back into the glass
    dashed(ctx, g.P([p[0] - m[0] * 0.9, p[1] - m[1] * 0.9]), g.P([p[0] + m[0] * 1.5, p[1] + m[1] * 1.5]));
    for (const d of [[-din[0], -din[1]], dout].slice(0, count)) {
      const b = unit([d[0] + m[0], d[1] + m[1]]);
      const at = g.P([p[0] + b[0] * 1.15, p[1] + b[1] * 1.15]);
      label(ctx, `${fmt(step.i, 0)}°`, at[0], at[1], { size: g.size - 2, color: COLORS.blue, bold: true, align: "center" });
    }
  });
}

const tooSmall = (n, small) => {
  const c = deg(criticalAngle(Math.max(1, n)));
  return small ? `i = 45° < i_gh = ${c}: không phản xạ toàn phần` : `i = 45° < i_gh = ${c}: không có phản xạ toàn phần (cần n > √2 ≈ 1,41)`;
};

function drawPrism(ctx, s, view, g) {
  const p = prism(s);
  drawGlass(ctx, g, p.pts, p.n);
  markReflections(ctx, g, p, g.small ? 1 : 2);
  clipBand(ctx, view, g);
  ray(ctx, p.points.map(g.P));
  ctx.restore();
  label(ctx, g.small ? `Lăng kính vuông cân, n = ${fmt(p.n)}` : `Lăng kính tam giác vuông cân, n = ${fmt(p.n)}; góc giới hạn i_gh = ${deg(p.critical)}`, 10, g.top / 2 + 1, { size: g.size, bold: true });
  const [x, y] = g.P(p.points[0]);
  if (!g.small) label(ctx, "Tia tới", Math.max(x, 0) + 14, y - 12, { size: 12, color: COLORS.muted });
  const why = g.small ? "" : `i = 45° > i_gh = ${deg(p.critical)}: `;
  const said = s.turn === 180 ? "phản xạ toàn phần hai lần, tia sáng quay ngược 180°" : "phản xạ toàn phần, tia sáng đổi hướng 90°";
  const text = p.works ? why + (why ? said : said[0].toUpperCase() + said.slice(1)) : tooSmall(p.n, g.small);
  const use = s.turn === 180 ? "Ứng dụng: lăng kính đảo ảnh trong ống nhòm." : "Ứng dụng: thay gương phẳng trong kính tiềm vọng.";
  captions(ctx, view, g, text, p.works ? COLORS.green : COLORS.red, g.small ? use : `${use} Bỏ qua tia phản xạ một phần ở các mặt.`);
}

function drawPeriscope(ctx, s, view, g) {
  const { P, sc, size, small } = g;
  const p = periscope(s);
  const H = PERISCOPE_H;
  const h = PRISM / 2;

  // obstacle between the eye and the object, and the tube that holds the prisms
  const [wx, wy] = P([4.5, H - 3.5]);
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(wx, wy, 2.2 * sc, view.h - g.bottom - wy);
  if (!small) label(ctx, "Vật cản", wx + 1.1 * sc, wy - 10, { size: 12, color: COLORS.muted, align: "center" });
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  for (const x of [-h - 0.5, h + 0.5]) {
    path(ctx, [P([x, h + 0.4]), P([x, H - h - 0.4])]);
    ctx.stroke();
  }

  // object (a tree) at the height of the upper prism, eye at the height of the lower one
  const [tx, ty] = P([13.2, H]);
  ctx.fillStyle = COLORS.green;
  path(ctx, [[tx, ty - 1.9 * sc], [tx - 1.2 * sc, ty + 0.6 * sc], [tx + 1.2 * sc, ty + 0.6 * sc]], true);
  ctx.fill();
  ctx.fillRect(tx - 0.2 * sc, ty + 0.6 * sc, 0.4 * sc, 1.1 * sc);
  label(ctx, "Vật", tx, ty + 2.5 * sc, { size: size - 1, color: COLORS.muted, align: "center" });
  const [ex, ey] = P([-11.5, 0]);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(ex, ey, 1.1 * sc, 0.65 * sc, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(ex + 0.4 * sc, ey, 0.35 * sc, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, "Mắt", ex, ey + 1.8 * sc, { size: size - 1, color: COLORS.muted, align: "center" });

  for (const poly of p.polys) drawGlass(ctx, g, poly.pts, poly.n);
  markReflections(ctx, g, p, small ? 0 : 1);
  clipBand(ctx, view, g);
  ray(ctx, p.points.map(P));
  ctx.restore();
  label(ctx, "Lăng kính 1", P([h + 1, H + h + 0.9])[0], P([h + 1, H + h + 0.9])[1], { size: size - 1, bold: true });
  label(ctx, "Lăng kính 2", P([h + 1, -h - 0.9])[0], P([h + 1, -h - 0.9])[1], { size: size - 1, bold: true });
  label(ctx, small ? `Kính tiềm vọng, n = ${fmt(s.prismN)}` : `Kính tiềm vọng dùng hai lăng kính phản xạ toàn phần, n = ${fmt(s.prismN)}`, 10, g.top / 2 + 1, { size, bold: true });

  const text = p.works
    ? small ? "Hoạt động: phản xạ toàn phần 2 lần, tia sáng tới mắt" : "Kính tiềm vọng hoạt động: hai lần phản xạ toàn phần đưa tia sáng tới mắt"
    : criticalAngle(Math.max(1, s.prismN)) >= 45
      ? tooSmall(s.prismN, small)
      : small ? "Tia sáng chưa tới mắt. Bấm lăng kính để xoay." : "Tia sáng chưa tới mắt. Bấm vào từng lăng kính để xoay nó 90°.";
  captions(ctx, view, g, text, p.works ? COLORS.green : COLORS.red, small ? "Sơ đồ, không đúng tỉ lệ thật." : "Sơ đồ nguyên lí, không đúng tỉ lệ của kính thật. Bỏ qua tia phản xạ một phần ở các mặt.");
}

// ---------- controls ----------

const cornerOptions = [
  { value: "tl", label: "Góc vuông ở trên, bên trái" },
  { value: "tr", label: "Góc vuông ở trên, bên phải" },
  { value: "br", label: "Góc vuông ở dưới, bên phải" },
  { value: "bl", label: "Góc vuông ở dưới, bên trái" },
];
const inMode = (...modes) => s => modes.includes(s.mode);

mount({
  slug: "ban-mat-song-song",
  version: "1.0.0",
  title: "Khúc xạ qua bản mặt song song và lăng kính phản xạ toàn phần",
  hint: "Đổi góc tới, bề dày và chiết suất của bản để xem tia ló dời đi bao nhiêu. Ở chế độ kính tiềm vọng, xoay hai lăng kính để tia sáng tới được mắt.",
  initialState,
  controls: [
    {
      type: "select", key: "mode", label: "Thí nghiệm",
      options: [
        { value: "slab", label: "Bản mặt song song" },
        { value: "prism", label: "Lăng kính phản xạ toàn phần" },
        { value: "periscope", label: "Kính tiềm vọng (hai lăng kính)" },
      ],
    },
    { type: "slider", key: "angle", label: "Góc tới i", min: 0, max: MAX_ANGLE, step: 0.5, unit: "°", digits: 1, visible: inMode("slab") },
    { type: "slider", key: "thickness", label: "Bề dày e", min: 1, max: 10, step: 0.5, unit: "cm", digits: 1, visible: inMode("slab") },
    { type: "slider", key: "n", label: "Chiết suất n của bản", min: 1, max: 2.5, step: 0.01, visible: inMode("slab") },
    {
      type: "select", key: "turn", label: "Đường đi của tia sáng", visible: inMode("prism"),
      options: [
        { value: 90, label: "Đổi hướng 90° (vào mặt bên)" },
        { value: 180, label: "Quay ngược 180° (vào mặt huyền)" },
      ],
    },
    { type: "slider", key: "prismN", label: "Chiết suất n của lăng kính", min: 1.3, max: 2, step: 0.01, visible: inMode("prism", "periscope") },
    { type: "select", key: "top", label: "Lăng kính 1 (phía trên)", options: cornerOptions, visible: inMode("periscope") },
    { type: "select", key: "bottom", label: "Lăng kính 2 (phía dưới)", options: cornerOptions, visible: inMode("periscope") },
  ].map(c => ({ ...c, onCommit: commit })),
  readouts: [
    { label: "Góc khúc xạ r", value: s => (s.mode === "slab" ? deg(slab(s).r) : "–") },
    { label: "Góc ló i′", value: s => (s.mode === "slab" ? deg(slab(s).i) : "–") },
    { label: "Độ dời ngang d", value: s => (s.mode === "slab" ? `${fmt(slab(s).shift)} cm` : "–") },
    { label: "Góc giới hạn i_gh (sin i_gh = 1/n)", value: s => deg(criticalAngle(Math.max(1, s.mode === "slab" ? s.n : s.prismN))) },
    { label: "Số lần phản xạ toàn phần", value: s => (s.mode === "slab" ? "–" : fmt((s.mode === "prism" ? prism(s) : periscope(s)).tir, 0)) },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = frame(s, view);
      if (s.mode === "slab") {
        if (p.y > g.P(slab(s).A)[1]) return false;
        s._aim = true;
        this.move(p, s, api, view);
        return true;
      }
      if (s.mode !== "periscope") return false;
      // a tap on a prism turns it a quarter turn clockwise
      const [x, y] = g.W([p.x, p.y]);
      const reach = PRISM / 2 + 0.8;
      const key = Math.abs(x) > reach ? null : Math.abs(y - PERISCOPE_H) <= reach ? "top" : Math.abs(y) <= reach ? "bottom" : null;
      if (!key) return false;
      s[key] = CORNERS[(CORNERS.indexOf(s[key]) + 1) % 4];
      const data = { prism: key === "top" ? 1 : 2 };
      api.emit("rotate-prism", data, "action");
      commit(s, api);
      return true;
    },
    move(p, s, api, view) {
      if (!s._aim) return;
      const [ax, ay] = frame(s, view).P(slab(s).A);
      const a = (Math.atan2(ax - p.x, ay - p.y) * 180) / Math.PI;
      s.angle = clamp(Math.round(a * 2) / 2, 0, MAX_ANGLE);
    },
    up(p, s, api) {
      if (!s._aim) return;
      s._aim = false;
      const data = { angle: s.angle };
      api.emit("aim", data, "action");
      commit(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = frame(s, view);
    if (s.mode === "slab") drawSlab(ctx, s, view, g);
    else if (s.mode === "prism") drawPrism(ctx, s, view, g);
    else drawPeriscope(ctx, s, view, g);
  },
});
