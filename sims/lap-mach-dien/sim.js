import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, solve, tap, taskMet, sanitizeParts, sortParts, allEdges, ends, TASKS, PRESETS, COLS, ROWS } from "./model.js";

const TOOLS = [
  { value: "wire", label: "Dây nối" },
  { value: "battery", label: "Pin (nguồn điện)" },
  { value: "switch", label: "Công tắc (khóa K)" },
  { value: "bulb", label: "Bóng đèn" },
  { value: "ammeter", label: "Ampe kế" },
  { value: "voltmeter", label: "Vôn kế" },
  { value: "erase", label: "Xóa linh kiện" },
];

// ---------- events ----------
function afterChange(s, api) {
  const sol = solve(s);
  // one result each time the closed circuit settles on a new outcome
  const sig = sol.closed && !sol.short ? `${sol.total.toFixed(6)}|${sol.lit}|${sol.bulbs.length}` : undefined;
  if (sig && sig !== s._sig) {
    api.emit("circuit-closed", { current: sol.total, litBulbs: sol.lit, bulbs: sol.bulbs.length, errors: sol.errors.length }, "result");
  }
  s._sig = sig;
  const met = taskMet(s, sol);
  if (met && s._metTask !== s.task) api.emit("task-done", { task: TASKS.findIndex(t => t.value === s.task) + 1 }, "goal");
  s._metTask = met ? s.task : undefined;
}

// ---------- layout ----------
function geom(view) {
  const small = view.w < 520 || view.h < 420;
  const top = small ? 50 : 76;
  const bottom = small ? 14 : 26;
  const side = small ? 34 : 64;
  const cell = Math.min((view.w - 2 * side) / (COLS - 1), (view.h - top - bottom) / (ROWS - 1));
  const x0 = (view.w - cell * (COLS - 1)) / 2;
  const y0 = top + (view.h - top - bottom - cell * (ROWS - 1)) / 2;
  const P = ([x, y]) => ({ x: x0 + x * cell, y: y0 + y * cell });
  return { small, cell, P, w: view.w };
}

function nearestEdge(p, g) {
  let best = null;
  let bestD = g.cell * 0.34;
  for (const e of allEdges()) {
    const [a, b] = ends(e).map(g.P);
    const d = Math.hypot(p.x - (a.x + b.x) / 2, p.y - (a.y + b.y) / 2);
    if (d < bestD) [best, bestD] = [e, d];
  }
  return best;
}

function wrap(ctx, text, width, size) {
  ctx.font = `${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const lines = [""];
  for (const word of text.split(" ")) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (ctx.measureText(next).width > width && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  return lines;
}

const line = (ctx, a, b) => {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
};

function drawPart(ctx, it, g, sol, s) {
  const [A, B] = ends(it.e).map(g.P);
  const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const ux = (B.x - A.x) / g.cell;
  const uy = (B.y - A.y) / g.cell;
  const at = (d, n = 0) => ({ x: M.x + ux * d - uy * n, y: M.y + uy * d + ux * n }); // d along, n across
  const r = g.cell * 0.17;
  const size = g.small ? 10 : 13;
  ctx.strokeStyle = COLORS.ink;
  ctx.fillStyle = COLORS.ink;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  const vertical = ux === 0;
  const tag = (text, color = COLORS.ink, bold = true, flipSide = false) => {
    if (flipSide) {
      // the other side: left of a vertical part, under a horizontal one
      if (vertical) label(ctx, text, M.x - r - 6, M.y, { size, bold, color, align: "right" });
      else label(ctx, text, M.x, M.y + r + (g.small ? 8 : 11), { size, bold, color, align: "center" });
    } else if (vertical) {
      ctx.font = `${bold ? "600 " : ""}${size}px system-ui, sans-serif`;
      const right = M.x + r + 6 + ctx.measureText(text).width < g.w - 4;
      label(ctx, text, M.x + (right ? r + 6 : -r - 6), M.y, { size, bold, color, align: right ? "left" : "right" });
    } else label(ctx, text, M.x, M.y - r - (g.small ? 8 : 11), { size, bold, color, align: "center" });
  };

  if (it.t === "wire") return line(ctx, A, B);

  if (it.t === "battery") {
    const gap = Math.max(4, g.cell * 0.05);
    const plusFirst = !it.flip; // + pole at the first node unless flipped
    const pPlus = at(plusFirst ? -gap : gap);
    const pMinus = at(plusFirst ? gap : -gap);
    line(ctx, A, at(-gap));
    line(ctx, at(gap), B);
    ctx.lineWidth = 2;
    const long = g.cell * 0.2;
    line(ctx, { x: pPlus.x - uy * long, y: pPlus.y + ux * long }, { x: pPlus.x + uy * long, y: pPlus.y - ux * long });
    ctx.lineWidth = 6;
    ctx.lineCap = "butt";
    const short = g.cell * 0.1;
    line(ctx, { x: pMinus.x - uy * short, y: pMinus.y + ux * short }, { x: pMinus.x + uy * short, y: pMinus.y - ux * short });
    const plusSign = at(plusFirst ? -gap * 3.5 : gap * 3.5, -long * 0.75);
    label(ctx, "+", plusSign.x, plusSign.y, { size: size + 2, bold: true, color: COLORS.red, align: "center" });
    return tag(`${fmt(s.emf, 1)} V`, COLORS.muted, true, true); // the + sign takes the usual side
  }

  const half = g.cell * 0.23;
  line(ctx, A, at(-half));
  line(ctx, at(half), B);

  if (it.t === "switch") {
    const a = at(-half);
    const b = at(half);
    const tip = it.on ? b : at(half * 0.75, -half * 1.1);
    ctx.strokeStyle = it.on ? COLORS.ink : COLORS.red;
    line(ctx, a, tip);
    ctx.fillStyle = COLORS.ink;
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return tag(`${it.name}${it.on ? "" : " (mở)"}`, it.on ? COLORS.ink : COLORS.red, true);
  }

  line(ctx, at(-half), at(-r));
  line(ctx, at(r), at(half));

  if (it.t === "bulb") {
    if (it.level > 0.02) {
      const R = r * (1.5 + 2.2 * it.level);
      const glow = ctx.createRadialGradient(M.x, M.y, r * 0.6, M.x, M.y, R);
      glow.addColorStop(0, `rgba(245, 197, 24, ${0.85 * it.level})`);
      glow.addColorStop(1, "rgba(245, 197, 24, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(M.x, M.y, R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = it.lit ? `rgb(255, ${Math.round(250 - 30 * it.level)}, ${Math.round(220 - 170 * it.level)})` : "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(M.x, M.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const c = r * Math.SQRT1_2;
    line(ctx, { x: M.x - c, y: M.y - c }, { x: M.x + c, y: M.y + c });
    line(ctx, { x: M.x + c, y: M.y - c }, { x: M.x - c, y: M.y + c });
    return tag(it.name, it.lit ? "#b07800" : COLORS.muted);
  }

  // meters
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(M.x, M.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const amm = it.t === "ammeter";
  label(ctx, amm ? "A" : "V", M.x, M.y + 1, { size: Math.max(11, r * 1.1), bold: true, align: "center", color: amm ? COLORS.blue : COLORS.purple });
  const reading = sol.short ? "–" : `${fmt(it.value, it.value >= 100 ? 0 : 2)} ${amm ? "A" : "V"}`;
  tag(`${it.name}: ${reading}`, amm ? COLORS.blue : COLORS.purple);
}

mount({
  slug: "lap-mach-dien",
  version: "1.0.0",
  title: "Lắp mạch điện đơn giản",
  hint: "Chọn linh kiện rồi bấm vào một cạnh của lưới để đặt. Bấm vào công tắc để đóng hoặc mở; chọn Pin rồi bấm lại vào pin để đổi chiều.",
  initialState,
  sanitize(incoming, base) {
    const out = {};
    for (const k of Object.keys(base)) {
      const v = incoming[k];
      if (k === "parts" || typeof v !== typeof base[k]) continue;
      if (typeof v === "number" && !Number.isFinite(v)) continue;
      out[k] = v;
    }
    const parts = sanitizeParts(incoming.parts);
    if (parts) out.parts = parts;
    return out;
  },
  controls: [
    { type: "select", key: "tool", label: "Linh kiện đặt vào lưới", options: TOOLS },
    { type: "slider", key: "emf", label: "Hiệu điện thế mỗi pin", min: 1.5, max: 6, step: 1.5, unit: "V", digits: 1, onCommit: afterChange },
    { type: "slider", key: "bulbR", label: "Điện trở mỗi bóng đèn", min: 2, max: 20, step: 1, unit: "Ω", digits: 0, onCommit: afterChange },
    { type: "heading", label: "Nhiệm vụ" },
    { type: "select", key: "task", label: "Hãy lắp mạch", options: TASKS, onCommit: afterChange },
    { type: "heading", label: "Mạch mẫu" },
    ...[
      ["Hai đèn nối tiếp", "series"],
      ["Hai đèn song song", "parallel"],
      ["Xóa hết", "clear"],
    ].map(([text, name]) => ({
      type: "button",
      label: text,
      action(s, api) {
        s.parts = sortParts((PRESETS[name] ?? []).map(p => ({ ...p })));
        api.emit("preset", { parts: s.parts.length });
        afterChange(s, api);
      },
    })),
  ],
  readouts: [
    { label: "Cường độ dòng điện qua nguồn", value: s => (solve(s).short ? "rất lớn (đoản mạch)" : `${fmt(solve(s).total, 3)} A`) },
    { label: "Đèn sáng", value: s => `${solve(s).lit} / ${solve(s).bulbs.length}` },
    { label: "Nhiệm vụ", value: s => (taskMet(s) ? "Đã đạt" : "Chưa đạt") },
  ],
  pointer: {
    down(p, s, api, view) {
      const e = nearestEdge(p, geom(view));
      const did = e && tap(s, e, s.tool);
      if (!did) return false;
      api.emit("place", { did: did.did, type: did.type, parts: s.parts.length });
      afterChange(s, api);
    },
    hover(p, s, api, view) {
      s._hover = nearestEdge(p, geom(view)) ?? undefined;
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const sol = solve(s);
    const used = new Set(s.parts.map(p => p.e));

    // empty slots
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    for (const e of allEdges()) if (!used.has(e)) line(ctx, ...ends(e).map(g.P));
    ctx.setLineDash([]);
    if (s._hover) {
      ctx.strokeStyle = "rgba(47,111,237,0.25)";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      line(ctx, ...ends(s._hover).map(g.P));
    }
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const p = g.P([x, y]);
        ctx.fillStyle = "#c3cad8";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

    for (const it of sol.items) drawPart(ctx, it, g, sol, s);

    // status
    const size = g.small ? 11 : 14;
    let head;
    let color;
    if (sol.short) [head, color] = ["Đoản mạch! Dòng điện rất lớn, pin nóng lên và nhanh hỏng.", COLORS.red];
    else if (sol.errors.length) [head, color] = ["Mắc sai dụng cụ đo:", COLORS.red];
    else if (sol.closed) [head, color] = [`Mạch kín: I = ${fmt(sol.total, 3)} A, ${sol.lit}/${sol.bulbs.length} đèn sáng`, COLORS.green];
    else [head, color] = ["Mạch hở: không có dòng điện", COLORS.muted];
    label(ctx, head, view.w / 2, g.small ? 10 : 16, { size: size + 1, bold: true, align: "center", color });
    const more = [...sol.errors.filter(e => !(sol.short && e.startsWith("Đoản mạch"))), ...sol.notes];
    const lines = more.flatMap(m => wrap(ctx, m, view.w - 16, size));
    lines.slice(0, g.small ? 2 : 3).forEach((text, i) =>
      label(ctx, text, view.w / 2, (g.small ? 25 : 36) + i * (size + 3), { size, align: "center", color: sol.errors.length ? COLORS.red : COLORS.muted })
    );
    if (!g.small) label(ctx, "Dụng cụ đo coi là lí tưởng; số chỉ không xét dấu (+/−) của chốt nối.", view.w - 8, view.h - 10, { size: 11, align: "right", color: COLORS.muted });
  },
});
