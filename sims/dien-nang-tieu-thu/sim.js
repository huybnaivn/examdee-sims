import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, compute, LAMPS, LIMITS, DAYS, billWithLed, cutPercent, refBill } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const money = n => `${fmt(Math.round(n), 0)} đ`;
const TIER_COLORS = ["#cfe8dc", "#a6d8c0", "#f7e3a1", "#f5c77e", "#f29f80", "#e5767a"];

// One result per finished change, and a goal the first time the cut reaches the target.
function report(s, api) {
  const c = compute(s);
  const cut = cutPercent(s, c.bill);
  api.emit("bill-computed", { kwhMonth: c.monthKwh, kwhDay: c.dayKwh, bill: c.bill, cutPercent: cut }, "result");
  if (cut >= s.target && !s.goalReached) {
    s.goalReached = true;
    api.emit("bill-cut", { percent: cut, bill: c.bill, refBill: refBill(s), target: s.target }, "goal");
  } else if (cut < s.target) {
    s.goalReached = false;
  }
}

const group = (id, name, p) => [
  { type: "heading", label: name },
  { type: "slider", key: `p_${id}`, label: "Công suất", ...p, unit: "W", digits: 0 },
  { type: "slider", key: `h_${id}`, label: "Thời gian dùng mỗi ngày", min: 0, max: 24, step: 0.5, unit: "h", digits: 1 },
];

function textWidth(ctx, text, size, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  return ctx.measureText(text).width;
}

mount({
  slug: "dien-nang-tieu-thu",
  version: "1.0.0",
  title: "Điện năng tiêu thụ và tiền điện",
  hint: "Đặt công suất và số giờ dùng mỗi ngày của từng đồ dùng điện, xem điện năng một tháng và tiền điện theo bậc thang.",
  initialState,
  controls: [
    { type: "heading", label: "Bóng đèn" },
    { type: "select", key: "lampType", label: "Loại bóng", options: Object.entries(LAMPS).map(([value, l]) => ({ value, label: l.name })) },
    { type: "stepper", key: "lampCount", label: "Số bóng", min: 0, max: 10 },
    { type: "slider", key: "h_lamp", label: "Thời gian dùng mỗi ngày", min: 0, max: 24, step: 0.5, unit: "h", digits: 1 },
    ...group("fan", "Quạt điện", { min: 20, max: 100, step: 5 }),
    ...group("fridge", "Tủ lạnh (thời gian máy nén chạy)", { min: 50, max: 300, step: 10 }),
    ...group("ac", "Điều hòa", { min: 500, max: 2500, step: 50 }),
    ...group("cooker", "Nồi cơm điện", { min: 300, max: 1200, step: 50 }),
    ...group("tv", "Tivi", { min: 30, max: 300, step: 10 }),
    { type: "heading", label: "Mục tiêu tiết kiệm" },
    { type: "slider", key: "target", label: "Giảm tiền điện ít nhất", min: 5, max: 50, step: 5, unit: "%", digits: 0 },
    {
      type: "button",
      label: "Lấy tháng hiện tại làm mốc so sánh",
      action(s) {
        s.refKwh = compute(s).monthKwh;
        s.goalReached = false;
      },
      event: "reference-set",
    },
    { type: "heading", label: "Biểu giá (minh họa)" },
    { type: "checkbox", key: "editTariff", label: "Sửa giá từng bậc" },
    ...[1, 2, 3, 4, 5, 6].map(k => ({
      type: "slider",
      key: `t${k}`,
      label: `Bậc ${k} (${k < 6 ? `${k === 1 ? 0 : LIMITS[k - 2] + 1}–${LIMITS[k - 1]}` : `từ ${LIMITS[4] + 1}`} kWh)`,
      min: 500,
      max: 6000,
      step: 10,
      unit: "đ/kWh",
      digits: 0,
      visible: s => s.editTariff,
    })),
  ].map(c => (c.key ? { ...c, onCommit: report } : c)),
  readouts: [
    { label: "Điện năng một ngày", value: s => `${fmt(compute(s).dayKwh, 2)} kWh` },
    { label: `Điện năng một tháng (${DAYS} ngày)`, value: s => `${fmt(compute(s).monthKwh, 1)} kWh` },
    { label: "Tiền điện một tháng", value: s => money(compute(s).bill) },
    { label: "Đổi hết sang đèn LED thì bớt", value: s => `${money(compute(s).bill - billWithLed(s))}/tháng` },
    { label: "So với tháng mốc", value: s => `${cutPercent(s) >= 0 ? "giảm" : "tăng"} ${fmt(Math.abs(cutPercent(s)), 1)}%` },
  ],
  draw(ctx, s, view) {
    const c = compute(s);
    const small = view.w < 560 || view.h < 430;
    const pad = small ? 8 : 24;
    const size = small ? 11 : 14;
    let y = small ? 12 : 26;

    if (!small) {
      label(ctx, `Điện năng tiêu thụ trong một tháng (${DAYS} ngày): A = P·t`, view.w / 2, y, { size: 16, bold: true, align: "center" });
      y += 26;
    }

    // ---- appliance bars ----
    const tierH = small ? 64 : 110; // tier strip below
    const footH = small ? 34 : 84;
    const rowH = Math.max(small ? 22 : 30, Math.min(small ? 30 : 60, (view.h - y - tierH - footH) / c.items.length));
    const nameW = small ? 62 : 120;
    const valueW = small ? 108 : 210;
    const barX = pad + nameW;
    const barW = Math.max(30, view.w - pad - barX - valueW);
    const maxK = Math.max(...c.items.map(a => a.monthKwh), 1e-9);
    c.items.forEach((a, k) => {
      const cy = y + rowH * (k + 0.5);
      const isTop = a === c.top && a.monthKwh > 0;
      label(ctx, small ? a.short : a.name, pad, cy - (small ? 0 : 7), { size, bold: isTop });
      if (!small) {
        const detail = a.id === "lamp" ? `${s.lampCount} × ${(LAMPS[s.lampType] ?? LAMPS.incandescent).power} W · ${fmt(a.hours, 1)} h` : `${fmt(a.power, 0)} W · ${fmt(a.hours, 1)} h`;
        label(ctx, detail, pad, cy + 9, { size: 11, color: COLORS.muted });
      }
      const w = (a.monthKwh / maxK) * barW;
      ctx.fillStyle = COLORS.grid;
      ctx.fillRect(barX, cy - rowH * 0.3, barW, rowH * 0.6);
      ctx.fillStyle = isTop ? COLORS.orange : COLORS.blue;
      ctx.fillRect(barX, cy - rowH * 0.3, w, rowH * 0.6);
      const value = small ? `${fmt(a.monthKwh, 1)} kWh` : `${fmt(a.monthKwh, 1)} kWh · ${money(a.cost)}`;
      label(ctx, value, barX + barW + 6, cy - (small && isTop ? 6 : 0), { size, bold: isTop });
      if (isTop) label(ctx, small ? "tốn nhất" : "", barX + barW + 6, cy + 7, { size: 10, color: COLORS.orange, bold: true });
    });
    if (!small) label(ctx, "cam: đồ dùng tốn điện nhất · tiền của từng đồ dùng chia theo tỉ lệ điện năng", pad, y + rowH * c.items.length + 8, { size: 11, color: COLORS.muted });
    y += rowH * c.items.length + (small ? 6 : 24);

    // ---- tier strip: how the month's kWh fills the tariff blocks ----
    const stripW = view.w - 2 * pad;
    const scaleMax = Math.max(c.monthKwh, 450);
    const X = k => pad + (k / scaleMax) * stripW;
    const sh = small ? 16 : 24;
    label(ctx, small ? "Tiền điện theo bậc (giá minh họa, chưa VAT)" : "Tiền điện bậc thang · biểu giá minh họa, có thể sửa ở bảng điều khiển, không phải giá chính thức, chưa gồm VAT", pad, y + 6, { size: small ? 10 : 12, color: COLORS.muted });
    y += small ? 24 : 34; // room for the block limits above the strip
    let lower = 0;
    LIMITS.forEach((upper, k) => {
      const hi = Math.min(upper, scaleMax);
      ctx.fillStyle = COLORS.grid;
      ctx.fillRect(X(lower), y, X(hi) - X(lower), sh);
      const used = c.tiers[k].kwh;
      ctx.fillStyle = TIER_COLORS[k];
      ctx.fillRect(X(lower), y, X(lower + used) - X(lower), sh);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(X(lower), y, X(hi) - X(lower), sh);
      const mid = (X(lower) + X(hi)) / 2;
      const segW = X(hi) - X(lower);
      const text = `${fmt(c.tiers[k].price, 0)}`;
      if (textWidth(ctx, text, small ? 9 : 11) < segW - 2) label(ctx, text, mid, y + sh / 2, { size: small ? 9 : 11, align: "center", color: COLORS.ink });
      if (!small && used > 0) {
        const t = money(c.tiers[k].cost);
        if (textWidth(ctx, t, 11) < segW - 2) label(ctx, t, mid, y + sh + 10, { size: 11, align: "center", color: COLORS.muted });
      }
      if (upper < scaleMax) label(ctx, fmt(upper, 0), X(upper), y - (small ? 5 : 7), { size: small ? 9 : 10, align: "center", color: COLORS.muted });
      lower = upper;
    });
    // marker at the month's total
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(X(c.monthKwh) - 1, y - 3, 2, sh + 6);
    y += sh + (small ? 14 : 30);

    // ---- totals and savings ----
    const total = `${fmt(c.monthKwh, 1)} kWh/tháng → ${money(c.bill)}`;
    label(ctx, total, pad, y, { size: small ? 13 : 16, bold: true, color: COLORS.blue });
    const cut = cutPercent(s, c.bill);
    const reached = cut >= s.target;
    const cutText = `${cut >= 0 ? "Giảm" : "Tăng"} ${fmt(Math.abs(cut), 1)}% so với mốc (mục tiêu ${fmt(s.target, 0)}%)${reached ? " ✓" : ""}`;
    const ledSave = c.bill - billWithLed(s);
    const ledText = s.lampType === "led" || s.lampCount === 0 || s.h_lamp === 0 ? "" : `Đổi sang đèn LED: bớt ${money(ledSave)}/tháng`;
    if (small) {
      label(ctx, cutText, pad, y + 16, { size: 11, color: reached ? COLORS.green : COLORS.muted, bold: reached });
    } else {
      label(ctx, cutText, pad, y + 22, { size: 13, color: reached ? COLORS.green : COLORS.muted, bold: reached });
      if (ledText) label(ctx, ledText, view.w - pad, y + 22, { size: 13, align: "right", color: COLORS.green });
      label(ctx, "A = P·t (P tính bằng kW, t tính bằng h thì A tính bằng kWh); 1 kWh = 1000 W·h = 3,6·10⁶ J", pad, y + 44, { size: 12, color: COLORS.muted });
    }
  },
});
