import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  initialState, VIOLET, RED, SCREEN_DISTANCE as L, SCREEN_HALF as HALF, TOLERANCE, measuring, isWhite, activeWavelength,
  gratingPeriod, aperture, orderAngle, maxOrder, slitMinimumAngle, slitIntensity, screenPosition, centralWidth, angleOf, answerOk, newSource,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const deg = rad => (rad * 180) / Math.PI;
const isSlit = s => s.mode === "slit";
const SAMPLES = Array.from({ length: 20 }, (_, i) => VIOLET + 20 * i); // white light, for the single slit
const RAYS = [VIOLET, 430, 480, 530, 580, 630, 700, RED]; // white light, rays drawn through the grating

// Approximate screen colour of a wavelength (nm), channels 0..1; dimmer towards both ends of the spectrum.
function rgb(nm) {
  let c;
  if (nm < 440) c = [(440 - nm) / 60, 0, 1];
  else if (nm < 490) c = [0, (nm - 440) / 50, 1];
  else if (nm < 510) c = [0, 1, (510 - nm) / 20];
  else if (nm < 580) c = [(nm - 510) / 70, 1, 0];
  else if (nm < 645) c = [1, (645 - nm) / 65, 0];
  else c = [1, 0, 0];
  const fade = nm < 420 ? 0.4 + (0.6 * (nm - 380)) / 40 : nm > 700 ? 0.4 + (0.6 * (760 - nm)) / 60 : 1;
  return c.map(v => clamp(v, 0, 1) * fade);
}
const css = (c, alpha = 1) => `rgba(${c.map(v => Math.round(255 * clamp(v, 0, 1))).join(", ")}, ${alpha})`;
const WHITE_SUM = SAMPLES.map(rgb).reduce((a, c) => a.map((v, i) => v + c[i]), [0, 0, 0]);

function fit(ctx, texts, maxW, size, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  return texts.find(t => ctx.measureText(t).width <= maxW) ?? texts.at(-1);
}

// Lines of text on a translucent plate, so rays passing behind stay out of the way. `up` stacks from the bottom.
function block(ctx, lines, x, y, maxW, size, lh, up = false) {
  const shown = lines.map(l => ({ ...l, text: fit(ctx, l.texts, maxW, size, l.bold) }));
  const width = Math.max(...shown.map(l => (ctx.font = `${l.bold ? "600 " : ""}${size}px ${FONT}`) && ctx.measureText(l.text).width));
  const y0 = up ? y - lh * shown.length : y;
  ctx.fillStyle = "rgba(247, 249, 253, 0.85)";
  ctx.fillRect(x - 4, y0, width + 8, lh * shown.length);
  shown.forEach((l, i) => label(ctx, l.text, x, y0 + lh * (i + 0.5), { size, color: l.color ?? COLORS.ink, bold: l.bold }));
}

function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const pad = small ? 6 : 10;
  const bandW = small ? 20 : 38;
  const rulerW = small ? 28 : 44;
  const leftPad = small ? 26 : 70;
  const scale = Math.max(40, Math.min((view.h - 2 * pad) / (2 * HALF), (view.w - leftPad - bandW - rulerW) / L)); // px per metre
  const xG = leftPad + (view.w - leftPad - bandW - rulerW - scale * L) / 2;
  const cy = view.h / 2;
  return { small, bandW, rulerW, scale, xG, xS: xG + scale * L, cy, yTop: cy - scale * HALF, yBot: cy + scale * HALF };
}

const report = (s, api) => {
  const d = aperture(s);
  const lam = isWhite(s) ? VIOLET : activeWavelength(s);
  const data = isSlit(s)
    ? { slit: 1, aperture: d, firstMinimumAngle: deg(slitMinimumAngle(1, lam, d)), centralWidth: 100 * centralWidth(lam, d) }
    : { slit: 0, aperture: d, firstOrderAngle: deg(orderAngle(1, lam, d)), maxOrder: maxOrder(lam, d), ...(isWhite(s) && { firstOrderAngleRed: deg(orderAngle(1, RED, d)) }) };
  api.emit("pattern-set", { ...data, ...(!isWhite(s) && { wavelength: lam }) }, "result");
};
const clearFeedback = s => {
  s.feedback = "";
};
const setCursor = (p, s, view) => {
  const g = geom(view);
  s.cursor = clamp(Math.round(((g.cy - p.y) / g.scale) * 1000) / 10, -50, 50);
};

function drawScreen(ctx, s, g) {
  const { xS, bandW, cy, scale, yTop, yBot } = g;
  const d = aperture(s);
  const lam = activeWavelength(s);
  const white = isWhite(s);
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(xS, yTop, bandW, yBot - yTop);
  if (isSlit(s) || white) {
    const kMax = maxOrder(VIOLET, d);
    for (let py = Math.ceil(yTop); py < yBot; py++) {
      const x = (cy - py - 0.5) / scale;
      const sin = Math.abs(x) / Math.hypot(x, L);
      let c = [0, 0, 0];
      if (!isSlit(s)) {
        // grating, white light: every order k puts the wavelength d·sinθ/k at this point
        for (let k = 1; k <= kMax; k++) {
          const nm = (d * sin) / k;
          if (nm >= VIOLET && nm <= RED) c = c.map((v, i) => v + rgb(nm)[i]);
        }
      } else if (white) {
        for (const nm of SAMPLES) c = c.map((v, i) => v + rgb(nm)[i] * slitIntensity(sin, nm, d));
        c = c.map((v, i) => (v / WHITE_SUM[i]) ** 0.45);
      } else {
        c = rgb(lam).map(v => v * slitIntensity(sin, lam, d) ** 0.4); // secondary maxima brightened to be visible
      }
      if (c.some(v => v > 0.01)) {
        ctx.fillStyle = css(c);
        ctx.fillRect(xS, py, bandW, 1);
      }
    }
  }
  if (!isSlit(s)) {
    // sharp principal maxima; order 0 is white for white light
    for (let k = white ? 0 : -maxOrder(lam, d); k <= (white ? 0 : maxOrder(lam, d)); k++) {
      const y = cy - scale * screenPosition(orderAngle(k, lam, d));
      if (y < yTop || y > yBot) continue;
      const c = white ? [1, 1, 1] : rgb(lam);
      ctx.fillStyle = css(c, 0.35);
      ctx.fillRect(xS, y - 3.5, bandW, 7);
      ctx.fillStyle = css(c);
      ctx.fillRect(xS, y - 1.5, bandW, 3);
    }
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(xS, yTop, bandW, yBot - yTop);

  // ruler in cm
  const xr = xS + bandW;
  const every = scale >= 450 ? 10 : 25;
  const size = g.small ? 9 : 11;
  ctx.lineWidth = 1;
  for (let cm = -50; cm <= 50; cm += 5) {
    const y = cy - (scale * cm) / 100;
    ctx.beginPath();
    ctx.moveTo(xr, y);
    ctx.lineTo(xr + (cm % 10 === 0 ? 6 : 3), y);
    ctx.stroke();
    if (cm % every === 0) label(ctx, cm === 0 ? "0 cm" : fmt(cm, 0), xr + 9, clamp(y, yTop + 5, yBot - 5), { size, color: COLORS.muted });
  }
}

function drawRays(ctx, s, g) {
  const { xG, xS, cy, scale, yTop, yBot } = g;
  const d = aperture(s);
  const lam = activeWavelength(s);
  const white = isWhite(s);
  const far = 3 * scale;
  const ray = (theta, color, width = 1.5) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(xG, cy);
    ctx.lineTo(xG + far * Math.cos(theta), cy - far * Math.sin(theta));
    ctx.stroke();
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, yTop, xS, yBot - yTop);
  ctx.clip();
  if (isSlit(s)) {
    // the central maximum, between the two first minima
    const t1 = slitMinimumAngle(1, white ? 570 : lam, d) ?? Math.PI / 2;
    ctx.fillStyle = white ? "rgba(107, 120, 144, 0.16)" : css(rgb(lam), 0.25);
    ctx.beginPath();
    ctx.moveTo(xG, cy);
    ctx.lineTo(xG + far * Math.cos(t1), cy - far * Math.sin(t1));
    ctx.lineTo(xG + far * Math.cos(t1), cy + far * Math.sin(t1));
    ctx.fill();
    if (!white) {
      // intensity curve, drawn leftwards from the screen
      const cw = 0.2 * scale;
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let py = yTop; py <= yBot; py++) {
        const x = (cy - py) / scale;
        ctx.lineTo(xS - 1 - cw * slitIntensity(x / Math.hypot(x, L), lam, d), py);
      }
      ctx.stroke();
    }
  } else if (white) {
    ray(0, COLORS.muted);
    // only the rays that reach the screen: with every order drawn the fan would hide everything else
    for (const nm of RAYS) {
      for (let k = 1; k <= maxOrder(nm, d) && screenPosition(orderAngle(k, nm, d)) <= HALF; k++) {
        ray(orderAngle(k, nm, d), css(rgb(nm), 0.8), 1);
        ray(-orderAngle(k, nm, d), css(rgb(nm), 0.8), 1);
      }
    }
  } else {
    for (let k = -maxOrder(lam, d); k <= maxOrder(lam, d); k++) ray(orderAngle(k, lam, d), css(rgb(lam), 0.9));
  }
  ctx.restore();

  // order labels just left of the screen, when the maxima are far enough apart to label
  if (!isSlit(s)) {
    const size = g.small ? 10 : 12;
    const ref = white ? VIOLET : lam;
    const yOf = k => cy - scale * screenPosition(orderAngle(k, ref, d));
    const kMax = maxOrder(ref, d);
    const roomy = kMax >= 2 ? yOf(1) - yOf(2) >= size + 3 : true;
    for (let k = -kMax; k <= kMax; k++) {
      if (!roomy && Math.abs(k) > 1) continue;
      const y = yOf(k);
      if (y < yTop + 8 || y > yBot - 8) continue;
      label(ctx, k === 0 || (k === 1 && !g.small) ? `k = ${k}` : fmt(k, 0), xS - 5, y - (k < 0 ? -8 : 8), { size, align: "right", color: COLORS.ink, bold: true });
    }
  }
}

function drawSource(ctx, s, g) {
  const { xG, cy, scale, small } = g;
  const white = isWhite(s);
  const bw = small ? 6 : 10;
  ctx.fillStyle = white ? "#fff" : css(rgb(activeWavelength(s)), 0.85);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.fillRect(0, cy - bw / 2, xG, bw);
  if (white) ctx.strokeRect(-1, cy - bw / 2, xG + 1, bw);
  if (!small) label(ctx, fit(ctx, [white ? "ánh sáng trắng" : "ánh sáng tới", ""], xG - 12, 12), 6, cy + bw / 2 + 12, { size: 12, color: COLORS.muted });
  // optical axis
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(xG, cy);
  ctx.lineTo(g.xS, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  // the grating or the slit, drawn much enlarged
  const gh = 0.22 * scale;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = small ? 3 : 4;
  ctx.beginPath();
  if (isSlit(s)) {
    const gap = clamp(s.slitWidth * 1.4, 3, 14);
    ctx.moveTo(xG, cy - gh / 2);
    ctx.lineTo(xG, cy - gap / 2);
    ctx.moveTo(xG, cy + gap / 2);
    ctx.lineTo(xG, cy + gh / 2);
  } else {
    const dash = clamp(900 / s.lines, 1.5, 8);
    ctx.setLineDash([dash, dash]);
    ctx.moveTo(xG, cy - gh / 2);
    ctx.lineTo(xG, cy + gh / 2);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, isSlit(s) ? "Khe hẹp" : "Cách tử", Math.max(4, xG - (small ? 22 : 26)), cy - gh / 2 - 10, { size: small ? 11 : 13, bold: true });
}

function drawCursor(ctx, s, g) {
  const { xG, xS, bandW, cy, scale } = g;
  const y = cy - (scale * s.cursor) / 100;
  const theta = angleOf(s.cursor / 100);
  ctx.strokeStyle = COLORS.purple;
  ctx.fillStyle = COLORS.purple;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(xG, cy);
  ctx.lineTo(xS, y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (Math.abs(theta) > 0.03) {
    const r = 0.17 * scale;
    ctx.beginPath();
    ctx.arc(xG, cy, r, Math.min(0, -theta), Math.max(0, -theta));
    ctx.stroke();
    label(ctx, "θ", xG + (r + 8) * Math.cos(theta / 2), cy - (r + 8) * Math.sin(theta / 2), { size: g.small ? 11 : 14, color: COLORS.purple, align: "center", bold: true });
  }
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xS - 6, y);
  ctx.lineTo(xS + bandW + 2, y);
  ctx.stroke();
  ctx.beginPath(); // handle
  ctx.moveTo(xS + bandW + 1, y);
  ctx.lineTo(xS + bandW + 10, y - 6);
  ctx.lineTo(xS + bandW + 10, y + 6);
  ctx.fill();
}

function textLines(s) {
  const d = aperture(s);
  const lam = activeWavelength(s);
  const white = isWhite(s);
  const hide = measuring(s);
  const um = `${fmt(d / 1000, 2)} μm`;
  const lines = [];
  const add = (texts, color, bold) => lines.push({ texts, color, bold });
  const a1 = nm => `${fmt(deg(orderAngle(1, nm, d)), 1)}°`;
  if (isSlit(s)) {
    add(["Nhiễu xạ qua một khe: vân tối khi a·sinθ = k·λ (k = ±1, ±2, …)", "Vân tối: a·sinθ = k·λ (k ≠ 0)", "a·sinθ = k·λ"], COLORS.ink, true);
    add(hide ? [`a = ${um};  λ = ?`] : white ? [`a = ${um};  λ từ ${VIOLET} nm (tím) đến ${RED} nm (đỏ)`, `a = ${um}; λ: ${VIOLET}–${RED} nm`] : [`a = ${um};  λ = ${fmt(lam, 0)} nm`]);
    if (hide) add(["Đặt con trỏ vào vân tối thứ nhất, đọc θ rồi tính λ = a·sinθ.", "Đo θ của vân tối thứ nhất: λ = a·sinθ", "λ = a·sinθ (vân tối 1)"], COLORS.blue);
    else if (white) add(["Vân trung tâm trắng, hai mép nhuốm màu: ánh sáng đỏ nhiễu xạ rộng hơn ánh sáng tím.", "Vân trung tâm trắng, mép nhuốm màu", "Vân giữa trắng, mép có màu"], COLORS.blue);
    else {
      const w = `${fmt(100 * centralWidth(lam, d), 1)} cm`;
      add([`Vân tối thứ nhất: θ = ${a1(lam)};  vân sáng trung tâm rộng ${w}`, `Vân tối 1: θ = ${a1(lam)}; vân trung tâm rộng ${w}`, `Vân trung tâm rộng ${w}`], COLORS.blue);
    }
  } else {
    add(["Cách tử nhiễu xạ: vân sáng chính khi d·sinθ = k·λ (k = 0, ±1, ±2, …)", "Vân sáng chính: d·sinθ = k·λ", "d·sinθ = k·λ"], COLORS.ink, true);
    const period = [`d = 1/${fmt(s.lines, 0)} mm = ${um}`, `d = ${um}`];
    add(hide ? period.map(p => `${p};  λ = ?`) : white ? [`${period[0]};  λ từ ${VIOLET} nm (tím) đến ${RED} nm (đỏ)`, `${period[1]}; λ: ${VIOLET}–${RED} nm`] : period.map(p => `${p};  λ = ${fmt(lam, 0)} nm`));
    if (hide) add(["Đặt con trỏ vào một vân sáng bậc k, đọc θ rồi tính λ = d·sinθ / k.", "Đo θ của vân sáng bậc k: λ = d·sinθ/k", "λ = d·sinθ/k"], COLORS.blue);
    else if (white) add([`Bậc 1: tím θ = ${a1(VIOLET)}, đỏ θ = ${a1(RED)}. Trong mỗi bậc, tím gần vân trung tâm nhất, đỏ lệch nhiều nhất.`, `Bậc 1: tím ${a1(VIOLET)} → đỏ ${a1(RED)} (tím gần tâm nhất)`, `Bậc 1: tím ${a1(VIOLET)} → đỏ ${a1(RED)}`], COLORS.blue);
    else {
      const x1 = `${fmt(100 * screenPosition(orderAngle(1, lam, d)), 1)} cm`;
      const km = maxOrder(lam, d);
      add([`Bậc 1: θ₁ = ${a1(lam)}, x₁ = L·tanθ₁ = ${x1};  bậc cao nhất kmax = ⌊d/λ⌋ = ${km}`, `θ₁ = ${a1(lam)}; x₁ = ${x1}; kmax = ${km}`, `θ₁ = ${a1(lam)}; kmax = ${km}`], COLORS.blue);
    }
  }
  const theta = angleOf(s.cursor / 100);
  const x = `x = ${fmt(s.cursor, 1)} cm`;
  const th = `θ = ${fmt(deg(theta), 2)}°`;
  add([`Con trỏ: ${x};  ${th};  sinθ = ${fmt(Math.sin(theta), 4)}`, `${x}; ${th}; sinθ = ${fmt(Math.sin(theta), 4)}`, `${x}; ${th}`], COLORS.purple);
  if (hide && s.feedback === "correct") add([`Đúng! Bước sóng của nguồn là λ = ${fmt(lam, 0)} nm.`, `Đúng! λ = ${fmt(lam, 0)} nm`], COLORS.green, true);
  if (hide && s.feedback === "wrong") add([`Chưa đúng (cho phép lệch ±${TOLERANCE} nm). Xem lại vị trí con trỏ và bậc k.`, `Chưa đúng (cho phép ±${TOLERANCE} nm)`], COLORS.red, true);
  return lines;
}

mount({
  slug: "cach-tu-nhieu-xa",
  version: "1.0.0",
  title: "Nhiễu xạ ánh sáng và cách tử",
  hint: "Kéo con trỏ tím trên màn để đo vị trí x và góc lệch θ của một vân.",
  initialState,
  controls: [
    {
      type: "select",
      key: "task",
      label: "Nhiệm vụ",
      options: [
        { value: "explore", label: "Khám phá" },
        { value: "measure", label: "Đo bước sóng chưa biết" },
      ],
      onChange: s => (measuring(s) ? newSource(s) : clearFeedback(s)),
    },
    {
      type: "select",
      key: "mode",
      label: "Ánh sáng đi qua",
      options: [
        { value: "grating", label: "Cách tử nhiễu xạ" },
        { value: "slit", label: "Một khe hẹp" },
      ],
      onChange: clearFeedback,
      onCommit: report,
    },
    {
      type: "select",
      key: "source",
      label: "Nguồn sáng",
      options: [
        { value: "mono", label: "Ánh sáng đơn sắc" },
        { value: "white", label: "Ánh sáng trắng" },
      ],
      visible: s => !measuring(s),
      onCommit: report,
    },
    { type: "slider", key: "wavelength", label: "Bước sóng λ", min: VIOLET, max: RED, step: 5, unit: "nm", digits: 0, visible: s => !measuring(s) && !isWhite(s), onCommit: report },
    {
      type: "slider",
      key: "lines",
      label: "Số vạch trên 1 mm",
      min: 100,
      max: 600,
      step: 50,
      format: v => `${fmt(v, 0)} (d = ${fmt(gratingPeriod(v) / 1000, 2)} μm)`,
      visible: s => !isSlit(s),
      onChange: clearFeedback,
      onCommit: report,
    },
    { type: "slider", key: "slitWidth", label: "Bề rộng khe a", min: 1, max: 10, step: 0.5, unit: "μm", digits: 1, visible: isSlit, onChange: clearFeedback, onCommit: report },
    { type: "slider", key: "cursor", label: "Con trỏ đo x", min: -50, max: 50, step: 0.1, format: v => `${fmt(v, 1)} cm (θ = ${fmt(deg(angleOf(v / 100)), 2)}°)` },
    { type: "slider", key: "answer", label: "Bước sóng em đo được", min: VIOLET, max: RED, step: 5, unit: "nm", digits: 0, visible: measuring, onChange: clearFeedback },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: measuring,
      action(s, api) {
        const ok = answerOk(s);
        s.feedback = ok ? "correct" : "wrong";
        api.emit("answer-checked", { answer: s.answer, correct: ok ? 1 : 0 }, "action");
        if (ok) api.emit("wavelength-measured", { answer: s.answer, wavelength: activeWavelength(s), error: Math.abs(s.answer - activeWavelength(s)) }, "goal");
      },
    },
    { type: "button", label: "Nguồn sáng mới", visible: measuring, action: s => newSource(s), event: "new-source" },
  ],
  readouts: [
    { label: "Chu kì d hoặc bề rộng a", value: s => `${fmt(aperture(s) / 1000, 2)} μm` },
    {
      label: "Góc bậc 1 / vân tối 1",
      value: s => {
        if (measuring(s)) return "?";
        const a = nm => `${fmt(deg(orderAngle(1, nm, aperture(s))), 1)}°`;
        return isWhite(s) ? `${a(VIOLET)} – ${a(RED)}` : a(activeWavelength(s));
      },
    },
    { label: "Bậc cao nhất kmax", value: s => (isSlit(s) ? "–" : measuring(s) ? "?" : String(maxOrder(isWhite(s) ? VIOLET : activeWavelength(s), aperture(s)))) },
    { label: "Bề rộng vân trung tâm", value: s => (!isSlit(s) || isWhite(s) ? "–" : measuring(s) ? "?" : `${fmt(100 * centralWidth(activeWavelength(s), aperture(s)), 1)} cm`) },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      if (p.x < g.xS - 24) return false;
      setCursor(p, s, view);
    },
    move: (p, s, api, view) => setCursor(p, s, view),
    up(p, s, api) {
      api.emit("cursor-placed", { position: s.cursor, angle: deg(angleOf(s.cursor / 100)) }, "action");
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    drawSource(ctx, s, g);
    drawRays(ctx, s, g);
    drawScreen(ctx, s, g);
    drawCursor(ctx, s, g);
    const size = g.small ? 11 : 14;
    const lh = g.small ? 14 : 21;
    const maxW = g.xS - 16;
    block(ctx, textLines(s), 8, g.small ? 3 : 8, maxW, size, lh);
    const notes = [{ texts: ["Hình không theo tỉ lệ: khe, cách tử và chùm sáng tới được vẽ phóng to. Màn đặt cách L = 1 m.", "Không theo tỉ lệ. Màn cách L = 1 m.", "Không theo tỉ lệ; L = 1 m"], color: COLORS.muted }];
    if (isSlit(s)) notes.unshift({ texts: ["Các vân phụ được vẽ sáng hơn thực tế để dễ quan sát.", "Vân phụ vẽ sáng hơn thực tế"], color: COLORS.muted });
    block(ctx, notes, 8, view.h - (g.small ? 3 : 6), maxW, g.small ? 10 : 12, g.small ? 12 : 16, true);
  },
});
