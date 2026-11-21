import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import { PRESETS, initialState, load, apply, status, answer, imbalance, minSteps, eqOf, eqText, sideText, clampState } from "./model.js";

const OPS = { add: 1, remove: 2, divide: 3 };
const SIDES = { both: 0, left: 1, right: 2 };
const best = new Map(); // preset -> fewest steps
const fewest = s => {
  if (!best.has(s.preset)) best.set(s.preset, minSteps(PRESETS[s.preset]));
  return best.get(s.preset);
};

const clear = s => {
  s._tip = 0;
  s._ghost = null;
  s._msg = "";
};

function report(s, api) {
  const eq = eqOf(s);
  const st = status(eq);
  if (st === "working") return;
  if (st === "solved") api.emit("solved", { x: answer(eq), steps: s.steps, minSteps: fewest(s) }, "result");
  else api.emit("no-unique-solution", { infinite: st === "infinite" ? 1 : 0, steps: s.steps }, "result");
  if (s.steps === fewest(s)) api.emit("solved-minimum", { steps: s.steps }, "goal");
}

const run = op => (s, api) => {
  const r = apply(s, op, s.item, s.amount, s.side);
  clear(s);
  if (!r.ok) {
    s._msg = r.error;
    s._tip = r.tip ?? 0;
    s._ghost = r.eq ?? null;
  }
  api.emit("operation", { op: OPS[op], item: s.item === "x" ? 1 : 0, amount: s.amount, side: SIDES[s.side], accepted: r.ok ? 1 : 0 }, "action");
  if (r.ok) report(s, api);
};

function message(s) {
  if (s._msg) return [s._msg, COLORS.red];
  const eq = eqOf(s);
  const st = status(eq);
  const tail = ` (${s.steps} bước; ít nhất ${fewest(s)} bước)`;
  if (st === "solved") return [`Đã giải: x = ${String(answer(eq)).replace("-", "−")}${tail}`, COLORS.green];
  if (st === "none") return [`${eqText(eq)} là vô lí: phương trình vô nghiệm${tail}`, COLORS.orange];
  if (st === "infinite") return [`${eqText(eq)} luôn đúng: phương trình có vô số nghiệm${tail}`, COLORS.orange];
  if (imbalance(s) !== 0) return ["Cân lệch dù x bằng bao nhiêu. Thử bớt giống nhau ở hai đĩa.", COLORS.muted];
  return ["Bóng bay kéo lên là số hạng âm. Làm giống nhau ở hai đĩa.", COLORS.muted];
}

// ---------- drawing ----------
function box(ctx, x, y, u, color, text) {
  ctx.fillStyle = color;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, u, u, 3);
  ctx.fill();
  ctx.stroke();
  label(ctx, text, x + u / 2, y + u / 2 + 1, { color: "#fff", size: Math.max(9, u * 0.55), align: "center", bold: true });
}

function balloon(ctx, x, y, r, color, text, hx, hy) {
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, text, x, y, { color: "#fff", size: Math.max(9, r * 1.05), align: "center", bold: true });
}

// One pan: positive items stand on it, negative ones are balloons tied to the hook above.
function pan(ctx, g, hx, hy, k, u) {
  const { pw, hang, size } = g;
  const py = hy + hang;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx - pw / 2, py);
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + pw / 2, py);
  ctx.stroke();
  // items, x boxes first (bottom rows), then unit weights
  const items = [...Array(Math.max(0, k)).fill("x"), ...Array(Math.max(0, u)).fill("1")];
  const per = 4;
  const big = size;
  const small = size * 0.78;
  let y = py;
  let row = [];
  const flush = () => {
    if (!row.length) return;
    const h = row[0] === "x" ? big : small;
    const gap = 2;
    let x = hx - (row.length * (h + gap) - gap) / 2;
    y -= h + 1;
    for (const t of row) {
      box(ctx, x, y, h, t === "x" ? COLORS.blue : "#8a93a6", t);
      x += h + gap;
    }
    row = [];
  };
  for (const t of items) {
    if (row.length && (row.length === per || row[0] !== t)) flush();
    row.push(t);
  }
  flush();
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.ellipse(hx, py + 2, pw / 2, 5, 0, 0, Math.PI);
  ctx.fill();
  // balloons above the hook
  const bal = [...Array(Math.max(0, -k)).fill("x"), ...Array(Math.max(0, -u)).fill("1")];
  const r = g.r;
  const perB = g.perB;
  bal.forEach((t, i) => {
    const rowI = Math.floor(i / perB);
    const n = Math.min(perB, bal.length - rowI * perB);
    const col = i % perB;
    const bx = hx + (col - (n - 1) / 2) * r * 1.9;
    const by = hy - g.string - r - rowI * r * 2.1;
    balloon(ctx, bx, by, r, t === "x" ? COLORS.purple : COLORS.red, t, hx, hy);
  });
}

function scene(s, view) {
  const wide = view.w >= 620;
  const logW = wide ? Math.min(300, view.w * 0.36) : 0;
  const lines = wide ? 0 : view.h < 400 ? 3 : 4;
  const logH = wide ? 0 : lines * 16 + 22;
  const top = 58;
  const sw = view.w - logW;
  const sh = view.h - top - logH;
  const L = Math.min((sw / 2 - 8) / 1.45, 240);
  const pw = Math.min(L * 0.9, 190);
  const r = pw / 11;
  const perB = 5;
  const balloonRows = Math.max(1, ...[[s.la, s.lb], [s.ra, s.rb]].map(([k, u]) => Math.ceil((Math.max(0, -k) + Math.max(0, -u)) / perB)));
  // stack height in units of one box: rows of x boxes plus rows of (smaller) unit weights
  const stack = Math.max(3, ...[[s.la, s.lb], [s.ra, s.rb]].map(([k, u]) => Math.ceil(Math.max(0, k) / 4) + 0.8 * Math.ceil(Math.max(0, u) / 4)));
  const size = Math.max(8, Math.min(pw / 4.6, (sh - 40 - balloonRows * r * 2.1) / (stack + 1.4)));
  const string = size * 0.5;
  const above = string + balloonRows * r * 2.1 + 6;
  const hang = size * (stack + 0.4) + 10;
  const py = top + above + Math.max(0, (sh - above - hang - 40) * 0.4);
  return { wide, logW, lines, logH, top, sw, sh, L, pw, r, perB, size, string, hang, py, cx: sw / 2 };
}

mount({
  slug: "can-bang-phuong-trinh-bac-nhat",
  version: "1.0.0",
  title: "Giải phương trình bậc nhất bằng cân thăng bằng",
  hint: "Mỗi hộp x nặng như nhau, mỗi quả cân nặng 1. Bóng bay kéo lên, là số hạng âm. Thêm, bớt hoặc chia giống nhau ở cả hai đĩa cho đến khi một đĩa chỉ còn một hộp x.",
  initialState: () => ({ ...initialState(), _tip: 0, _ghost: null, _msg: "" }),
  sanitize(incoming, base) {
    const out = { ...base };
    for (const k of Object.keys(base)) if (!k.startsWith("_") && typeof incoming[k] === typeof base[k]) out[k] = incoming[k];
    return clampState(out);
  },
  controls: [
    {
      type: "select",
      key: "preset",
      label: "Phương trình",
      options: PRESETS.map((p, i) => ({ value: i, label: eqText(p) })),
      onChange(s) {
        load(s);
        clear(s);
      },
    },
    { type: "heading", label: "Thao tác" },
    {
      type: "select",
      key: "item",
      label: "Vật",
      options: [
        { value: "x", label: "Hộp x" },
        { value: "1", label: "Quả cân 1" },
      ],
    },
    { type: "stepper", key: "amount", label: "Số lượng n", min: 1, max: 9 },
    {
      type: "select",
      key: "side",
      label: "Làm ở",
      options: [
        { value: "both", label: "Cả hai đĩa" },
        { value: "left", label: "Chỉ đĩa trái" },
        { value: "right", label: "Chỉ đĩa phải" },
      ],
    },
    { type: "button", label: "Thêm n vật", primary: true, action: run("add") },
    { type: "button", label: "Bớt n vật", action: run("remove") },
    { type: "button", label: "Chia mỗi đĩa thành n phần bằng nhau, giữ 1 phần", action: run("divide") },
  ],
  readouts: [
    { label: "Phương trình hiện tại", value: s => eqText(eqOf(s)) },
    { label: "Số bước", value: s => String(s.steps) },
  ],
  draw(ctx, s, view) {
    const g = scene(s, view);
    const eq = s._ghost ?? eqOf(s);
    const small = view.w < 480;

    // equation and message
    label(ctx, `${sideText(eq[0], eq[1])}  ${s._ghost ? "≠" : "="}  ${sideText(eq[2], eq[3])}`, g.cx, 18, {
      align: "center",
      size: small ? 18 : 22,
      bold: true,
      color: s._ghost ? COLORS.red : COLORS.ink,
    });
    const [msg, color] = message(s);
    ctx.font = `${small ? 11 : 13}px system-ui, sans-serif`;
    let text = msg;
    while (ctx.measureText(text).width > g.sw - 16 && text.length > 10) text = text.slice(0, -2);
    label(ctx, text === msg ? msg : text + "…", g.cx, 42, { align: "center", size: small ? 11 : 13, color });

    // stand
    const tilt = s._ghost ? s._tip * 0.16 : clamp(imbalance(s) * 0.03, -0.16, 0.16);
    const { cx, py, L } = g;
    const base = view.h - g.logH - 10;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(cx - 4, py, 8, base - py);
    ctx.fillRect(cx - 46, base - 6, 92, 8);
    // beam
    const ex = L * Math.cos(tilt);
    const ey = L * Math.sin(tilt);
    ctx.strokeStyle = s._ghost ? COLORS.red : COLORS.ink;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - ex, py + ey);
    ctx.lineTo(cx + ex, py - ey);
    ctx.stroke();
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    ctx.arc(cx, py, 7, 0, Math.PI * 2);
    ctx.fill();
    // level indicator
    ctx.strokeStyle = tilt === 0 ? COLORS.green : COLORS.red;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, py - 8);
    ctx.lineTo(cx + 22 * Math.sin(tilt), py - 8 - 22 * Math.cos(tilt));
    ctx.stroke();

    pan(ctx, g, cx - ex, py + ey, eq[0], eq[1]);
    pan(ctx, g, cx + ex, py - ey, eq[2], eq[3]);
    if (!small) {
      label(ctx, "Vế trái", cx - ex, py + ey + g.hang + 18, { align: "center", size: 12, color: COLORS.muted });
      label(ctx, "Vế phải", cx + ex, py - ey + g.hang + 18, { align: "center", size: 12, color: COLORS.muted });
    }

    // steps written beside (wide) or below (narrow)
    const all = s.log.split("\n");
    const lx = g.wide ? g.sw + 8 : 10;
    const ly = g.wide ? 18 : view.h - g.logH + 10;
    const lh = g.wide ? 36 : 16;
    const maxLines = g.wide ? Math.floor((view.h - 40) / lh) : g.lines;
    const shown = all.slice(-maxLines);
    const offset = all.length - shown.length;
    if (g.wide) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(g.sw, 0, g.logW, view.h);
      ctx.strokeStyle = COLORS.grid;
      ctx.strokeRect(g.sw + 0.5, 0.5, g.logW - 1, view.h - 1);
    } else {
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(0, ly - 6);
      ctx.lineTo(view.w, ly - 6);
      ctx.stroke();
    }
    label(ctx, "Các bước biến đổi", lx, ly + 2, { size: 12, bold: true, color: COLORS.muted });
    shown.forEach((line, i) => {
      const n = offset + i;
      const [op, eqs] = line.includes(": ") ? line.split(": ") : ["", line];
      const y = ly + (g.wide ? 24 : 18) + i * lh;
      if (g.wide && op) {
        label(ctx, op, lx, y - 4, { size: 11, color: COLORS.muted });
        label(ctx, `⇔ ${eqs}`, lx + 6, y + 9, { size: 14, bold: i === shown.length - 1 });
      } else {
        label(ctx, `${n ? "⇔ " : ""}${eqs}${op && !g.wide ? `   (${op})` : ""}`, lx, y, { size: 12, bold: i === shown.length - 1 });
      }
    });
  },
});
