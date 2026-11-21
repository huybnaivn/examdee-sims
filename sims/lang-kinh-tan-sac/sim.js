import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, SPECTRUM, colorOf, indexOf, criticalAngle, trace, minDeviation, atMinDeviation, MIN_TOLERANCE } from "./model.js";

const SPREAD = 6; // white light: angular spread between colours drawn this many times larger
const RGB = { red: "#e02424", orange: "#f2801b", yellow: "#e8c100", green: "#1fa34a", blue: "#1e88e5", indigo: "#3f3fb5", violet: "#8a2be2" };
const rad = d => (d * Math.PI) / 180;
const dir = a => ({ x: Math.cos(a), y: Math.sin(a) }); // screen angle, y down

const report = (s, api) => {
  const n = indexOf(s.color);
  const t = trace(s.apex, s.incidence, n);
  api.emit("deviation-measured", { apex: s.apex, incidence: s.incidence, n, ...(t.emerges && { deviation: t.deviation, emergence: t.i2 }), emerges: t.emerges ? 1 : 0 }, "result");
  const at = atMinDeviation(s.apex, s.incidence, n);
  if (at && !s._atMin) api.emit("min-deviation", { apex: s.apex, incidence: s.incidence, deviation: t.deviation, n }, "goal");
  s._atMin = at;
};

// Intersection of the ray p + t·d (t > 0) with segment a–b; returns t or null.
function hit(p, d, a, b) {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const den = d.x * ey - d.y * ex;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / den;
  const u = ((a.x - p.x) * d.y - (a.y - p.y) * d.x) / den;
  return t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null;
}

function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const half = rad(s.apex / 2);
  const H = Math.min(view.h - (small ? 110 : 150), view.w * (small ? 0.5 : 0.42)); // prism height
  const L = H / Math.cos(half); // face length
  const apex = { x: view.w * 0.42, y: (view.h - H) / 2 + (small ? 4 : 10) };
  const left = { x: apex.x - L * Math.sin(half), y: apex.y + H };
  const right = { x: apex.x + L * Math.sin(half), y: apex.y + H };
  return { small, half, L, H, apex, left, right };
}

// Entry point shared by all colours: high enough on the first face that every inside ray
// meets the second face, not the base (s = f·L·cos r1 / cos r2 along the second face).
function entryPoint(g, traces) {
  let f = 0.5;
  for (const { t } of traces) f = Math.min(f, (0.9 * Math.cos(rad(Math.min(89, Math.abs(t.r2))))) / Math.cos(rad(t.r1)));
  return { x: g.apex.x - f * g.L * Math.sin(g.half), y: g.apex.y + f * g.L * Math.cos(g.half) };
}

/** Screen path of one colour: entry, internal segment, exit or total reflection. */
function path(s, g, entry, t, ref) {
  const { half, apex, left, right, L } = g;
  // Draw the spread between colours enlarged around the reference colour (exaggerate = on).
  const k = ref && s.light === "white" && s.exaggerate ? SPREAD : 1;
  const r1 = ref ? ref.r1 + k * (t.r1 - ref.r1) : t.r1;
  const din = dir(half - rad(r1));
  const tOut = hit(entry, din, apex, right) ?? hit(entry, din, left, right) ?? L;
  const exit = { x: entry.x + din.x * tOut, y: entry.y + din.y * tOut };
  const out = { entry, exit, inside: din };
  if (t.emerges) {
    const i2 = ref?.i2 != null ? ref.i2 + k * (t.i2 - ref.i2) : t.i2;
    out.emergent = dir(-half + rad(i2));
  } else {
    // total internal reflection at the second face: mirror the inside ray about the face normal
    const nr = dir(-half);
    const dot = din.x * nr.x + din.y * nr.y;
    const refl = { x: din.x - 2 * dot * nr.x, y: din.y - 2 * dot * nr.y };
    const tr = hit(exit, refl, left, right) ?? hit(exit, refl, apex, left) ?? 0;
    out.reflected = { x: exit.x + refl.x * tr, y: exit.y + refl.y * tr };
  }
  return out;
}

function line(ctx, a, b, color, width = 2.5, dash = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

mount({
  slug: "lang-kinh-tan-sac",
  version: "1.0.0",
  title: "Lăng kính và sự tán sắc ánh sáng",
  hint: "Đổi góc chiết quang A và góc tới i₁. Tìm góc tới cho độ lệch cực tiểu (i₁ = i₂) của màu đang đo; chiếu ánh sáng trắng để thấy chùm tia tán sắc.",
  initialState,
  controls: [
    {
      type: "select",
      key: "light",
      label: "Ánh sáng chiếu tới",
      options: [
        { value: "white", label: "Ánh sáng trắng" },
        { value: "mono", label: "Ánh sáng đơn sắc" },
      ],
    },
    { type: "select", key: "color", label: "Màu đo (bảng chiết suất thủy tinh crao)", options: SPECTRUM.map(c => ({ value: c.value, label: `${c.label} – ${c.nm} nm, n = ${c.n.toLocaleString("vi-VN")}` })) },
    { type: "slider", key: "apex", label: "Góc chiết quang A", min: 20, max: 70, step: 1, unit: "°", digits: 0 },
    { type: "slider", key: "incidence", label: "Góc tới i₁", min: 0, max: 89, step: 0.5, unit: "°", digits: 1 },
    { type: "checkbox", key: "exaggerate", label: "Vẽ phóng đại độ tán sắc (×6)", visible: s => s.light === "white" },
  ].map(c => ({ ...c, onCommit: report })),
  readouts: [
    { label: "Chiết suất n (màu đo)", value: s => fmt(indexOf(s.color), 4) },
    { label: "Góc khúc xạ r₁ ; r₂ = A − r₁", value: s => { const t = trace(s.apex, s.incidence, indexOf(s.color)); return `${fmt(t.r1, 1)}° ; ${fmt(t.r2, 1)}°`; } },
    { label: "Góc ló i₂", value: s => { const t = trace(s.apex, s.incidence, indexOf(s.color)); return t.emerges ? `${fmt(t.i2, 1)}°` : "không có tia ló"; } },
    { label: "Góc lệch D = i₁ + i₂ − A", value: s => { const t = trace(s.apex, s.incidence, indexOf(s.color)); return t.emerges ? `${fmt(t.deviation, 2)}°` : "–"; } },
    { label: "Góc lệch cực tiểu Dmin", value: s => { const m = minDeviation(s.apex, indexOf(s.color)); return m ? `${fmt(m.deviation, 2)}° (khi i₁ = ${fmt(m.incidence, 1)}°)` : "–"; } },
    { label: "Góc giới hạn igh = arcsin(1/n)", value: s => `${fmt(criticalAngle(indexOf(s.color)), 1)}°` },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { apex, left, right, small } = g;
    const size = small ? 12 : 14;
    const sel = colorOf(s.color);
    const tSel = trace(s.apex, s.incidence, sel.n);

    // prism
    ctx.fillStyle = "rgba(160, 200, 235, 0.35)";
    ctx.strokeStyle = "#5a7fa8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(apex.x, apex.y, 26, Math.PI / 2 - g.half, Math.PI / 2 + g.half);
    ctx.stroke();
    label(ctx, `A = ${s.apex}°`, apex.x, apex.y - 12, { size, bold: true, align: "center" });

    const colors = s.light === "white" ? SPECTRUM : [sel];
    const traces = colors.map(c => ({ c, t: trace(s.apex, s.incidence, c.n) }));
    const ref = s.light === "white" ? trace(s.apex, s.incidence, colorOf("yellow").n) : null;
    const entry = entryPoint(g, traces);
    const pSel = path(s, g, entry, tSel, ref);
    const far = view.w + view.h;

    // incident ray (white light drawn as a light grey beam)
    const din0 = dir(g.half - rad(s.incidence));
    const src = { x: pSel.entry.x - din0.x * far, y: pSel.entry.y - din0.y * far };
    line(ctx, src, pSel.entry, s.light === "white" ? "#9aa3b5" : RGB[sel.value], 3.5);
    arrow(ctx, pSel.entry.x - din0.x * 70, pSel.entry.y - din0.y * 70, pSel.entry.x - din0.x * 40, pSel.entry.y - din0.y * 40, s.light === "white" ? "#9aa3b5" : RGB[sel.value], 2);

    // normals at the two faces
    const nL = dir(Math.PI + g.half);
    line(ctx, { x: pSel.entry.x - nL.x * 40, y: pSel.entry.y - nL.y * 40 }, { x: pSel.entry.x + nL.x * 50, y: pSel.entry.y + nL.y * 50 }, COLORS.muted, 1, [4, 4]);
    const nR = dir(-g.half);
    line(ctx, { x: pSel.exit.x - nR.x * 40, y: pSel.exit.y - nR.y * 40 }, { x: pSel.exit.x + nR.x * 50, y: pSel.exit.y + nR.y * 50 }, COLORS.muted, 1, [4, 4]);

    // rays inside and out, the selected colour last (on top)
    const order = traces.filter(x => x.c !== sel).concat(traces.filter(x => x.c === sel));
    let lost = 0;
    for (const { c, t } of order) {
      const p = c === sel ? pSel : path(s, g, entry, t, ref);
      const w = c === sel ? 2.5 : 1.8;
      line(ctx, pSel.entry, p.exit, RGB[c.value], w);
      if (t.emerges) {
        line(ctx, p.exit, { x: p.exit.x + p.emergent.x * far, y: p.exit.y + p.emergent.y * far }, RGB[c.value], w);
      } else {
        lost++;
        line(ctx, p.exit, p.reflected, RGB[c.value], w, [6, 4]);
      }
    }

    // deviation of the selected colour: angle between the incident direction and the emergent ray
    if (tSel.emerges) {
      const e = pSel.emergent;
      // meeting point of the extended incident ray and the backward emergent ray
      const den = din0.x * e.y - din0.y * e.x;
      if (Math.abs(den) > 1e-6) {
        const tt = ((pSel.exit.x - pSel.entry.x) * e.y - (pSel.exit.y - pSel.entry.y) * e.x) / den;
        const m = { x: pSel.entry.x + din0.x * tt, y: pSel.entry.y + din0.y * tt };
        // arc drawn outside the prism, centred on the meeting point
        const R = Math.hypot(pSel.exit.x - m.x, pSel.exit.y - m.y) + (small ? 34 : 50);
        line(ctx, pSel.entry, { x: m.x + din0.x * (R + 16), y: m.y + din0.y * (R + 16) }, COLORS.muted, 1.2, [3, 4]);
        line(ctx, pSel.exit, m, COLORS.muted, 1.2, [3, 4]);
        const a0 = Math.atan2(din0.y, din0.x);
        const a1 = Math.atan2(e.y, e.x);
        ctx.strokeStyle = COLORS.orange;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x, m.y, R, a0, a1, a1 < a0);
        ctx.stroke();
        label(ctx, `D = ${fmt(tSel.deviation, 1)}°`, m.x + (R + 8) * Math.cos(a0), m.y + (R + 8) * Math.sin(a0) + 12, { size, bold: true, color: COLORS.orange });
      }
    }

    // status
    const at = atMinDeviation(s.apex, s.incidence, sel.n);
    const status = small
      ? !tSel.emerges
        ? `Phản xạ toàn phần: r₂ = ${fmt(tSel.r2, 1)}° > igh = ${fmt(criticalAngle(sel.n), 1)}°`
        : at
          ? `Độ lệch cực tiểu: i₁ ≈ i₂ = ${fmt(tSel.i2, 1)}°`
          : `i₁ = ${fmt(s.incidence, 1)}°, i₂ = ${fmt(tSel.i2, 1)}° (${sel.label.toLowerCase()})`
      : !tSel.emerges
      ? `Phản xạ toàn phần ở mặt bên thứ hai: r₂ = ${fmt(tSel.r2, 1)}° > igh = ${fmt(criticalAngle(sel.n), 1)}°`
      : at
        ? `Độ lệch cực tiểu: i₁ ≈ i₂ = ${fmt(tSel.i2, 1)}°, tia trong lăng kính song song với đáy`
        : lost
          ? `${lost} màu bị phản xạ toàn phần, các màu khác ló ra`
          : `i₁ = ${fmt(s.incidence, 1)}°, i₂ = ${fmt(tSel.i2, 1)}° (${sel.label.toLowerCase()})`;
    const col = !tSel.emerges ? COLORS.red : at ? COLORS.green : COLORS.ink;
    label(ctx, status, view.w / 2, small ? 12 : 22, { size: small ? 11 : 15, bold: true, align: "center", color: col });
    const notes = [];
    if (s.light === "white" && s.exaggerate) notes.push(`Độ tán sắc vẽ phóng đại ×${SPREAD}`);
    if (s.light === "white" && !small) notes.push("Chiết suất tăng dần từ đỏ đến tím: tia tím lệch nhiều nhất");
    notes.forEach((t, i) => label(ctx, t, 10, view.h - 12 - i * (small ? 15 : 18), { size: small ? 11 : 13, color: COLORS.muted }));
  },
});
