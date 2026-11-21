import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import {
  F_MIN, F_MAX, LOG_C, LOG_HE, REGIONS, ALL_FOUND, initialState, frequency, wavelength, energyJ, energyEV,
  setLogF, fromWavelength, fromEnergy, regionIndex, visibleColor, compareObject, sci, lengthText, energyText,
} from "./model.js";

const here = s => regionIndex(wavelength(s));
const count = mask => REGIONS.filter((_, i) => mask & (1 << i)).length;

// One result per release of the marker (drag or slider); a goal once every region has been visited.
const report = (s, api) => {
  const region = here(s);
  api.emit("marker-set", { wavelength: wavelength(s), frequency: frequency(s), energy: energyEV(s), region }, "result");
  const before = s.found;
  s.found = before | (1 << region);
  if (s.found === ALL_FOUND && before !== ALL_FOUND) api.emit("all-regions", { regions: REGIONS.length }, "goal");
};

function geom(view) {
  const small = view.w < 520 || view.h < 380;
  const x0 = small ? 12 : 24;
  const x1 = view.w - x0;
  const barY = small ? 92 : 118;
  const barH = small ? 30 : 40;
  return { small, x0, x1, barY, barH, X: lf => x0 + ((lf - F_MIN) / (F_MAX - F_MIN)) * (x1 - x0) };
}
const rgb = c => `rgb(${c.join(",")})`;

function drawWave(ctx, s, x, y, w, h, small) {
  const lambda = wavelength(s);
  const obj = compareObject(lambda);
  const span = Math.max(2.5 * lambda, 1.4 * obj.size); // metres across the panel
  const k = w / span; // px per metre
  const colour = visibleColor(lambda * 1e9);
  const stroke = colour ? rgb(colour) : COLORS.blue;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  const mid = y + h * 0.42;
  const amp = h * 0.2;
  const per = lambda * k; // px per wavelength
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.2;
  if (per >= 12) {
    ctx.beginPath();
    for (let px = 0; px <= w; px += Math.min(1, per / 16)) ctx.lineTo(x + px, mid - amp * Math.sin((2 * Math.PI * px) / per));
    ctx.stroke();
    // one wavelength marked
    const bx = x + per / 4;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bx, mid - amp - 6);
    ctx.lineTo(bx + per, mid - amp - 6);
    ctx.moveTo(bx, mid - amp - 10);
    ctx.lineTo(bx, mid - amp - 2);
    ctx.moveTo(bx + per, mid - amp - 10);
    ctx.lineTo(bx + per, mid - amp - 2);
    ctx.stroke();
    label(ctx, `λ = ${lengthText(lambda)}`, clamp(bx + per / 2, x + 50, x + w - 50), Math.max(y + 12, mid - amp - 18), { size: 12, align: "center", bold: true });
  } else {
    ctx.fillStyle = stroke;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x, mid - amp, w, 2 * amp);
    ctx.globalAlpha = 1;
    label(ctx, `λ = ${lengthText(lambda)}: các gợn sóng quá dày để vẽ ở tỉ lệ này`, x + w / 2, mid, { size: 12, align: "center", bold: true });
  }
  // comparison object, at the same scale
  const ow = Math.max(2, obj.size * k);
  const oh = 12;
  ctx.fillStyle = COLORS.muted;
  ctx.fillRect(x + 8, y + h - 24 - oh, Math.min(ow, w - 16), oh);
  label(ctx, `${small ? "" : "So sánh: "}${obj.name}`, x + 8, y + h - 12, { size: small ? 11 : 12, color: COLORS.muted });
  label(ctx, `Khung rộng ${lengthText(span)}`, x + w - 8, y + 12, { size: 11, align: "right", color: COLORS.muted });
}

const modeIs = m => s => s.mode === m;

mount({
  slug: "song-dien-tu",
  version: "1.0.0",
  title: "Thang sóng điện từ",
  hint: "Kéo vạch đánh dấu dọc thang (hoặc dùng thanh trượt) để chọn bước sóng, tần số hay năng lượng phôtôn. Hãy tìm đủ cả bảy vùng.",
  initialState,
  sanitize(incoming, base) {
    const out = {};
    if (["frequency", "wavelength", "energy"].includes(incoming.mode)) out.mode = incoming.mode;
    if (Number.isInteger(incoming.found)) out.found = clamp(incoming.found, 0, ALL_FOUND);
    const t = { ...base };
    setLogF(t, typeof incoming.logF === "number" ? incoming.logF : base.logF); // the other two follow from f
    return { ...out, logF: t.logF, logL: t.logL, logE: t.logE };
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Chọn theo",
      options: [
        { value: "wavelength", label: "Bước sóng λ" },
        { value: "frequency", label: "Tần số f" },
        { value: "energy", label: "Năng lượng phôtôn ε" },
      ],
    },
    {
      type: "slider", key: "logF", label: "Tần số f", min: F_MIN, max: F_MAX, step: 0.01, visible: modeIs("frequency"),
      format: v => `${sci(10 ** v)} Hz`, onChange: s => setLogF(s, s.logF), onCommit: report,
    },
    {
      type: "slider", key: "logL", label: "Bước sóng λ", min: LOG_C - F_MAX, max: LOG_C - F_MIN, step: 0.01, visible: modeIs("wavelength"),
      format: v => lengthText(10 ** v), onChange: s => fromWavelength(s, s.logL), onCommit: report,
    },
    {
      type: "slider", key: "logE", label: "Năng lượng phôtôn ε", min: LOG_HE + F_MIN, max: LOG_HE + F_MAX, step: 0.01, visible: modeIs("energy"),
      format: v => energyText(10 ** v), onChange: s => fromEnergy(s, s.logE), onCommit: report,
    },
  ],
  readouts: [
    { label: "Vùng", value: s => REGIONS[here(s)].name },
    { label: "Tần số f", value: s => `${sci(frequency(s))} Hz` },
    { label: "Bước sóng λ = c/f", value: s => lengthText(wavelength(s)) },
    { label: "Năng lượng ε = hf", value: s => `${sci(energyJ(s))} J` },
    { label: "", value: s => `= ${energyText(energyEV(s))}` },
    { label: "Nguồn phát", value: s => REGIONS[here(s)].sources },
    { label: "Ứng dụng", value: s => REGIONS[here(s)].uses },
    { label: "Đã tìm thấy", value: s => `${count(s.found)}/${REGIONS.length} vùng` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      if (p.y < g.barY - 40 || p.y > g.barY + g.barH + 40) return false;
      this.move(p, s, api, view);
      return true;
    },
    move(p, s, api, view) {
      const g = geom(view);
      setLogF(s, Math.round((F_MIN + ((p.x - g.x0) / (g.x1 - g.x0)) * (F_MAX - F_MIN)) * 100) / 100);
    },
    up(p, s, api) {
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const { small, x0, x1, barY, barH, X } = g;
    const size = small ? 12 : 14;
    const region = here(s);

    // bands, radio on the left
    REGIONS.forEach((r, i) => {
      const a = X(clamp(LOG_C - Math.log10(Math.min(r.hi, 1e30)), F_MIN, F_MAX));
      const b = X(clamp(LOG_C - Math.log10(Math.max(r.lo, 1e-30)), F_MIN, F_MAX));
      if (i === 3) {
        const grad = ctx.createLinearGradient(a, 0, b, 0);
        for (let nm = 760; nm >= 380; nm -= 20) grad.addColorStop((760 - nm) / 380, rgb(visibleColor(nm)));
        ctx.fillStyle = grad;
      } else ctx.fillStyle = r.color;
      ctx.fillRect(a, barY, b - a, barH);
      if (i === region) {
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 2;
        ctx.strokeRect(a, barY, b - a, barH);
      }
      // names inside the band when they fit; visible light gets a leader below
      ctx.font = `${small ? 10 : 12}px system-ui, sans-serif`;
      const name = (s.found & (1 << i) ? "✓ " : "") + r.short;
      if (i === 3) {
        if (!small) label(ctx, name, (a + b) / 2, barY + barH + 30, { size: 12, align: "center", color: COLORS.ink });
      } else if (ctx.measureText(name).width < b - a - 4) {
        label(ctx, name, (a + b) / 2, barY + barH / 2, { size: small ? 10 : 12, align: "center", color: COLORS.ink });
      }
    });
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, barY, x1 - x0, barH);

    // frequency ticks above, wavelength ticks below
    const every = small ? 4 : 2;
    for (let lf = F_MIN; lf <= F_MAX; lf += every) {
      const x = X(lf);
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(x - 0.5, barY - 5, 1, 5);
      label(ctx, sci(10 ** lf).replace("1·", ""), x, barY - 13, { size: small ? 10 : 11, align: "center", color: COLORS.muted });
    }
    for (let ll = 5; ll >= -14; ll -= every) {
      const x = X(LOG_C - ll);
      ctx.fillRect(x - 0.5, barY + barH, 1, 5);
      label(ctx, sci(10 ** ll).replace("1·", ""), x, barY + barH + 13, { size: small ? 10 : 11, align: "center", color: COLORS.muted });
    }
    label(ctx, "f (Hz)", x0, barY - 29, { size: 11, color: COLORS.muted });
    label(ctx, "λ (m)", x1, barY - 29, { size: 11, align: "right", color: COLORS.muted });

    // marker
    const mx = X(s.logF);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(mx - 1.5, barY - 8, 3, barH + 16);
    ctx.beginPath();
    ctx.moveTo(mx, barY - 6);
    ctx.lineTo(mx - 8, barY - 20);
    ctx.lineTo(mx + 8, barY - 20);
    ctx.closePath();
    ctx.fillStyle = COLORS.red;
    ctx.fill();

    // caption
    const r = REGIONS[region];
    label(ctx, r.name, 12, 18, { size: size + 3, bold: true });
    label(ctx, `f = ${sci(frequency(s))} Hz · λ = ${lengthText(wavelength(s))} · ε = ${energyText(energyEV(s))}`, 12, 42, { size: size - 1, color: COLORS.muted });

    // sources and uses
    let y = barY + barH + (small ? 30 : 50);
    if (!small) {
      for (const [k, text] of [[0, `Nguồn: ${r.sources}`], [20, `Ứng dụng: ${r.uses}`]]) {
        let fs = 13;
        ctx.font = `${fs}px system-ui, sans-serif`;
        while (fs > 10 && ctx.measureText(text).width > x1 - x0) ctx.font = `${--fs}px system-ui, sans-serif`;
        label(ctx, text, x0, y + k, { size: fs });
      }
      y += 40;
    }
    const bottom = view.h - 22;
    if (bottom - y > 70) drawWave(ctx, s, x0, y, x1 - x0, bottom - y, small);
    label(ctx, "Thang logarit · ranh giới các vùng là quy ước · c = 3·10⁸ m/s, h = 6,626·10⁻³⁴ J·s", view.w - 10, view.h - 9, {
      size: small ? 9 : 11, align: "right", color: COLORS.muted,
    });
  },
});
