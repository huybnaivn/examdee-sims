import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { SOLUTIONS, CAPACITY, initialState, solutionById, chemistry, classify } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'; // same as kit label()
/** label() that shrinks the font until the text fits in maxW. */
const fit = (ctx, text, x, y, maxW, opts) => {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: tw > maxW ? (opts.size * maxW) / tw : opts.size });
};

// Universal indicator colours for pH 0..14.
const INDICATOR = [
  [229, 38, 42], [238, 59, 43], [242, 103, 42], [247, 148, 29], [251, 184, 26], [244, 217, 27], [185, 213, 50],
  [76, 175, 80], [47, 165, 138], [42, 147, 184], [47, 111, 196], [61, 85, 176], [75, 63, 158], [90, 47, 144], [91, 35, 130],
];
const rgb = c => `rgb(${c.map(Math.round).join(",")})`;
const indicator = pH => {
  const p = clamp(pH, 0, 14);
  const i = Math.min(13, Math.floor(p));
  return rgb(INDICATOR[i].map((v, k) => v + (INDICATOR[i + 1][k] - v) * (p - i)));
};

/** Fixed number of decimals with a decimal comma (kit fmt drops trailing zeros). */
const fixed = (n, digits) => n.toFixed(digits).replace(".", ",");

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = n => (n < 0 ? "⁻" : "") + String(Math.abs(n)).replace(/\d/g, d => SUP[d]);
/** 0.005 -> "5 × 10⁻³" */
const sci = x => {
  let e = Math.floor(Math.log10(x));
  let m = x / 10 ** e;
  if (Number(m.toFixed(1)) >= 10) {
    m /= 10;
    e++;
  }
  return e === 0 ? fixed(m, 1) : `${fixed(m, 1)} × 10${sup(e)}`;
};

const KIND = {
  acid: ["Môi trường acid", COLORS.red],
  neutral: ["Môi trường trung tính", COLORS.green],
  base: ["Môi trường base", COLORS.blue],
};

// One result per finished change (solution picked or slider released). Nothing when the beaker is empty.
const MEDIUM = { acid: -1, neutral: 0, base: 1 };
const report = (s, api) => {
  const c = chemistry(s);
  if (!c) return;
  api.emit("ph-measured", {
    pH: c.pH, hydronium: c.h, hydroxide: c.oh, medium: MEDIUM[classify(c.pH)],
    solutionVolume: s.solutionVolume, waterVolume: s.waterVolume,
    ...(s.solutionVolume > 0 && { dilution: c.dilution }),
  }, "result");
};

mount({
  slug: "thang-do-ph",
  version: "1.0.0",
  title: "Thang pH",
  hint: "Chọn một dung dịch, rồi thêm nước để pha loãng hoặc thêm dung dịch và quan sát pH thay đổi.",
  initialState,
  controls: [
    {
      type: "select",
      key: "solution",
      label: "Dung dịch",
      options: SOLUTIONS.map(x => ({ value: x.id, label: `${x.name} (pH ${fmt(x.pH, 1)})` })),
    },
    { type: "slider", key: "solutionVolume", label: "Thể tích dung dịch", min: 0, max: 500, step: 10, unit: "mL", digits: 0 },
    { type: "slider", key: "waterVolume", label: "Nước thêm vào", min: 0, max: 1000, step: 10, unit: "mL", digits: 0 },
  ].map(c => ({ ...c, onCommit: report })),
  readouts: [
    { label: "pH", value: s => (chemistry(s) ? fixed(chemistry(s).pH, 2) : "–") },
    { label: "[H₃O⁺]", value: s => (chemistry(s) ? `${sci(chemistry(s).h)} mol/L` : "–") },
    { label: "[OH⁻]", value: s => (chemistry(s) ? `${sci(chemistry(s).oh)} mol/L` : "–") },
    { label: "Môi trường", value: s => (chemistry(s) ? KIND[classify(chemistry(s).pH)][0].slice(11) : "–") },
    { label: "Pha loãng", value: s => (s.solutionVolume > 0 ? `${fmt(chemistry(s).dilution, 1)} lần` : "–") },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const pad = 16;
    const sol = solutionById(s.solution);
    const chem = chemistry(s);
    const base = clamp(w / 52, 11, 15);

    // ---- pH scale along the bottom ----
    const sx0 = pad + 12;
    const sx1 = w - pad - 12;
    const by = h - 66;
    const bh = 22;
    const X = pH => sx0 + ((sx1 - sx0) * clamp(pH, 0, 14)) / 14;
    const gradient = ctx.createLinearGradient(sx0, 0, sx1, 0);
    INDICATOR.forEach((c, i) => gradient.addColorStop(i / 14, rgb(c)));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(sx0 - 8, by, sx1 - sx0 + 16, bh, 6);
    ctx.fill();
    for (let i = 0; i <= 14; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(X(i) - 0.5, by + bh - 6, 1, 6);
      label(ctx, String(i), X(i), by + bh + 11, { color: COLORS.muted, size: base - 1, align: "center" });
    }
    label(ctx, "Acid", X(3.5), h - 13, { color: COLORS.red, size: base, align: "center", bold: true });
    label(ctx, "Trung tính", X(7), h - 13, { color: COLORS.green, size: base, align: "center", bold: true });
    label(ctx, "Base", X(10.5), h - 13, { color: COLORS.blue, size: base, align: "center", bold: true });
    if (chem) {
      if (Math.abs(chem.pH - sol.pH) > 0.02 && s.solutionVolume > 0) {
        // where the undiluted solution sits
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X(sol.pH), by + bh / 2, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      const mx = X(chem.pH);
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.moveTo(mx, by + 3);
      ctx.lineTo(mx - 8, by - 10);
      ctx.lineTo(mx + 8, by - 10);
      ctx.closePath();
      ctx.fill();
      label(ctx, `pH ${fixed(chem.pH, 2)}`, clamp(mx, sx0 + 22, sx1 - 22), by - 22, { size: base + 1, align: "center", bold: true });
    }

    // ---- beaker on the left ----
    const topH = by - 38;
    const colW = w * 0.4 - pad;
    const cx = pad + colW / 2;
    const bw = Math.min(colW - 16, 230);
    const top = 42;
    const bottom = topH - 28;
    const height = bottom - top;
    const total = s.solutionVolume + s.waterVolume;
    fit(ctx, sol.name, cx, 20, colW, { size: base + 2, align: "center", bold: true });
    const level = v => bottom - 3 - (v / CAPACITY) * (height - 14);
    if (chem) {
      ctx.fillStyle = indicator(chem.pH);
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.roundRect(cx - bw / 2 + 3, level(total), bw - 6, bottom - 3 - level(total), [0, 0, 10, 10]);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      label(ctx, "Cốc đang trống", cx, (top + bottom) / 2, { color: COLORS.muted, size: base, align: "center" });
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2 - 6, top);
    ctx.lineTo(cx - bw / 2, top + 6);
    ctx.lineTo(cx - bw / 2, bottom - 12);
    ctx.quadraticCurveTo(cx - bw / 2, bottom, cx - bw / 2 + 12, bottom);
    ctx.lineTo(cx + bw / 2 - 12, bottom);
    ctx.quadraticCurveTo(cx + bw / 2, bottom, cx + bw / 2, bottom - 12);
    ctx.lineTo(cx + bw / 2, top + 6);
    ctx.lineTo(cx + bw / 2 + 6, top);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let v = 250; v <= CAPACITY; v += 250) {
      const major = v % 500 === 0;
      ctx.beginPath();
      ctx.moveTo(cx + bw / 2 - (major ? 18 : 10), level(v));
      ctx.lineTo(cx + bw / 2 - 2, level(v));
      ctx.stroke();
      if (major && bw > 90) label(ctx, `${v} mL`, cx + bw / 2 - 22, level(v), { size: base - 2, align: "right", color: v < total ? "#fff" : COLORS.ink });
    }
    fit(ctx, `${fmt(s.solutionVolume, 0)} mL dung dịch + ${fmt(s.waterVolume, 0)} mL nước`, cx, topH - 10, colW, {
      color: COLORS.muted,
      size: base,
      align: "center",
    });

    // ---- numbers on the right ----
    const x0 = w * 0.44;
    const rw = w - pad - x0;
    const big = clamp(w / 20, 22, 44);
    const y1 = topH * 0.14;
    label(ctx, `pH = ${chem ? fixed(chem.pH, 2) : "–"}`, x0, y1, { size: big, bold: true });
    if (chem) {
      const [text, color] = KIND[classify(chem.pH)];
      ctx.font = `600 ${base + 1}px ${FONT}`;
      const pw = ctx.measureText(text).width + 24;
      const y2 = y1 + big / 2 + base + 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x0, y2 - (base + 13) / 2, pw, base + 13, (base + 13) / 2);
      ctx.fill();
      label(ctx, text, x0 + 12, y2, { color: "#fff", size: base + 1, bold: true });
    }
    const barH = clamp(h / 40, 8, 16);
    [
      ["[H₃O⁺]", chem?.h, COLORS.red, topH * 0.48],
      ["[OH⁻]", chem?.oh, COLORS.blue, topH * 0.7],
    ].forEach(([name, value, color, y]) => {
      fit(ctx, `${name} = ${chem ? sci(value) : "–"} mol/L`, x0, y, rw, { size: base + 3, bold: true });
      ctx.fillStyle = COLORS.grid;
      ctx.beginPath();
      ctx.roundRect(x0, y + base + 2, rw, barH, barH / 2);
      ctx.fill();
      if (!chem) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x0, y + base + 2, Math.max(barH, rw * clamp((Math.log10(value) + 14) / 14, 0, 1)), barH, barH / 2);
      ctx.fill();
    });
    const yAxis = topH * 0.7 + base + 2 + barH + base * 0.8;
    label(ctx, "10⁻¹⁴", x0, yAxis, { color: COLORS.muted, size: base - 2 });
    label(ctx, "thang logarit", x0 + rw / 2, yAxis, { color: COLORS.muted, size: base - 2, align: "center" });
    label(ctx, "1 mol/L", x0 + rw, yAxis, { color: COLORS.muted, size: base - 2, align: "right" });
    fit(ctx, "[H₃O⁺] · [OH⁻] = 10⁻¹⁴ (ở 25 °C)", x0, topH * 0.94, rw, { color: COLORS.muted, size: base });
  },
});
