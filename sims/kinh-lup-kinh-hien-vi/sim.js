import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { DD, initialState, solve, focusAtInfinity, trace } from "./model.js";

const RAY_COLORS = [COLORS.red, COLORS.green, COLORS.purple];
const NAMES = ["Kính lúp", "Kính hiển vi", "Kính thiên văn"];
const cm = v => (Number.isFinite(v) ? `${fmt(v, 2)} cm` : "vô cực");
const is = i => s => s.instrument === i;

// One result per finished change of the settings.
const report = (s, api) => {
  const r = solve(s);
  api.emit("settings", {
    instrument: s.instrument,
    ...(r.G != null && { magnification: r.G }),
    magnificationInfinity: r.Ginf,
    atInfinity: r.final === Infinity ? 1 : 0,
  }, "result");
};

function line(ctx, x1, y1, x2, y2, color, width = 2, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function lensSymbol(ctx, x, cy, half) {
  arrow(ctx, x, cy, x, cy - half, COLORS.blue, 3);
  arrow(ctx, x, cy, x, cy + half, COLORS.blue, 3);
}

function eyeIcon(ctx, x, y) {
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 10);
  ctx.quadraticCurveTo(x + 16, y, x - 4, y + 10);
  ctx.moveTo(x - 4, y - 10);
  ctx.quadraticCurveTo(x - 12, y, x - 4, y + 10);
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

// Rays from the object tip (or a far object) and the images they form, in cm.
function scene(s) {
  const r = solve(s);
  const last = r.lenses.at(-1);
  const rays = [];
  const images = []; // { x, y, name, real }
  let xMin;
  let xMax = last.x + Math.max(last.f * 1.3, 2);
  if (r.kind === "telescope") {
    const u = -0.02; // far object seen 0,02 rad above the axis
    xMin = -0.18 * r.lenses[0].f;
    const a = 0.06 * r.lenses[0].f;
    for (const y of [a, 0, -a]) rays.push(trace(r.lenses, xMin, y + u * xMin, u));
    images.push({ x: r.lenses[0].f, y: u * r.lenses[0].f, name: "A₁B₁", real: true });
  } else {
    const d = r.lenses[0].d;
    const h = r.kind === "magnifier" ? 1 : 0.1;
    xMin = -d * 1.25;
    rays.push(trace(r.lenses, -d, h, 0), trace(r.lenses, -d, h, -h / d));
    if (r.kind === "microscope") {
      // third ray: aimed at the objective focus F₁, leaves parallel (when the object is outside it)
      if (d > r.lenses[0].f) rays.push(trace(r.lenses, -d, h, h / (r.lenses[0].f - d)));
      if (Number.isFinite(r.lenses[0].dImage)) images.push({ x: r.lenses[0].dImage, y: r.k1 * h, name: "A₁B₁", real: r.lenses[0].dImage > 0 });
    }
    images.unshift({ x: -d, y: h, name: "AB", real: true, object: true });
  }
  // final image
  if (Number.isFinite(r.final)) {
    const fx = last.x + r.final;
    const prev = images.at(-1);
    const fy = r.kind === "magnifier" ? (-r.final / r.lenses[0].d) * prev.y : (-r.final / last.d) * prev.y;
    const near = Math.abs(fx - (xMin + xMax) / 2) < 3 * (xMax - xMin); // too far: named in a caption only
    if (near) {
      images.push({ x: fx, y: fy, name: r.kind === "magnifier" ? "A′B′" : "A₂B₂", real: r.final > 0, final: true });
      xMin = Math.min(xMin, fx - 0.08 * (xMax - fx));
      xMax = Math.max(xMax, fx + 0.05 * (xMax - xMin));
    }
  }
  return { r, rays, images, xMin, xMax };
}

mount({
  slug: "kinh-lup-kinh-hien-vi",
  version: "1.0.0",
  title: "Kính lúp, kính hiển vi và kính thiên văn",
  hint: "Chọn dụng cụ, đổi tiêu cự và khoảng cách để xem đường đi của tia sáng qua từng thấu kính, ảnh trung gian, ảnh cuối cùng và số bội giác. Mắt đặt sát kính cuối.",
  initialState,
  controls: [
    {
      type: "select",
      key: "instrument",
      label: "Dụng cụ quang học",
      options: NAMES.map((label, value) => ({ value, label })),
    },
    { type: "slider", key: "magF", label: "Tiêu cự kính lúp f", min: 2, max: 10, step: 0.5, unit: "cm", digits: 1, visible: is(0) },
    { type: "slider", key: "magD", label: "Khoảng cách vật d", min: 1, max: 10, step: 0.1, unit: "cm", digits: 1, visible: is(0) },
    { type: "slider", key: "micF1", label: "Tiêu cự vật kính f₁", min: 0.4, max: 2, step: 0.1, unit: "cm", digits: 1, visible: is(1) },
    { type: "slider", key: "micF2", label: "Tiêu cự thị kính f₂", min: 1, max: 5, step: 0.5, unit: "cm", digits: 1, visible: is(1) },
    { type: "slider", key: "micL", label: "Khoảng cách O₁O₂", min: 10, max: 25, step: 0.5, unit: "cm", digits: 1, visible: is(1) },
    { type: "slider", key: "micD1", label: "Khoảng cách vật d₁", min: 0.4, max: 2.5, step: 0.001, unit: "cm", digits: 3, visible: is(1) },
    { type: "slider", key: "telF1", label: "Tiêu cự vật kính f₁", min: 40, max: 120, step: 5, unit: "cm", visible: is(2) },
    { type: "slider", key: "telF2", label: "Tiêu cự thị kính f₂", min: 2, max: 10, step: 0.5, unit: "cm", digits: 1, visible: is(2) },
    { type: "slider", key: "telL", label: "Khoảng cách O₁O₂", min: 40, max: 130, step: 0.1, unit: "cm", digits: 1, visible: is(2) },
  ].map(c => (c.key ? { ...c, onCommit: report } : c)).concat([
    {
      type: "button",
      label: "Ngắm chừng ở vô cực",
      primary: true,
      action(s, api) {
        focusAtInfinity(s);
        report(s, api);
      },
      event: "focus-infinity",
    },
  ]),
  readouts: [
    { label: "Ảnh trung gian A₁B₁ cách vật kính", value: s => (s.instrument === 0 ? "–" : cm(solve(s).lenses[0].dImage)) },
    { label: "Ảnh cuối cách kính cuối", value: s => cm(solve(s).final) },
    { label: "Số bội giác G", value: s => (solve(s).G == null ? "–" : fmt(solve(s).G, 2)) },
    { label: "G khi ngắm chừng ở vô cực", value: s => fmt(solve(s).Ginf, 2) },
  ],
  draw(ctx, s, view) {
    const small = view.w < 520 || view.h < 380;
    const size = small ? 12 : 14;
    const { r, rays, images, xMin, xMax } = scene(s);
    const top = small ? 58 : 74;
    const bottom = small ? 24 : 30;
    const cy = top + (view.h - top - bottom) / 2;
    const half = (view.h - top - bottom) / 2 - 8;
    const sx = (view.w - 24) / (xMax - xMin);
    const X = x => 12 + (x - xMin) * sx;
    // vertical scale: fit the object and the intermediate image, and the rays at the lenses
    let yMax = 1e-9;
    for (const im of images) if (!im.final) yMax = Math.max(yMax, Math.abs(im.y));
    for (const ray of rays) for (const p of ray.pts.slice(1)) yMax = Math.max(yMax, Math.abs(p[1]));
    // the final image joins the fit unless it would shrink everything else too much; then it runs off the frame
    const fin = images.find(im => im.final);
    if (fin && Math.abs(fin.y) <= 5 * yMax) yMax = Math.max(yMax, Math.abs(fin.y));
    const sy = (half * 0.85) / yMax;
    const Y = y => cy - y * sy;

    line(ctx, 0, cy, view.w, cy, COLORS.muted, 1.2);
    // names under the axis, skipped when they would sit on top of one already written
    const taken = [];
    const axisLabel = (text, x, bold = false) => {
      const px = X(x) + (bold ? 10 : 0);
      if (taken.some(t => Math.abs(t - px) < 20)) return;
      taken.push(px);
      label(ctx, text, px, cy + 15, { size: size - (bold ? 1 : 2), align: "center", bold });
    };

    // lenses with their focal points
    r.lenses.forEach((l, i) => {
      lensSymbol(ctx, X(l.x), cy, half * 0.95);
      const sub = r.lenses.length > 1 ? (i ? "₂" : "₁") : "";
      axisLabel(`O${sub}`, l.x, true);
      for (const [x, n] of [[l.x - l.f, `F${sub}`], [l.x + l.f, `F${sub}′`]]) {
        if (x < xMin || x > xMax) continue;
        ctx.fillStyle = COLORS.ink;
        ctx.beginPath();
        ctx.arc(X(x), cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        axisLabel(n, x);
      }
    });
    if (!small && r.lenses.length > 1) {
      label(ctx, "Vật kính", X(0), cy - half * 0.95 - 10, { size: size - 1, align: "center", color: COLORS.blue, bold: true });
      label(ctx, "Thị kính", X(r.lenses[1].x), cy - half * 0.95 - 10, { size: size - 1, align: "center", color: COLORS.blue, bold: true });
    }

    // rays: solid where light travels, dashed backward extensions to a virtual final image
    const last = r.lenses.at(-1);
    rays.forEach((ray, i) => {
      const color = RAY_COLORS[i];
      for (let k = 0; k < ray.pts.length - 1; k++) {
        const [a, b] = [ray.pts[k], ray.pts[k + 1]];
        line(ctx, X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), color, 1.8);
      }
      const [lx, ly] = ray.pts.at(-1);
      line(ctx, X(lx), Y(ly), X(xMax + 1e3), Y(ly + ray.slope * (xMax + 1e3 - lx)), color, 1.8);
      if (fin && !fin.real) line(ctx, X(lx), Y(ly), X(fin.x), Y(ly + ray.slope * (fin.x - lx)), color, 1.2, [5, 5]);
    });

    // object, intermediate image, final image
    for (const im of images) {
      const color = im.object ? COLORS.ink : im.final ? COLORS.orange : COLORS.purple;
      ctx.save();
      if (!im.real) ctx.setLineDash([6, 5]);
      arrow(ctx, X(im.x), cy, X(im.x), Y(im.y), color, 3);
      ctx.restore();
      const ty = Math.min(view.h - bottom - 6, Math.max(top + 6, Y(im.y) + (im.y > 0 ? -10 : 10)));
      const cut = ty !== Y(im.y) + (im.y > 0 ? -10 : 10);
      label(ctx, `${im.name}${cut ? " (vượt khung)" : ""}`, Math.min(X(im.x) + 6, view.w - (cut ? 130 : 44)), ty, { size, color, bold: true });
    }
    if (r.kind === "telescope") label(ctx, "Vật ở rất xa", 14, Y(rays[0].pts[0][1]) - 12, { size: size - 1, color: COLORS.muted });
    eyeIcon(ctx, Math.min(view.w - 14, X(last.x) + 26), cy);

    // caption
    let finalText;
    if (r.final === Infinity) finalText = "Ảnh cuối ở vô cực: ngắm chừng ở vô cực";
    else if (r.G == null) finalText = "Ảnh cuối là ảnh thật: mắt sát kính không quan sát được";
    else finalText = `Ảnh cuối ảo, cách kính cuối ${cm(Math.abs(r.final))}${fin ? "" : " (ngoài khung hình)"}`;
    label(ctx, finalText, 12, 18, { size, bold: true, color: r.G == null ? COLORS.red : COLORS.ink });
    const formula = r.kind === "magnifier" ? "G∞ = Đ/f" : r.kind === "microscope" ? "G∞ = δĐ/(f₁f₂)" : "G∞ = f₁/f₂";
    label(ctx, `G = ${r.G == null ? "–" : fmt(r.G, 2)}   ·   ${formula} = ${fmt(r.Ginf, 2)}${r.kind === "microscope" ? `, δ = ${fmt(r.delta, 1)} cm` : ""}   ·   Đ = ${DD} cm`, 12, 40, { size: size - 1, color: COLORS.muted });
    label(ctx, "Chiều cao vẽ phóng to, không theo tỉ lệ", view.w - 10, view.h - 12, { size: 11, align: "right", color: COLORS.muted });
  },
});
