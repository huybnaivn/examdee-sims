import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, solve, pull, step, height, segments, movable } from "./model.js";

// Report the outcome once each time the load arrives at the target height.
const check = (s, api) => {
  const arrived = height(s) >= s.target - 1e-9;
  if (arrived && !s._lifted) {
    const r = solve(s);
    api.emit("load-lifted", { force: r.force, ropePulled: r.rope, height: r.height, workIn: r.workIn, workOut: r.workOut, efficiency: r.efficiency }, "result");
  }
  s._lifted = arrived;
};

// Changing the machine puts the load back on the floor.
const lower = (s, api) => {
  s.height = 0;
  s._lifted = false;
  api.pause();
};

// Everything placed from the view, so draw() and the pointer agree.
function geom(s, view) {
  const small = view.w < 560 || view.h < 420;
  const n = movable(s);
  const barsW = small ? 96 : 160;
  const beamY = small ? 30 : 56;
  const floor = view.h - (small ? 30 : 48);
  const lw = clamp(view.h / 9, 44, 84);
  const lh = lw * 0.72;
  const r = n ? clamp(view.h / 36, 10, 20) : lw / 4 + 6;
  const hook = small ? 10 : 14;
  const yF = beamY + hook + r;
  const width = n ? 4 * n * r : 2 * r;
  const x0 = (view.w - barsW - width) / 2 + 8;
  const xEnd = x0 + width; // free end of the rope
  // lower block (n ≥ 1) or load top (fixed pulley) when h = 0
  const yM0 = n ? floor - lh - hook - r : floor - lh;
  const room = n ? yM0 - yF - 2 * r - 8 : yM0 - yF - r - 8;
  const ppm = Math.max(4, room / Math.max(0.5, s.target)); // px per metre of height
  const lift = height(s) * ppm;
  const yM = yM0 - lift;
  const loadX = n ? x0 + (2 * n - 1) * r : x0;
  const loadTop = n ? yM + r + hook : yM;
  return { small, n, r, hook, beamY, floor, lw, lh, yF, yM, x0, xEnd, ppm, loadX, loadTop, barsW, hand: floor - (small ? 14 : 22) };
}

const pulley = (ctx, x, y, r) => {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
};

const line = (ctx, x1, y1, x2, y2) => {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

function drawBars(ctx, s, g, r, view) {
  const top = g.beamY + 12;
  const bottom = g.floor;
  const span = bottom - top;
  const max = r.k * s.target;
  const bw = g.small ? 22 : 30;
  const x = view.w - g.barsW + (g.small ? 14 : 30);
  const bars = [
    ["s", r.rope, COLORS.orange, g.small ? "s (m)" : "dây kéo"],
    ["h", r.height, COLORS.blue, g.small ? "h (m)" : "vật lên"],
  ];
  bars.forEach(([name, value, color, text], i) => {
    const bx = x + i * (bw + (g.small ? 18 : 40));
    const bh = (value / max) * span;
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(bx, top, bw, span);
    ctx.fillStyle = color;
    ctx.fillRect(bx, bottom - bh, bw, bh);
    label(ctx, g.small ? fmt(value) : `${name} = ${fmt(value)} m`, bx + bw / 2, top - 12, { size: g.small ? 11 : 13, align: "center", bold: true, color });
    label(ctx, text, bx + bw / 2, bottom + 12, { size: 11, align: "center", color: COLORS.muted });
  });
}

mount({
  slug: "rong-roc",
  version: "1.0.0",
  title: "Ròng rọc và máy cơ đơn giản",
  hint: "Kéo đầu dây (bàn tay) xuống, dùng thanh trượt hoặc nhấn Chạy để nâng vật lên độ cao cần đạt.",
  initialState,
  step(s, dt, api) {
    if (height(s) >= s.target) s.height = 0; // "Chạy" after the load arrived starts a new lift
    step(s, dt);
    check(s, api);
    api.sync(); // keep the "Kéo dây" slider in step with the load
    if (s._lifted) api.pause();
  },
  controls: [
    {
      type: "select",
      key: "system",
      label: "Cách nâng vật",
      onChange: lower,
      options: [
        { value: "fixed", label: "Ròng rọc cố định" },
        { value: "movable1", label: "1 ròng rọc động" },
        { value: "movable2", label: "Palăng 2 ròng rọc động" },
        { value: "movable3", label: "Palăng 3 ròng rọc động" },
      ],
    },
    { type: "slider", key: "mass", label: "Khối lượng vật m", min: 1, max: 100, step: 1, unit: "kg", digits: 0, onChange: lower },
    {
      type: "slider",
      key: "pulleyMass",
      label: "Khối lượng mỗi ròng rọc động",
      min: 0,
      max: 5,
      step: 0.1,
      unit: "kg",
      digits: 1,
      onChange: lower,
      visible: s => movable(s) > 0,
    },
    { type: "slider", key: "efficiency", label: "Hiệu suất do ma sát ở trục", min: 50, max: 100, step: 1, unit: "%", digits: 0, onChange: lower },
    { type: "slider", key: "target", label: "Độ cao cần nâng", min: 0.5, max: 3, step: 0.1, unit: "m", digits: 1, onChange: lower },
    {
      type: "slider",
      key: "height",
      label: "Kéo dây",
      min: 0,
      max: 3,
      step: 0.01,
      format: (v, s) => `h = ${fmt(height(s))} m; s = ${fmt(solve(s).rope)} m`,
      onChange(s) {
        s.height = height(s);
      },
      onCommit: check,
    },
  ],
  readouts: [
    { label: "Trọng lượng vật P = 10·m", value: s => `${fmt(solve(s).P, 1)} N` },
    { label: "Lực kéo F", value: s => `${fmt(solve(s).force, 2)} N` },
    { label: "Số đoạn dây đỡ vật", value: s => String(segments(s)) },
    { label: "Dây đã kéo s", value: s => `${fmt(solve(s).rope)} m` },
    { label: "Độ cao vật h", value: s => `${fmt(height(s))} m` },
    { label: "Công toàn phần Atp = F·s", value: s => `${fmt(solve(s).workIn, 1)} J` },
    { label: "Công có ích Aci = P·h", value: s => `${fmt(solve(s).workOut, 1)} J` },
    { label: "Hiệu suất H = Aci/Atp", value: s => `${fmt(solve(s).efficiency * 100, 1)} %` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      if (Math.abs(p.x - g.xEnd) > 26 || p.y < g.yF || p.y > g.floor + 10) return false;
      api.pause();
      s._y = p.y;
      s._from = height(s);
      return true;
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      pull(s, (p.y - s._y) / g.ppm); // 1 m of hand travel pulls 1 m of rope
      s._y = p.y;
      check(s, api);
    },
    up(p, s, api) {
      if (height(s) !== s._from) api.emit("pull-rope", { ropePulled: (height(s) - s._from) * segments(s), height: height(s) });
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const r = solve(s);
    const { n, x0, yF, yM, floor, small } = g;
    const size = small ? 12 : 14;

    // headline: the ideal rule of this machine
    const rule = n ? `${n === 1 ? "Ròng rọc động" : "Palăng"}: F = P/${r.k}, s = ${r.k}·h (lí tưởng)` : "Ròng rọc cố định: F = P, s = h";
    label(ctx, rule, (view.w - g.barsW) / 2, small ? 11 : 22, { size, bold: true, align: "center" });

    // beam and floor
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x0 - 24, g.beamY - 8, g.xEnd - x0 + 48, 8);
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(0, floor, view.w - g.barsW, view.h - floor);
    ctx.fillStyle = COLORS.muted;
    ctx.fillRect(0, floor, view.w - g.barsW, 2);
    label(ctx, small ? "Không theo tỉ lệ; g = 10 m/s²" : "Hình vẽ không theo tỉ lệ; lấy g = 10 m/s²", 6, view.h - (small ? 10 : 16), { size: 11, color: COLORS.muted });

    // target height and the ruler on the left
    const yTarget = floor - s.target * g.ppm;
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    line(ctx, 6, yTarget, view.w - g.barsW - 6, yTarget);
    ctx.setLineDash([]);
    label(ctx, small ? `${fmt(s.target, 1)} m` : `độ cao cần nâng ${fmt(s.target, 1)} m`, 8, yTarget - 9, { size: 11, color: COLORS.green });
    const loadBottom = g.loadTop + g.lh;
    if (r.height > 0) {
      const xr = g.loadX - g.lw / 2 - 16;
      arrow(ctx, xr, floor, xr, loadBottom, COLORS.blue, 2);
      label(ctx, `h`, xr - 8, (floor + loadBottom) / 2, { size, bold: true, color: COLORS.blue, align: "right" });
    }

    // rope
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2.5;
    if (n === 0) {
      line(ctx, x0, yF, x0, g.loadTop);
      line(ctx, g.xEnd, yF, g.xEnd, g.hand);
      ctx.beginPath();
      ctx.arc(x0 + g.r, yF, g.r, Math.PI, 0);
      ctx.stroke();
    } else {
      for (let j = 0; j < 2 * n; j++) line(ctx, x0 + 2 * j * g.r, j ? yF : g.beamY, x0 + 2 * j * g.r, yM);
      line(ctx, g.xEnd, yF, g.xEnd, g.hand);
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(x0 + (4 * i + 1) * g.r, yM, g.r, 0, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x0 + (4 * i + 3) * g.r, yF, g.r, Math.PI, 0);
        ctx.stroke();
      }
    }
    // marks on the free end slide down as rope is pulled
    ctx.fillStyle = COLORS.ink;
    const gap = 18;
    for (let y = yF + ((r.rope * g.ppm) % gap); y < g.hand - 4; y += gap) ctx.fillRect(g.xEnd - 3, y, 6, 2);

    // pulleys: fixed ones hang from the beam, movable ones share the lower block
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    const fixedX = n ? Array.from({ length: n }, (_, i) => x0 + (4 * i + 3) * g.r) : [x0 + g.r];
    for (const x of fixedX) {
      line(ctx, x, g.beamY, x, yF);
      pulley(ctx, x, yF, g.r);
    }
    if (n) {
      const xs = Array.from({ length: n }, (_, i) => x0 + (4 * i + 1) * g.r);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 3;
      line(ctx, xs[0], yM, xs.at(-1), yM);
      line(ctx, g.loadX, yM, g.loadX, g.loadTop);
      for (const x of xs) pulley(ctx, x, yM, g.r);
    }

    // load
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.roundRect(g.loadX - g.lw / 2, g.loadTop, g.lw, g.lh, 4);
    ctx.fill();
    label(ctx, `${fmt(s.mass, 0)} kg`, g.loadX, g.loadTop + g.lh / 2, { color: "#fff", bold: true, size: small ? 11 : 13, align: "center" });

    // forces: P beside the load, F along the free end, same scale
    const lenP = small ? 44 : 70;
    const scaleF = lenP / Math.max(r.P, r.force);
    const px = g.loadX - g.lw / 2 - 6;
    const py = g.loadTop + 4;
    arrow(ctx, px - (r.height > 0 ? 18 : 0), py, px - (r.height > 0 ? 18 : 0), py + r.P * scaleF, COLORS.red, 3);
    label(ctx, `P = ${fmt(r.P, 0)} N`, px - (r.height > 0 ? 24 : 6), py + 6, { size, bold: true, color: COLORS.red, align: "right" });
    const fy = Math.max(yF + g.r + 8, g.hand - 8 - r.force * scaleF);
    arrow(ctx, g.xEnd + 10, fy, g.xEnd + 10, fy + r.force * scaleF, COLORS.purple, 3);
    label(ctx, `F = ${fmt(r.force, 1)} N`, g.xEnd + 16, fy + 4, { size, bold: true, color: COLORS.purple });

    // hand
    ctx.fillStyle = "#f3c9a5";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(g.xEnd, g.hand, small ? 8 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawBars(ctx, s, g, r, view);
  },
});
