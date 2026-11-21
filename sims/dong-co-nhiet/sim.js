import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, cycle, pointAt, where, temperature, N_MOL, R } from "./model.js";

const NAMES = {
  isoT: "đẳng nhiệt",
  adia: "đoạn nhiệt",
  isoP: "đẳng áp",
  isoV: "đẳng tích",
};
const pct = x => `${fmt(100 * x, 1)} %`;

/** Text of the process the gas is in now. */
function processText(c, i) {
  const leg = c.legs[i];
  const grow = leg.b.V > leg.a.V + 1e-9 ? "Dãn" : leg.b.V < leg.a.V - 1e-9 ? "Nén" : leg.b.p > leg.a.p ? "Tăng áp" : "Giảm áp";
  const heat = Math.abs(leg.Q) < 1e-9 ? "không trao đổi nhiệt" : leg.Q > 0 ? `nhận nhiệt ${fmt(leg.Q, 1)} J` : `tỏa nhiệt ${fmt(-leg.Q, 1)} J`;
  return `${i + 1}→${(i + 1) % 4 + 1}: ${grow} ${NAMES[leg.kind]}, ${heat}`;
}

// Cold (blue) to hot (red) by temperature.
const tempColor = (T, a = 1) => {
  const k = clamp((T - 200) / 800, 0, 1);
  return `rgba(${Math.round(70 + 185 * k)}, ${Math.round(130 - 60 * k)}, ${Math.round(235 - 175 * k)}, ${a})`;
};

const restart = s => {
  s.cycles = 0;
};

function drawCylinder(ctx, s, c, leg, pt, box) {
  const { x, y, w, h } = box;
  const resH = 24;
  const cylH = h - resH - 6;
  const vTop = Math.max(...c.pts.map(p => p.V)) * 1.08;
  const gasH = (pt.V / vTop) * (cylH - 14);
  const yBottom = y + cylH;
  // gas
  ctx.fillStyle = tempColor(temperature(pt), 0.55);
  ctx.fillRect(x + 4, yBottom - gasH, w - 8, gasH);
  // walls
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, yBottom);
  ctx.lineTo(x + w, yBottom);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  // piston and rod
  const py = yBottom - gasH;
  ctx.fillStyle = "#8b95a8";
  ctx.fillRect(x + 3, py - 10, w - 6, 10);
  ctx.fillRect(x + w / 2 - 3, y - 6, 6, py - 10 - (y - 6));
  label(ctx, `${fmt(temperature(pt), 0)} K`, x + w / 2, yBottom - gasH / 2, { align: "center", bold: true, size: 12 });
  // reservoir under the cylinder
  const q = Math.abs(leg.Q) < 1e-9 ? 0 : Math.sign(leg.Q);
  ctx.fillStyle = q > 0 ? COLORS.red : q < 0 ? COLORS.blue : "#c9cfda";
  ctx.fillRect(x - 6, yBottom + 6, w + 12, resH);
  const name = q > 0 ? "Nhận nhiệt" : q < 0 ? "Tỏa nhiệt" : "Cách nhiệt";
  label(ctx, name, x + w / 2, yBottom + 6 + resH / 2, { align: "center", bold: true, size: 11, color: q ? "#fff" : COLORS.ink });
  if (q) {
    const ax = x + w + 14;
    if (q > 0) arrow(ctx, ax, yBottom + 22, ax, yBottom - 18, COLORS.red, 2);
    else arrow(ctx, ax, yBottom - 18, ax, yBottom + 22, COLORS.blue, 2);
  }
}

function drawDiagram(ctx, s, c, i, u, box, small) {
  const { x, y, w, h } = box;
  const vMax = Math.max(...c.pts.map(p => p.V)) * 1.12;
  const pMax = Math.max(...c.pts.map(p => p.p)) * 1.12;
  const X = V => x + (V / vMax) * w;
  const Y = p => y + h - (p / pMax) * h;
  // axes
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  arrow(ctx, x, y + h, x + w + 8, y + h, COLORS.ink, 1.5);
  arrow(ctx, x, y + h, x, y - 8, COLORS.ink, 1.5);
  label(ctx, "V (L)", x + w + 6, y + h + 14, { align: "right", size: 12, color: COLORS.muted });
  label(ctx, "p (kPa)", x + 6, y - 4, { size: 12, color: COLORS.muted });
  label(ctx, "0", x - 4, y + h + 10, { align: "right", size: 11, color: COLORS.muted });

  // isotherms T₁ and T₂ (dashed)
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.2;
  for (const [T, color, name] of [[c.T1, COLORS.red, "T₁"], [c.T2, COLORS.blue, "T₂"]]) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    let first = true;
    let end = null;
    for (let k = 0; k <= 80; k++) {
      const V = (vMax * (k + 1)) / 81;
      const p = (N_MOL * R * T) / V;
      if (p > pMax) continue;
      if (first) ctx.moveTo(X(V), Y(p));
      else ctx.lineTo(X(V), Y(p));
      first = false;
      end = [X(V), Y(p)];
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (end) label(ctx, name, end[0] - 2, end[1] - 9, { align: "right", size: 12, bold: true, color });
  }
  ctx.setLineDash([]);

  // enclosed area = work per cycle
  const path = [];
  for (const leg of c.legs) for (let k = 0; k <= 40; k++) path.push(pointAt(leg, k / 40));
  ctx.fillStyle = "rgba(47, 111, 237, 0.18)";
  ctx.beginPath();
  path.forEach((q, k) => (k ? ctx.lineTo(X(q.V), Y(q.p)) : ctx.moveTo(X(q.V), Y(q.p))));
  ctx.closePath();
  ctx.fill();
  // label spot: the grid point inside the loop farthest from its outline
  let workSpot = null;
  if (!small || h > 150) {
    const pts = path.map(q => [X(q.V), Y(q.p)]);
    const xs = pts.map(q => q[0]);
    const ys = pts.map(q => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    let best = 12; // px, too thin a loop gets no label
    for (let gx = 1; gx < 24; gx++)
      for (let gy = 1; gy < 24; gy++) {
        const px = x0 + ((x1 - x0) * gx) / 24;
        const py = y0 + ((y1 - y0) * gy) / 24;
        if (!ctx.isPointInPath(px, py)) continue;
        const d = Math.min(...pts.map(q => Math.hypot(q[0] - px, q[1] - py)));
        if (d > best) [best, workSpot] = [d, [px, py]];
      }
  }

  const spread = Math.max(...c.pts.map(p => p.V)) / Math.min(...c.pts.map(p => p.V));
  if (spread > 20) {
    const far = c.pts.reduce((a, q) => (q.V > a.V ? q : a));
    label(ctx, `Khí dãn tới ${fmt(far.V, 0)} L nên chu trình trông rất dẹt`, x + w - 4, y + 12, { align: "right", size: small ? 11 : 13, color: COLORS.muted });
  }

  // legs: red takes in heat, blue gives it out, dark is adiabatic
  c.legs.forEach((leg, k) => {
    ctx.strokeStyle = Math.abs(leg.Q) < 1e-9 ? COLORS.ink : leg.Q > 0 ? COLORS.red : COLORS.blue;
    ctx.lineWidth = k === i ? 4 : 2.5;
    ctx.beginPath();
    for (let j = 0; j <= 40; j++) {
      const q = pointAt(leg, j / 40);
      j ? ctx.lineTo(X(q.V), Y(q.p)) : ctx.moveTo(X(q.V), Y(q.p));
    }
    ctx.stroke();
    // direction arrow halfway along
    const a = pointAt(leg, 0.45);
    const b = pointAt(leg, 0.55);
    arrow(ctx, X(a.V), Y(a.p), X(b.V), Y(b.p), ctx.strokeStyle, 2);
  });
  // numbered states
  const cx = c.pts.reduce((a, q) => a + X(q.V), 0) / 4;
  const cy = c.pts.reduce((a, q) => a + Y(q.p), 0) / 4;
  c.pts.forEach((q, k) => {
    const px = X(q.V);
    const py = Y(q.p);
    const d = Math.hypot(px - cx, py - cy) || 1;
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, String(k + 1), px + ((px - cx) / d) * 13, py + ((py - cy) / d) * 13, { align: "center", bold: true, size: 13 });
  });
  if (workSpot) label(ctx, "A", workSpot[0], workSpot[1], { align: "center", bold: true, size: 15, color: COLORS.blue });
  // the gas now
  const now = pointAt(c.legs[i], u);
  ctx.fillStyle = COLORS.orange;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(X(now.V), Y(now.p), 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function draw(ctx, s, view) {
  const small = view.w < 560 || view.h < 400;
  const c = cycle(s);
  if (!c) {
    const lines = ["Không có chu trình chữ nhật với các giá trị này:", "cần V lúc ngừng nhận nhiệt / V lúc bắt đầu dãn < T₁/T₂.", "Hãy giảm khoảng thể tích hoặc tăng T₁ − T₂."];
    lines.forEach((t, k) => label(ctx, t, view.w / 2, view.h / 2 - 22 + k * 22, { align: "center", size: small ? 12 : 15, color: k ? COLORS.muted : COLORS.red, bold: !k }));
    return;
  }
  const { i, u } = where(s);
  const leg = c.legs[i];
  const pt = pointAt(leg, u);
  const size = small ? 12 : 14;

  // energy balance at the top
  let top;
  if (small) {
    label(ctx, `A = ${fmt(c.W, 1)} J   H = ${pct(c.eta)}   Hmax = ${pct(c.carnot)}`, view.w / 2, 13, { align: "center", bold: true, size });
    top = 30;
  } else {
    label(ctx, `Q₁ = ${fmt(c.Q1, 1)} J    Q₂ = ${fmt(c.Q2, 1)} J    A = Q₁ − Q₂ = ${fmt(c.W, 1)} J`, view.w / 2, 18, { align: "center", bold: true, size });
    const cmp = s.cycle === "carnot" ? "=" : "<";
    label(ctx, `H = A/Q₁ = ${pct(c.eta)}   ${cmp}   Hmax = 1 − T₂/T₁ = ${pct(c.carnot)}`, view.w / 2, 40, { align: "center", size, color: COLORS.purple, bold: true });
    top = 62;
  }
  const bottom = small ? 36 : 44;
  const cw = small ? 62 : 110;
  drawCylinder(ctx, s, c, leg, pt, { x: small ? 12 : 24, y: top + 10, w: cw, h: view.h - top - bottom - 10 });
  const dx = (small ? 12 : 24) + cw + (small ? 44 : 64);
  drawDiagram(ctx, s, c, i, u, { x: dx, y: top + 14, w: view.w - dx - (small ? 22 : 34), h: view.h - top - bottom - 14 - (small ? 8 : 12) }, small);

  label(ctx, processText(c, i), view.w / 2, view.h - (small ? 18 : 24), { align: "center", size: small ? 11 : 13, bold: true, color: Math.abs(leg.Q) < 1e-9 ? COLORS.ink : leg.Q > 0 ? COLORS.red : COLORS.blue });
  label(ctx, small ? `${fmt(N_MOL, 1)} mol khí lí tưởng; hình trụ không theo tỉ lệ` : `${fmt(N_MOL, 1)} mol khí lí tưởng. Phần tô trên đồ thị p–V là công A khí sinh ra trong một chu trình; hình trụ không theo tỉ lệ.`, view.w / 2, view.h - 7, {
    align: "center",
    size: small ? 10 : 11,
    color: COLORS.muted,
  });
}

mount({
  slug: "dong-co-nhiet",
  version: "1.0.0",
  title: "Động cơ nhiệt và hiệu suất",
  hint: "Khí lí tưởng trong xilanh đi hết chu trình này đến chu trình khác. Đổi nhiệt độ nguồn nóng T₁, nguồn lạnh T₂ và khoảng thể tích để so sánh hiệu suất H với giới hạn Hmax = 1 − T₂/T₁.",
  initialState,
  autoplay: true,
  step(s, dt, api) {
    const c = cycle(s);
    if (!c) return; // nothing to run until the numbers make a cycle
    if (step(s, dt)) {
      api.emit("cycle-completed", { work: c.W, heatIn: c.Q1, heatOut: c.Q2, efficiency: c.eta, carnotLimit: c.carnot, tHot: c.T1, tCold: c.T2 }, "result");
    }
  },
  controls: [
    {
      type: "select",
      key: "cycle",
      label: "Chu trình",
      onChange: restart,
      options: [
        { value: "carnot", label: "Carnot (đẳng nhiệt, đoạn nhiệt)" },
        { value: "rect", label: "Đẳng tích – đẳng áp" },
      ],
    },
    {
      type: "select",
      key: "gas",
      label: "Chất khí",
      onChange: restart,
      options: [
        { value: "mono", label: "Đơn nguyên tử (γ = 5/3)" },
        { value: "di", label: "Lưỡng nguyên tử (γ = 7/5)" },
      ],
    },
    { type: "slider", key: "tHot", label: "Nhiệt độ nguồn nóng T₁", min: 400, max: 1000, step: 10, unit: "K", digits: 0, onChange: restart },
    { type: "slider", key: "tCold", label: "Nhiệt độ nguồn lạnh T₂", min: 200, max: 390, step: 10, unit: "K", digits: 0, onChange: restart },
    { type: "slider", key: "vMin", label: "Thể tích lúc bắt đầu dãn nở", min: 1, max: 4, step: 0.1, unit: "L", digits: 1, onChange: restart },
    {
      type: "slider",
      key: "vMax",
      label: "Thể tích lúc ngừng nhận nhiệt",
      min: 1.5,
      max: 8,
      step: 0.1,
      digits: 1,
      onChange: restart,
      // the model keeps it at least 0,5 L above the start volume
      format: (v, s) => `${fmt(Math.max(v, s.vMin + 0.5), 1)} L`,
    },
  ],
  readouts: [
    { label: "Nhiệt lượng nhận Q₁", value: s => (cycle(s) ? `${fmt(cycle(s).Q1, 1)} J` : "–") },
    { label: "Nhiệt lượng tỏa Q₂", value: s => (cycle(s) ? `${fmt(cycle(s).Q2, 1)} J` : "–") },
    { label: "Công A = Q₁ − Q₂", value: s => (cycle(s) ? `${fmt(cycle(s).W, 1)} J` : "–") },
    { label: "Hiệu suất H = A/Q₁", value: s => (cycle(s) ? pct(cycle(s).eta) : "–") },
    { label: "Hmax = 1 − T₂/T₁", value: s => pct(1 - Math.min(s.tCold, s.tHot - 10) / s.tHot) },
    { label: "Số chu trình đã chạy", value: s => fmt(s.cycles, 0) },
  ],
  draw,
});
