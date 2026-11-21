import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, measure, mesh, project, rotate, toScreen, extent, net, SOLIDS } from "./model.js";

const NAMES = {
  box: "Hình hộp chữ nhật",
  cube: "Hình lập phương",
  prism: "Hình lăng trụ đứng tam giác",
  pyramid: "Hình chóp tứ giác đều",
  cylinder: "Hình trụ",
  cone: "Hình nón",
  sphere: "Hình cầu",
};

const FORMULAS = {
  box: ["V = a · b · h", "Sxq = 2(a + b) · h", "Stp = Sxq + 2ab"],
  cube: ["V = a³", "Sxq = 4a²", "Stp = 6a²"],
  prism: ["V = S đáy · h = ½ab · h", "Sxq = C đáy · h = (a + b + c) · h", "Stp = Sxq + 2 · S đáy"],
  pyramid: ["V = ⅓ S đáy · h = ⅓a² · h", "Sxq = p · d (p: nửa chu vi đáy)", "Stp = Sxq + a²"],
  cylinder: ["V = πr²h", "Sxq = 2πrh", "Stp = 2πrh + 2πr²"],
  cone: ["V = ⅓πr²h", "Sxq = πrl", "Stp = πrl + πr²"],
  sphere: ["V = 4/3 · πR³", "S = 4πR²"],
};

// Extra length the learner needs for the formulas, shown under them.
const extra = s => {
  const m = measure(s);
  if (s.solid === "prism") return `cạnh huyền c = √(a² + b²) = ${fmt(Math.hypot(s.a, s.b))} cm`;
  if (s.solid === "pyramid") return `trung đoạn d = √(h² + (a/2)²) = ${fmt(m.apothem)} cm`;
  if (s.solid === "cone") return `đường sinh l = √(r² + h²) = ${fmt(m.slant)} cm`;
  return null;
};

const markValue = (s, text) => {
  const m = measure(s);
  return { a: s.a, b: s.b, h: s.h, r: s.r, R: s.r, d: m.apothem, l: m.slant }[text];
};

const report = (s, api) => {
  const m = measure(s);
  api.emit("dimensions-set", { solid: SOLIDS.indexOf(s.solid), volume: m.volume, lateral: m.lateral, total: m.total }, "result");
};

function geom(s, view) {
  const small = view.w < 560 || view.h < 420;
  const lines = small ? 1 : FORMULAS[s.solid].length + (extra(s) ? 1 : 0);
  const top = small ? 30 : 30 + lines * 20;
  const bottom = small ? 22 : 30;
  return { small, top, bottom, cx: view.w / 2, cy: top + (view.h - top - bottom) / 2, sw: view.w - 24, sh: view.h - top - bottom };
}

const is = (...k) => s => k.includes(s.solid);
const dim = (key, label, when) => ({ type: "slider", key, label, min: 1, max: 10, step: 0.5, unit: "cm", digits: 1, visible: when, onCommit: report });

function shade(n) {
  const light = [-0.45, 0.7, 0.55];
  const k = clamp(0.45 + 0.55 * (n[0] * light[0] + n[1] * light[1] + n[2] * light[2]), 0.25, 1);
  return `rgb(${Math.round(150 + 90 * k)}, ${Math.round(180 + 60 * k)}, ${Math.round(225 + 30 * k)})`;
}

function drawSolid(ctx, s, g) {
  const R = extent(s);
  const dist = 4 * R;
  const scale = (Math.min(g.sw, g.sh) * 0.36) / R;
  const P = p => toScreen(p, dist, scale, g.cx, g.cy);
  const { pts, faces, edges } = project(mesh(s), s.yaw, s.pitch, dist);
  const scr = pts.map(P);

  for (const f of faces) {
    if (!f.front) continue;
    ctx.fillStyle = ctx.strokeStyle = shade(f.normal);
    ctx.lineWidth = 1;
    ctx.beginPath();
    f.idx.forEach((i, k) => (k ? ctx.lineTo(...scr[i]) : ctx.moveTo(...scr[i])));
    ctx.closePath();
    ctx.fill();
    ctx.stroke(); // hides hairline seams between the small faces of curved solids
  }
  ctx.lineCap = "round";
  for (const hidden of [true, false]) {
    ctx.strokeStyle = hidden ? COLORS.muted : COLORS.ink;
    ctx.lineWidth = hidden ? 1.5 : 2;
    ctx.setLineDash(hidden ? [6, 5] : []);
    ctx.beginPath();
    for (const e of edges) {
      if (e.hidden !== hidden) continue;
      ctx.moveTo(...scr[e.i]);
      ctx.lineTo(...scr[e.j]);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // dimension labels: a visible edge on the outline, or a dashed segment (height, radius, ...)
  const mid = P([0, 0, 0]);
  const hidden = new Map(edges.map(e => [`${Math.min(e.i, e.j)}-${Math.max(e.i, e.j)}`, e.hidden]));
  for (const mk of mesh(s).marks) {
    let seg;
    if (mk.edges) {
      const ok = mk.edges.filter(([i, j]) => hidden.get(`${Math.min(i, j)}-${Math.max(i, j)}`) === false);
      const far = ([i, j]) => Math.hypot((scr[i][0] + scr[j][0]) / 2 - mid[0], (scr[i][1] + scr[j][1]) / 2 - mid[1]);
      const [i, j] = (ok.length ? ok : mk.edges).reduce((best, e) => (far(e) > far(best) ? e : best));
      seg = [scr[i], scr[j]];
    } else {
      const segs = mk.lines.map(l => l.map(v => P(rotate(v, s.yaw, s.pitch))));
      seg = mk.outline ? segs.reduce((best, l) => (l[1][0] > best[1][0] ? l : best)) : segs[0];
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 2;
      ctx.setLineDash(mk.outline ? [] : [5, 4]);
      ctx.beginPath();
      ctx.moveTo(...seg[0]);
      ctx.lineTo(...seg[1]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const [p, q] = seg;
    const t = mk.at ?? 0.5;
    const m = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const away = Math.hypot(m[0] - mid[0], m[1] - mid[1]) || 1;
    const push = mk.edges ? 18 : 0;
    const x = m[0] + ((m[0] - mid[0]) / away) * push + (mk.edges ? 0 : 6);
    const y = m[1] + ((m[1] - mid[1]) / away) * push;
    label(ctx, g.small ? mk.text : `${mk.text} = ${fmt(markValue(s, mk.text), 1)}`, x, y, {
      color: COLORS.orange,
      bold: true,
      size: g.small ? 13 : 14,
      align: mk.edges ? "center" : "left",
    });
  }
}

function drawNet(ctx, s, g) {
  const parts = net(s);
  if (!parts) {
    label(ctx, "Mặt cầu không trải phẳng được thành hình phẳng.", g.cx, g.cy, { align: "center", size: g.small ? 12 : 15, color: COLORS.muted });
    return;
  }
  const all = parts.flatMap(p => p.pts);
  const [x0, x1] = [Math.min(...all.map(p => p[0])), Math.max(...all.map(p => p[0]))];
  const [y0, y1] = [Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[1]))];
  const k = Math.min(g.sw / (x1 - x0), (g.sh - 24) / (y1 - y0)) * 0.92;
  const X = x => g.cx + (x - (x0 + x1) / 2) * k;
  const Y = y => g.cy - 10 - (y - (y0 + y1) / 2) * k;
  for (const p of parts) {
    ctx.fillStyle = p.kind === "side" ? "#cdeedd" : "#d6e3fb";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  const y = g.cy + g.sh / 2 - 8;
  ctx.fillStyle = "#cdeedd";
  ctx.fillRect(g.cx - 150, y - 6, 12, 12);
  ctx.fillStyle = "#d6e3fb";
  ctx.fillRect(g.cx + 10, y - 6, 12, 12);
  label(ctx, "mặt xung quanh", g.cx - 134, y, { size: 12, color: COLORS.muted });
  label(ctx, "mặt đáy", g.cx + 26, y, { size: 12, color: COLORS.muted });
}

mount({
  slug: "the-tich-khoi",
  version: "1.0.0",
  title: "Thể tích và diện tích các khối",
  hint: "Kéo trên hình để xoay khối. Cạnh khuất vẽ bằng nét đứt.",
  initialState,
  controls: [
    {
      type: "select",
      key: "solid",
      label: "Khối",
      options: SOLIDS.map(value => ({ value, label: NAMES[value] })),
      onCommit: report,
    },
    dim("a", "Chiều dài a", is("box")),
    dim("a", "Cạnh a", is("cube")),
    dim("a", "Cạnh góc vuông a", is("prism")),
    dim("a", "Cạnh đáy a", is("pyramid")),
    dim("b", "Chiều rộng b", is("box")),
    dim("b", "Cạnh góc vuông b", is("prism")),
    dim("r", "Bán kính đáy r", is("cylinder", "cone")),
    dim("r", "Bán kính R", is("sphere")),
    dim("h", "Chiều cao h", is("box", "prism", "pyramid", "cylinder", "cone")),
    { type: "slider", key: "yaw", label: "Xoay ngang", min: 0, max: 359, step: 1, format: v => `${Math.round(v)}°`, visible: s => !s.showNet },
    { type: "slider", key: "pitch", label: "Nghiêng", min: -60, max: 60, step: 1, format: v => `${fmt(v, 0)}°`, visible: s => !s.showNet },
    { type: "checkbox", key: "showNet", label: "Trải phẳng (hình khai triển)" },
  ],
  readouts: [
    { label: "Thể tích V", value: s => `${fmt(measure(s).volume)} cm³` },
    { label: "Diện tích xung quanh Sxq", value: s => (s.solid === "sphere" ? "–" : `${fmt(measure(s).lateral)} cm²`) },
    { label: "Diện tích toàn phần Stp", value: s => (s.solid === "sphere" ? "–" : `${fmt(measure(s).total)} cm²`) },
    { label: "Diện tích mặt cầu S", value: s => (s.solid === "sphere" ? `${fmt(measure(s).total)} cm²` : "–") },
  ],
  pointer: {
    down(p, s) {
      if (s.showNet) return false;
      s._drag = { x: p.x, y: p.y, yaw: s.yaw, pitch: s.pitch };
    },
    move(p, s) {
      const d = s._drag;
      if (!d) return;
      s.yaw = (((Math.round(d.yaw + (p.x - d.x) * 0.5)) % 360) + 360) % 360;
      s.pitch = clamp(Math.round(d.pitch + (p.y - d.y) * 0.4), -60, 60);
    },
    up(p, s, api) {
      const d = s._drag;
      s._drag = null;
      if (d && (d.yaw !== s.yaw || d.pitch !== s.pitch)) api.emit("rotate", { yaw: s.yaw, pitch: s.pitch }, "action");
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    label(ctx, NAMES[s.solid], 12, 16, { bold: true, size: g.small ? 14 : 16 });
    if (!g.small) {
      const lines = [...FORMULAS[s.solid], extra(s)].filter(Boolean);
      lines.forEach((t, i) => label(ctx, t, 12, 42 + i * 20, { size: 14, color: i < FORMULAS[s.solid].length ? COLORS.ink : COLORS.muted }));
    }
    if (s.showNet) drawNet(ctx, s, g);
    else drawSolid(ctx, s, g);
    const note = s.showNet ? "Hình khai triển, đã thu nhỏ cho vừa khung" : g.small ? "Hình đã thu nhỏ; kéo để xoay" : "Hình vẽ phối cảnh, đã thu nhỏ cho vừa khung; nét đứt là cạnh khuất";
    if (!s.showNet || !g.small) label(ctx, note, view.w / 2, view.h - 11, { align: "center", size: 12, color: COLORS.muted });
  },
});
