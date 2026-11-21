import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, forces, theory, release, restart } from "./model.js";

const rad = deg => (deg * Math.PI) / 180;
const MAX_MASS = 10;

// Any change of the set-up puts the block back at the start.
const reset = (s, api) => {
  restart(s);
  api.pause();
};
const param = extra => ({ onChange: reset, ...extra });

mount({
  slug: "mat-phang-nghieng",
  version: "1.0.0",
  title: "Mặt phẳng nghiêng",
  hint: "Chọn góc nghiêng và hệ số ma sát rồi thả vật. Vật chỉ trượt khi tan α > μn.",
  initialState,
  step(s, dt, api) {
    if (s.done) restart(s); // "Chạy" after a finished run starts a new one
    if (!s.released) {
      release(s);
      api.emit("release", { angle: s.angle, mass: s.mass, muS: s.muS, muK: s.muK, gravity: s.gravity, length: s.length });
    }
    step(s, dt);
    if (!s.done) return;
    api.pause();
    if (s.pos >= s.length) {
      api.emit("reached-bottom", { time: s.time, speed: s.v, acceleration: forces(s).accel, distance: s.pos }, "result");
    } else {
      api.emit("stayed-at-rest", { distance: s.pos, angle: s.angle, muS: s.muS }, "result");
    }
  },
  controls: [
    param({ type: "slider", key: "angle", label: "Góc nghiêng α", min: 0, max: 60, step: 1, unit: "°", digits: 0 }),
    param({ type: "slider", key: "mass", label: "Khối lượng m", min: 0.5, max: MAX_MASS, step: 0.5, unit: "kg", digits: 1 }),
    {
      type: "slider",
      key: "muS",
      label: "Hệ số ma sát nghỉ μn",
      min: 0,
      max: 1,
      step: 0.05,
      onChange(s, api) {
        s.muK = Math.min(s.muK, s.muS);
        reset(s, api);
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
        reset(s, api);
        api.sync();
      },
    },
    param({
      type: "select",
      key: "gravity",
      label: "Gia tốc trọng trường",
      options: [
        { value: 9.81, label: "Trái Đất (g = 9,81 m/s²)" },
        { value: 10, label: "Lấy tròn g = 10 m/s²" },
        { value: 3.71, label: "Sao Hỏa (g = 3,71 m/s²)" },
        { value: 1.62, label: "Mặt Trăng (g = 1,62 m/s²)" },
      ],
    }),
    param({ type: "slider", key: "length", label: "Quãng đường tới chân dốc s", min: 0.5, max: 5, step: 0.1, unit: "m", digits: 1 }),
    { type: "checkbox", key: "showComponents", label: "Phân tích trọng lực thành Px và Py" },
    {
      type: "button",
      label: "Thả vật từ vạch xuất phát",
      primary: true,
      action(s, api) {
        restart(s);
        api.play(); // the first step releases the block and reports it
      },
    },
  ],
  readouts: [
    { label: "Trọng lực P = m·g", value: s => `${fmt(forces(s).weight, 1)} N` },
    { label: "Px = P·sin α", value: s => `${fmt(forces(s).along, 1)} N` },
    { label: "Phản lực N = P·cos α", value: s => `${fmt(forces(s).normal, 1)} N` },
    { label: "Ma sát nghỉ cực đại μn·N", value: s => `${fmt(forces(s).maxStatic, 1)} N` },
    {
      label: "Lực ma sát Fms",
      value: s => {
        const f = forces(s);
        return `${fmt(f.friction, 1)} N (${f.sliding ? "trượt" : "nghỉ"})`;
      },
    },
    { label: "Gia tốc a", value: s => `${fmt(forces(s).accel)} m/s²` },
    { label: "Vận tốc v", value: s => `${fmt(s.v)} m/s` },
    { label: "Quãng đường đã trượt", value: s => `${fmt(s.pos)} m` },
    { label: "Thời gian t", value: s => `${fmt(s.time)} s` },
    {
      label: "Dự đoán ở chân dốc",
      value: s => {
        const th = theory(s);
        return th ? `t = ${fmt(th.time)} s; v = ${fmt(th.speed)} m/s` : "vật không trượt";
      },
    },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const small = w < 560 || h < 420;
    const f = forces(s);
    const a = rad(s.angle);
    const top = small ? 40 : 84;
    const bottom = small ? 14 : 44;
    const L = Math.min(w - (small ? 28 : 80), (h - top - bottom) / 0.9); // slope length on screen
    const bw = clamp(L * 0.12, 28, 64);
    const bh = bw * 0.62;
    const yBase = h - bottom;
    const d = { x: Math.cos(a), y: Math.sin(a) }; // down the slope
    const n = { x: Math.sin(a), y: -Math.cos(a) }; // out of the slope
    const T = { x: (w - L * d.x) / 2, y: yBase - L * d.y };
    const B = { x: T.x + L * d.x, y: yBase };
    const at = (u, off = 0) => ({ x: T.x + d.x * u + n.x * off, y: T.y + d.y * u + n.y * off });

    // ground and incline
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, yBase, w, 2);
    ctx.fillStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(T.x, T.y);
    ctx.lineTo(B.x, B.y);
    ctx.lineTo(T.x, yBase);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.stroke();

    // angle at the foot
    if (s.angle > 0) {
      const R = small ? 26 : 40;
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(B.x, B.y, R, Math.PI, Math.PI + a);
      ctx.stroke();
    }
    label(ctx, `α = ${fmt(s.angle, 0)}°`, B.x - 6, yBase + (small ? 8 : 16), { color: COLORS.orange, bold: true, size: small ? 11 : 13, align: "right" });

    // travel: block centre goes from u0 to u1 while pos goes from 0 to length
    const u0 = 0.2 * L;
    const u1 = L - bw / 2;
    const u = u0 + (clamp(s.pos, 0, s.length) / s.length) * (u1 - u0);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 2;
    for (const mark of [u0, u1]) {
      const p = at(mark);
      const q = at(mark, -9);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    const mid = at((u0 + u1) / 2, -13);
    ctx.save();
    ctx.translate(mid.x, mid.y);
    ctx.rotate(a);
    label(ctx, `s = ${fmt(s.length, 1)} m`, 0, 0, { color: COLORS.muted, size: small ? 11 : 13, align: "center" });
    ctx.restore();

    // block
    const C = at(u, bh / 2);
    ctx.save();
    ctx.translate(C.x, C.y);
    ctx.rotate(a);
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 4);
    ctx.fill();
    ctx.restore();

    // forces, all at one scale; the heaviest block at this g gives the longest weight arrow
    const pxN = (0.3 * Math.min(w, h - top)) / (MAX_MASS * s.gravity);
    const size = small ? 12 : 13;
    const vec = (from, dir, mag, color, name, width = 3.5) => {
      const len = mag * pxN;
      if (len < 1) return null;
      const tip = { x: from.x + dir.x * len, y: from.y + dir.y * len };
      arrow(ctx, from.x, from.y, tip.x, tip.y, color, width);
      const align = dir.x > 0.3 ? "left" : dir.x < -0.3 ? "right" : "center";
      const text = small ? name : `${name} = ${fmt(mag, 1)} N`;
      label(ctx, text, tip.x + dir.x * 8, tip.y + dir.y * 8 + (align === "center" ? Math.sign(dir.y) * 6 : 0), { color, bold: true, size, align });
      return tip;
    };
    const down = { x: 0, y: 1 };
    const into = { x: -n.x, y: -n.y };
    if (s.showComponents) {
      const px = vec(C, d, f.along, COLORS.orange, "Px", 2.5);
      const py = vec(C, into, f.normal, COLORS.orange, "Py", 2.5);
      const tip = { x: C.x, y: C.y + f.weight * pxN };
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (const p of [px, py]) {
        if (!p) continue;
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    vec(C, down, f.weight, COLORS.red, "P");
    vec(C, n, f.normal, COLORS.green, "N");
    vec(at(u, 3), { x: -d.x, y: -d.y }, f.friction, COLORS.purple, "Fms");
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(C.x, C.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // what happens and why
    const tan = Math.tan(a);
    const big = small ? 12 : 15;
    const x = small ? 8 : 16;
    const y = small ? 11 : 20;
    const gap = small ? 15 : 21;
    const slides = tan > s.muS;
    label(ctx, slides ? `Vật trượt xuống: tan α = ${fmt(tan)} > μn = ${fmt(s.muS)}` : `Vật đứng yên: tan α = ${fmt(tan)} ≤ μn = ${fmt(s.muS)}`, x, y, {
      size: big,
      bold: true,
      color: slides ? COLORS.ink : COLORS.green,
    });
    const why = f.sliding ? `a = g(sin α − μt·cos α) = ${fmt(f.accel)} m/s²` : `Fms nghỉ = Px = ${fmt(f.along, 1)} N, a = 0`;
    const outcome = !s.done
      ? ""
      : s.pos >= s.length
        ? `Tới chân dốc: t = ${fmt(s.time)} s, v = ${fmt(s.v)} m/s`
        : "Đã thả: vật không trượt (quãng đường 0 m)";
    if (!small || !outcome) label(ctx, why, x, y + gap, { size: big - 1, color: COLORS.muted });
    if (outcome) label(ctx, outcome, x, y + gap * (small ? 1 : 2), { size: big - 1, bold: true, color: COLORS.blue });
    if (!small) {
      label(ctx, "Các mũi tên lực vẽ cùng một tỉ lệ; tỉ lệ này đổi khi chọn g khác.", w - 12, h - 14, { size: 11, color: COLORS.muted, align: "right" });
    }
  },
});
