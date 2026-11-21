import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { K, HEIGHT, LIMITS, initialState, pressure, boxWidth, setMode, applyChange, syncParticles, step } from "./model.js";

const MAX_W = LIMITS.volume[1] / HEIGHT; // widest box, in length units
const ROD = 34; // px the piston rod sticks out of the cylinder
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'; // same as kit label()
/** label() that shrinks the font until the text fits in maxW. */
const fit = (ctx, text, x, y, maxW, opts) => {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: tw > maxW ? (opts.size * maxW) / tw : opts.size });
};

const MODES = {
  T: ["Đẳng nhiệt (T không đổi)", "Quá trình đẳng nhiệt: T không đổi ⟹ p·V = hằng số", "Nhiệt độ được giữ không đổi. Kéo pít-tông hoặc đổi V để xem p thay đổi."],
  V: ["Đẳng tích (V không đổi)", "Quá trình đẳng tích: V không đổi ⟹ p/T = hằng số", "Pít-tông được giữ cố định. Đổi T để xem p thay đổi."],
  P: ["Đẳng áp (p không đổi)", "Quá trình đẳng áp: p không đổi ⟹ V/T = hằng số", "Áp suất được giữ không đổi. Đổi T thì pít-tông tự dịch chuyển; đổi V thì T thay đổi theo."],
};

const layout = (s, view) => {
  const pad = 16;
  const top = 40;
  const bottomH = clamp(view.h * 0.25, 96, 140); // pressure bars
  const room = view.h - top - bottomH - 34; // 34 px for the N, T, V line under the box
  const scale = Math.min((view.w - 2 * pad - ROD) / MAX_W, room / HEIGHT);
  const x0 = (view.w - MAX_W * scale - ROD) / 2;
  const y0 = top + (room - HEIGHT * scale) / 2;
  return { pad, scale, x0, y0, px: x0 + boxWidth(s) * scale, boxH: HEIGHT * scale, bottomH };
};

const changed = key => (s, api) => {
  applyChange(s, key);
  api.sync();
};

// One result per finished change of N, T or V (slider released or piston let go).
const report = (s, api) =>
  api.emit("state-changed", { pressure: pressure(s), volume: s.volume, temperature: s.temperature, n: s.n }, "result");

mount({
  slug: "khi-ly-tuong",
  version: "1.0.0",
  title: "Khí lý tưởng",
  hint: "Chọn đại lượng được giữ không đổi, rồi thay đổi số hạt, nhiệt độ hoặc thể tích (kéo pít-tông).",
  initialState,
  step,
  autoplay: true,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Quá trình",
      options: Object.entries(MODES).map(([value, m]) => ({ value, label: m[0] })),
      onChange(s, api) {
        setMode(s, s.mode);
        api.sync();
      },
    },
    {
      // Explains the lock, and greys out the slider of the quantity that is held constant.
      type: "custom",
      render(box, api) {
        box.style.cssText = "font-size:13px;line-height:1.45;color:var(--muted)";
        return () => {
          const { mode } = api.state;
          box.textContent = MODES[mode][2];
          const sliders = document.querySelectorAll('.controls input[type="range"]'); // n, temperature, volume
          sliders[1].disabled = mode === "T";
          sliders[2].disabled = mode === "V";
        };
      },
    },
    { type: "slider", key: "n", label: "Số hạt N", min: LIMITS.n[0], max: LIMITS.n[1], step: 10, unit: "hạt", digits: 0, onChange: changed("n"), onCommit: report },
    { type: "slider", key: "temperature", label: "Nhiệt độ T", min: LIMITS.temperature[0], max: LIMITS.temperature[1], step: 10, unit: "K", digits: 0, onChange: changed("temperature"), onCommit: report },
    { type: "slider", key: "volume", label: "Thể tích V", min: LIMITS.volume[0], max: LIMITS.volume[1], step: 0.1, unit: "đv", digits: 1, onChange: changed("volume"), onCommit: report },
  ],
  readouts: [
    { label: "p = NkT/V", value: s => `${fmt(pressure(s), 1)} đv` },
    { label: "p đo từ va chạm", value: s => (s.measuredPressure ? `${fmt(s.measuredPressure, 1)} đv` : "–") },
    { label: "p·V", value: s => `${fmt(pressure(s) * s.volume, 0)} đv` },
    { label: "N·k·T (k = 0,01)", value: s => `${fmt(s.n * K * s.temperature, 0)} đv` },
    { label: "Động năng trung bình", value: s => `${fmt(K * s.temperature, 2)} đv` },
  ],
  pointer: {
    down(p, s, api, view) {
      const { px, y0, boxH } = layout(s, view);
      return s.mode !== "V" && Math.abs(p.x - px - 6) < 28 && p.y > y0 - 10 && p.y < y0 + boxH + 10;
    },
    move(p, s, api, view) {
      const { x0, scale } = layout(s, view);
      s.volume = clamp(Math.round(((p.x - 6 - x0) / scale) * HEIGHT * 10) / 10, ...LIMITS.volume);
      applyChange(s, "volume");
      api.sync();
    },
    up(p, s, api) {
      api.emit("param", { key: "volume", value: s.volume }, "param");
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const { w, h } = view;
    const { pad, scale, x0, y0, px, boxH, bottomH } = layout(s, view);
    const base = clamp(w / 52, 11, 15);
    const particles = syncParticles(s);
    const fullW = MAX_W * scale;

    fit(ctx, MODES[s.mode][1], w / 2, 20, w - 2 * pad, { size: base + 2, align: "center", bold: true });

    // cylinder and gas
    ctx.fillStyle = "#fff";
    ctx.fillRect(x0, y0, fullW, boxH);
    ctx.fillStyle = "#eaf1ff";
    ctx.fillRect(x0, y0, px - x0, boxH);

    // particles: blue when slow, red when fast
    const fast = 2 * Math.sqrt(2 * K * LIMITS.temperature[1]);
    const r = clamp(scale / 40, 2, 4);
    for (const q of particles) {
      const t = Math.min(1, Math.hypot(q.vx, q.vy) / fast);
      ctx.fillStyle = `rgb(${47 + 182 * t},${111 - 39 * t},${237 - 160 * t})`;
      ctx.beginPath();
      ctx.arc(clamp(x0 + q.x * scale, x0 + r, px - r), clamp(y0 + q.y * scale, y0 + r, y0 + boxH - r), r, 0, Math.PI * 2);
      ctx.fill();
    }

    // walls
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x0 + fullW + 12, y0 - 2);
    ctx.lineTo(x0 - 2, y0 - 2);
    ctx.lineTo(x0 - 2, y0 + boxH + 2);
    ctx.lineTo(x0 + fullW + 12, y0 + boxH + 2);
    ctx.stroke();

    // piston: head, rod, handle
    const locked = s.mode === "V";
    ctx.fillStyle = COLORS.muted;
    ctx.fillRect(px + 12, y0 + boxH / 2 - 4, x0 + fullW + ROD - 8 - (px + 12), 8);
    ctx.fillRect(x0 + fullW + ROD - 8, y0 + boxH / 2 - 22, 8, 44);
    ctx.fillStyle = locked ? COLORS.muted : COLORS.orange;
    ctx.fillRect(px, y0, 12, boxH);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const dy of [-8, 0, 8]) ctx.fillRect(px + 3, y0 + boxH / 2 + dy - 1, 6, 2);

    fit(ctx, `N = ${fmt(s.n, 0)} hạt   ·   T = ${fmt(s.temperature, 0)} K   ·   V = ${fmt(s.volume, 1)} đv`, w / 2, y0 + boxH + 22, w - 2 * pad, {
      size: base + 1,
      align: "center",
    });

    // pressure: equation of state against the collision gauge
    const p = pressure(s);
    const full = [100, 200, 400, 800].find(v => v >= Math.max(p, s.measuredPressure) * 1.05) ?? 800;
    const rowH = (bottomH - 12) / 2;
    const barH = clamp(rowH * 0.3, 8, 14);
    const barW = w - 2 * pad;
    [
      ["Áp suất theo phương trình trạng thái, p = NkT/V", p, COLORS.blue],
      ["Áp suất đo từ va chạm của các hạt với thành bình", s.measuredPressure, COLORS.orange],
    ].forEach(([name, value, color], i) => {
      const y = h - bottomH + 6 + i * rowH;
      const text = `${value ? fmt(value, 1) : "–"} đv`;
      label(ctx, text, w - pad, y + 8, { size: base + 1, align: "right", bold: true, color });
      fit(ctx, name, pad, y + 8, barW - 80, { size: base, color: COLORS.muted });
      ctx.fillStyle = COLORS.grid;
      ctx.beginPath();
      ctx.roundRect(pad, y + 22, barW, barH, barH / 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(pad, y + 22, Math.max(barH, barW * Math.min(1, value / full)), barH, barH / 2);
      ctx.fill();
    });
  },
});
