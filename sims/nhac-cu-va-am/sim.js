import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import {
  initialState, frequency, wavelength, linearDensity, stringWaveSpeed, harmonicNumber, modeShape,
  nearestNote, noteName, noteFrequency, centsFrom, inTune, TARGETS, TOLERANCE, SOUND_SPEED,
} from "./model.js";

const MAX_LEN = { string: 1, open: 1.5, closed: 1.5 }; // m, the full width of the picture
const TITLES = {
  string: ["Dây đàn hai đầu cố định", "f = (k/2L)·√(T/μ),  k = 1, 2, 3, …"],
  open: ["Ống sáo hai đầu hở", "f = k·v/(2L),  k = 1, 2, 3, …"],
  closed: ["Ống sáo một đầu kín, một đầu hở", "f = m·v/(4L),  m = 1, 3, 5, … (chỉ họa âm bậc lẻ)"],
};
const signed = c => `${c > 0 ? "+" : ""}${fmt(c, 0)}`;
const lengthOf = s => (s.instrument === "string" ? s.length : s.pipeLength);

// One result per finished adjustment; the goal once each time the target is reached.
const checkGoal = (s, api) => {
  const ok = inTune(s);
  if (ok && s.tunedNote !== s.target) api.emit("tuned", { note: s.target, frequency: frequency(s), cents: centsFrom(frequency(s), s.target) }, "goal");
  s.tunedNote = ok ? s.target : 0;
};
const report = (s, api) => {
  const note = nearestNote(frequency(s));
  api.emit("pitch-set", { frequency: frequency(s), note: note.index, cents: note.cents }, "result");
  checkGoal(s, api);
};

// Sound: only ever started from the button, so the browser's autoplay rule is respected.
let audio = null;
function playTone(s) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio ??= new AC();
  audio.resume?.();
  const n = 8;
  const real = new Float32Array(n + 1);
  const imag = new Float32Array(n + 1);
  // a closed pipe has no even harmonics; a string is brighter than a pipe
  for (let h = 1; h <= n; h++) imag[h] = s.instrument === "closed" && h % 2 === 0 ? 0 : 1 / h ** (s.instrument === "string" ? 1.2 : 2);
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.setPeriodicWave(audio.createPeriodicWave(real, imag));
  osc.frequency.value = frequency(s);
  const t = audio.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + 1.55);
}

// Envelope ±amp·|shape| between x0 and x1, centred on cy.
function envelope(ctx, instrument, k, x0, x1, cy, amp, phase) {
  const n = Math.max(24, Math.round((x1 - x0) / 3));
  const y = (i, sign) => cy - sign * amp * modeShape(instrument, k, i / n);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) ctx.lineTo(x0 + ((x1 - x0) * i) / n, y(i, 1));
  for (let i = n; i >= 0; i--) ctx.lineTo(x0 + ((x1 - x0) * i) / n, y(i, -1));
  ctx.closePath();
  ctx.fillStyle = "rgba(47, 111, 237, 0.13)";
  ctx.fill();
  ctx.strokeStyle = "rgba(47, 111, 237, 0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (phase == null) return;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) ctx.lineTo(x0 + ((x1 - x0) * i) / n, y(i, Math.cos(phase)));
}

// Nodes (N, nút) and antinodes (B, bụng) of the k-th standing wave, as fractions of the length.
function marks(instrument, k) {
  const out = [];
  const m = harmonicNumber(instrument, k); // quarter wavelengths in a closed pipe, half wavelengths otherwise
  const parts = instrument === "closed" ? m : 2 * k;
  for (let j = 0; j <= parts; j++) {
    const nodeFirst = instrument !== "open";
    out.push({ x: j / parts, node: (j % 2 === 0) === nodeFirst });
  }
  return out;
}

function tube(ctx, closed, x0, x1, cy, r, width) {
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(x0, cy - r);
  ctx.lineTo(x1, cy - r);
  ctx.moveTo(x0, cy + r);
  ctx.lineTo(x1, cy + r);
  ctx.stroke();
  if (closed) {
    ctx.lineWidth = width * 2;
    ctx.beginPath();
    ctx.moveTo(x0, cy - r - width / 2);
    ctx.lineTo(x0, cy + r + width / 2);
    ctx.stroke();
  }
}

mount({
  slug: "nhac-cu-va-am",
  version: "1.0.0",
  title: "Nhạc cụ: dây đàn và ống sáo",
  hint: "Chỉnh nhạc cụ để phát ra đúng nốt cần lên. Bấm “Nghe âm này” để nghe thử.",
  initialState,
  autoplay: true,
  step(s, dt) {
    s._t = (s._t ?? 0) + dt;
  },
  controls: [
    {
      type: "select",
      key: "instrument",
      label: "Nhạc cụ",
      options: [
        { value: "string", label: "Dây đàn (hai đầu cố định)" },
        { value: "open", label: "Ống sáo hai đầu hở" },
        { value: "closed", label: "Ống sáo một đầu kín, một đầu hở" },
      ],
      onCommit: report,
    },
    { type: "slider", key: "length", label: "Chiều dài dây L", min: 0.2, max: 1, step: 0.005, unit: "m", digits: 3, visible: s => s.instrument === "string", onCommit: report },
    { type: "slider", key: "tension", label: "Lực căng dây T", min: 20, max: 200, step: 0.1, unit: "N", digits: 1, visible: s => s.instrument === "string", onCommit: report },
    {
      type: "stepper", key: "tension", label: "Tinh chỉnh T (N)", min: 20, max: 200, step: 0.1, digits: 1,
      visible: s => s.instrument === "string",
      onChange: s => (s.tension = Math.round(s.tension * 10) / 10),
      onCommit: report,
    },
    { type: "slider", key: "diameter", label: "Đường kính dây thép d", min: 0.2, max: 1.5, step: 0.05, unit: "mm", visible: s => s.instrument === "string", onCommit: report },
    { type: "slider", key: "pipeLength", label: "Chiều dài cột khí L", min: 0.1, max: 1.5, step: 0.001, unit: "m", digits: 3, visible: s => s.instrument !== "string", onCommit: report },
    {
      type: "stepper", key: "pipeLength", label: "Tinh chỉnh L (m)", min: 0.1, max: 1.5, step: 0.001, digits: 3,
      visible: s => s.instrument !== "string",
      onChange: s => (s.pipeLength = Math.round(s.pipeLength * 1000) / 1000),
      onCommit: report,
    },
    { type: "stepper", key: "harmonic", label: "Xem sóng dừng thứ k", min: 1, max: 4 },
    {
      type: "select",
      key: "target",
      label: "Nốt cần lên",
      options: [{ value: 0, label: "Không yêu cầu" }, ...TARGETS.map(i => ({ value: i, label: `${noteName(i)} – ${fmt(noteFrequency(i), 1)} Hz` }))],
      onCommit: checkGoal,
    },
    { type: "button", label: "Nghe âm này", primary: true, action: playTone, event: "listen" },
  ],
  readouts: [
    { label: "Tần số âm cơ bản f₁", value: s => `${fmt(frequency(s), 1)} Hz` },
    {
      label: "Nốt gần nhất",
      value: s => {
        const n = nearestNote(frequency(s));
        return `${noteName(n.index)}, lệch ${signed(n.cents)} cent`;
      },
    },
    {
      label: "Tốc độ truyền sóng v",
      value: s =>
        s.instrument === "string"
          ? `${fmt(stringWaveSpeed(s.tension, linearDensity(s.diameter)), 1)} m/s (trên dây)`
          : `${SOUND_SPEED} m/s (trong không khí)`,
    },
    { label: "Khối lượng 1 m dây μ", value: s => (s.instrument === "string" ? `${fmt(linearDensity(s.diameter) * 1000, 2)} g/m` : "–") },
    { label: "Bước sóng λ của sóng dừng đang xem", value: s => `${fmt(wavelength(s, s.harmonic), 3)} m` },
  ],
  draw(ctx, s, view) {
    const small = view.w < 520 || view.h < 420;
    const pad = small ? 14 : 44;
    const size = small ? 11 : 14;
    const ins = s.instrument;
    const k = s.harmonic;
    const f = frequency(s);
    const phase = (s._t ?? 0) * 2 * Math.PI * 0.9; // slowed down so the eye can follow

    // ----- header -----
    label(ctx, TITLES[ins][0], view.w / 2, small ? 11 : 24, { align: "center", size: small ? 13 : 18, bold: true });
    label(ctx, TITLES[ins][1], view.w / 2, small ? 27 : 50, { align: "center", size: small ? 11 : 14, color: COLORS.muted });

    // ----- regions -----
    const top = small ? 38 : 76;
    const miniH = small ? 84 : Math.min(150, view.h * 0.22);
    const tunerH = small ? 84 : 124;
    const insH = Math.max(60, Math.min(view.h - top - miniH - tunerH - (small ? 6 : 34), small ? 110 : 300));
    const x0 = pad + 8;
    const full = view.w - 2 * pad - 16;
    const ppm = full / MAX_LEN[ins];
    const x1 = x0 + lengthOf(s) * ppm;
    const rulerY = top + insH - (small ? 12 : 18);
    const cy = top + (insH - (small ? 16 : 26)) / 2;
    const amp = Math.min((insH - (small ? 30 : 52)) / 2, small ? 26 : 60);

    // ruler
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, rulerY);
    ctx.lineTo(x0 + full, rulerY);
    for (let i = 0; i <= MAX_LEN[ins] * 10 + 1e-9; i++) {
      const x = x0 + (i / 10) * ppm;
      ctx.moveTo(x, rulerY);
      ctx.lineTo(x, rulerY + (i % 5 === 0 ? 6 : 3));
    }
    ctx.stroke();
    for (let i = 0; i <= MAX_LEN[ins] * 10 + 1e-9; i += 5) {
      label(ctx, `${fmt(i / 10, 1)} m`, x0 + (i / 10) * ppm, rulerY + (small ? 12 : 15), { size: small ? 10 : 12, align: "center", color: COLORS.muted });
    }

    if (ins === "string") {
      // the rest of the wire beyond the movable bridge
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1 + s.diameter * 2.4;
      ctx.beginPath();
      ctx.moveTo(x1, cy);
      ctx.lineTo(x0 + full, cy);
      ctx.stroke();
      envelope(ctx, ins, k, x0, x1, cy, amp, phase);
      ctx.strokeStyle = COLORS.blue;
      ctx.lineWidth = 1 + s.diameter * 2.4;
      ctx.lineCap = "round";
      ctx.stroke();
      // fixed bridge and movable bridge
      ctx.fillStyle = COLORS.ink;
      for (const x of [x0, x1]) {
        ctx.beginPath();
        ctx.moveTo(x, cy - 3);
        ctx.lineTo(x - 7, rulerY);
        ctx.lineTo(x + 7, rulerY);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      const r = amp;
      envelope(ctx, ins, k, x0, x1, cy, r - 5, null);
      // air "particles": rest positions on a grid, displaced along the pipe (longitudinal wave)
      const gap = small ? 11 : 15;
      const cols = Math.max(2, Math.floor((x1 - x0) / gap));
      ctx.fillStyle = COLORS.blue;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        const dx = gap * 0.42 * modeShape(ins, k, u) * Math.cos(phase);
        for (const row of [-0.55, 0, 0.55]) {
          ctx.beginPath();
          ctx.arc(x0 + u * (x1 - x0) + dx, cy + row * r, small ? 1.6 : 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      tube(ctx, ins === "closed", x0, x1, cy, r, small ? 3 : 4);
    }
    // nodes and antinodes
    for (const m of marks(ins, k)) {
      label(ctx, m.node ? "N" : "B", x0 + m.x * (x1 - x0), cy - amp - (small ? 9 : 13), {
        size: small ? 10 : 13, bold: true, align: "center", color: m.node ? COLORS.red : COLORS.green,
      });
    }
    label(ctx, `L = ${fmt(lengthOf(s), 3)} m`, Math.max((x0 + x1) / 2, x0 + (small ? 34 : 44)), (cy + amp + rulerY) / 2 + 1, { size, bold: true, align: "center" });
    if (!small) {
      label(ctx, "N: nút    B: bụng", view.w - pad, top - 6, { size: 12, align: "right", color: COLORS.muted });
    }

    // ----- tuner -----
    const ty = top + insH + (small ? 4 : 14);
    const near = nearestNote(f);
    label(ctx, `f₁ = ${fmt(f, 1)} Hz`, pad, ty + 10, { size: small ? 15 : 22, bold: true, color: COLORS.blue });
    label(ctx, `gần nốt ${noteName(near.index)}`, view.w - pad, ty + 10, { size: small ? 13 : 18, bold: true, align: "right" });
    const gw = Math.min(view.w - 2 * pad, 460);
    const gx = (view.w - gw) / 2;
    const gy = ty + (small ? 28 : 40);
    const gh = small ? 10 : 14;
    const cx = c => gx + ((c + 50) / 100) * gw;
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = "rgba(31, 157, 107, 0.45)";
    ctx.fillRect(cx(-TOLERANCE), gy, cx(TOLERANCE) - cx(-TOLERANCE), gh);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = -50; c <= 50; c += 10) {
      ctx.moveTo(cx(c), gy + gh);
      ctx.lineTo(cx(c), gy + gh + (c % 50 === 0 ? 5 : 3));
    }
    ctx.stroke();
    ctx.fillStyle = Math.abs(near.cents) <= TOLERANCE ? COLORS.green : COLORS.orange;
    ctx.beginPath();
    ctx.moveTo(cx(near.cents), gy + gh - 1);
    ctx.lineTo(cx(near.cents) - 6, gy - 7);
    ctx.lineTo(cx(near.cents) + 6, gy - 7);
    ctx.closePath();
    ctx.fill();
    const ly = gy + gh + (small ? 11 : 14);
    label(ctx, "−50", gx, ly, { size: small ? 10 : 12, color: COLORS.muted, align: "center" });
    label(ctx, `lệch ${signed(near.cents)} cent`, view.w / 2, ly, { size: small ? 10 : 12, color: COLORS.muted, align: "center" });
    label(ctx, "+50", gx + gw, ly, { size: small ? 10 : 12, color: COLORS.muted, align: "center" });
    if (TARGETS.includes(s.target)) {
      const off = centsFrom(f, s.target);
      const ok = Math.abs(off) <= TOLERANCE;
      const want = `${noteName(s.target)} = ${fmt(noteFrequency(s.target), 1)} Hz`;
      const text = ok
        ? `Đúng nốt cần lên: ${want}`
        : `Cần lên ${want}: đang ${off < 0 ? "thấp" : "cao"} hơn ${fmt(Math.abs(off), 0)} cent`;
      label(ctx, text, view.w / 2, ly + (small ? 15 : 22), { size: small ? 11 : 15, bold: true, align: "center", color: ok ? COLORS.green : COLORS.ink });
    }

    // ----- the first four standing waves -----
    const my = view.h - miniH;
    const cw = (view.w - 2 * pad) / 4;
    for (let j = 1; j <= 4; j++) {
      const mx = pad + (j - 1) * cw;
      const picH = miniH - (small ? 34 : 46);
      const a = picH / 2 - 4;
      const mcy = my + picH / 2 + 2;
      if (j === k) {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = COLORS.blue;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(mx + 2, my - 2, cw - 4, miniH - 2, 6);
        ctx.fill();
        ctx.stroke();
      }
      const a0 = mx + 10;
      const a1 = mx + cw - 10;
      envelope(ctx, ins, j, a0, a1, mcy, ins === "string" ? a : a - 3, null);
      if (ins !== "string") tube(ctx, ins === "closed", a0, a1, mcy, a, 2);
      const h = harmonicNumber(ins, j);
      const ty2 = my + picH + (small ? 9 : 12);
      label(ctx, h === 1 ? "Âm cơ bản" : `Họa âm bậc ${h}`, mx + cw / 2, ty2, { size: small ? 10 : 13, align: "center", bold: j === k });
      label(ctx, `${fmt(frequency(s, j), 1)} Hz`, mx + cw / 2, ty2 + (small ? 13 : 17), { size: small ? 10 : 13, align: "center", color: COLORS.muted });
    }
    const notes = small
      ? ["Dao động vẽ chậm lại, biên độ phóng đại (quy ước)."]
      : ins === "string"
        ? ["Dao động được vẽ chậm lại, biên độ phóng đại."]
        : ["Chấm: phần tử khí dao động dọc theo ống (vẽ chậm lại, phóng đại).", "Đường cong: biên độ dao động, vẽ quy ước. Bỏ qua hiệu chỉnh đầu ống."];
    const lineH = small ? 12 : 16;
    if (my - (ly + (small ? 22 : 34)) > notes.length * lineH) {
      notes.forEach((text, i) => label(ctx, text, view.w / 2, my - 10 - (notes.length - 1 - i) * lineH, { size: small ? 10 : 12, align: "center", color: COLORS.muted }));
    }
  },
});
