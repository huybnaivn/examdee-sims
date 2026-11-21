import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, frequency, omega, period, fluxMax, E0, Eeff, flux, emf, output, coilAngle } from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const COPPER = "#c8742a";
const SHOWN_REV = 0.5; // rev/s on screen: the rotation is slowed down to this

function fit(ctx, text, maxW, size, bold) {
  let sz = size;
  const set = () => (ctx.font = `${bold ? "600 " : ""}${sz}px ${FONT}`);
  set();
  while (sz > 8 && ctx.measureText(text).width > maxW) {
    sz--;
    set();
  }
  return sz;
}
const line = (ctx, text, x, y, maxW, size, opts = {}) => label(ctx, text, x, y, { ...opts, size: fit(ctx, text, maxW, size, opts.bold) });
const v = (x, d = 1) => `${fmt(x, d)} V`;

function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const pad = small ? 8 : 18;
  const gh = small ? clamp(view.h * 0.3, 80, 110) : clamp(view.h * 0.3, 120, 200);
  const graph = { x0: pad + (small ? 30 : 48), x1: view.w - pad, y1: view.h - (small ? 18 : 26) };
  graph.y0 = graph.y1 - gh;
  const top = small ? 40 : 60;
  const sceneB = graph.y0 - (small ? 16 : 26);
  const split = view.w * (small ? 0.6 : 0.62);
  const R = Math.max(20, Math.min((sceneB - top) * 0.36, split * 0.24));
  return { small, pad, graph, top, sceneB, split, R, cx: split / 2, cy: (top + sceneB) / 2 };
}

function sideMark(ctx, x, y, r, out) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  if (out) {
    ctx.fillStyle = COLORS.red;
    ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const k = r * 0.6;
    ctx.moveTo(x - k, y - k);
    ctx.lineTo(x + k, y + k);
    ctx.moveTo(x + k, y - k);
    ctx.lineTo(x - k, y + k);
    ctx.stroke();
  }
}

function drawGenerator(ctx, s, g) {
  const { cx, cy, R, small } = g;
  const size = small ? 11 : 14;
  if (s.p === 1) {
    // two pole pieces with a uniform field between them, N on the left
    const mw = R * 0.45;
    const mh = R * 2.3;
    const gap = R * 1.12;
    for (const [x, c, t] of [[cx - gap - mw, COLORS.red, "N"], [cx + gap, COLORS.blue, "S"]]) {
      ctx.fillStyle = c;
      ctx.fillRect(x, cy - mh / 2, mw, mh);
      label(ctx, t, x + mw / 2, cy, { color: "#fff", bold: true, size: size + 2, align: "center" });
    }
    for (let i = -2; i <= 2; i++) {
      const y = cy + (i * mh) / 5.4;
      arrow(ctx, cx - gap + 2, y, cx + gap - 2, y, "rgba(31, 157, 107, 0.45)", 1.5);
    }
    label(ctx, "B", cx + gap - 10, cy - mh / 2 + size * 0.2, { color: COLORS.green, bold: true, size, align: "center" });
  } else {
    // 2p poles around the coil, alternating; S at angle 0
    for (let k = 0; k < 2 * s.p; k++) {
      const a = (k * Math.PI) / s.p;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * R * 1.35, cy - Math.sin(a) * R * 1.35);
      ctx.rotate(-a);
      ctx.fillStyle = k % 2 ? COLORS.red : COLORS.blue;
      ctx.fillRect(-R * 0.18, -R * 0.32, R * 0.36, R * 0.64);
      ctx.restore();
      label(ctx, k % 2 ? "N" : "S", cx + Math.cos(a) * R * 1.35, cy - Math.sin(a) * R * 1.35, { color: "#fff", bold: true, size: size - 1, align: "center" });
    }
  }
  // coil seen edge-on: side A at P, side B opposite; normal n
  const th = coilAngle(s);
  const r = R * 0.82;
  const px = cx - r * Math.sin(th);
  const py = cy - r * Math.cos(th);
  const qx = 2 * cx - px;
  const qy = 2 * cy - py;
  ctx.strokeStyle = COPPER;
  ctx.lineWidth = small ? 5 : 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(qx, qy);
  ctx.stroke();
  ctx.lineCap = "butt";
  arrow(ctx, cx, cy, cx + R * 0.75 * Math.cos(th), cy - R * 0.75 * Math.sin(th), COLORS.purple, 2.5);
  label(ctx, "n", cx + R * 0.92 * Math.cos(th), cy - R * 0.92 * Math.sin(th), { color: COLORS.purple, bold: true, size, align: "center" });
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  const e = emf(s);
  if (Math.abs(e) > E0(s) * 0.03) {
    const mr = small ? 6 : 8;
    sideMark(ctx, px, py, mr, e > 0);
    sideMark(ctx, qx, qy, mr, e < 0);
  }
  // direction of rotation
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.02, -Math.PI * 0.62, -Math.PI * 0.38);
  ctx.stroke();
  const ea = -Math.PI * 0.62;
  arrow(ctx, cx + R * 1.02 * Math.cos(ea + 0.2), cy + R * 1.02 * Math.sin(ea + 0.2), cx + R * 1.02 * Math.cos(ea), cy + R * 1.02 * Math.sin(ea), COLORS.ink, 1.5);
}

function drawLamp(ctx, s, g, view) {
  const x = (g.split + view.w) / 2;
  const size = g.small ? 11 : 14;
  const rb = clamp((g.sceneB - g.top) * 0.16, 12, 34);
  const y = g.top + rb * 1.6;
  const k = Math.abs(output(s)) / E0(s); // brightness follows |e|
  const glow = ctx.createRadialGradient(x, y, rb * 0.2, x, y, rb * 2.4);
  glow.addColorStop(0, `rgba(255, 214, 64, ${0.85 * k})`);
  glow.addColorStop(1, "rgba(255, 214, 64, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, rb * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgb(${Math.round(235 + 20 * k)}, ${Math.round(238 - 10 * k)}, ${Math.round(242 - 170 * k)})`;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, rb, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.muted;
  ctx.fillRect(x - rb * 0.45, y + rb * 0.9, rb * 0.9, rb * 0.6);
  const w = view.w - g.split - 8;
  let ty = y + rb * 1.5 + size * 1.2;
  line(ctx, `${s.dc ? "u" : "e"} = ${v(output(s))}`, x, ty, w, size + 1, { align: "center", bold: true, color: COLORS.blue });
  ty += size * 1.5;
  line(ctx, s.dc ? "Cổ góp: dòng một chiều" : "Vành khuyên: dòng xoay chiều", x, ty, w, size, { align: "center", bold: true });
  ty += size * 1.4;
  line(ctx, "Độ sáng của đèn theo |e|", x, ty, w, size - 1, { align: "center", color: COLORS.muted });
  if (!g.small) {
    ty += size * 1.6;
    line(ctx, "⊙ dòng điện đi ra, ⊗ đi vào mặt hình", x, ty, w, size - 1, { align: "center", color: COLORS.red });
  }
}

function drawGraph(ctx, s, g) {
  const { x0, x1, y0, y1 } = g.graph;
  const size = g.small ? 10 : 12;
  const ym = (y0 + y1) / 2;
  const amp = (y1 - y0) / 2 - 6;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  const T = period(s);
  const span = 2 * T;
  const tx = t => x1 - ((s.t - t) / span) * (x1 - x0);
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    ctx.moveTo(x0 + ((x1 - x0) * i) / 4, y0);
    ctx.lineTo(x0 + ((x1 - x0) * i) / 4, y1);
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(x0, ym);
  ctx.lineTo(x1, ym);
  ctx.stroke();
  // effective value
  const ye = ym - amp / Math.SQRT2;
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = COLORS.orange;
  ctx.beginPath();
  ctx.moveTo(x0, ye);
  ctx.lineTo(x1, ye);
  ctx.stroke();
  ctx.setLineDash([]);
  const curve = (f, scale, color, width, dash) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const t = s.t - span + (span * i) / 200;
      const y = ym - (f(s, t) / scale) * amp;
      if (i) ctx.lineTo(tx(t), y);
      else ctx.moveTo(tx(t), y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  curve(flux, fluxMax(s), COLORS.green, 1.5, [6, 4]);
  if (s.dc) curve(emf, E0(s), "rgba(47, 111, 237, 0.3)", 1.5);
  curve(output, E0(s), COLORS.blue, 2.5);
  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.arc(x1, ym - (output(s) / E0(s)) * amp, 4, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, fmt(E0(s), 1), x0 - 4, ym - amp, { size, align: "right", color: COLORS.blue });
  label(ctx, "0", x0 - 4, ym, { size, align: "right", color: COLORS.muted });
  label(ctx, fmt(-E0(s), 1), x0 - 4, ym + amp, { size, align: "right", color: COLORS.blue });
  ctx.font = `${size}px ${FONT}`;
  const lw = ctx.measureText("E = E₀/√2").width + 6;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(x0 + 2, ye + 2, lw, size + 4);
  label(ctx, "E = E₀/√2", x0 + 5, ye + size * 0.5 + 4, { size, color: COLORS.orange });
  const head = g.small ? `${s.dc ? "u" : "e"} (V), Φ (nét đứt, thang riêng)` : `${s.dc ? "u ra (V), mờ: e của khung" : "e (V)"} · Φ (nét đứt xanh lá, thang riêng)`;
  line(ctx, head, x0, y0 - size * 0.8, (x1 - x0) * 0.62, size + 1, { bold: true, color: COLORS.blue });
  line(ctx, `2 chu kì gần nhất, T = ${fmt(T * 1000, 2)} ms`, x1, y0 - size * 0.8, (x1 - x0) * 0.36, size, { align: "right", color: COLORS.muted });
}

const commit = (s, api) => api.emit("generator-set", { E0: E0(s), Eeff: Eeff(s), f: frequency(s), dc: s.dc ? 1 : 0 }, "result");

mount({
  slug: "may-phat-dien",
  version: "1.0.0",
  title: "Máy phát điện xoay chiều",
  hint: "Khung dây quay đều trong từ trường đều. Thay đổi số vòng, diện tích, cảm ứng từ và tốc độ quay để thấy suất điện động thay đổi; bật cổ góp để so sánh với máy phát điện một chiều.",
  initialState,
  autoplay: true,
  timeScale: s => SHOWN_REV / s.n,
  step: (s, dt) => step(s, dt),
  controls: [
    { type: "heading", label: "Khung dây" },
    { type: "slider", key: "turns", label: "Số vòng dây N", min: 10, max: 500, step: 10, unit: "vòng", digits: 0, onCommit: commit },
    { type: "slider", key: "area", label: "Diện tích mỗi vòng S", min: 50, max: 500, step: 10, unit: "cm²", digits: 0, onCommit: commit },
    { type: "heading", label: "Từ trường và chuyển động quay" },
    { type: "slider", key: "B", label: "Cảm ứng từ B", min: 0.05, max: 1, step: 0.05, unit: "T", digits: 2, onCommit: commit },
    { type: "slider", key: "n", label: "Tốc độ quay n", min: 1, max: 60, step: 1, format: v => `${fmt(v, 0)} vòng/s (${fmt(v * 60, 0)} vòng/phút)`, onCommit: commit },
    { type: "stepper", key: "p", label: "Số cặp cực p", min: 1, max: 4, onCommit: commit },
    { type: "slider", key: "phase", label: "Pha ban đầu φ", min: 0, max: 360, step: 15, unit: "°", digits: 0, onCommit: commit },
    { type: "checkbox", key: "dc", label: "Dùng cổ góp (máy phát điện một chiều)", onCommit: commit },
  ],
  readouts: [
    { label: "Từ thông cực đại Φ₀ = NBS", value: s => `${fmt(fluxMax(s), 4)} Wb` },
    { label: "Tần số f = n·p", value: s => `${fmt(frequency(s), 1)} Hz` },
    { label: "Tần số góc ω = 2πf", value: s => `${fmt(omega(s), 1)} rad/s` },
    { label: "E₀ = NBSω", value: s => v(E0(s), 2) },
    { label: "Giá trị hiệu dụng E = E₀/√2", value: s => v(Eeff(s), 2) },
    { label: "Từ thông Φ lúc này", value: s => `${fmt(flux(s), 4)} Wb` },
    { label: "Suất điện động e lúc này", value: s => v(emf(s), 1) },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    const size = g.small ? 12 : 15;
    const W = view.w - 2 * g.pad;
    const ph = s.phase ? ` + ${fmt((s.phase * Math.PI) / 180, 2)}` : "";
    line(ctx, `e = E₀·sin(ωt + φ) = ${fmt(E0(s), 1)}·sin(${fmt(omega(s), 1)}t${ph}) (V)`, g.pad, g.small ? 11 : 20, W, size, { bold: true, color: COLORS.blue });
    line(ctx, `E₀ = NBSω = ${fmt(s.turns, 0)} × ${fmt(s.B, 2)} × ${fmt(s.area * 1e-4, 4)} × ${fmt(omega(s), 1)} · E = ${v(Eeff(s), 1)} · f = n·p = ${fmt(frequency(s), 1)} Hz`, g.pad, g.small ? 27 : 42, W, size - 2, { color: COLORS.ink });
    drawGenerator(ctx, s, g);
    drawLamp(ctx, s, g, view);
    drawGraph(ctx, s, g);
    const slow = s.n / SHOWN_REV;
    const note = g.small
      ? `Làm chậm ×${fmt(slow, 0)}; hình không theo tỉ lệ`
      : `Chuyển động quay được làm chậm ×${fmt(slow, 0)}. Nhìn dọc trục quay; hình không theo tỉ lệ.${s.p > 1 ? " Với p > 1 chỉ minh họa vị trí các cực." : ""}`;
    line(ctx, note, view.w / 2, view.h - (g.small ? 7 : 10), view.w - 16, g.small ? 10 : 12, { align: "center", color: COLORS.muted });
  },
});
