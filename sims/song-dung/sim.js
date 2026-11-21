import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import {
  L, MU, N, LIMITS, initialState, settled, rest, step, waveSpeed, wavelength, resonantFrequency,
  nearestHarmonic, harmonicNumber, nodePositions, antinodePositions, envelope,
} from "./model.js";

const F_MAX = LIMITS.frequency[1];
const range = key => ({ min: LIMITS[key][0], max: LIMITS[key][1] });

function nextHarmonic(s) {
  let n = 1;
  while (resonantFrequency(s, n) <= s.frequency + 1e-6) n++;
  if (resonantFrequency(s, n) > F_MAX) n = 1;
  s.frequency = resonantFrequency(s, n);
}

// Goal: the driving frequency has just been put on a resonance it was not on before.
// Checked only when an adjustment is finished, never while a slider is being dragged.
const report = (s, api) => {
  const n = harmonicNumber(s);
  if (n && n !== s._harmonic) api.emit("resonance", { harmonic: n, frequency: s.frequency, waveSpeed: waveSpeed(s) }, "goal");
  s._harmonic = n;
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

mount({
  slug: "song-dung",
  version: "1.0.0",
  title: "Sóng trên dây và sóng dừng",
  hint: "Đổi tần số của nguồn cho đến khi dây dao động mạnh nhất, với các nút và bụng rõ rệt.",
  initialState,
  step,
  autoplay: true,
  sanitize: incoming => settled(incoming),
  controls: [
    {
      type: "select",
      key: "endType",
      label: "Đầu dây bên phải",
      options: [
        { value: "fixed", label: "Cố định" },
        { value: "free", label: "Tự do" },
      ],
      onCommit: report,
    },
    { type: "slider", key: "frequency", label: "Tần số nguồn f", ...range("frequency"), step: 0.01, unit: "Hz", onCommit: report },
    { type: "slider", key: "amplitude", label: "Biên độ nguồn", ...range("amplitude"), step: 0.5, unit: "cm", digits: 1 },
    { type: "slider", key: "tension", label: "Lực căng dây T", ...range("tension"), step: 0.05, unit: "N", onCommit: report },
    { type: "slider", key: "damping", label: "Hệ số cản", ...range("damping"), step: 0.05, unit: "1/s" },
    { type: "checkbox", key: "showEnvelope", label: "Hiện đường bao biên độ" },
    { type: "button", label: "Họa âm kế tiếp", primary: true, action: (s, api) => (nextHarmonic(s), report(s, api)), event: "next-harmonic" },
    { type: "button", label: "Cho dây đứng yên rồi phát sóng lại", action: rest, event: "rest-string" },
  ],
  readouts: [
    { label: "Tốc độ truyền sóng v = √(T/μ)", value: s => `${fmt(waveSpeed(s))} m/s` },
    { label: "Bước sóng λ = v/f", value: s => `${fmt(wavelength(s))} m` },
    {
      label: "Tần số cộng hưởng gần nhất",
      value: s => `${fmt(resonantFrequency(s, nearestHarmonic(s)))} Hz`,
    },
    { label: "Sóng dừng", value: s => (harmonicNumber(s) ? `có, ${harmonicNumber(s)} bụng` : "chưa có") },
  ],
  draw(ctx, s, view) {
    const small = view.w < 520;
    const size = small ? 12 : 14;
    const x0 = small ? 40 : 70;
    const x1 = view.w - (small ? 28 : 54);
    const cy = view.h * 0.47;
    const avail = Math.min(view.h * 0.27, 190);
    const X = x => x0 + (x / L) * (x1 - x0);
    const free = s.endType === "free";
    const n = harmonicNumber(s);
    const lambda = wavelength(s);

    // vertical scale grows with the steady-state amplitude so a resonance always fits
    const env = Array.from({ length: N + 1 }, (_, j) => envelope(s, (j * L) / N));
    const maxEnv = Math.max(...env);
    const y = s._y ?? new Float64Array(N + 1);
    // ...and, with a slow release, any larger transient left over from the previous settings
    s._peak = Math.max(y.reduce((m, v) => Math.max(m, Math.abs(v)), 0), (s._peak || 0) * 0.995);
    // never zoom in closer than 4x the source amplitude, so a resonance visibly towers over the rest
    const sy = avail / (1.25 * Math.max(maxEnv, s._peak, 4 * s.amplitude));

    // caption
    if (n) {
      const order = free ? 2 * n - 1 : n;
      label(ctx, `Sóng dừng: họa âm bậc ${order}, f = ${order === 1 ? "" : order + "·"}v/${free ? 4 : 2}L`, 12, 18, { size, bold: true, color: COLORS.green });
      label(ctx, `${n} bụng (B), ${free ? n : n + 1} nút (N), kể cả đầu gắn với nguồn`, 12, 40, { size: size - 1, color: COLORS.muted });
    } else {
      label(ctx, "Chưa cộng hưởng: dây chỉ dao động với biên độ nhỏ", 12, 18, { size, bold: true });
      label(ctx, `Tần số cộng hưởng gần nhất: ${fmt(resonantFrequency(s, nearestHarmonic(s)))} Hz`, 12, 40, { size: size - 1, color: COLORS.muted });
    }

    // equilibrium line and amplitude guides
    line(ctx, x0, cy, x1, cy, COLORS.muted, 1, [6, 6]);
    for (const sign of [-1, 1]) line(ctx, x0, cy + sign * maxEnv * sy, x1, cy + sign * maxEnv * sy, COLORS.grid, 1.5);
    label(ctx, `Biên độ lớn nhất khi ổn định: ${fmt(maxEnv, 1)} cm`, x1 - (free ? 12 : 0), cy + maxEnv * sy + 13, { size: 12, align: "right", color: COLORS.muted });

    // steady-state envelope
    if (s.showEnvelope) {
      ctx.fillStyle = "rgba(47, 111, 237, 0.10)";
      ctx.strokeStyle = "rgba(47, 111, 237, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let j = 0; j <= N; j++) ctx.lineTo(X((j * L) / N), cy - env[j] * sy);
      for (let j = N; j >= 0; j--) ctx.lineTo(X((j * L) / N), cy + env[j] * sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // right end: wall (fixed) or ring sliding on a rod (free)
    const yEnd = cy - y[N] * sy;
    if (free) {
      line(ctx, x1, cy - avail - 8, x1, cy + avail + 8, COLORS.muted, 4);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x1, yEnd, 7, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = COLORS.muted;
      ctx.fillRect(x1, cy - 46, 10, 92);
    }
    label(ctx, free ? "Đầu tự do" : "Đầu cố định", x1 + 12, cy - avail - 22, { size: 12, align: "right", color: COLORS.muted });

    // source: a block moving up and down in a guide
    const ySrc = cy - y[0] * sy;
    line(ctx, x0 - 12, cy - 46, x0 - 12, cy + 46, COLORS.grid, 6);
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.roundRect(x0 - 24, ySrc - 11, 24, 22, 5);
    ctx.fill();
    label(ctx, "Nguồn", x0 - 26, cy + 60, { size: 12, color: COLORS.muted });

    // the string
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let j = 0; j <= N; j++) ctx.lineTo(X((j * L) / N), cy - y[j] * sy);
    ctx.stroke();

    // nodes and antinodes of the standing wave
    if (n) {
      const names = (x1 - x0) / n > 26;
      for (const x of nodePositions(s.endType, n)) {
        ctx.fillStyle = COLORS.red;
        ctx.beginPath();
        ctx.arc(X(x), cy, 5, 0, Math.PI * 2);
        ctx.fill();
        if (names) label(ctx, "N", X(x) + (x === 0 ? 9 : x === L ? -9 : 0), cy + 20, { size: 12, align: "center", color: COLORS.red, bold: true });
      }
      for (const x of antinodePositions(s.endType, n)) {
        const a = envelope(s, x) * sy;
        line(ctx, X(x), cy - a, X(x), cy + a, COLORS.green, 1.5, [3, 4]);
        if (names) label(ctx, "B", X(x) - (free && x === L ? 12 : 0), cy - a - 11, { size: 12, align: "center", color: COLORS.green, bold: true });
      }
    }

    // ruler and one wavelength
    const yr = cy + avail + 30;
    line(ctx, x0, yr, x1, yr, COLORS.muted);
    for (let x = 0; x <= L + 1e-9; x += 0.5) {
      line(ctx, X(x), yr - 4, X(x), yr + 4, COLORS.muted);
      label(ctx, `${fmt(x, 1)}${x === L ? " m" : ""}`, X(x), yr + 15, { size: 11, align: "center", color: COLORS.muted });
    }
    const yl = yr + 34;
    if (lambda <= L) {
      line(ctx, X(0), yl, X(lambda), yl, COLORS.orange, 3);
      line(ctx, X(0), yl - 6, X(0), yl + 6, COLORS.orange, 3);
      line(ctx, X(lambda), yl - 6, X(lambda), yl + 6, COLORS.orange, 3);
    }
    label(ctx, `λ = ${fmt(lambda)} m${lambda > L ? " (dài hơn dây)" : ""}`, x0, yl + 17, { size: 13, color: COLORS.orange, bold: true });
    label(ctx, `L = ${fmt(L)} m, μ = ${fmt(MU)} kg/m`, x1, yl + 17, { size: 12, align: "right", color: COLORS.muted });
  },
});
