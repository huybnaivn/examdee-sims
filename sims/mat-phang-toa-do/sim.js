import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, RANGE, TREASURES, snap, quadrant, reflect, place, target, foundCount, grid, toScreen, fromScreen } from "./model.js";

const ROMAN = ["", "I", "II", "III", "IV"];
const pt = (x, y) => `(${fmt(x, 1)}; ${fmt(y, 1)})`;
const where = (x, y) => {
  const q = quadrant(x, y);
  if (q) return `thuộc góc phần tư thứ ${ROMAN[q]}`;
  if (x === 0 && y === 0) return "là gốc tọa độ O, không thuộc góc phần tư nào";
  return `nằm trên trục ${x === 0 ? "Oy" : "Ox"}, không thuộc góc phần tư nào`;
};

// One result per finished placement (drag released or slider let go); a goal for each treasure found.
function commit(s, api) {
  const t = place(s, s.x, s.y);
  api.emit("point-placed", { x: s.x, y: s.y, quadrant: quadrant(s.x, s.y) }, "result");
  if (t) api.emit("treasure-found", { x: t.x, y: t.y, found: s.found }, "goal");
}

const geom = view => {
  const small = view.w < 520 || view.h < 420;
  const top = small ? 26 : 34;
  return { small, top, ...grid(view, top) };
};

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function dashed(ctx, pts, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
}

function chest(ctx, x, y, r, name) {
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.stroke();
  label(ctx, name, x + r + 3, y - r - 3, { color: COLORS.red, bold: true, size: 13 });
}

mount({
  slug: "mat-phang-toa-do",
  version: "1.0.0",
  title: "Mặt phẳng tọa độ",
  hint: "Bấm hoặc kéo trên lưới để đặt điểm M; tọa độ làm tròn đến 0,5.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Chế độ",
      options: [
        { value: "explore", label: "Khám phá" },
        { value: "game", label: "Trò chơi: tìm kho báu" },
      ],
      onChange(s) {
        if (s.mode === "game") s.x = s.y = 0;
      },
    },
    { type: "slider", key: "x", label: "Hoành độ x", min: -RANGE, max: RANGE, step: 0.5, digits: 1, onCommit: commit },
    { type: "slider", key: "y", label: "Tung độ y", min: -RANGE, max: RANGE, step: 0.5, digits: 1, onCommit: commit },
    { type: "checkbox", key: "showCoords", label: "Hiện tọa độ", visible: s => s.mode === "explore" },
    { type: "checkbox", key: "showMirror", label: "Hiện điểm đối xứng qua Ox, Oy, O", visible: s => s.mode === "explore" },
    {
      type: "button",
      label: "Chơi lại",
      visible: s => s.mode === "game",
      action(s) {
        s.found = 0;
        s.x = s.y = 0;
      },
      event: "game-restarted",
    },
  ],
  readouts: [
    { label: "Điểm M", value: s => pt(s.x, s.y) },
    { label: "Góc phần tư", value: s => (quadrant(s.x, s.y) ? `thứ ${ROMAN[quadrant(s.x, s.y)]}` : "không thuộc góc nào") },
    { label: "Kho báu đã tìm", value: s => (s.mode === "game" ? `${foundCount(s)}/${TREASURES.length}` : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      const [x, y] = fromScreen(g, p.x, p.y);
      if (Math.abs(x) > RANGE + 0.5 || Math.abs(y) > RANGE + 0.5) return false;
      s.x = snap(x);
      s.y = snap(y);
    },
    move(p, s, api, view) {
      const [x, y] = fromScreen(geom(view), p.x, p.y);
      s.x = snap(x);
      s.y = snap(y);
    },
    up(p, s, api) {
      commit(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const P = (x, y) => toScreen(g, x, y);
    const game = s.mode === "game";
    const [x0, y0] = P(-RANGE, RANGE);
    const side = 2 * RANGE * g.ppu;

    // board: a sea map in game mode
    ctx.fillStyle = game ? "#e3f1fb" : "#fff";
    ctx.fillRect(x0, y0, side, side);
    // current quadrant, lightly tinted
    const q = quadrant(s.x, s.y);
    if (q && !game) {
      ctx.fillStyle = "rgba(47, 111, 237, 0.08)";
      const [ox, oy] = P(0, 0);
      ctx.fillRect(q === 1 || q === 4 ? ox : x0, q <= 2 ? y0 : oy, side / 2, side / 2);
    }
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -RANGE; k <= RANGE; k++) {
      const [a, b] = P(k, -RANGE);
      const [c, d] = P(k, RANGE);
      ctx.moveTo(a, b);
      ctx.lineTo(c, d);
      const [e, f] = P(-RANGE, k);
      const [h, i] = P(RANGE, k);
      ctx.moveTo(e, f);
      ctx.lineTo(h, i);
    }
    ctx.stroke();

    // axes with arrows and unit ticks
    const [ox, oy] = P(0, 0);
    const end = (RANGE + 0.5) * g.ppu;
    ctx.strokeStyle = ctx.fillStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox - end, oy);
    ctx.lineTo(ox + end, oy);
    ctx.moveTo(ox, oy + end);
    ctx.lineTo(ox, oy - end);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox + end + 2, oy);
    ctx.lineTo(ox + end - 7, oy - 4);
    ctx.lineTo(ox + end - 7, oy + 4);
    ctx.moveTo(ox, oy - end - 2);
    ctx.lineTo(ox - 4, oy - end + 7);
    ctx.lineTo(ox + 4, oy - end + 7);
    ctx.fill();
    const size = g.small ? 10 : 12;
    const every = g.ppu < 24 ? 2 : 1;
    // the coordinates of M are written on the axes in blue, so tick numbers next to them give way
    const read = s.showCoords && !game;
    for (let k = -RANGE; k <= RANGE; k++) {
      if (!k || k % every) continue;
      const [tx] = P(k, 0);
      const [, ty] = P(0, k);
      if (!(read && s.x && Math.abs(k - s.x) < 0.8)) label(ctx, fmt(k), tx, oy + size, { size, align: "center", color: COLORS.muted });
      if (!(read && s.y && Math.abs(k - s.y) < 0.8)) label(ctx, fmt(k), ox - 5, ty, { size, align: "right", color: COLORS.muted });
    }
    label(ctx, "O", ox - 5, oy + size, { size: size + 1, align: "right", bold: true });
    label(ctx, "x", ox + end - 2, oy - 12, { size: 14, bold: true, align: "right" });
    label(ctx, "y", ox + 10, oy - end + 4, { size: 14, bold: true });
    // quadrant names in the outer corners
    if (!game) {
      const c = RANGE - 0.6;
      [[c, c], [-c, c], [-c, -c], [c, -c]].forEach(([qx, qy], i) => {
        const [px, py] = P(qx, qy);
        label(ctx, `(${ROMAN[i + 1]})`, px, py, { size: g.small ? 12 : 15, align: "center", bold: true, color: q === i + 1 ? COLORS.blue : COLORS.muted });
      });
    }

    const [mx, my] = P(s.x, s.y);
    if (game) {
      TREASURES.slice(0, foundCount(s)).forEach(t => chest(ctx, ...P(t.x, t.y), g.small ? 5 : 7, t.name));
    } else if (s.showMirror) {
      // each image has its own label corner, so images that coincide (M on an axis) stay readable
      [["Ox", "M₁", COLORS.green, 1, 1], ["Oy", "M₂", COLORS.orange, -1, -1], ["O", "M₃", COLORS.purple, -1, 1]].forEach(([about, name, color, sx, sy]) => {
        const [rx, ry] = reflect(s.x, s.y, about);
        if (rx === s.x && ry === s.y) return; // M is its own image: nothing new to draw
        const [px, py] = P(rx, ry);
        dashed(ctx, [[mx, my], [px, py]], color);
        dot(ctx, px, py, 5, color);
        label(ctx, s.showCoords && !g.small ? `${name}${pt(rx, ry)}` : name, px + sx * 8, py + sy * 12, { color, bold: true, size: g.small ? 12 : 13, align: sx < 0 ? "right" : "left" });
      });
    }
    // perpendiculars from M to the axes: where the coordinates are read
    if (s.x || s.y) dashed(ctx, [[ox, my], [mx, my], [mx, oy]], COLORS.blue);
    if (read) {
      // on the side of the axis away from M, where the dashed line does not run
      if (s.x) label(ctx, fmt(s.x, 1), mx, oy + (s.y >= 0 ? size + 1 : -size - 1), { size: size + 2, bold: true, align: "center", color: COLORS.blue });
      if (s.y) label(ctx, fmt(s.y, 1), ox + (s.x < 0 ? 5 : -5), my, { size: size + 2, bold: true, align: s.x < 0 ? "left" : "right", color: COLORS.blue });
    }
    dot(ctx, mx, my, 7, COLORS.blue);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    label(ctx, "M", mx + 9, my - 11, { color: COLORS.blue, bold: true, size: 14 });

    // statement on top
    const t = target(s);
    let text;
    if (game) {
      text = t
        ? `Kho báu ${t.name} ở ${pt(t.x, t.y)}. Đưa M tới đó! (${foundCount(s)}/${TREASURES.length})`
        : `Đã tìm đủ ${TREASURES.length} kho báu! Bấm "Chơi lại" để chơi tiếp.`;
    } else {
      text = s.showCoords ? `M${pt(s.x, s.y)} ${where(s.x, s.y)}` : "Đọc tọa độ của điểm M (hoành độ trước, tung độ sau).";
    }
    label(ctx, text, view.w / 2, g.top / 2 + 1, { align: "center", bold: true, size: g.small ? 12 : 15, color: game ? COLORS.red : COLORS.ink });
  },
});
