import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, deg, measures, snapDiameter, onCcwArc } from "./model.js";

const INS = COLORS.red; // ∠ACB
const CEN = COLORS.blue; // ∠AOB and its arc
const SEC = COLORS.purple; // ∠ADB
const TAN = COLORS.green; // tangent Ax
const ARC = COLORS.orange; // intercepted arc
const MIN_GAP = 4; // degrees kept between dragged points so they and their names stay apart
const d1 = v => `${fmt(v, 1)}°`;
const r1 = v => Math.round(v * 10) / 10; // event data: points sit on whole degrees, so angles are multiples of 0,5°

function geom(view, s) {
  const small = view.w < 520 || view.h < 420;
  const top = small ? 44 : 64;
  const notes = (s.second ? 1 : 0) + (s.tangent ? 1 : 0); // lines of text under the circle
  const bottom = (small ? 12 : 20) + notes * (small ? 16 : 19);
  const R = Math.max(40, Math.min(view.w / 2 - 34, (view.h - top - bottom) / 2 - 22));
  return { small, top, bottom, R, cx: view.w / 2, cy: top + (view.h - top - bottom) / 2 };
}
const P = (g, t, r = g.R) => ({ x: g.cx + r * Math.cos((t * Math.PI) / 180), y: g.cy - r * Math.sin((t * Math.PI) / 180) });

function line(ctx, p, q, color, width = 2.5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
  ctx.stroke();
}

/** Marker for the (< 180°) angle at V between rays to P and Q, with its measure. */
function marker(ctx, v, p, q, value, color, r, size) {
  const s1 = Math.atan2(p.y - v.y, p.x - v.x);
  let diff = Math.atan2(q.y - v.y, q.x - v.x) - s1;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  ctx.strokeStyle = color;
  ctx.fillStyle = color + "22";
  ctx.lineWidth = 2;
  if (Math.abs(Math.abs(value) - 90) < 1e-6) {
    // right angle: a small square
    const u = { x: Math.cos(s1), y: Math.sin(s1) };
    const w = { x: Math.cos(s1 + diff), y: Math.sin(s1 + diff) };
    const k = r * 0.6;
    ctx.beginPath();
    ctx.moveTo(v.x + u.x * k, v.y + u.y * k);
    ctx.lineTo(v.x + (u.x + w.x) * k, v.y + (u.y + w.y) * k);
    ctx.lineTo(v.x + w.x * k, v.y + w.y * k);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(v.x, v.y);
    ctx.arc(v.x, v.y, r, s1, s1 + diff, diff < 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(v.x, v.y, r, s1, s1 + diff, diff < 0);
    ctx.stroke();
  }
  const mid = s1 + diff / 2;
  const lr = r + size * 1.6;
  label(ctx, d1(value), v.x + lr * Math.cos(mid), v.y + lr * Math.sin(mid), { align: "center", size, bold: true, color });
}

const visiblePoints = s => (s.second ? ["a", "b", "c", "d"] : ["a", "b", "c"]);
const NAME = { a: "A", b: "B", c: "C", d: "D" };

// One result per finished move; the goal fires when ∠ACB becomes a right angle (AB a diameter),
// once until AB stops being a diameter.
function report(s, api) {
  const m = measures(s);
  if (Number.isFinite(m.inscribed) && Number.isFinite(m.arc)) {
    const data = { inscribed: r1(m.inscribed), central: m.central, arc: m.arc };
    if (s.second && Number.isFinite(m.second)) data.second = r1(m.second);
    if (s.tangent) data.tangentChord = r1(m.tangentChord);
    api.emit("angle-measured", data, "result");
  }
  const right = m.diameter && Number.isFinite(m.inscribed);
  if (right && !s._right) api.emit("right-inscribed-angle", { inscribed: r1(m.inscribed) }, "goal");
  s._right = right;
}

const pointSlider = key => ({
  type: "slider",
  key,
  label: `Điểm ${NAME[key]}`,
  min: 0,
  max: 359,
  step: 1,
  format: v => `${v}°`,
  onCommit: report,
  ...(key === "d" ? { visible: s => s.second } : {}),
});

mount({
  slug: "goc-noi-tiep",
  version: "1.0.0",
  title: "Góc nội tiếp và góc ở tâm",
  hint: "Kéo các điểm A, B, C, D trên đường tròn. So sánh góc nội tiếp ACB với góc ở tâm AOB và số đo cung AB bị chắn.",
  initialState,
  controls: [
    { type: "heading", label: "Vị trí các điểm trên đường tròn" },
    pointSlider("a"),
    pointSlider("b"),
    pointSlider("c"),
    pointSlider("d"),
    { type: "heading", label: "Vẽ thêm" },
    { type: "checkbox", key: "second", label: "Góc nội tiếp thứ hai ADB" },
    { type: "checkbox", key: "tangent", label: "Tiếp tuyến Ax và góc xAB" },
  ],
  readouts: [
    { label: "Góc nội tiếp ∠ACB", value: s => d1(measures(s).inscribed) },
    { label: "Sđ cung AB không chứa C", value: s => d1(measures(s).arc) },
    { label: "Góc ở tâm ∠AOB", value: s => d1(measures(s).central) },
    { label: "Góc nội tiếp ∠ADB", value: s => (s.second ? d1(measures(s).second) : "–") },
    { label: "Góc ∠xAB", value: s => (s.tangent ? d1(measures(s).tangentChord) : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view, s);
      let best = null;
      let bestD = g.small ? 26 : 22;
      for (const k of visiblePoints(s)) {
        const q = P(g, s[k]);
        const dist = Math.hypot(p.x - q.x, p.y - q.y);
        if (dist < bestD) [best, bestD] = [k, dist];
      }
      if (!best) return false;
      s._drag = best;
      s._from = s[best];
    },
    move(p, s, api, view) {
      const k = s._drag;
      if (!k) return;
      const g = geom(view, s);
      let t = deg((Math.atan2(g.cy - p.y, p.x - g.cx) * 180) / Math.PI);
      if (k === "a") t = snapDiameter(t, s.b);
      if (k === "b") t = snapDiameter(t, s.a);
      // never drop a point onto another one: the angle would not exist
      if (visiblePoints(s).some(o => o !== k && Math.abs(((s[o] - t + 540) % 360) - 180) < MIN_GAP)) return;
      s[k] = t;
    },
    up(p, s, api) {
      const k = s._drag;
      s._drag = null;
      if (!k || s[k] === s._from) return;
      api.emit("point-moved", { point: NAME[k], angle: s[k] }, "action");
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view, s);
    const m = measures(s);
    const fs = g.small ? 12 : 15;
    const O = { x: g.cx, y: g.cy };
    const [A, B, C, D] = ["a", "b", "c", "d"].map(k => P(g, s[k]));

    // circle and the intercepted arc (the arc AB that does not contain C)
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (Number.isFinite(m.arc)) {
      const ccwArc = !onCcwArc(s.a, s.b, s.c); // the intercepted arc runs counter-clockwise (maths) from A
      const arcPath = r => {
        ctx.beginPath();
        ctx.arc(g.cx, g.cy, r, (-s.a * Math.PI) / 180, (-s.b * Math.PI) / 180, ccwArc);
      };
      ctx.strokeStyle = ARC;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      arcPath(g.R);
      ctx.stroke();
      ctx.lineCap = "butt";
      // arc measure, outside the middle of the arc
      const mid = s.a + (ccwArc ? m.arc / 2 : -m.arc / 2);
      const lp = P(g, mid, g.R + (g.small ? 12 : 16));
      const cos = Math.cos((mid * Math.PI) / 180);
      const align = cos > 0.15 ? "left" : cos < -0.15 ? "right" : "center"; // text grows away from the circle
      label(ctx, g.small ? `⌒ ${d1(m.arc)}` : `sđ ⌒AB = ${d1(m.arc)}`, lp.x, lp.y, { align, size: g.small ? 11 : 13, color: ARC, bold: true });
    }
    // central angle ∠AOB (at most 180°)
    if (Number.isFinite(m.central)) marker(ctx, O, A, B, m.central, CEN, Math.min(30, g.R * 0.22), fs);
    line(ctx, O, A, CEN, 2);
    line(ctx, O, B, CEN, 2);

    // tangent at A, ray Ax along the intercepted arc
    if (s.tangent && Number.isFinite(m.tangentChord)) {
      const t = (s.a * Math.PI) / 180;
      const k = onCcwArc(s.a, s.b, s.c) ? -1 : 1;
      const dir = { x: -Math.sin(t) * k, y: -Math.cos(t) * k }; // screen y points down
      const L = g.R * 1.25;
      const X = { x: A.x + dir.x * L, y: A.y + dir.y * L };
      line(ctx, { x: A.x - dir.x * L * 0.6, y: A.y - dir.y * L * 0.6 }, X, TAN, 2);
      label(ctx, "x", X.x + dir.x * 10, X.y + dir.y * 10, { align: "center", size: fs, bold: true, color: TAN });
      marker(ctx, A, X, B, m.tangentChord, TAN, Math.min(30, g.R * 0.2), fs);
    }

    // inscribed angles
    if (s.second && Number.isFinite(m.second)) {
      line(ctx, D, A, SEC, 2);
      line(ctx, D, B, SEC, 2);
      marker(ctx, D, A, B, m.second, SEC, Math.min(26, g.R * 0.18), fs);
    }
    line(ctx, C, A, INS, 2.5);
    line(ctx, C, B, INS, 2.5);
    line(ctx, A, B, COLORS.muted, 1.5);
    if (Number.isFinite(m.inscribed)) marker(ctx, C, A, B, m.inscribed, INS, Math.min(30, g.R * 0.2), fs);

    // points and names
    const dot = (q, name, t, color) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(q.x, q.y, g.small ? 7 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (t == null) return;
      const n = P(g, t, g.R + (g.small ? 15 : 18));
      label(ctx, name, n.x, n.y, { align: "center", size: fs + 3, bold: true, color });
    };
    dot(O, "O", null, COLORS.ink);
    // "O" goes opposite the ∠AOB marker, i.e. opposite the middle of the minor arc
    const arcMid = s.a + (onCcwArc(s.a, s.b, s.c) ? -m.arc / 2 : m.arc / 2);
    const away = Number.isFinite(m.arc) ? arcMid + (m.arc > 180 ? 0 : 180) : 135;
    const on = P(g, away, fs + 2);
    label(ctx, "O", on.x, on.y, { align: "center", size: fs, bold: true });
    dot(A, "A", s.a, COLORS.ink);
    dot(B, "B", s.b, COLORS.ink);
    dot(C, "C", s.c, INS);
    if (s.second) dot(D, "D", s.d, SEC);

    // headline and the theorem in force
    const head = `∠ACB = ${d1(m.inscribed)}    ∠AOB = ${d1(m.central)}`;
    label(ctx, head, view.w / 2, g.small ? 14 : 22, { align: "center", size: g.small ? 15 : 20, bold: true });
    let fact;
    if (!Number.isFinite(m.inscribed) || !Number.isFinite(m.arc)) fact = "Các điểm A, B, C phải khác nhau";
    else if (m.diameter) fact = "AB là đường kính ⇒ ∠ACB = 90° (góc nội tiếp chắn nửa đường tròn)";
    else if (m.arc > 180) fact = `∠ACB = ½ sđ cung lớn AB = ½ (360° − ${d1(m.central)})`;
    else fact = "∠ACB = ½ ∠AOB = ½ sđ cung AB";
    label(ctx, fact, view.w / 2, g.small ? 34 : 48, { align: "center", size: g.small ? 11 : 14, color: m.diameter ? COLORS.green : COLORS.muted, bold: m.diameter });

    const notes = [];
    if (s.second && Number.isFinite(m.second) && Number.isFinite(m.inscribed))
      notes.push(m.sameSide ? "∠ADB = ∠ACB (cùng chắn cung AB)" : `Tứ giác ACBD nội tiếp: ∠ACB + ∠ADB = ${d1(m.inscribed + m.second)}`);
    if (s.tangent && Number.isFinite(m.tangentChord)) notes.push(`∠xAB = ½ sđ cung AB = ${d1(m.tangentChord)}`);
    notes.forEach((n, i) => {
      const y = view.h - (notes.length - i) * (g.small ? 16 : 19) + (g.small ? 2 : 4);
      label(ctx, n, view.w / 2, y, { align: "center", size: g.small ? 11 : 14, color: i === 0 && s.second ? SEC : TAN, bold: true });
    });
  },
});
