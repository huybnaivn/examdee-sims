import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { PLACES, MAX, initialState, value, digits, regroup, valueB, format, words, compare, firstDifference, round, decimalsFor, newTarget, sanitize } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const PLACE_COLORS = [COLORS.purple, COLORS.blue, COLORS.green, COLORS.orange, COLORS.red, "#b8860b"];
const SIGN = { "-1": "<", 0: "=", 1: ">" };
const ANIM_MS = 900;
const ROUND_NAMES = { 10: "phần mười", 100: "hàng đơn vị", 1000: "hàng chục", 10000: "hàng trăm" };

function fit(ctx, text, x, y, size, maxW, opts = {}) {
  ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, align: opts.align ?? "center", size: w > maxW ? Math.max(9, (size * maxW) / w) : size });
}

/** One block of place i, centred at (x, y), about `size` px. Drawn as a symbol, not to scale. */
function block(ctx, i, x, y, size) {
  const color = PLACE_COLORS[i];
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  const rect = (w, h) => {
    ctx.beginPath();
    ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fill();
    ctx.stroke();
  };
  const s = size;
  if (i === 0) {
    // thousand: a cube
    const f = s * 0.72;
    const k = s * 0.22;
    ctx.beginPath();
    ctx.moveTo(x - f / 2, y - f / 2 + k / 2);
    ctx.lineTo(x - f / 2 + k, y - f / 2 - k / 2);
    ctx.lineTo(x + f / 2 + k, y - f / 2 - k / 2);
    ctx.lineTo(x + f / 2 + k, y + f / 2 - k / 2);
    ctx.lineTo(x + f / 2, y + f / 2 + k / 2);
    ctx.lineTo(x - f / 2, y + f / 2 + k / 2);
    ctx.closePath();
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.rect(x - f / 2, y - f / 2 + k / 2, f, f);
    ctx.fill();
    ctx.stroke();
  } else if (i === 1) {
    // hundred: a flat square with a grid
    const f = s * 0.82;
    rect(f, f);
    ctx.beginPath();
    for (let j = 1; j < 5; j++) {
      ctx.moveTo(x - f / 2 + (j * f) / 5, y - f / 2);
      ctx.lineTo(x - f / 2 + (j * f) / 5, y + f / 2);
      ctx.moveTo(x - f / 2, y - f / 2 + (j * f) / 5);
      ctx.lineTo(x + f / 2, y - f / 2 + (j * f) / 5);
    }
    ctx.stroke();
  } else if (i === 2) {
    // ten: a rod of ten
    const h = s * 0.86;
    rect(s * 0.24, h);
    ctx.beginPath();
    for (let j = 1; j < 5; j++) {
      ctx.moveTo(x - s * 0.12, y - h / 2 + (j * h) / 5);
      ctx.lineTo(x + s * 0.12, y - h / 2 + (j * h) / 5);
    }
    ctx.stroke();
  } else if (i === 3) rect(s * 0.42, s * 0.42); // one: a small cube
  else if (i === 4) rect(s * 0.42, s * 0.14); // tenth: a thin slice of the unit cube
  else {
    ctx.beginPath(); // hundredth: a small dot
    ctx.arc(x, y, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Called after a block stepper changes: regroup tens (with an animation), report what happened.
function blocksChanged(c, i) {
  return (s, api) => {
    if (value(s) > MAX) s[c] -= 1; // 9999,99 is the largest number on the board
    const { counts, into } = regroup(s);
    Object.assign(s, counts);
    api.emit("block-change", { place: PLACES[i].unit / 100, count: s[c], value: value(s) / 100 }, "action");
    for (const key of into) {
      const p = PLACES.find(q => q.key === key);
      api.emit("regrouped", { place: p.unit / 100, value: value(s) / 100 }, "result");
    }
    if (into.length) {
      const anim = { from: PLACES.findIndex(q => q.key === into[0]) + 1, start: performance.now(), count: into.length };
      s._anim = anim;
      const tick = () => {
        api.redraw();
        if (performance.now() - anim.start < ANIM_MS) requestAnimationFrame(tick);
        else if (s._anim === anim) s._anim = null;
      };
      requestAnimationFrame(tick);
    }
    checkTarget(s, api);
  };
}

function checkTarget(s, api) {
  const built = s.mode === "target" && value(s) === s.target;
  if (built && !s._built) api.emit("target-built", { target: s.target / 100 }, "goal");
  s._built = built;
}

/** Column layout shared by the blocks and the place-value table. */
function columns(view) {
  const small = view.w < 560 || view.h < 420;
  const x0 = small ? 6 : 24;
  const colW = (view.w - 2 * x0) / PLACES.length;
  return { small, x0, colW, cx: i => x0 + (i + 0.5) * colW };
}

mount({
  slug: "so-thap-phan",
  version: "1.0.0",
  title: "Giá trị theo vị trí và số thập phân",
  hint: "Thêm hoặc bớt các khối. Đủ 10 khối ở một hàng thì đổi thành 1 khối của hàng liền bên trái.",
  initialState,
  sanitize,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "build", label: "Đọc, viết số" },
        { value: "compare", label: "So sánh hai số" },
        { value: "round", label: "Làm tròn số" },
        { value: "target", label: "Xếp số theo mẫu" },
      ],
      // a number that already matches when the activity is chosen is not an achievement
      onChange: s => {
        s._built = s.mode === "target" && value(s) === s.target;
      },
    },
    {
      type: "button",
      label: "Số khác",
      primary: true,
      visible: s => s.mode === "target",
      event: "new-target",
      action: s => {
        s.target = newTarget(Math.random, s.target);
        s._built = value(s) === s.target;
      },
    },
    { type: "heading", label: "Các khối" },
    ...PLACES.map((p, i) => ({ type: "stepper", key: p.key, label: p.name, min: 0, max: i === 0 ? 9 : 10, onChange: blocksChanged(p.key, i) })),
    { type: "heading", label: "Số B", visible: s => s.mode === "compare" },
    { type: "slider", key: "bInt", label: "Phần nguyên của B", min: 0, max: 9999, step: 1, digits: 0, visible: s => s.mode === "compare" },
    { type: "stepper", key: "bD", label: "Chữ số hàng phần mười của B", min: 0, max: 9, visible: s => s.mode === "compare" },
    { type: "stepper", key: "bC", label: "Chữ số hàng phần trăm của B", min: 0, max: 9, visible: s => s.mode === "compare" },
    {
      type: "select",
      key: "roundTo",
      label: "Làm tròn đến",
      visible: s => s.mode === "round",
      options: [
        { value: 10, label: "hàng phần mười" },
        { value: 100, label: "hàng đơn vị" },
        { value: 1000, label: "hàng chục" },
        { value: 10000, label: "hàng trăm" },
      ],
    },
  ],
  readouts: [
    { label: "Số", value: s => format(value(s)) },
    { label: "So sánh với B", value: s => `${format(value(s))} ${SIGN[compare(value(s), valueB(s))]} ${format(valueB(s))}` },
    { label: "Làm tròn", value: s => `≈ ${format(round(value(s), s.roundTo), decimalsFor(s.roundTo))}` },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const col = columns(view);
    const { small, colW } = col;
    const v = value(s);
    const vb = valueB(s);
    const now = performance.now();

    // header: digits and words
    let y = small ? 18 : 30;
    fit(ctx, format(v), w / 2, y, small ? 26 : 40, w - 16, { bold: true, color: COLORS.blue });
    y += small ? 22 : 34;
    const said = words(v);
    fit(ctx, said, w / 2, y, small ? 13 : 17, w - 12);
    if (said.includes("linh")) {
      y += small ? 15 : 20;
      fit(ctx, `hoặc: ${said.replaceAll("linh", "lẻ")}`, w / 2, y, small ? 11 : 14, w - 12, { color: COLORS.muted });
    }

    // the activity line
    y += small ? 20 : 30;
    const lineSize = small ? 14 : 19;
    const highlight = new Set();
    if (s.mode === "compare") {
      const sign = compare(v, vb);
      const dec = Math.max(format(v).split(",")[1]?.length ?? 0, format(vb).split(",")[1]?.length ?? 0);
      fit(ctx, `A = ${format(v)}  ${SIGN[sign]}  B = ${format(vb)}`, w / 2, y, lineSize, w - 12, { bold: true, color: COLORS.purple });
      y += small ? 17 : 24;
      const k = firstDifference(v, vb);
      const why = k < 0 ? "Hai số bằng nhau" : `Khác nhau đầu tiên ở hàng ${PLACES[k].name.toLowerCase()}`;
      const pad = dec ? ` · viết đủ: ${format(v, dec)} và ${format(vb, dec)}` : "";
      fit(ctx, why + pad, w / 2, y, small ? 11 : 14, w - 12, { color: COLORS.muted });
      if (k >= 0) highlight.add(k);
    } else if (s.mode === "round") {
      const r = round(v, s.roundTo);
      fit(ctx, `${format(v)} ≈ ${format(r, decimalsFor(s.roundTo))}  (làm tròn đến ${ROUND_NAMES[s.roundTo]})`, w / 2, y, lineSize, w - 12, { bold: true, color: COLORS.purple });
      y += small ? 17 : 24;
      const k = PLACES.findIndex(p => p.unit === s.roundTo);
      const next = digits(v)[PLACES[k + 1].key];
      fit(ctx, `Chữ số ngay sau hàng làm tròn là ${next} ${next >= 5 ? "≥ 5 nên cộng thêm 1" : "< 5 nên giữ nguyên"}`, w / 2, y, small ? 11 : 14, w - 12, { color: COLORS.muted });
      highlight.add(k).add(k + 1);
    } else if (s.mode === "target") {
      const ok = v === s.target;
      fit(ctx, ok ? `Đúng rồi! Em đã xếp được số ${format(s.target)}` : `Hãy xếp các khối để được số ${format(s.target)}`, w / 2, y, lineSize, w - 12, { bold: true, color: ok ? COLORS.green : COLORS.purple });
    }

    // place-value table at the bottom (row B only when comparing)
    const rowH = small ? 20 : 28;
    const rows = s.mode === "compare" ? 3 : 2;
    const tableTop = h - rows * rowH - (small ? 4 : 10);
    const nameSize = small ? 10 : 13;
    PLACES.forEach((p, i) => {
      const x = col.x0 + i * colW;
      if (highlight.has(i)) {
        ctx.fillStyle = "rgba(245, 197, 24, 0.3)";
        ctx.fillRect(x, tableTop, colW, rows * rowH);
      }
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, tableTop, colW, rows * rowH);
      fit(ctx, p.name, col.cx(i), tableTop + rowH / 2, nameSize, colW - 4, { bold: true, color: PLACE_COLORS[i] });
      const dA = digits(v)[p.key];
      fit(ctx, String(dA), col.cx(i), tableTop + rowH * 1.5, small ? 15 : 20, colW, { bold: true });
      if (rows === 3) fit(ctx, String(digits(vb)[p.key]), col.cx(i), tableTop + rowH * 2.5, small ? 15 : 20, colW, { bold: true, color: COLORS.purple });
    });
    // decimal comma between units and tenths, and row names
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(col.x0 + 4 * colW, tableTop);
    ctx.lineTo(col.x0 + 4 * colW, tableTop + rows * rowH);
    ctx.stroke();
    for (let r = 1; r < rows; r++) label(ctx, ",", col.x0 + 4 * colW - (small ? 5 : 7), tableTop + rowH * (r + 0.5) - 1, { align: "center", size: small ? 18 : 24, bold: true, color: COLORS.red });
    if (rows === 3 && col.x0 > 14) ["A", "B"].forEach((n, r) => label(ctx, n, col.x0 - 9, tableTop + rowH * (r + 1.5), { align: "center", size: 13, bold: true, color: r ? COLORS.purple : COLORS.ink }));

    // blocks: one column per place, up to ten slots (2 wide, 5 high), filled from the bottom
    const top = y + (small ? 14 : 22);
    const bottom = tableTop - (small ? 14 : 18);
    const cell = Math.max(6, Math.min(colW / 2.2, (bottom - top) / 5, 64));
    const slot = (i, k) => ({ x: col.cx(i) + ((k % 2) - 0.5) * cell * 1.02, y: bottom - (Math.floor(k / 2) + 0.5) * cell });
    const anim = s._anim && now - s._anim.start < ANIM_MS ? s._anim : null;
    PLACES.forEach((p, i) => {
      const n = Math.max(0, Math.min(10, s[p.key]));
      for (let k = 0; k < n; k++) {
        // the block made by regrouping appears at the end of the animation
        if (anim && i === anim.from - 1 && k === n - 1 && (now - anim.start) / ANIM_MS < 0.85) continue;
        const q = slot(i, k);
        block(ctx, i, q.x, q.y, cell);
      }
    });
    label(ctx, "Các khối là kí hiệu, không vẽ theo tỉ lệ", w - 6, bottom + (small ? 7 : 9), { align: "right", size: small ? 9 : 11, color: COLORS.muted });

    if (anim) {
      const t = Math.min(1, (now - anim.start) / ANIM_MS);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const to = slot(anim.from - 1, Math.max(0, s[PLACES[anim.from - 1].key] - 1));
      ctx.save();
      ctx.globalAlpha = 1 - 0.6 * e;
      for (let k = 0; k < 10; k++) {
        const from = slot(anim.from, k);
        block(ctx, anim.from, from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, cell * (1 - 0.3 * e));
      }
      ctx.restore();
      const a = PLACES[anim.from].name.toLowerCase();
      const b = PLACES[anim.from - 1].name.toLowerCase();
      const text = `10 ${a} = 1 ${b}${anim.count > 1 ? " …" : ""}`;
      ctx.font = `600 ${small ? 14 : 20}px ${FONT}`;
      const tw = ctx.measureText(text).width + 20;
      const by = (top + bottom) / 2;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.roundRect(w / 2 - tw / 2, by - 16, tw, 32, 10);
      ctx.fill();
      label(ctx, text, w / 2, by, { align: "center", size: small ? 14 : 20, bold: true, color: PLACE_COLORS[anim.from - 1] });
    }
  },
});
