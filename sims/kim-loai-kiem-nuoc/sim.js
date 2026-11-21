import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { METALS, VM, RANK_OPTIONS, RANK_ANSWER, initialState, step, metal, equation, base, amounts, extent, sub } from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const FALL = 0.12; // share of the animation spent dropping the piece in

const rnd = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function wrap(ctx, text, maxW, size, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 8 : 20;
  const textH = Math.round(Math.min(view.h * (small ? 0.4 : 0.34), small ? 132 : 180));
  const meterY = small ? 12 : 26;
  const hang = meterY + (small ? 34 : 56); // the piece waits here, under the meter
  const top = hang + (small ? 14 : 24);
  let bottom = view.h - textH - (small ? 6 : 16);
  const bw = Math.min(view.w * (small ? 0.5 : 0.55), 300, (bottom - top) * 1.5);
  bottom = Math.min(bottom, top + bw * 1.05); // no taller than it is wide; the text moves up
  const bx = (view.w - bw) / 2;
  return { small, pad, textH, meterY, hang, top, bottom, bw, bx, liquid: top + (bottom - top) * 0.3 };
}

function drawMeter(ctx, s, g, view) {
  const m = metal(s.metal);
  const w = Math.min(view.w - 2 * g.pad, 320);
  const x = (view.w - w) / 2;
  const h = g.small ? 8 : 10;
  label(ctx, g.small ? "Mức độ phản ứng với nước lạnh (định tính)" : "Mức độ phản ứng với nước lạnh (thang định tính, không phải số đo)", view.w / 2, g.meterY, { size: g.small ? 10 : 12, align: "center", color: COLORS.muted });
  const y = g.meterY + (g.small ? 10 : 14);
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(x, y, w, h);
  if (s.dropped) {
    ctx.fillStyle = m.vigour > 0.8 ? COLORS.red : m.vigour > 0.5 ? COLORS.orange : COLORS.yellow;
    ctx.fillRect(x, y, Math.max(3, w * m.vigour), h);
    label(ctx, m.sym, x + Math.max(3, w * m.vigour) + 6, y + h / 2, { size: 11, bold: true });
  } else label(ctx, "thả kim loại để xem", view.w / 2, y + h / 2, { size: 10, align: "center", color: COLORS.muted });
}

function drawBeaker(ctx, s, g) {
  const m = metal(s.metal);
  const p = s.dropped ? clamp(s.progress, 0, 1) : 0; // progress has no control: clamp a forged value
  const k = clamp((p - FALL) / (1 - FALL), 0, 1) * extent(s.metal); // share reacted so far
  const { bx, bw, top, bottom, liquid } = g;
  const floats = m.density < 1;

  // water + phenolphthalein, turning pink as base forms
  ctx.fillStyle = "rgba(205, 225, 245, 0.45)";
  ctx.fillRect(bx, liquid, bw, bottom - liquid);
  if (k > 0) {
    ctx.fillStyle = `rgba(236, 72, 153, ${0.5 * k})`;
    ctx.fillRect(bx, liquid, bw, bottom - liquid);
    if (m.sym === "Ca") {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * k})`; // Ca(OH)₂ is only slightly soluble
      ctx.fillRect(bx, liquid, bw, bottom - liquid);
    }
  }

  // the piece
  const base0 = (g.small ? 14 : 22) * Math.cbrt(clamp(s.mass, 0.01, 2) / 0.23);
  const size = Math.max(0, base0 * (1 - 0.92 * k));
  const fall = s.dropped ? 1 - (1 - Math.min(1, p / FALL)) ** 2 : 0;
  const hang = g.hang;
  const rest = floats ? liquid - size * 0.25 : bottom - size * 0.4 - 4;
  const dart = floats && k > 0 && k < 1 ? m.vigour * bw * 0.32 : 0;
  const x = bx + bw / 2 + Math.sin(p * 31) * dart;
  const y = hang + (rest - hang) * fall;
  const melted = (m.sym === "Na" || m.sym === "K") && k > 0;
  if (m.sym === "K" && k > 0 && k < 1) {
    const glow = ctx.createRadialGradient(x, y - size, 1, x, y - size, size * 2 + 10);
    glow.addColorStop(0, "rgba(176, 120, 235, 0.8)");
    glow.addColorStop(1, "rgba(176, 120, 235, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - size, size * 2 + 10, 0, Math.PI * 2);
    ctx.fill();
  }
  if (size > 0.8) {
    ctx.fillStyle = m.sym === "Mg" ? "#c5cad2" : m.sym === "Ca" ? "#d9d6cc" : "#b9bec7";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (melted) ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    else if (m.sym === "Mg") ctx.rect(x - size, y - size * 0.15, size * 2, size * 0.3); // ribbon
    else ctx.roundRect(x - size / 2, y - size * 0.35, size, size * 0.7, 3);
    ctx.fill();
    ctx.stroke();
  }

  // hydrogen bubbles
  if (k > 0 && k < 1) {
    const n = Math.round(4 + 22 * m.vigour);
    for (let i = 0; i < n; i++) {
      let u = rnd(i, 7) + p * 5 * (0.6 + rnd(i, 8));
      u -= Math.floor(u);
      const y0 = floats ? liquid + 4 + rnd(i, 9) * 10 : y;
      const yy = y0 - u * (y0 - liquid + (floats ? 18 : 0));
      const xx = x + (rnd(i, 10) - 0.5) * (floats ? size + 16 : size * 1.6);
      ctx.beginPath();
      ctx.arc(xx, yy, 1.5 + rnd(i, 11) * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
      ctx.strokeStyle = "#8aa0c0";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bx, top);
  ctx.lineTo(bx, bottom);
  ctx.lineTo(bx + bw, bottom);
  ctx.lineTo(bx + bw, top);
  ctx.stroke();
  const size2 = g.small ? 10 : 13;
  label(ctx, "nước +", bx + bw + 8, liquid + (g.small ? 26 : 36), { size: size2, color: COLORS.muted });
  label(ctx, "phenolphthalein", bx + bw + 8, liquid + (g.small ? 38 : 54), { size: size2, color: COLORS.muted });
  label(ctx, `${m.sym} · ${fmt(s.mass, 2)} g`, bx + bw + 8, liquid + (g.small ? 10 : 14), { size: size2 + 1, bold: true, color: COLORS.blue });
}

function drawText(ctx, s, g, view) {
  const m = metal(s.metal);
  const a = amounts(s.metal, s.mass);
  const size = g.small ? 11 : 14;
  const lh = g.small ? 14 : 20;
  const w = view.w - 2 * g.pad;
  const out = [];
  const push = (text, bold, color) => wrap(ctx, text, w, size, bold).forEach(t => out.push([t, bold, color]));
  push(sub(equation(s.metal)), true, COLORS.ink);
  if (s.rankVerdict >= 0) push(s.rankVerdict ? "Thứ tự Li < Na < K: đúng ✓" : "Thứ tự chưa đúng, hãy thả lần lượt Li, Na, K để so sánh.", true, s.rankVerdict ? COLORS.green : COLORS.red);
  if (!s.dropped) push("Bấm “Thả vào nước” để quan sát.", false, COLORS.muted);
  else {
    push(m.look, false, COLORS.ink);
    const n = `n(${m.sym}) = ${fmt(s.mass, 2)} : ${m.M} ≈ ${fmt(a.nMetal, 4)} mol → n(H₂) = ${m.group === 1 ? "n(" + m.sym + ") : 2" : "n(" + m.sym + ")"} ≈ ${fmt(a.nH2, 4)} mol`;
    push(n, false, COLORS.ink);
    if (extent(s.metal)) {
      push(`V(H₂) = ${fmt(a.nH2, 4)} × ${fmt(VM)} ≈ ${fmt(a.vH2, 3)} L (đkc). Phenolphthalein chuyển hồng: dung dịch có ${sub(base(s.metal))}, môi trường base.`, false, COLORS.ink);
    } else push("Với nước lạnh, trong thời gian quan sát hầu như không thu được khí và dung dịch gần như không đổi màu.", false, COLORS.ink);
  }
  push("Hình vẽ và thời gian không theo tỉ lệ thực.", false, COLORS.muted);
  const y0 = g.bottom + (g.small ? 10 : 24);
  out.slice(0, Math.floor((view.h - y0 + lh / 2) / lh)).forEach(([t, bold, color], i) => label(ctx, t, g.pad, y0 + i * lh, { size, bold, color }));
}

const undrop = (s, api) => {
  s.dropped = false;
  s.progress = 0;
  api.pause();
};

mount({
  slug: "kim-loai-kiem-nuoc",
  version: "1.0.0",
  title: "Kim loại kiềm tác dụng với nước",
  hint: "Chọn kim loại và khối lượng rồi thả vào cốc nước có phenolphthalein. Thả lần lượt Li, Na, K rồi xếp thứ tự mức độ phản ứng.",
  initialState,
  step(s, dt, api) {
    if (step(s, dt)) api.pause();
  },
  controls: [
    { type: "select", key: "metal", label: "Kim loại", options: METALS.map((m, i) => ({ value: i, label: `${m.sym} (${m.name})` })), onChange: undrop },
    { type: "slider", key: "mass", label: "Khối lượng", min: 0.05, max: 1, step: 0.01, unit: "g", onChange: undrop },
    {
      type: "button",
      label: "Thả vào nước",
      primary: true,
      action(s, api) {
        const a = amounts(s.metal, s.mass);
        s.dropped = true;
        s.progress = 0;
        api.play();
        api.emit("metal-dropped", { metal: s.metal, mass: s.mass, nMetal: a.nMetal, nH2: a.nH2, volumeH2: a.vH2, reacted: extent(s.metal) }, "result");
      },
    },
    { type: "heading", label: "Xếp thứ tự mức độ phản ứng (yếu → mạnh)" },
    {
      type: "select",
      key: "rank",
      label: "Thứ tự của em",
      options: RANK_OPTIONS.map(o => ({ value: o, label: o === "none" ? "— chọn —" : o.replaceAll("<", " < ") })),
      onChange: s => (s.rankVerdict = -1),
    },
    {
      type: "button",
      label: "Kiểm tra thứ tự",
      disabled: s => s.rank === "none",
      action(s, api) {
        if (s.rank === "none") return;
        s.rankVerdict = Number(s.rank === RANK_ANSWER);
        if (s.rankVerdict) api.emit("reactivity-ranked", {}, "goal");
      },
    },
  ],
  readouts: [
    { label: "Khối lượng mol", value: s => `${metal(s.metal).M} g/mol` },
    { label: "n kim loại", value: s => `${fmt(amounts(s.metal, s.mass).nMetal, 4)} mol` },
    { label: "n(H₂) theo phương trình", value: s => `${fmt(amounts(s.metal, s.mass).nH2, 4)} mol` },
    { label: "V(H₂) thu được (đkc)", value: s => (s.dropped ? `${fmt(amounts(s.metal, s.mass).vH2 * clamp((s.progress - FALL) / (1 - FALL), 0, 1), 3)} L` : "–") },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    drawMeter(ctx, s, g, view);
    drawBeaker(ctx, s, g);
    drawText(ctx, s, g, view);
  },
});
