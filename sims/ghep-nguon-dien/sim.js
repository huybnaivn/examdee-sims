import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, bank, solve, solveAt, maxPower, atMaxPower } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// label() with one-letter subscripts: "E_b = 4,5 V" draws the b lowered and smaller.
function rich(ctx, text, x, y, { size = 14, color = COLORS.ink, bold = false, align = "left" } = {}) {
  const parts = text.split(/_(.)/);
  const font = k => `${bold ? "600 " : ""}${k % 2 ? size * 0.72 : size}px ${FONT}`;
  ctx.save();
  const widths = parts.map((p, k) => ((ctx.font = font(k)), ctx.measureText(p).width));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  parts.forEach((p, k) => {
    ctx.font = font(k);
    ctx.fillText(p, cx, y + (k % 2 ? size * 0.3 : 0));
    cx += widths[k];
  });
  ctx.restore();
}

// One result per finished change; the goal once each time R arrives at the maximum-power position.
const report = (s, api) => {
  const c = solve(s);
  api.emit("circuit-solved", { emfBank: c.emfBank, rBank: c.rBank, current: c.current, voltage: c.voltage, power: c.power, efficiency: c.efficiency }, "result");
  const hit = atMaxPower(s);
  if (hit && !s.atMax) api.emit("max-power", { resistance: s.R, rBank: c.rBank, power: c.power }, "goal");
  s.atMax = hit;
};

const niceMax = v => [1, 2, 5, 10, 20].find(t => t >= v) ?? 20;

function drawGraph(ctx, s, c, box, small) {
  const size = small ? 11 : 13;
  const x0 = box.x + (small ? 30 : 44);
  const x1 = box.x + box.w - (small ? 34 : 48);
  const y0 = box.y + (small ? 16 : 22);
  const y1 = box.y + box.h - (small ? 26 : 32);
  const xMax = niceMax(Math.max(5 * c.rBank, s.R));
  const pMax = maxPower(s);
  const X = R => x0 + ((x1 - x0) * R) / xMax;
  const YP = p => y1 - ((y1 - y0) * p) / (pMax * 1.12);
  const YH = h => y1 - ((y1 - y0) * h) / 1.12;

  ctx.fillStyle = "#fff";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let k = 0; k <= 5; k++) {
    const x = X((xMax * k) / 5);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    label(ctx, fmt((xMax * k) / 5, 1), x, y1 + 9, { size: size - 1, align: "center", color: COLORS.muted });
  }
  // P_max level
  ctx.strokeStyle = COLORS.muted;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, YP(pMax));
  ctx.lineTo(x1, YP(pMax));
  ctx.stroke();
  ctx.setLineDash([]);

  const curve = (f, Y, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px <= x1 - x0; px += 2) {
      const R = (xMax * px) / (x1 - x0);
      ctx[px ? "lineTo" : "moveTo"](x0 + px, Y(f(solveAt(s, R))));
    }
    ctx.stroke();
  };
  curve(o => o.efficiency, YH, COLORS.green);
  curve(o => o.power, YP, COLORS.blue);

  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1, y0);
  ctx.stroke();
  label(ctx, "P (W)", x0, y0 - 9, { size, bold: true, color: COLORS.blue, align: "center" });
  label(ctx, "H (%)", x1, y0 - 9, { size, bold: true, color: COLORS.green, align: "center" });
  label(ctx, "0", x0 - 5, y1, { size: size - 1, align: "right", color: COLORS.muted });
  label(ctx, "100", x1 + 4, YH(1), { size: size - 1, color: COLORS.green });
  label(ctx, "50", x1 + 4, YH(0.5), { size: size - 1, color: COLORS.green });
  label(ctx, "R (Ω)", (x0 + x1) / 2, y1 + (small ? 20 : 24), { size, align: "center", color: COLORS.muted });

  // where the circuit is now
  const x = X(Math.min(s.R, xMax));
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  for (const [y, color] of [[YH(c.efficiency), COLORS.green], [YP(c.power), COLORS.blue]]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // on a white backing so the marker cannot strike through it
  const tag = `P_m_a_x = ${fmt(pMax)} W`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(x1 - 6 - tag.length * size * 0.5, YP(pMax) + 3, tag.length * size * 0.5 + 4, size + 3);
  rich(ctx, tag, x1 - 4, YP(pMax) + size * 0.9, { size: size - 1, align: "right", color: COLORS.muted });
}

mount({
  slug: "ghep-nguon-dien",
  version: "1.0.0",
  title: "Ghép nguồn điện và định luật Ôm cho toàn mạch",
  hint: "Ghép các nguồn giống nhau thành bộ rồi đổi điện trở R. Tìm giá trị R để công suất mạch ngoài lớn nhất.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Cách ghép bộ nguồn",
      options: [
        { value: "series", label: "Nối tiếp" },
        { value: "parallel", label: "Song song" },
        { value: "mixed", label: "Hỗn hợp đối xứng (m dãy, mỗi dãy n nguồn)" },
      ],
    },
    { type: "stepper", key: "n", label: "Số nguồn nối tiếp n", min: 1, max: 6, visible: s => s.mode !== "parallel" },
    { type: "stepper", key: "m", label: "Số dãy song song m", min: 1, max: 4, visible: s => s.mode !== "series" },
    { type: "slider", key: "emf", label: "Suất điện động mỗi nguồn E", min: 1, max: 9, step: 0.5, unit: "V", digits: 1 },
    { type: "slider", key: "r", label: "Điện trở trong mỗi nguồn r", min: 0.2, max: 2, step: 0.1, unit: "Ω", digits: 1 },
    { type: "slider", key: "R", label: "Điện trở mạch ngoài R", min: 0, max: 20, step: 0.05, unit: "Ω" },
    { type: "checkbox", key: "showGraph", label: "Hiện đồ thị P và H theo R" },
  ].map(c => (c.key === "showGraph" ? c : { ...c, onCommit: report })),
  readouts: [
    { label: "Suất điện động bộ nguồn", value: s => `${fmt(bank(s).emf)} V` },
    { label: "Điện trở trong bộ nguồn", value: s => `${fmt(bank(s).r, 3)} Ω` },
    { label: "Cường độ dòng điện I", value: s => `${fmt(solve(s).current, 3)} A` },
    { label: "Hiệu điện thế mạch ngoài U", value: s => `${fmt(solve(s).voltage)} V` },
    { label: "Công suất mạch ngoài P", value: s => `${fmt(solve(s).power)} W` },
    { label: "Hiệu suất nguồn H", value: s => `${fmt(solve(s).efficiency * 100, 1)} %` },
  ],
  draw(ctx, s, view) {
    const c = solve(s);
    const b = bank(s);
    const small = view.w < 520 || view.h < 430;
    const size = small ? 12 : 15;

    // header: how the bank adds up
    const fE = { series: "nE", parallel: "E", mixed: "nE" }[s.mode];
    const fr = { series: "nr", parallel: "r/m", mixed: "nr/m" }[s.mode];
    const formula = `E_b = ${fE} = ${fmt(b.emf)} V${small ? "    " : "        "}r_b = ${fr} = ${fmt(b.r, 3)} Ω`;
    let top = 12;
    if (!small) {
      const kind = {
        series: `Bộ nguồn nối tiếp: ${b.perRow} nguồn`,
        parallel: `Bộ nguồn song song: ${b.rows} nguồn`,
        mixed: `Bộ nguồn hỗn hợp đối xứng: ${b.rows} dãy song song, mỗi dãy ${b.perRow} nguồn nối tiếp`,
      }[s.mode];
      label(ctx, kind, view.w / 2, 22, { align: "center", size: 16, bold: true });
      top = 48;
    }
    rich(ctx, formula, view.w / 2, top, { align: "center", size: small ? 12 : 15, bold: small, color: small ? COLORS.ink : COLORS.muted });

    // split the stage: circuit above, graph below
    const gh = s.showGraph && view.h >= 300 ? clamp(view.h * 0.4, 110, 300) : 0;
    const gw = Math.min(view.w - 8, 720);
    const yc0 = top + (small ? 12 : 22);
    const yc1 = view.h - gh - (small ? 4 : 14);

    // loop
    const rowGap = small ? 15 : 26;
    const plate = small ? 6 : 9; // half height of the long (positive) plate
    const bankHalf = ((b.rows - 1) * rowGap) / 2 + plate;
    const x0 = Math.max(small ? 18 : 40, (view.w - 560) / 2);
    const x1 = view.w - x0;
    const yT = yc0 + bankHalf + 4;
    const yB = yc1 - (small ? 34 : 46);
    const cx = (x0 + x1) / 2;
    const bw = Math.min((x1 - x0) * 0.78, b.perRow * (small ? 40 : 64) + 20);
    const bxL = cx - bw / 2;
    const bxR = cx + bw / 2;

    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(bxL, yT);
    ctx.lineTo(x0, yT);
    ctx.lineTo(x0, yB);
    ctx.lineTo(x1, yB);
    ctx.lineTo(x1, yT);
    ctx.lineTo(bxR, yT);
    ctx.stroke();

    // bank: rows between two bus bars; long thin plate = positive pole, on the right of each cell
    for (let j = 0; j < b.rows; j++) {
      const y = yT + (j - (b.rows - 1) / 2) * rowGap;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bxL, y);
      ctx.lineTo(bxR, y);
      ctx.stroke();
      for (let i = 0; i < b.perRow; i++) {
        const x = bxL + ((i + 0.5) * bw) / b.perRow;
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.lineWidth = small ? 4 : 5;
        ctx.beginPath();
        ctx.moveTo(x - 3, y - plate * 0.5);
        ctx.lineTo(x - 3, y + plate * 0.5);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 3, y - plate);
        ctx.lineTo(x + 3, y + plate);
        ctx.stroke();
      }
    }
    if (b.rows > 1) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const x of [bxL, bxR]) {
        ctx.moveTo(x, yT - bankHalf + plate);
        ctx.lineTo(x, yT + bankHalf - plate);
      }
      ctx.stroke();
    }
    label(ctx, "−", bxL - 10, yT - 11, { color: COLORS.blue, bold: true, size, align: "center" });
    label(ctx, "+", bxR + 10, yT - 11, { color: COLORS.red, bold: true, size, align: "center" });
    if (!small) label(ctx, `mỗi nguồn: E = ${fmt(s.emf, 1)} V; r = ${fmt(s.r, 1)} Ω`, x0 + 8, yT + bankHalf + 14, { size: 12, color: COLORS.muted });

    // external resistor on the bottom wire; a plain wire when R = 0
    const rw = small ? 26 : 38;
    const rh = small ? 8 : 11;
    if (!c.short) {
      const heat = clamp(c.power / maxPower(s), 0, 1);
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx - rw, yB - rh, 2 * rw, 2 * rh);
      ctx.fillStyle = `rgba(240, 140, 46, ${0.75 * heat})`;
      ctx.fillRect(cx - rw, yB - rh, 2 * rw, 2 * rh);
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - rw, yB - rh, 2 * rw, 2 * rh);
    }
    label(ctx, c.short ? "R = 0 (nối tắt hai cực)" : `R = ${fmt(s.R)} Ω`, cx, yB + rh + (small ? 8 : 11), { size, bold: true, align: "center", color: c.short ? COLORS.red : COLORS.ink });

    // conventional current: out of the positive pole, down the right side
    const ya = (yT + yB) / 2;
    arrow(ctx, x1, ya - 14, x1, ya + 14, COLORS.red, 2.5);
    arrow(ctx, x0, ya + 14, x0, ya - 14, COLORS.red, 2.5);
    label(ctx, "I", x1 - 12, ya, { size, bold: true, color: COLORS.red, align: "center" });

    // numbers inside the loop
    const yi0 = yT + bankHalf + (small ? 4 : 22);
    const lines = c.short
      ? [
          ["ĐOẢN MẠCH!", COLORS.red],
          [`I = E_b/r_b = ${fmt(c.current, 3)} A`, COLORS.red],
          [small ? "nguồn nóng, mau hỏng" : "dòng rất lớn: nguồn nóng lên, mau hỏng; U = 0, P = 0", COLORS.muted],
        ]
      : [
          [`I = E_b/(R + r_b) = ${fmt(c.current, 3)} A`, COLORS.red],
          [`U = E_b − I·r_b = ${fmt(c.voltage)} V`, COLORS.ink],
          [`P = U·I = ${fmt(c.power)} W      H = U/E_b = ${fmt(c.efficiency * 100, 1)} %`, COLORS.blue],
        ];
    const lineH = Math.min(small ? 17 : 26, (yB - rh - 4 - yi0) / lines.length);
    const yMid = (yi0 + yB - rh - 2) / 2;
    lines.forEach(([text, color], k) => {
      rich(ctx, text, cx, yMid + (k - (lines.length - 1) / 2) * lineH, { size: k === 0 && c.short ? size + 2 : size, bold: k < 2, align: "center", color });
    });
    if (atMaxPower(s)) {
      rich(ctx, small ? "R ≈ r_b: P lớn nhất, H ≈ 50 %" : "R ≈ r_b: công suất mạch ngoài lớn nhất, hiệu suất chỉ khoảng 50 %", cx, yc1 - 4, { size: small ? 11 : 13, bold: true, align: "center", color: COLORS.green });
    } else if (!small) {
      label(ctx, "Mũi tên đỏ: chiều dòng điện quy ước (ra từ cực dương của bộ nguồn)", cx, yc1 - 4, { size: 12, align: "center", color: COLORS.muted });
    }

    if (gh) drawGraph(ctx, s, c, { x: (view.w - gw) / 2, y: view.h - gh, w: gw, h: gh }, small);
  },
});
