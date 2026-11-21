import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, pressureAt, columnHeight, tube, columnMass, toMmHg, toAtm, toHPa, cup, carton, TUBE, CORRECT } from "./model.js";

const HG = "#9aa3ad";
const WATER = "#9cc8f0";
const MAX_ALT = 9000;
const p = s => pressureAt(s.altitude);
const pa = v => `${fmt(v, 0)} Pa`;

function report(s, api) {
  api.emit("altitude-set", { altitude: s.altitude, pressure: p(s), mmHg: toMmHg(p(s)), columnHeight: columnHeight(p(s)) * 1000 }, "result");
}

function drawGauge(ctx, s, x, w, top, bottom) {
  const y = alt => bottom - (alt / MAX_ALT) * (bottom - top);
  // mountain silhouette
  ctx.fillStyle = "#dfe7d8";
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  ctx.lineTo(x + w * 0.55, y(8848));
  ctx.lineTo(x + w, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  for (let a = 0; a <= MAX_ALT; a += 1000) {
    ctx.beginPath();
    ctx.moveTo(x, y(a));
    ctx.lineTo(x + 6, y(a));
    ctx.stroke();
    if (a % 2000 === 0) label(ctx, `${fmt(a, 0)} m`, x - 4, y(a), { align: "right", size: 10, color: COLORS.muted });
  }
  const yy = y(s.altitude);
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.moveTo(x, yy);
  ctx.lineTo(x + 10, yy - 6);
  ctx.lineTo(x + 10, yy + 6);
  ctx.closePath();
  ctx.fill();
  label(ctx, `${fmt(toMmHg(p(s)), 0)} mmHg`, x + 13, yy, { size: 11, bold: true, color: COLORS.red });
  label(ctx, "Độ cao", x + w / 2, top - 12, { align: "center", size: 11, color: COLORS.muted });
}

function drawTorricelli(ctx, s, box, small) {
  const pr = p(s);
  const t = tube(pr, s.tilt);
  const th = (s.tilt * Math.PI) / 180;
  // px per m: the whole tube must fit, also when tilted to the right
  const k = Math.min((box.bottom - box.top - 40) / TUBE, (box.w - 200) / (TUBE * Math.sin(th) + 1e-9));
  const dishW = Math.min(box.w * 0.5, 200);
  const surf = box.bottom - 26; // mercury surface in the dish
  const cx = box.x + Math.max(150, Math.min(box.w * 0.48, box.w - 60 - Math.sin(th) * TUBE * k));
  const tw = 6 + 5 * Math.sqrt(s.area); // tube width on screen grows with the cross-section
  // dish
  ctx.fillStyle = HG;
  ctx.fillRect(cx - dishW / 2, surf, dishW, 22);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - dishW / 2, surf - 10);
  ctx.lineTo(cx - dishW / 2, surf + 22);
  ctx.lineTo(cx + dishW / 2, surf + 22);
  ctx.lineTo(cx + dishW / 2, surf - 10);
  ctx.stroke();
  // tube, in its own frame: origin where it crosses the surface, −y along the tube
  const dip = 14;
  ctx.save();
  ctx.translate(cx, surf);
  ctx.rotate(th);
  ctx.fillStyle = "#fff";
  ctx.fillRect(-tw / 2, -TUBE * k, tw, TUBE * k + dip);
  ctx.fillStyle = HG;
  ctx.fillRect(-tw / 2, -t.along * k, tw, t.along * k + dip);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-tw / 2, dip);
  ctx.lineTo(-tw / 2, -TUBE * k);
  ctx.lineTo(tw / 2, -TUBE * k);
  ctx.lineTo(tw / 2, dip);
  ctx.stroke();
  ctx.restore();
  const tip = { x: cx + Math.sin(th) * t.along * k, y: surf - t.vertical * k };
  const top = { x: cx + Math.sin(th) * TUBE * k, y: surf - Math.cos(th) * TUBE * k };
  if (!t.full) label(ctx, "chân không", (tip.x + top.x) / 2 + tw / 2 + 6, (tip.y + top.y) / 2, { size: small ? 10 : 12, color: COLORS.muted });
  else label(ctx, "Ống đầy thủy ngân, không còn chân không", box.x + box.w / 2, box.top + 4, { align: "center", bold: true, size: small ? 11 : 13, color: COLORS.red });
  // vertical height ruler, left of the tube
  const rx = cx - Math.max(36, dishW * 0.35);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rx - 6, tip.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.setLineDash([]);
  arrow(ctx, rx, surf, rx, tip.y, COLORS.orange, 2);
  arrow(ctx, rx, tip.y, rx, surf, COLORS.orange, 2);
  label(ctx, `h = ${fmt(t.vertical * 100, 1)} cm`, rx - 6, (surf + tip.y) / 2, { align: "right", bold: true, size: small ? 12 : 14, color: COLORS.orange });
  // A outside, B inside at the same level: p_A = p_B = p_kq
  ctx.fillStyle = COLORS.ink;
  const ax = cx + dishW * 0.44;
  for (const [x, n] of [[ax, "A"], [cx, "B"]]) {
    ctx.beginPath();
    ctx.arc(x, surf, 3, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, n, x + 5, surf + 9, { size: 11, bold: true });
  }
  arrow(ctx, ax, surf - 30, ax, surf - 4, COLORS.blue, 2);
  label(ctx, "p_kq", ax + 4, surf - 34, { size: 12, bold: true, color: COLORS.blue });
  if (!small) label(ctx, "p_A = p_B = p_kq = ρ·g·h", cx + dishW / 2 + 8, surf + 11, { size: 12, color: COLORS.muted });
}

function drawCup(ctx, s, box, small) {
  const c = cup(p(s));
  const cw = Math.min(box.w * 0.32, 120);
  const ch = Math.min((box.bottom - box.top) * 0.45, 170);
  const cx = box.x + box.w / 2;
  const bottom = box.top + (box.bottom - box.top) * 0.62; // paper level
  ctx.fillStyle = WATER;
  ctx.fillRect(cx - cw / 2, bottom - ch, cw, ch);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - cw / 2, bottom);
  ctx.lineTo(cx - cw / 2, bottom - ch);
  ctx.lineTo(cx + cw / 2, bottom - ch);
  ctx.lineTo(cx + cw / 2, bottom);
  ctx.stroke();
  ctx.fillStyle = "#fffdf5";
  ctx.fillRect(cx - cw / 2 - 12, bottom, cw + 24, 4);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - cw / 2 - 12, bottom, cw + 24, 4);
  label(ctx, "tờ giấy", cx + cw / 2 + 16, bottom + 2, { size: 11, color: COLORS.muted });
  for (const dx of [-0.3, 0, 0.3]) arrow(ctx, cx + dx * cw, bottom + 50, cx + dx * cw, bottom + 8, COLORS.blue, 2.5);
  label(ctx, `áp suất khí quyển đẩy lên: ${pa(c.up)}`, cx, bottom + 62, { align: "center", bold: true, size: small ? 11 : 13, color: COLORS.blue });
  arrow(ctx, cx, bottom - 20, cx, bottom - 4, COLORS.red, 2);
  label(ctx, `nước ép xuống ρ·g·h = ${pa(c.down)}`, cx, bottom - ch - 14, { align: "center", size: small ? 11 : 13, color: COLORS.red });
  const msg =
    s.answer === "none"
      ? "Vì sao nước không chảy ra? Chọn câu trả lời ở bảng bên."
      : s.answer === CORRECT
        ? `Đúng! Muốn đẩy rơi tờ giấy, cột nước phải cao hơn ${fmt(c.maxWater, 1)} m.`
        : "Chưa đúng, hãy so sánh hai áp suất trên hình.";
  label(ctx, msg, cx, box.top + 6, { align: "center", bold: s.answer !== "none", size: small ? 11 : 14, color: s.answer === "none" ? COLORS.ink : s.answer === CORRECT ? COLORS.green : COLORS.red });
}

function drawCarton(ctx, s, box, small) {
  const c = carton(p(s), s.suction);
  const w = Math.min(box.w * 0.3, 110);
  const h = Math.min((box.bottom - box.top) * 0.6, 200);
  const cx = box.x + box.w / 2;
  const y0 = box.top + (box.bottom - box.top - h) / 2 + 10;
  const d = (s.suction / 100) * w * 0.38; // how far the faces cave in
  ctx.fillStyle = "#f2f6fb";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y0);
  ctx.lineTo(cx + w / 2, y0);
  ctx.quadraticCurveTo(cx + w / 2 - 2 * d, y0 + h / 2, cx + w / 2, y0 + h);
  ctx.lineTo(cx - w / 2, y0 + h);
  ctx.quadraticCurveTo(cx - w / 2 + 2 * d, y0 + h / 2, cx - w / 2, y0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  label(ctx, "SỮA", cx, y0 + h * 0.3, { align: "center", bold: true, size: 13, color: COLORS.blue });
  // straw
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.2, y0 + 10);
  ctx.lineTo(cx + w * 0.3, y0 - 36);
  ctx.stroke();
  const len = 12 + 30 * (c.difference / p(s));
  for (const f of [0.3, 0.5, 0.7]) {
    const y = y0 + h * f;
    arrow(ctx, cx - w / 2 - 14 - len, y, cx - w / 2 + d * 0.8 - 4, y, COLORS.blue, 2.5);
    arrow(ctx, cx + w / 2 + 14 + len, y, cx + w / 2 - d * 0.8 + 4, y, COLORS.blue, 2.5);
  }
  label(ctx, `p trong hộp = ${pa(c.inside)}`, cx, y0 + h + 18, { align: "center", bold: true, size: small ? 11 : 13 });
  label(ctx, `p_kq bên ngoài = ${pa(p(s))}`, cx, y0 - 50, { align: "center", size: small ? 11 : 13, color: COLORS.blue });
  if (!small) label(ctx, `Lực ép lên một mặt hộp: F = (p_kq − p_trong)·S = ${fmt(c.force, 0)} N`, cx, y0 + h + 40, { align: "center", size: 12, color: COLORS.muted });
}

const isTube = s => s.demo === "torricelli";

mount({
  slug: "ap-suat-khi-quyen",
  version: "1.0.0",
  title: "Áp suất khí quyển",
  hint: "Đổi độ cao để xem áp suất khí quyển và cột thủy ngân thay đổi; nghiêng ống, đổi tiết diện ống; thử hai thí nghiệm cốc nước và hộp sữa.",
  initialState,
  controls: [
    {
      type: "select",
      key: "demo",
      label: "Thí nghiệm",
      options: [
        { value: "torricelli", label: "Ống Torricelli" },
        { value: "cup", label: "Cốc nước úp ngược có tờ giấy" },
        { value: "carton", label: "Hút hộp sữa giấy" },
      ],
    },
    { type: "slider", key: "altitude", label: "Độ cao so với mực nước biển", min: 0, max: MAX_ALT, step: 50, unit: "m", digits: 0, onCommit: report },
    { type: "slider", key: "tilt", label: "Góc nghiêng của ống", min: 0, max: 60, step: 1, unit: "°", digits: 0, visible: isTube },
    { type: "slider", key: "area", label: "Tiết diện ống", min: 0.25, max: 4, step: 0.25, unit: "cm²", digits: 2, visible: isTube },
    {
      type: "select",
      key: "answer",
      label: "Vì sao nước không chảy ra?",
      visible: s => s.demo === "cup",
      onCommit(s, api) {
        if (s.answer === CORRECT) api.emit("explained", { pressure: p(s) }, "goal");
      },
      options: [
        { value: "none", label: "– Chọn câu trả lời –" },
        { value: "a", label: "Nước dính chặt vào tờ giấy" },
        { value: "b", label: "Áp suất khí quyển đẩy tờ giấy lên lớn hơn áp suất nước ép xuống" },
        { value: "c", label: "Đáy cốc hút nước lại" },
        { value: "d", label: "Nước trong cốc quá nhẹ, không có trọng lượng" },
      ],
    },
    { type: "slider", key: "suction", label: "Lượng không khí đã hút ra", min: 0, max: 90, step: 5, unit: "%", digits: 0, visible: s => s.demo === "carton" },
  ],
  readouts: [
    { label: "Áp suất khí quyển", value: s => pa(p(s)) },
    { label: "Đổi đơn vị", value: s => `${fmt(toMmHg(p(s)), 1)} mmHg` },
    { label: "", value: s => `${fmt(toAtm(p(s)), 3)} atm = ${fmt(toHPa(p(s)), 1)} hPa` },
    { label: "Cột thủy ngân h = p/(ρ·g)", value: s => `${fmt(columnHeight(p(s)) * 100, 1)} cm` },
    { label: "Chiều dài cột trong ống", value: s => `${fmt(tube(p(s), s.tilt).along * 100, 1)} cm` },
    { label: "Khối lượng thủy ngân", value: s => `${fmt(columnMass(p(s), s.tilt, s.area) * 1000, 0)} g` },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 430;
    const gauge = small ? 0 : 130;
    const box = { x: 0, w: view.w - gauge, top: small ? 28 : 46, bottom: view.h - (small ? 30 : 44) };
    const head = isTube(s) ? `p_kq = ρ_Hg·g·h  ·  ${fmt(s.altitude, 0)} m: ${fmt(toMmHg(p(s)), 0)} mmHg` : `Độ cao ${fmt(s.altitude, 0)} m: p_kq = ${fmt(toHPa(p(s)), 0)} hPa`;
    label(ctx, head, view.w / 2, small ? 12 : 22, { align: "center", bold: true, size: small ? 12 : 16 });
    if (s.demo === "cup") drawCup(ctx, s, box, small);
    else if (s.demo === "carton") drawCarton(ctx, s, box, small);
    else drawTorricelli(ctx, s, box, small);
    if (gauge) drawGauge(ctx, s, view.w - gauge + 34, 50, box.top + 20, box.bottom);
    const note = small
      ? "Khí quyển chuẩn ISA · hình không theo tỉ lệ"
      : "p theo độ cao: khí quyển chuẩn ISA p = p₀(1 − 2,256·10⁻⁵·h)^5,256 · ρ_Hg = 13 595 kg/m³ · hình không theo tỉ lệ";
    label(ctx, note, view.w / 2, view.h - (small ? 10 : 16), { align: "center", size: small ? 10 : 11, color: COLORS.muted });
  },
});
