import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import {
  MEDIA, LOW, HIGH, CLASS_NAMES, initialState, frequency, speed, wavelength, intensity, level,
  soundClass, displacement, pressure,
} from "./model.js";

const VISUAL_F = 0.6; // Hz on screen: the motion is slowed down so it can be followed
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

/** 2,5·10⁻⁵ */
function sci(x) {
  const e = Math.floor(Math.log10(x) + 1e-9);
  const m = x / 10 ** e;
  const exp = String(e).replace(/./g, c => SUP[c]);
  return `${Math.abs(m - 1) < 1e-9 ? "" : fmt(m, 2) + "·"}10${exp}`;
}

/** A length in the friendliest unit. */
function len(m) {
  if (m >= 1) return `${fmt(m, 2)} m`;
  if (m >= 0.01) return `${fmt(m * 100, 1)} cm`;
  return `${fmt(m * 1000, 2)} mm`;
}

/** Smallest 1, 2 or 5 × 10ⁿ that is at least x. */
function nice(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  return [1, 2, 5, 10].map(k => k * p).find(v => v >= x * (1 - 1e-9));
}

// ---------- optional real sound, only ever started by the button ----------
let audio = null;
function startAudio(s) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx || audio) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  audio = { ctx, osc, gain };
  s._audio = true;
  tuneAudio(s);
}
function stopAudio(s) {
  audio?.ctx.close();
  audio = null;
  s._audio = false;
}
function tuneAudio(s) {
  if (audio && !s._audio) stopAudio(s); // reset or a restored state switched it off
  if (!audio) return;
  const f = frequency(s);
  const now = audio.ctx.currentTime;
  // Inaudible sounds are not played: the speaker cannot make them and nobody would hear them.
  const audible = soundClass(f) === 1;
  audio.osc.frequency.setTargetAtTime(Math.min(f, audio.ctx.sampleRate / 2), now, 0.02);
  audio.gain.gain.setTargetAtTime(audible ? 0.02 * s.amplitude : 0, now, 0.03);
}

const report = (s, api) => {
  const f = frequency(s);
  api.emit("sound-set", { frequency: f, wavelength: wavelength(s), level: level(s), soundClass: soundClass(f), speed: speed(s) }, "result");
};

function line(ctx, x1, y1, x2, y2, color, width = 1.5, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const pad = small ? 10 : 24;
  const top = small ? 46 : 70;
  const specH = small ? 40 : 54;
  const rulerH = small ? 24 : 30;
  const avail = view.h - top - specH - rulerH - (small ? 6 : 16);
  const graphH = Math.max(46, Math.min(avail * 0.38, 170));
  const bandH = Math.min(avail - graphH - (small ? 6 : 14), 300);
  const speakerW = small ? 30 : 46;
  const x0 = pad + speakerW;
  const x1 = view.w - pad;
  const y0 = top + (avail - graphH - (small ? 6 : 14) - bandH) / 2; // centre what is left over on a tall stage
  const band = { y: y0, h: bandH };
  const graph = { y: y0 + bandH + (small ? 6 : 14), h: graphH };
  const rulerY = graph.y + graphH + (small ? 8 : 12);
  const spec = { y: view.h - specH, h: specH };
  return { small, pad, x0, x1, speakerW, band, graph, rulerY, spec };
}

mount({
  slug: "am-thanh",
  version: "1.0.0",
  title: "Sóng âm: độ cao và độ to",
  hint: "Đổi tần số để nghe âm cao, thấp; đổi biên độ để âm to, nhỏ. Quan sát chỗ nén, chỗ dãn của các phần tử môi trường và bước sóng.",
  initialState,
  autoplay: true,
  step(s, dt) {
    s._t = ((s._t ?? 0) + dt) % (1 / VISUAL_F); // only the picture moves
  },
  controls: [
    {
      type: "slider",
      key: "logFrequency",
      label: "Tần số f (độ cao)",
      min: 0.5,
      max: 5,
      step: 0.01,
      format: (v, s) => `${fmt(frequency(s), 1)} Hz`,
      onChange: tuneAudio,
      onCommit: report,
    },
    { type: "slider", key: "amplitude", label: "Biên độ A (độ to)", min: 0.1, max: 10, step: 0.1, digits: 1, onChange: tuneAudio, onCommit: report },
    {
      type: "select",
      key: "medium",
      label: "Môi trường truyền âm",
      options: Object.entries(MEDIA).map(([value, m]) => ({ value, label: `${m.name} (v ≈ ${fmt(m.speed, 0)} m/s)` })),
      onCommit: report,
    },
    { type: "heading", label: "Nghe thử" },
    { type: "button", label: "Phát âm thanh qua loa", visible: s => !s._audio, action: startAudio, event: "sound-on" },
    { type: "button", label: "Tắt âm thanh", primary: true, visible: s => !!s._audio, action: stopAudio, event: "sound-off" },
  ],
  readouts: [
    { label: "Tần số f", value: s => `${fmt(frequency(s), 1)} Hz` },
    { label: "Loại âm", value: s => CLASS_NAMES[soundClass(frequency(s))] },
    { label: "Tốc độ truyền âm v", value: s => `${fmt(speed(s), 0)} m/s` },
    { label: "Bước sóng λ = v/f", value: s => len(wavelength(s)) },
    { label: "Cường độ âm I", value: s => `${sci(intensity(s))} W/m²` },
    { label: "Mức cường độ âm L = 10·lg(I/I₀)", value: s => `${fmt(level(s), 1)} dB` },
  ],
  draw(ctx, s, view) {
    tuneAudio(s);
    const g = geom(view);
    const f = frequency(s);
    const cls = soundClass(f);
    const lambda = wavelength(s);
    const W = nice(2 * lambda); // metres across the scene: always 2 to 5 wavelengths
    const pxPerLambda = ((g.x1 - g.x0) * lambda) / W;
    const phase = 2 * Math.PI * VISUAL_F * (s._t ?? 0);
    const a = s.amplitude / 10; // 0..1
    const u = x => (x - g.x0) / pxPerLambda; // screen x -> wavelengths from the speaker
    const size = g.small ? 12 : 15;
    const clsColor = [COLORS.muted, COLORS.green, COLORS.purple][cls];

    // caption
    label(ctx, `f = ${fmt(f, 1)} Hz – ${CLASS_NAMES[cls].toLowerCase()}`, 12, g.small ? 13 : 20, { size, bold: true, color: clsColor });
    label(ctx, `λ = ${len(lambda)}   L = ${fmt(level(s), 1)} dB`, view.w - 12, g.small ? 13 : 20, { size, bold: true, align: "right" });
    label(ctx, `${MEDIA[s.medium]?.name ?? ""}: v = ${fmt(speed(s), 0)} m/s;  I = ${sci(intensity(s))} W/m², I₀ = 10⁻¹² W/m²`, 12, g.small ? 32 : 46, {
      size: g.small ? 11 : 13,
      color: COLORS.muted,
    });

    // pressure tint behind the particles: warm where compressed, cool where rarefied
    const { y: by, h: bh } = g.band;
    for (let x = g.x0; x < g.x1; x += 3) {
      const p = pressure(u(x), phase) * a;
      ctx.fillStyle = p > 0 ? `rgba(229, 72, 77, ${0.32 * p})` : `rgba(47, 111, 237, ${-0.28 * p})`;
      ctx.fillRect(x, by, 3.5, bh);
    }
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(g.x0, by, g.x1 - g.x0, bh);

    // air particles: displaced along the direction of propagation (longitudinal wave)
    const xi = 0.15 * pxPerLambda * a; // displacement amplitude on screen, exaggerated
    const dx = g.small ? 8 : 13;
    const dy = g.small ? 11 : 16;
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x0, by, g.x1 - g.x0, bh);
    ctx.clip();
    ctx.fillStyle = COLORS.ink;
    let row = 0;
    for (let y = by + dy / 2 + 2; y < by + bh - 2; y += dy, row++) {
      for (let x = g.x0 + (row % 2 ? dx / 2 : 0) + 2; x < g.x1 + dx; x += dx) {
        ctx.beginPath();
        ctx.arc(x + xi * displacement(u(x), phase), y, g.small ? 1.8 : 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // one tagged particle, to show each one only oscillates about its place
    const xt = g.x0 + Math.round((0.5 * pxPerLambda) / dx) * dx + 2;
    const yt = by + dy / 2 + 2 + dy * Math.min(2, Math.floor((bh - 4) / dy / 2));
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(xt + xi * displacement(u(xt), phase), yt, g.small ? 3.5 : 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // compression / rarefaction tags at the current crest and trough of pressure
    const u0 = (((phase / (2 * Math.PI)) % 1) + 1) % 1;
    for (const [k, text, color] of [[0, "nén", COLORS.red], [0.5, "dãn", COLORS.blue]]) {
      for (let m = u0 + k; m * pxPerLambda < g.x1 - g.x0 - 14; m += 1) {
        if (m * pxPerLambda < 14) continue;
        const x = g.x0 + m * pxPerLambda;
        ctx.font = `600 ${g.small ? 10 : 12}px system-ui, sans-serif`;
        const w = ctx.measureText(text).width + 8;
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fillRect(x - w / 2, by + 2, w, g.small ? 14 : 17);
        label(ctx, text, x, by + (g.small ? 9 : 10.5), { size: g.small ? 10 : 12, align: "center", color, bold: true });
      }
    }

    // loudspeaker, its membrane moving with the air next to it
    const sx = g.pad;
    const cy = by + bh / 2;
    const ch = Math.min(bh * 0.8, g.small ? 70 : 110);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(sx, cy - ch * 0.25, g.speakerW * 0.45, ch * 0.5);
    const mx = g.x0 - 3 + xi * displacement(0, phase) * 0.6;
    ctx.fillStyle = "#3a4766";
    ctx.beginPath();
    ctx.moveTo(sx + g.speakerW * 0.45, cy - ch * 0.25);
    ctx.lineTo(mx, cy - ch / 2);
    ctx.lineTo(mx, cy + ch / 2);
    ctx.lineTo(sx + g.speakerW * 0.45, cy + ch * 0.25);
    ctx.closePath();
    ctx.fill();
    line(ctx, mx, cy - ch / 2, mx, cy + ch / 2, COLORS.orange, 3);

    // pressure graph p(x) at this instant
    const { y: gy, h: gh } = g.graph;
    const mid = gy + gh / 2;
    line(ctx, g.x0, mid, g.x1, mid, COLORS.muted, 1, [4, 4]);
    line(ctx, g.x0, gy, g.x0, gy + gh, COLORS.muted, 1);
    label(ctx, "Δp", g.x0 - 6, gy + 6, { size: 12, align: "right", color: COLORS.muted, bold: true });
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = g.x0; x <= g.x1; x += 2) ctx.lineTo(x, mid - pressure(u(x), phase) * a * gh * 0.42);
    ctx.stroke();
    // one wavelength between two neighbouring pressure maxima
    const xa = g.x0 + u0 * pxPerLambda;
    const yb = mid - a * gh * 0.42;
    line(ctx, xa, yb, xa, gy + gh, COLORS.orange, 1, [3, 3]);
    line(ctx, xa + pxPerLambda, yb, xa + pxPerLambda, gy + gh, COLORS.orange, 1, [3, 3]);
    line(ctx, xa, gy + gh - 3, xa + pxPerLambda, gy + gh - 3, COLORS.orange, 2.5);
    // beside the right end, where the curve is at a crest and leaves the bottom free
    label(ctx, "λ", xa + pxPerLambda + 5, gy + gh - 4, { size: 13, color: COLORS.orange, bold: true });

    // ruler
    const ry = g.rulerY;
    line(ctx, g.x0, ry, g.x1, ry, COLORS.muted);
    for (let k = 0; k <= 10; k++) {
      const x = g.x0 + ((g.x1 - g.x0) * k) / 10;
      line(ctx, x, ry - (k % 5 ? 3 : 5), x, ry + (k % 5 ? 3 : 5), COLORS.muted);
    }
    label(ctx, "0", g.x0, ry + 13, { size: 11, align: "center", color: COLORS.muted });
    label(ctx, len(W), g.x1, ry + 13, { size: 11, align: "right", color: COLORS.muted });
    label(ctx, g.small ? "Đã làm chậm; độ dời phóng đại" : "Chuyển động đã làm chậm; độ dời của phần tử được phóng đại", (g.x0 + g.x1) / 2, ry + 13, {
      size: 11,
      align: "center",
      color: COLORS.muted,
    });

    // where this frequency sits: hạ âm | âm nghe được | siêu âm, on a log scale 1 Hz … 100 kHz
    const { y: sy, h: sh } = g.spec;
    const X = hz => g.pad + (Math.log10(hz) / 5) * (view.w - 2 * g.pad);
    const barY = sy + (g.small ? 4 : 8);
    const barH = g.small ? 16 : 20;
    const zones = [
      [1, LOW, "#d9dee8", "Hạ âm"],
      [LOW, HIGH, "#c9ecd9", "Âm nghe được"],
      [HIGH, 1e5, "#e3dafd", "Siêu âm"],
    ];
    for (const [lo, hi, color, name] of zones) {
      ctx.fillStyle = color;
      ctx.fillRect(X(lo), barY, X(hi) - X(lo), barH);
      label(ctx, name, (X(lo) + X(hi)) / 2, barY + barH / 2, { size: g.small ? 10 : 12, align: "center", color: COLORS.ink });
    }
    for (const [hz, text] of [[LOW, "16 Hz"], [HIGH, "20 kHz"]]) {
      line(ctx, X(hz), barY, X(hz), barY + barH + 4, COLORS.ink, 1.5);
      label(ctx, text, X(hz), barY + barH + 11, { size: 11, align: "center", color: COLORS.muted });
    }
    const fx = X(f);
    ctx.fillStyle = clsColor;
    ctx.beginPath();
    ctx.moveTo(fx, barY + 2);
    ctx.lineTo(fx - 6, barY - 7);
    ctx.lineTo(fx + 6, barY - 7);
    ctx.closePath();
    ctx.fill();
    line(ctx, fx, barY, fx, barY + barH, clsColor, 3);
  },
});
