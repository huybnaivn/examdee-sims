import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, gravity, names, terminalSpeed, fallTime, motion, endTime, strobe } from "./model.js";

const NAME = { steel: "Viên bi thép", ball: "Quả bóng", feather: "Lông chim", paper: "Tờ giấy" };
const OBJECT_OPTIONS = Object.entries(NAME).map(([value, label]) => ({ value, label }));
const LANE = [COLORS.blue, COLORS.orange];

// Any change to the experiment puts the objects back at the top, waiting to be dropped.
const rewind = (s, api) => {
  s.time = 0;
  api.pause();
};

// The kit keeps calling step() for the rest of the frame after pause(); without this guard
// the next call would see a finished drop and restart it.
let justLanded = false;

const niceStep = (max, parts) => {
  const raw = max / parts;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};

function layout(s, view) {
  const small = view.w < 560;
  const colW = small ? 104 : clamp(view.w * 0.28, 170, 250);
  const rulerX = small ? 30 : 44;
  const top = 46;
  const ground = view.h - 38;
  const list = names(s);
  const laneW = (colW - rulerX) / list.length;
  return { small, colW, rulerX, top, ground, scale: (ground - top) / s.height, list, laneW };
}

// (x, y) is the lowest point of the object. Sizes are symbolic, not to scale.
function drawObject(ctx, name, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (name === "steel") {
    ctx.fillStyle = "#9aa5b8";
    ctx.arc(x, y - 6, 6, 0, Math.PI * 2);
  } else if (name === "ball") {
    ctx.fillStyle = "#ffd9a8";
    ctx.arc(x, y - 11, 11, 0, Math.PI * 2);
  } else if (name === "feather") {
    ctx.fillStyle = "#ffffff";
    ctx.ellipse(x, y - 11, 4.5, 11, 0.45, 0, Math.PI * 2);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.rect(x - 15, y - 5, 30, 5);
  }
  ctx.fill();
  ctx.stroke();
  if (name === "feather") {
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 6.5, y - 24.5);
    ctx.lineTo(x - 5, y - 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

// One graph of `pick` (h or v) against time, drawn up to the current instant.
function drawGraph(ctx, box, s, g, title, tMax, yMax, pick) {
  const { x, y, w, h } = box;
  const px = t => x + (t / tMax) * w;
  const py = value => y + h - (value / yMax) * h;
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.grid;
  const yStep = niceStep(yMax, h < 110 ? 2.5 : 4);
  for (let v = 0; v <= yMax * 1.001; v += yStep) {
    ctx.beginPath();
    ctx.moveTo(x, py(v));
    ctx.lineTo(x + w, py(v));
    ctx.stroke();
    label(ctx, fmt(v, 2), x - 5, py(v), { size: 10, align: "right", color: COLORS.muted });
  }
  const tStep = niceStep(tMax, w < 260 ? 3 : 5);
  for (let t = 0; t <= tMax * 1.001; t += tStep) {
    ctx.beginPath();
    ctx.moveTo(px(t), y);
    ctx.lineTo(px(t), y + h);
    ctx.stroke();
    if (px(t) < x + w - 30) label(ctx, fmt(t, 2), px(t), y + h + 10, { size: 10, align: "center", color: COLORS.muted });
  }
  label(ctx, "t (s)", x + w, y + h + 10, { size: 10, align: "right", color: COLORS.muted });
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();
  label(ctx, title, x, y - 9, { size: g.small ? 11 : 12, bold: true });

  g.list.forEach((name, i) => {
    const until = Math.min(s.time, fallTime(s, name));
    ctx.strokeStyle = ctx.fillStyle = LANE[i];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 60; k++) {
      const t = (until * k) / 60;
      ctx.lineTo(px(t), py(pick(motion(s, name, t))));
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px(until), py(pick(motion(s, name, until))), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

mount({
  slug: "roi-tu-do",
  version: "1.0.0",
  title: "Sự rơi tự do",
  hint: "Chọn vật, môi trường và độ cao rồi bấm “Thả vật”. Thử thả viên bi và lông chim trong chân không.",
  initialState,
  step(s, dt, api) {
    if (justLanded) return;
    const end = endTime(s);
    if (s.time >= end) s.time = 0; // “Chạy” on a finished drop starts a new one
    if (s.time === 0) {
      api.emit("release", { height: s.height, gravity: gravity(s), air: s.medium === "air" ? 1 : 0, objects: names(s).length }, "action");
    }
    const before = s.time;
    s.time = Math.min(end, s.time + dt);
    names(s).forEach((name, i) => {
      const T = fallTime(s, name);
      if (before < T && s.time >= T) {
        api.emit("landed", { object: i + 1, time: T, speed: motion(s, name, T).v, height: s.height, gravity: gravity(s) }, "result");
      }
    });
    if (s.time >= end) {
      api.pause();
      justLanded = true;
      setTimeout(() => (justLanded = false));
    }
  },
  controls: [
    { type: "slider", key: "height", label: "Độ cao thả h", min: 1, max: 20, step: 0.5, unit: "m", digits: 1, onChange: rewind },
    { type: "select", key: "object1", label: "Vật 1", options: OBJECT_OPTIONS, onChange: rewind },
    {
      type: "select",
      key: "medium",
      label: "Môi trường",
      onChange: rewind,
      options: [
        { value: "air", label: "Không khí (có lực cản)" },
        { value: "vacuum", label: "Chân không" },
      ],
    },
    {
      type: "select",
      key: "place",
      label: "Nơi thả",
      onChange(s, api) {
        if (s.place === "moon") s.medium = "vacuum"; // the Moon has no atmosphere; the learner may switch back
        rewind(s, api);
      },
      options: [
        { value: "earth", label: "Trái Đất (g = 9,81 m/s²)" },
        { value: "moon", label: "Mặt Trăng (g = 1,62 m/s²)" },
        { value: "custom", label: "Tự chọn g" },
      ],
    },
    { type: "slider", key: "gCustom", label: "Gia tốc rơi tự do g", min: 1, max: 25, step: 0.1, unit: "m/s²", digits: 1, onChange: rewind, visible: s => s.place === "custom" },
    { type: "checkbox", key: "two", label: "Thả thêm vật 2 bên cạnh", onChange: rewind },
    { type: "select", key: "object2", label: "Vật 2", options: OBJECT_OPTIONS, onChange: rewind, visible: s => s.two },
    { type: "slider", key: "interval", label: "Khoảng thời gian giữa hai vết", min: 0.05, max: 0.5, step: 0.05, unit: "s" },
    {
      type: "button",
      label: "Thả vật",
      primary: true,
      action(s, api) {
        s.time = 0;
        api.play();
      },
    },
  ],
  readouts: [
    { label: "Thời gian t", value: s => `${fmt(Math.min(s.time, endTime(s)))} s` },
    { label: "Vật 1: độ cao h₁", value: s => `${fmt(motion(s, s.object1, s.time).h)} m` },
    { label: "Vật 1: tốc độ v₁", value: s => `${fmt(motion(s, s.object1, s.time).v)} m/s` },
    { label: "Vật 2: độ cao h₂", value: s => (s.two ? `${fmt(motion(s, s.object2, s.time).h)} m` : "–") },
    { label: "Vật 2: tốc độ v₂", value: s => (s.two ? `${fmt(motion(s, s.object2, s.time).v)} m/s` : "–") },
    { label: "Rơi tự do: t = √(2h/g)", value: s => `${fmt(Math.sqrt((2 * s.height) / gravity(s)))} s` },
    {
      label: "Tốc độ giới hạn trong không khí",
      value: s => (s.medium === "air" ? names(s).map(name => fmt(terminalSpeed(s, name), 1)).join(" và ") + " m/s" : "không có"),
    },
  ],
  draw(ctx, s, view) {
    const g = layout(s, view);
    const { small, colW, rulerX, top, ground, scale, list, laneW } = g;

    // ----- the drop -----
    label(ctx, `t = ${fmt(Math.min(s.time, endTime(s)))} s`, (rulerX + colW) / 2, 14, { align: "center", bold: true, size: small ? 13 : 15 });
    label(ctx, "h (m)", 4, 30, { size: 10, color: COLORS.muted });
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rulerX, top);
    ctx.lineTo(rulerX, ground);
    const tick = niceStep(s.height, (ground - top) / 32);
    for (let k = 0; k * tick <= s.height + 1e-9; k++) {
      const h = k * tick;
      const y = ground - h * scale;
      ctx.moveTo(rulerX - 4, y);
      ctx.lineTo(rulerX, y);
      label(ctx, fmt(h, 1), rulerX - 7, y, { size: 10, align: "right", color: COLORS.muted });
    }
    ctx.stroke();
    ctx.strokeStyle = COLORS.grid;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rulerX, top);
    ctx.lineTo(colW - 4, top);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(rulerX - 3, ground, colW - rulerX - 1, 6);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rulerX - 3, ground);
    ctx.lineTo(colW - 4, ground);
    ctx.stroke();

    list.forEach((name, i) => {
      const x = rulerX + laneW * (i + 0.5);
      const marks = strobe(s, name, s.time);
      ctx.strokeStyle = LANE[i];
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.75;
      let lastY = -9;
      marks.forEach((fallen, k) => {
        const y = top + fallen * scale;
        if (y - lastY < 2) return; // crowded marks would merge into a bar anyway
        lastY = y;
        ctx.beginPath();
        ctx.arc(x, y - 4, 3, 0, Math.PI * 2);
        ctx.stroke();
        // distance covered in this interval, where there is room to print it
        const gap = k ? fallen - marks[k - 1] : 0;
        if (laneW >= 70 && gap * scale >= 13) {
          label(ctx, `${fmt(gap, 2)} m`, x + 12, y - 4 - (gap * scale) / 2, { size: 10, color: COLORS.muted });
        }
      });
      ctx.globalAlpha = 1;
      drawObject(ctx, name, x, top + motion(s, name, s.time).fallen * scale, LANE[i]);
      label(ctx, String(i + 1), x, ground + 17, { align: "center", bold: true, size: 12, color: LANE[i] });
    });
    label(ctx, "Vật vẽ không theo tỉ lệ", 4, view.h - 8, { size: 10, color: COLORS.muted });

    // ----- graphs -----
    const gx0 = colW + (small ? 34 : 48);
    const gw = view.w - 10 - gx0;
    let lx = gx0;
    list.forEach((name, i) => {
      const text = `${i + 1}: ${NAME[name]}`;
      ctx.fillStyle = LANE[i];
      ctx.fillRect(lx, 7, 10, 10);
      label(ctx, text, lx + 14, 12, { size: small ? 11 : 13 });
      lx += (small ? 6.2 : 7.4) * text.length + 26;
    });
    const tMax = endTime(s);
    const vMax = Math.max(...list.map(name => motion(s, name, Infinity).v)) * 1.08;
    const gh = (view.h - 26) / 2;
    drawGraph(ctx, { x: gx0, y: 38, w: gw, h: gh - 34 }, s, g, "Tốc độ v (m/s)", tMax, vMax, m => m.v);
    drawGraph(ctx, { x: gx0, y: 38 + gh, w: gw, h: gh - 34 }, s, g, "Độ cao h (m)", tMax, s.height, m => m.h);
  },
});
