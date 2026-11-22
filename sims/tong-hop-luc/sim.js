import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, lab, hang, angleBetween } from "./model.js";

const RAD = Math.PI / 180;
const SUB = ["₁", "₂", "₃"];
const STRING_COLORS = [COLORS.blue, COLORS.green, COLORS.purple];
const B_MIN = 2;
const B_MAX = 45;

// One result per finished change (anchor released or slider let go); a goal when the ring first balances.
function report(s, api) {
  if (s.mode === "light") {
    const h = hang(s.weight, s.b1, s.b2);
    api.emit("tensions", { t1: h.t1, t2: h.t2, weight: s.weight, angleBetween: h.theta, resultant: 0, balanced: 1 }, "result");
    return;
  }
  const r = lab(s);
  const data = { weight: s.weight, resultant: r.net.mag, balanced: r.balanced ? 1 : 0 };
  r.strings.forEach((f, k) => (data[`t${k + 1}`] = f.F));
  api.emit("tensions", data, "result");
  if (r.balanced && !s._balanced) api.emit("balanced", { strings: r.strings.length, weight: s.weight }, "goal");
  s._balanced = r.balanced;
}

function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const top = small ? 26 : 44;
  if (s.mode === "light") {
    const kP = small ? 55 : 80; // px for the weight arrow
    const bh = small ? 56 : 72; // height of the light
    const D = Math.max(40, Math.min(view.w * 0.4, (view.h - top - kP - bh - 30) / Math.tan(B_MAX * RAD)));
    const cx = view.w / 2;
    const spare = Math.max(0, view.h - top - D * Math.tan(B_MAX * RAD) - kP - bh - 30);
    const oy = top + D * Math.tan(B_MAX * RAD) + 8 + spare / 2;
    const anchors = [
      { x: cx - D, y: oy - D * Math.tan(s.b1 * RAD) },
      { x: cx + D, y: oy - D * Math.tan(s.b2 * RAD) },
    ];
    return { small, top, light: true, cx, oy, D, anchors, kP, bh };
  }
  const R = Math.max(50, Math.min(view.w * 0.4, (view.h - top - 40) / 1.9));
  const cx = view.w / 2;
  const cy = top + R + 6;
  const n = s.count === 3 ? 3 : 2;
  const anchors = [s.a1, s.a2, s.a3].slice(0, n).map(d => ({ x: cx + R * Math.cos(d * RAD), y: cy - R * Math.sin(d * RAD) }));
  return { small, top, light: false, cx, cy, R, anchors };
}

// Spring scale on the string from (x1, y1) to the anchor (x2, y2).
function springScale(ctx, x1, y1, x2, y2, color) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const a = len * 0.7;
  const b = len * 0.94;
  const w = 6;
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(Math.atan2(uy, ux));
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.fillRect(a, -w, b - a, 2 * w);
  ctx.strokeRect(a, -w, b - a, 2 * w);
  ctx.lineWidth = 1;
  for (let t = a + 4; t < b - 2; t += 4) {
    ctx.beginPath();
    ctx.moveTo(t, -w);
    ctx.lineTo(t, -w + 3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPeg(ctx, x, y, hot) {
  ctx.fillStyle = hot ? COLORS.orange : COLORS.ink;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

// Parallelogram of two forces drawn from point O, with their resultant.
function drawParallelogram(ctx, ox, oy, v1, v2, k, text, max) {
  const p1 = [ox + v1.x * k, oy - v1.y * k];
  const p2 = [ox + v2.x * k, oy - v2.y * k];
  const p3 = [p1[0] + v2.x * k, p1[1] - v2.y * k];
  ctx.save();
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(...p1);
  ctx.lineTo(...p3);
  ctx.lineTo(...p2);
  ctx.stroke();
  ctx.restore();
  const len = Math.hypot(p3[0] - ox, p3[1] - oy);
  const f = len > max ? max / len : 1;
  const end = [ox + (p3[0] - ox) * f, oy + (p3[1] - oy) * f];
  arrow(ctx, ox, oy, ...end, COLORS.orange, 3);
  label(ctx, text, end[0] + 8, end[1] - 8, { color: COLORS.orange, bold: true, size: 13 });
}

function drawLab(ctx, s, view, g) {
  const r = lab(s);
  const { cx, cy, R, small } = g;
  const size = small ? 12 : 14;
  // frame the anchors hang from
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  // axes through the ring (directions are measured from Ox)
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - R);
  ctx.stroke();
  label(ctx, "x", cx + R + 4, cy, { size: 12, color: COLORS.muted });
  label(ctx, "y", cx + 8, cy - R * 0.45, { size: 12, color: COLORS.muted });

  // strings and spring scales
  r.strings.forEach((f, k) => {
    const a = g.anchors[k];
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
    springScale(ctx, cx, cy, a.x, a.y, STRING_COLORS[k]);
    drawPeg(ctx, a.x, a.y, s._drag === k);
  });

  // weight on its own string
  const blockY = cy + R * 0.8;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, blockY);
  ctx.stroke();
  const bw = small ? 34 : 44;
  ctx.fillStyle = "#c9d2e3";
  ctx.fillRect(cx - bw / 2, blockY, bw, small ? 22 : 28);
  ctx.strokeStyle = COLORS.ink;
  ctx.strokeRect(cx - bw / 2, blockY, bw, small ? 22 : 28);
  label(ctx, `${fmt(s.weight, 1)} N`, cx, blockY + (small ? 11 : 14), { align: "center", size: small ? 11 : 12, bold: true });

  // force arrows on the ring
  const maxF = Math.max(s.weight, ...r.strings.map(f => f.F), 1);
  const k = (R * 0.6) / maxF;
  if (s.showParallelogram && r.strings.length >= 2) {
    drawParallelogram(ctx, cx, cy, r.strings[0], r.strings[1], k, `F${SUB[0]}${SUB[1]}`, R * 0.95);
  }
  r.strings.forEach((f, kk) => {
    const ex = cx + f.x * k;
    const ey = cy - f.y * k;
    arrow(ctx, cx, cy, ex, ey, STRING_COLORS[kk], 3);
  });
  arrow(ctx, cx, cy, cx, cy + s.weight * k, COLORS.red, 3);
  label(ctx, "P", cx + 9, cy + s.weight * k - 4, { color: COLORS.red, bold: true, size });

  // angle between strings 1 and 2
  const [d1, d2] = [s.a1, s.a2];
  const lo = Math.min(d1, d2);
  const hi = Math.max(d1, d2);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 24, -hi * RAD, -lo * RAD);
  ctx.stroke();
  const mid = ((lo + hi) / 2) * RAD;
  if (hi - lo > 12) label(ctx, `${fmt(hi - lo, 0)}°`, cx + 38 * Math.cos(mid), cy - 38 * Math.sin(mid), { size: 11, align: "center", color: COLORS.muted });

  // ring
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.stroke();

  // net force when not balanced
  if (!r.balanced) {
    const len = Math.min(r.net.mag * k, R * 0.9);
    const ang = r.net.deg * RAD;
    const ex = cx + len * Math.cos(ang);
    const ey = cy - len * Math.sin(ang);
    ctx.save();
    ctx.setLineDash([3, 4]);
    arrow(ctx, cx, cy, ex, ey, COLORS.ink, 2);
    ctx.restore();
    label(ctx, "F", ex + 6, ey + 10, { size: 13, bold: true });
  }

  // scale readings beside each anchor
  r.strings.forEach((f, kk) => {
    const a = g.anchors[kk];
    const right = Math.cos(f.deg * RAD) >= -0.2;
    const tx = a.x + (right ? -12 : 12);
    const ty = a.y + (f.deg > 150 || f.deg < 30 ? 18 : 0);
    const text = `F${SUB[kk]} = ${fmt(f.F, 1)} N`;
    label(ctx, text, right ? Math.min(tx, view.w - 6) : Math.max(tx, 6), Math.max(10, ty), { align: right ? "right" : "left", size, bold: true, color: STRING_COLORS[kk] });
  });

  // status
  const status = r.balanced
    ? "Cân bằng: tổng các vectơ lực bằng 0"
    : `Chưa cân bằng: hợp lực F = ${fmt(r.net.mag, 2)} N`;
  label(ctx, status, 10, g.top / 2 + 2, { size: small ? 12 : 15, bold: true, color: r.balanced ? COLORS.green : COLORS.red });
  if (!small) label(ctx, "Lực vẽ theo cùng tỉ lệ; số chỉ lực kế ghi cạnh chốt.", view.w - 10, view.h - 12, { size: 12, align: "right", color: COLORS.muted });
}

function drawLight(ctx, s, view, g) {
  const h = hang(s.weight, s.b1, s.b2);
  const { cx, oy, D, small, anchors, kP, bh } = g;
  const size = small ? 12 : 14;
  // poles
  ctx.fillStyle = "#8a94a6";
  const poleTop = Math.min(...anchors.map(a => a.y)) - 18;
  for (const a of anchors) ctx.fillRect(a.x + (a.x < cx ? -10 : 2), poleTop, 8, view.h - poleTop);
  // cables
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(anchors[0].x, anchors[0].y);
  ctx.lineTo(cx, oy);
  ctx.lineTo(anchors[1].x, anchors[1].y);
  ctx.stroke();
  anchors.forEach((a, k) => drawPeg(ctx, a.x, a.y, s._drag === k));
  // the light
  const bw = small ? 22 : 28;
  const by = oy + kP + 10;
  ctx.beginPath();
  ctx.moveTo(cx, oy);
  ctx.lineTo(cx, by);
  ctx.stroke();
  ctx.fillStyle = "#2b3445";
  ctx.fillRect(cx - bw / 2, by, bw, bh);
  ["#e5484d", "#f5c518", "#1f9d6b"].forEach((c, k) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(cx, by + bh * (k + 0.5) / 3, bw * 0.3, 0, Math.PI * 2);
    ctx.fill();
  });

  // forces on the knot O
  const k = kP / s.weight;
  const max = D * 0.85;
  let shrunk = false;
  const tip = (T, deg) => {
    let len = T * k;
    if (len > max) (len = max), (shrunk = true);
    return [cx + len * Math.cos(deg * RAD), oy - len * Math.sin(deg * RAD)];
  };
  const p1 = tip(h.t1, h.dir1);
  const p2 = tip(h.t2, h.dir2);
  if (s.showParallelogram && !shrunk) {
    ctx.save();
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(...p1);
    ctx.lineTo(p1[0] + p2[0] - cx, p1[1] + p2[1] - oy);
    ctx.lineTo(...p2);
    ctx.stroke();
    ctx.restore();
    arrow(ctx, cx, oy, p1[0] + p2[0] - cx, p1[1] + p2[1] - oy, COLORS.orange, 3);
  }
  arrow(ctx, cx, oy, ...p1, COLORS.blue, 3);
  arrow(ctx, cx, oy, ...p2, COLORS.green, 3);
  arrow(ctx, cx, oy, cx, oy + kP, COLORS.red, 3);
  label(ctx, "P", cx + bw / 2 + 6, oy + kP - 2, { color: COLORS.red, bold: true, size });
  label(ctx, "O", cx + 8, oy - 10, { bold: true, size: 12 });
  const t1 = s.showT ? `T${SUB[0]} = ${fmt(h.t1, 1)} N` : `T${SUB[0]} = ?`;
  const t2 = s.showT ? `T${SUB[1]} = ${fmt(h.t2, 1)} N` : `T${SUB[1]} = ?`;
  label(ctx, t1, Math.max(6, anchors[0].x - 4), anchors[0].y - 16, { color: COLORS.blue, bold: true, size });
  label(ctx, t2, Math.min(view.w - 6, anchors[1].x + 4), anchors[1].y - 16, { color: COLORS.green, bold: true, size, align: "right" });
  // angles to the horizontal
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - D * 0.55, oy);
  ctx.lineTo(cx + D * 0.55, oy);
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, `${fmt(s.b1, 0)}°`, cx - D * 0.5, oy + 11, { size: 11, color: COLORS.muted });
  label(ctx, `${fmt(s.b2, 0)}°`, cx + D * 0.5, oy + 11, { size: 11, color: COLORS.muted, align: "right" });
  label(ctx, `Đèn P = ${fmt(s.weight, 0)} N, góc giữa hai dây ${fmt(h.theta, 0)}°`, 10, g.top / 2 + 2, { size: small ? 12 : 15, bold: true });
  if (shrunk) label(ctx, "Lực căng quá lớn: mũi tên đã thu ngắn", view.w / 2, view.h - 10, { size: 11, align: "center", color: COLORS.red });
}

const NAMES = ["a1", "a2", "a3"];
const BNAMES = ["b1", "b2"];

mount({
  slug: "tong-hop-luc",
  version: "1.0.0",
  title: "Tổng hợp lực và cân bằng của chất điểm",
  hint: "Kéo các chốt để đổi hướng dây. Chỉnh số chỉ lực kế cho tới khi vòng cân bằng.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Tình huống",
      options: [
        { value: "lab", label: "Vòng treo bởi các lực kế" },
        { value: "light", label: "Đèn giao thông treo trên hai dây" },
      ],
    },
    { type: "slider", key: "weight", label: "Trọng lượng P", min: 2, max: 30, step: 1, unit: "N", digits: 0, onCommit: report },
    {
      type: "select",
      key: "count",
      label: "Số dây có lực kế",
      options: [
        { value: 2, label: "Hai dây" },
        { value: 3, label: "Ba dây" },
      ],
      visible: s => s.mode === "lab",
      onCommit: report,
    },
    ...[1, 2, 3].flatMap(i => [
      { type: "heading", label: `Dây ${i}`, visible: s => s.mode === "lab" && (i < 3 || s.count === 3) },
      {
        type: "slider", key: `a${i}`, label: "Góc hợp với trục Ox", min: 0, max: 180, step: 1, format: v => `${fmt(v, 0)}°`,
        visible: s => s.mode === "lab" && (i < 3 || s.count === 3), onCommit: report,
      },
      {
        type: "slider", key: `f${i}`, label: `Số chỉ lực kế F${SUB[i - 1]}`, min: 0, max: 30, step: 0.1, unit: "N", digits: 1,
        visible: s => s.mode === "lab" && (i < 3 || s.count === 3), onCommit: report,
      },
    ]),
    { type: "slider", key: "b1", label: "Góc dây trái với phương ngang", min: B_MIN, max: B_MAX, step: 1, format: v => `${fmt(v, 0)}°`, visible: s => s.mode === "light", onCommit: report },
    { type: "slider", key: "b2", label: "Góc dây phải với phương ngang", min: B_MIN, max: B_MAX, step: 1, format: v => `${fmt(v, 0)}°`, visible: s => s.mode === "light", onCommit: report },
    { type: "checkbox", key: "showT", label: "Hiện đáp số lực căng T₁, T₂", visible: s => s.mode === "light" },
    { type: "checkbox", key: "showParallelogram", label: "Vẽ hình bình hành lực" },
  ],
  readouts: [
    { label: "Góc giữa dây 1 và dây 2", value: s => `${fmt(s.mode === "light" ? hang(s.weight, s.b1, s.b2).theta : angleBetween(s.a1, s.a2), 0)}°` },
    { label: "Tổng hình chiếu lên Ox", value: s => (s.mode === "light" ? "0 N" : `${fmt(lab(s).net.x, 2)} N`) },
    { label: "Tổng hình chiếu lên Oy", value: s => (s.mode === "light" ? "0 N" : `${fmt(lab(s).net.y, 2)} N`) },
    {
      label: "Lực căng T₁ ; T₂",
      value: s => {
        if (s.mode !== "light") return "–";
        const h = hang(s.weight, s.b1, s.b2);
        return s.showT ? `${fmt(h.t1, 2)} N ; ${fmt(h.t2, 2)} N` : "? (tự tính trước)";
      },
    },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      const k = g.anchors.findIndex(a => Math.hypot(p.x - a.x, p.y - a.y) < 22);
      if (k < 0) return false;
      s._drag = k;
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      if (g.light) {
        s[BNAMES[s._drag]] = Math.round(clamp(Math.atan2(g.oy - p.y, g.D) / RAD, B_MIN, B_MAX));
      } else {
        let deg = Math.atan2(g.cy - p.y, p.x - g.cx) / RAD;
        if (deg < 0) deg = deg < -90 ? 180 : 0; // below the ring: snap to the nearest horizontal
        s[NAMES[s._drag]] = Math.round(deg);
      }
    },
    up(p, s, api) {
      const k = s._drag;
      s._drag = undefined;
      const key = s.mode === "light" ? BNAMES[k] : NAMES[k];
      api.emit("anchor-drag", { index: k + 1, angle: s[key] });
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    if (g.light) drawLight(ctx, s, view, g);
    else drawLab(ctx, s, view, g);
  },
});
