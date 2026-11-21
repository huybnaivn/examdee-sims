import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { W, H, initialState, points, measure, specialType, describe, roundedAngles, equilateralApexes, sideSquares } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const NAMES = ["A", "B", "C"];
const SIDES = ["a", "b", "c"];
const KEYS = [["ax", "ay"], ["bx", "by"], ["cx", "cy"]];
const HATS = ["Â", "B̂", "Ĉ"];
const SIDE_COLORS = [COLORS.red, COLORS.green, COLORS.orange];
const INITIAL_TYPE = specialType(measure(initialState()));
const inGrid = ([x, y]) => x >= 0 && x <= W && y >= 0 && y <= H;

function tag(ctx, text, x, y, opts = {}) {
  ctx.save();
  ctx.font = `600 ${opts.size ?? 13}px ${FONT}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.bg;
  ctx.strokeText(text, x, y);
  ctx.restore();
  label(ctx, text, x, y, { size: 13, bold: true, ...opts });
}

// World rectangle to fit on screen: the grid, grown to take in the squares of a right triangle and
// the orthocentre. Growth is capped (an orthocentre can be very far away), so the grid never
// shrinks below about half size; what is still outside is clipped, and H gets an edge marker.
const SLACK = 0.4; // units of room around a square corner or H for its label
const frame = s => {
  const m = measure(s);
  const extra = [];
  if (m.byAngles === "right") extra.push(...sideSquares(m).flatMap(sq => sq.slice(2)));
  const [hx, hy] = m.orthocenter ?? [];
  // an H beyond the growth cap would shrink the grid for nothing: leave it out, it gets an edge marker
  if (s.show === "altitudes" && m.orthocenter && hx >= -W / 2 && hx <= 1.5 * W && hy >= -H / 2 && hy <= 1.5 * H) extra.push(m.orthocenter);
  const xs = extra.map(p => p[0]);
  const ys = extra.map(p => p[1]);
  return {
    x0: clamp(Math.min(0, ...xs.map(x => x - SLACK)), -W / 2, 0),
    x1: clamp(Math.max(W, ...xs.map(x => x + SLACK)), W, 1.5 * W),
    y0: clamp(Math.min(0, ...ys.map(y => y - SLACK)), -H / 2, 0),
    y1: clamp(Math.max(H, ...ys.map(y => y + SLACK)), H, 1.5 * H),
  };
};

// While a vertex is dragged the frame is frozen (s._frame), so the grid does not move under the finger.
const geom = (view, s) => {
  const f = s._frame ?? frame(s);
  const small = view.w < 520 || view.h < 400;
  const top = small ? 36 : 56;
  const bottom = small ? 20 : 30;
  const scale = Math.min((view.w - 12) / (f.x1 - f.x0), (view.h - top - bottom) / (f.y1 - f.y0));
  const ox = (view.w - (f.x1 + f.x0) * scale) / 2;
  const oy = top + (view.h - top - bottom + (f.y1 + f.y0) * scale) / 2;
  return { small, top, bottom, scale, X: x => ox + x * scale, Y: y => oy - y * scale, world: p => [(p.x - ox) / scale, (oy - p.y) / scale] };
};

// A `goal` once each time the triangle becomes right-angled, isosceles or equilateral.
function checkGoal(s, api) {
  const before = s._type ?? INITIAL_TYPE;
  const type = specialType(measure(s));
  s._type = type;
  if (!type || type === before) return;
  const data = { type };
  api.emit("special-triangle", data, "goal");
}

// The apex over AB that makes ABC equilateral and still lies on the grid (the upper one first).
const apexForC = s => {
  const [A, B] = points(s);
  if (A[0] === B[0] && A[1] === B[1]) return null;
  return equilateralApexes(A, B).sort((p, q) => q[1] - p[1]).find(inGrid) ?? null;
};

const coordinate = (i, axis) => ({
  type: "stepper",
  key: KEYS[i][axis],
  label: `Đỉnh ${NAMES[i]}: ${axis ? "tung độ y" : "hoành độ x"}`,
  min: 0,
  max: axis ? H : W,
  step: 0.5,
  digits: 2,
  onChange: checkGoal,
});

const line = (ctx, g, p, q) => {
  ctx.beginPath();
  ctx.moveTo(g.X(p[0]), g.Y(p[1]));
  ctx.lineTo(g.X(q[0]), g.Y(q[1]));
  ctx.stroke();
};
const dot = (ctx, g, p, color, r = 4) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(g.X(p[0]), g.Y(p[1]), r, 0, 2 * Math.PI);
  ctx.fill();
};

mount({
  slug: "tam-giac",
  version: "1.0.0",
  title: "Tam giác: góc, cạnh và diện tích",
  hint: "Kéo các đỉnh A, B, C trên lưới ô vuông. Khi kéo, dấu ◇ chỉ vị trí cho tam giác đều.",
  initialState,
  controls: [
    {
      type: "select",
      key: "show",
      label: "Vẽ thêm",
      options: [
        { value: "none", label: "Không vẽ thêm" },
        { value: "medians", label: "Ba đường trung tuyến và trọng tâm G" },
        { value: "altitudes", label: "Ba đường cao và trực tâm H" },
      ],
    },
    coordinate(0, 0),
    coordinate(0, 1),
    coordinate(1, 0),
    coordinate(1, 1),
    coordinate(2, 0),
    coordinate(2, 1),
    {
      type: "button",
      label: "Đặt C để tam giác ABC đều",
      disabled: s => !apexForC(s),
      action(s, api) {
        [s.cx, s.cy] = apexForC(s);
        checkGoal(s, api);
      },
    },
  ],
  readouts: [
    { label: "a = BC;  b = CA;  c = AB", value: s => measure(s).sides.map(v => fmt(v)).join("; ") },
    { label: "Chu vi a + b + c", value: s => fmt(measure(s).perimeter) },
    { label: "Diện tích S", value: s => fmt(measure(s).area) },
    {
      label: "½ · AB · h (h: đường cao từ C)",
      value: s => {
        const m = measure(s);
        return `½ · ${fmt(m.sides[2])} · ${fmt(m.heights[2])} = ${fmt(m.area)}`;
      },
    },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view, s);
      const d = points(s).map(q => Math.hypot(p.x - g.X(q[0]), p.y - g.Y(q[1])));
      const i = d.indexOf(Math.min(...d));
      if (d[i] > 26) return false;
      s._drag = i;
      s._frame = frame(s);
    },
    move(p, s, api, view) {
      const i = s._drag;
      const raw = geom(view, s).world(p);
      let at = [clamp(Math.round(raw[0] * 2) / 2, 0, W), clamp(Math.round(raw[1] * 2) / 2, 0, H)];
      // Magnet: an equilateral triangle has no vertex on the half-unit grid, so snap to the exact apex when close.
      const P = points(s);
      for (const q of equilateralApexes(P[(i + 1) % 3], P[(i + 2) % 3])) {
        if (inGrid(q) && Math.hypot(q[0] - raw[0], q[1] - raw[1]) < 0.4) at = q;
      }
      [s[KEYS[i][0]], s[KEYS[i][1]]] = at;
    },
    up(p, s, api) {
      const i = s._drag;
      s._drag = undefined;
      s._frame = undefined;
      const data = { vertex: NAMES[i], x: s[KEYS[i][0]], y: s[KEYS[i][1]] };
      api.emit("vertex-dropped", data, "action");
      checkGoal(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view, s);
    const { X, Y, small, scale } = g;
    const m = measure(s);
    const P = m.points;
    const size = small ? 11 : 13;
    const right = m.byAngles === "right";
    const S = P.map(p => [X(p[0]), Y(p[1])]); // screen
    const centre = [X(m.centroid[0]), Y(m.centroid[1])];

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) {
      ctx.moveTo(X(x), Y(0));
      ctx.lineTo(X(x), Y(H));
    }
    for (let y = 0; y <= H; y++) {
      ctx.moveTo(X(0), Y(y));
      ctx.lineTo(X(W), Y(y));
    }
    ctx.stroke();

    // squares on the three sides of a right triangle: the two small areas add up to the big one
    if (right) {
      // a square too big for the capped frame is clipped at the title and the bottom note
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, g.top, view.w, view.h - g.top - g.bottom);
      ctx.clip();
      sideSquares(m).forEach((corners, i) => {
        const [p, q, , pn] = corners.map(c => [X(c[0]), Y(c[1])]);
        const n = [pn[0] - p[0], pn[1] - p[1]]; // same length as the side, away from the triangle
        ctx.beginPath();
        ctx.moveTo(...p);
        ctx.lineTo(...q);
        ctx.lineTo(q[0] + n[0], q[1] + n[1]);
        ctx.lineTo(p[0] + n[0], p[1] + n[1]);
        ctx.closePath();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = SIDE_COLORS[i];
        ctx.fill();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = SIDE_COLORS[i];
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (m.sides[i] * scale >= 58) {
          // on a steep side the length label sits level with this one, so move this one down a line
          const steep = Math.abs(n[0]) / (m.sides[i] * scale);
          tag(ctx, `${SIDES[i]}² = ${fmt(m.sq[i])}`, (p[0] + q[0] + n[0]) / 2, (p[1] + q[1] + n[1]) / 2 + 12 * steep, { size, align: "center", color: SIDE_COLORS[i] });
        }
      });
      ctx.restore();
    }

    // the triangle
    ctx.beginPath();
    ctx.moveTo(...S[0]);
    ctx.lineTo(...S[1]);
    ctx.lineTo(...S[2]);
    ctx.closePath();
    ctx.fillStyle = "rgba(47, 111, 237, 0.12)";
    ctx.fill();
    ctx.strokeStyle = m.degenerate ? COLORS.red : COLORS.blue;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();

    if (!m.degenerate && s.show === "medians") {
      ctx.strokeStyle = COLORS.purple;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        line(ctx, g, P[i], m.midpoints[i]);
        dot(ctx, g, m.midpoints[i], COLORS.purple, 3);
      }
      dot(ctx, g, m.centroid, COLORS.purple, 5);
      tag(ctx, "G", centre[0] + 8, centre[1] - 9, { size, color: COLORS.purple });
    }
    if (!m.degenerate && s.show === "altitudes") {
      const h = m.orthocenter;
      for (let i = 0; i < 3; i++) {
        const foot = m.feet[i];
        // thin dashed helpers: the side produced to the foot, and the altitude produced to H
        ctx.strokeStyle = COLORS.muted;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        line(ctx, g, P[(i + 1) % 3], foot);
        line(ctx, g, P[(i + 2) % 3], foot);
        line(ctx, g, P[i], h);
        line(ctx, g, foot, h);
        ctx.setLineDash([]);
        ctx.strokeStyle = COLORS.green;
        ctx.lineWidth = 2;
        line(ctx, g, P[i], foot);
        dot(ctx, g, foot, COLORS.green, 3);
      }
      const [hx, hy] = [X(h[0]), Y(h[1])];
      const [lo, hi] = [g.top + 4, view.h - g.bottom - 4]; // keep clear of the title and the bottom note
      if (hx >= 10 && hx <= view.w - 10 && hy >= lo && hy <= hi) {
        dot(ctx, g, h, COLORS.green, 5);
        tag(ctx, "H", hx + 8, hy - 9, { size, color: COLORS.green });
      } else {
        // H is off the stage: an arrow on the edge points to it
        const d = Math.hypot(hx - centre[0], hy - centre[1]);
        const [ux, uy] = [(hx - centre[0]) / d, (hy - centre[1]) / d];
        const [ex, ey] = [clamp(hx, 6, view.w - 6), clamp(hy, lo, hi)];
        arrow(ctx, ex - 30 * ux, ey - 30 * uy, ex, ey, COLORS.green, 2);
        tag(ctx, "H ngoài khung", ex - 44 * ux, ey - 44 * uy, { size, color: COLORS.green, align: ux > 0.3 ? "right" : ux < -0.3 ? "left" : "center" });
      }
    }

    // angles
    if (!m.degenerate) {
      const shown = roundedAngles(m.angles);
      for (let i = 0; i < 3; i++) {
        const p = S[i];
        const a1 = Math.atan2(S[(i + 1) % 3][1] - p[1], S[(i + 1) % 3][0] - p[0]);
        const a2 = Math.atan2(S[(i + 2) % 3][1] - p[1], S[(i + 2) % 3][0] - p[0]);
        let diff = a2 - a1;
        diff -= 2 * Math.PI * Math.round(diff / (2 * Math.PI));
        const r = small ? 14 : 22;
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (right && i === m.big) {
          const k = r * 0.6;
          ctx.moveTo(p[0] + k * Math.cos(a1), p[1] + k * Math.sin(a1));
          ctx.lineTo(p[0] + k * (Math.cos(a1) + Math.cos(a2)), p[1] + k * (Math.sin(a1) + Math.sin(a2)));
          ctx.lineTo(p[0] + k * Math.cos(a2), p[1] + k * Math.sin(a2));
        } else {
          ctx.arc(p[0], p[1], r, a1, a1 + diff, diff < 0);
        }
        ctx.stroke();
        const mid = a1 + diff / 2;
        const far = r + (small ? 13 : 17) + (m.angles[i] < 30 ? 14 : 0);
        tag(ctx, `${fmt(shown[i], 1)}°`, p[0] + far * Math.cos(mid), p[1] + far * Math.sin(mid), { size: size - 1, align: "center" });
      }
    }

    // side lengths, outside each side
    for (let i = 0; i < 3 && !m.degenerate; i++) {
      const p = S[(i + 1) % 3];
      const q = S[(i + 2) % 3];
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      let n = [(q[1] - p[1]) / len, (p[0] - q[0]) / len];
      if (n[0] * (S[i][0] - p[0]) + n[1] * (S[i][1] - p[1]) > 0) n = [-n[0], -n[1]];
      tag(ctx, `${SIDES[i]} = ${fmt(m.sides[i])}`, mx + n[0] * 15, my + n[1] * 13 - (right ? 10 * Math.abs(n[0]) : 0), { size, align: "center", color: right ? SIDE_COLORS[i] : COLORS.blue });
    }

    // where to drop the dragged vertex for an equilateral triangle
    if (s._drag !== undefined) {
      const i = s._drag;
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 2;
      for (const q of equilateralApexes(P[(i + 1) % 3], P[(i + 2) % 3]).filter(inGrid)) {
        const [x, y] = [X(q[0]), Y(q[1])];
        ctx.beginPath();
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 9, y);
        ctx.lineTo(x, y + 9);
        ctx.lineTo(x - 9, y);
        ctx.closePath();
        ctx.stroke();
      }
    }

    // vertices
    S.forEach((p, i) => {
      ctx.fillStyle = s._drag === i ? COLORS.blue : "#fff";
      ctx.strokeStyle = COLORS.blue;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p[0], p[1], small ? 6 : 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      const d = Math.hypot(p[0] - centre[0], p[1] - centre[1]) || 1;
      const out = m.degenerate ? [0, -1] : [(p[0] - centre[0]) / d, (p[1] - centre[1]) / d];
      // coincident vertices share one label, "A ≡ B"
      const twins = [0, 1, 2].filter(k => P[k][0] === P[i][0] && P[k][1] === P[i][1]);
      if (twins[0] === i) tag(ctx, twins.map(k => NAMES[k]).join(" ≡ "), p[0] + out[0] * 18, p[1] + out[1] * 18, { size: size + 2, align: "center" });
    });

    // what kind of triangle, and the angle sum
    tag(ctx, describe(m), view.w / 2, small ? 10 : 16, { size: small ? 13 : 17, align: "center", color: m.degenerate ? COLORS.red : COLORS.ink });
    if (!m.degenerate) {
      const shown = roundedAngles(m.angles).map(a => `${fmt(a, 1)}°`);
      tag(ctx, `${HATS.join(" + ")} = ${shown.join(" + ")} = 180°`, view.w / 2, small ? 26 : 40, { size, align: "center", color: COLORS.muted });
    }
    // Pythagoras for a right triangle; otherwise the scale of the grid
    const y = view.h - (small ? 10 : 15);
    if (right) {
      const [u, v] = [0, 1, 2].filter(i => i !== m.big);
      const k = m.big;
      tag(ctx, `Định lí Pythagore: ${SIDES[u]}² + ${SIDES[v]}² = ${SIDES[k]}²  (${fmt(m.sq[u])} + ${fmt(m.sq[v])} = ${fmt(m.sq[k])})`, view.w / 2, y, { size, align: "center" });
    } else {
      tag(ctx, "Mỗi ô vuông của lưới có cạnh dài 1 đơn vị", view.w / 2, y, { size, align: "center", color: COLORS.muted });
    }
  },
});
