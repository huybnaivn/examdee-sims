import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  P0, TANK_DEPTH, BRANCHES, BRANCH_H, PIPE, MIN_VOLUME, MAX_VOLUME, initialState, specificWeight, gaugePressure, pressure,
  branchVolume, vesselLevel, readingDepth,
} from "./model.js";

const LIQUID = "rgba(47, 111, 237, 0.28)";
const isTank = s => s.mode === "tank";
const isSmall = view => view.w < 520 || view.h < 420;
const pa = value => `${fmt(value, 0)} Pa`;

// Tank on the left, graph on the right; both use the same vertical depth scale.
function tankGeom(view) {
  const small = isSmall(view);
  const top = small ? 44 : 84;
  const bottom = small ? 36 : 64;
  const left = small ? 30 : 64;
  const gap = small ? 26 : 64;
  const avail = Math.min(view.w - left - (small ? 14 : 40) - gap, 800);
  const tw = avail * 0.5;
  const air = small ? 12 : 28; // air above the free surface
  const surface = top + air;
  const floor = view.h - bottom;
  return { small, top, tx: left, tw, gx: left + tw + gap, gw: avail - tw, surface, floor, sc: (floor - surface) / TANK_DEPTH };
}

const niceMax = x => {
  const e = 10 ** Math.floor(Math.log10(x));
  return [1, 2, 5, 10].find(m => m * e >= x) * e;
};

const dashed = (ctx, x1, y1, x2, y2, color = COLORS.muted) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
};

function drawTank(ctx, s, view) {
  const g = tankGeom(view);
  const { small, tx, tw, gx, gw, surface, floor, sc } = g;
  const size = small ? 11 : 13;
  const p = pressure(s);
  const py = surface + s.depth * sc;
  const px = tx + clamp(s.probeX, 0, 1) * tw;

  // heading: the formula, then the same line with numbers
  const formula = s.atmosphere ? "p = p₀ + ρ·g·h" : "p = d·h = ρ·g·h";
  const numbers = `${s.atmosphere ? `${fmt(P0, 0)} + ` : ""}${fmt(s.density, 0)} · ${fmt(s.gravity)} · ${fmt(s.depth)} = ${pa(p)}`;
  if (small) {
    label(ctx, `${formula} = ${pa(p)}`, view.w / 2, 12, { align: "center", size: 13, bold: true });
    label(ctx, "Cùng độ sâu thì cùng áp suất", view.w / 2, 29, { align: "center", size: 11, color: COLORS.muted });
  } else {
    label(ctx, formula, view.w / 2, 24, { align: "center", size: 18, bold: true });
    label(ctx, `p = ${numbers}`, view.w / 2, 50, { align: "center", size: 14, color: COLORS.muted });
  }

  // liquid and tank
  ctx.fillStyle = LIQUID;
  ctx.fillRect(tx, surface, tw, floor - surface);
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx, surface);
  ctx.lineTo(tx + tw, surface);
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(tx, g.top);
  ctx.lineTo(tx, floor);
  ctx.lineTo(tx + tw, floor);
  ctx.lineTo(tx + tw, g.top);
  ctx.stroke();

  // depth scale shared by the tank and the graph
  ctx.lineWidth = 1;
  for (let h = 0; h <= TANK_DEPTH + 1e-9; h += 0.5) {
    const y = surface + h * sc;
    ctx.strokeStyle = COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(tx - 6, y);
    ctx.lineTo(tx, y);
    ctx.stroke();
    label(ctx, fmt(h, 1), tx - 9, y, { align: "right", size, color: COLORS.muted });
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + gw, y);
    ctx.stroke();
  }
  label(ctx, "h (m)", small ? 2 : tx - 4, g.top - (small ? 2 : 8), { align: small ? "left" : "right", size, color: COLORS.muted });

  // graph: pressure to the right, depth downwards
  const pMax = niceMax(pressure(s, TANK_DEPTH));
  const X = value => gx + (value / pMax) * gw;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(gx, surface);
  ctx.lineTo(gx, floor);
  ctx.lineTo(gx + gw, floor);
  ctx.stroke();
  for (const f of [0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(X(f * pMax), floor);
    ctx.lineTo(X(f * pMax), floor + 5);
    ctx.stroke();
    label(ctx, fmt((f * pMax) / 1000, 1), X(f * pMax), floor + 14, { align: f === 1 ? "right" : f ? "center" : "left", size, color: COLORS.muted });
  }
  label(ctx, "p (kPa)", gx + gw / 2, floor + (small ? 27 : 34), { align: "center", size, color: COLORS.muted });
  if (!small) label(ctx, "Đồ thị áp suất theo độ sâu", gx + gw / 2, g.top - 8, { align: "center", size: 13, color: COLORS.muted });
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(X(pressure(s, 0)), surface);
  ctx.lineTo(X(pressure(s, TANK_DEPTH)), floor);
  ctx.stroke();
  ctx.lineCap = "butt";

  // the probe's depth carried across the tank and onto the graph
  dashed(ctx, tx, py, X(p), py, COLORS.orange);
  dashed(ctx, X(p), py, X(p), floor, COLORS.orange);
  ctx.fillStyle = COLORS.orange;
  ctx.beginPath();
  ctx.arc(X(p), py, 5, 0, Math.PI * 2);
  ctx.fill();

  // a second point at the same depth reads the same
  const mirror = tx + (1 - clamp(s.probeX, 0, 1)) * tw;
  if (Math.abs(mirror - px) > (small ? 40 : 110)) {
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mirror, py, 6, 0, Math.PI * 2);
    ctx.stroke();
    if (!small) label(ctx, "cùng độ sâu, cùng p", mirror, py + 18, { align: "center", size: 12, color: COLORS.muted });
  }

  // probe and its reading
  ctx.fillStyle = COLORS.orange;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, small ? 8 : 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const text = `p = ${pa(p)}`;
  ctx.font = `600 ${size + 1}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const bw = ctx.measureText(text).width + 12;
  const bx = clamp(px - bw / 2, tx + 4, tx + tw - bw - 4);
  const by = py - 36 > g.top ? py - 36 : py + 14; // above the probe, or below when it is near the surface
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(bx, by, bw, 22);
  ctx.fill();
  ctx.stroke();
  label(ctx, text, bx + bw / 2, by + 11.5, { align: "center", size: size + 1, bold: true });

  if (!small) {
    const note = s.atmosphere ? `Tính cả áp suất khí quyển p₀ = ${pa(P0)} (giá trị chuẩn ở mặt đất).` : "Chỉ tính áp suất do chất lỏng gây ra.";
    label(ctx, `${note} Kéo đầu đo sang ngang: số đo không đổi.`, view.w / 2, view.h - 14, { align: "center", size: 12, color: COLORS.muted });
  }
}

function drawVessels(ctx, s, view) {
  const small = isSmall(view);
  const top = small ? 46 : 84;
  const bottom = small ? 44 : 84;
  const worldW = 10.4;
  const worldH = PIPE.h + BRANCH_H;
  const sc = Math.min((view.w - (small ? 16 : 60)) / worldW, (view.h - top - bottom) / worldH);
  const x0 = (view.w - worldW * sc) / 2;
  const base = top + (view.h - top - bottom + worldH * sc) / 2; // bottom of the pipe
  const X = dm => x0 + dm * sc;
  const Y = dm => base - dm * sc; // dm above the bottom of the pipe
  const level = vesselLevel(s.volume);
  const size = small ? 11 : 13;

  const edge = (b, y, side) => [X(b.x + b.lean * y + (side * (b.w0 + b.k * y)) / 2), Y(PIPE.h + y)];
  const interior = () => {
    ctx.beginPath();
    ctx.rect(X(PIPE.x0), Y(PIPE.h) - 1, (PIPE.x1 - PIPE.x0) * sc, PIPE.h * sc + 1);
    for (const b of BRANCHES) {
      ctx.moveTo(...edge(b, 0, -1));
      ctx.lineTo(...edge(b, BRANCH_H, -1));
      ctx.lineTo(...edge(b, BRANCH_H, 1));
      ctx.lineTo(...edge(b, 0, 1));
      ctx.closePath();
    }
  };

  label(ctx, small ? "Bình thông nhau: các mực bằng nhau" : "Bình thông nhau", view.w / 2, small ? 12 : 24, { align: "center", size: small ? 13 : 18, bold: true });
  label(
    ctx,
    small ? "Cùng một chất lỏng, đứng yên" : "Chứa cùng một chất lỏng đứng yên: mặt thoáng ở các nhánh ở cùng một độ cao, dù hình dạng nhánh khác nhau.",
    view.w / 2, small ? 29 : 50, { align: "center", size: small ? 11 : 14, color: COLORS.muted }
  );

  // walls: thick strokes, then the inside is painted over so the joints with the pipe are open
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = small ? 4 : 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "butt";
  ctx.strokeRect(X(PIPE.x0), Y(PIPE.h), (PIPE.x1 - PIPE.x0) * sc, PIPE.h * sc);
  ctx.beginPath();
  for (const b of BRANCHES) {
    for (const side of [-1, 1]) {
      ctx.moveTo(...edge(b, 0, side));
      ctx.lineTo(...edge(b, BRANCH_H, side));
    }
  }
  ctx.stroke();
  ctx.fillStyle = COLORS.bg;
  interior();
  ctx.fill();

  // liquid: everything inside the vessel below the common level
  ctx.save();
  interior();
  ctx.clip();
  ctx.fillStyle = LIQUID;
  ctx.fillRect(0, Y(PIPE.h + level), view.w, view.h);
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, Y(PIPE.h + level));
  ctx.lineTo(view.w, Y(PIPE.h + level));
  ctx.stroke();
  ctx.restore();
  dashed(ctx, X(0), Y(PIPE.h + level), X(worldW), Y(PIPE.h + level));

  BRANCHES.forEach(b => {
    label(ctx, `${fmt(branchVolume(b, level), 1)} L`, X(b.x), base + (small ? 12 : 16), { align: "center", size, bold: true, color: COLORS.blue });
  });
  const p = pressure(s, readingDepth(s));
  label(
    ctx,
    small
      ? `Mực chung ${fmt(level + PIPE.h)} dm · áp suất ở đáy ${pa(p)}`
      : `Mỗi nhánh chứa một lượng chất lỏng khác nhau nhưng mực chung đều cao ${fmt(level + PIPE.h)} dm so với đáy; áp suất ở đáy: p = ${pa(p)}.`,
    view.w / 2, base + (small ? 30 : 44), { align: "center", size: small ? 11 : 13, color: COLORS.muted }
  );
}

const probeFromPointer = (p, s, view) => {
  const g = tankGeom(view);
  s.probeX = clamp(Math.round(((p.x - g.tx) / g.tw) * 100) / 100, 0, 1);
  s.depth = clamp(Math.round(((p.y - g.surface) / g.sc) * 100) / 100, 0, TANK_DEPTH);
};

mount({
  slug: "ap-suat-chat-long",
  version: "1.0.0",
  title: "Áp suất chất lỏng",
  hint: "Kéo đầu đo (chấm cam) trong bình để đo áp suất ở các độ sâu khác nhau.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Thí nghiệm",
      options: [
        { value: "tank", label: "Bình chất lỏng và đầu đo áp suất" },
        { value: "vessels", label: "Bình thông nhau" },
      ],
    },
    { type: "slider", key: "depth", label: "Độ sâu của đầu đo h", min: 0, max: TANK_DEPTH, step: 0.05, unit: "m", visible: isTank },
    {
      type: "slider", key: "probeX", label: "Vị trí ngang của đầu đo", min: 0, max: 1, step: 0.05, visible: isTank,
      format: v => `${fmt(v * 100, 0)} %`,
    },
    { type: "slider", key: "volume", label: "Lượng chất lỏng", min: MIN_VOLUME, max: MAX_VOLUME, step: 0.5, unit: "L", digits: 1, visible: s => !isTank(s) },
    { type: "slider", key: "density", label: "Khối lượng riêng ρ", min: 500, max: 2000, step: 50, unit: "kg/m³", digits: 0 },
    {
      type: "select",
      key: "gravity",
      label: "Gia tốc trọng trường g",
      options: [
        { value: 10, label: "Trái Đất, lấy tròn g = 10 m/s²" },
        { value: 9.81, label: "Trái Đất (g = 9,81 m/s²)" },
        { value: 1.62, label: "Mặt Trăng (g = 1,62 m/s²)" },
        { value: 3.71, label: "Sao Hỏa (g = 3,71 m/s²)" },
        { value: 24.79, label: "Sao Mộc (g = 24,79 m/s²)" },
      ],
    },
    { type: "checkbox", key: "atmosphere", label: "Tính cả áp suất khí quyển p₀" },
  ],
  readouts: [
    { label: "Trọng lượng riêng d = ρ·g", value: s => `${fmt(specificWeight(s), 0)} N/m³` },
    { label: "Độ sâu điểm đo h", value: s => `${fmt(readingDepth(s), 3)} m` },
    { label: "Áp suất chất lỏng d·h", value: s => pa(gaugePressure(s, readingDepth(s))) },
    { label: "Áp suất tại điểm đo", value: s => pa(pressure(s, readingDepth(s))) },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = tankGeom(view);
      if (!isTank(s) || p.x < g.tx - 12 || p.x > g.tx + g.tw + 12 || p.y < g.surface - 16 || p.y > g.floor + 12) return false;
      probeFromPointer(p, s, view);
    },
    move: (p, s, api, view) => probeFromPointer(p, s, view),
    up(p, s, api) {
      // One measurement per release.
      const data = { depth: s.depth, pressure: pressure(s), gaugePressure: gaugePressure(s), x: s.probeX };
      api.emit("probe-released", data, "result");
    },
  },
  draw(ctx, s, view) {
    if (isTank(s)) drawTank(ctx, s, view);
    else drawVessels(ctx, s, view);
  },
});
