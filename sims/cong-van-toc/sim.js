import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, launch, velocities, crossingTime, drift, landsOpposite, boat, train } from "./model.js";

const WATER = "#d9ebfb";
const BANK = "#dfeeda";
const C12 = COLORS.blue; // object relative to the moving frame
const C23 = COLORS.green; // moving frame relative to the ground
const C13 = COLORS.red; // object relative to the ground

// A river setting changed: the boat goes back to the start and waits.
const dock = (s, api) => {
  s.t = 0;
  s.sailing = false;
  api.pause();
};

const signed = v => (v < 0 ? `(${fmt(v)})` : fmt(v));

// "v13 = v12 + v23" with a small arrow over each v (vector notation), centred on cx. Returns its right edge.
function vectorFormula(ctx, cx, y, size) {
  const font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const parts = ["v₁₃", " = ", "v₁₂", " + ", "v₂₃"];
  ctx.font = font;
  const widths = parts.map(t => ctx.measureText(t).width);
  const vw = ctx.measureText("v").width;
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  parts.forEach((text, i) => {
    label(ctx, text, x, y, { size, bold: true });
    if (i % 2 === 0) {
      const top = y - size * 0.62;
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + vw + 2, top);
      ctx.moveTo(x + vw - 1, top - 2.5);
      ctx.lineTo(x + vw + 2, top);
      ctx.lineTo(x + vw - 1, top + 2.5);
      ctx.stroke();
    }
    x += widths[i];
  });
  return x;
}

function geomRiver(s, view) {
  const small = view.w < 560 || view.h < 430;
  const head = small ? 20 : 44;
  const bank = small ? 24 : 46;
  const d = drift(s);
  const margin = 0.35 * s.width;
  const xMin = Math.min(0, d) - margin;
  const span = Math.max(0, d) + margin - xMin;
  const scale = Math.min((view.h - head - 2 * bank) / s.width, view.w / span); // px per metre
  const yNear = view.h - bank;
  const yFar = yNear - s.width * scale;
  const x0 = (view.w - span * scale) / 2 - xMin * scale;
  return { small, head, bank, scale, yNear, yFar, X: x => x0 + x * scale, Y: y => yNear - y * scale, vs: small ? 10 : 18 };
}

function drawRiver(ctx, s, view) {
  const g = geomRiver(s, view);
  const { small, X, Y, yNear, yFar, vs } = g;
  const size = small ? 11 : 14;
  const b = boat(s);
  const v = velocities(s);
  const d = drift(s);

  // banks and water
  ctx.fillStyle = BANK;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.fillStyle = WATER;
  ctx.fillRect(0, yFar, view.w, yNear - yFar);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, yFar);
  ctx.lineTo(view.w, yFar);
  ctx.moveTo(0, yNear);
  ctx.lineTo(view.w, yNear);
  ctx.stroke();

  // the current: streaks carried along by the water
  if (s.vCurrent > 0) {
    const gap = small ? 90 : 150;
    const shift = (s.vCurrent * b.t * g.scale) % gap;
    for (let row = 1; row <= 3; row++) {
      const y = yFar + ((yNear - yFar) * row) / 4;
      for (let x = -gap + shift + (row % 2) * (gap / 2); x < view.w; x += gap) arrow(ctx, x, y, x + (small ? 16 : 26), y, "#9cc4ec", 1.5);
    }
  }
  label(ctx, `nước chảy ${fmt(s.vCurrent)} m/s →`, 8, yFar + (small ? 9 : 14), { size: small ? 10 : 13, color: "#4a7fb5" });

  // the formula and who is who
  if (small) {
    const end = vectorFormula(ctx, view.w * 0.26, 12, 12);
    label(ctx, "(1) thuyền, (2) nước, (3) bờ", end + 10, 12, { size: 11, color: COLORS.muted });
  } else {
    vectorFormula(ctx, view.w / 2, 24, 18);
    const items = [["v₁₂: thuyền so với nước", C12], ["v₂₃: nước so với bờ", C23], ["v₁₃: thuyền so với bờ", C13]];
    const wide = view.w >= 760;
    let x = view.w - 10;
    for (const [text, color] of items.toReversed()) {
      const shown = wide ? text : text.replace(" so với ", "–");
      ctx.font = `600 13px system-ui, -apple-system, "Segoe UI", sans-serif`;
      label(ctx, shown, x, yNear + 30, { size: 13, color, align: "right", bold: true });
      x -= ctx.measureText(shown).width + 18;
    }
    label(ctx, "Thuyền vẽ phóng to; mũi tên vận tốc có tỉ lệ riêng.", 8, yNear + 30, { size: 11, color: COLORS.muted });
  }

  // straight across: A to B
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(X(0), yNear);
  ctx.lineTo(X(0), yFar);
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, "A", X(0), yNear + (small ? 11 : 13), { size, bold: true, align: "center" });
  label(ctx, "B", X(0), yFar - (small ? 10 : 13), { size, bold: true, align: "center" });
  ctx.fillStyle = COLORS.ink;
  for (const y of [yNear, yFar]) {
    ctx.beginPath();
    ctx.arc(X(0), y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // the path over the ground
  ctx.strokeStyle = C13;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(X(0), yNear);
  ctx.lineTo(X(b.x), Y(b.y));
  ctx.stroke();
  ctx.setLineDash([]);

  // landing: drift along the far bank
  if (b.landed) {
    const ok = landsOpposite(s);
    if (Math.abs(X(d) - X(0)) > 2) {
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(X(0), yFar - 3);
      ctx.lineTo(X(d), yFar - 3);
      ctx.stroke();
    }
    const text = `${ok ? "Cập bến đúng B" : `${small ? "" : d > 0 ? "trôi xuôi dòng " : "lệch ngược dòng "}d = ${fmt(Math.abs(d), 1)} m`} · t = ${fmt(b.t, 1)} s`;
    ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const tw = ctx.measureText(text).width;
    const pad = (small ? 9 : 14) + 8; // clear of the boat
    // between B and the boat when it fits, otherwise on the free side of the boat
    let tx = X(d) - pad - tw;
    if (ok || d < 0 || tx < X(0) + 8) tx = Math.max(X(0), X(d)) + pad;
    if (tx + tw > view.w - 4) tx = Math.min(X(0), X(d)) - pad - tw;
    label(ctx, text, Math.max(4, tx), yFar - (small ? 10 : 13), { size, bold: true, color: ok ? COLORS.green : COLORS.orange });
  }
  if (s.vCurrent >= s.vBoat) {
    label(ctx, small ? "v₂₃ ≥ v₁₂: không thể cập bến đúng B" : "Nước chảy không chậm hơn thuyền (v₂₃ ≥ v₁₂): không thể cập bến đúng B", 8, yFar + (small ? 22 : 34), { size: small ? 10 : 13, color: COLORS.orange, bold: true });
  }

  // boat, bow along v12
  const bx = X(b.x);
  const by = Y(b.y);
  const L = small ? 9 : 14;
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(Math.atan2(-v.v12.y, v.v12.x));
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(L, 0);
  ctx.lineTo(L * 0.3, -L * 0.5);
  ctx.lineTo(-L, -L * 0.5);
  ctx.lineTo(-L, L * 0.5);
  ctx.lineTo(L * 0.3, L * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // velocity triangle: at the boat while it is on the water, back at A once it has landed
  const ox = b.landed ? X(0) : bx;
  const oy = b.landed ? yNear : by;
  const tip12 = [ox + v.v12.x * vs, oy - v.v12.y * vs];
  const tip13 = [ox + v.v13.x * vs, oy - v.v13.y * vs];
  if (s.heading !== 0) {
    // heading angle, from the straight-across direction
    const a0 = -Math.PI / 2;
    const a1 = Math.atan2(-v.v12.y, v.v12.x);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ox, oy, small ? 16 : 26, Math.min(a0, a1), Math.max(a0, a1));
    ctx.stroke();
    const am = (a0 + a1) / 2;
    label(ctx, "θ", ox + (small ? 24 : 38) * Math.cos(am), oy + (small ? 24 : 38) * Math.sin(am), { size: small ? 10 : 13, align: "center", color: COLORS.muted });
  }
  arrow(ctx, ox, oy, ...tip13, C13, small ? 2.5 : 3.5);
  arrow(ctx, ox, oy, ...tip12, C12, small ? 2 : 3);
  arrow(ctx, ...tip12, ...tip13, C23, small ? 2 : 3);
  // v12 label beside its arrow, on the side away from v13
  const len12 = Math.hypot(tip12[0] - ox, tip12[1] - oy) || 1;
  let nx = (tip12[1] - oy) / len12;
  let ny = -(tip12[0] - ox) / len12;
  if (nx * (tip13[0] - ox) + ny * (tip13[1] - oy) > 0) (nx = -nx), (ny = -ny);
  label(ctx, "v₁₂", (ox + tip12[0]) / 2 + nx * (small ? 12 : 16), (oy + tip12[1]) / 2 + ny * (small ? 12 : 16), { size, bold: true, color: C12, align: "center" });
  if (s.vCurrent > 0) {
    label(ctx, "v₂₃", (tip12[0] + tip13[0]) / 2, tip12[1] - (small ? 9 : 12), { size, bold: true, color: C23, align: "center" });
    label(ctx, "v₁₃", (ox + tip13[0]) / 2 + 9, (oy + tip13[1]) / 2 + (small ? 7 : 10), { size, bold: true, color: C13 });
  }
}

function drawTrain(ctx, s, view) {
  const small = view.w < 560 || view.h < 430;
  const r = train(s);
  const scale = view.w / 90; // px per metre; the scene is 90 m of track
  const X = m => m * scale;
  const yG = view.h - (small ? 62 : 84);
  const hT = Math.min(small ? 46 : 80, Math.max(34, view.h * 0.2));
  const REAR = 6; // m, where the rear of the train starts
  const SPOT = 18; // m, where the walker starts (middle of the train)
  const rear = X(REAR + r.s23);
  const len = X(24);

  // header: the formula with numbers
  label(ctx, small ? "v₁₃ = v₁₂ + v₂₃   (1) người, (2) tàu, (3) đất" : "v₁₃ = v₁₂ + v₂₃      (1) người, (2) tàu, (3) mặt đất", view.w / 2, small ? 10 : 22, { size: small ? 11 : 17, bold: true, align: "center" });
  label(ctx, `v₁₃ = ${signed(r.v12)} + ${fmt(r.v23)} = ${fmt(r.v13)} m/s`, view.w / 2, small ? 25 : 48, { size: small ? 11 : 15, align: "center", color: C13, bold: true });

  // 1D vector addition, head to tail
  const avs = Math.min(view.w / 40, 14); // px per m/s
  const ax = view.w * 0.3;
  const ay = small ? 48 : 86;
  const row = small ? 17 : 26;
  const end12 = ax + r.v12 * avs;
  arrow(ctx, ax, ay, end12, ay, C12, 3);
  arrow(ctx, end12, ay + (r.v12 < 0 ? 6 : 0), end12 + r.v23 * avs, ay + (r.v12 < 0 ? 6 : 0), C23, 3);
  arrow(ctx, ax, ay + row, ax + r.v13 * avs, ay + row, C13, 3);
  label(ctx, small ? "v₁₂" : "v₁₂ (người so với tàu)", Math.min(ax, end12) - 6, ay, { size: small ? 10 : 13, color: C12, align: "right", bold: true });
  label(ctx, small ? "v₂₃" : "v₂₃ (tàu so với đất)", Math.max(end12, end12 + r.v23 * avs, ax) + 8, ay + (r.v12 < 0 ? 6 : 0), { size: small ? 10 : 13, color: C23, bold: true });
  label(ctx, small ? "v₁₃" : "v₁₃ (người so với đất)", Math.max(ax, ax + r.v13 * avs) + 8, ay + row, { size: small ? 10 : 13, color: C13, bold: true });
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax, ay - 9);
  ctx.lineTo(ax, ay + row + 9);
  ctx.stroke();

  // ground with a mark every 10 m
  ctx.fillStyle = BANK;
  ctx.fillRect(0, yG, view.w, view.h - yG);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, yG);
  ctx.lineTo(view.w, yG);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let m = 0; m <= 90; m += 10) {
    ctx.moveTo(X(m), yG);
    ctx.lineTo(X(m), yG + 6);
    if (m % 20 === 0 && m > 0 && m < 90) label(ctx, `${m} m`, X(m), yG + (small ? 53 : 72), { size: small ? 9 : 11, align: "center", color: COLORS.muted });
  }
  ctx.stroke();

  // where the train stood at t = 0
  ctx.strokeStyle = COLORS.muted;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(X(REAR), yG - 8 - hT, len, hT);
  ctx.setLineDash([]);

  // train
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rear, yG - 8 - hT, len, hT, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C23;
  ctx.fillRect(rear + 1, yG - 8 - hT * 0.22, len - 2, hT * 0.1);
  ctx.fillStyle = COLORS.ink;
  for (const f of [0.15, 0.85]) {
    ctx.beginPath();
    ctx.arc(rear + len * f, yG - 5, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // the spot on the floor where the walker started (moves with the train)
  const floor = yG - 8 - hT * 0.24;
  const spot = X(SPOT + r.s23);
  const me = X(SPOT + r.s13);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(spot, floor);
  ctx.lineTo(spot, floor - hT * 0.2);
  ctx.stroke();
  // walker
  const hh = hT * 0.55;
  ctx.strokeStyle = ctx.fillStyle = C12;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(me, floor - hh, hh * 0.16, 0, Math.PI * 2);
  ctx.fill();
  const stride = Math.sin(r.t * 9) * hh * 0.16 * Math.sign(r.v12);
  ctx.beginPath();
  ctx.moveTo(me, floor - hh * 0.84);
  ctx.lineTo(me, floor - hh * 0.35);
  ctx.lineTo(me - stride, floor);
  ctx.moveTo(me, floor - hh * 0.35);
  ctx.lineTo(me + stride, floor);
  ctx.stroke();

  // distances after t, measured on the ground: s13 = s12 + s23
  const y1 = yG + (small ? 16 : 22);
  const y2 = yG + (small ? 34 : 46);
  const bar = (xa, xb, y, color, text) => {
    arrow(ctx, xa, y, xb, y, color, 2.5);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xa, y - 5);
    ctx.lineTo(xa, y + 5);
    ctx.stroke();
    label(ctx, text, Math.max(xa, xb) + 6, y, { size: small ? 10 : 13, color, bold: true });
  };
  bar(X(SPOT), spot, y1, C23, `s₂₃ = ${fmt(r.s23, 1)} m`);
  bar(X(SPOT), me, y2, C13, `s₁₃ = ${fmt(r.s13, 1)} m`);
  if (Math.abs(me - spot) > 3) {
    arrow(ctx, spot, floor - hh - (small ? 9 : 14), me, floor - hh - (small ? 9 : 14), C12, 2);
  }
  label(ctx, `Sau t = ${fmt(r.t, 1)} s: người đi ${fmt(Math.abs(r.s12), 1)} m trên sàn tàu`, 8, yG - 8 - hT - (small ? 12 : 18), { size: small ? 10 : 13, color: C12 });
}

mount({
  slug: "cong-van-toc",
  version: "1.0.0",
  title: "Tính tương đối của chuyển động và công thức cộng vận tốc",
  hint: "Chọn hướng mũi thuyền rồi bấm Xuất phát. Tìm hướng để thuyền cập bến đúng điểm B đối diện.",
  initialState,
  timeScale: s => (s.mode === "river" ? Math.max(1, crossingTime(s) / 4) : 1),
  step(s, dt, api) {
    if (s.mode === "river" && !s.sailing) {
      // ▶ with the boat at a bank starts a new crossing
      launch(s);
      api.emit("launch", { speed: s.vBoat, heading: s.heading, current: s.vCurrent, width: s.width }, "action");
    }
    if (!step(s, dt)) return;
    api.pause();
    api.emit("landed", { time: crossingTime(s), drift: drift(s), heading: s.heading, width: s.width }, "result");
    if (landsOpposite(s)) api.emit("landed-opposite", { drift: drift(s), heading: s.heading, speed: s.vBoat, current: s.vCurrent }, "goal");
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Tình huống",
      options: [
        { value: "river", label: "Thuyền qua sông (hai chiều)" },
        { value: "train", label: "Người đi trên tàu (một chiều)" },
      ],
      onChange: (s, api) => (s.mode === "train" ? api.play() : dock(s, api)),
    },
    { type: "slider", key: "vBoat", label: "Tốc độ thuyền so với nước v₁₂", min: 2, max: 6, step: 0.5, unit: "m/s", digits: 1, onChange: dock, visible: s => s.mode === "river" },
    {
      type: "slider",
      key: "heading",
      label: "Hướng mũi thuyền θ",
      min: -45,
      max: 60,
      step: 1,
      format: v => (v === 0 ? "0° (vuông góc bờ)" : `${fmt(Math.abs(v), 0)}° chếch ${v > 0 ? "ngược" : "xuôi"} dòng`),
      onChange: dock,
      visible: s => s.mode === "river",
    },
    { type: "slider", key: "vCurrent", label: "Tốc độ dòng nước v₂₃", min: 0, max: 5, step: 0.5, unit: "m/s", digits: 1, onChange: dock, visible: s => s.mode === "river" },
    { type: "slider", key: "width", label: "Bề rộng sông", min: 40, max: 200, step: 10, unit: "m", digits: 0, onChange: dock, visible: s => s.mode === "river" },
    {
      type: "button",
      label: "Xuất phát",
      primary: true,
      visible: s => s.mode === "river",
      action(s, api) {
        s.t = 0;
        s.sailing = false; // step() launches and reports it
        api.play();
      },
    },
    { type: "slider", key: "vTrain", label: "Tốc độ tàu so với đất v₂₃", min: 0, max: 10, step: 0.5, unit: "m/s", digits: 1, visible: s => s.mode === "train" },
    {
      type: "slider",
      key: "vWalk",
      label: "Vận tốc người so với tàu v₁₂",
      min: -2,
      max: 2,
      step: 0.5,
      format: v => (v === 0 ? "0 m/s (đứng yên)" : `${fmt(v, 1)} m/s (${v > 0 ? "cùng" : "ngược"} chiều tàu)`),
      visible: s => s.mode === "train",
    },
  ],
  readouts: [
    { label: "Vận tốc tổng hợp v₁₃", value: s => `${fmt(s.mode === "river" ? velocities(s).speed : train(s).v13)} m/s` },
    { label: "Thành phần vuông góc với bờ", value: s => (s.mode === "river" ? `${fmt(velocities(s).v13.y)} m/s` : "–") },
    { label: "Thành phần dọc theo bờ", value: s => (s.mode === "river" ? `${fmt(velocities(s).v13.x)} m/s` : "–") },
    { label: "Thời gian", value: s => `${fmt(s.mode === "river" ? boat(s).t : train(s).t, 1)} s` },
    { label: "Độ trôi theo dòng nước", value: s => (s.mode === "river" ? `${fmt(boat(s).x, 1)} m` : "–") },
  ],
  draw(ctx, s, view) {
    if (s.mode === "train") drawTrain(ctx, s, view);
    else drawRiver(ctx, s, view);
  },
});
