import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  initialState, COMPONENTS, NAMES, PATHS, signalAt, totalTime, pathLength, centralDelay, checkOrder, stats, rulerTime,
  rulerDistance, startTrial, tap, timeout, RULER, MAX_TRIALS, MIN_RT, MAX_SCREEN_RT,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ms = x => `${fmt(x * 1000, 1)} ms`;
const KIND = { spinal: { name: "Phản xạ tủy sống", color: COLORS.red }, conscious: { name: "Phản ứng có ý thức (qua não)", color: COLORS.blue } };

// Diagram polylines in a unit box (x right, y down). Each path stage has its own polyline.
const POLY = {
  spinal: {
    aff: [[0.9, 0.7], [0.62, 0.66], [0.4, 0.6], [0.3, 0.56]],
    cord: [[0.3, 0.56], [0.255, 0.5], [0.3, 0.44]],
    eff: [[0.3, 0.44], [0.45, 0.4], [0.6, 0.4]],
  },
  conscious: {
    aff: [[0.9, 0.715], [0.62, 0.675], [0.4, 0.615], [0.3, 0.575]],
    up: [[0.3, 0.575], [0.235, 0.53], [0.235, 0.2]],
    brain: [[0.235, 0.2], [0.25, 0.14], [0.275, 0.2]],
    down: [[0.275, 0.2], [0.275, 0.4], [0.3, 0.425]],
    eff: [[0.3, 0.425], [0.45, 0.385], [0.6, 0.385]],
  },
};
const MARKS = { receptor: [0.9, 0.7], afferent: [0.55, 0.64], centre: [0.255, 0.5], efferent: [0.45, 0.4], effector: [0.66, 0.36] };

/** Point at fraction f along a polyline. */
function along(poly, f) {
  const segs = poly.slice(1).map((p, i) => Math.hypot(p[0] - poly[i][0], p[1] - poly[i][1]));
  let d = f * segs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? Math.min(1, d / segs[i]) : 0;
      return [poly[i][0] + (poly[i + 1][0] - poly[i][0]) * k, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * k];
    }
    d -= segs[i];
  }
  return poly.at(-1);
}

function drawArc(ctx, s, view) {
  const small = view.w < 560;
  const pad = small ? 6 : 20;
  const side = small ? 0 : Math.min(330, view.w * 0.38); // timeline column on the right
  const bottomH = small ? 64 : 0;
  const box = { x: pad, y: small ? 18 : 40, w: view.w - side - 2 * pad, h: view.h - (small ? 18 : 40) - bottomH - pad };
  const P = ([x, y]) => [box.x + x * box.w, box.y + y * box.h];
  const line = (poly, color, width, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    poly.map(P).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  label(ctx, "Cung phản xạ rụt tay khi chạm vật nóng", pad, small ? 9 : 18, { size: small ? 12 : 16, bold: true });
  if (!small) label(ctx, "Sơ đồ không theo tỉ lệ; độ dài đường dẫn và thời gian là số liệu ước lượng.", pad, 36, { size: 11, color: COLORS.muted });

  // body parts
  const [bx, by] = P([0.255, 0.14]);
  ctx.fillStyle = "#f3e6f7";
  ctx.strokeStyle = "#b08cc0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(bx, by, box.w * 0.1, box.h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, "Não", bx - box.w * 0.1 - 4, by, { size: small ? 10 : 12, align: "right", color: COLORS.muted });
  const [cx, cy] = P([0.225, 0.26]);
  ctx.fillStyle = "#fbf1d8";
  ctx.strokeStyle = "#c9a74a";
  ctx.fillRect(cx, cy, box.w * 0.06, box.h * 0.5);
  ctx.strokeRect(cx, cy, box.w * 0.06, box.h * 0.5);
  label(ctx, "Tủy sống", cx - 4, cy + box.h * 0.4, { size: small ? 10 : 12, align: "right", color: COLORS.muted });
  // arm: upper arm with the muscle, forearm and hand
  ctx.strokeStyle = "#e7c9a9";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(10, box.h * 0.09);
  ctx.beginPath();
  ctx.moveTo(...P([0.45, 0.33]));
  ctx.lineTo(...P([0.72, 0.42]));
  ctx.lineTo(...P([0.88, 0.68]));
  ctx.stroke();
  ctx.lineCap = "butt";
  const [mx, my] = P([0.6, 0.37]);
  ctx.fillStyle = "#e9a0a0";
  ctx.beginPath();
  ctx.ellipse(mx, my, box.w * 0.08, box.h * 0.035, 0.32, 0, Math.PI * 2);
  ctx.fill();
  // stimulus: a hot object at the fingertip
  const [hx, hy] = P([0.93, 0.76]);
  ctx.fillStyle = COLORS.orange;
  ctx.beginPath();
  ctx.moveTo(hx - 8, hy + 10);
  ctx.quadraticCurveTo(hx - 9, hy - 6, hx, hy - 14);
  ctx.quadraticCurveTo(hx + 9, hy - 6, hx + 8, hy + 10);
  ctx.closePath();
  ctx.fill();
  if (!small) label(ctx, "kích thích (vật nóng)", hx, hy + 22, { size: 11, align: "center", color: COLORS.orange });

  // nerves
  for (const kind of s.compare ? ["conscious", "spinal"] : ["spinal"]) {
    for (const poly of Object.values(POLY[kind])) line(poly, KIND[kind].color, 2.5, kind === "conscious" ? [5, 4] : []);
  }
  // numbered components (named once ordered correctly, or on request)
  const named = s.ordered || s.showNames;
  COMPONENTS.forEach((c, i) => {
    const [x, y] = P(MARKS[c]);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, small ? 8 : 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(ctx, String(i + 1), x, y + 0.5, { size: small ? 10 : 12, bold: true, align: "center" });
    if (named) {
      const below = c === "afferent" || c === "receptor";
      label(ctx, NAMES[c], x + (c === "centre" ? 14 : 0), y + (below ? 20 : c === "centre" ? 0 : -20), { size: small ? 10 : 12, bold: true, align: c === "centre" ? "left" : "center", color: COLORS.green });
    }
  });
  // the impulses
  for (const kind of s.compare ? ["spinal", "conscious"] : ["spinal"]) {
    const at = signalAt(kind, s.speedV, s.t);
    const stage = PATHS[kind][at.index];
    const [x, y] = P(along(POLY[kind][stage.id], at.frac));
    ctx.fillStyle = KIND[kind].color;
    ctx.beginPath();
    ctx.arc(x, y, small ? 5 : 7, 0, Math.PI * 2);
    ctx.fill();
    if (at.done) {
      const [ex, ey] = P([0.74, kind === "spinal" ? 0.18 : 0.25]);
      label(ctx, kind === "spinal" ? "cơ co: rụt tay" : "cơ co (có ý thức)", ex, ey, { size: small ? 10 : 12, bold: true, color: KIND[kind].color });
    }
  }
  label(ctx, `t = ${ms(s.t)}`, box.x, box.y + box.h - 8, { size: small ? 12 : 15, bold: true });

  // timeline: total time of each path, split into conduction and central delay
  const kinds = s.compare ? ["spinal", "conscious"] : ["spinal"];
  const tMax = Math.max(...kinds.map(k => totalTime(k, s.speedV)));
  if (small) {
    let y = view.h - bottomH + 8;
    for (const k of kinds) {
      label(ctx, `${k === "spinal" ? "Tủy sống" : "Qua não"}: L = ${fmt(pathLength(k), 1)} m → ${ms(totalTime(k, s.speedV))}`, pad, y, { size: 11, bold: true, color: KIND[k].color });
      y += 15;
    }
    label(ctx, `t = L/v + thời gian ở trung ương; v = ${fmt(s.speedV, 1)} m/s`, pad, y, { size: 10, color: COLORS.muted });
    return;
  }
  const x0 = view.w - side;
  const w = side - pad;
  let y = 70;
  label(ctx, "Thời gian từ kích thích đến cơ co", x0, y, { size: 14, bold: true });
  y += 22;
  label(ctx, `v = ${fmt(s.speedV, 1)} m/s`, x0, y, { size: 12, color: COLORS.muted });
  y += 17;
  label(ctx, "t = L / v + thời gian ở trung ương", x0, y, { size: 12, color: COLORS.muted });
  y += 28;
  for (const k of kinds) {
    const L = pathLength(k);
    const cond = L / s.speedV;
    const delay = centralDelay(k);
    label(ctx, w < 260 && k === "conscious" ? "Phản ứng qua não" : KIND[k].name, x0, y, { size: 13, bold: true, color: KIND[k].color });
    y += 16;
    const bw = (w * (cond + delay)) / tMax;
    ctx.fillStyle = KIND[k].color;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x0, y, (w * cond) / tMax, 16);
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x0 + (w * cond) / tMax, y, (w * delay) / tMax, 16);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y, bw, 16);
    const tx = x0 + (w * Math.min(s.t, tMax)) / tMax; // where the animation is now
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, y - 3);
    ctx.lineTo(tx, y + 19);
    ctx.stroke();
    y += 30;
    label(ctx, `dẫn truyền: ${fmt(L, 1)} m : ${fmt(s.speedV, 1)} m/s = ${ms(cond)}`, x0, y, { size: 12 });
    y += 17;
    label(ctx, `${k === "spinal" ? "qua synapse ở tủy sống" : "não xử lí, quyết định"}: ${ms(delay)}`, x0, y, { size: 12 });
    y += 17;
    label(ctx, `tổng: ${ms(cond + delay)}`, x0, y, { size: 13, bold: true });
    y += 30;
  }
  const notes = [
    "Thanh nhạt: dẫn truyền trên sợi thần kinh;",
    "thanh đậm: thời gian ở trung ương thần kinh.",
    "Sợi có bao myelin: khoảng 50–120 m/s;",
    "sợi không có bao myelin: khoảng 0,5–2 m/s.",
    s.ordered ? "" : "Sắp xếp các bộ phận 1–5 ở bảng điều khiển.",
  ];
  ctx.font = `11px ${FONT}`;
  notes
    .filter(n => n && ctx.measureText(n).width <= w)
    .forEach((n, i) => y + i * 17 < view.h - 8 && label(ctx, n, x0, y + i * 17, { size: 11, color: COLORS.muted }));
}

// ---------- part 2 ----------
let goAt = 0; // performance.now() when the signal came; not part of the saved state
const elapsed = () => performance.now() - goAt;

const MESSAGE = {
  idle: ["#e3e8f2", COLORS.ink, "Bấm «Bắt đầu lượt đo»"],
  waiting: ["#e5484d", "#fff", "Chờ…"],
  go: ["#1f9d6b", "#fff", "BẤM NGAY!"],
  false: ["#f08c2e", "#fff", "Bấm sớm quá! Lượt này không tính"],
  slow: ["#e3e8f2", COLORS.ink, `Quá ${fmt(MAX_SCREEN_RT / 1000, 0)} s, lượt này không tính`],
  missed: ["#e3e8f2", COLORS.ink, "Thước đã rơi qua tay, lượt này không tính"],
  trial: ["#e9f0fe", COLORS.ink, ""],
  set: ["#e9f0fe", COLORS.ink, ""],
};

function drawRuler(ctx, s, box, small) {
  const k = (box.h - 30) / (2 * RULER); // px per metre; room for the ruler above and below the fingers
  const fy = box.y + 15 + RULER * k;
  const d = s.phase === "go" ? Math.min(rulerDistance(elapsed() / 1000), RULER) : s.phase === "trial" || s.phase === "set" ? s.lastDistance : s.phase === "missed" ? RULER : 0;
  const x = box.x + box.w / 2;
  const rw = Math.min(46, box.w * 0.18);
  const bottom = fy + d * k;
  const top = bottom - RULER * k;
  if (s.phase !== "missed") {
    ctx.fillStyle = "#fbe9a6";
    ctx.strokeStyle = "#b89a2c";
    ctx.lineWidth = 1;
    ctx.fillRect(x - rw / 2, top, rw, RULER * k);
    ctx.strokeRect(x - rw / 2, top, rw, RULER * k);
    for (let cm = 0; cm <= 50; cm++) {
      const y = bottom - (cm / 100) * k;
      const len = cm % 5 ? rw * 0.15 : rw * 0.35;
      ctx.strokeStyle = COLORS.ink;
      ctx.beginPath();
      ctx.moveTo(x - rw / 2, y);
      ctx.lineTo(x - rw / 2 + len, y);
      ctx.stroke();
      if (cm % 10 === 0 && (!small || cm % 20 === 0)) label(ctx, String(cm), x + rw * 0.05, y, { size: small ? 9 : 11, color: COLORS.ink });
    }
  }
  // fingers (thumb and index) at the zero mark
  ctx.fillStyle = "#e7c9a9";
  ctx.fillRect(x - rw / 2 - 30, fy - 6, 26, 12);
  ctx.fillRect(x + rw / 2 + 4, fy - 6, 26, 12);
  ctx.strokeStyle = COLORS.orange;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(x - rw / 2 - 34, fy);
  ctx.lineTo(x + rw / 2 + 34, fy);
  ctx.stroke();
  ctx.setLineDash([]);
  if (s.phase === "trial" || s.phase === "set") {
    label(ctx, `d = ${fmt(s.lastDistance * 100, 1)} cm`, x + rw / 2 + 38, fy, { size: small ? 11 : 13, bold: true });
  }
}

function drawTrials(ctx, s, box, small) {
  const r = stats(s.trials);
  const size = small ? 11 : 13;
  let y = box.y + 8;
  label(ctx, `Loạt đo: ${r.n}/${s.setSize} lượt`, box.x, y, { size: size + 1, bold: true });
  y += size * 1.6;
  if (s.mode === "ruler" && s.lastDistance && (s.phase === "trial" || s.phase === "set")) {
    label(ctx, `t = √(2d/g) = √(2 · ${fmt(s.lastDistance, 3)} / 9,81) = ${fmt(s.lastRt / 1000, 3)} s`, box.x, y, { size, bold: true, color: COLORS.blue });
    y += size * 1.6;
  }
  label(ctx, r.n ? `Trung bình: ${fmt(r.mean, 0)} ms   Độ lệch chuẩn: ${fmt(r.sd, 0)} ms` : "Chưa có lượt đo hợp lệ.", box.x, y, { size, bold: !!r.n });
  y += size * 1.5;
  label(ctx, `Bấm sớm (không tính): ${fmt(s.falseStarts, 0)} lần`, box.x, y, { size: size - 1, color: COLORS.muted });
  y += size * 1.8;
  // bars of each trial, the mean line and the ±1 sd band
  const h = box.y + box.h - y - (small ? 14 : 22);
  if (h < 30) return;
  const max = Math.max(400, ...s.trials) * 1.1;
  const yOf = v => y + h - (v / max) * h;
  const bw = Math.min(36, box.w / MAX_TRIALS - 6);
  if (r.n > 1) {
    ctx.fillStyle = "rgba(47,111,237,0.12)";
    ctx.fillRect(box.x, yOf(r.mean + r.sd), box.w, yOf(r.mean - r.sd) - yOf(r.mean + r.sd));
  }
  s.trials.forEach((v, i) => {
    const x = box.x + 4 + i * (bw + 6);
    ctx.fillStyle = COLORS.blue;
    ctx.fillRect(x, yOf(v), bw, y + h - yOf(v));
    if (!small || bw > 22) label(ctx, fmt(v, 0), x + bw / 2, yOf(v) - 8, { size: 10, align: "center", color: COLORS.muted });
    label(ctx, String(i + 1), x + bw / 2, y + h + 9, { size: 10, align: "center", color: COLORS.muted });
  });
  if (r.n) {
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(box.x, yOf(r.mean));
    ctx.lineTo(box.x + box.w, yOf(r.mean));
    ctx.stroke();
  }
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.x, y + h);
  ctx.lineTo(box.x + box.w, y + h);
  ctx.stroke();
  ctx.font = `11px ${FONT}`;
  const note = "Cột: từng lượt (ms); đỏ: trung bình; dải xanh: ± 1 độ lệch chuẩn";
  if (!small && ctx.measureText(note).width <= box.w) label(ctx, note, box.x, y + h + 22, { size: 11, color: COLORS.muted });
}

function drawGame(ctx, s, view) {
  const small = view.w < 560;
  const pad = small ? 6 : 20;
  const split = small ? null : view.w * 0.5;
  const stim = small ? { x: pad, y: pad, w: view.w - 2 * pad, h: view.h * 0.5 } : { x: pad, y: pad, w: split - 1.5 * pad, h: view.h - 2 * pad };
  const [bg, fg, text] = MESSAGE[s.phase] ?? MESSAGE.idle;
  const ruler = s.mode === "ruler";
  if (!ruler) {
    ctx.fillStyle = bg;
    ctx.fillRect(stim.x, stim.y, stim.w, stim.h);
  }
  if (ruler) drawRuler(ctx, s, stim, small);
  let msg = text;
  if (s.phase === "trial" || s.phase === "set") msg = `Thời gian phản xạ: ${fmt(s.lastRt, 0)} ms${s.phase === "set" ? " · xong một loạt" : ""}`;
  if (ruler && s.phase === "waiting") msg = "Đặt hai ngón tay ở vạch 0, chờ thước rơi…";
  if (ruler && s.phase === "go") msg = "";
  if (ruler && s.phase === "idle") msg = "Bấm «Bắt đầu lượt đo»; bấm vào khung để bắt thước";
  if (msg) {
    const size = clamp(stim.w / 18, 12, 26);
    const y = ruler ? stim.y + stim.h - 10 : stim.y + stim.h / 2;
    label(ctx, msg, stim.x + stim.w / 2, y, { size: ruler ? Math.min(size, 13) : size, bold: true, align: "center", color: ruler ? COLORS.ink : fg });
  }
  if (!ruler && !small) label(ctx, `Bấm vào khung màu (hoặc nút «Bấm!») ngay khi khung chuyển sang màu xanh. Nhanh hơn ${MIN_RT} ms sau tín hiệu cũng tính là bấm sớm.`, stim.x + stim.w / 2, stim.y + stim.h - 16, { size: 11, align: "center", color: s.phase === "waiting" || s.phase === "go" || s.phase === "false" ? "#fff" : COLORS.muted });
  const tb = small ? { x: pad, y: stim.y + stim.h + 4, w: view.w - 2 * pad, h: view.h - stim.h - stim.y - 8 } : { x: split + pad / 2, y: pad, w: view.w - split - 1.5 * pad, h: view.h - 2 * pad };
  drawTrials(ctx, s, tb, small);
}

function doTap(s, api) {
  if (s.phase !== "waiting" && s.phase !== "go") return;
  const rt = s.phase === "go" ? elapsed() : 0;
  const kind = tap(s, rt);
  if (kind === "false-start") api.emit("false-start", { falseStarts: s.falseStarts }, "action");
  if (kind === "valid") {
    api.emit("trial", { reactionTime: s.lastRt, distance: s.mode === "ruler" ? s.lastDistance * 100 : 0 }, "result");
    if (s.phase === "set") {
      const r = stats(s.trials);
      api.emit("trial-set", { count: r.n, mean: r.mean, sd: r.sd, falseStarts: s.falseStarts }, "result");
    }
  }
  api.pause();
  api.sync();
}

const isArc = s => s.part === "arc";
const isGame = s => s.part === "game";
const busy = s => s.phase === "waiting" || s.phase === "go";
const ORDER = ["o1", "o2", "o3", "o4", "o5"];

mount({
  slug: "cung-phan-xa",
  version: "1.0.0",
  title: "Cung phản xạ và thời gian phản xạ",
  hint: "Phần 1: chạy xung thần kinh trên cung phản xạ và sắp xếp các bộ phận. Phần 2: đo thời gian phản xạ của chính em.",
  initialState,
  timeScale: s => (isArc(s) ? s.slow : 1),
  step(s, dt, api) {
    if (isArc(s)) {
      s.t += dt;
      const end = Math.max(totalTime("spinal", s.speedV), s.compare ? totalTime("conscious", s.speedV) : 0);
      if (s.t >= end + 0.004) {
        s.t = end + 0.004;
        api.pause();
      }
      return;
    }
    if (s.phase === "waiting") {
      s.clock += dt;
      if (s.clock >= s.waitUntil) {
        s.phase = "go";
        goAt = performance.now();
      }
    } else if (s.phase === "go") {
      if (timeout(s, elapsed())) {
        api.emit("trial-missed", { limit: s.mode === "ruler" ? rulerTime(RULER) * 1000 : MAX_SCREEN_RT }, "action");
        api.pause();
        api.sync();
      }
    } else api.pause();
  },
  sanitize(incoming, base) {
    const out = {};
    for (const key of Object.keys(base)) {
      const v = incoming[key];
      if (key === "trials") continue;
      if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) out[key] = v;
    }
    if (Array.isArray(incoming.trials)) {
      out.trials = incoming.trials.filter(v => typeof v === "number" && Number.isFinite(v)).map(v => clamp(v, 0, 10000)).slice(0, MAX_TRIALS);
    }
    if (out.phase === "waiting" || out.phase === "go" || !(out.phase in MESSAGE)) out.phase = "idle"; // timing cannot be restored
    for (const k of ORDER) if (!COMPONENTS.includes(out[k])) delete out[k];
    if ("t" in out) out.t = clamp(out.t, 0, 1);
    for (const k of ["falseStarts", "orderAttempts"]) if (k in out) out[k] = clamp(Math.floor(out[k]), 0, 999);
    if ("lastDistance" in out) out.lastDistance = clamp(out.lastDistance, 0, RULER);
    if ("lastRt" in out) out.lastRt = clamp(out.lastRt, 0, 10000);
    if ("seed" in out) out.seed = out.seed >>> 0;
    return out;
  },
  controls: [
    {
      type: "select",
      key: "part",
      label: "Phần",
      onChange: (s, api) => {
        s.phase = "idle";
        api.pause();
      },
      options: [
        { value: "arc", label: "1. Cung phản xạ" },
        { value: "game", label: "2. Đo thời gian phản xạ" },
      ],
    },
    // part 1
    { type: "slider", key: "speedV", label: "Tốc độ dẫn truyền xung thần kinh", min: 1, max: 120, step: 1, unit: "m/s", digits: 0, visible: isArc, onChange: s => (s.t = 0) },
    {
      type: "select",
      key: "slow",
      label: "Tốc độ phát hình",
      visible: isArc,
      options: [
        { value: 0.05, label: "Chậm 20 lần" },
        { value: 0.02, label: "Chậm 50 lần" },
        { value: 0.005, label: "Chậm 200 lần" },
      ],
    },
    { type: "checkbox", key: "compare", label: "So sánh với phản ứng có ý thức (qua não)", visible: isArc },
    {
      type: "button",
      label: "Kích thích",
      primary: true,
      visible: isArc,
      event: "stimulate",
      action(s, api) {
        s.t = 0;
        api.play();
      },
    },
    { type: "heading", label: "Sắp xếp cung phản xạ theo đường đi của xung", visible: isArc },
    ...ORDER.map((key, i) => ({
      type: "select",
      key,
      label: `Vị trí ${i + 1}`,
      visible: isArc,
      onChange: s => (s.orderChecked = false),
      options: COMPONENTS.map(c => ({ value: c, label: NAMES[c] })),
    })),
    {
      type: "button",
      label: "Kiểm tra thứ tự",
      visible: isArc,
      disabled: s => s.ordered,
      action(s, api) {
        const list = ORDER.map(k => s[k]);
        s.orderAttempts = Math.min(999, s.orderAttempts + 1);
        s.orderChecked = true;
        s.ordered = checkOrder(list);
        const right = list.filter((c, i) => c === COMPONENTS[i]).length;
        if (s.ordered) api.emit("arc-ordered", { attempts: s.orderAttempts }, "goal");
        else api.emit("order-wrong", { attempts: s.orderAttempts, correctPositions: right }, "action");
      },
    },
    { type: "checkbox", key: "showNames", label: "Hiện tên các bộ phận trên hình", visible: isArc },
    // part 2
    {
      type: "select",
      key: "mode",
      label: "Cách đo",
      visible: isGame,
      disabled: busy,
      onChange: s => {
        s.trials = [];
        s.phase = "idle";
      },
      options: [
        { value: "screen", label: "Bấm khi màn hình chuyển xanh" },
        { value: "ruler", label: "Bắt thước rơi (thước 50 cm)" },
      ],
    },
    { type: "stepper", key: "setSize", label: "Số lượt mỗi loạt", min: 3, max: MAX_TRIALS, visible: isGame, disabled: busy },
    {
      type: "button",
      label: "Bắt đầu lượt đo",
      primary: true,
      visible: isGame,
      disabled: busy,
      event: "trial-start",
      action(s, api) {
        startTrial(s);
        api.play();
      },
    },
    { type: "button", label: "Bấm!", visible: isGame, disabled: s => !busy(s), action: doTap },
    {
      type: "button",
      label: "Xoá kết quả",
      visible: isGame,
      disabled: s => busy(s) || (!s.trials.length && !s.falseStarts),
      event: "clear-trials",
      action(s) {
        Object.assign(s, { trials: [], falseStarts: 0, lastRt: 0, lastDistance: 0, phase: "idle" });
      },
    },
  ],
  readouts: [
    { label: "Phản xạ tủy sống", value: s => ms(totalTime("spinal", s.speedV)) },
    { label: "Phản ứng qua não", value: s => ms(totalTime("conscious", s.speedV)) },
    { label: "Thứ tự cung phản xạ", value: s => (s.ordered ? "đúng" : s.orderChecked ? `chưa đúng (${ORDER.filter((k, i) => s[k] === COMPONENTS[i]).length}/5 vị trí)` : "chưa kiểm tra") },
    { label: "Thời gian phản xạ trung bình", value: s => (s.trials.length ? `${fmt(stats(s.trials).mean, 0)} ms (n = ${s.trials.length})` : "–") },
  ],
  pointer: {
    down(p, s, api) {
      if (isGame(s)) doTap(s, api);
      return false;
    },
  },
  draw(ctx, s, view) {
    if (isGame(s)) drawGame(ctx, s, view);
    else drawArc(ctx, s, view);
  },
});
