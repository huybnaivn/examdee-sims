import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, velocity, position, topTime, maxHeight, landTime, impactSpeed, at, hitsTarget } from "./model.js";

// Any change to the set-up puts the object back at its starting point.
const rewind = (s, api) => {
  s.time = 0;
  api.pause();
};

// The "Bước" button calls step() several times in a row; without this guard the call after
// the landing would see a finished throw and start a new one.
let justEnded = false;

const reachedTop = s => s.speed > 0 && s.time >= topTime(s);
const landed = s => s.time > 0 && s.time >= landTime(s);

/** Time between two stroboscopic images: a round value giving about a dozen images. */
const strobeStep = s => [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5].find(d => landTime(s) / d <= 16) ?? 10;

function drawGraph(ctx, box, small, g) {
  const { x, y, w, h } = box;
  const left = x + (small ? 30 : 40);
  const right = x + w - (small ? 8 : 14);
  const top = y + (small ? 18 : 24);
  const bottom = y + h - (small ? 14 : 18);
  const size = small ? 10 : 12;
  const span = g.max - g.min || 1;
  const X = t => left + ((right - left) * t) / g.tEnd;
  const Y = v => bottom - ((bottom - top) * (v - g.min)) / span;
  label(ctx, g.title, left, y + 8, { size: small ? 11 : 14, bold: true, color: g.color });
  // axes: the t axis sits on the zero line
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, right - left, bottom - top);
  ctx.strokeStyle = COLORS.ink;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.moveTo(left, Y(0));
  ctx.lineTo(right, Y(0));
  ctx.stroke();
  for (const v of new Set([g.min, 0, g.max])) {
    if (v !== 0 && Math.abs(Y(v) - Y(0)) < size) continue;
    label(ctx, fmt(v, 1), left - 4, Y(v), { size, align: "right", color: COLORS.muted });
  }
  label(ctx, `${fmt(g.tEnd)} s`, right, bottom + (small ? 8 : 10), { size, align: "right", color: COLORS.muted });
  label(ctx, "t", right - (small ? 44 : 56), bottom + (small ? 8 : 10), { size, align: "right", color: COLORS.muted });
  // the part of the curve already travelled
  const now = Math.min(g.time, g.tEnd);
  ctx.strokeStyle = g.color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const t = (now * i) / 80;
    ctx.lineTo(X(t), Y(g.f(t)));
  }
  ctx.stroke();
  ctx.fillStyle = g.color;
  ctx.beginPath();
  ctx.arc(X(now), Y(g.f(now)), 4, 0, Math.PI * 2);
  ctx.fill();
}

mount({
  slug: "nem-thang-dung",
  version: "1.0.0",
  title: "Chuyển động ném thẳng đứng",
  hint: "Chọn độ cao và vận tốc ban đầu (dương: ném lên, âm: ném xuống) rồi bấm “Ném vật”. Thử chọn v₀ để điểm cao nhất trùng với vạch mục tiêu.",
  initialState,
  step(s, dt, api) {
    if (justEnded) return;
    const end = landTime(s);
    if (s.time >= end) s.time = 0; // “Chạy” on a finished throw starts a new one
    if (s.time === 0) {
      api.emit("throw", { height: s.height, speed: s.speed, gravity: s.gravity, drag: s.air ? s.drag : 0 }, "action");
    }
    const prev = s.time;
    const top = topTime(s);
    s.time = Math.min(end, s.time + dt);
    if (s.speed > 0 && prev < top && s.time >= top) {
      api.emit("top", { time: top, maxHeight: maxHeight(s) }, "result");
      if (hitsTarget(s)) api.emit("target-hit", { target: s.target, maxHeight: maxHeight(s), speed: s.speed }, "goal");
    }
    if (s.time >= end) {
      api.emit("landed", { time: end, impactSpeed: impactSpeed(s) }, "result");
      api.pause();
      justEnded = true;
      setTimeout(() => (justEnded = false));
    }
  },
  controls: [
    { type: "slider", key: "height", label: "Độ cao ban đầu y₀", min: 0, max: 20, step: 0.5, unit: "m", digits: 1 },
    {
      type: "slider",
      key: "speed",
      label: "Vận tốc ban đầu v₀",
      min: -20,
      max: 20,
      step: 0.1, // fine enough that every target height can be hit within the tolerance
      format: v => `${fmt(v, 1)} m/s (${v > 0 ? "ném lên" : v < 0 ? "ném xuống" : "thả rơi"})`,
    },
    {
      type: "select",
      key: "gravity",
      label: "Gia tốc rơi tự do",
      options: [
        { value: 9.8, label: "Trái Đất (g = 9,8 m/s²)" },
        { value: 10, label: "Trái Đất, lấy tròn g = 10 m/s²" },
        { value: 3.7, label: "Sao Hỏa (g = 3,7 m/s²)" },
        { value: 1.6, label: "Mặt Trăng (g = 1,6 m/s²)" },
      ],
    },
    { type: "checkbox", key: "air", label: "Có lực cản không khí" },
    { type: "slider", key: "drag", label: "Hệ số cản k", min: 0.05, max: 1, step: 0.05, unit: "1/s", visible: s => s.air },
    { type: "slider", key: "target", label: "Độ cao mục tiêu", min: 1, max: 40, step: 0.5, unit: "m", digits: 1 },
    { type: "checkbox", key: "showVectors", label: "Hiện vectơ vận tốc" },
  ]
    .map(c => (c.key === "showVectors" ? c : { ...c, onChange: rewind }))
    .concat({
      type: "button",
      label: "Ném vật",
      primary: true,
      action(s, api) {
        s.time = 0;
        api.play();
      },
    }),
  readouts: [
    { label: "Thời gian t", value: s => `${fmt(at(s, s.time).time)} s` },
    { label: "Độ cao y", value: s => `${fmt(at(s, s.time).y)} m` },
    { label: "Vận tốc v (dương: hướng lên)", value: s => `${fmt(at(s, s.time).v)} m/s` },
    { label: "Thời gian lên đến điểm cao nhất", value: s => (reachedTop(s) ? `${fmt(topTime(s))} s` : "–") },
    { label: "Độ cao cực đại", value: s => (reachedTop(s) ? `${fmt(maxHeight(s))} m` : "–") },
    { label: "Thời gian chạm đất", value: s => (landed(s) ? `${fmt(landTime(s))} s` : "–") },
    { label: "Tốc độ khi chạm đất", value: s => (landed(s) ? `${fmt(impactSpeed(s))} m/s` : "–") },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 430;
    const size = small ? 11 : 13;
    const now = at(s, s.time);
    const end = landTime(s);
    const top = topTime(s);
    const peak = maxHeight(s);
    const noteH = small ? 16 : 22; // strip for the note under everything
    const sceneW = small ? Math.min(150, view.w * 0.42) : clamp(view.w * 0.34, 220, 330);

    // ----- the throw, with a height scale -----
    const axisX = small ? 26 : 40;
    const groundY = view.h - noteH - (small ? 8 : 14);
    const topY = small ? 40 : 44;
    const yMax = Math.max(peak, s.target, 1) * 1.04;
    const Y = y => groundY - ((groundY - topY) * y) / yMax;
    const split = s.speed > 0 ? (small ? 13 : 24) : 0; // the way up and the way down are drawn side by side
    const cx = axisX + (sceneW - axisX) * (small ? 0.36 : 0.3);
    const xAt = t => cx + (t <= top ? -split : split);
    const r = small ? 6 : 9;

    label(ctx, `t = ${fmt(now.time)} s`, 8, small ? 10 : 16, { size: size + 1, bold: true });
    const phase = landed(s) ? "Đã chạm đất" : s.time === 0 ? "Sẵn sàng" : now.v > 0 ? "Đang đi lên" : "Đang đi xuống";
    if (!small) label(ctx, phase, sceneW - 4, 16, { size, align: "right", color: COLORS.muted });

    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(0, groundY, sceneW, 4);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(axisX, groundY);
    ctx.lineTo(axisX, topY - 6);
    ctx.stroke();
    const tick = [1, 2, 5, 10, 20, 50].find(d => ((groundY - topY) * d) / yMax >= (small ? 22 : 30)) ?? 100;
    for (let y = 0; y <= yMax; y += tick) {
      ctx.beginPath();
      ctx.moveTo(axisX - 4, Y(y));
      ctx.lineTo(axisX, Y(y));
      ctx.stroke();
      label(ctx, fmt(y, 0), axisX - 6, Y(y), { size: small ? 9 : 11, align: "right", color: COLORS.muted });
    }
    label(ctx, "y (m)", axisX - 4, topY - 14, { size: small ? 9 : 11, align: "center", color: COLORS.muted });

    // launch ledge at y0
    if (s.height > 0) {
      ctx.fillStyle = COLORS.muted;
      ctx.fillRect(axisX, Y(s.height) + r, cx - split - axisX + r, 3);
    }
    // target line
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(axisX, Y(s.target));
    ctx.lineTo(sceneW - 2, Y(s.target));
    ctx.stroke();
    ctx.setLineDash([]);
    const hit = reachedTop(s) && hitsTarget(s);
    const taken = [Y(s.target) - 8]; // heights of the labels on the right, so the velocity label can avoid them
    label(ctx, hit ? "Trúng mục tiêu!" : small ? "mục tiêu" : `mục tiêu ${fmt(s.target, 1)} m`, sceneW - 4, taken[0], { size: small ? 10 : 12, align: "right", color: COLORS.green, bold: hit });
    // highest point reached
    if (reachedTop(s)) {
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(axisX, Y(peak));
      ctx.lineTo(cx + split + r + 4, Y(peak));
      ctx.stroke();
      const below = Math.abs(Y(peak) - Y(s.target)) < 26 && peak >= s.target; // keep clear of the target label
      taken.push(Y(peak) + (below ? -22 : 9));
      label(ctx, `${fmt(peak)} m`, sceneW - 4, taken[1], { size: small ? 10 : 12, align: "right", color: COLORS.orange, bold: true });
    }

    // stroboscopic images, one every dS seconds
    const dS = strobeStep(s);
    ctx.fillStyle = COLORS.blue;
    ctx.globalAlpha = 0.3;
    for (let t = 0; t <= s.time + 1e-9 && t <= end; t += dS) {
      ctx.beginPath();
      ctx.arc(xAt(t), Y(Math.max(0, position(s, t))) - r, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const bx = xAt(now.time);
    const by = Y(now.y) - r;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    if (s.showVectors) {
      const len = clamp(Math.abs(now.v) * (small ? 2 : 3.2), 0, small ? 44 : 70) * Math.sign(now.v);
      const ax = bx + (now.time <= top ? -1 : 1) * (r + 7);
      // pointing down, the arrow ends at the object, so it never dips below the ground
      arrow(ctx, ax, by - Math.max(0, -len), ax, by - Math.max(0, len), COLORS.red, 2.5);
      const text = `v = ${fmt(now.v, 1)}${small ? "" : " m/s"}`;
      const onLeft = now.time <= top && s.speed > 0;
      let ly = clamp(by - Math.abs(len) / 2, topY - 8, groundY - 8);
      if (!onLeft) for (const y of taken.sort((a, b) => a - b)) if (Math.abs(ly - y) < 13) ly = y + 13;
      label(ctx, text, onLeft ? ax - 5 : ax + 5, ly, { size, bold: true, color: COLORS.red, align: onLeft ? "right" : "left" });
    }

    // ----- graphs -----
    const gx = sceneW + 4;
    const gw = view.w - gx - 4;
    const gh = (view.h - noteH - 4) / 2;
    const vEnd = velocity(s, end);
    const tEnd = Math.max(end, 0.1);
    drawGraph(ctx, { x: gx, y: 2, w: gw, h: gh }, small, {
      title: "Đồ thị vận tốc – thời gian: v (m/s)",
      tEnd,
      time: s.time,
      min: Math.min(vEnd, s.speed, 0),
      max: Math.max(s.speed, 0),
      f: t => velocity(s, t),
      color: COLORS.red,
    });
    drawGraph(ctx, { x: gx, y: 2 + gh, w: gw, h: gh }, small, {
      title: "Đồ thị độ cao – thời gian: y (m)",
      tEnd,
      time: s.time,
      min: 0,
      max: Math.max(peak, 1),
      f: t => Math.max(0, position(s, t)),
      color: COLORS.blue,
    });

    const air = s.air ? (small ? " Lực cản tỉ lệ với v." : " Lực cản tỉ lệ với vận tốc: a = −g − k·v.") : "";
    ctx.font = `${small ? 10 : 12}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const note = [
      `Các ảnh mờ cách nhau ${fmt(dS)} s. Đường đi lên và đi xuống được vẽ lệch ngang cho dễ nhìn; thực tế vật chuyển động trên một đường thẳng đứng.${air}`,
      `Các ảnh mờ cách nhau ${fmt(dS)} s. Đường đi lên và đi xuống được vẽ lệch ngang cho dễ nhìn.${air}`,
      `Ảnh cách nhau ${fmt(dS)} s; lên và xuống vẽ lệch ngang.${air}`,
    ].find((text, i) => i === 2 || ctx.measureText(text).width <= view.w - 16);
    label(ctx, note, 8, view.h - noteH / 2 - 1, { size: small ? 10 : 12, color: COLORS.muted });
  },
});
