import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { W, H, MAX_POINTS, NAMES, TYPES, initialState, parsePoints, parseObjects, distance, pointsOn, distinctLines, lineCount, collinearGroups, oppositeRays, circlePoints, addPoint, freeSpot, movePoint, addObject, undo, segment, settle } from "./model.js";

const FONT = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const TOOL_COLOR = { l: COLORS.blue, r: COLORS.green, s: COLORS.orange };
const lists = s => {
  const pts = parsePoints(s.points);
  return { pts, objs: parseObjects(s.objects, pts.length) };
};

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(view) {
  const small = view.w < 520 || view.h < 420;
  const top = small ? 6 : 16;
  const text = small ? 50 : 76; // room under the grid for the remarks
  const k = Math.min((view.w - (small ? 12 : 40)) / W, (view.h - top - text) / H);
  const x0 = (view.w - k * W) / 2;
  return { small, k, x0, y0: top, bottom: top + k * H, X: x => x0 + k * x, Y: y => top + k * (H - y), cm: p => [(p.x - x0) / k, H - (p.y - top) / k] };
}

// ---------- actions ----------
function drawObject(s, api, type, a, b) {
  if (!addObject(s, type, a, b)) return;
  api.emit("object-drawn", { type: TYPES[type], from: a, to: b, lines: distinctLines(parsePoints(s.points)) });
}
function placePoint(s, api, x, y) {
  if (!addPoint(s, x, y)) return;
  const pts = parsePoints(s.points);
  api.emit("object-drawn", { type: 0, from: pts.length - 1, to: pts.length - 1, lines: distinctLines(pts) });
}
// One result each time M is brought onto the midpoint.
function commitMid(s, api) {
  const was = s.found;
  if (!settle(s) || was) return;
  const g = segment(s);
  api.emit("midpoint-found", { length: g.length, half: g.length / 2, midX: g.mid[0], midY: g.mid[1] }, "result");
}
// `found` has no control, so a forged value is checked against the geometry.
const isMid = s => s.found === true && Math.abs(segment(s).am - segment(s).length / 2) < 1e-9;
const moved = s => {
  s.found = false;
};
const asked = s => {
  s._solved = null;
};

// ---------- drawing ----------
const stroke = (ctx, pts, color, width = 2, dash = []) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
};
const dot = (ctx, x, y, color, r = 5) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
};
/** Word-wrapped text; returns the y of the next row. */
function para(ctx, text, x, y, w, size, opt = {}) {
  ctx.font = FONT(size, opt.bold);
  let row = "";
  const rows = [];
  for (const word of text.split(" ")) {
    const next = row ? `${row} ${word}` : word;
    if (row && ctx.measureText(next).width > w) {
      rows.push(row);
      row = word;
    } else row = next;
  }
  rows.push(row);
  for (const r of rows) {
    label(ctx, r, x, y, { size, ...opt });
    y += size * 1.35;
  }
  return y;
}

/** A line ("l"), ray from a ("r") or segment ("s") through two points given in cm, clipped to the sheet. */
function figure(ctx, g, type, a, b, color, width = 2.5, dash = []) {
  const far = 40 / distance(a, b); // cm: well past the sheet
  const at = t => [g.X(a[0] + (b[0] - a[0]) * t), g.Y(a[1] + (b[1] - a[1]) * t)];
  ctx.save();
  ctx.beginPath();
  ctx.rect(g.X(0) - g.k * 0.3, g.Y(H) - 4, g.k * (W + 0.6), g.k * H + 8);
  ctx.clip();
  stroke(ctx, [at(type === "l" ? -far : 0), at(type === "s" ? 1 : far)], color, width, dash);
  ctx.restore();
}

function sheet(ctx, g) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(g.X(0), g.Y(H), g.k * W, g.k * H);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x++) {
    ctx.moveTo(g.X(x), g.Y(0));
    ctx.lineTo(g.X(x), g.Y(H));
  }
  for (let y = 0; y <= H; y++) {
    ctx.moveTo(g.X(0), g.Y(y));
    ctx.lineTo(g.X(W), g.Y(y));
  }
  ctx.stroke();
  // scale: one square is 1 cm
  const y = g.Y(0) - 6;
  stroke(ctx, [[g.X(W - 1), y - 4], [g.X(W - 1), y], [g.X(W), y], [g.X(W), y - 4]], COLORS.muted, 1.5);
  label(ctx, "1 cm", g.X(W - 0.5), y - 9, { size: g.small ? 10 : 12, color: COLORS.muted, align: "center" });
}

/** A named point. `busy` lists the screen angles (rad) of what passes through it; the name goes to the freest diagonal. */
const named = (ctx, g, p, name, color = COLORS.ink, r = 5, busy = []) => {
  const gap = t => Math.min(...busy.map(b => Math.abs(Math.atan2(Math.sin(t - b), Math.cos(t - b)))), 9);
  const t = [-1, -3, 1, 3].map(q => (q * Math.PI) / 4).reduce((best, q) => (gap(q) > gap(best) + 1e-9 ? q : best));
  dot(ctx, g.X(p[0]), g.Y(p[1]), color, r);
  label(ctx, name, g.X(p[0]) + 15 * Math.cos(t), g.Y(p[1]) + 15 * Math.sin(t), { size: g.small ? 13 : 16, bold: true, color, align: "center" });
};

function drawDraw(ctx, s, g) {
  const { pts, objs } = lists(s);
  const size = g.small ? 11 : 14;
  sheet(ctx, g);
  const groups = collinearGroups(pts);
  for (const group of groups) figure(ctx, g, "l", pts[group[0]], pts[group[1]], COLORS.purple, 1.2, [5, 5]);
  for (const o of objs) {
    const [a, b] = [pts[o.a], pts[o.b]];
    figure(ctx, g, o.type, a, b, TOOL_COLOR[o.type]);
    if (o.type === "s") {
      // length beside the middle of the segment
      const d = distance(a, b);
      const text = `${fmt(d, 2)} cm`;
      ctx.font = FONT(size, true);
      const nx = -(b[1] - a[1]) / d; // unit normal on screen
      const ny = -(b[0] - a[0]) / d;
      const off = 11 + (Math.abs(nx) * ctx.measureText(text).width) / 2;
      label(ctx, text, g.X((a[0] + b[0]) / 2) + nx * off, g.Y((a[1] + b[1]) / 2) + ny * off, { size, bold: true, color: COLORS.orange, align: "center" });
    }
  }
  pts.forEach((p, i) => {
    if (s._sel === i) {
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.X(p[0]), g.Y(p[1]), 10, 0, 2 * Math.PI);
      ctx.stroke();
    }
    // screen directions of everything through this point, so its name avoids them
    const busy = [];
    const toward = q => Math.atan2(-(q[1] - p[1]), q[0] - p[0]);
    for (const o of objs) {
      if (o.a !== i && o.b !== i) continue;
      const t = toward(pts[o.a === i ? o.b : o.a]);
      busy.push(t);
      if (o.type === "l" || (o.type === "r" && o.b === i)) busy.push(t + Math.PI);
    }
    for (const o of objs) if (o.a !== i && o.b !== i && pointsOn(pts, o).includes(i)) busy.push(toward(pts[o.a]), toward(pts[o.a]) + Math.PI);
    for (const group of groups) if (group.includes(i)) busy.push(...group.filter(j => j !== i).map(j => toward(pts[j])));
    named(ctx, g, p, NAMES[i], COLORS.ink, 5, busy);
  });

  const x = g.X(0);
  const w = g.k * W;
  let y = g.bottom + size;
  const names = list => list.map(i => NAMES[i]).join(", ");
  if (s._sel != null && pts[s._sel]) y = para(ctx, `Đã chọn điểm ${NAMES[s._sel]}${s.tool === "r" ? " làm gốc của tia" : ""}. Bấm vào điểm thứ hai.`, x, y, w, size, { color: COLORS.red });
  if (groups.length) y = para(ctx, groups.map(gr => `${gr.length === 3 ? "Ba" : "Các"} điểm ${names(gr)} thẳng hàng.`).join(" "), x, y, w, size, { color: COLORS.purple, bold: true });
  else if (pts.length >= 3) y = para(ctx, "Không có ba điểm nào thẳng hàng.", x, y, w, size, { color: COLORS.muted });
  for (const [i, j] of oppositeRays(pts, objs)) {
    y = para(ctx, `Tia ${NAMES[objs[i].a]}${NAMES[objs[i].b]} và tia ${NAMES[objs[j].a]}${NAMES[objs[j].b]} là hai tia đối nhau.`, x, y, w, size, { color: COLORS.green, bold: true });
  }
  if (!g.small) {
    // legend
    let lx = x;
    for (const [type, text] of [["l", "đường thẳng"], ["r", "tia"], ["s", "đoạn thẳng"]]) {
      stroke(ctx, [[lx, y + 2], [lx + 22, y + 2]], TOOL_COLOR[type], 3);
      label(ctx, text, lx + 28, y + 2, { size: 12, color: COLORS.muted });
      ctx.font = FONT(12);
      lx += 46 + ctx.measureText(text).width;
    }
  }
}

function drawCount(ctx, s, g) {
  const pts = circlePoints(s.n);
  const size = g.small ? 11 : 14;
  if (s.showLines) for (let i = 0; i < s.n; i++) for (let j = i + 1; j < s.n; j++) figure(ctx, g, "l", pts[i], pts[j], COLORS.blue, 1.6);
  pts.forEach((p, i) => named(ctx, g, p, NAMES[i]));
  const x = g.X(0);
  const w = g.k * W;
  let y = g.bottom + size;
  y = para(ctx, `Cho ${s.n} điểm, trong đó không có ba điểm nào thẳng hàng. Vẽ được bao nhiêu đường thẳng đi qua hai trong các điểm đó?`, x, y, w, size, { bold: true });
  if (s._solved === true) para(ctx, `Đúng: ${s.n}·${s.n - 1}/2 = ${lineCount(s.n)} đường thẳng, theo công thức n(n − 1)/2.`, x, y, w, size, { color: COLORS.green, bold: true });
  else if (s._solved === false) para(ctx, `Chưa đúng. Mỗi điểm nối với ${s.n - 1} điểm còn lại, nhưng mỗi đường thẳng đã được tính hai lần.`, x, y, w, size, { color: COLORS.red });
}

function drawMid(ctx, s, g) {
  const sg = segment(s);
  const found = isMid(s);
  const size = g.small ? 11 : 14;
  sheet(ctx, g);
  const P = p => [g.X(p[0]), g.Y(p[1])];
  const [a, b, m] = [P(sg.a), P(sg.b), P(sg.m)];
  const u = [(b[0] - a[0]) / (sg.length * g.k), (b[1] - a[1]) / (sg.length * g.k)]; // unit vector along AB, px
  const n = [-u[1], u[0]];
  const side = n[1] > 0 ? 1 : -1; // the ruler goes below the segment, the lengths above
  // ruler: a tick every centimetre from A
  const off = 16 * side;
  const R = t => [a[0] + u[0] * t * g.k + n[0] * off, a[1] + u[1] * t * g.k + n[1] * off];
  stroke(ctx, [R(0), R(sg.length)], COLORS.muted, 1);
  for (let i = 0; i <= Math.floor(sg.length + 1e-9); i++) {
    const [x, y] = R(i);
    stroke(ctx, [[x, y], [x + n[0] * 5 * side, y + n[1] * 5 * side]], COLORS.muted, 1);
    if (g.k >= 26 || i % 2 === 0) label(ctx, String(i), x + n[0] * 14 * side, y + n[1] * 14 * side, { size: g.small ? 9 : 11, color: COLORS.muted, align: "center" });
  }
  stroke(ctx, [a, m], COLORS.blue, 3.5);
  stroke(ctx, [m, b], COLORS.orange, 3.5);
  const above = (p, q, text, color) => label(ctx, text, (p[0] + q[0]) / 2 - n[0] * 14 * side, (p[1] + q[1]) / 2 - n[1] * 14 * side, { size, bold: true, color, align: "center" });
  if (sg.am > 0.9) above(a, m, `${fmt(sg.am, 2)} cm`, COLORS.blue);
  if (sg.mb > 0.9) above(m, b, `${fmt(sg.mb, 2)} cm`, COLORS.orange);
  if (found) {
    // equal marks on the two halves
    for (const [p, q] of [[a, m], [m, b]]) {
      const c = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      stroke(ctx, [[c[0] - n[0] * 6, c[1] - n[1] * 6], [c[0] + n[0] * 6, c[1] + n[1] * 6]], COLORS.ink, 2);
    }
  }
  const ab = [Math.atan2(u[1], u[0]), Math.atan2(-u[1], -u[0]), Math.atan2(n[1] * side, n[0] * side)]; // the segment and the ruler
  named(ctx, g, sg.a, "A", COLORS.ink, 5, ab);
  named(ctx, g, sg.b, "B", COLORS.ink, 5, ab);
  named(ctx, g, sg.m, "M", found ? COLORS.green : COLORS.red, 7, ab);

  const x = g.X(0);
  const w = g.k * W;
  let y = g.bottom + size;
  y = para(ctx, `AB = ${fmt(sg.length, 2)} cm;  AM = ${fmt(sg.am, 2)} cm;  MB = ${fmt(sg.mb, 2)} cm.  AM + MB = AB.`, x, y, w, size, { bold: true });
  if (found) para(ctx, `M là trung điểm của AB: M nằm giữa A, B và MA = MB = AB/2 = ${fmt(sg.length / 2, 2)} cm.`, x, y, w, size, { color: COLORS.green, bold: true });
  else para(ctx, "Kéo M (hoặc thanh trượt AM) đến vị trí có MA = MB để tìm trung điểm của AB.", x, y, w, size, { color: COLORS.muted });
}

const draws = { draw: drawDraw, count: drawCount, midpoint: drawMid };
const inMode = mode => s => s.mode === mode;
const lineTool = s => s.mode === "draw" && s.tool !== "point";
const pointOptions = [...NAMES].map((name, value) => ({ value, label: name }));
const cell = (key, label_, max) => ({ type: "stepper", key, label: label_, min: 0, max, visible: inMode("midpoint"), onChange: moved, onCommit: commitMid });

mount({
  slug: "diem-duong-thang-doan-thang",
  version: "1.0.0",
  title: "Điểm, đường thẳng, tia và đoạn thẳng",
  hint: "Bấm vào nút lưới để đặt điểm, kéo điểm để di chuyển. Chọn công cụ rồi bấm lần lượt hai điểm để vẽ đường thẳng, tia hoặc đoạn thẳng.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Hoạt động",
      options: [
        { value: "draw", label: "Vẽ điểm, đường thẳng, tia, đoạn thẳng" },
        { value: "count", label: "Đếm đường thẳng qua n điểm" },
        { value: "midpoint", label: "Đo đoạn thẳng, tìm trung điểm" },
      ],
      onChange(s) {
        s._sel = null;
        s._solved = null;
      },
    },
    // ----- draw -----
    {
      type: "select",
      key: "tool",
      label: "Công cụ",
      visible: inMode("draw"),
      options: [
        { value: "point", label: "Điểm" },
        { value: "l", label: "Đường thẳng" },
        { value: "r", label: "Tia" },
        { value: "s", label: "Đoạn thẳng" },
      ],
      onChange(s) {
        s._sel = null;
      },
    },
    {
      type: "button",
      label: "Thêm một điểm",
      visible: s => s.mode === "draw" && s.tool === "point",
      disabled: s => parsePoints(s.points).length >= MAX_POINTS || !freeSpot(s),
      action(s, api) {
        const spot = freeSpot(s);
        if (spot) placePoint(s, api, ...spot);
      },
    },
    { type: "select", key: "from", label: "Điểm thứ nhất (gốc của tia)", options: pointOptions, visible: lineTool },
    { type: "select", key: "to", label: "Điểm thứ hai", options: pointOptions, visible: lineTool },
    { type: "button", label: "Vẽ qua hai điểm đã chọn", primary: true, visible: lineTool, action: (s, api) => drawObject(s, api, s.tool, s.from, s.to) },
    {
      type: "button",
      label: "Xóa hình vẽ sau cùng",
      visible: inMode("draw"),
      disabled: s => !s.points,
      action(s) {
        s._sel = null;
        undo(s);
      },
      event: "undo",
    },
    // ----- count -----
    { type: "stepper", key: "n", label: "Số điểm n", min: 2, max: MAX_POINTS, visible: inMode("count"), onChange: asked },
    { type: "checkbox", key: "showLines", label: "Vẽ các đường thẳng", visible: inMode("count") },
    { type: "slider", key: "answer", label: "Số đường thẳng em đếm được", min: 0, max: 30, step: 1, digits: 0, visible: inMode("count"), onChange: asked },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: inMode("count"),
      action(s, api) {
        const right = s.answer === lineCount(s.n);
        const first = right && s._solved !== true;
        s._solved = right;
        api.emit("answer-checked", { n: s.n, answer: s.answer, correct: right ? 1 : 0 });
        if (first) api.emit("count-correct", { n: s.n, lines: s.answer }, "goal");
      },
    },
    // ----- midpoint -----
    { type: "slider", key: "am", label: "Độ dài AM", min: 0, max: 15, step: 0.1, unit: "cm", visible: inMode("midpoint"), format: (v, s) => `${fmt(segment(s).am, 2)} cm`, onChange: moved, onCommit: commitMid },
    cell("ax", "Điểm A: cột", W),
    cell("ay", "Điểm A: hàng", H),
    cell("bx", "Điểm B: cột", W),
    cell("by", "Điểm B: hàng", H),
  ],
  readouts: [
    { label: "Số điểm", value: s => (s.mode === "draw" ? String(parsePoints(s.points).length) : s.mode === "count" ? String(s.n) : "–") },
    {
      label: "Số đường thẳng phân biệt qua các điểm",
      value: s => (s.mode === "draw" ? String(distinctLines(parsePoints(s.points))) : s.mode === "count" ? (s.showLines || s._solved === true ? String(lineCount(s.n)) : "?") : "–"),
    },
    { label: "Độ dài AB", value: s => (s.mode === "midpoint" ? `${fmt(segment(s).length, 2)} cm` : "–") },
    { label: "Trung điểm của AB", value: s => (s.mode !== "midpoint" ? "–" : isMid(s) ? "M (MA = MB)" : "chưa tìm được") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      const near = (q, r) => Math.hypot(g.X(q[0]) - p.x, g.Y(q[1]) - p.y) < r;
      if (s.mode === "count") return false;
      if (s.mode === "midpoint") {
        const sg = segment(s);
        s._drag = near(sg.m, 24) ? "m" : near(sg.a, 22) ? "a" : near(sg.b, 22) ? "b" : null;
        return s._drag !== null;
      }
      const { pts } = lists(s);
      const hit = pts.findIndex(q => near(q, Math.max(14, g.k * 0.45)));
      if (s.tool === "point") {
        if (hit >= 0) {
          s._drag = hit;
          s._moved = false;
          return true;
        }
        const c = g.cm(p);
        placePoint(s, api, Math.round(c[0]), Math.round(c[1]));
      } else if (hit < 0 || s._sel == null || s._sel === hit) {
        s._sel = hit < 0 ? null : hit;
      } else {
        drawObject(s, api, s.tool, s._sel, hit);
        s._sel = null;
      }
      api.sync();
      return false;
    },
    move(p, s, api, view) {
      const c = geom(view).cm(p);
      if (s.mode === "draw") {
        if (movePoint(s, s._drag, Math.round(c[0]), Math.round(c[1]))) s._moved = true;
        return;
      }
      const sg = segment(s);
      if (s._drag === "m") {
        s.am = clamp(((c[0] - sg.a[0]) * (sg.b[0] - sg.a[0]) + (c[1] - sg.a[1]) * (sg.b[1] - sg.a[1])) / sg.length, 0, sg.length);
      } else {
        const [x, y] = [clamp(Math.round(c[0]), 0, W), clamp(Math.round(c[1]), 0, H)];
        const other = s._drag === "a" ? sg.b : sg.a;
        if (x === other[0] && y === other[1]) return; // A and B stay two different points
        if (s._drag === "a") [s.ax, s.ay] = [x, y];
        else [s.bx, s.by] = [x, y];
      }
      s.found = false;
    },
    up(p, s, api) {
      if (s.mode === "draw") {
        const q = parsePoints(s.points)[s._drag];
        if (s._moved && q) api.emit("point-moved", { point: s._drag, x: q[0], y: q[1] });
      } else {
        commitMid(s, api);
        const sg = segment(s);
        api.emit("segment-adjusted", { length: sg.length, am: sg.am });
      }
      s._drag = null;
      s._moved = false;
    },
  },
  draw(ctx, s, view) {
    (draws[s.mode] ?? drawDraw)(ctx, s, geom(view));
  },
});
