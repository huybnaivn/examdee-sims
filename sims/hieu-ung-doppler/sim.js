import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { SOUND, EMIT, WORLD, initialState, restart, side, approachSpeeds, heardFrequency, mach, machAngle, fronts, step, outside } from "./model.js";

const SLOW = 4; // the motion is shown this many times slower than real time

const dirText = v => (v === 0 ? "đứng yên" : `${fmt(Math.abs(v), 0)} m/s ${v > 0 ? "sang phải" : "sang trái"}`);
const hz = f => (f > 0 ? `${fmt(f, 0)} Hz` : "chưa nghe thấy");
const signed = v => (v < 0 ? `− ${fmt(-v, 0)}` : `+ ${fmt(v, 0)}`);

function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const pad = small ? 10 : 24;
  const top = small ? 48 : 74;
  const bottom = small ? 34 : 44;
  const scale = (view.w - 2 * pad) / (2 * WORLD); // px per metre, same on both axes so fronts stay round
  const scene = { x: pad, y: top, w: view.w - 2 * pad, h: view.h - top - bottom };
  const cy = scene.y + scene.h * 0.62;
  return { small, pad, scale, scene, cy, X: x => view.w / 2 + x * scale };
}

function person(ctx, x, y, size, color) {
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y - size * 1.55, size * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - size * 1.2);
  ctx.lineTo(x, y - size * 0.5);
  ctx.moveTo(x - size * 0.4, y - size * 0.95);
  ctx.lineTo(x + size * 0.4, y - size * 0.95);
  ctx.moveTo(x, y - size * 0.5);
  ctx.lineTo(x - size * 0.3, y);
  ctx.moveTo(x, y - size * 0.5);
  ctx.lineTo(x + size * 0.3, y);
  ctx.stroke();
}

const run = s => restart(s);
// Side the listener is on before S and N meet: they close in when (u_S − u_N) points from S to N. 0 = never meet.
const meet = s => Math.sign(s.sourceVelocity - s.listenerVelocity);

mount({
  slug: "hieu-ung-doppler",
  version: "1.0.0",
  title: "Hiệu ứng Đốp-ple",
  hint: "Cho nguồn âm S chạy qua người nghe N. Khi lại gần nhau, âm nghe được cao hơn âm của nguồn; khi ra xa nhau, âm nghe được trầm hơn.",
  initialState,
  autoplay: true,
  timeScale: () => 1 / SLOW,
  step(s, dt, api) {
    if (step(s, dt)) {
      // the source has just gone past the listener: one result per pass
      api.emit("source-passed", {
        before: heardFrequency(s, -side(s)),
        after: heardFrequency(s, side(s)),
        sourceFrequency: s.frequency,
        sourceVelocity: s.sourceVelocity,
        listenerVelocity: s.listenerVelocity,
      }, "result");
    }
    if (outside(s)) restart(s);
  },
  controls: [
    { type: "slider", key: "frequency", label: "Tần số của nguồn f", min: 100, max: 1000, step: 10, unit: "Hz", digits: 0 },
    {
      type: "slider",
      key: "sourceVelocity",
      label: "Vận tốc nguồn S",
      min: -680,
      max: 680,
      step: 10,
      format: v => dirText(v),
      onChange: run,
    },
    {
      type: "slider",
      key: "listenerVelocity",
      label: "Vận tốc người nghe N",
      min: -100,
      max: 100,
      step: 5,
      format: v => dirText(v),
      onChange: run,
    },
    { type: "button", label: "Cho nguồn chạy lại từ đầu", action: (s, api) => (restart(s), api.play()), event: "restart-run" },
  ],
  readouts: [
    { label: "Tần số của nguồn f", value: s => `${fmt(s.frequency, 0)} Hz` },
    { label: "Tần số người nghe nhận f′", value: s => hz(heardFrequency(s)) },
    { label: "f′ trước khi S đi qua N", value: s => (meet(s) ? hz(heardFrequency(s, meet(s))) : "không gặp nhau") },
    { label: "f′ sau khi S đi qua N", value: s => (meet(s) ? hz(heardFrequency(s, -meet(s))) : "không gặp nhau") },
    { label: "Số Mach vₛ/v", value: s => fmt(mach(s), 2) },
    { label: "Tốc độ âm trong không khí v", value: () => `${SOUND} m/s` },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    const { X, cy, scene } = g;
    const size = g.small ? 12 : 15;
    const dir = side(s);
    const { source: vS, listener: vN } = approachSpeeds(s, dir);
    const fNow = heardFrequency(s);
    const theta = machAngle(s);

    // caption: the formula with this moment's numbers
    const color = fNow === 0 ? COLORS.muted : fNow > s.frequency + 1e-9 ? COLORS.red : fNow < s.frequency - 1e-9 ? COLORS.blue : COLORS.ink;
    const trend = fNow === 0 ? "" : fNow > s.frequency + 1e-9 ? " – cao hơn f" : fNow < s.frequency - 1e-9 ? " – thấp hơn f" : " – bằng f";
    label(ctx, `Người nghe nhận f′ = ${hz(fNow)}${trend}`, 12, g.small ? 13 : 20, { size, bold: true, color });
    const formula =
      fNow === 0
        ? g.small ? "Nguồn nhanh hơn âm: âm chưa tới người nghe" : "Nguồn nhanh hơn âm: âm chưa tới được người nghe đứng phía trước"
        : `f′ = ${g.small ? "" : "f·(v + vₙ)/(v − vₛ) = "}${fmt(s.frequency, 0)}·(${SOUND} ${signed(vN)})/(${SOUND} ${signed(-vS)}) ≈ ${fmt(fNow, 0)} Hz`;
    label(ctx, formula, 12, g.small ? 32 : 46, { size: g.small ? 11 : 14, color: COLORS.muted });

    // wavefronts, clipped to the scene
    ctx.save();
    ctx.beginPath();
    ctx.rect(scene.x, scene.y, scene.w, scene.h);
    ctx.clip();
    ctx.fillStyle = "#eef2fa";
    ctx.fillRect(scene.x, scene.y, scene.w, scene.h);
    ctx.lineWidth = 1.5;
    for (const f of fronts(s)) {
      const alpha = Math.max(0.12, 0.75 - f.age * 0.4);
      ctx.strokeStyle = `rgba(47, 111, 237, ${alpha})`;
      ctx.beginPath();
      ctx.arc(X(f.x), cy, f.r * g.scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    // centres of the fronts: all on the path of the source
    ctx.fillStyle = "rgba(47, 111, 237, 0.55)";
    for (const f of fronts(s)) {
      if (f.age > 1) break;
      ctx.beginPath();
      ctx.arc(X(f.x), cy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mach cone
    if (theta) {
      const back = -Math.sign(s.sourceVelocity);
      const len = 3 * WORLD * g.scale;
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(X(s.sourceX) + back * len * Math.cos(theta), cy - len * Math.sin(theta));
      ctx.lineTo(X(s.sourceX), cy);
      ctx.lineTo(X(s.sourceX) + back * len * Math.cos(theta), cy + len * Math.sin(theta));
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (back > 0) ctx.arc(X(s.sourceX), cy, 34, -theta, 0);
      else ctx.arc(X(s.sourceX), cy, 34, Math.PI, Math.PI + theta);
      ctx.stroke();
      label(ctx, "θ", X(s.sourceX) + back * 46 * Math.cos(theta / 2), cy - 46 * Math.sin(theta / 2), { size: 13, color: COLORS.red, bold: true, align: "center" });
    }
    ctx.restore();

    // the line along which both move
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(scene.x, cy);
    ctx.lineTo(scene.x + scene.w, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // listener N
    const xn = X(s.listenerX);
    const ps = g.small ? 16 : 22;
    person(ctx, xn, cy, ps, COLORS.ink);
    label(ctx, "N", xn + ps * 0.55, cy - ps * 1.6, { size: 13, bold: true });
    if (s.listenerVelocity) arrow(ctx, xn, cy + 10, xn + s.listenerVelocity * g.scale * 0.5, cy + 10, COLORS.green, 2.5);

    // source S
    const xs = X(s.sourceX);
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(xs, cy, g.small ? 7 : 9, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, "S", xs, cy - (g.small ? 17 : 21), { size: 13, bold: true, align: "center", color: COLORS.orange });
    if (s.sourceVelocity) {
      const L = Math.sign(s.sourceVelocity) * Math.min(Math.abs(s.sourceVelocity) * g.scale * 0.5, 70);
      arrow(ctx, xs, cy + (g.small ? 14 : 18), xs + L, cy + (g.small ? 14 : 18), COLORS.orange, 2.5);
    }

    if (theta) {
      label(ctx, `Nón Mach: sin θ = v/vₛ = ${fmt(1 / mach(s), 2)}, θ ≈ ${fmt((theta * 180) / Math.PI, 0)}°`, scene.x + 8, scene.y + 14, {
        size: g.small ? 11 : 13,
        bold: true,
        color: COLORS.red,
      });
    }

    // conventions and what is not to scale
    const note = g.small
      ? ["vₙ, vₛ > 0 khi lại gần nhau.", `Vòng sóng vẽ cách nhau ${fmt(EMIT, 2)} s; chậm ${SLOW} lần.`]
      : [
          "Quy ước: vₙ > 0 khi người nghe lại gần nguồn, vₛ > 0 khi nguồn lại gần người nghe (âm khi ra xa).",
          `Mỗi vòng tròn là mặt sóng phát ra cách nhau ${fmt(EMIT, 2)} s (thưa hơn nhiều so với một chu kì); chuyển động chậm ${SLOW} lần.`,
        ];
    const ny = view.h - (g.small ? 24 : 30);
    note.forEach((t, i) => label(ctx, t, 12, ny + i * (g.small ? 13 : 16), { size: g.small ? 10.5 : 12, color: COLORS.muted }));
  },
});
