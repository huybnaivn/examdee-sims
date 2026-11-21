import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import {
  OV, DISTANCES, initialState, limits, eyePower, eyeFocal, imageDistance, retinaOffset,
  isSharp, isCorrect, correctLens, seenRange, effectiveVergence,
} from "./model.js";

const PUPIL = 0.42; // cm, height of the outer rays at the eye lens
const dp = v => `${v > 0.004 ? "+" : ""}${fmt(v, 2)} dp`;
const cm = v => (Number.isFinite(v) ? `${fmt(v, 1)} cm` : "vô cực");
const distText = d => (d > 0 ? `${fmt(d, 1)} cm` : "vô cực");

// One result per committed lens power, and a goal the first time it lands on the textbook correction.
const report = (s, api) => {
  const sharp = isSharp(s) ? 1 : 0;
  api.emit("lens-set", { power: s.lens, sharp, distance: s.distance }, "result");
  const ok = isCorrect(s);
  if (ok && !s._correct) api.emit("lens-correct", { power: s.lens, target: correctLens(s) }, "goal");
  s._correct = ok;
};
const eyeChanged = s => {
  s._correct = false;
};

function line(ctx, pts, color, width = 2, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
}

function lensSymbol(ctx, x, cy, half, power, color) {
  if (power > 0) {
    arrow(ctx, x, cy, x, cy - half, color, 3);
    arrow(ctx, x, cy, x, cy + half, color, 3);
  } else {
    line(ctx, [[x, cy - half], [x, cy + half]], color, 3);
    for (const [y, dir] of [[cy - half, -1], [cy + half, 1]]) {
      line(ctx, [[x, y], [x - 7, y + dir * 10]], color, 3);
      line(ctx, [[x, y], [x + 7, y + dir * 10]], color, 3);
    }
  }
}

mount({
  slug: "mat-va-tat-khuc-xa",
  version: "1.0.0",
  title: "Mắt và các tật khúc xạ",
  hint: "Chọn loại mắt và vị trí vật. Mắt tự điều tiết; nếu ảnh không rơi đúng màng lưới, hãy chỉnh độ tụ kính cho đến khi ảnh rõ.",
  initialState,
  controls: [
    {
      type: "select",
      key: "eye",
      label: "Loại mắt",
      onChange: eyeChanged,
      options: [
        { value: "normal", label: "Mắt thường (OC_c = 25 cm, OC_v ở vô cực)" },
        { value: "myopia", label: "Mắt cận thị" },
        { value: "hyperopia", label: "Mắt viễn thị" },
      ],
    },
    { type: "slider", key: "farPoint", label: "Điểm cực viễn OC_v", min: 25, max: 200, step: 5, unit: "cm", onChange: eyeChanged, visible: s => s.eye === "myopia" },
    { type: "slider", key: "nearMyopia", label: "Điểm cực cận OC_c", min: 8, max: 20, step: 1, unit: "cm", visible: s => s.eye === "myopia" },
    { type: "slider", key: "nearHyper", label: "Điểm cực cận OC_c", min: 30, max: 150, step: 5, unit: "cm", onChange: eyeChanged, visible: s => s.eye === "hyperopia" },
    { type: "heading", label: "Vật và kính" },
    {
      type: "select",
      key: "distance",
      label: "Khoảng cách từ vật đến mắt d",
      options: DISTANCES.map(d => ({ value: d, label: distText(d) })),
    },
    {
      type: "slider",
      key: "lens",
      label: "Độ tụ của kính D_k",
      min: -6,
      max: 6,
      step: 0.05,
      format: v => (Math.abs(v) < 0.001 ? "không đeo kính" : `${dp(v)} (${v > 0 ? "hội tụ" : "phân kì"})`),
      onCommit: report,
    },
  ],
  readouts: [
    { label: "Ảnh trên màng lưới", value: s => (isSharp(s) ? "rõ" : "mờ") },
    { label: "Độ tụ của mắt", value: s => `${fmt(eyePower(s), 2)} dp` },
    { label: "Tiêu cự của mắt", value: s => `${fmt(eyeFocal(s), 3)} cm` },
    { label: "Ảnh cách thể thủy tinh", value: s => `${fmt(imageDistance(s), 3)} cm` },
    {
      label: "Khoảng nhìn rõ",
      value: s => {
        const r = seenRange(s);
        return r ? `${cm(r.near)} → ${cm(r.far)}` : "không nhìn rõ vật thật nào";
      },
    },
  ],
  draw(ctx, s, view) {
    const small = view.w < 520 || view.h < 380;
    const size = small ? 12 : 14;
    const cy = view.h * 0.5 + (small ? 6 : 10);
    // eye geometry: lens at lensX, retina OV cm behind; k px per cm
    const k = Math.min((view.w * 0.4) / (OV * 1.15), (view.h - (small ? 120 : 170)) / 1.9);
    const retinaX = view.w - (small ? 26 : 50);
    const lensX = retinaX - OV * k;
    const glassX = lensX - (small ? 26 : 40);
    const left = small ? 44 : 80;
    const Y = y => cy - y * k;

    const u = effectiveVergence(s);
    const vObj = s.distance > 0 ? 100 / s.distance : 0;
    const v = imageDistance(s);
    const off = retinaOffset(s);
    const sharp = isSharp(s);
    const lens = Math.abs(s.lens) >= 0.001;

    // eyeball
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse((lensX + retinaX) / 2 + 2, cy, (retinaX - lensX) / 2 + 8, 0.95 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // retina
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse((lensX + retinaX) / 2 + 2, cy, (retinaX - lensX) / 2 + 8, 0.95 * k, 0, -0.5, 0.5);
    ctx.stroke();
    // axis
    line(ctx, [[0, cy], [view.w, cy]], COLORS.muted, 1, [4, 4]);

    // rays: outside the eye the slope is y·V (y in m), drawn at the same scale as the eye
    const rayColor = sharp ? COLORS.green : COLORS.orange;
    for (const y of [PUPIL, PUPIL / 2, -PUPIL / 2, -PUPIL]) {
      const slopeIn = (y * vObj) / 100; // before the corrective lens
      const slopeMid = (y * u) / 100; // after it
      const yGlass = y - (slopeMid * (lensX - glassX)) / k;
      const yLeft = yGlass - (slopeIn * (glassX - left)) / k;
      line(ctx, [[left, Y(yLeft)], [glassX, Y(yGlass)], [lensX, Y(y)]], COLORS.blue, 1.6);
      // inside the eye: towards the image point (v, 0)
      const yRet = y * (1 - OV / v);
      line(ctx, [[lensX, Y(y)], [retinaX, Y(yRet)]], rayColor, 1.8);
      if (v > OV) line(ctx, [[retinaX, Y(yRet)], [lensX + Math.min(v, OV * 1.25) * k, Y(y * (1 - Math.min(v, OV * 1.25) / v))]], rayColor, 1.2, [4, 4]);
    }
    // image point and blur spot
    const ix = lensX + Math.min(v, OV * 1.25) * k;
    ctx.fillStyle = sharp ? COLORS.green : COLORS.orange;
    ctx.beginPath();
    ctx.arc(ix, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (!sharp) {
      const spot = Math.abs(PUPIL * (1 - OV / v)) * k;
      line(ctx, [[retinaX, cy - spot], [retinaX, cy + spot]], COLORS.orange, 6);
    }

    // eye lens (thể thủy tinh) and corrective lens
    lensSymbol(ctx, lensX, cy, 0.6 * k, 1, COLORS.ink);
    if (lens) lensSymbol(ctx, glassX, cy, 0.6 * k, s.lens, COLORS.purple);

    // object
    const objText = s.distance > 0 ? `Vật cách mắt ${fmt(s.distance, 1)} cm` : "Vật ở vô cực (chùm tia song song)";
    if (s.distance > 0) arrow(ctx, left - (small ? 18 : 30), cy, left - (small ? 18 : 30), cy - 0.6 * k, COLORS.ink, 3);
    label(ctx, objText, 10, cy + 0.6 * k + (small ? 16 : 22), { size, bold: true });
    if (lens) label(ctx, `Kính ${dp(s.lens)}`, glassX + 4, cy - 0.6 * k - 18, { size, align: "right", color: COLORS.purple, bold: true });
    label(ctx, "Màng lưới", retinaX, cy + 0.95 * k + 14, { size: size - 1, align: "right", color: COLORS.red });
    if (!small) label(ctx, "Thể thủy tinh", lensX + 16, cy - 0.6 * k - 4, { size: size - 1, align: "left", color: COLORS.muted });

    // status caption
    const { far, near } = limits(s);
    const where = Math.abs(off) < 1e-6 ? "Ảnh hiện rõ trên màng lưới" : `Ảnh ở ${off < 0 ? "trước" : "sau"} màng lưới ${fmt(Math.abs(off) * 10, 2)} mm, nhìn mờ`;
    label(ctx, where, 12, 18, { size: size + 1, bold: true, color: sharp ? COLORS.green : COLORS.red });
    const ocv = far > 1e-9 ? `${fmt(100 / far, 1)} cm` : far < -1e-9 ? `ảo, sau mắt ${fmt(-100 / far, 1)} cm` : "vô cực";
    label(ctx, `OC_c = ${fmt(100 / near, 1)} cm · OC_v = ${ocv} · U′ = 1/d − D_k = ${fmt(u, 2)} dp`, 12, 40, { size: size - 1, color: COLORS.muted });
    if (lens && isCorrect(s)) label(ctx, "Kính này đúng độ sửa tật", 12, 60, { size, bold: true, color: COLORS.green });

    // what the eye sees: a letter blurred by the size of the spot on the retina
    if (!small) {
      const bx = 12;
      const by = view.h - 74;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.fillRect(bx, by, 64, 52);
      ctx.strokeRect(bx, by, 64, 52);
      ctx.save();
      ctx.filter = `blur(${Math.min(8, Math.abs(PUPIL * (1 - OV / v)) * 400).toFixed(2)}px)`;
      label(ctx, "E", bx + 32, by + 27, { size: 34, align: "center", bold: true });
      ctx.restore();
      label(ctx, "Mắt nhìn thấy", bx + 74, by + 26, { size: 12, color: COLORS.muted });
    }
    label(ctx, "Hình vẽ không theo tỉ lệ · kính coi như đặt sát mắt", view.w - 10, view.h - 12, { size: 11, align: "right", color: COLORS.muted });
  },
});
