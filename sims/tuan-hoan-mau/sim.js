import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, heart, phaseAt, valves, tap, traced, PHASES, STATIONS } from "./model.js";

const RED = "#d93a3f";
const BLUE = "#3d64d8";
const OPEN = COLORS.green;
const SHUT = COLORS.red;

// Schematic, seen from the front: the right half of the heart is on the left of the picture.
// One closed loop: RA → RV → pulmonary artery → lungs → pulmonary veins → LA → LV → aorta → body → venae cavae.
function geom(view) {
  const W = view.w;
  const H = view.h;
  const small = W < 560 || H < 440;
  const top = small ? 40 : 66; // phase bar above
  const note = small ? 16 : 24;
  const capH = small ? 30 : 42;
  const lane = small ? 18 : 28; // vessel lane between heart and capillary beds, holds a station ring
  const hw = Math.min(W - (small ? 110 : 300), 380); // large: room for vessel names on both sides
  const hh = Math.max(60, Math.min(H - top - note - 2 * capH - 4 * lane, 330));
  const cx = W / 2;
  const free = H - top - note - 2 * capH - 4 * lane - hh;
  const lung = { y0: top + free * 0.3, h: capH };
  const hy0 = lung.y0 + capH + 2 * lane;
  const hy1 = hy0 + hh;
  const body = { y0: hy1 + 2 * lane, h: capH };
  const gap = small ? 14 : 18;
  const xL = cx - hw / 2 + hw / 4 - gap / 4; // centre of the right-heart column (left of picture)
  const xR = cx + hw / 2 - hw / 4 + gap / 4;
  const split = hy0 + hh * 0.42; // atria above, ventricles below
  const side = small ? 22 : 34;
  const vcx = cx - hw / 2 - side; // venae cavae lane
  const pvx = cx + hw / 2 + side; // pulmonary veins lane
  const capX0 = vcx - (small ? 10 : 16);
  const capX1 = pvx + (small ? 10 : 16);
  const paY = lung.y0 + capH + lane;
  const aoY = body.y0 - lane;
  const ra = { x: xL, y: (hy0 + split) / 2 };
  const rv = { x: xL, y: (split + hy1) / 2 };
  const la = { x: xR, y: ra.y };
  const lv = { x: xR, y: rv.y };
  const lungMid = lung.y0 + capH * 0.66; // vessel runs low in the bed, the name sits above it
  const bodyMid = body.y0 + capH * 0.66;
  const inL = capX0 + (small ? 22 : 34);
  const inR = capX1 - (small ? 22 : 34);
  const loop = [
    [ra.x, ra.y], [rv.x, rv.y], [cx, rv.y], [cx, paY], [inL, paY], [inL, lungMid], [inR, lungMid],
    [pvx, lungMid], [pvx, la.y], [la.x, la.y], [lv.x, lv.y], [lv.x, aoY], [inR, aoY], [inR, bodyMid],
    [inL, bodyMid], [vcx, bodyMid], [vcx, ra.y], [ra.x, ra.y],
  ];
  const stations = [
    ra, rv,
    { x: cx, y: (paY + hy0) / 2 },
    { x: cx, y: lungMid },
    { x: pvx, y: (lungMid + la.y) / 2 },
    la, lv,
    { x: lv.x, y: (hy1 + aoY) / 2 },
    { x: cx, y: bodyMid },
    { x: vcx, y: (bodyMid + ra.y) / 2 },
  ];
  return {
    small, W, H, cx, top, hw, hh, hy0, hy1, split, gap, xL, xR, ra, rv, la, lv, lung, body,
    capX0, capX1, loop, stations, note, colW: hw / 2 - gap / 2,
    valves: {
      tricuspid: { x: xL, y: split, dir: "v" },
      mitral: { x: xR, y: split, dir: "v" },
      pulmonary: { x: cx, y: hy0 + 8, dir: "v" },
      aortic: { x: xR, y: hy1 - 8, dir: "v" },
    },
  };
}

// Arc-length table of the loop so particles move at an even speed.
function along(loop, f) {
  const lens = [];
  let total = 0;
  for (let i = 0; i < loop.length - 1; i++) {
    const l = Math.hypot(loop[i + 1][0] - loop[i][0], loop[i + 1][1] - loop[i][1]);
    lens.push(l);
    total += l;
  }
  let d = (((f % 1) + 1) % 1) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? d / lens[i] : 0;
      return { i, k, x: loop[i][0] + (loop[i + 1][0] - loop[i][0]) * k, y: loop[i][1] + (loop[i + 1][1] - loop[i][1]) * k };
    }
    d -= lens[i];
  }
}

// Oxygen-rich (red) from the lungs to the body; oxygen-poor (blue) from the body to the lungs.
const LUNG_SEG = 5;
const BODY_SEG = 13;
const oxygenated = (i, k) => (i === LUNG_SEG ? k > 0.5 : i === BODY_SEG ? k < 0.5 : i > LUNG_SEG && i < BODY_SEG);

function chamber(ctx, x, y, w, h, squeeze, fill, name, g) {
  const sx = 1 - 0.12 * squeeze;
  const sy = 1 - 0.12 * squeeze;
  ctx.fillStyle = fill;
  ctx.strokeStyle = "#8c3b3b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - (w * sx) / 2, y - (h * sy) / 2, w * sx, h * sy, Math.min(18, w / 4));
  ctx.fill();
  ctx.stroke();
  label(ctx, name, x, y - h * 0.3 * sy, { align: "center", size: g.small ? 10 : 13, bold: true, color: COLORS.ink });
}

function valve(ctx, v, open, g) {
  const L = g.small ? 9 : 13;
  ctx.save();
  ctx.strokeStyle = open ? OPEN : SHUT;
  ctx.lineWidth = g.small ? 3 : 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (open) {
    // two leaflets pushed apart, pointing along the flow
    ctx.moveTo(v.x - L, v.y - L * 0.3);
    ctx.lineTo(v.x - L * 0.55, v.y + L * 0.6);
    ctx.moveTo(v.x + L, v.y - L * 0.3);
    ctx.lineTo(v.x + L * 0.55, v.y + L * 0.6);
  } else {
    ctx.moveTo(v.x - L, v.y);
    ctx.lineTo(v.x + L, v.y);
  }
  ctx.stroke();
  ctx.restore();
}

function draw(ctx, s, view) {
  const g = geom(view);
  const h = heart(s);
  const ph = phaseAt(s.t / h.period);
  const vs = valves(ph.index);
  const size = g.small ? 11 : 13;
  const done = traced(s);

  // phase bar
  const barW = Math.min(g.W - 24, 520);
  const bx = (g.W - barW) / 2;
  const by = g.small ? 6 : 10;
  const bh = g.small ? 14 : 20;
  let x = bx;
  PHASES.forEach((p, i) => {
    const w = p.share * barW;
    ctx.fillStyle = i === ph.index ? ["#f6c9a8", "#f3a6a6", "#cfe0f7"][i] : COLORS.grid;
    ctx.fillRect(x + 1, by, w - 2, bh);
    label(ctx, ["Co nhĩ", "Co thất", "Dãn chung"][i], x + w / 2, by + bh / 2, { align: "center", size: g.small ? 10 : 12, bold: i === ph.index });
    x += w;
  });
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(bx + (s.t / h.period) * barW - 1, by - 3, 2, bh + 6);
  const dur = `${PHASES[ph.index].name} (${fmt(PHASES[ph.index].share * h.period, 2)} s)`;
  const vtext = g.small
    ? `${dur}: van nhĩ – thất ${vs.tricuspid ? "mở" : "đóng"}`
    : `${dur}: van nhĩ – thất ${vs.tricuspid ? "mở" : "đóng"}, van động mạch ${vs.aortic ? "mở" : "đóng"}`;
  label(ctx, vtext, g.W / 2, by + bh + (g.small ? 10 : 16), { align: "center", size, bold: true });

  // vessels
  ctx.lineJoin = "round";
  ctx.lineWidth = g.small ? 7 : 10;
  for (let i = 0; i < g.loop.length - 1; i++) {
    const ox = oxygenated(i, 0.25);
    ctx.strokeStyle = ox ? "#f3b9b9" : "#bccbf2";
    ctx.beginPath();
    ctx.moveTo(...g.loop[i]);
    ctx.lineTo(...g.loop[i + 1]);
    ctx.stroke();
  }

  // capillary beds
  const bed = (y0, name, color) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(g.capX0, y0, g.capX1 - g.capX0, g.lung.h, 8);
    ctx.fill();
    ctx.stroke();
    label(ctx, name, g.capX0 + 6, y0 + g.lung.h * 0.27, { size: g.small ? 10 : 12, color: COLORS.muted });
  };
  bed(g.lung.y0, g.small ? "Phổi" : "Phổi (trao đổi khí)", "rgba(255,255,255,0.75)");
  bed(g.body.y0, g.small ? "Cơ quan" : "Các cơ quan", "rgba(255,255,255,0.75)");
  if (!g.small) {
    label(ctx, "Vòng tuần hoàn nhỏ (phổi)", g.capX1, g.lung.y0 - 10, { align: "right", size: 12, color: COLORS.muted });
    label(ctx, "Vòng tuần hoàn lớn (cơ thể)", g.capX1, g.body.y0 + g.body.h + 10, { align: "right", size: 12, color: COLORS.muted });
  }

  // heart chambers
  const sqA = ph.index === 0 ? Math.sin(Math.PI * ph.progress) : 0;
  const sqV = ph.index === 1 ? Math.sin(Math.PI * ph.progress) : 0;
  const aH = g.split - g.hy0 - 6;
  const vH = g.hy1 - g.split - 6;
  const pinkBlue = "#dfe6fb";
  const pinkRed = "#fbe0e0";
  const sh = g.small;
  chamber(ctx, g.ra.x, g.ra.y, g.colW, aH, sqA, pinkBlue, sh ? "TN phải" : "Tâm nhĩ phải", g);
  chamber(ctx, g.rv.x, g.rv.y, g.colW, vH, sqV, pinkBlue, sh ? "TT phải" : "Tâm thất phải", g);
  chamber(ctx, g.la.x, g.la.y, g.colW, aH, sqA, pinkRed, sh ? "TN trái" : "Tâm nhĩ trái", g);
  chamber(ctx, g.lv.x, g.lv.y, g.colW, vH, sqV, pinkRed, sh ? "TT trái" : "Tâm thất trái", g);
  // the inner loop segments over the chambers, so the path is readable
  ctx.lineWidth = g.small ? 3 : 4;
  for (const [a, b, c] of [[0, 1, BLUE], [9, 10, RED], [1, 2, BLUE], [10, 11, RED]]) {
    ctx.strokeStyle = c;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(...g.loop[a]);
    ctx.lineTo(...g.loop[b]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const k of ["tricuspid", "mitral", "pulmonary", "aortic"]) valve(ctx, g.valves[k], vs[k], g);
  if (!g.small) {
    // names inside the chambers, next to each valve, coloured by its state
    const inL = g.cx - g.hw / 2 + 8;
    const inR = g.cx + g.hw / 2 - 8;
    const vl = [
      ["tricuspid", "van ba lá", inL, g.split + 18, "left"],
      ["mitral", "van hai lá", inR, g.split + 18, "right"],
      ["pulmonary", "van động mạch phổi", g.cx - 12, g.hy0 - 8, "right"],
      ["aortic", "van động mạch chủ", g.xR + 16, g.hy1 - 12, "left"],
    ];
    for (const [k, name, x, y, align] of vl) {
      label(ctx, `${name}: ${vs[k] ? "mở" : "đóng"}`, x, y, { align, size: 11, bold: true, color: vs[k] ? OPEN : SHUT });
    }
  }

  // blood cells, evenly spaced, moving round the loop
  const n = g.small ? 26 : 40;
  const r = g.small ? 3 : 4;
  for (let j = 0; j < n; j++) {
    const p = along(g.loop, s.flow + j / n);
    ctx.fillStyle = oxygenated(p.i, p.k) ? RED : BLUE;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // trace: numbered rings on the stations already followed
  g.stations.forEach((st, i) => {
    const k = done.indexOf(i);
    const R = g.small ? 9 : 12;
    ctx.lineWidth = 2;
    ctx.strokeStyle = k >= 0 ? COLORS.orange : "rgba(31,42,68,0.35)";
    ctx.fillStyle = k >= 0 ? COLORS.orange : "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(st.x, st.y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(ctx, k >= 0 ? String(k + 1) : "?", st.x, st.y + 0.5, { align: "center", size: g.small ? 10 : 12, bold: true, color: k >= 0 ? "#fff" : COLORS.muted });
  });
  if (!g.small) {
    for (const [i, name, dir] of [[2, "Động mạch phổi", 1], [4, "Tĩnh mạch phổi", 1], [7, "Động mạch chủ", 1], [9, "Tĩnh mạch chủ", -1]]) {
      const st = g.stations[i];
      label(ctx, name, st.x + dir * 18, st.y, { align: dir < 0 ? "right" : "left", size: 12, color: COLORS.muted });
    }
  }

  // convention note
  const note = g.W < 760
    ? "Không theo tỉ lệ, nhìn từ trước · đỏ: giàu O₂, xanh: nghèo O₂"
    : `Sơ đồ không theo tỉ lệ, nhìn từ phía trước (nửa phải của tim ở bên trái hình) · đỏ: máu giàu O₂, xanh: máu nghèo O₂${s.slow ? " · chiếu chậm 4 lần" : ""}`;
  label(ctx, note, g.W / 2, g.H - g.note / 2, { align: "center", size: g.small ? 10 : 12, color: COLORS.muted });
}

const report = (s, api) => {
  const h = heart(s);
  api.emit("cardiac-output", {
    heartRate: h.rate, strokeVolume: h.sv, cardiacOutput: h.output, cycleDuration: h.period, exercise: s.exercise, meanPressure: h.mean,
  }, "result");
};

const tapStation = (s, api, i) => {
  const r = tap(s, i);
  api.emit("trace-step", { station: i + 1, correct: r.correct ? 1 : 0 });
  if (r.done) api.emit("path-traced", { mistakes: s.traceMistakes }, "goal");
};

const traceText = s => {
  const d = traced(s);
  if (!d.length) return "Chạm vào một chặng để bắt đầu";
  if (d.length === STATIONS.length) return `Hoàn thành vòng tuần hoàn (${s.traceMistakes} lần chọn sai)`;
  return `${d.length}/10 · vừa qua: ${STATIONS[d.at(-1)].name}`;
};

mount({
  slug: "tuan-hoan-mau",
  version: "1.0.0",
  title: "Tim và hệ tuần hoàn",
  hint: "Lần theo một hồng cầu: chạm lần lượt vào các chặng (vòng tròn ?) theo đúng thứ tự máu chảy qua, bắt đầu từ chặng nào cũng được.",
  initialState,
  step,
  autoplay: true,
  timeScale: s => (s.slow ? 0.25 : 1),
  controls: [
    { type: "slider", key: "restRate", label: "Nhịp tim lúc nghỉ", min: 50, max: 100, step: 1, unit: "nhịp/phút", digits: 0, onCommit: report },
    { type: "slider", key: "restSV", label: "Thể tích tâm thu lúc nghỉ", min: 50, max: 100, step: 1, unit: "mL", digits: 0, onCommit: report },
    { type: "slider", key: "exercise", label: "Mức độ vận động", min: 0, max: 100, step: 5, unit: "%", digits: 0, onCommit: report },
    { type: "checkbox", key: "slow", label: "Chiếu chậm 4 lần" },
    { type: "heading", label: "Lần theo đường đi của hồng cầu" },
    {
      type: "select",
      key: "pick",
      label: "Chặng tiếp theo (dùng bàn phím)",
      options: [{ value: -1, label: "— chọn chặng —" }, ...STATIONS.map((st, i) => ({ value: i, label: st.name }))],
      onChange(s, api) {
        const i = s.pick;
        s.pick = -1;
        if (i >= 0) tapStation(s, api, i);
      },
    },
    {
      type: "button",
      label: "Lần theo lại từ đầu",
      action: s => Object.assign(s, { traceStart: -1, traceLen: 0, traceMistakes: 0 }),
      event: "trace-cleared",
    },
  ],
  readouts: [
    { label: "Nhịp tim", value: s => `${fmt(heart(s).rate, 0)} nhịp/phút` },
    { label: "Thể tích tâm thu", value: s => `${fmt(heart(s).sv, 0)} mL` },
    { label: "Lưu lượng tim = nhịp tim × thể tích tâm thu", value: s => `${fmt(heart(s).output, 2)} L/phút` },
    { label: "Thời gian một chu kì tim = 60 / nhịp tim", value: s => `${fmt(heart(s).period, 2)} s` },
    { label: "Huyết áp động mạch (mô hình đơn giản)", value: s => `${fmt(heart(s).systolic, 0)}/${fmt(heart(s).diastolic, 0)} mmHg` },
    { label: "Lần theo hồng cầu", value: traceText },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      const R = g.small ? 16 : 20;
      const i = g.stations.findIndex(st => Math.hypot(p.x - st.x, p.y - st.y) < R);
      if (i < 0) return false;
      tapStation(s, api, i);
    },
  },
  draw,
});
