import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { COLS, ROWS, initialState, analyse, isomers, record, sanitize, addCarbon, removeCarbon, addBond, atomAt, bondIndex, neighbours, formula, sub } from "./model.js";

const ERRORS = {
  empty: "Kéo trên lưới để vẽ mạch carbon",
  valence: "Carbon tô đỏ có hơn 4 liên kết: carbon chỉ có hóa trị IV",
  ring: "Có mạch vòng: alkane là hydrocarbon no, mạch hở",
  disconnected: "Các nguyên tử carbon chưa nối thành một mạch",
};

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const wide = view.w >= 640;
  const top = small ? 46 : 66;
  const bottom = wide ? 26 : small ? 40 : 52;
  const right = wide ? 240 : 8;
  const cell = Math.min((view.w - 8 - right) / COLS, (view.h - top - bottom) / ROWS);
  const ox = 8 + (view.w - 8 - right - cell * COLS) / 2;
  const oy = top + (view.h - top - bottom - cell * ROWS) / 2;
  return { small, wide, cell, ox, oy, top };
}
const centre = (g, [x, y]) => [g.ox + (x + 0.5) * g.cell, g.oy + (y + 0.5) * g.cell];

/** What is under the pointer: { atom } | { bond } | { cell } | null. */
function hit(p, s, g) {
  const i = s.atoms.findIndex(a => {
    const [cx, cy] = centre(g, a);
    return Math.abs(p.x - cx) < g.cell * 0.36 && Math.abs(p.y - cy) < g.cell * 0.3;
  });
  if (i >= 0) return { atom: i };
  const b = s.bonds.findIndex(([i, j]) => {
    const [ax, ay] = centre(g, s.atoms[i]);
    const [bx, by] = centre(g, s.atoms[j]);
    return Math.hypot(p.x - (ax + bx) / 2, p.y - (ay + by) / 2) < g.cell * 0.22;
  });
  if (b >= 0) return { bond: b };
  const x = Math.floor((p.x - g.ox) / g.cell);
  const y = Math.floor((p.y - g.oy) / g.cell);
  return x >= 0 && y >= 0 && x < COLS && y < ROWS ? { cell: [x, y] } : null;
}

// End of one learner gesture that changed the skeleton.
function finish(s, api) {
  const a = record(s);
  s._last = a.ok ? (a.n !== s.target ? "other" : a.isNew ? "new" : "dup") : "";
  if (a.ok) api.emit("named", { n: a.n, isomer: a.id }, "result");
  if (a.isNew && s.found.length === isomers(s.target).length) api.emit("all-isomers", { n: s.target, count: s.found.length }, "goal");
}

const add = (s, api, x, y) => {
  const i = addCarbon(s, x, y);
  if (i < 0) s._msg = "Tối đa 7 nguyên tử carbon";
  else api.emit("carbon-add", { n: s.atoms.length });
  return i;
};

/** label() shrunk (down to 9 px) and then cut with "…" so it fits in maxW. */
function fit(ctx, text, maxW, x, y, opts) {
  const width = (t, size) => {
    ctx.font = `${opts.bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    return ctx.measureText(t).width;
  };
  const size = Math.max(9, Math.min(opts.size, (opts.size * maxW) / width(text, opts.size)));
  while (text.length > 4 && width(text, size) > maxW) text = text.slice(0, -2) + "…";
  label(ctx, text, x, y, { ...opts, size });
}

const cname = h => (h < 0 ? "C" : `C${h ? "H" + (h > 1 ? sub(h) : "") : ""}`);

mount({
  slug: "dong-phan-ankan",
  version: "1.0.0",
  title: "Đồng phân và danh pháp alkane",
  hint: "Kéo từ một carbon sang ô bên cạnh để nối thêm carbon (kéo tiếp để vẽ cả mạch). Chạm vào một carbon để xóa nó, chạm vào giữa một liên kết để bỏ liên kết.",
  initialState,
  sanitize,
  controls: [
    { type: "heading", label: "Tìm tất cả đồng phân" },
    {
      type: "stepper",
      key: "target",
      label: "Số nguyên tử C (n)",
      min: 1,
      max: 7,
      onChange(s) {
        s.found = [];
        const a = record(s);
        s._last = a.ok && a.n === s.target ? "new" : "";
      },
    },
    { type: "checkbox", key: "showAll", label: "Hiện tên tất cả đồng phân" },
    {
      type: "button",
      label: "Xóa lưới",
      event: "clear",
      action(s) {
        s.atoms = [];
        s.bonds = [];
        s._last = s._msg = "";
      },
    },
  ],
  readouts: [
    { label: "Công thức phân tử", value: s => { const a = analyse(s.atoms, s.bonds); return a.ok ? formula(a.n, a.H) : "–"; } },
    { label: "Số nguyên tử H", value: s => { const a = analyse(s.atoms, s.bonds); return a.ok ? `${a.H} = 2·${a.n} + 2` : "–"; } },
    { label: "Tên IUPAC", value: s => analyse(s.atoms, s.bonds).name ?? "–" },
    { label: "Đồng phân đã tìm", value: s => `${s.found.length}/${isomers(s.target).length} (${formula(s.target, 2 * s.target + 2)})` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      const h = hit(p, s, g);
      s._msg = "";
      if (!h) return false;
      if (h.bond !== undefined) {
        s.bonds.splice(h.bond, 1);
        api.emit("bond-remove", { n: s.atoms.length, bonds: s.bonds.length });
        finish(s, api);
        return false;
      }
      if (h.atom !== undefined) {
        s._drag = { from: h.atom, moved: false, changed: false };
        return true;
      }
      const i = add(s, api, ...h.cell);
      if (i < 0) return false;
      s._drag = { from: i, moved: true, changed: true };
      return true;
    },
    move(p, s, api, view) {
      const d = s._drag;
      if (!d) return;
      const h = hit(p, s, geom(view));
      const cell = h?.atom !== undefined ? s.atoms[h.atom] : h?.cell;
      if (!cell || !neighbours(s.atoms[d.from], cell)) return;
      let j = atomAt(s, ...cell);
      if (j < 0) {
        j = add(s, api, ...cell);
        if (j < 0) return;
      } else if (bondIndex(s, d.from, j) >= 0) {
        d.from = j; // walking along an existing bond
        d.moved = true;
        return;
      }
      addBond(s, d.from, j);
      d.from = j;
      d.moved = d.changed = true;
    },
    up(p, s, api) {
      const d = s._drag;
      s._drag = null;
      if (!d) return;
      if (!d.moved && !d.changed) {
        removeCarbon(s, d.from);
        api.emit("carbon-remove", { n: s.atoms.length });
      } else if (!d.changed) return;
      finish(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const a = analyse(s.atoms, s.bonds);
    const deg = s.atoms.map((_, i) => s.bonds.filter(b => b.includes(i)).length);
    const size = g.small ? 13 : 16;

    // status
    if (a.ok) {
      label(ctx, `${formula(a.n, a.H)}   ${a.name}`, 10, g.small ? 13 : 20, { size: size + 2, bold: true });
      const tgt = formula(s.target, 2 * s.target + 2);
      const note = {
        new: `✓ Đồng phân mới của ${tgt}`,
        dup: `Trùng với một đồng phân ${tgt} đã tìm`,
        other: `Đang tìm đồng phân của ${tgt} (n = ${s.target})`,
      }[s._last] ?? (a.n === s.target ? `Một đồng phân của ${tgt}` : `Đang tìm đồng phân của ${tgt} (n = ${s.target})`);
      label(ctx, s._msg || note, 10, g.small ? 33 : 46, { size: size - 2, color: s._msg ? COLORS.red : s._last === "new" ? COLORS.green : COLORS.muted });
    } else {
      label(ctx, ERRORS[a.error], 10, g.small ? 13 : 20, { size: g.small ? 12 : 15, bold: true, color: a.error === "empty" ? COLORS.ink : COLORS.red });
      label(ctx, s._msg || "Tối đa 7 nguyên tử carbon, liên kết với ô kề bên (kể cả ô chéo)", 10, g.small ? 33 : 46, { size: size - 3, color: s._msg ? COLORS.red : COLORS.muted });
    }

    // grid
    ctx.fillStyle = COLORS.grid;
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
      const [cx, cy] = centre(g, [x, y]);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, g.cell * 0.06), 0, Math.PI * 2);
      ctx.fill();
    }

    const chain = a.ok ? a.chain : [];
    ctx.lineCap = "round";
    for (const [i, j] of s.bonds) {
      const inChain = Math.abs(chain.indexOf(i) - chain.indexOf(j)) === 1 && chain.includes(i) && chain.includes(j);
      ctx.strokeStyle = inChain ? COLORS.blue : COLORS.ink;
      ctx.lineWidth = Math.max(2, g.cell * 0.07);
      ctx.beginPath();
      ctx.moveTo(...centre(g, s.atoms[i]));
      ctx.lineTo(...centre(g, s.atoms[j]));
      ctx.stroke();
    }
    const bw = g.cell * 0.7;
    const bh = g.cell * 0.44;
    s.atoms.forEach((p, i) => {
      const [cx, cy] = centre(g, p);
      const over = deg[i] > 4;
      const k = chain.indexOf(i);
      ctx.fillStyle = over ? "#fde7e8" : "#fff";
      ctx.strokeStyle = over ? COLORS.red : k >= 0 ? COLORS.blue : COLORS.ink;
      ctx.lineWidth = k >= 0 || over ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, bh / 3);
      ctx.fill();
      ctx.stroke();
      label(ctx, cname(4 - deg[i]), cx, cy + 1, { size: Math.min(18, g.cell * 0.27), align: "center", bold: true, color: over ? COLORS.red : COLORS.ink });
      if (k >= 0 && a.n > 1) label(ctx, String(k + 1), cx - bw / 2 - 1, cy - bh / 2 - 2, { size: Math.min(14, g.cell * 0.22), align: "center", bold: true, color: COLORS.blue });
    });

    // isomer list
    const list = isomers(s.target);
    const head = `Đồng phân ${formula(s.target, 2 * s.target + 2)}: ${s.found.length}/${list.length}`;
    const done = s.found.length === list.length;
    if (g.wide) {
      const x = view.w - 228;
      let y = g.top + 6;
      label(ctx, head, x, y, { size: 15, bold: true, color: done ? COLORS.green : COLORS.ink });
      y += 26;
      for (const iso of list) {
        const found = s.found.includes(iso.id);
        label(ctx, `${iso.id}. ${found || s.showAll ? iso.name : "?"}${found ? "  ✓" : ""}`, x, y, { size: 14, color: found ? COLORS.green : COLORS.muted, bold: found });
        y += 22;
      }
      label(ctx, "Mạch chính (dài nhất) tô xanh, số là vị trí của C. Lưới chỉ là sơ đồ phẳng: góc liên kết thật ≈ 109,5°.", 10, view.h - 13, { size: 12, color: COLORS.muted });
    } else {
      const names = s.showAll ? list.map(i => i.name).join(", ") : list.filter(i => s.found.includes(i.id)).map(i => i.name).join(", ");
      fit(ctx, `${head}${names ? ": " + names : ""}`, view.w - 20, 10, view.h - (g.small ? 28 : 36), { size: g.small ? 11 : 13, bold: true, color: done ? COLORS.green : COLORS.ink });
      label(ctx, "Mạch chính tô xanh; sơ đồ phẳng, góc liên kết thật ≈ 109,5°", 10, view.h - (g.small ? 11 : 14), { size: g.small ? 10 : 12, color: COLORS.muted });
    }
  },
});
