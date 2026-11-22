import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import {
  V0, V_MIN, MAX_PARTICLES, C_IN0, initialState, particles, restartMembrane, stepMembrane, waterFlow, conc,
  restartCell, stepCell, cellRate, cellInside, tonicity, reached, tidy,
} from "./model.js";

const WATER = "rgba(120, 180, 240, 0.35)";
const TONICITY = { isotonic: "đẳng trương", hypotonic: "nhược trương", hypertonic: "ưu trương" };
const OUTCOME = {
  rbc: { same: "Giữ nguyên hình dạng", swell: "Trương nước, to ra", burst: "Trương nước rồi vỡ (tan máu)", shrink: "Mất nước, teo lại, nhăn nheo" },
  plant: { same: "Giữ nguyên", swell: "Trương nước, thành tế bào giữ không cho vỡ", burst: "Vỡ", shrink: "Mất nước, co nguyên sinh" },
};
const PREDICT = [
  { value: "", label: "— chưa dự đoán —" },
  { value: "same", label: "Không thay đổi" },
  { value: "swell", label: "Trương nước nhưng không vỡ" },
  { value: "burst", label: "Trương nước rồi vỡ" },
  { value: "shrink", label: "Mất nước, co lại (co nguyên sinh)" },
];

const isMembrane = s => s.scene === "membrane";
const isCell = s => s.scene === "cell";

function fitSize(ctx, text, max, size, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = ctx.measureText(text).width;
  return w > max ? Math.max(9, (size * max) / w) : size;
}
const line = (ctx, text, x, y, max, opts) => label(ctx, text, x, y, { ...opts, size: fitSize(ctx, text, max, opts.size, opts.bold) });

function drawMembraneScene(ctx, s, view) {
  const small = view.w < 520 || view.h < 420;
  const size = small ? 12 : 14;
  const top = small ? 44 : 62;
  const bottom = small ? 34 : 44;
  const bw = Math.min(view.w - 24, 720);
  const bh = Math.max(80, view.h - top - bottom);
  const x0 = (view.w - bw) / 2;
  const yb = top + bh; // container floor
  const full = 2 * V0 - V_MIN; // mL that fill the container to its rim
  const level = v => (v / full) * bh;
  const half = bw / 2;

  // liquid
  ctx.fillStyle = WATER;
  ctx.fillRect(x0, yb - level(s.vL), half, level(s.vL));
  ctx.fillRect(x0 + half, yb - level(s.vR), half, level(s.vR));
  // container
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, top);
  ctx.lineTo(x0, yb);
  ctx.lineTo(x0 + bw, yb);
  ctx.lineTo(x0 + bw, top);
  ctx.stroke();
  // start level, for comparison
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, yb - level(V0));
  ctx.lineTo(x0 + bw, yb - level(V0));
  ctx.stroke();
  // membrane: fine dashes = small pores (semi-permeable), wide gaps = large pores
  const semi = s.membrane === "semi";
  ctx.setLineDash(semi ? [3, 3] : [6, 9]);
  ctx.strokeStyle = COLORS.purple;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x0 + half, top);
  ctx.lineTo(x0 + half, yb);
  ctx.stroke();
  ctx.setLineDash([]);

  // solute particles
  const r = small ? 3.5 : 4.5;
  ctx.fillStyle = COLORS.orange;
  for (const p of particles(s)) {
    const h = level(p.x < 1 ? s.vL : s.vR);
    ctx.beginPath();
    ctx.arc(x0 + p.x * half, yb - p.y * h, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // net flows across the membrane
  const J = waterFlow(s);
  const my = yb - Math.min(level(s.vL), level(s.vR)) * 0.5;
  if (Math.abs(J) > 0.01) {
    const len = Math.min(half * 0.6, 20 + Math.abs(J) * 120) * Math.sign(J);
    arrow(ctx, x0 + half - len / 2, my, x0 + half + len / 2, my, COLORS.blue, 3);
    label(ctx, "nước", x0 + half + len / 2 + (J > 0 ? 6 : -6), my - 12, { color: COLORS.blue, bold: true, size: size - 1, align: J > 0 ? "left" : "right" });
  }
  const f = s._flux ?? 0;
  if (!semi && Math.abs(f) > 0.3) {
    const len = Math.min(half * 0.6, 20 + Math.abs(f) * 12) * Math.sign(f);
    const fy = my + 26;
    arrow(ctx, x0 + half - len / 2, fy, x0 + half + len / 2, fy, COLORS.orange, 3);
    label(ctx, "chất tan", x0 + half + len / 2 + (f > 0 ? 6 : -6), fy + 12, { color: COLORS.orange, bold: true, size: size - 1, align: f > 0 ? "left" : "right" });
  }

  // numbers above each side
  for (const [side, n, v] of [[0, s.nL, s.vL], [1, s.nR, s.vR]]) {
    const cx = x0 + half * (side + 0.5);
    line(ctx, `C = ${fmt(conc(n, v), 2)} hạt/mL`, cx, top - (small ? 26 : 36), half - 8, { align: "center", bold: true, size });
    line(ctx, `${n} hạt · V = ${fmt(v, 1)} mL`, cx, top - (small ? 11 : 15), half - 8, { align: "center", color: COLORS.muted, size: size - 1 });
  }

  // status / convention
  const msg = s.equilibrium
    ? `Cân bằng sau ${fmt(s.eqTime, 1)} s: ${semi ? "nước ngừng di chuyển, mực chất lỏng chênh lệch" : "nồng độ hai bên bằng nhau"}`
    : semi
      ? "Màng bán thấm: chỉ nước đi qua, sang bên có nồng độ chất tan cao hơn"
      : "Màng thấm: chất tan khuếch tán từ nơi nồng độ cao sang nơi thấp";
  line(ctx, msg, view.w / 2, view.h - bottom * 0.62, view.w - 16, { align: "center", bold: s.equilibrium, size: size - 1, color: s.equilibrium ? COLORS.green : COLORS.ink });
  line(ctx, "● chất tan (mô hình, không theo tỉ lệ) · nét đứt xám: mực ban đầu", view.w / 2, view.h - bottom * 0.22, view.w - 16, { align: "center", color: COLORS.muted, size: size - 2 });
}

const DOTS = 120; // solute dots per % over the whole frame
// fixed pseudo-random spots for the solute dots
const hash = n => {
  let t = Math.imul(n, 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const spot = i => [hash(2 * i), hash(2 * i + 1)];

function drawCellScene(ctx, s, view) {
  const small = view.w < 520 || view.h < 420;
  const size = small ? 12 : 14;
  const top = small ? 40 : 56;
  const bottom = small ? 40 : 52;
  const W = view.w - 16;
  const H = view.h - top - bottom;
  const cx = view.w / 2;
  const cy = top + H / 2;
  const R = Math.max(24, Math.min(W, H) * 0.3); // radius of the cell at its starting volume

  // outside solution and its solute
  ctx.fillStyle = WATER;
  ctx.fillRect(8, top, W, H);
  const count = Math.round(s.outside * DOTS);
  ctx.fillStyle = COLORS.orange;
  for (let i = 0; i < count; i++) {
    const [u, v] = spot(i + 1);
    const x = 12 + u * (W - 8);
    const y = top + 4 + v * (H - 8);
    if (Math.hypot(x - cx, y - cy) < R * 1.45) continue;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const k = Math.sqrt(s.volume); // drawn area follows the volume
  if (s.cell === "rbc") {
    if (s.burst) {
      ctx.fillStyle = "rgba(229, 72, 77, 0.18)";
      ctx.beginPath();
      ctx.arc(cx, cy, R * k * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, R * k, a + 0.25, a + 0.75);
        ctx.stroke();
      }
    } else {
      // a shrunken red blood cell gets a crenated (spiky) edge
      const spikes = s.volume < 0.97 ? Math.min(1, (1 - s.volume) * 2.5) : 0;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * Math.PI * 2;
        const rr = R * k * (1 + spikes * 0.12 * Math.max(0, Math.sin(a * 14)) ** 3);
        ctx[i ? "lineTo" : "moveTo"](cx + rr * Math.cos(a), cy + rr * Math.sin(a));
      }
      ctx.fillStyle = "#e5484d";
      ctx.fill();
      ctx.strokeStyle = "#a52a2e";
      ctx.lineWidth = 2;
      ctx.stroke();
      // pale centre of the biconcave disc, filled in as the cell swells
      ctx.fillStyle = `rgba(255, 200, 200, ${Math.max(0, 0.7 - (s.volume - 1) * 1.2)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, R * k * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // cell wall stays put; the protoplast (membrane + cytoplasm) shrinks away from it in plasmolysis
    const w = R * 2.2;
    const h = R * 1.6;
    const q = Math.min(1, k);
    ctx.fillStyle = "rgba(120, 190, 90, 0.18)";
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.fillStyle = "#cfe8b8";
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 2;
    const pw = (w - 8) * q;
    const ph = (h - 8) * q;
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, 14 * q);
    ctx.fill();
    ctx.stroke();
    // central vacuole
    ctx.fillStyle = "rgba(170, 210, 250, 0.9)";
    ctx.beginPath();
    ctx.roundRect(cx - pw * 0.32, cy - ph * 0.3, pw * 0.64, ph * 0.6, 10 * q);
    ctx.fill();
    // chloroplasts along the edge
    ctx.fillStyle = "#2e8b3a";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * pw * 0.41, cy + Math.sin(a) * ph * 0.38, 6 * q + 2, 3.5 * q + 1, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#3f6f2a";
    ctx.lineWidth = s.volume > 1.005 ? 7 : 5; // a turgid cell presses on its wall
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  }

  // solute inside the cell: the same dots per area as outside at 0,9 %, and they never leave,
  // so they crowd together as the cell loses water and spread out as it swells
  if (!s.burst) {
    const inside = Math.round((C_IN0 * DOTS * Math.PI * R * R) / (W * H));
    ctx.fillStyle = s.cell === "rbc" ? "#ffe3b8" : COLORS.orange;
    for (let i = 0; i < inside; i++) {
      const [u, v] = spot(i + 501);
      const q = Math.min(1, k);
      const [x, y] = s.cell === "rbc"
        ? [cx + R * k * 0.88 * Math.sqrt(u) * Math.cos(v * 2 * Math.PI), cy + R * k * 0.88 * Math.sqrt(u) * Math.sin(v * 2 * Math.PI)]
        : [cx + (u - 0.5) * (R * 2.2 - 8) * q * 0.9, cy + (v - 0.5) * (R * 1.6 - 8) * q * 0.9];
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // water flow through the membrane
  const rate = s.cellDone ? 0 : cellRate(s);
  if (Math.abs(rate) > 0.004) {
    const inward = rate > 0;
    const r0 = R * 1.25;
    const r1 = R * (s.cell === "plant" ? 0.7 : 0.75) * Math.min(1.2, k);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const [ox, oy] = [cx + Math.cos(a) * r0 * 1.15, cy + Math.sin(a) * r0 * 0.9];
      const [ix, iy] = [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8];
      inward ? arrow(ctx, ox, oy, ix, iy, COLORS.blue, 3) : arrow(ctx, ix, iy, ox, oy, COLORS.blue, 3);
    }
  }

  const t = tonicity(s.outside);
  line(ctx, `${s.burst ? "Hồng cầu đã vỡ" : `Trong tế bào ${fmt(cellInside(s), 2)} %`} · ngoài ${fmt(s.outside, 2)} % → môi trường ${TONICITY[t]}`, view.w / 2, top / 2, view.w - 16, { align: "center", bold: true, size });
  let msg;
  if (s.cellDone) {
    const got = reached(s);
    msg = `Kết quả: ${OUTCOME[s.cell][got]}`;
    if (s.prediction) msg += s.prediction === got ? " · Dự đoán đúng!" : " · Dự đoán chưa đúng";
  } else {
    msg = s.prediction ? "Bấm ▶ Chạy để kiểm tra dự đoán" : "Hãy dự đoán điều xảy ra với tế bào, rồi bấm ▶ Chạy";
  }
  line(ctx, msg, view.w / 2, view.h - bottom * 0.62, view.w - 16, {
    align: "center",
    bold: s.cellDone,
    size: size - 1,
    color: s.cellDone && s.prediction ? (s.prediction === reached(s) ? COLORS.green : COLORS.red) : COLORS.ink,
  });
  line(ctx, "Mũi tên: dòng nước qua màng · chấm: hạt chất tan (không theo tỉ lệ)", view.w / 2, view.h - bottom * 0.22, view.w - 16, { align: "center", color: COLORS.muted, size: size - 2 });
}

mount({
  slug: "khuech-tan-tham-thau",
  version: "1.0.0",
  title: "Khuếch tán và thẩm thấu",
  hint: "Chọn loại màng và số hạt chất tan mỗi bên, hoặc đặt một tế bào vào dung dịch, rồi bấm ▶ Chạy.",
  initialState,
  timeScale: s => (isMembrane(s) ? 2 : 1),
  step(s, dt, api) {
    if (isMembrane(s)) {
      if (stepMembrane(s, dt)) {
        api.emit("equilibrium", { time: s.eqTime, cLeft: conc(s.nL, s.vL), cRight: conc(s.nR, s.vR), vLeft: s.vL, vRight: s.vR }, "result");
      }
      return;
    }
    if (s.cellDone) {
      if (s._ended) return; // finished in this very batch of steps: stay there until it has been drawn
      restartCell(s); // ▶ Chạy on a finished run puts a fresh cell in the solution
    }
    if (stepCell(s, dt)) {
      s._ended = true;
      api.pause();
      api.emit("cell-settled", { time: s.time, inside: cellInside(s), outside: s.outside, volume: s.volume, burst: s.burst ? 1 : 0 }, "result");
      if (s.prediction && s.prediction === reached(s)) {
        api.emit("prediction-correct", { outside: s.outside, plant: s.cell === "plant" ? 1 : 0 }, "goal");
      }
    }
  },
  controls: [
    {
      type: "select",
      key: "scene",
      label: "Thí nghiệm",
      options: [
        { value: "membrane", label: "Hai dung dịch ngăn bởi một màng" },
        { value: "cell", label: "Tế bào trong dung dịch" },
      ],
      onChange: s => (restartMembrane(s), restartCell(s)),
    },
    {
      type: "select",
      key: "membrane",
      label: "Loại màng",
      options: [
        { value: "semi", label: "Màng bán thấm (chỉ cho nước đi qua)" },
        { value: "permeable", label: "Màng thấm (cho nước và chất tan đi qua)" },
      ],
      visible: isMembrane,
      onChange: restartMembrane,
    },
    { type: "slider", key: "left0", label: "Số hạt chất tan bên trái", min: 0, max: MAX_PARTICLES, step: 1, digits: 0, visible: isMembrane, onChange: restartMembrane },
    { type: "slider", key: "right0", label: "Số hạt chất tan bên phải", min: 0, max: MAX_PARTICLES, step: 1, digits: 0, visible: isMembrane, onChange: restartMembrane },
    {
      type: "select",
      key: "cell",
      label: "Tế bào",
      options: [
        { value: "rbc", label: "Hồng cầu (tế bào động vật)" },
        { value: "plant", label: "Tế bào thực vật" },
      ],
      visible: isCell,
      onChange: restartCell,
    },
    {
      type: "slider",
      key: "outside",
      label: "Nồng độ chất tan bên ngoài",
      min: 0,
      max: 3,
      step: 0.05,
      visible: isCell,
      onChange: restartCell,
      format: v => `${fmt(v, 2)} % (${TONICITY[tonicity(v)]})`,
    },
    { type: "select", key: "prediction", label: "Dự đoán của em", options: PREDICT, visible: isCell, onChange: restartCell },
  ],
  readouts: [
    { label: "Thời gian", value: s => `${fmt(s.time, 1)} s` },
    { label: "Nồng độ trái | phải", value: s => (isMembrane(s) ? `${fmt(conc(s.nL, s.vL), 2)} | ${fmt(conc(s.nR, s.vR), 2)} hạt/mL` : "–") },
    { label: "Thể tích tế bào", value: s => (isCell(s) ? `${fmt(s.volume * 100, 0)} % ban đầu` : "–") },
  ],
  // rng, counts, volumes and the cell volume have no control: clamp them in the model
  sanitize(incoming, base) {
    const out = {};
    for (const key of Object.keys(base)) {
      const v = incoming[key];
      if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) out[key] = v;
    }
    const s = tidy({ ...base, ...out });
    // a state that sets the start values but not the running ones starts the run afresh
    if (!("nL" in out)) restartMembrane(s);
    if (!("volume" in out)) restartCell(s);
    return s;
  },
  draw(ctx, s, view) {
    s._ended = false;
    if (isMembrane(s)) drawMembraneScene(ctx, s, view);
    else drawCellScene(ctx, s, view);
  },
});

