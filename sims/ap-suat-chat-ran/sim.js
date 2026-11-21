import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { FACES, SUPPORTS, MASS, initialState, solve, options, currentKey, maxPressureKey } from "./model.js";

const SHORT = { large: "Mặt lớn", medium: "Mặt vừa", small: "Mặt nhỏ", feet: "Bàn chân", skis: "Ván trượt", nail: "Mũi đinh" };
const SAND = "#e9d3a0";
const SAND_DARK = "#c9a96a";
const fmtP = p => fmt(p, p < 100 ? 1 : 0);
const fmtArea = m2 => fmt(m2, m2 < 1e-3 ? 6 : 4);

const report = (s, api) => {
  const r = solve(s);
  api.emit("pressure-measured", { force: r.force, area: r.area, pressure: r.pressure, depth: r.depth }, "result");
};
// The face or support was chosen: report it, and note when it is the one with the largest pressure.
const commitChoice = (s, api) => {
  report(s, api);
  if (currentKey(s) === maxPressureKey(s)) {
    const r = solve(s);
    api.emit("max-pressure-found", { pressure: r.pressure, area: r.area }, "goal");
  }
};

function geom(view) {
  const small = view.w < 560 || view.h < 400;
  const head = small ? 42 : 66;
  const rowH = small ? 18 : 24;
  let table = null;
  if (view.w >= 640) table = { side: true, x: view.w - 250, y: head + 6, w: 238, rowH };
  else if (view.h - head - 4 * rowH - 16 >= 150) table = { side: false, x: 8, y: view.h - 4 * rowH - 8, w: view.w - 16, rowH };
  const x0 = 10;
  const x1 = table?.side ? table.x - 14 : view.w - 10;
  const y0 = head;
  const y1 = table && !table.side ? table.y - 10 : view.h - 6;
  return { small, table, x0, x1, y0, y1, ground: y0 + (y1 - y0) * 0.66 };
}

// Sand block with a dent (cross-section): painted after the object, leaving the notch open.
function drawSand(ctx, g, nx, nw, dent) {
  const { x0, x1, ground, y1 } = g;
  ctx.fillStyle = SAND;
  ctx.beginPath();
  ctx.moveTo(x0, ground);
  ctx.lineTo(nx, ground);
  ctx.lineTo(nx, ground + dent);
  ctx.lineTo(nx + nw, ground + dent);
  ctx.lineTo(nx + nw, ground);
  ctx.lineTo(x1, ground);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x0, y1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = SAND_DARK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = SAND_DARK;
  for (let i = 0; i < 60; i++) {
    const x = x0 + ((i * 97) % 1000) / 1000 * (x1 - x0);
    const y = ground + 8 + ((i * 61) % 1000) / 1000 * (y1 - ground - 12);
    if (y > ground + dent + 3 || x < nx - 3 || x > nx + nw + 3) ctx.fillRect(x, y, 2, 2);
  }
}

function dentMark(ctx, g, x, dent, depthCm, small) {
  if (dent < 3) return;
  ctx.strokeStyle = COLORS.purple;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, g.ground);
  ctx.lineTo(x + 10, g.ground);
  ctx.moveTo(x + 5, g.ground);
  ctx.lineTo(x + 5, g.ground + dent);
  ctx.moveTo(x, g.ground + dent);
  ctx.lineTo(x + 10, g.ground + dent);
  ctx.stroke();
  label(ctx, `lún ${fmt(depthCm, 1)} cm`, x + 14, g.ground + Math.max(dent / 2, 8), { size: small ? 11 : 13, color: COLORS.purple, bold: true });
}

function forceArrow(ctx, x, y, r, s, small) {
  const [lo, hi] = MASS[s.object];
  const len = (small ? 16 : 30) + ((r.mass - lo) / (hi - lo)) * (small ? 16 : 36);
  arrow(ctx, x, y, x, y + len, COLORS.red, 3);
  label(ctx, `F = ${fmt(r.force, 0)} N`, x + 8, y + len - 4, { size: small ? 12 : 14, color: COLORS.red, bold: true });
}

function drawBrick(ctx, s, g, r) {
  const f = FACES[s.face];
  const k = Math.min((g.x1 - g.x0) / 32, (g.ground - g.y0 - 28) / 25.5); // px per cm, same for every face
  const dent = r.depth * k; // brick and dent share the same scale
  const w = f.w * k;
  const h = f.h * k;
  const o = f.d * k * 0.35; // oblique offset of the depth edge
  const cx = (g.x0 + g.x1) / 2 - o / 2;
  const bx = cx - w / 2;
  const base = g.ground + dent;
  // box: front, top, right side
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#7a3b22";
  const face = (pts, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  face([[bx, base], [bx + w, base], [bx + w, base - h], [bx, base - h]], "#c8613a");
  face([[bx, base - h], [bx + w, base - h], [bx + w + o, base - h - o], [bx + o, base - h - o]], "#de8a63");
  face([[bx + w, base], [bx + w + o, base - o], [bx + w + o, base - h - o], [bx + w, base - h]], "#a94e2d");
  drawSand(ctx, g, bx, w, dent);
  // contact face
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bx, base);
  ctx.lineTo(bx + w, base);
  ctx.stroke();
  label(ctx, `S = ${fmt(f.w, 0)} cm × ${fmt(f.d, 0)} cm`, bx + w / 2, base - h - o - 12, { align: "center", size: g.small ? 12 : 14, bold: true });
  forceArrow(ctx, bx + w * 0.35, base, r, s, g.small);
  dentMark(ctx, g, bx + w + o + 4, dent, r.depth, g.small);
  label(ctx, "Viên gạch và độ lún vẽ cùng tỉ lệ.", g.x1 - 6, g.y1 - 9, { size: 11, color: "#6b5430", align: "right" });
}

function drawPerson(ctx, s, g, r) {
  const kp = Math.min((g.ground - g.y0 - 10) / 190, (g.x1 - g.x0 - 30) / 175); // px per cm for the body
  const kd = Math.max(kp, g.small ? 3 : 4); // dents are drawn enlarged
  const dent = r.depth * kd;
  const cx = (g.x0 + g.x1) / 2 - 20;
  let nw;
  let feetY; // where the soles are
  if (s.support === "skis") nw = 160 * kp;
  else if (s.support === "feet") nw = 28 * kp;
  else nw = 3;
  const base = g.ground + dent;
  ctx.lineCap = "round";
  if (s.support === "skis") {
    ctx.fillStyle = COLORS.blue;
    ctx.fillRect(cx - nw / 2, base - 4, nw, 4);
    ctx.fillRect(cx + nw / 2 - 4, base - 9, 6, 6);
    feetY = base - 4;
  } else if (s.support === "nail") {
    const nailLen = 8 * kd;
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.lineTo(cx, base - nailLen);
    ctx.stroke();
    ctx.fillStyle = "#8a6a3b";
    ctx.fillRect(cx - 40 * kp - 6, base - nailLen - 6, 80 * kp + 12, 6);
    feetY = base - nailLen - 6;
  } else feetY = base;
  // stick figure, soles at feetY
  const H = 170 * kp;
  const top = feetY - H;
  const headR = 11 * kp;
  ctx.strokeStyle = COLORS.ink;
  ctx.fillStyle = COLORS.ink;
  ctx.lineWidth = Math.max(2, 5 * kp);
  ctx.beginPath();
  ctx.arc(cx, top + headR, headR, 0, Math.PI * 2);
  ctx.fill();
  const neck = top + 2 * headR;
  const hip = feetY - 85 * kp;
  ctx.beginPath();
  ctx.moveTo(cx, neck);
  ctx.lineTo(cx, hip);
  ctx.moveTo(cx, neck + 10 * kp);
  ctx.lineTo(cx - 22 * kp, neck + 60 * kp);
  ctx.moveTo(cx, neck + 10 * kp);
  ctx.lineTo(cx + 22 * kp, neck + 60 * kp);
  ctx.moveTo(cx, hip);
  ctx.lineTo(cx - 9 * kp, feetY - 4 * kp);
  ctx.moveTo(cx, hip);
  ctx.lineTo(cx + 9 * kp, feetY - 4 * kp);
  ctx.stroke();
  if (s.support !== "skis") {
    ctx.fillStyle = "#333";
    ctx.fillRect(cx - 14 * kp, feetY - 4 * kp, 28 * kp, 4 * kp);
  }
  drawSand(ctx, g, cx - nw / 2, nw, dent);
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - nw / 2, base);
  ctx.lineTo(cx + nw / 2, base);
  ctx.stroke();
  forceArrow(ctx, cx, base + (s.support === "nail" ? 2 : 0), r, s, g.small);
  dentMark(ctx, g, Math.max(cx + nw / 2, cx + 30 * kp) + 6, dent, r.depth, g.small);
  label(ctx, g.small ? "Không theo tỉ lệ (độ lún vẽ phóng to)" : "Không theo tỉ lệ: người vẽ thu nhỏ, độ lún vẽ phóng to.", g.x1 - 6, g.y1 - 9, { size: 11, color: "#6b5430", align: "right" });
}

function drawTable(ctx, s, g) {
  const t = g.table;
  if (!t) return;
  const size = g.small ? 12 : 13;
  const rows = options(s).map(o => ({ o, r: solve(s, o.key) }));
  const cols = [0.4, 0.58, 1].map(f => t.x + t.w * f - 8);
  ctx.fillStyle = "#fff";
  ctx.fillRect(t.x, t.y, t.w, t.rowH * 4);
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(t.x, t.y, t.w, t.rowH);
  ctx.strokeStyle = COLORS.grid;
  ctx.strokeRect(t.x, t.y, t.w, t.rowH * 4);
  const cy = i => t.y + t.rowH * (i + 0.5);
  label(ctx, s.object === "person" ? "Đứng trên" : "Cách đặt", t.x + 8, cy(0), { size, color: COLORS.muted });
  label(ctx, "S (cm²)", cols[1], cy(0), { size, color: COLORS.muted, align: "right" });
  label(ctx, "p (Pa)", cols[2], cy(0), { size, color: COLORS.muted, align: "right" });
  rows.forEach(({ o, r }, i) => {
    const on = o.key === currentKey(s);
    const style = { size, bold: on, color: on ? COLORS.blue : COLORS.ink };
    label(ctx, SHORT[o.key], t.x + 8, cy(i + 1), style);
    label(ctx, fmt(o.areaCm2, 2), cols[1], cy(i + 1), { ...style, align: "right" });
    label(ctx, fmtP(r.pressure), cols[2], cy(i + 1), { ...style, align: "right" });
  });
  if (t.side) {
    const note = ["Cùng áp lực F:", "S nhỏ đi bao nhiêu lần", "thì p lớn lên bấy nhiêu lần."];
    note.forEach((line, i) => label(ctx, line, t.x + 4, t.y + t.rowH * 4 + 20 + i * 18, { size: 13, color: COLORS.muted }));
  }
}

mount({
  slug: "ap-suat-chat-ran",
  version: "1.0.0",
  title: "Áp suất trên bề mặt",
  hint: "Đặt viên gạch lên cát bằng từng mặt, hoặc cho người đứng trên cát theo nhiều cách. Mặt nào làm áp suất lớn nhất?",
  initialState,
  controls: [
    {
      type: "select",
      key: "object",
      label: "Vật đặt trên cát",
      options: [
        { value: "brick", label: "Viên gạch" },
        { value: "person", label: "Người" },
      ],
      onCommit: report,
    },
    {
      type: "select",
      key: "face",
      label: "Mặt tiếp xúc với cát",
      options: Object.entries(FACES).map(([value, f]) => ({ value, label: f.label })),
      visible: s => s.object === "brick",
      onCommit: commitChoice,
    },
    {
      type: "select",
      key: "support",
      label: "Người đứng trên",
      options: Object.entries(SUPPORTS).map(([value, o]) => ({ value, label: o.label })),
      visible: s => s.object === "person",
      onCommit: commitChoice,
    },
    { type: "slider", key: "brickMass", label: "Khối lượng viên gạch", min: MASS.brick[0], max: MASS.brick[1], step: 0.5, unit: "kg", digits: 1, visible: s => s.object === "brick", onCommit: report },
    { type: "slider", key: "personMass", label: "Khối lượng người", min: MASS.person[0], max: MASS.person[1], step: 1, unit: "kg", digits: 0, visible: s => s.object === "person", onCommit: report },
  ],
  readouts: [
    { label: "Áp lực F = 10·m", value: s => `${fmt(solve(s).force, 0)} N` },
    { label: "Diện tích S", value: s => `${fmt(solve(s).areaCm2, 2)} cm² = ${fmtArea(solve(s).area)} m²` },
    { label: "Áp suất p = F/S", value: s => `${fmtP(solve(s).pressure)} Pa` },
    { label: "Độ lún của cát", value: s => `${fmt(solve(s).depth, 2)} cm` },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    const r = solve(s);
    const formula = `p = F/S = ${fmt(r.force, 0)} N : ${fmtArea(r.area)} m² = ${fmtP(r.pressure)} Pa`;
    label(ctx, formula, view.w / 2, g.small ? 14 : 22, { align: "center", size: g.small ? 13 : 17, bold: true });
    label(ctx, `1 Pa = 1 N/m²   ·   1 m² = ${fmt(10000)} cm²`, view.w / 2, g.small ? 31 : 48, { align: "center", size: g.small ? 11 : 13, color: COLORS.muted });
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x0, g.y0 - 4, g.x1 - g.x0, g.y1 - g.y0 + 4);
    ctx.clip();
    if (s.object === "person") drawPerson(ctx, s, g, r);
    else drawBrick(ctx, s, g, r);
    ctx.restore();
    drawTable(ctx, s, g);
  },
});

