import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, toRad, toDeg, normDeg, trig, quadrant, signs, isSpecial, exact, piFraction, snap } from "./model.js";

const SIN = COLORS.red;
const COS = COLORS.blue;
const TAN = COLORS.green;
const ROMAN = ["", "I", "II", "III", "IV"];

// Vietnamese number with a real minus sign, never "−0".
const num = (v, digits = 3) => {
  const k = 10 ** digits;
  return fmt(Math.round(v * k) / k + 0, digits).replace("-", "−");
};

const radText = deg => (isSpecial(deg) ? piFraction(deg) : num(toRad(deg))) + " rad";
/** "= 60° = π/3 rad", or with radians first when that unit is selected. */
const angleText = s => {
  const approx = isSpecial(s.deg) ? "=" : "≈";
  return s.unit === "rad" ? `${approx} ${radText(s.deg)} (${s.deg}°)` : `= ${s.deg}° ${approx} ${radText(s.deg)}`;
};

/** "= √3/2 ≈ 0,866", "= 0,5", "≈ 0,643" or "không xác định". */
const valueText = (v, exactText) => {
  if (v === null) return "không xác định";
  if (exactText == null) return `≈ ${num(v)}`;
  if (exactText.includes("√")) return `= ${exactText} ≈ ${num(v)}`;
  return exactText.includes("/") ? `= ${exactText} = ${num(v)}` : `= ${exactText}`;
};
const values = s => {
  const t = trig(s.deg);
  const e = exact(s.deg) ?? {};
  return { sin: valueText(t.sin, e.sin), cos: valueText(t.cos, e.cos), tan: valueText(t.tan, e.tan) };
};
const bare = text => text.replace(/^= /, "");
const signText = v => (v === null ? "KXĐ" : v > 0 ? "+" : v < 0 ? "−" : "0");

// One result per committed angle (slider released or drag ended). tan is left out where undefined.
const report = (s, api) => {
  const t = trig(s.deg);
  api.emit("trig-values", { deg: s.deg, sin: t.sin, cos: t.cos, ...(t.tan !== null && { tan: t.tan }) }, "result");
};

const layout = (s, view) => {
  const { w, h } = view;
  const small = w < 520;
  const fs = small ? 11 : 15;
  const textH = 14 + 4 * fs * 1.5;
  const regionW = s.showGraph ? w * (small ? 0.58 : 0.54) : w;
  const R = Math.max(20, Math.min((regionW - 50) / 2.35, (h - textH - 40) / 2.5));
  return { small, fs, textH, regionW, R, cx: regionW / 2 - R * 0.06, cy: textH + (h - textH) / 2 };
};

const setFromPointer = (p, s, api, view) => {
  const { cx, cy } = layout(s, view);
  s.deg = snap(toDeg(Math.atan2(cy - p.y, p.x - cx)));
  api.sync();
};

function segment(ctx, x1, y1, x2, y2, color, width, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = dash.length ? "butt" : "round";
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCircle(ctx, s, L, h) {
  const { cx, cy, R, regionW, textH, small } = L;
  const t = trig(s.deg);
  const rad = toRad(s.deg);
  const mx = cx + R * t.cos;
  const my = cy - R * t.sin;

  // axes and the tangent axis x = 1
  arrow(ctx, cx - 1.25 * R, cy, cx + 1.3 * R, cy, COLORS.ink, 1.5);
  arrow(ctx, cx, cy + 1.25 * R, cx, cy - 1.25 * R, COLORS.ink, 1.5);
  segment(ctx, cx + R, cy - 1.25 * R, cx + R, cy + 1.25 * R, COLORS.muted, 1);
  const axis = { size: small ? 11 : 13, color: COLORS.muted };
  label(ctx, "x", cx + 1.3 * R - 4, cy + 13, axis);
  label(ctx, "y", cx + 9, cy - 1.25 * R + 5, axis);
  label(ctx, "O", cx - 12, cy + 12, axis);
  label(ctx, "1", cx + R + 6, cy + 12, axis);
  label(ctx, "−1", cx - R - 5, cy + 12, { ...axis, align: "right" });
  label(ctx, "1", cx - 8, cy - R - 9, { ...axis, align: "right" });
  label(ctx, "−1", cx - 8, cy + R + 10, { ...axis, align: "right" });

  // circle with the special angles marked
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.muted;
  for (let d = 0; d < 360; d += 15) {
    if (!isSpecial(d)) continue;
    ctx.beginPath();
    ctx.arc(cx + R * Math.cos(toRad(d)), cy - R * Math.sin(toRad(d)), small ? 2 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // angle
  if (s.deg > 0) {
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.2, 0, -rad, true);
    ctx.stroke();
    label(ctx, "α", cx + R * 0.31 * Math.cos(rad / 2), cy - R * 0.31 * Math.sin(rad / 2), { color: COLORS.orange, align: "center", bold: true, size: small ? 12 : 15 });
  }

  // tan on the tangent axis, clipped to the circle's part of the canvas
  if (t.tan !== null) {
    const ty = cy - R * t.tan;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, textH, regionW, h - textH);
    ctx.clip();
    segment(ctx, t.cos > 0 ? cx : mx, t.cos > 0 ? cy : my, cx + R, ty, TAN, 1.5, [6, 5]);
    segment(ctx, cx + R, cy, cx + R, ty, TAN, 4);
    ctx.fillStyle = TAN;
    ctx.beginPath();
    ctx.arc(cx + R, ty, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // cos along Ox, sin from Ox up to M, projection of M on Oy
  segment(ctx, mx, my, cx, my, COLORS.muted, 1, [4, 4]);
  segment(ctx, cx, cy, mx, my, COLORS.ink, 2);
  segment(ctx, cx, cy, mx, cy, COS, 4);
  segment(ctx, mx, cy, mx, my, SIN, 4);

  // M, the draggable point
  ctx.fillStyle = COLORS.purple;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx, my, small ? 7 : 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const out = small ? 16 : 22;
  label(ctx, "M", mx + out * Math.cos(rad + 1), my - out * Math.sin(rad + 1), { color: COLORS.purple, bold: true, align: "center", size: small ? 12 : 15 });
}

function drawGraph(ctx, s, L, view) {
  const { regionW, cy, small } = L;
  const left = regionW + (small ? 22 : 40);
  const right = view.w - (small ? 22 : 28);
  const pw = right - left;
  const amp = Math.min(view.h * 0.2, pw * 0.36); // pixels for y = 1
  const X = deg => left + (pw * deg) / 360;
  const Y = v => cy - amp * v;
  const t = trig(s.deg);
  const tick = { size: small ? 9 : 12, color: COLORS.muted };

  // frame
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const v of [1, -1]) {
    ctx.moveTo(left, Y(v));
    ctx.lineTo(right, Y(v));
  }
  for (const d of [90, 180, 270, 360]) {
    ctx.moveTo(X(d), Y(1));
    ctx.lineTo(X(d), Y(-1));
  }
  ctx.stroke();
  arrow(ctx, left, cy, right + (small ? 8 : 16), cy, COLORS.ink, 1.5);
  arrow(ctx, left, Y(-1) - 0, left, Y(1) - (small ? 12 : 20), COLORS.ink, 1.5);
  for (const v of [1, -1]) label(ctx, num(v), left - 5, Y(v), { ...tick, align: "right" });
  label(ctx, "O", left - 5, cy + 9, { ...tick, align: "right" });
  for (const d of [90, 180, 270, 360]) {
    label(ctx, s.unit === "rad" ? piFraction(d) : `${d}°`, X(d), Y(-1) + 13, { ...tick, align: "center" });
  }

  // curves
  for (const [fn, color] of [["sin", SIN], ["cos", COS]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let d = 0; d <= 360; d += 2) {
      if (d) ctx.lineTo(X(d), Y(trig(d)[fn]));
      else ctx.moveTo(X(d), Y(trig(d)[fn]));
    }
    ctx.stroke();
  }

  // current angle
  segment(ctx, X(s.deg), Y(1), X(s.deg), Y(-1), COLORS.orange, 1.5, [5, 4]);
  for (const [v, color] of [[t.sin, SIN], [t.cos, COS]]) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(X(s.deg), Y(v), small ? 4 : 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const top = Y(1) - (small ? 26 : 40);
  const legend = { size: small ? 11 : 15, bold: true };
  label(ctx, "y = sin x", left + 4, top, { ...legend, color: SIN });
  label(ctx, "y = cos x", left + (small ? 62 : 96), top, { ...legend, color: COS });
}

// The kit's slider always prints its raw number, so the angle slider is a custom control
// that shows degrees or radians as selected.
const angleSlider = {
  type: "custom",
  render(box, api) {
    const row = document.createElement("label");
    row.className = "row slider";
    const head = document.createElement("span");
    head.className = "row-head";
    const name = document.createElement("span");
    name.textContent = "Góc α";
    const out = document.createElement("output");
    head.append(name, out);
    const input = Object.assign(document.createElement("input"), { type: "range", min: 0, max: 360, step: 1 });
    row.append(head, input);
    box.append(row);
    const show = () => {
      api.state.deg = normDeg(api.state.deg); // not a kit slider, so clean host state here
      input.value = api.state.deg;
      out.textContent = api.state.unit === "rad" ? radText(api.state.deg) : `${api.state.deg}°`;
    };
    input.addEventListener("input", () => {
      api.state.deg = Number(input.value);
      show();
      api.redraw();
    });
    input.addEventListener("change", () => {
      report(api.state, api);
      api.emit("param", { key: "deg", value: api.state.deg }, "param");
    });
    return show;
  },
};

mount({
  slug: "duong-tron-luong-giac",
  version: "1.0.0",
  title: "Đường tròn lượng giác",
  hint: "Kéo điểm M trên đường tròn hoặc dùng thanh trượt để thay đổi góc α.",
  initialState,
  controls: [
    angleSlider,
    {
      type: "select",
      key: "unit",
      label: "Đơn vị đo góc",
      onChange: (s, api) => api.sync(),
      options: [
        { value: "deg", label: "Độ (°)" },
        { value: "rad", label: "Rađian (rad)" },
      ],
    },
    { type: "checkbox", key: "showGraph", label: "Hiện đồ thị y = sin x và y = cos x" },
  ],
  readouts: [
    { label: "Góc α", value: s => bare(angleText(s)) },
    { label: "sin α", value: s => bare(values(s).sin) },
    { label: "cos α", value: s => bare(values(s).cos) },
    { label: "tan α", value: s => bare(values(s).tan) },
    { label: "Góc phần tư", value: s => ROMAN[quadrant(s.deg)] || "Trên trục tọa độ" },
    {
      label: "Dấu của sin, cos, tan",
      value: s => {
        const g = signs(s.deg);
        return [g.sin, g.cos, g.tan].map(signText).join("; ");
      },
    },
    {
      label: "sin²α + cos²α",
      value: s => {
        const t = trig(s.deg);
        return num(t.sin * t.sin + t.cos * t.cos);
      },
    },
  ],
  pointer: {
    down(p, s, api, view) {
      const { cx, cy, R, regionW } = layout(s, view);
      if (p.x > regionW || Math.hypot(p.x - cx, p.y - cy) > R * 1.4) return false;
      setFromPointer(p, s, api, view);
      return true;
    },
    move: setFromPointer,
    up(p, s, api) {
      report(s, api);
      api.emit("param", { key: "deg", value: s.deg }, "param");
    },
  },
  draw(ctx, s, view) {
    const L = layout(s, view);
    drawCircle(ctx, s, L, view.h);
    if (s.showGraph) drawGraph(ctx, s, L, view);

    const v = values(s);
    const lineH = L.fs * 1.5;
    [
      [`α ${angleText(s)}`, COLORS.ink],
      [`sin α ${v.sin}`, SIN],
      [`cos α ${v.cos}`, COS],
      [`tan α ${v.tan}`, TAN],
    ].forEach(([text, color], i) => label(ctx, text, 14, 12 + (i + 0.5) * lineH, { color, size: L.fs, bold: true }));
  },
});
