import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, spacing, intensity, readAt, count, markerX } from "./model.js";

/** Approximate RGB (0–1) of monochromatic visible light. */
function rgb(nm) {
  let [r, g, b] = [0, 0, 0];
  if (nm < 440) [r, b] = [(440 - nm) / 60, 1];
  else if (nm < 490) [g, b] = [(nm - 440) / 50, 1];
  else if (nm < 510) [g, b] = [1, (510 - nm) / 20];
  else if (nm < 580) [r, g] = [(nm - 510) / 70, 1];
  else if (nm < 645) [r, g] = [1, (645 - nm) / 65];
  else r = 1;
  const edge = nm < 420 ? 0.5 + (0.5 * (nm - 380)) / 40 : nm > 700 ? 0.5 + (0.5 * (760 - nm)) / 60 : 1;
  return [r, g, b].map(c => c * edge);
}
const css = (c, k = 1) => `rgb(${c.map(v => Math.round(255 * v * k)).join(", ")})`;
const colorName = nm => (nm < 440 ? "tím" : nm < 460 ? "chàm" : nm < 500 ? "lam" : nm < 570 ? "lục" : nm < 590 ? "vàng" : nm < 640 ? "cam" : "đỏ");

const reading = r =>
  r.kind === 1
    ? r.order === 0 ? "vân sáng trung tâm" : `vân sáng bậc ${Math.abs(r.order)}`
    : r.kind === -1
      ? `vân tối thứ ${Math.abs(r.order)}`
      : "nằm giữa hai vân";

const reportMarker = (s, api) => {
  const x = markerX(s);
  const r = readAt(s, x);
  api.emit("marker-read", { x, ratio: r.ratio, order: r.order, kind: r.kind }, "result");
};
const reportSpacing = (s, api) => {
  const c = count(s);
  api.emit("fringe-spacing", { wavelength: s.wavelength, slits: s.slits, distance: s.distance, spacing: spacing(s), field: s.field, bright: c.bright, dark: c.dark }, "result");
};

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const schematic = view.w >= 640; // slits-to-screen sketch only on a wide stage
  const top = small ? 54 : 70;
  const bottom = view.h - (small ? 16 : 28);
  const bw = small ? 64 : 96; // fringe band width
  const bx = schematic ? Math.max(260, view.w * 0.38) : small ? 44 : 60;
  const gx = bx + bw + (small ? 12 : 20);
  const gw = Math.max(60, Math.min(260, view.w - gx - (small ? 118 : 150)));
  return { small, schematic, top, bottom, bw, bx, gx, gw, yc: (top + bottom) / 2 };
}
const toY = (s, g, x) => g.yc - (x / s.field) * (g.bottom - g.top);
const toX = (s, g, y) => -((y - g.yc) / (g.bottom - g.top)) * s.field;

mount({
  slug: "giao-thoa-y-ang",
  version: "1.0.0",
  title: "Giao thoa ánh sáng khe Y-âng",
  hint: "Đổi bước sóng, khoảng cách hai khe a và khoảng cách tới màn D. Kéo vạch đo trên màn (hoặc dùng thanh trượt) để đọc tọa độ x và bậc của vân.",
  initialState,
  controls: [
    { type: "slider", key: "wavelength", label: "Bước sóng λ", min: 380, max: 760, step: 1, format: v => `${fmt(v / 1000, 3)} µm (${colorName(v)})`, onCommit: reportSpacing },
    { type: "slider", key: "slits", label: "Khoảng cách hai khe a", min: 0.2, max: 2, step: 0.05, unit: "mm", onCommit: reportSpacing },
    { type: "slider", key: "distance", label: "Khoảng cách từ hai khe đến màn D", min: 0.5, max: 3, step: 0.1, unit: "m", digits: 1, onCommit: reportSpacing },
    { type: "slider", key: "field", label: "Bề rộng vùng quan sát L", min: 4, max: 30, step: 1, unit: "mm", digits: 0, onCommit: reportSpacing },
    { type: "slider", key: "marker", label: "Vị trí vạch đo x", min: -15, max: 15, step: 0.05, unit: "mm", onChange: s => (s.marker = markerX(s)), onCommit: reportMarker },
  ],
  readouts: [
    { label: "Khoảng vân i = λD/a", value: s => `${fmt(spacing(s), 3)} mm` },
    { label: "Vân sáng / vân tối trên L", value: s => { const c = count(s); return `${c.bright} / ${c.dark}`; } },
    { label: "Vạch đo", value: s => reading(readAt(s, markerX(s))) },
    { label: "x/i (số khoảng vân)", value: s => fmt(readAt(s, markerX(s)).ratio, 2) },
    { label: "Cường độ tại vạch đo I/I₀", value: s => fmt(intensity(s, markerX(s)), 2) },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      if (p.x < g.bx - 10 || p.x > g.gx + g.gw + 20 || p.y < g.top - 10 || p.y > g.bottom + 10) return false;
      s.marker = Math.round(clamp(toX(s, g, p.y), -s.field / 2, s.field / 2) * 100) / 100;
    },
    move(p, s, api, view) {
      const g = geom(view);
      s.marker = Math.round(clamp(toX(s, g, p.y), -s.field / 2, s.field / 2) * 100) / 100;
    },
    up(p, s, api) {
      reportMarker(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const { small, top, bottom, bx, bw, gx, gw } = g;
    const i = spacing(s);
    const c = count(s);
    const col = rgb(s.wavelength);
    const size = small ? 11 : 13;

    // headline
    const head = `i = λD/a = ${fmt(spacing(s), 3)} mm · trên L = ${s.field} mm có ${c.bright} vân sáng, ${c.dark} vân tối`;
    if (small) {
      label(ctx, `i = λD/a = ${fmt(i, 3)} mm`, view.w / 2, 11, { size: 13, bold: true, align: "center" });
      label(ctx, `L = ${s.field} mm: ${c.bright} vân sáng, ${c.dark} vân tối`, view.w / 2, 27, { size: 12, align: "center" });
    } else {
      label(ctx, head, view.w / 2, 22, { size: 16, bold: true, align: "center" });
      label(ctx, `λ = ${fmt(s.wavelength / 1000, 3)} µm · a = ${fmt(s.slits)} mm · D = ${fmt(s.distance, 1)} m`, view.w / 2, 44, { size: 14, color: COLORS.muted, align: "center" });
    }

    // fringe band: each pixel row averaged over 4 samples so fine fringes do not alias
    ctx.fillStyle = "#000";
    ctx.fillRect(bx, top, bw, bottom - top);
    for (let y = Math.floor(top); y < bottom; y++) {
      let I = 0;
      for (let k = 0; k < 4; k++) I += intensity(s, toX(s, g, y + (k + 0.5) / 4));
      ctx.fillStyle = css(col, I / 4);
      ctx.fillRect(bx, y, bw, 1);
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, top, bw, bottom - top);
    label(ctx, "Màn", bx + bw / 2, top - 9, { size, color: COLORS.muted, align: "center" });

    // bright-fringe orders on the left of the band, thinned out when they would crowd
    const px = (i / s.field) * (bottom - top);
    const every = Math.max(1, Math.ceil(16 / px));
    const kMax = Math.floor(s.field / 2 / i + 1e-9);
    for (let k = -kMax; k <= kMax; k++) {
      if (k % every) continue;
      const y = toY(s, g, k * i);
      ctx.strokeStyle = COLORS.muted;
      ctx.beginPath();
      ctx.moveTo(bx - 5, y);
      ctx.lineTo(bx, y);
      ctx.stroke();
      label(ctx, `${k}`, bx - 8, y, { size: size - 1, color: COLORS.muted, align: "right" });
    }
    if (!small) label(ctx, "k", bx - 8, top - 9, { size, color: COLORS.muted, align: "right", bold: true });

    // intensity graph beside the band, same x axis (vertical)
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, top);
    ctx.lineTo(gx, bottom);
    ctx.moveTo(gx + gw, top);
    ctx.lineTo(gx + gw, bottom);
    ctx.stroke();
    ctx.strokeStyle = css(col, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = top; y <= bottom; y += 0.5) {
      const xx = gx + gw * intensity(s, toX(s, g, y));
      y === top ? ctx.moveTo(xx, y) : ctx.lineTo(xx, y);
    }
    ctx.stroke();
    label(ctx, "0", gx, bottom + 9, { size: size - 1, color: COLORS.muted, align: "center" });
    label(ctx, "I/I₀ = 1", gx + gw, bottom + 9, { size: size - 1, color: COLORS.muted, align: "center" });
    label(ctx, small ? "I ∝ cos²(πax/λD)" : "Cường độ I ∝ cos²(πax/λD)", gx + gw / 2, top - 9, { size, color: COLORS.muted, align: "center" });

    // marker
    const xm = markerX(s);
    const ym = toY(s, g, xm);
    const r = readAt(s, xm);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(bx - 2, ym);
    ctx.lineTo(gx + gw + 8, ym);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(gx + gw + 14, ym, 7, 0, Math.PI * 2);
    ctx.fill();
    const tx = gx + gw + 26;
    const ty = clamp(ym, top + 8, bottom - 22);
    label(ctx, `x = ${fmt(xm, 2)} mm`, tx, ty, { size: size + 1, bold: true });
    label(ctx, reading(r), tx, ty + (small ? 15 : 18), { size, color: r.kind === 1 ? COLORS.green : r.kind === -1 ? COLORS.blue : COLORS.muted });

    // sketch of the experiment, not to scale
    if (g.schematic) {
      const sx = 30;
      const wx = Math.min(140, bx * 0.45);
      const half = 26;
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(wx - 3, top + 20, 6, g.yc - half - 4 - top - 20);
      ctx.fillRect(wx - 3, g.yc - half + 4, 6, 2 * half - 8);
      ctx.fillRect(wx - 3, g.yc + half + 4, 6, bottom - 20 - g.yc - half - 4);
      ctx.strokeStyle = css(col, 0.9);
      ctx.lineWidth = 1.5;
      for (const y of [g.yc - half, g.yc + half]) {
        ctx.beginPath();
        ctx.moveTo(sx, g.yc);
        ctx.lineTo(wx, y);
        ctx.lineTo(bx, ym);
        ctx.stroke();
      }
      ctx.fillStyle = css(col);
      ctx.beginPath();
      ctx.arc(sx, g.yc, 5, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, "S", sx, g.yc - 14, { size, bold: true, align: "center" });
      label(ctx, "S₁", wx + 8, g.yc - half - 10, { size, bold: true });
      label(ctx, "S₂", wx + 8, g.yc + half + 10, { size, bold: true });
      label(ctx, "a", wx - 12, g.yc, { size, bold: true, align: "right" });
      const dy = bottom - 8;
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx, dy);
      ctx.lineTo(bx, dy);
      ctx.stroke();
      label(ctx, `D = ${fmt(s.distance, 1)} m`, (wx + bx) / 2, dy - 10, { size, align: "center", color: COLORS.muted });
      label(ctx, "Hình vẽ thí nghiệm không theo tỉ lệ", sx - 10, top - 9, { size: size - 1, color: COLORS.muted });
    }
  },
});
