import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  STEPS, A_MIN, A_MAX, initialState, shape, tileOf, construction, polygonAt, advance, identified,
  interiorAngle, aroundVertex, tiles, perimeter, area, triangleHeight,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const rad = d => (d * Math.PI) / 180;
const NAME = { 3: "Tam giác đều", 4: "Hình vuông", 5: "Ngũ giác đều", 6: "Lục giác đều" };
const TONES = [COLORS.blue, COLORS.orange, COLORS.green, COLORS.purple, COLORS.red, COLORS.yellow];
const tint = (hex, alpha) => `rgba(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(", ")}, ${alpha})`;

const STEP_TEXT = {
  3: [
    "Dùng thước vẽ đoạn thẳng AB = {a} cm.",
    "Dùng compa vẽ cung tròn tâm A, bán kính {a} cm.",
    "Vẽ cung tròn tâm B, bán kính {a} cm. Hai cung cắt nhau tại C.",
    "Nối C với A, C với B: được tam giác đều ABC cạnh {a} cm.",
  ],
  4: [
    "Dùng thước vẽ đoạn thẳng AB = {a} cm.",
    "Vẽ đường thẳng vuông góc với AB tại A. Trên đó lấy điểm D sao cho AD = {a} cm.",
    "Vẽ đường thẳng vuông góc với AB tại B. Trên đó lấy điểm C sao cho BC = {a} cm.",
    "Nối C với D: được hình vuông ABCD cạnh {a} cm.",
  ],
  6: [
    "Dùng compa vẽ đường tròn tâm O, bán kính {a} cm. Lấy điểm A trên đường tròn.",
    "Giữ nguyên khẩu độ compa {a} cm: từ A lần lượt đánh dấu các điểm B, C, D, E, F trên đường tròn.",
    "Nối AB, BC, CD, DE, EF, FA: được lục giác đều ABCDEF cạnh {a} cm.",
    "Nối AD, BE, CF: lục giác đều gồm 6 tam giác đều cạnh {a} cm.",
  ],
};

/** Centred paragraph, wrapped to maxW. Returns the y just below it. */
function para(ctx, text, cx, y, { size = 14, maxW = 300, color = COLORS.ink, bold = false, maxLines = 3 } = {}) {
  const lines = sz => {
    ctx.font = `${bold ? "600 " : ""}${sz}px ${FONT}`;
    const out = [""];
    for (const word of text.split(" ")) {
      const next = out.at(-1) ? `${out.at(-1)} ${word}` : word;
      if (ctx.measureText(next).width <= maxW || !out.at(-1)) out[out.length - 1] = next;
      else out.push(word);
    }
    return out;
  };
  let rows = lines(size);
  while (rows.length > maxLines && size > 9) rows = lines(--size);
  rows.forEach((row, i) => label(ctx, row, cx, y + size * 0.7 + i * size * 1.32, { size, color, bold, align: "center" }));
  return y + rows.length * size * 1.32;
}

// ---------- drawing board ----------
function boardGeom(s, view) {
  const small = view.w < 520 || view.h < 400;
  const head = small ? 56 : 70;
  const foot = small ? 58 : 70;
  const u = Math.max(8, Math.min((view.w - 24) / (2 * A_MAX + 1), (view.h - head - foot) / (2 * A_MAX * 0.87 + 1.2))); // px per cm
  const { n, a } = shape(s);
  const c = construction(n, a);
  const mid = [(c.box[0] + c.box[2]) / 2, (c.box[1] + c.box[3]) / 2];
  const centre = { x: view.w / 2, y: head + (view.h - head - foot) / 2 };
  const T = p => [centre.x + (p[0] - mid[0]) * u, centre.y - (p[1] - mid[1]) * u];
  return { small, head, foot, u, n, a, c, T, centre };
}

function drawRuler(ctx, from, to, u) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  ctx.save();
  ctx.translate(from[0], from[1]);
  ctx.rotate(Math.atan2(to[1] - from[1], to[0] - from[0]));
  const w = Math.min(26, u * 0.9);
  ctx.fillStyle = "rgba(245, 197, 24, 0.35)";
  ctx.strokeStyle = "rgba(160, 120, 0, 0.7)";
  ctx.lineWidth = 1;
  ctx.fillRect(-u * 0.5, 2, len + u, w);
  ctx.strokeRect(-u * 0.5, 2, len + u, w);
  ctx.beginPath();
  for (let k = 0; k * u <= len + 0.5; k++) {
    ctx.moveTo(k * u, 2);
    ctx.lineTo(k * u, 2 + w * 0.45);
  }
  ctx.stroke();
  ctx.restore();
}

function drawCompass(ctx, centre, pen) {
  const mx = (centre[0] + pen[0]) / 2;
  const my = (centre[1] + pen[1]) / 2;
  const r = Math.hypot(pen[0] - centre[0], pen[1] - centre[1]);
  // hinge on the upper side of the radius
  let nx = -(pen[1] - centre[1]) / r;
  let ny = (pen[0] - centre[0]) / r;
  if (ny > 0) [nx, ny] = [-nx, -ny];
  const apex = [mx + nx * r * 0.8, my + ny * r * 0.8];
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(centre[0], centre[1]);
  ctx.lineTo(apex[0], apex[1]);
  ctx.lineTo(pen[0], pen[1]);
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(apex[0], apex[1], 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centre[0], centre[1]);
  ctx.lineTo(pen[0], pen[1]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBoard(ctx, s, view) {
  const g = boardGeom(s, view);
  const { small, u, n, a, c, T } = g;
  const progress = clamp(Number.isFinite(s.progress) ? s.progress : STEPS, 0, STEPS);
  const complete = progress >= STEPS;
  const size = small ? 12 : 15;

  // 1 cm squared paper, with a grid point under the first point of the figure
  const [gx, gy] = T([0, 0]);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = gx % u; x < view.w; x += u) {
    ctx.moveTo(x, g.head);
    ctx.lineTo(x, view.h - g.foot);
  }
  for (let y = g.head + ((((gy - g.head) % u) + u) % u); y <= view.h - g.foot; y += u) {
    ctx.moveTo(0, y);
    ctx.lineTo(view.w, y);
  }
  ctx.stroke();

  // the finished figure is filled; a hexagon as six equilateral triangles
  if (complete) {
    const pts = c.polygon.map(T);
    if (n === 6) {
      const o = T([0, 0]);
      pts.forEach((p, i) => {
        ctx.fillStyle = tint(i % 2 ? COLORS.blue : COLORS.orange, 0.2);
        ctx.beginPath();
        ctx.moveTo(o[0], o[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.lineTo(...pts[(i + 1) % 6]);
        ctx.fill();
      });
    } else {
      ctx.fillStyle = tint(COLORS.blue, 0.15);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.fill();
    }
  }

  let tool = null; // what is drawing right now
  c.steps.forEach((items, i) => {
    const local = clamp(progress - i, 0, 1) * items.length;
    items.forEach((it, j) => {
      const f = clamp(local - j, 0, 1);
      if (f <= 0) return;
      const active = f < 1;
      if (it.seg) {
        const from = T(it.seg[0]);
        const to = T(it.seg[1]);
        const pen = [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f];
        const inner = n === 6 && i === 3;
        ctx.strokeStyle = it.guide ? COLORS.muted : inner ? COLORS.blue : COLORS.ink;
        ctx.lineWidth = it.guide ? 1 : inner ? 2 : 3;
        ctx.lineCap = "round";
        ctx.setLineDash(it.guide ? [5, 4] : []);
        ctx.beginPath();
        ctx.moveTo(from[0], from[1]);
        ctx.lineTo(pen[0], pen[1]);
        ctx.stroke();
        ctx.setLineDash([]);
        if (active) tool = { ruler: [from, to], pen };
      } else {
        const [centre, r, a0, a1] = it.arc;
        const o = T(centre);
        const now = a0 + (a1 - a0) * f;
        ctx.strokeStyle = tint(COLORS.purple, complete ? 0.45 : 0.9);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(o[0], o[1], r * u, -rad(a0), -rad(now), a1 > a0);
        ctx.stroke();
        if (active) tool = { compass: o, pen: [o[0] + r * u * Math.cos(rad(now)), o[1] - r * u * Math.sin(rad(now))] };
      }
    });
  });

  // right-angle marks of the square
  if (n === 4) {
    const k = Math.min(12, u * 0.45);
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    [[0, 1, 1.34], [1, -1, 2.34]].forEach(([corner, side, from]) => {
      if (progress < from) return;
      const [x, y] = T(c.polygon[corner]);
      ctx.strokeRect(side > 0 ? x : x - k, y - k, k, k);
    });
  }

  if (tool?.ruler) drawRuler(ctx, ...tool.ruler, u);
  if (tool?.compass) drawCompass(ctx, tool.compass, tool.pen);
  if (tool) {
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.arc(tool.pen[0], tool.pen[1], 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // named points, pushed away from the middle of the figure
  const mid = c.polygon.reduce((m, p) => [m[0] + p[0] / n, m[1] + p[1] / n], [0, 0]);
  for (const [name, p, from] of c.points) {
    if (progress < from) continue;
    const [x, y] = T(p);
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    const d = Math.hypot(p[0] - mid[0], p[1] - mid[1]);
    const out = d < 1e-9 ? [0.7, -0.7] : [(p[0] - mid[0]) / d, (p[1] - mid[1]) / d];
    label(ctx, name, x + out[0] * 15, y - out[1] * 15, { size: small ? 13 : 16, align: "center", bold: true });
  }

  if (complete) {
    // one angle and one side are labelled
    const [p, q, o] = [c.polygon[0], c.polygon[1], c.polygon[n - 1]].map(T);
    const a1 = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const a2 = Math.atan2(o[1] - p[1], o[0] - p[0]);
    const r = clamp(u * 0.7, 14, 30);
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, a1, a2, true); // from the next corner round to the previous one: inside the figure
    ctx.stroke();
    const am = Math.atan2(Math.sin(a1) + Math.sin(a2), Math.cos(a1) + Math.cos(a2));
    label(ctx, `${interiorAngle(n)}°`, p[0] + (r + 17) * Math.cos(am), p[1] + (r + 17) * Math.sin(am), { size: small ? 12 : 15, align: "center", bold: true, color: COLORS.orange });
    const below = n === 6 ? 1 : -1; // outside the figure
    label(ctx, `${a} cm`, (p[0] + q[0]) / 2 + (n === 6 ? 22 : 0), (p[1] + q[1]) / 2 - below * (n === 6 ? 10 : 14), { size: small ? 12 : 14, align: n === 6 ? "left" : "center", color: COLORS.blue, bold: true });
  }

  // words
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, view.w, g.head);
  ctx.fillRect(0, view.h - g.foot, view.w, g.foot);
  const stepNo = Math.min(STEPS - 1, Math.floor(progress));
  const text = `Bước ${stepNo + 1}/${STEPS}. ${STEP_TEXT[n][stepNo].replaceAll("{a}", a)}`;
  para(ctx, text, view.w / 2, small ? 4 : 10, { size: small ? 12.5 : 16, maxW: view.w - 20, bold: true });
  const fy = view.h - g.foot + 4;
  if (!complete) {
    para(ctx, "Bấm ▶ Chạy hoặc kéo thanh “Tiến trình dựng hình” để xem từng bước. Mỗi ô vuông có cạnh 1 cm.", view.w / 2, fy, { size, maxW: view.w - 20, color: COLORS.muted });
    return;
  }
  const S = fmt(area(n, a), 2);
  const how =
    n === 3
      ? `Diện tích: ${a} × ${fmt(triangleHeight(a), 3)} : 2 ≈ ${S} cm² (chiều cao ≈ ${fmt(triangleHeight(a), 3)} cm).`
      : n === 4
        ? `Diện tích: ${a} × ${a} = ${S} cm².`
        : `Diện tích: 6 × ${fmt(area(3, a), 3)} ≈ ${S} cm² (6 tam giác đều cạnh ${a} cm).`;
  const y = para(ctx, `Chu vi: ${n} × ${a} = ${perimeter(n, a)} cm.   Mỗi góc: ${interiorAngle(n)}°.`, view.w / 2, fy, { size, maxW: view.w - 20, bold: true, maxLines: 1 });
  para(ctx, how, view.w / 2, y + 2, { size, maxW: view.w - 20, color: COLORS.green, bold: true, maxLines: 2 });
}

// ---------- tiling ----------
function lattice(ctx, n, V, t, view) {
  const R = Math.ceil(Math.hypot(view.w, view.h) / t) + 1;
  ctx.strokeStyle = "#cfd8ea";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const line = (x1, y1, x2, y2) => {
    ctx.moveTo(V.x + x1 * t, V.y - y1 * t);
    ctx.lineTo(V.x + x2 * t, V.y - y2 * t);
  };
  if (n === 6) {
    // centres of a honeycomb that has a corner at V
    for (let i = -R; i <= R; i++)
      for (let j = -R; j <= R; j++) {
        const cx = 0.5 + 1.5 * i;
        const cy = Math.sqrt(3) / 2 + (Math.sqrt(3) / 2) * i + Math.sqrt(3) * j;
        if (Math.hypot(cx, cy) > R + 1) continue;
        for (let k = 0; k < 3; k++) line(cx + Math.cos(rad(60 * k)), cy + Math.sin(rad(60 * k)), cx + Math.cos(rad(60 * k + 60)), cy + Math.sin(rad(60 * k + 60)));
      }
  } else {
    // families of parallel lines through V: 2 for squares, 3 for triangles
    const gap = n === 4 ? 1 : Math.sqrt(3) / 2;
    for (const d of n === 4 ? [0, 90] : [0, 60, 120]) {
      const [dx, dy] = [Math.cos(rad(d)), Math.sin(rad(d))];
      for (let k = -R; k <= R; k++) line(-dy * k * gap - dx * R, dx * k * gap - dy * R, -dy * k * gap + dx * R, dx * k * gap + dy * R);
    }
  }
  ctx.stroke();
}

function drawTiling(ctx, s, view) {
  const small = view.w < 520 || view.h < 400;
  const { n, k } = tileOf(s);
  const head = small ? 58 : 76;
  const foot = s.status ? (small ? 62 : 50) : 0;
  const size = small ? 12 : 15;
  const V = { x: view.w / 2, y: head + (view.h - head - foot) / 2 };
  const t = (Math.min(view.w, view.h - head - foot) * 0.46) / { 3: 1.3, 4: 1.42, 5: 1.62, 6: 2 }[n]; // side, px: the figure fills the stage
  const theta = interiorAngle(n);
  const { sum, gap } = aroundVertex(n, k);
  const fits = gap === 0;

  if (fits) lattice(ctx, n, V, t, view);
  for (let j = 0; j < k; j++) {
    const pts = polygonAt(n, 1, [0, 0], j * theta);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(V.x + p[0] * t, V.y - p[1] * t) : ctx.moveTo(V.x, V.y)));
    ctx.closePath();
    ctx.fillStyle = tint(TONES[j % TONES.length], 0.3);
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    if (t > 60 && j * theta < 360) {
      const m = rad((j + 0.5) * theta);
      label(ctx, `${theta}°`, V.x + t * 0.4 * Math.cos(m), V.y - t * 0.4 * Math.sin(m), { size: small ? 11 : 13, align: "center", bold: true });
    }
  }
  if (!fits) {
    // the part of the full turn that is left open, or covered twice
    const from = gap > 0 ? sum : 0;
    const to = gap > 0 ? 360 : Math.min(360, -gap);
    ctx.fillStyle = tint(COLORS.red, gap > 0 ? 0.12 : 0.4);
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(V.x, V.y);
    ctx.arc(V.x, V.y, t * 0.7, -rad(from), -rad(to), true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    const m = rad((from + to) / 2);
    const text = gap > 0 ? `hở ${gap}°` : `chồng ${Math.min(360, -gap)}°`;
    const at = gap > 0 && gap <= 90 ? 1.3 : 0.85; // a narrow gap is named further out, where it is wider
    label(ctx, text, V.x + t * at * Math.cos(m), V.y - t * at * Math.sin(m), { size: small ? 12 : 15, align: "center", bold: true, color: COLORS.red });
  }
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(V.x, V.y, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, view.w, head);
  if (foot) ctx.fillRect(0, view.h - foot, view.w, foot);
  const verdict = fits ? ": vừa khít quanh một điểm" : gap > 0 ? ` < 360°: còn hở ${gap}°` : " > 360°: các hình chồng lên nhau";
  const y = para(ctx, `${k} × ${theta}° = ${sum}°${verdict}`, view.w / 2, small ? 4 : 10, { size: small ? 13.5 : 18, maxW: view.w - 16, bold: true, color: fits ? COLORS.green : gap > 0 ? COLORS.orange : COLORS.red, maxLines: 1 });
  const why = fits
    ? `${NAME[n]} lát kín mặt phẳng: không hở, không chồng lên nhau.`
    : n === 5
      ? "Ngũ giác đều: 3 hình thì còn hở 36°, 4 hình thì chồng lên nhau, nên không lát kín được mặt phẳng."
      : "Thêm hoặc bớt hình để tổng các góc quanh điểm này bằng đúng 360°.";
  para(ctx, why, view.w / 2, y + 2, { size, maxW: view.w - 16, color: COLORS.muted, maxLines: 2 });
  if (s.status === "right")
    para(ctx, "Đúng rồi! Chỉ tam giác đều, hình vuông và lục giác đều lát kín mặt phẳng: 360° chia hết cho 60°, 90°, 120° nhưng không chia hết cho 108°.", view.w / 2, view.h - foot + 2, { size, maxW: view.w - 16, color: COLORS.green, bold: true });
  if (s.status === "wrong")
    para(ctx, "Chưa đúng. Hãy ghép thử từng loại hình quanh một điểm xem có vừa khít 360° không.", view.w / 2, view.h - foot + 2, { size, maxW: view.w - 16, color: COLORS.red, bold: true });
}

const report = (s, api) => {
  if (s.mode !== "build" || s.progress < STEPS) return;
  const { n, a } = shape(s);
  api.emit("polygon-built", { n, side: a, perimeter: perimeter(n, a), area: area(n, a) }, "result");
};
const building = s => s.mode === "build";
const tiling = s => s.mode === "tile";
const unmark = s => {
  s.status = "";
};

mount({
  slug: "da-giac-deu",
  version: "1.0.0",
  title: "Tam giác đều, hình vuông, lục giác đều",
  hint: "Bấm ▶ Chạy để xem cách dựng hình bằng thước và compa. Chuyển sang “Lát mặt phẳng” để ghép các hình quanh một điểm.",
  initialState,
  step(s, dt, api) {
    if (s.mode !== "build") return api.pause();
    if (advance(s, dt)) {
      api.pause();
      api.sync();
      report(s, api);
    }
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Hoạt động",
      options: [
        { value: "build", label: "Dựng hình bằng thước và compa" },
        { value: "tile", label: "Lát mặt phẳng" },
      ],
    },
    {
      type: "select",
      key: "n",
      label: "Hình cần dựng",
      visible: building,
      onCommit: report,
      options: [
        { value: 3, label: "Tam giác đều" },
        { value: 4, label: "Hình vuông" },
        { value: 6, label: "Lục giác đều" },
      ],
    },
    { type: "slider", key: "a", label: "Độ dài cạnh a", min: A_MIN, max: A_MAX, step: 1, unit: "cm", digits: 0, visible: building, onCommit: report },
    {
      type: "slider",
      key: "progress",
      label: "Tiến trình dựng hình",
      min: 0,
      max: STEPS,
      step: 0.02,
      visible: building,
      format: v => (v >= STEPS ? "xong" : `bước ${Math.floor(v) + 1}/${STEPS}`),
      onCommit: report,
    },
    {
      type: "select",
      key: "tile",
      label: "Hình dùng để ghép",
      visible: tiling,
      options: [3, 4, 5, 6].map(n => ({ value: n, label: `${NAME[n]} (mỗi góc ${interiorAngle(n)}°)` })),
    },
    { type: "stepper", key: "around", label: "Số hình ghép quanh một điểm", min: 1, max: 6, visible: tiling },
    { type: "heading", label: "Hình nào lát kín được mặt phẳng?", visible: tiling },
    ...[3, 4, 5, 6].map(n => ({ type: "checkbox", key: `pick${n}`, label: NAME[n], visible: tiling, disabled: s => s.status === "right", onChange: unmark })),
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: tiling,
      disabled: s => s.status === "right",
      action(s, api) {
        const picked = [3, 4, 5, 6].filter(n => s[`pick${n}`]).length;
        if (identified(s)) {
          s.status = "right";
          api.emit("tiling-identified", { count: picked }, "goal");
        } else {
          s.status = "wrong";
          api.emit("wrong-answer", { picked }, "action");
        }
      },
    },
  ],
  readouts: [
    { label: "Hình đang xét", value: s => NAME[building(s) ? shape(s).n : tileOf(s).n] },
    { label: "Mỗi góc", value: s => `${interiorAngle(building(s) ? shape(s).n : tileOf(s).n)}°` },
    { label: "Chu vi (hình đang dựng)", value: s => `${perimeter(shape(s).n, shape(s).a)} cm` },
    { label: "Diện tích (hình đang dựng)", value: s => `${fmt(area(shape(s).n, shape(s).a), 2)} cm²` },
  ],
  draw(ctx, s, view) {
    if (tiling(s)) drawTiling(ctx, s, view);
    else drawBoard(ctx, s, view);
  },
});
