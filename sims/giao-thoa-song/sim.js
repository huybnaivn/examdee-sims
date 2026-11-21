import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, FIELD, probe, orders, countMaxima, countMinima, displacement, piFrac } from "./model.js";

const VISUAL_PERIOD = 1.6; // s on screen for one wave period (slowed down so it can be followed)
const CELL = 4; // CSS px per sample of the water surface
const KIND = { 1: "cực đại", "-1": "cực tiểu", 0: "không phải cực đại hay cực tiểu" };
const round1 = v => Math.round(v * 10) / 10;

function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const top = small ? 36 : 64;
  const bottom = small ? 16 : 30;
  const scale = Math.max(1, Math.min(view.w / FIELD.w, (view.h - top - bottom) / FIELD.h));
  const fw = FIELD.w * scale;
  const fh = FIELD.h * scale;
  const x0 = (view.w - fw) / 2;
  const y0 = top + (view.h - top - bottom - fh) / 2;
  return { small, scale, x0, y0, fw, fh, cx: x0 + fw / 2, cy: y0 + fh / 2 };
}

const toScreen = (g, x, y) => [g.cx + x * g.scale, g.cy - y * g.scale];

const placeProbe = (p, s, g) => {
  s.probeX = round1(clamp((p.x - g.cx) / g.scale, -FIELD.w / 2, FIELD.w / 2));
  s.probeY = round1(clamp((g.cy - p.y) / g.scale, -FIELD.h / 2, FIELD.h / 2));
};

// The surface is sampled on a coarse grid into a small bitmap, then stretched over the field.
let buffer = null;
function drawWater(ctx, s, g) {
  const cols = Math.max(2, Math.ceil(g.fw / CELL));
  const rows = Math.max(2, Math.ceil(g.fh / CELL));
  buffer ??= document.createElement("canvas");
  if (buffer.width !== cols || buffer.height !== rows) {
    buffer.width = cols;
    buffer.height = rows;
  }
  const bctx = buffer.getContext("2d");
  const image = bctx.createImageData(cols, rows);
  const wt = (2 * Math.PI * (s._t ?? 0)) / VISUAL_PERIOD;
  for (let j = 0, i = 0; j < rows; j++) {
    const y = FIELD.h / 2 - ((j + 0.5) / rows) * FIELD.h;
    for (let c = 0; c < cols; c++, i += 4) {
      const x = -FIELD.w / 2 + ((c + 0.5) / cols) * FIELD.w;
      const u = (displacement(s, x, y, wt) + 2) / 4; // 0 = trough, 1 = crest
      image.data[i] = 18 + 222 * u;
      image.data[i + 1] = 58 + 190 * u;
      image.data[i + 2] = 138 + 117 * u;
      image.data[i + 3] = 255;
    }
  }
  bctx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buffer, g.x0, g.y0, g.fw, g.fh);
}

// The line d₂ − d₁ = c·λ is one branch of a hyperbola with foci S₁ and S₂.
function drawLines(ctx, s, g, offset, color, dash) {
  const list = orders(s, offset);
  const f = s.separation / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = dash.length ? 1.5 : 2;
  ctx.setLineDash(dash);
  ctx.beginPath();
  for (const { c } of list) {
    const a = (c * s.wavelength) / 2;
    const b = Math.sqrt(Math.max(0, f * f - a * a));
    for (let u = -5; u <= 5.001; u += 0.1) {
      const pt = toScreen(g, -a * Math.cosh(u), b * Math.sinh(u));
      if (u === -5) ctx.moveTo(...pt);
      else ctx.lineTo(...pt);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  return list;
}

function tag(ctx, text, x, y, color, size = 12) {
  ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fillRect(x - w / 2, y - size / 2 - 3, w, size + 6);
  label(ctx, text, x, y, { size, bold: true, color, align: "center" });
}

mount({
  slug: "giao-thoa-song",
  version: "1.0.0",
  title: "Giao thoa sóng nước",
  hint: "Kéo điểm M trên mặt nước để đo hiệu đường đi d₂ − d₁ và biên độ dao động tại đó.",
  initialState,
  autoplay: true,
  step(s, dt) {
    s._t = ((s._t ?? 0) + dt) % VISUAL_PERIOD; // only the picture moves; nothing to report per frame
  },
  controls: [
    { type: "heading", label: "Hai nguồn kết hợp" },
    { type: "slider", key: "separation", label: "Khoảng cách S₁S₂", min: 2, max: 12, step: 0.5, unit: "cm", digits: 1 },
    { type: "slider", key: "wavelength", label: "Bước sóng λ", min: 1, max: 4, step: 0.5, unit: "cm", digits: 1 },
    {
      type: "slider",
      key: "phaseDeg",
      label: "Độ lệch pha Δφ (S₂ sớm pha hơn S₁)",
      min: 0,
      max: 180,
      step: 15,
      format: v => `${piFrac(v)} rad${v === 0 ? " (cùng pha)" : v === 180 ? " (ngược pha)" : ""}`,
    },
    { type: "checkbox", key: "showLines", label: "Hiện các đường cực đại, cực tiểu" },
    { type: "heading", label: "Điểm M" },
    { type: "slider", key: "probeX", label: "Hoành độ của M", min: -FIELD.w / 2, max: FIELD.w / 2, step: 0.1, unit: "cm", digits: 1 },
    { type: "slider", key: "probeY", label: "Tung độ của M", min: -FIELD.h / 2, max: FIELD.h / 2, step: 0.1, unit: "cm", digits: 1 },
  ],
  readouts: [
    { label: "Số cực đại trên đoạn S₁S₂", value: s => String(countMaxima(s)) },
    { label: "Số cực tiểu trên đoạn S₁S₂", value: s => String(countMinima(s)) },
    { label: "d₁ = MS₁", value: s => `${fmt(probe(s).d1)} cm` },
    { label: "d₂ = MS₂", value: s => `${fmt(probe(s).d2)} cm` },
    { label: "d₂ − d₁", value: s => `${fmt(probe(s).delta * s.wavelength)} cm = ${fmt(probe(s).delta)}λ` },
    { label: "Biên độ tại M", value: s => `${fmt(probe(s).amplitude)}A` },
    { label: "Tại M", value: s => KIND[probe(s).kind] },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      if (p.x < g.x0 || p.x > g.x0 + g.fw || p.y < g.y0 || p.y > g.y0 + g.fh) return false;
      placeProbe(p, s, g);
    },
    move(p, s, api, view) {
      placeProbe(p, s, geom(view));
    },
    up(p, s, api) {
      const m = probe(s);
      api.emit("probe-released", { pathDifference: m.delta, relativeAmplitude: m.amplitude, classification: m.kind, order: m.k }, "result");
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const m = probe(s);
    const size = g.small ? 12 : 15;

    // readings for the probe, above the water so they never cover it
    label(ctx, `d₁ = ${fmt(m.d1)} cm   d₂ = ${fmt(m.d2)} cm   d₂ − d₁ = ${fmt(m.delta * s.wavelength)} cm = ${fmt(m.delta)}λ`, view.w / 2, g.y0 - (g.small ? 26 : 42), { align: "center", size });
    const verdict = m.kind === 0 ? KIND[0] : `${KIND[m.kind]} (k = ${fmt(m.k, 0)})`;
    label(ctx, `Biên độ tại M: ${fmt(m.amplitude)}A – ${verdict}`, view.w / 2, g.y0 - (g.small ? 10 : 18), {
      align: "center",
      size,
      bold: true,
      color: m.kind === 1 ? COLORS.red : m.kind === -1 ? COLORS.ink : COLORS.muted,
    });
    label(
      ctx,
      g.small ? "Đỏ: cực đại · nét đứt: cực tiểu · bỏ qua sự giảm biên độ" : "Đường đỏ liền: cực đại · đường nét đứt: cực tiểu · bỏ qua sự giảm biên độ khi sóng lan xa · chuyển động đã được làm chậm",
      view.w / 2,
      g.y0 + g.fh + (g.small ? 8 : 15),
      { align: "center", size: g.small ? 10 : 12, color: COLORS.muted }
    );

    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x0, g.y0, g.fw, g.fh);
    ctx.clip();
    drawWater(ctx, s, g);

    if (s.showLines) {
      drawLines(ctx, s, g, 0.5, COLORS.ink, [6, 5]);
      const maxima = drawLines(ctx, s, g, 0, COLORS.red, []);
      // order numbers where each maximum crosses S₁S₂, when there is room for them
      if ((s.wavelength / 2) * g.scale >= 24) {
        for (const { k, c } of maxima) {
          const [x, y] = toScreen(g, (-c * s.wavelength) / 2, 0);
          tag(ctx, k === 0 ? "k = 0" : fmt(k, 0), x, y + 22, COLORS.red, g.small ? 10 : 12);
        }
      }
    }

    // sources, probe and the two paths
    const s1 = toScreen(g, -s.separation / 2, 0);
    const s2 = toScreen(g, s.separation / 2, 0);
    const pm = toScreen(g, s.probeX, s.probeY);
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(...s1);
    ctx.lineTo(...pm);
    ctx.lineTo(...s2);
    ctx.stroke();
    if (!g.small) {
      tag(ctx, "d₁", (s1[0] + pm[0]) / 2, (s1[1] + pm[1]) / 2, COLORS.orange);
      tag(ctx, "d₂", (s2[0] + pm[0]) / 2, (s2[1] + pm[1]) / 2, COLORS.orange);
    }
    for (const [pt, name] of [[s1, "S₁"], [s2, "S₂"]]) {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      tag(ctx, name, pt[0], pt[1] - 17, COLORS.ink, g.small ? 11 : 13);
    }
    ctx.beginPath();
    ctx.arc(pm[0], pm[1], 8, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.orange;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    tag(ctx, "M", pm[0] + (pm[0] > g.x0 + g.fw - 30 ? -18 : 18), pm[1] + (pm[1] < g.y0 + 30 ? 16 : -14), COLORS.orange, g.small ? 11 : 13);
    ctx.restore();

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(g.x0, g.y0, g.fw, g.fh);
  },
});
