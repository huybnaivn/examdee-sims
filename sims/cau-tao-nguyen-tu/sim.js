import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { initialState, describe, chargeText, sup, currentTarget, checkTarget, nextTarget, MAX_Z, MAX_N } from "./model.js";

const P_COLOR = COLORS.red;
const N_COLOR = "#8b95a8";
const E_COLOR = COLORS.blue;
const SHELL_R = [0.42, 0.62, 0.81, 1]; // shell radii as fractions of the atom radius
const font = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const width = (ctx, text, size, bold) => {
  ctx.font = font(size, bold);
  return ctx.measureText(text).width;
};
const chargeFull = q => (q === 0 ? "0" : `${Math.abs(q)}${q > 0 ? "+" : "−"}`);

// One place decides where things go, from the view size.
function geom(view, challenge) {
  const wide = view.w >= 560;
  const top = wide ? (challenge ? 84 : 52) : challenge ? 44 : 26;
  const infoW = wide ? Math.min(270, view.w * 0.34) : 0;
  const infoH = wide ? 0 : 60;
  const bottom = wide ? 34 : infoH + 16;
  const aw = view.w - infoW;
  const R = Math.max(40, Math.min(aw / 2 - 16, (view.h - top - bottom) / 2 - 4));
  return { wide, top, infoW, infoH, R, cx: aw / 2, cy: top + (view.h - top - bottom) / 2 };
}

function dot(ctx, x, y, r, color, sign) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (sign && r >= 5.5) label(ctx, sign, x, y + 0.5, { color: "#fff", size: r * 1.5, align: "center", bold: true });
}

function drawAtom(ctx, d, g) {
  const { cx, cy, R } = g;
  const er = Math.min(9, Math.max(4, R * 0.045));
  // shells that hold electrons, plus the faint outline of the next one to fill
  SHELL_R.forEach((f, k) => {
    if (k > d.shells.length) return;
    ctx.strokeStyle = k < d.shells.length ? COLORS.muted : COLORS.grid;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(k < d.shells.length ? [] : [4, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // nucleus: protons and neutrons mixed evenly along a sunflower spiral
  const total = d.z + d.n;
  const pr = (R * SHELL_R[0] - er - 4) / (Math.sqrt(MAX_Z + MAX_N) + 0.6);
  for (let i = total - 1; i >= 0; i--) {
    const r = pr * 1.02 * Math.sqrt(i + (total > 1 ? 0.5 : 0));
    const a = i * 2.39996;
    const proton = Math.floor(((i + 1) * d.z) / total) > Math.floor((i * d.z) / total);
    dot(ctx, cx + r * Math.cos(a), cy + r * Math.sin(a), pr, proton ? P_COLOR : N_COLOR, proton ? "+" : "");
  }

  d.shells.forEach((count, k) => {
    for (let j = 0; j < count; j++) {
      const a = -Math.PI / 2 + (j * 2 * Math.PI) / count;
      dot(ctx, cx + R * SHELL_R[k] * Math.cos(a), cy + R * SHELL_R[k] * Math.sin(a), er, E_COLOR, "−");
    }
  });
}

// ᴬ_Z X with the ion charge at the top right. (x, y) is the centre of the symbol.
function drawNotation(ctx, d, x, y, size) {
  const small = size * 0.42;
  const sw = width(ctx, d.symbol, size, true);
  label(ctx, d.symbol, x, y, { size, bold: true, align: "center" });
  label(ctx, String(d.a), x - sw / 2 - 3, y - size * 0.33, { size: small, align: "right", bold: true, color: COLORS.orange });
  label(ctx, String(d.z), x - sw / 2 - 3, y + size * 0.33, { size: small, align: "right", bold: true, color: P_COLOR });
  if (d.charge) label(ctx, chargeText(d.charge), x + sw / 2 + 3, y - size * 0.33, { size: small, bold: true, color: d.charge > 0 ? P_COLOR : E_COLOR });
}

function drawLegend(ctx, x, y, size) {
  for (const [color, text] of [[P_COLOR, "proton"], [N_COLOR, "neutron"], [E_COLOR, "electron"]]) {
    dot(ctx, x + 5, y, 5, color, "");
    label(ctx, text, x + 14, y, { size, color: COLORS.muted });
    x += 22 + width(ctx, text, size);
  }
}

const afterChange = particle => (s, api) => {
  api.emit("particle-change", { particle, protons: s.protons, neutrons: s.neutrons, electrons: s.electrons });
  reportTarget(s, api);
};
function reportTarget(s, api) {
  const id = checkTarget(s);
  if (id) api.emit("target-built", { target: id }, "goal");
}

mount({
  slug: "cau-tao-nguyen-tu",
  version: "1.0.0",
  title: "Cấu tạo nguyên tử",
  hint: "Thêm bớt proton, neutron và electron để tạo nguyên tử hoặc ion của 20 nguyên tố đầu tiên.",
  initialState,
  controls: [
    { type: "heading", label: "Hạt nhân" },
    { type: "stepper", key: "protons", label: "Proton (p)", min: 1, max: MAX_Z, onChange: afterChange("proton") },
    { type: "stepper", key: "neutrons", label: "Neutron (n)", min: 0, max: MAX_N, onChange: afterChange("neutron") },
    { type: "heading", label: "Vỏ nguyên tử" },
    { type: "stepper", key: "electrons", label: "Electron (e)", min: 0, max: MAX_Z, onChange: afterChange("electron") },
    { type: "heading", label: "Thử thách" },
    {
      type: "checkbox",
      key: "challenge",
      label: "Chế độ thử thách",
      onChange(s, api) {
        s.solved = false;
        reportTarget(s, api);
      },
    },
    {
      type: "button",
      label: "Thử thách tiếp theo",
      visible: s => s.challenge,
      action(s, api) {
        nextTarget(s);
        reportTarget(s, api);
      },
    },
  ],
  readouts: [
    { label: "Nguyên tố", value: s => `${describe(s).name} (${describe(s).symbol})` },
    { label: "Số khối A = Z + N", value: s => String(describe(s).a) },
    { label: "Điện tích (Z − số e)", value: s => chargeFull(describe(s).charge) },
    { label: "Loại hạt", value: s => describe(s).kindLabel },
    { label: "Hạt nhân", value: s => (describe(s).stable ? "Bền" : "Không bền") },
  ],
  draw(ctx, s, view) {
    const d = describe(s);
    const g = geom(view, s.challenge);
    const { wide } = g;
    const stableText = d.stable ? `Đồng vị ${sup(d.a)}${d.symbol} bền` : `Đồng vị ${sup(d.a)}${d.symbol} không bền`;
    const stableColor = d.stable ? COLORS.green : COLORS.orange;
    const shellText = `Lớp electron: ${d.shells.length ? d.shells.join(", ") : "không có electron"}`;

    if (s.challenge) {
      const t = currentTarget(s);
      const text = s.solved ? `Đúng rồi! Bạn đã tạo được ${t.label}.` : `Thử thách: hãy tạo ${t.label}`;
      const size = wide ? 17 : 13;
      const bw = Math.min(view.w - 12, width(ctx, text, size, true) + 28);
      const bh = wide ? 36 : 22;
      ctx.fillStyle = s.solved ? "#e3f6ee" : "#fff4e3";
      ctx.strokeStyle = s.solved ? COLORS.green : COLORS.orange;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect((view.w - g.infoW - bw) / 2, wide ? 10 : 3, bw, bh, 8);
      ctx.fill();
      ctx.stroke();
      label(ctx, text, (view.w - g.infoW) / 2, (wide ? 10 : 3) + bh / 2 + 0.5, { size, bold: true, align: "center", color: s.solved ? COLORS.green : COLORS.ink });
    }
    drawLegend(ctx, wide ? 18 : 8, g.top - (wide ? 22 : 11), wide ? 13 : 11);

    drawAtom(ctx, d, g);

    if (wide) {
      label(ctx, "Hình vẽ không theo tỉ lệ: hạt nhân thật nhỏ hơn nguyên tử khoảng 10 000 – 100 000 lần.", g.cx, view.h - 16, {
        size: 12,
        align: "center",
        color: COLORS.muted,
      });
      // info card
      const x = view.w - g.infoW;
      const cw = g.infoW - 16;
      const lines = [
        [`Số proton Z = ${d.z}`, P_COLOR],
        [`Số neutron N = ${d.n}`, COLORS.ink],
        [`Số khối A = Z + N = ${d.a}`, COLORS.orange],
        [`Số electron = ${d.e}`, E_COLOR],
        [`Điện tích = ${d.z} − ${d.e} = ${chargeFull(d.charge)}`, COLORS.ink],
        [shellText, COLORS.ink],
      ];
      const ch = 196 + lines.length * 24 + 40;
      const y = Math.max(8, (view.h - ch) / 2);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, 12);
      ctx.fill();
      ctx.stroke();
      const mid = x + cw / 2;
      drawNotation(ctx, d, mid, y + 62, 64);
      label(ctx, d.name, mid, y + 128, { size: 20, bold: true, align: "center" });
      label(ctx, d.kindLabel, mid, y + 154, { size: 14, align: "center", color: d.charge > 0 ? P_COLOR : d.charge < 0 ? E_COLOR : COLORS.muted, bold: true });
      ctx.beginPath();
      ctx.moveTo(x + 14, y + 176);
      ctx.lineTo(x + cw - 14, y + 176);
      ctx.stroke();
      const size = cw < 220 ? 12 : 14;
      lines.forEach(([text, color], i) => label(ctx, text, x + 16, y + 198 + i * 24, { size, color }));
      label(ctx, stableText, x + 16, y + 198 + lines.length * 24 + 6, { size, bold: true, color: stableColor });
    } else {
      label(ctx, "Hình không theo tỉ lệ", view.w - 8, g.top - 11, { size: 10, align: "right", color: COLORS.muted });
      drawNotation(ctx, d, view.w - 40, g.top + 28, 30);
      const y = view.h - g.infoH - 4;
      const mid = view.w / 2;
      label(ctx, `${d.name} · ${d.kindLabel}`, mid, y + 8, { size: 13, bold: true, align: "center" });
      label(ctx, `Z = ${d.z}   A = ${d.z} + ${d.n} = ${d.a}   Điện tích = ${d.z} − ${d.e} = ${chargeFull(d.charge)}`, mid, y + 28, { size: 12, align: "center" });
      const sw = width(ctx, shellText + "  ·  ", 12);
      const tw = sw + width(ctx, stableText, 12, true);
      label(ctx, shellText + "  ·  ", mid - tw / 2, y + 48, { size: 12, color: COLORS.muted });
      label(ctx, stableText, mid - tw / 2 + sw, y + 48, { size: 12, bold: true, color: stableColor });
    }
  },
});
