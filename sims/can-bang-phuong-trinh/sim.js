import { mount, COLORS, arrow, label, clamp } from "../../kit/v1/kit.js";
import { REACTIONS, MAX, initialState, reactionById, species, coefficients, parseFormula, atomCounts, elements, status, pretty, gcdAll } from "./model.js";

const KEYS = ["c1", "c2", "c3", "c4"];
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'; // same as kit label()
const textWidth = (ctx, text, size, bold) => {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  return ctx.measureText(text).width;
};
/** label() that shrinks the font until the text fits in maxW. */
const fit = (ctx, text, x, y, maxW, opts) => {
  const tw = textWidth(ctx, text, opts.size, opts.bold);
  label(ctx, text, x, y, { ...opts, size: tw > maxW ? (opts.size * maxW) / tw : opts.size });
};

// [fill, text colour] per element
const ATOM = {
  H: ["#ffffff", COLORS.ink],
  O: [COLORS.red, "#fff"],
  C: ["#3b4252", "#fff"],
  N: [COLORS.blue, "#fff"],
  Cl: [COLORS.green, "#fff"],
  Fe: ["#b9622c", "#fff"],
  Al: ["#9aa5b8", "#fff"],
  P: [COLORS.orange, "#fff"],
  K: [COLORS.purple, "#fff"],
  Na: ["#b05ad8", "#fff"],
  Zn: ["#5f7d95", "#fff"],
};

function drawAtom(ctx, el, x, y, r) {
  const [fill, ink] = ATOM[el] ?? [COLORS.muted, "#fff"];
  ctx.fillStyle = fill;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (r >= 7) label(ctx, el, x, y + 0.5, { color: ink, size: r * (el.length > 1 ? 0.95 : 1.15), align: "center", bold: true });
}

// ponytail: schematic molecule (least numerous atoms in a row, the rest around them), not real bond geometry.
const shapes = new Map();
function shape(formula) {
  if (shapes.has(formula)) return shapes.get(formula);
  const counts = parseFormula(formula);
  const els = Object.keys(counts);
  const total = els.reduce((n, el) => n + counts[el], 0);
  const outerEl = els.length > 1 && total > 2 ? els.reduce((a, b) => (counts[b] >= counts[a] ? b : a)) : null;
  const core = els.filter(el => el !== outerEl).flatMap(el => Array(counts[el]).fill(el));
  const D = 1.7; // centre distance in atom radii, so neighbours overlap like bonded atoms
  const half = ((core.length - 1) * D) / 2;
  const atoms = [];
  const k = outerEl ? counts[outerEl] : 0;
  const offset = k === 1 ? 0 : k % 2 ? -Math.PI / 2 : k === 4 && core.length > 1 ? Math.PI / 4 : 0;
  for (let i = 0; i < k; i++) {
    const a = offset + (i * 2 * Math.PI) / k;
    atoms.push({ el: outerEl, x: (half + D) * Math.cos(a), y: D * Math.sin(a) });
  }
  core.forEach((el, i) => atoms.push({ el, x: i * D - half, y: 0 }));
  const xs = atoms.map(a => a.x);
  const ys = atoms.map(a => a.y);
  const result = {
    atoms,
    cx: (Math.min(...xs) + Math.max(...xs)) / 2,
    cy: (Math.min(...ys) + Math.max(...ys)) / 2,
    bw: Math.max(...xs) - Math.min(...xs) + 2.7, // includes a gap between neighbours
    bh: Math.max(...ys) - Math.min(...ys) + 2.7,
  };
  shapes.set(formula, result);
  return result;
}

/** Best grid for k copies of a shape in a cw × ch cell: { r, cols, rows }. */
function grid(sh, k, cw, ch) {
  let best = { r: 0, cols: 1, rows: k };
  for (let cols = 1; cols <= k; cols++) {
    const rows = Math.ceil(k / cols);
    const r = Math.min(cw / (cols * sh.bw), ch / (rows * sh.bh));
    if (r > best.r) best = { r, cols, rows };
  }
  return best;
}

const segments = (r, c) =>
  species(r).flatMap((f, i) => [
    { text: i === 0 ? "" : i === r.left.length ? "  →  " : "  +  ", color: COLORS.muted },
    { text: c && c[i] !== 1 ? String(c[i]) : "", color: COLORS.blue }, // textbook style: 1 is not written
    { text: pretty(f), color: COLORS.ink },
  ]);

const STATUS = {
  unbalanced: () => ["Chưa cân bằng: số nguyên tử ở hai vế chưa bằng nhau", COLORS.red],
  multiple: c => [`Hai vế đã bằng nhau, nhưng hệ số chưa tối giản: hãy chia tất cả cho ${gcdAll(c)}`, COLORS.orange],
  balanced: () => ["✓ Phương trình đã được cân bằng", COLORS.green],
};

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

mount({
  slug: "can-bang-phuong-trinh",
  version: "1.0.0",
  title: "Cân bằng phương trình hóa học",
  hint: "Bấm + hoặc − để đổi hệ số, cho đến khi số nguyên tử của mỗi nguyên tố ở hai vế bằng nhau.",
  initialState,
  sanitize(incoming) {
    const out = {};
    if (typeof incoming.reaction === "string") out.reaction = incoming.reaction;
    for (const key of KEYS) if (Number.isInteger(incoming[key])) out[key] = clamp(incoming[key], 1, MAX);
    return out;
  },
  controls: [
    {
      type: "select",
      key: "reaction",
      label: "Phản ứng",
      options: REACTIONS.map(r => ({ value: r.id, label: segments(r).map(p => p.text).join("").replace(/ +/g, " ") })),
      onChange(s, api) {
        for (const key of KEYS) s[key] = 1;
        api.sync();
      },
    },
    { type: "heading", label: "Hệ số" },
    {
      type: "custom",
      render(box, api) {
        const rows = KEYS.map(key => {
          const row = document.createElement("div");
          row.style.cssText = "display:flex;align-items:center;gap:8px";
          const name = document.createElement("span");
          name.style.cssText = "flex:1;font-weight:600;font-size:16px";
          const out = document.createElement("output");
          out.style.cssText = "min-width:28px;text-align:center;font-size:18px";
          const button = (text, delta) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = text;
            b.style.cssText = "width:44px;padding:0;font-size:20px;font-weight:600";
            b.addEventListener("click", () => {
              const s = api.state;
              const r = reactionById(s.reaction);
              const before = status(r, coefficients(s, r));
              s[key] = clamp(s[key] + delta, 1, MAX);
              api.sync();
              api.emit("param", { key, value: s[key] }, "param");
              const c = coefficients(s, r);
              if (before !== "balanced" && status(r, c) === "balanced") {
                api.emit("balanced", { reaction: r.id, coefficients: c }, "goal");
              }
            });
            return b;
          };
          const minus = button("−", -1);
          const plus = button("+", 1);
          row.append(name, minus, out, plus);
          box.append(row);
          return { row, name, out, minus, plus };
        });
        return () => {
          const s = api.state;
          const all = species(reactionById(s.reaction));
          rows.forEach((ui, i) => {
            ui.row.style.display = i < all.length ? "flex" : "none";
            if (i >= all.length) return;
            const formula = pretty(all[i]);
            ui.name.textContent = formula;
            ui.out.textContent = s[KEYS[i]];
            ui.minus.disabled = s[KEYS[i]] <= 1;
            ui.plus.disabled = s[KEYS[i]] >= MAX;
            ui.minus.style.opacity = ui.minus.disabled ? 0.4 : 1;
            ui.plus.style.opacity = ui.plus.disabled ? 0.4 : 1;
            ui.minus.setAttribute("aria-label", `Giảm hệ số của ${formula}`);
            ui.plus.setAttribute("aria-label", `Tăng hệ số của ${formula}`);
          });
        };
      },
    },
  ],
  readouts: [
    {
      label: "Trạng thái",
      value: s => {
        const r = reactionById(s.reaction);
        return { unbalanced: "Chưa cân bằng", multiple: "Chưa tối giản", balanced: "Đã cân bằng" }[status(r, coefficients(s, r))];
      },
    },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const r = reactionById(s.reaction);
    const all = species(r);
    const c = coefficients(s, r);
    const st = status(r, c);
    const pad = 12;
    const base = clamp(w / 50, 11, 15);

    // equation, coefficients in blue
    const segs = segments(r, c);
    let size = clamp(w / 26, 16, 30);
    const total = segs.reduce((n, p) => n + textWidth(ctx, p.text, size, true), 0);
    if (total > w - 2 * pad) size *= (w - 2 * pad) / total;
    let x = w / 2 - segs.reduce((n, p) => n + textWidth(ctx, p.text, size, true), 0) / 2;
    for (const p of segs) {
      label(ctx, p.text, x, h * 0.065, { color: p.color, size, bold: true });
      x += textWidth(ctx, p.text, size, true);
    }

    // status pill
    const [text, color] = STATUS[st](c);
    const pillSize = Math.min(base + 1, ((base + 1) * (w - 2 * pad - 24)) / textWidth(ctx, text, base + 1, true));
    const pillW = textWidth(ctx, text, pillSize, true) + 24;
    const pillH = pillSize + 12;
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = color;
    roundRect(ctx, w / 2 - pillW / 2, h * 0.15 - pillH / 2, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    label(ctx, text, w / 2, h * 0.15, { color, size: pillSize, align: "center", bold: true });

    // molecules: one column per substance, one drawing per unit of coefficient
    const top = h * 0.21;
    const bottom = h * 0.66;
    const arrowW = clamp(w * 0.05, 20, 44);
    const colW = (w - 2 * pad - arrowW) / all.length;
    const nL = r.left.length;
    const colX = i => pad + i * colW + (i >= nL ? arrowW : 0);
    const headH = base + 8;
    const footH = base + 10;
    [
      ["Chất tham gia", 0, nL],
      ["Sản phẩm", nL, all.length - nL],
    ].forEach(([name, first, n]) => {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1.5;
      roundRect(ctx, colX(first), top, colW * n, bottom - top, 10);
      ctx.fill();
      ctx.stroke();
      fit(ctx, name, colX(first) + (colW * n) / 2, top + headH / 2 + 3, colW * n - 8, { color: COLORS.muted, size: base - 1, align: "center" });
    });
    arrow(ctx, colX(nL) - arrowW + 3, (top + bottom) / 2, colX(nL) - 3, (top + bottom) / 2, COLORS.muted, 2.5);

    const cellW = colW - 10;
    const cellH = bottom - top - headH - footH - 4;
    const grids = all.map((f, i) => grid(shape(f), c[i], cellW, cellH));
    const R = Math.min(20, ...grids.map(g => g.r)); // one atom size for the whole picture
    all.forEach((f, i) => {
      const sh = shape(f);
      const g = grids[i];
      const stepX = Math.min(cellW / g.cols, sh.bw * R * 1.3);
      const stepY = Math.min(cellH / g.rows, sh.bh * R * 1.3);
      const cx = colX(i) + colW / 2;
      const cy = top + headH + 2 + cellH / 2;
      for (let j = 0; j < c[i]; j++) {
        const inRow = Math.min(g.cols, c[i] - Math.floor(j / g.cols) * g.cols);
        const mx = cx + ((j % g.cols) - (inRow - 1) / 2) * stepX;
        const my = cy + (Math.floor(j / g.cols) - (g.rows - 1) / 2) * stepY;
        for (const a of sh.atoms) drawAtom(ctx, a.el, mx + (a.x - sh.cx) * R, my + (a.y - sh.cy) * R, R);
      }
      fit(ctx, pretty(f), cx, bottom - footH / 2 - 2, colW - 8, { size: base + 1, align: "center", bold: true });
    });

    // atom count per element, left side against right side
    const { left, right } = atomCounts(r, c);
    const els = elements(r);
    const top2 = h * 0.69;
    const mid = w / 2;
    const gap = 22;
    const chip = clamp(base * 0.85, 9, 13);
    const maxLen = mid - gap - pad - 2 * chip - 8 - 30;
    const most = Math.max(6, ...els.map(el => Math.max(left[el], right[el])));
    fit(ctx, "Số nguyên tử ở vế trái", mid - gap, top2 + 8, mid - gap - pad, { color: COLORS.muted, size: base - 1, align: "right" });
    fit(ctx, "Số nguyên tử ở vế phải", mid + gap, top2 + 8, mid - gap - pad, { color: COLORS.muted, size: base - 1, align: "left" });
    const rowH = Math.min(44, (h - 6 - top2 - 20) / els.length);
    const barH = Math.min(18, rowH * 0.55);
    els.forEach((el, i) => {
      const y = top2 + 20 + rowH * (i + 0.5);
      const same = left[el] === right[el];
      drawAtom(ctx, el, pad + chip, y, chip);
      label(ctx, same ? "=" : "≠", mid, y, { color: same ? COLORS.green : COLORS.red, size: base + 6, align: "center", bold: true });
      [
        [left[el], -1, COLORS.blue],
        [right[el], 1, COLORS.orange],
      ].forEach(([n, dir, tint]) => {
        const len = (n / most) * maxLen;
        const x0 = mid + dir * gap;
        ctx.fillStyle = COLORS.grid;
        ctx.fillRect(Math.min(x0, x0 + dir * maxLen), y - barH / 2, maxLen, barH);
        ctx.fillStyle = same ? COLORS.green : tint;
        ctx.fillRect(Math.min(x0, x0 + dir * len), y - barH / 2, len, barH);
        label(ctx, String(n), x0 + dir * (maxLen + 6), y, { size: base + 1, align: dir < 0 ? "right" : "left", bold: true });
      });
    });
  },
});
