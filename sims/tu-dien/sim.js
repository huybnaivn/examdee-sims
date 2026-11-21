import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, solve, setConnected, si, signUnit, DIELECTRICS } from "./model.js";

const NAMES = { air: "không khí", paper: "giấy", mica: "mica", glass: "thủy tinh", custom: "tùy chọn" };
const FILL = { air: null, paper: "#fbf0c9", mica: "#e9defc", glass: "#d3eef5", custom: "#dbf3e4" };

/** Three significant figures with an SI prefix: show(4.427e-11, "F") -> "44,3 pF". */
const show = (x, unit) => {
  const { value, prefix } = si(x);
  const a = Math.abs(value);
  return `${fmt(value, a >= 100 ? 0 : a >= 10 ? 1 : 2)} ${prefix}${unit}`;
};

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(s, view) {
  const small = view.w < 560 || view.h < 420;
  const top = small ? 34 : 86; // status and notes above
  const bottom = view.h - (small ? 40 : 84); // values below
  const pt = small ? 12 : 16; // plate thickness
  const lead = small ? 14 : 22;
  const pwMax = Math.min(view.w * (small ? 0.24 : 0.28), 260);
  const pw = pwMax * Math.sqrt(s.area / 400); // half-width; the plate side goes as √S
  const gap = s.distance * clamp((bottom - top - 2 * pt - 2 * lead - 44) / 10, 3, small ? 14 : 24);
  const cx = view.w * 0.56;
  const cy = (top + bottom) / 2;
  const bx = cx - pwMax - (small ? 30 : 80); // battery and left wire
  const yt = cy - gap / 2 - pt - lead; // top wire
  const yb = cy + gap / 2 + pt + lead;
  return { small, top, bottom, pt, pw, gap, cx, cy, bx, yt, yb, sw: { x: bx + (cx - bx) * 0.4, y: yt }, half: small ? 10 : 15 };
}

// Battery toggled, from the checkbox or by clicking the switch: one action and the resulting state.
function report(s, api) {
  const r = solve(s);
  const action = { connected: s.connected };
  api.emit("battery-toggled", action, "action");
  const data = { capacitance: r.C * 1e12, charge: r.Q * 1e9, voltage: r.U, energy: r.W * 1e9 };
  api.emit("capacitor-state", data, "result");
}

mount({
  slug: "tu-dien",
  version: "1.0.0",
  title: "Tụ điện phẳng",
  hint: "Tích điện cho tụ, rồi thử ngắt nguồn (bấm vào khóa K) trước khi thay đổi d, S hoặc điện môi.",
  initialState,
  controls: [
    {
      type: "checkbox",
      key: "connected",
      label: "Nối tụ với nguồn điện (đóng khóa K)",
      onChange: (s, api) => {
        setConnected(s, s.connected);
        report(s, api);
      },
    },
    { type: "slider", key: "voltage", label: "Hiệu điện thế nguồn", min: 0, max: 24, step: 1, unit: "V", digits: 0, disabled: s => !s.connected },
    { type: "slider", key: "area", label: "Diện tích mỗi bản S", min: 50, max: 400, step: 10, unit: "cm²", digits: 0 },
    { type: "slider", key: "distance", label: "Khoảng cách hai bản d", min: 1, max: 10, step: 0.5, unit: "mm", digits: 1 },
    {
      type: "select",
      key: "dielectric",
      label: "Điện môi giữa hai bản",
      options: [
        { value: "air", label: "Không khí (ε = 1)" },
        { value: "paper", label: "Giấy (ε = 2)" },
        { value: "mica", label: "Mica (ε = 6)" },
        { value: "glass", label: "Thủy tinh (ε = 7)" },
        { value: "custom", label: "Tùy chọn ε" },
      ],
    },
    { type: "slider", key: "epsCustom", label: "Hằng số điện môi ε", min: 1, max: 10, step: 0.5, digits: 1, visible: s => s.dielectric === "custom" },
  ],
  readouts: [
    { label: "Điện dung C", value: s => show(solve(s).C, "F") },
    { label: "Điện tích Q", value: s => show(solve(s).Q, "C") },
    { label: "Hiệu điện thế U", value: s => show(solve(s).U, "V") },
    { label: "Cường độ điện trường E", value: s => show(solve(s).E, "V/m") },
    { label: "Năng lượng W", value: s => show(solve(s).W, "J") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      if (Math.hypot(p.x - g.sw.x, p.y - g.sw.y) > g.half + 16) return false;
      setConnected(s, !s.connected);
      report(s, api);
      api.sync();
      return false;
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const r = solve(s);
    const { small, pt, pw, gap, cx, cy, bx, yt, yb } = g;
    const size = small ? 12 : 15;
    const charged = r.Q > 0;

    // what is held fixed
    label(ctx, s.connected ? "Đang nối với nguồn: U không đổi, Q = C·U thay đổi theo C" : "Đã ngắt nguồn: Q không đổi, U = Q/C thay đổi theo C", view.w / 2, small ? 11 : 24, {
      align: "center",
      size: small ? 11.5 : 17,
      bold: true,
      color: s.connected ? COLORS.ink : COLORS.purple,
    });
    if (!small) label(ctx, "C = ε·ε₀·S/d        Q = C·U        E = U/d        W = C·U²/2", view.w / 2, 50, { align: "center", size: 14, color: COLORS.muted });

    // wires: plate centre, out, across to the battery side, and back
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy - gap / 2 - pt);
    ctx.lineTo(cx, yt);
    ctx.lineTo(bx, yt);
    ctx.lineTo(bx, yb);
    ctx.lineTo(cx, yb);
    ctx.lineTo(cx, cy + gap / 2 + pt);
    ctx.stroke();

    // battery: the long thin plate is the positive pole
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(bx - 5, cy - 6, 10, 12);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 14, cy - 6);
    ctx.lineTo(bx + 14, cy - 6);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bx - 7, cy + 6);
    ctx.lineTo(bx + 7, cy + 6);
    ctx.stroke();
    label(ctx, "+", bx + 21, cy - 9, { color: COLORS.red, bold: true, size, align: "center" });
    label(ctx, "−", bx + 21, cy + 9, { color: COLORS.blue, bold: true, size, align: "center" });
    if (!small) label(ctx, "Nguồn điện", bx - 22, cy - 10, { align: "right", size: 13, color: COLORS.muted });
    label(ctx, `${fmt(s.voltage, 0)} V`, bx - (small ? 18 : 22), cy + (small ? 0 : 9), { align: "right", bold: true, size });

    // switch K on the top wire
    const { x: kx, y: ky } = g.sw;
    const L = g.half;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(kx - L, ky - 4, 2 * L, 8);
    ctx.strokeStyle = s.connected ? COLORS.ink : COLORS.red;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(kx - L, ky);
    if (s.connected) ctx.lineTo(kx + L, ky);
    else ctx.lineTo(kx - L + 2 * L * Math.cos(0.6), ky - 2 * L * Math.sin(0.6));
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = COLORS.ink;
    for (const x of [kx - L, kx + L]) {
      ctx.beginPath();
      ctx.arc(x, ky, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    label(ctx, "K", bx + (small ? 11 : 16), ky + (small ? 11 : 15), { size, bold: true, align: "center" }); // in the corner, clear of the plates

    // dielectric
    const yTop = cy - gap / 2; // inner face of the top plate
    const yBot = cy + gap / 2;
    if (FILL[s.dielectric]) {
      ctx.fillStyle = FILL[s.dielectric];
      ctx.fillRect(cx - pw, yTop, 2 * pw, gap);
    }

    // field between the plates, from + to − (number of lines is symbolic)
    if (charged && gap >= 14) {
      const n = small ? 5 : 7;
      for (let i = 0; i < n; i++) {
        const x = cx + ((i + 0.5) / n - 0.5) * 2 * pw;
        arrow(ctx, x, yTop + 3, x, yBot - 2, COLORS.orange, 1.5);
      }
      if (gap >= 30) label(ctx, "E", cx + 6, cy, { color: COLORS.orange, bold: true, size });
    }

    // plates with their charges; each sign stands for `unit` coulombs
    const unit = signUnit(r.Q, clamp(Math.floor((2 * pw) / (small ? 8 : 11)), 4, 40));
    const count = Math.round(r.Q / unit);
    const plate = (y, stroke, fill, sign) => {
      ctx.fillStyle = charged ? fill : COLORS.grid;
      ctx.strokeStyle = charged ? stroke : COLORS.muted;
      ctx.lineWidth = 1.5;
      ctx.fillRect(cx - pw, y, 2 * pw, pt);
      ctx.strokeRect(cx - pw, y, 2 * pw, pt);
      for (let i = 0; i < count; i++) {
        label(ctx, sign, cx + ((i + 0.5) / count - 0.5) * 2 * pw, y + pt / 2, { color: stroke, bold: true, size: pt, align: "center" });
      }
    };
    plate(yTop - pt, COLORS.red, "#fbd9da", "+");
    plate(yBot, COLORS.blue, "#d6e3fc", "−");

    // dimensions
    const dx = cx + pw + (small ? 8 : 14);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dx - 4, yTop);
    ctx.lineTo(dx + 4, yTop);
    ctx.moveTo(dx, yTop);
    ctx.lineTo(dx, yBot);
    ctx.moveTo(dx - 4, yBot);
    ctx.lineTo(dx + 4, yBot);
    ctx.stroke();
    label(ctx, `d = ${fmt(s.distance, 1)} mm`, dx + 6, cy, { size: size - 1, bold: true });
    label(ctx, `S = ${fmt(s.area, 0)} cm²`, cx + 8, yTop - pt - (small ? 8 : 11), { size: size - 1, bold: true });
    label(ctx, small ? `ε = ${fmt(r.eps, 1)} (${NAMES[s.dielectric]})` : `Điện môi: ${NAMES[s.dielectric]}, ε = ${fmt(r.eps, 1)}`, cx + 8, yBot + pt + (small ? 8 : 11), { size: size - 1, bold: true });

    // drawing conventions
    const per = `Mỗi dấu + hoặc − ứng với ${show(unit, "C")}.`;
    label(ctx, small ? `${per} Hình không theo tỉ lệ.` : `${per} Hình vẽ không theo tỉ lệ (d tính bằng mm, cạnh bản tính bằng cm); số đường sức vẽ tượng trưng.`, view.w / 2, small ? 25 : 74, {
      align: "center",
      size: small ? 10 : 12,
      color: COLORS.muted,
    });

    // values
    const values = [
      ["Điện dung", "C", show(r.C, "F"), COLORS.ink],
      ["Điện tích", "Q", show(r.Q, "C"), COLORS.red],
      ["Hiệu điện thế", "U", show(r.U, "V"), COLORS.blue],
      ["Cường độ điện trường", "E", show(r.E, "V/m"), COLORS.orange],
      ["Năng lượng", "W", show(r.W, "J"), COLORS.green],
    ];
    if (small) {
      const line = items => items.map(v => `${v[1]} = ${v[2]}`).join("     ");
      label(ctx, line(values.slice(0, 3)), view.w / 2, view.h - 27, { align: "center", size: 12, bold: true });
      label(ctx, line(values.slice(3)), view.w / 2, view.h - 10, { align: "center", size: 12, bold: true });
    } else {
      const w = Math.min(view.w - 32, 760) / values.length;
      const x0 = view.w / 2 - (w * values.length) / 2;
      values.forEach(([name, symbol, text, color], i) => {
        const x = x0 + w * (i + 0.5);
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.fillRect(x - w / 2 + 4, view.h - 72, w - 8, 56);
        ctx.strokeRect(x - w / 2 + 4, view.h - 72, w - 8, 56);
        label(ctx, `${name} ${symbol}`, x, view.h - 56, { align: "center", size: 12, color: COLORS.muted });
        label(ctx, text, x, view.h - 34, { align: "center", size: 17, bold: true, color });
      });
    }
  },
});
