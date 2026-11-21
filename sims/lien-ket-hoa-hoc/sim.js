import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { ELEMENTS, SYMBOLS, COMPOUNDS, TYPES, TYPE_NAMES, THRESHOLDS, initialState, bondFor, structure, octet, shellText } from "./model.js";

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const pretty = f => f.replace(/\d/g, d => SUB[d]);
const charge = q => (q > 0 ? "+" : "−").replace(/^/, Math.abs(q) > 1 ? String(Math.abs(q)) : "");
const SUP = { "+": "⁺", "−": "⁻", 2: "²" };
const supCharge = q => [...charge(q)].map(c => SUP[c]).join("");
/** χ with two decimals, as printed in the textbook table (2,20 not 2,2). */
const chi = v => v.toFixed(2).replace(".", ",");
const font = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const TYPE_COLOR = { nonpolar: COLORS.green, polar: COLORS.blue, ionic: COLORS.orange };
const ZONE_FILL = { nonpolar: "#dcf2e8", polar: "#dfe9fd", ionic: "#fde9d6" };
const E1 = COLORS.blue; // electrons of the first atom (the metal, or the central atom)
const E2 = COLORS.red; // electrons of the other atom(s)
const REASONS = {
  metallic: "Hai kim loại: giữa các nguyên tử kim loại là liên kết kim loại, không xét trong sim này.",
  hydride: "Kim loại với hydrogen tạo hydride kim loại (như NaH), không xét trong sim này.",
  other: "Sim chưa có hợp chất đơn giản thỏa mãn quy tắc octet cho cặp nguyên tố này.",
  unknown: "Nguyên tố không có trong danh sách.",
};
const BOND_NAME = ["", "liên kết đơn", "liên kết đôi", "liên kết ba"];

// One result per chosen pair; an unsupported pair is reported with codes −1.
function report(s, api) {
  const bond = bondFor(s.a, s.b);
  api.emit(
    "bond-chosen",
    {
      a: SYMBOLS.indexOf(s.a),
      b: SYMBOLS.indexOf(s.b),
      deltaChi: bond.deltaChi,
      bondType: bond.type ? TYPES.indexOf(bond.type) : -1,
      ruleType: bond.type ? TYPES.indexOf(bond.rule) : -1,
      formula: bond.compound ? COMPOUNDS.indexOf(bond.compound) : -1,
    },
    "result"
  );
}

const textWidth = (ctx, t, size, bold) => ((ctx.font = font(size, bold)), ctx.measureText(t).width);

// Lewis dots: two dots of a pair sit across the side direction.
const SIDES = { T: [0, -1], R: [1, 0], B: [0, 1], L: [-1, 0] };
function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
/** Electrons on one side of a symbol at (x, y): colors = 1 or 2 colours. */
function sideDots(ctx, x, y, side, dist, r, colors) {
  const [dx, dy] = SIDES[side];
  const cx = x + dx * dist;
  const cy = y + dy * dist;
  const gap = r * 1.6;
  colors.forEach((c, k) => {
    const o = colors.length === 1 ? 0 : (k - 0.5) * 2 * gap;
    dot(ctx, cx + (dx ? 0 : o), cy + (dy ? 0 : o), r, c);
  });
}
/** Lewis dot distribution of e valence electrons: one per side first (T, R, B, L), then pairs. */
const lewis = e => ["T", "R", "B", "L"].map((side, k) => [side, (e > k ? 1 : 0) + (e > k + 4 ? 1 : 0)]);

function symbol(ctx, el, x, y, size, color = COLORS.ink) {
  label(ctx, el, x, y, { size, bold: true, align: "center", color });
}

function drawCovalent(ctx, bond, st, box, size) {
  const { atoms, bonds } = st;
  const d = size * 2.7;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const n = atoms.length;
  // centre plus terminals: left, right, then below (NH3) or above and below (CH4)
  const offs = [[-d, 0], [d, 0], n === 4 ? [0, d] : [0, -d], [0, d]];
  const pos = n === 2 ? [[cx - d / 2, cy], [cx + d / 2, cy]] : [[cx, cy], ...offs.slice(0, n - 1).map(([dx, dy]) => [cx + dx, cy + dy])];
  const r = Math.max(2.4, size * 0.13);
  const dist = size * 0.75;
  const colorOf = i => (i === 0 ? E1 : E2);
  const used = atoms.map(() => new Set());
  for (const b of bonds) {
    const [x1, y1] = pos[b.i];
    const [x2, y2] = pos[b.j];
    const horiz = Math.abs(y2 - y1) < 1;
    const side = (x, y, X, Y) => (horiz ? (X > x ? "R" : "L") : Y > y ? "B" : "T");
    used[b.i].add(side(x1, y1, x2, y2));
    used[b.j].add(side(x2, y2, x1, y1));
    // shared pairs between the atoms: each pair has one electron from each atom
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const step = r * 3.4;
    for (let k = 0; k < b.order; k++) {
      const o = (k - (b.order - 1) / 2) * step;
      const first = horiz ? (x1 < x2 ? b.i : b.j) : y1 < y2 ? b.i : b.j;
      const second = first === b.i ? b.j : b.i;
      if (horiz) {
        dot(ctx, mx - r * 1.4, my + o, r, colorOf(first));
        dot(ctx, mx + r * 1.4, my + o, r, colorOf(second));
      } else {
        dot(ctx, mx + o, my - r * 1.4, r, colorOf(first));
        dot(ctx, mx + o, my + r * 1.4, r, colorOf(second));
      }
    }
    // a soft ring around each shared region
    ctx.strokeStyle = "rgba(47, 111, 237, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(mx, my, horiz ? r * 3.6 : step * b.order * 0.5 + r * 2, horiz ? step * b.order * 0.5 + r * 2 : r * 3.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  atoms.forEach((a, i) => {
    const [x, y] = pos[i];
    symbol(ctx, a.el, x, y, size);
    // lone pairs on the free sides, the side opposite the (first) bond first
    const opposite = { L: "R", R: "L", T: "B", B: "T" };
    const first = [...used[i]][0];
    const order = [opposite[first], ...["T", "B", "L", "R"].filter(sd => sd !== opposite[first])].filter(sd => !used[i].has(sd));
    for (let k = 0; k < a.lone; k++) sideDots(ctx, x, y, order[k], dist, r, [colorOf(i), colorOf(i)]);
  });
  // partial charges for a polar bond: δ− on the more electronegative element
  if (bond.type === "polar") {
    const top = Math.max(...atoms.map(a => ELEMENTS[a.el].chi));
    atoms.forEach((a, i) => {
      const neg = ELEMENTS[a.el].chi === top;
      const [x, y] = pos[i];
      label(ctx, neg ? "δ−" : "δ+", x + size * 0.9, y - size * 0.95, { size: size * 0.55, color: neg ? COLORS.red : COLORS.blue, bold: true, align: "center" });
    });
  }
}

function curved(ctx, x1, y1, x2, y2, lift, color) {
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - lift;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();
  // head along the tangent at the end
  const tx = x2 - (mx + (x2 - mx) * 0.85);
  const ty = y2 - (my + (y2 - my) * 0.85);
  const len = Math.hypot(tx, ty) || 1;
  arrow(ctx, x2 - (tx / len) * 9, y2 - (ty / len) * 9, x2, y2, color, 1.6);
}

function drawIonic(ctx, bond, st, box, size, small) {
  const { ions } = st;
  const k = ions.length;
  const sp = Math.min(size * 5, box.w / k);
  const x0 = box.x + box.w / 2 - (sp * (k - 1)) / 2;
  const rowH = Math.min(box.h / 2, size * 4.2);
  const top = box.y + (box.h - 2 * rowH) / 2;
  const y1 = top + rowH * 0.62;
  const y2 = top + rowH * 1.55;
  const r = Math.max(2.4, size * 0.13);
  const dist = size * 0.75;
  const tag = small ? 11 : 13;
  label(ctx, "Trước", box.x, y1, { size: tag, color: COLORS.muted });
  label(ctx, "Sau", box.x, y2, { size: tag, color: COLORS.muted });
  // before: neutral atoms with their valence electrons
  const spots = {}; // index of anion -> list of free single-electron sides
  ions.forEach((ion, i) => {
    const x = x0 + i * sp;
    const E = ELEMENTS[ion.el];
    symbol(ctx, ion.el, x, y1, size);
    for (const [side, m] of lewis(E.valenceE)) if (m) sideDots(ctx, x, y1, side, dist, r, Array(m).fill(ion.charge > 0 ? E1 : E2));
    if (ion.charge < 0) spots[i] = lewis(E.valenceE).filter(([, m]) => m === 1).map(([side]) => side);
  });
  // transfer arrows: each metal electron to the nearest anion
  ions.forEach((ion, i) => {
    if (ion.charge < 0) return;
    let left = ion.given;
    const targets = [i - 1, i + 1].filter(j => ions[j]?.charge < 0);
    const share = Math.ceil(left / targets.length);
    for (const j of targets) {
      const m = Math.min(share, left);
      left -= m;
      if (!m) continue;
      const xa = x0 + i * sp;
      const xb = x0 + j * sp;
      const dir = Math.sign(xb - xa);
      curved(ctx, xa + dir * dist, y1 - size * 0.3, xb - dir * dist, y1 - size * 0.3, size * 0.9, COLORS.orange);
      label(ctx, `${m}e`, (xa + xb) / 2, y1 - size * 1.15, { size: tag, color: COLORS.orange, bold: true, align: "center" });
    }
  });
  // after: ions in brackets, the gained electrons in the metal's colour
  ions.forEach((ion, i) => {
    const x = x0 + i * sp;
    const E = ELEMENTS[ion.el];
    symbol(ctx, ion.el, x, y2, size);
    let half = textWidth(ctx, ion.el, size, true) / 2 + size * 0.2;
    if (ion.charge < 0) {
      for (const [side, m] of lewis(E.valenceE)) sideDots(ctx, x, y2, side, dist, r, m === 2 ? [E2, E2] : [E2, E1]);
      half = dist + r * 2.5;
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    const hh = size * 0.95;
    for (const s of [-1, 1]) {
      const bx = x + s * half;
      ctx.beginPath();
      ctx.moveTo(bx - s * 4, y2 - hh);
      ctx.lineTo(bx, y2 - hh);
      ctx.lineTo(bx, y2 + hh);
      ctx.lineTo(bx - s * 4, y2 + hh);
      ctx.stroke();
    }
    label(ctx, charge(ion.charge), x + half + 3, y2 - hh, { size: size * 0.6, bold: true, color: ion.charge > 0 ? COLORS.red : COLORS.blue });
  });
}

mount({
  slug: "lien-ket-hoa-hoc",
  version: "1.0.0",
  title: "Liên kết ion và liên kết cộng hóa trị",
  hint: "Chọn hai nguyên tố. Sim tính hiệu độ âm điện Δχ, xếp loại liên kết, vẽ sơ đồ Lewis và kiểm tra quy tắc octet.",
  initialState,
  controls: ["a", "b"].map((key, k) => ({
    type: "select",
    key,
    label: k ? "Nguyên tố thứ hai" : "Nguyên tố thứ nhất",
    options: SYMBOLS.map(el => ({ value: el, label: `${el} – ${ELEMENTS[el].name} (χ = ${chi(ELEMENTS[el].chi)})` })),
    onCommit: report,
  })).concat({ type: "checkbox", key: "showShells", label: "Hiện cấu hình electron theo lớp" }),
  readouts: [
    { label: "Hiệu độ âm điện Δχ", value: s => fmt(bondFor(s.a, s.b).deltaChi) },
    { label: "Loại liên kết", value: s => (bondFor(s.a, s.b).type ? TYPE_NAMES[bondFor(s.a, s.b).type].replace("Liên kết ", "") : "không xét") },
    { label: "Công thức", value: s => (bondFor(s.a, s.b).formula ? pretty(bondFor(s.a, s.b).formula.id) : "–") },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const small = w < 560 || h < 430;
    const pad = small ? 8 : 20;
    const fs = small ? 12 : 15;
    const bond = bondFor(s.a, s.b);
    const A = ELEMENTS[s.a];
    const B = ELEMENTS[s.b];
    let y = small ? 12 : 24;

    // the electronegativity difference
    const [hi, lo] = A.chi >= B.chi ? [A, B] : [B, A];
    label(ctx, `Δχ = |${chi(hi.chi)} − ${chi(lo.chi)}| = ${fmt(bond.deltaChi)}`, pad, y, { size: fs + 1, bold: true });
    if (!small) label(ctx, `χ(${s.a}) = ${chi(A.chi)}, χ(${s.b}) = ${chi(B.chi)}`, w - pad, y, { size: 13, align: "right", color: COLORS.muted });
    if (s.showShells) {
      y += small ? 15 : 22;
      const cfg = [...new Set([s.a, s.b])].map(el => `${el} (${shellText(el)})`).join(small ? "   " : "      ");
      label(ctx, `${small ? "Cấu hình" : "Cấu hình electron theo lớp"}: ${cfg}`, pad, y, { size: small ? 11 : 13, color: COLORS.purple });
      y += small ? 4 : 6;
    }
    y += small ? 14 : 22;

    // Δχ scale with the textbook thresholds
    const max = 3.3;
    const sw = w - 2 * pad;
    const sh = small ? 14 : 20;
    const X = v => pad + (Math.min(v, max) / max) * sw;
    const zones = [["nonpolar", 0, THRESHOLDS.polar], ["polar", THRESHOLDS.polar, THRESHOLDS.ionic], ["ionic", THRESHOLDS.ionic, max]];
    for (const [t, from, to] of zones) {
      ctx.fillStyle = ZONE_FILL[t];
      ctx.fillRect(X(from), y, X(to) - X(from), sh);
      const name = small ? { nonpolar: "", polar: "CHT phân cực", ionic: "ion" }[t] : { nonpolar: "", polar: "cộng hóa trị phân cực", ionic: "ion" }[t];
      const zc = (X(from) + X(to)) / 2;
      const markX = X(bond.deltaChi);
      // keep the zone name clear of the Δχ marker
      const tx = Math.abs(markX - zc) < 30 ? (markX + 50 < X(to) ? markX + 40 : markX - 40) : zc;
      label(ctx, name, tx, y + sh / 2, { size: small ? 10 : 12, align: "center", color: TYPE_COLOR[t] });
    }
    // the non-polar zone is too narrow for its name: write it under the bar, clear of the Δχ marker
    const npName = small ? "CHT không phân cực" : "cộng hóa trị không phân cực";
    const npW = textWidth(ctx, npName, small ? 9 : 11, false);
    const mk = X(bond.deltaChi);
    const npX = mk > pad + npW + 16 || mk < pad - 8 ? pad : mk + 10;
    label(ctx, npName, npX, y + sh + (small ? 9 : 11), { size: small ? 9 : 11, color: TYPE_COLOR.nonpolar });
    for (const v of [0, THRESHOLDS.polar, THRESHOLDS.ionic]) {
      ctx.fillStyle = COLORS.muted;
      ctx.fillRect(X(v) - 0.5, y - 3, 1, sh + 3);
      label(ctx, fmt(v), X(v), y - (small ? 7 : 9), { size: small ? 9 : 11, align: "center", color: COLORS.muted });
    }
    const mx = X(bond.deltaChi);
    ctx.fillStyle = bond.type ? TYPE_COLOR[bond.rule] : COLORS.muted;
    ctx.beginPath();
    ctx.moveTo(mx, y + sh + 1);
    ctx.lineTo(mx - 6, y + sh + 10);
    ctx.lineTo(mx + 6, y + sh + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(mx - 1, y, 2, sh);
    y += sh + (small ? 24 : 34);

    // verdict
    if (!bond.type) {
      label(ctx, "Cặp này không xét trong sim", pad, y, { size: fs + 1, bold: true, color: COLORS.muted });
      y += small ? 18 : 26;
      const words = REASONS[bond.reason].split(" ");
      let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (textWidth(ctx, next, fs, false) > w - 2 * pad && line) {
          label(ctx, line, pad, y, { size: fs, color: COLORS.ink });
          y += fs * 1.4;
          line = word;
        } else line = next;
      }
      label(ctx, line, pad, y, { size: fs, color: COLORS.ink });
      return;
    }
    label(ctx, TYPE_NAMES[bond.type], pad, y, { size: fs + 2, bold: true, color: TYPE_COLOR[bond.type] });
    const f = `${pretty(bond.formula.id)} – ${bond.compound.name}`;
    // formula beside the verdict when it fits, else on its own line
    if (textWidth(ctx, TYPE_NAMES[bond.type], fs + 2, true) + textWidth(ctx, f, fs + 1, true) + 16 > w - 2 * pad) y += small ? 17 : 24;
    label(ctx, f, w - pad, y, { size: fs + 1, bold: true, align: "right" });
    y += small ? 15 : 22;
    if (bond.exception) {
      label(ctx, small ? "Ngoại lệ: Δχ ≥ 1,7 nhưng H–F là liên kết cộng hóa trị." : "Ngoại lệ: Δχ = 1,78 ≥ 1,7 nhưng H–F vẫn là liên kết cộng hóa trị phân cực (ngưỡng Δχ chỉ là gần đúng).", pad, y, { size: small ? 11 : 13, color: COLORS.red });
      y += small ? 14 : 20;
    }

    // footnotes and the octet check, from the bottom up
    const footY = h - (small ? 8 : 14);
    label(ctx, small ? "Sơ đồ minh họa, không theo tỉ lệ." : "Sơ đồ Lewis minh họa, không theo tỉ lệ. Chấm xanh, đỏ: electron hóa trị của từng nguyên tử.", pad, footY, { size: small ? 10 : 12, color: COLORS.muted });
    const st = structure(bond);
    const checks = octet(st);
    const seen = new Set();
    const items = [];
    checks.forEach((o, i) => {
      const ion = st.kind === "ionic" ? st.ions[i] : null;
      const name = ion ? `${o.el}${supCharge(ion.charge)}` : o.el;
      if (seen.has(name)) return;
      seen.add(name);
      const E = ELEMENTS[o.el];
      items.push(`${name}: ${o.around}e ${o.ok ? "✓" : "✗"}${small ? "" : ` (giống ${E.noble})`}`);
    });
    const octY = footY - (small ? 15 : 22);
    label(ctx, `${small ? "Octet" : "Quy tắc octet (H: 2e)"}: ${items.join("   ")}`, pad, octY, { size: small ? 11 : 14, color: checks.every(o => o.ok) ? COLORS.green : COLORS.red, bold: true });
    let infoY = octY - (small ? 15 : 22);
    if (st.kind === "ionic") {
      const ions = [...new Map(st.ions.map(x => [x.el, x])).values()];
      const eq = ions.map(x => (x.charge > 0 ? `${x.el} → ${x.el}${supCharge(x.charge)} + ${x.given}e` : `${x.el} + ${x.given}e → ${x.el}${supCharge(x.charge)}`)).join(small ? ";  " : "        ");
      label(ctx, eq, pad, infoY, { size: small ? 11 : 14 });
    } else {
      const orders = [...new Set(st.bonds.map(b => b.order))];
      const pairs = st.bonds.reduce((sum, b) => sum + b.order, 0);
      const pairWord = orders.map(o => BOND_NAME[o]).join(", ");
      label(ctx, `${pairs} cặp electron dùng chung (${pairWord})`, pad, infoY, { size: small ? 11 : 14 });
    }

    // the diagram fills what is left
    const box = { x: pad, y, w: w - 2 * pad, h: infoY - (small ? 10 : 16) - y };
    const size = Math.max(14, Math.min(small ? 20 : 30, box.h / (st.kind === "ionic" ? 5.2 : st.atoms.length >= 4 ? 7.2 : 4.5), box.w / ((st.kind === "ionic" ? st.ions.length : 3) * 5)));
    if (st.kind === "ionic") drawIonic(ctx, bond, st, box, size, small);
    else drawCovalent(ctx, bond, st, box, size);
  },
});
