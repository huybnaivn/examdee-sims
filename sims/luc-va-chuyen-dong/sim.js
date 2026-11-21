import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, forces, restart } from "./model.js";

// 1-2-5 step that splits `span` into at most `max` intervals.
const niceStep = (span, max) => {
  const p = 10 ** Math.floor(Math.log10(span / max));
  return [1, 2, 5, 10].map(m => m * p).find(v => span / v <= max);
};

function drawChart(ctx, s, box) {
  const points = [...(s._hist ?? []), [s.time, s.v]];
  const tmax = Math.max(5, s.time);
  let lo = 0;
  let hi = 0;
  for (const [, v] of points) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (hi - lo < 2) lo < 0 ? (lo = hi - 2) : (hi = lo + 2);
  const X = t => box.x + (t / tmax) * box.w;
  const Y = v => box.y + box.h - ((v - lo) / (hi - lo)) * box.h;

  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.grid;
  const vStep = niceStep(hi - lo, box.h > 150 ? 6 : 3);
  for (let v = Math.ceil(lo / vStep) * vStep; v <= hi + 1e-9; v += vStep) {
    ctx.beginPath();
    ctx.moveTo(box.x, Y(v));
    ctx.lineTo(box.x + box.w, Y(v));
    ctx.stroke();
    label(ctx, fmt(v, 1), box.x - 8, Y(v), { size: 11, align: "right", color: COLORS.muted });
  }
  const tStep = niceStep(tmax, box.w > 500 ? 10 : 5);
  for (let t = 0; t <= tmax + 1e-9; t += tStep) {
    ctx.beginPath();
    ctx.moveTo(X(t), box.y);
    ctx.lineTo(X(t), box.y + box.h);
    ctx.stroke();
    label(ctx, fmt(t, 1), X(t), box.y + box.h + 12, { size: 11, align: "center", color: COLORS.muted });
  }
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.moveTo(box.x, Y(0));
  ctx.lineTo(box.x + box.w, Y(0));
  ctx.stroke();
  label(ctx, "v (m/s)", box.x - 34, box.y - 16, { size: 12, color: COLORS.green, bold: true });
  label(ctx, "t (s)", box.x + box.w, box.y - 16, { size: 12, align: "right", color: COLORS.muted });

  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach(([t, v], i) => (i ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v))));
  ctx.stroke();
  ctx.fillStyle = COLORS.green;
  ctx.beginPath();
  ctx.arc(X(s.time), Y(s.v), 4.5, 0, Math.PI * 2);
  ctx.fill();
}

mount({
  slug: "luc-va-chuyen-dong",
  version: "1.0.0",
  title: "Lực và chuyển động",
  hint: "Chọn lực kéo rồi nhấn Chạy. Vật chỉ trượt khi lực kéo lớn hơn lực ma sát nghỉ cực đại.",
  initialState,
  step(s, dt, api) {
    const hist = (s._hist ??= []);
    if (!hist.length) hist.push([s.time, s.v]);
    const was = s.v !== 0;
    step(s, dt);
    const now = s.v !== 0;
    if (was !== now || s.time - hist.at(-1)[0] >= 0.05) hist.push([s.time, s.v]);
    if (hist.length > 4000) s._hist = hist.filter((_, i) => i % 2 === 0);
    if (!was && now) api.emit("start", { force: s.force, maxStatic: forces(s).maxStatic }, "result");
    if (was && !now) api.emit("stop", { x: s.x, time: s.time }, "result");
  },
  controls: [
    { type: "slider", key: "force", label: "Lực kéo F", min: -100, max: 100, step: 1, unit: "N" },
    { type: "slider", key: "mass", label: "Khối lượng m", min: 1, max: 20, step: 0.5, unit: "kg", digits: 1 },
    {
      type: "slider",
      key: "muS",
      label: "Hệ số ma sát nghỉ μn",
      min: 0,
      max: 1,
      step: 0.05,
      onChange(s, api) {
        s.muK = Math.min(s.muK, s.muS);
        api.sync();
      },
    },
    {
      type: "slider",
      key: "muK",
      label: "Hệ số ma sát trượt μt",
      min: 0,
      max: 1,
      step: 0.05,
      onChange(s, api) {
        s.muS = Math.max(s.muS, s.muK);
        api.sync();
      },
    },
    {
      type: "button",
      label: "Đưa vật về vạch xuất phát",
      event: "restart",
      action(s, api) {
        restart(s);
        s._hist = [];
        api.pause();
      },
    },
  ],
  readouts: [
    { label: "Ma sát nghỉ cực đại", value: s => `${fmt(forces(s).maxStatic, 1)} N` },
    {
      label: "Lực ma sát",
      value: s => {
        const f = forces(s);
        return `${fmt(f.friction, 1)} N (${f.sliding ? "trượt" : "nghỉ"})`;
      },
    },
    { label: "Hợp lực", value: s => `${fmt(forces(s).net, 1)} N` },
    { label: "Gia tốc a", value: s => `${fmt(forces(s).accel)} m/s²` },
    { label: "Vận tốc v", value: s => `${fmt(s.v)} m/s` },
    { label: "Tọa độ x", value: s => `${fmt(s.x)} m` },
    { label: "Thời gian t", value: s => `${fmt(s.time, 1)} s` },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const f = forces(s);
    const ground = h - Math.max(52, h * 0.16);
    const k = clamp(h / 420, 0.75, 1.5);
    const bw = (48 + 8 * Math.sqrt(s.mass)) * k;
    const bh = bw * 0.7;
    const cx = w / 2;
    const top = ground - bh;

    // the chart takes whatever is left above the block and its net-force label
    drawChart(ctx, s, { x: 52, y: 36, w: w - 76, h: Math.max(60, top - 113) });

    // ground with a metre ruler; the camera follows the block
    const ppm = clamp(w / 14, 28, 64); // px per metre
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(0, ground, w, h - ground);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, ground, w, 2);
    const every = ppm >= 40 ? 1 : 2;
    for (let n = Math.ceil(s.x - cx / ppm); n <= s.x + cx / ppm; n++) {
      const x = cx + (n - s.x) * ppm;
      ctx.fillRect(x - (n === 0 ? 1.5 : 0.5), ground, n === 0 ? 3 : 1, n === 0 ? 12 : 7);
      if (n % every === 0 && x > 12 && x < w - 12) label(ctx, fmt(n), x, ground + 21, { size: 11, align: "center", color: n === 0 ? COLORS.ink : COLORS.muted, bold: n === 0 });
    }
    label(ctx, "x (m)", w - 8, ground + 38, { size: 11, align: "right", color: COLORS.muted });

    // block
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, top, bw, bh, 6);
    ctx.fill();
    label(ctx, `${fmt(s.mass, 1)} kg`, cx, top + bh / 2, { color: "#fff", align: "center", bold: true, size: 13 });

    // forces: applied on the side it pulls towards, friction at the contact surface, net above
    const px = Math.min(3, (w / 2 - bw / 2 - 16) / 100); // px per newton
    const side = (value, y, color, name) => {
      if (!value) return;
      const dir = Math.sign(value);
      const x = cx + (dir * bw) / 2;
      arrow(ctx, x, y, x + value * px, y, color, 4);
      label(ctx, `${name} = ${fmt(Math.abs(value), 1)} N`, x + dir * 8, y - 13, { color, bold: true, size: 13, align: dir > 0 ? "left" : "right" });
    };
    side(s.force, top + bh * 0.3, COLORS.orange, "F");
    side(f.friction, ground - 7, COLORS.red, "Fms");
    arrow(ctx, cx, top - 16, cx + f.net * px, top - 16, COLORS.purple, 4);
    label(ctx, `Fhl = ${fmt(Math.abs(f.net), 1)} N`, cx, top - 33, { color: COLORS.purple, bold: true, size: 13, align: "center" });
  },
});
