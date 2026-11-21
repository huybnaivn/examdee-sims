import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { N, AXES, initialState, sanitize, reflect, drawSide, activeAxis, mirrorCells, full, count, isSymmetric, toggle, SHAPES, shapeOf, centre, axesOf, axisCount, hasCentre, ANSWERS, isCorrect } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ANIM_MS = 700;
const grid = s => s.mode !== "count";

function fit(ctx, text, x, y, size, maxW, opts = {}) {
  ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, align: "center", size: w > maxW ? Math.max(8, (size * maxW) / w) : size });
}

/** Where the grid sits on the canvas; shared by draw() and the pointer. */
function layout(view) {
  const small = view.w < 520 || view.h < 440;
  const top = small ? 44 : 72;
  const bottom = small ? 8 : 20;
  const cell = Math.floor(Math.min((view.w - 16) / N, (view.h - top - bottom) / N));
  const size = cell * N;
  return { small, top, cell, x0: Math.round((view.w - size) / 2), y0: Math.round(top + (view.h - top - bottom - size) / 2), size };
}
const cellAt = (p, view) => {
  const g = layout(view);
  const c = Math.floor((p.x - g.x0) / g.cell);
  const r = Math.floor((p.y - g.y0) / g.cell);
  return r >= 0 && r < N && c >= 0 && c < N ? [r, c] : null;
};

function animate(s, api) {
  const anim = { start: performance.now() };
  s._anim = anim;
  const tick = () => {
    api.redraw();
    if (performance.now() - anim.start < ANIM_MS) requestAnimationFrame(tick);
    else if (s._anim === anim) s._anim = null;
  };
  requestAnimationFrame(tick);
}

function showMirror(s, api) {
  s.mirror = true;
  const axis = activeAxis(s);
  api.emit("reflected", { cells: count(s.cells), total: count(full(s.cells, axis)), axis: AXES[axis] }, "result");
  animate(s, api);
}

/** "trục dọc, tâm O" — what a set of cells is symmetric about. */
function about(cells) {
  const names = [["vertical", "trục dọc"], ["horizontal", "trục ngang"], ["diagonal", "trục chéo"], ["center", "tâm O"]];
  const yes = names.filter(([a]) => isSymmetric(cells, a)).map(([, n]) => n);
  return count(cells) === 0 ? "–" : yes.length ? yes.join(", ") : "không đối xứng";
}

const answerText = a => (a === -1 ? "Vô số" : String(a));
function answerPad(box, api) {
  box.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:8px";
  const buttons = ANSWERS.map(a => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = answerText(a);
    b.style.cssText = `min-height:56px;font-size:${a === -1 ? 17 : 22}px;font-weight:600;padding:0`;
    b.addEventListener("click", () => {
      const s = api.state;
      const sh = shapeOf(s.shape);
      const index = SHAPES.indexOf(sh);
      if (s._solved || s._tried.includes(a)) return;
      if (isCorrect(sh, a)) {
        s._solved = true;
        api.emit("correct-axis-count", { shape: index, axes: a, wrongTries: s._tried.length }, "goal");
        animate(s, api);
      } else {
        s._tried.push(a);
        api.emit("wrong-axis-count", { shape: index, answer: a }, "action");
      }
      api.sync();
    });
    box.append(b);
    return b;
  });
  return () => {
    const s = api.state;
    ANSWERS.forEach((a, i) => {
      const b = buttons[i];
      const wrong = s._tried.includes(a);
      const done = s._solved && isCorrect(shapeOf(s.shape), a);
      b.disabled = wrong || (s._solved && !done);
      b.style.background = done ? COLORS.green : wrong ? "#fde2e2" : "";
      b.style.color = done ? "#fff" : wrong ? COLORS.red : "";
      b.setAttribute("aria-label", `${answerText(a)} trục${done ? ", đúng" : wrong ? ", chưa đúng" : ""}`);
    });
  };
}
const freshShape = s => {
  s._tried = [];
  s._solved = false;
  s._anim = null;
};

/** A dashed red line through (x, y) at `deg` degrees, clipped to radius R. */
function axisLine(ctx, x, y, deg, R, width = 3) {
  const a = (deg * Math.PI) / 180;
  ctx.save();
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = width;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.moveTo(x - R * Math.cos(a), y - R * Math.sin(a));
  ctx.lineTo(x + R * Math.cos(a), y + R * Math.sin(a));
  ctx.stroke();
  ctx.restore();
}

function drawShape(ctx, s, view) {
  const { w, h } = view;
  const small = w < 520 || h < 440;
  const sh = shapeOf(s.shape);
  const top = small ? 56 : 92;
  const R = Math.min(w - 24, h - top - 12) / 2;
  const cx = w / 2;
  const cy = top + (h - top - 12) / 2;
  const k = R / 1.35;
  const t = s._anim ? Math.min(1, (performance.now() - s._anim.start) / ANIM_MS) : 1;

  fit(ctx, `${sh.name} có mấy trục đối xứng?`, w / 2, small ? 18 : 30, small ? 18 : 28, w - 16, { bold: true });
  let msg;
  let color = COLORS.muted;
  if (s._solved) {
    const n = axisCount(sh);
    msg = `Đúng rồi! ${n === Infinity ? "Vô số trục đối xứng" : `${n} trục đối xứng`} · ${hasCentre(sh) ? "có tâm đối xứng" : "không có tâm đối xứng"}`;
    color = COLORS.green;
  } else if (s._tried.length) {
    msg = "Chưa đúng. Em thử gấp đôi hình theo một đường thẳng xem hai nửa có chồng khít không";
    color = COLORS.red;
  } else msg = "Bấm vào số trục ở bảng bên dưới";
  fit(ctx, msg, w / 2, small ? 40 : 64, small ? 12 : 16, w - 12, { bold: true, color });

  const o = centre(sh);
  const P = ([x, y]) => [cx + (x - o[0]) * k, cy + (y - o[1]) * k];
  ctx.save();
  ctx.lineJoin = ctx.lineCap = "round";
  if (sh.circle) {
    ctx.beginPath();
    ctx.arc(cx, cy, k, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.blue + "33";
    ctx.fill();
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (sh.stroke) {
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = Math.max(8, k * 0.22);
    ctx.beginPath();
    for (const [a, b] of sh.segs) {
      ctx.moveTo(...P(a));
      ctx.lineTo(...P(b));
    }
    ctx.stroke();
  } else {
    ctx.beginPath();
    sh.segs.forEach(([a], i) => (i ? ctx.lineTo(...P(a)) : ctx.moveTo(...P(a))));
    ctx.closePath();
    ctx.fillStyle = COLORS.blue + "33";
    ctx.fill();
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();

  if (!s._solved) return;
  // axes appear one after another (angles are measured with y down, as on screen)
  const axes = sh.circle ? [0, 30, 60, 90, 120, 150] : axesOf(sh);
  axes.forEach((deg, i) => {
    if (t * axes.length >= i) axisLine(ctx, cx, cy, deg, R * 0.98, small ? 2 : 3);
  });
  if (sh.circle) fit(ctx, "… mọi đường kính đều là trục đối xứng", w / 2, h - 10, small ? 11 : 14, w - 12, { color: COLORS.red, bold: true });
  if (hasCentre(sh)) {
    ctx.fillStyle = COLORS.purple;
    ctx.beginPath();
    ctx.arc(cx, cy, small ? 4 : 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

mount({
  slug: "truc-doi-xung",
  version: "1.0.0",
  title: "Hình có trục đối xứng",
  hint: "Tô các ô ở một bên đường màu đỏ rồi vẽ hình đối xứng. Gấp hình theo trục đối xứng thì hai nửa chồng khít lên nhau.",
  initialState,
  sanitize,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "draw", label: "Vẽ hình có trục đối xứng" },
        { value: "count", label: "Đếm số trục đối xứng" },
        { value: "center", label: "Vẽ hình có tâm đối xứng (lớp 6)" },
      ],
      onChange: freshShape,
    },
    {
      type: "select",
      key: "axis",
      label: "Trục đối xứng",
      visible: s => s.mode === "draw",
      options: [
        { value: "vertical", label: "Trục dọc" },
        { value: "horizontal", label: "Trục ngang" },
        { value: "diagonal", label: "Trục chéo" },
      ],
      onCommit: (s, api) => s.mirror && showMirror(s, api),
    },
    { type: "button", label: "Vẽ hình đối xứng qua trục", primary: true, visible: s => s.mode === "draw" && !s.mirror, action: showMirror },
    { type: "button", label: "Vẽ hình đối xứng qua tâm O", primary: true, visible: s => s.mode === "center" && !s.mirror, action: showMirror },
    { type: "button", label: "Ẩn hình đối xứng", visible: s => grid(s) && s.mirror, event: "mirror-hidden", action: s => (s.mirror = false) },
    {
      type: "button",
      label: "Xóa hết",
      visible: grid,
      event: "cleared",
      action: s => {
        s.cells = "0".repeat(N * N);
        s.mirror = false;
        s._last = null;
      },
    },
    {
      type: "select",
      key: "shape",
      label: "Hình",
      visible: s => s.mode === "count",
      options: SHAPES.map(x => ({ value: x.key, label: x.name })),
      onChange: freshShape,
    },
    { type: "custom", render: answerPad, visible: s => s.mode === "count" },
    {
      type: "button",
      label: "Hình tiếp theo ▶",
      visible: s => s.mode === "count",
      event: "next-shape",
      action: s => {
        const i = SHAPES.indexOf(shapeOf(s.shape));
        s.shape = SHAPES[(i + 1) % SHAPES.length].key;
        freshShape(s);
      },
    },
  ],
  readouts: [
    { label: "Số ô em tô", value: s => String(count(s.cells)) },
    { label: "Hình em tô đối xứng qua", value: s => about(s.cells) },
    { label: "Cả hình đối xứng qua", value: s => (s.mirror ? about(full(s.cells, activeAxis(s))) : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      if (!grid(s)) return false;
      const rc = cellAt(p, view);
      if (!rc) return false;
      s._paint = s.cells[rc[0] * N + rc[1]] !== "1";
      this.move(p, s, api, view);
      return true;
    },
    move(p, s, api, view) {
      const rc = cellAt(p, view);
      if (!rc || s._paint == null) return;
      const [r, c] = rc;
      if ((s.cells[r * N + c] === "1") === s._paint) return;
      s.cells = toggle(s.cells, r, c, s._paint);
      s._last = rc;
      api.emit("cell-drawn", { row: r, col: c, on: s._paint ? 1 : 0 }, "action");
    },
    up(p, s) {
      s._paint = null;
    },
  },
  draw(ctx, s, view) {
    if (!grid(s)) return drawShape(ctx, s, view);
    const { w } = view;
    const g = layout(view);
    const { small, cell, x0, y0, size } = g;
    const axis = activeAxis(s);
    const center = axis === "center";
    const images = mirrorCells(s.cells, axis);
    const t = s._anim ? Math.min(1, (performance.now() - s._anim.start) / ANIM_MS) : 1;

    // instructions
    const title = center ? "Hình đối xứng qua tâm O" : s.mirror ? "Đường màu đỏ là trục đối xứng của hình" : "Tô các ô ở phần tô nhạt, rồi vẽ hình đối xứng";
    fit(ctx, title, w / 2, small ? 14 : 24, small ? 15 : 22, w - 16, { bold: true });
    const sub = center
      ? "Mỗi ô và ô đối xứng với nó nằm trên một đường thẳng qua O và cách đều O"
      : "Mỗi ô và ô đối xứng với nó cách đều trục đối xứng";
    fit(ctx, sub, w / 2, small ? 32 : 52, small ? 11 : 15, w - 16, { color: COLORS.muted });

    // the side to draw on, the cells, the grid
    ctx.save();
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const x = x0 + c * cell;
        const y = y0 + r * cell;
        const mine = s.cells[r * N + c] === "1";
        const img = s.mirror && images[r * N + c] === "1" && !mine;
        ctx.fillStyle = drawSide(r, c, axis) && !center ? "#eef3ff" : "#fff";
        ctx.fillRect(x, y, cell, cell);
        if (mine) {
          ctx.fillStyle = COLORS.blue;
          ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        } else if (img) {
          ctx.globalAlpha = t;
          ctx.fillStyle = center ? COLORS.purple : COLORS.orange;
          const k = (cell - 2) * (0.4 + 0.6 * t);
          ctx.fillRect(x + (cell - k) / 2, y + (cell - k) / 2, k, k);
          ctx.globalAlpha = 1;
        }
      }
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      ctx.moveTo(x0 + i * cell, y0);
      ctx.lineTo(x0 + i * cell, y0 + size);
      ctx.moveTo(x0, y0 + i * cell);
      ctx.lineTo(x0 + size, y0 + i * cell);
    }
    ctx.stroke();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, size, size);
    ctx.restore();

    const mid = size / 2;
    if (center) {
      // the last cell and its image, joined through O
      if (s.mirror && s._last && s.cells[s._last[0] * N + s._last[1]] === "1") {
        const [r, c] = s._last;
        const [r2, c2] = reflect(r, c, "center");
        ctx.save();
        ctx.strokeStyle = COLORS.purple;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(x0 + (c + 0.5) * cell, y0 + (r + 0.5) * cell);
        ctx.lineTo(x0 + (c2 + 0.5) * cell, y0 + (r2 + 0.5) * cell);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = COLORS.red;
      ctx.beginPath();
      ctx.arc(x0 + mid, y0 + mid, small ? 5 : 7, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, "O", x0 + mid + 9, y0 + mid - 11, { size: small ? 13 : 17, bold: true, color: COLORS.red });
    } else {
      const deg = axis === "vertical" ? 90 : axis === "horizontal" ? 0 : 45;
      axisLine(ctx, x0 + mid, y0 + mid, deg, (axis === "diagonal" ? size * Math.SQRT1_2 : size / 2) + 4, small ? 3 : 4);
    }
  },
});
