import { mount, COLORS, label, fmt, arrow, clamp } from "../../kit/v1/kit.js";
import {
  REACTIONS, KEYS, INIT_KEYS, VOLUME, DT_RANGE, AMOUNT_STEP, MAX_ADD, initialState, restart, selectReaction, disturb, addAmount, step,
  reactionOf, temperature, kC, quotient, volume, amounts, concentrations, deltaGasMoles,
} from "./model.js";

const SPECIES_COLORS = [COLORS.blue, COLORS.orange, COLORS.purple];
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SAMPLE = 0.1; // s between graph points
const WINDOW = 40; // s of history shown at most

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = n => (n < 0 ? "⁻" : "") + String(Math.abs(n)).replace(/\d/g, d => SUP[d]);
/** 3 significant figures, switching to a × 10ⁿ outside 0,01..1000. */
const num = x => {
  if (!Number.isFinite(x)) return x > 0 ? "∞" : "–";
  if (x === 0) return "0";
  if (Math.abs(x) >= 0.01 && Math.abs(x) < 1000) return fmt(Number(x.toPrecision(3)), 4);
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = x / 10 ** e;
  if (Math.abs(Number(m.toFixed(2))) >= 10) (m /= 10), e++;
  return `${fmt(Number(m.toFixed(2)), 2)} × 10${sup(e)}`;
};
const celsius = T => `${fmt(T, 0)} K (${fmt(T - 273, 0)} °C)`;
const DIRECTION = { 1: "chiều thuận", "-1": "chiều nghịch", 0: "không chuyển dịch" };

/** −1, 0, 1: where the mixture is heading now (forward when Q < Kc). */
const heading = s => {
  const q = quotient(s);
  if (s.atEq || Number.isNaN(q)) return 0;
  return q < kC(s) ? 1 : -1;
};

// ---- transient history for the graph ----
function record(s, force) {
  if (!s._hist) (s._hist = []), (s._marks = []);
  const last = s._hist.at(-1);
  if (force || !last || s.time - last[0] >= SAMPLE - 1e-9) s._hist.push([s.time, ...concentrations(s)]);
  while (s._hist.length > 2 && s._hist[1][0] < s.time - WINDOW - 1) s._hist.shift();
}
const mark = (s, text) => {
  record(s, true);
  s._marks.push([s.time, text]);
  s._pred = null;
};
const fresh = s => {
  s._hist = null;
  s._pred = null;
  record(s, true);
};
/** Where the mixture goes from here if left alone (dashed on the graph), worked out once per disturbance. */
function prediction(s) {
  if (s._pred) return s._pred;
  const copy = Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith("_")));
  const pts = [[copy.time, ...concentrations(copy)]];
  let settled = 0;
  for (let i = 0; i < WINDOW * 60 && settled < 2; i++) {
    step(copy, 1 / 60);
    if (copy.atEq) settled += 1 / 60;
    if (i % 6 === 5) pts.push([copy.time, ...concentrations(copy)]);
  }
  return (s._pred = pts);
}
const invalidate = s => (disturb(s), (s._pred = null));

/** Report a disturbance and mark it on the graph. */
function disturbance(s, api, change, extra, text) {
  mark(s, text);
  api.emit("disturbance", { change, ...extra, volume: volume(s), temperature: temperature(s), q: quotient(s), kc: kC(s) }, "action");
}

// ---- controls ----
const rxOptions = Object.entries(REACTIONS).map(([value, rx]) => ({ value, label: rx.equation }));
const initSliders = Object.entries(REACTIONS).flatMap(([id, rx]) =>
  rx.species.map((name, i) => ({
    type: "slider",
    key: INIT_KEYS[i],
    label: `${name} ban đầu`,
    min: 0,
    max: MAX_ADD,
    step: 0.5,
    unit: "mol",
    digits: 1,
    visible: s => s.reaction === id,
    onChange: s => (restart(s), fresh(s)),
  }))
);
const amountButtons = Object.entries(REACTIONS).flatMap(([id, rx]) =>
  rx.species.flatMap((name, i) =>
    [1, -1].map(sign => ({
      type: "button",
      label: `${sign > 0 ? "Thêm" : "Lấy bớt"} ${fmt(AMOUNT_STEP, 1)} mol ${name}`,
      visible: s => s.reaction === id,
      disabled: s => (sign > 0 ? amounts(s)[i] >= MAX_ADD : amounts(s)[i] <= 0),
      action(s, api) {
        const done = addAmount(s, i, sign * AMOUNT_STEP);
        if (!done) return;
        disturbance(s, api, sign > 0 ? "add" : "remove", { species: i + 1, amount: done }, `${sign > 0 ? "+" : "−"}${name}`);
        api.play();
      },
    }))
  )
);

// ---- drawing ----
function layout(view) {
  const wide = view.w >= 560 && view.h >= 380;
  const pad = wide ? 16 : 8;
  const head = wide ? 48 : 22;
  const side = wide ? clamp(view.w * 0.3, 200, 270) : 0;
  const gauge = wide ? null : { x: pad, y: view.h - 58, w: view.w - 2 * pad };
  const graph = {
    x0: pad + side + (wide ? 48 : 34),
    x1: view.w - pad - 4,
    y0: head + (wide ? 22 : 16),
    y1: (gauge ? gauge.y - 4 : view.h) - (wide ? 40 : 22),
  };
  const left = wide ? { x: pad, y: head + 8, w: side - pad, h: view.h - head - 8 - pad } : null;
  return { wide, pad, head, graph, gauge, left, size: wide ? 13 : 11 };
}

const nice = x => [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40].find(v => v >= x * 1.05) ?? Math.ceil(x * 1.1);

function polyline(ctx, pts, i, X, Y, from) {
  ctx.beginPath();
  let started = false;
  for (const h of pts) {
    if (h[0] < from) continue;
    if (started) ctx.lineTo(X(h[0]), Y(h[i + 1]));
    else ctx.moveTo(X(h[0]), Y(h[i + 1])), (started = true);
  }
  ctx.stroke();
}

function drawGraph(ctx, s, g) {
  const { x0, x1, y0, y1 } = g.graph;
  if (y1 - y0 < 40) return;
  const rx = reactionOf(s);
  const hist = s._hist ?? [];
  const pred = prediction(s);
  const tEnd = Math.max(10, s.time + 4);
  const tStart = Math.max(0, tEnd - WINDOW);
  const shown = [...hist, ...pred].filter(h => h[0] >= tStart - SAMPLE && h[0] <= tEnd);
  const cMax = nice(Math.max(0.1, ...shown.flatMap(h => h.slice(1))));
  const X = t => x0 + ((x1 - x0) * (t - tStart)) / (tEnd - tStart);
  const Y = c => y1 - ((y1 - y0) * c) / cMax;
  const size = g.size;

  ctx.fillStyle = "#fff";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const c = (cMax * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x0, Y(c));
    ctx.lineTo(x1, Y(c));
    ctx.stroke();
    if (g.wide || i % 2 === 0) label(ctx, fmt(c, 2), x0 - 5, Y(c), { size, align: "right", color: COLORS.muted });
  }
  const dt = [2, 5, 10, 20].find(v => (tEnd - tStart) / v <= 6) ?? 20;
  for (let t = Math.ceil(tStart / dt) * dt; t <= tEnd + 1e-9; t += dt) {
    ctx.beginPath();
    ctx.moveTo(X(t), y0);
    ctx.lineTo(X(t), y1);
    ctx.stroke();
    if (X(t) < x1 - size * 3.5) label(ctx, fmt(t, 0), X(t), y1 + size * 0.9, { size, align: "center", color: COLORS.muted });
  }
  label(ctx, g.wide ? "Nồng độ (mol/L)" : "mol/L", x0, y0 - size * 0.9, { size, color: COLORS.muted });
  label(ctx, "t (s)", x1, y1 + size * 0.9, { size, align: "right", color: COLORS.muted });
  if (g.wide) label(ctx, "Nét đứt: diễn biến dự đoán nếu không tác động thêm · thời gian minh họa", x0, y1 + size * 2.4, { size: size - 1, color: COLORS.muted });

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0 - 2, x1 - x0, y1 - y0 + 4);
  ctx.clip();
  for (const [t, text] of s._marks ?? []) {
    if (t < tStart) continue;
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(X(t), y0);
    ctx.lineTo(X(t), y1);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, text, X(t) + 3, y0 + size, { size, bold: true });
  }
  ctx.lineJoin = "round";
  rx.species.forEach((_, i) => {
    ctx.strokeStyle = SPECIES_COLORS[i];
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    polyline(ctx, pred, i, X, Y, tStart);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.5;
    polyline(ctx, hist, i, X, Y, tStart - SAMPLE);
  });
  ctx.restore();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** Header: equation, ΔH, legend with live concentrations. */
function drawHeader(ctx, s, g) {
  const rx = reactionOf(s);
  const c = concentrations(s);
  const size = g.wide ? 14 : 11;
  let x = g.pad;
  if (g.wide) {
    const sign = rx.dH > 0 ? "+" : "−";
    label(ctx, `${rx.equation}    ΔrH°₂₉₈ = ${sign}${fmt(Math.abs(rx.dH), 1)} kJ (${rx.dH > 0 ? "thu nhiệt" : "tỏa nhiệt"})`, x, 16, { size: 16, bold: true });
  }
  const ly = g.wide ? 38 : 10;
  rx.species.forEach((name, i) => {
    ctx.fillStyle = SPECIES_COLORS[i];
    ctx.fillRect(x, ly - 2, 12, 4);
    x += 16;
    const text = `[${name}] = ${fmt(c[i], g.wide ? 3 : 2)}`;
    label(ctx, text, x, ly, { size, bold: true, color: SPECIES_COLORS[i] });
    ctx.font = `600 ${size}px ${FONT}`;
    x += ctx.measureText(text).width + (g.wide ? 18 : 9);
  });
  label(ctx, "mol/L", x - (g.wide ? 12 : 5), ly, { size, color: COLORS.muted });
}

/** Q against Kc on a log scale, and where the equilibrium is heading. Returns the height used. */
function drawGauge(ctx, s, box, small) {
  const K = kC(s);
  const q = quotient(s);
  const size = small ? 11 : 13;
  const x0 = box.x + 10;
  const x1 = box.x + box.w - 10;
  const yAxis = box.y + size * 2 + 18;
  const lk = Math.log10(K);
  const span = 2; // decades either side of Kc
  const X = v => x0 + ((x1 - x0) * (clamp(Math.log10(v), lk - span, lk + span) - (lk - span))) / (2 * span);
  const dir = heading(s);
  const color = dir > 0 ? COLORS.green : dir < 0 ? COLORS.red : COLORS.ink;
  let text;
  if (Number.isNaN(q)) text = "Không có chất nào phản ứng được";
  else if (dir > 0) text = "Q < Kc: chuyển dịch theo chiều thuận";
  else if (dir < 0) text = "Q > Kc: chuyển dịch theo chiều nghịch";
  else text = "Q = Kc: hệ ở trạng thái cân bằng";
  label(ctx, text, box.x, box.y + size * 0.7, { size, bold: true, color });
  if (dir === 0 && s.time > 0 && !Number.isNaN(q)) {
    label(ctx, `Lần vừa rồi: ${DIRECTION[s.shift]}`, box.x, box.y + size * 2, { size: size - 1, color: COLORS.muted });
  }

  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, yAxis);
  ctx.lineTo(x1, yAxis);
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(X(K) - 1.5, yAxis - 8, 3, 16);
  label(ctx, `Kc = ${num(K)}`, X(K), yAxis + size + 2, { size: size - 1, align: "center", bold: true });
  if (!Number.isNaN(q)) {
    const xq = q === Infinity ? x1 : q === 0 ? x0 : X(q);
    if (dir) arrow(ctx, xq, yAxis, xq + dir * Math.min(36, Math.abs(X(K) - xq)), yAxis, color, 2.5);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(xq, yAxis, 5, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, "Q", xq, yAxis - 13, { size, align: "center", bold: true, color });
  }
  return yAxis + size * 2 + 6 - box.y;
}

/** The closed vessel: width shows the volume, dots the amount of each gas (5 per mol). */
function drawVessel(ctx, s, box) {
  const V = volume(s);
  const hMax = box.h;
  const wMax = box.w - 14;
  const w = (wMax * V) / VOLUME[1];
  const { x, y } = box;
  const T = temperature(s);
  const warm = (T - reactionOf(s).tMid) / DT_RANGE; // −1..1
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, hMax);
  ctx.fillStyle = warm > 0 ? `rgba(229,72,77,${0.15 * warm})` : `rgba(47,111,237,${-0.15 * warm})`;
  ctx.fillRect(x, y, w, hMax);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  amounts(s).forEach((n, i) => {
    ctx.fillStyle = SPECIES_COLORS[i];
    for (let k = 0; k < Math.round(n * 5); k++) {
      ctx.beginPath();
      ctx.arc(x + 4 + rand() * (w - 8), y + 4 + rand() * (hMax - 8), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, hMax);
  ctx.fillStyle = COLORS.muted; // piston
  ctx.fillRect(x + w, y - 4, 6, hMax + 8);
  ctx.fillRect(x + w + 6, y + hMax / 2 - 3, wMax - w + 8, 6);
  label(ctx, `V = ${fmt(V, 1)} L`, x, y + hMax + 13, { size: 13, bold: true });
  label(ctx, `T = ${celsius(T)}`, x + box.w, y + hMax + 13, { size: 13, align: "right", bold: true, color: warm > 0.01 ? COLORS.red : warm < -0.01 ? COLORS.blue : COLORS.ink });
  label(ctx, "Mỗi chấm ≈ 0,2 mol khí", x, y + hMax + 31, { size: 11, color: COLORS.muted });
}

mount({
  slug: "can-bang-hoa-hoc",
  version: "1.0.0",
  title: "Cân bằng hóa học và nguyên lí Lơ Sa-tơ-li-ê",
  hint: "Chờ hệ đạt cân bằng, rồi thêm hoặc lấy bớt một chất, nén hay giãn bình, đun nóng hay làm lạnh và xem cân bằng chuyển dịch theo chiều nào.",
  initialState,
  autoplay: true,
  timeScale: s => s.speed,
  sanitize(incoming, base) {
    const s = { ...base };
    for (const key of Object.keys(base)) {
      const v = incoming[key];
      if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) s[key] = v;
    }
    if (!REACTIONS[s.reaction]) s.reaction = base.reaction;
    s.time = Math.max(0, s.time);
    for (const k of KEYS) s[k] = clamp(s[k], 0, 20);
    return s;
  },
  step(s, dt, api) {
    const was = s.atEq;
    step(s, dt);
    record(s);
    if (!was && s.atEq) {
      const c = concentrations(s);
      const data = { kc: kC(s), q: quotient(s), shift: s.shift, temperature: temperature(s), volume: volume(s), time: s.time };
      c.forEach((v, i) => (data[`c${i + 1}`] = v));
      if (Number.isNaN(data.q)) delete data.q;
      api.emit("equilibrium-reached", data, "result");
    }
  },
  controls: [
    { type: "select", key: "reaction", label: "Phản ứng", options: rxOptions, onChange: s => (selectReaction(s), fresh(s), (s._lastV = s.volume), (s._lastT = s.dT)) },
    { type: "heading", label: "Lượng chất ban đầu (bắt đầu lại)" },
    ...initSliders,
    { type: "heading", label: "Tác động vào cân bằng" },
    ...amountButtons,
    {
      type: "slider",
      key: "volume",
      label: "Thể tích bình",
      min: VOLUME[0],
      max: VOLUME[1],
      step: 0.1,
      unit: "L",
      digits: 1,
      onChange: invalidate,
      onCommit(s, api) {
        const squeezed = s.volume < (s._lastV ?? 1);
        s._lastV = s.volume;
        disturbance(s, api, "volume", {}, squeezed ? "nén" : "giãn");
        api.play();
      },
    },
    {
      type: "slider",
      key: "dT",
      label: "Nhiệt độ",
      min: -DT_RANGE,
      max: DT_RANGE,
      step: 10,
      format: (_, s) => celsius(temperature(s)),
      onChange: invalidate,
      onCommit(s, api) {
        const up = s.dT > (s._lastT ?? 0);
        s._lastT = s.dT;
        disturbance(s, api, "temperature", {}, up ? "T↑" : "T↓");
        api.play();
      },
    },
    {
      type: "select",
      key: "speed",
      label: "Tốc độ mô phỏng",
      options: [
        { value: 1, label: "Bình thường" },
        { value: 4, label: "Nhanh gấp 4" },
      ],
    },
  ],
  readouts: [
    { label: "Hằng số cân bằng Kc", value: s => num(kC(s)) },
    { label: "Thương số phản ứng Q", value: s => num(quotient(s)) },
    { label: "Hệ đang", value: s => (heading(s) > 0 ? "chuyển dịch theo chiều thuận" : heading(s) < 0 ? "chuyển dịch theo chiều nghịch" : "ở trạng thái cân bằng") },
    { label: "Lần chuyển dịch gần nhất", value: s => (s.atEq ? DIRECTION[s.shift] : "–") },
    { label: "Số mol khí: trước → sau", value: s => { const rx = reactionOf(s); const r = -rx.nu.filter(v => v < 0).reduce((a, b) => a + b, 0); return `${r} → ${r + deltaGasMoles(rx)}`; } },
  ],
  draw(ctx, s, view) {
    const g = layout(view);
    if (!s._hist) fresh(s);
    s._lastV ??= s.volume;
    s._lastT ??= s.dT;
    drawHeader(ctx, s, g);
    drawGraph(ctx, s, g);
    if (g.left) {
      const L = g.left;
      const gaugeH = 84;
      const notesH = 34;
      const vesselH = clamp(L.h - gaugeH - notesH - 70, 60, 240);
      drawVessel(ctx, s, { x: L.x, y: L.y + 8, w: L.w, h: vesselH });
      drawGauge(ctx, s, { x: L.x, y: L.y + vesselH + 50, w: L.w }, L.w < 230);
      ["Mô hình động học đơn giản (định luật", "tác dụng khối lượng); hình không theo tỉ lệ."].forEach((t, i) =>
        label(ctx, t, L.x, view.h - 30 + i * 15, { size: 11, color: COLORS.muted })
      );
    } else {
      drawGauge(ctx, s, g.gauge, true);
    }
  },
});
