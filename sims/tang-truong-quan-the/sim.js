import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, expN, logisticN, rate, msy, timeToHalfK, harvested, finalN, atMsy } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// One result per finished change, and the goal once per (r, K) when the harvest is set to rK/4.
function report(s, api) {
  api.emit("growth-computed", { timeToHalfK: timeToHalfK(s.N0, s.r, s.K), finalN: finalN(s), harvest: s.harvest ? s.H : 0, msy: msy(s.r, s.K) }, "result");
  const key = `${s.r}|${s.K}`;
  if (atMsy(s) && s._goalKey !== key) {
    s._goalKey = key;
    api.emit("msy-found", { harvest: s.H, msy: msy(s.r, s.K) }, "goal");
  }
}

const extinctAt = s => (s.harvest ? harvested(s.N0, s.r, s.K, s.H, s.tMax).find(p => p[1] === 0)?.[0] : undefined);

function niceStep(range, ticks) {
  const raw = range / ticks;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(v => v >= raw);
}

/** Axes for a box; returns world → screen mappers. */
function axes(ctx, box, xr, yr, xName, yName, small) {
  const X = x => box.x + ((x - xr[0]) / (xr[1] - xr[0])) * box.w;
  const Y = y => box.y + box.h - ((y - yr[0]) / (yr[1] - yr[0])) * box.h;
  const size = small ? 10 : 12;
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.grid;
  const dx = niceStep(xr[1] - xr[0], small ? 4 : 6);
  const dy = niceStep(yr[1] - yr[0], small ? 4 : 5);
  for (let x = Math.ceil(xr[0] / dx) * dx; x <= xr[1] + 1e-9; x += dx) {
    ctx.beginPath();
    ctx.moveTo(X(x), box.y);
    ctx.lineTo(X(x), box.y + box.h);
    ctx.stroke();
    label(ctx, fmt(x, 1), X(x), box.y + box.h + 9, { size, align: "center", color: COLORS.muted });
  }
  for (let y = Math.ceil(yr[0] / dy) * dy; y <= yr[1] + 1e-9; y += dy) {
    ctx.beginPath();
    ctx.moveTo(box.x, Y(y));
    ctx.lineTo(box.x + box.w, Y(y));
    ctx.stroke();
    label(ctx, fmt(y, 1), box.x - 4, Y(y), { size, align: "right", color: COLORS.muted });
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.stroke();
  if (yr[0] < 0) {
    ctx.beginPath();
    ctx.moveTo(box.x, Y(0));
    ctx.lineTo(box.x + box.w, Y(0));
    ctx.stroke();
  }
  label(ctx, xName, box.x + box.w, box.y + box.h + (small ? 21 : 24), { size, align: "right", color: COLORS.ink, bold: true });
  label(ctx, yName, box.x + 4, box.y - (small ? 8 : 10), { size, color: COLORS.ink, bold: true });
  return { X, Y };
}

function curve(ctx, box, map, pts, color, dash = []) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y - 2, box.w, box.h + 4);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(map.X(x), map.Y(y)) : ctx.moveTo(map.X(x), map.Y(y))));
  ctx.stroke();
  ctx.restore();
}

function hline(ctx, box, map, y, color, text, size) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(box.x, map.Y(y));
  ctx.lineTo(box.x + box.w, map.Y(y));
  ctx.stroke();
  ctx.restore();
  label(ctx, text, box.x + box.w - 2, map.Y(y) - 7, { size, align: "right", color, bold: true });
}

function dot(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function legend(ctx, items, x, y, size) {
  ctx.font = `${size}px ${FONT}`;
  const w = Math.max(...items.map(i => ctx.measureText(i[0]).width)) + 30;
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fillRect(x - 4, y - size / 2 - 3, w, items.length * (size + 5) + 2);
  items.forEach(([text, color, dash], k) => {
    const yy = y + k * (size + 5);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + 18, yy);
    ctx.stroke();
    ctx.restore();
    label(ctx, text, x + 23, yy, { size, color: COLORS.ink });
  });
}

mount({
  slug: "tang-truong-quan-the",
  version: "1.0.0",
  title: "Tăng trưởng quần thể",
  hint: "So sánh đường cong chữ J và chữ S. Bật khai thác rồi tìm mức khai thác lớn nhất mà quần thể không bị diệt vong.",
  initialState,
  controls: [
    { type: "slider", key: "N0", label: "Kích thước ban đầu N₀", min: 1, max: 2000, step: 1, unit: "cá thể", digits: 0 },
    { type: "slider", key: "r", label: "Tốc độ tăng trưởng nội tại r", min: 0.05, max: 1.5, step: 0.05, unit: "/năm" },
    { type: "slider", key: "K", label: "Sức chứa của môi trường K", min: 100, max: 2000, step: 50, unit: "cá thể", digits: 0 },
    { type: "slider", key: "tMax", label: "Thời gian quan sát", min: 5, max: 100, step: 5, unit: "năm", digits: 0 },
    { type: "heading", label: "Khai thác" },
    { type: "checkbox", key: "harvest", label: "Khai thác một lượng cố định mỗi năm" },
    { type: "slider", key: "H", label: "Lượng khai thác H", min: 0, max: 750, step: 1, unit: "cá thể/năm", digits: 0, visible: s => s.harvest },
  ].map(c => (c.key ? { ...c, onCommit: report } : c)),
  readouts: [
    { label: "N sau thời gian quan sát (chữ J)", value: s => `${fmt(expN(s.N0, s.r, s.tMax), 0)} cá thể` },
    { label: "N sau thời gian quan sát (chữ S)", value: s => `${fmt(logisticN(s.N0, s.r, s.K, s.tMax), 0)} cá thể` },
    { label: "Thời gian đạt K/2 (chữ S)", value: s => `${fmt(timeToHalfK(s.N0, s.r, s.K), 1)} năm` },
    { label: "Tốc độ tăng cực đại rK/4 (tại N = K/2)", value: s => `${fmt(msy(s.r, s.K), 1)} cá thể/năm` },
    {
      label: "Khi khai thác",
      value: s => {
        if (!s.harvest) return "–";
        const t = extinctAt(s);
        if (t !== undefined) return `diệt vong sau ${fmt(t, 1)} năm`;
        return `còn ${fmt(finalN(s), 0)} cá thể${s.H > msy(s.r, s.K) ? " (vẫn đang giảm)" : ""}`;
      },
    },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 450;
    const size = small ? 10 : 12;
    const wide = view.w > view.h * 1.4;
    const pad = { l: small ? 40 : 54, r: small ? 10 : 18, t: small ? 20 : 30, b: small ? 28 : 36 };
    const gap = small ? 8 : 20;
    const boxes = wide
      ? [0, 1].map(i => {
          const w = (view.w - gap) / 2;
          return { x: i * (w + gap) + pad.l, y: pad.t, w: w - pad.l - pad.r, h: view.h - pad.t - pad.b - (small ? 14 : 22) };
        })
      : [0, 1].map(i => {
          const h = (view.h - gap - (small ? 12 : 20)) / 2;
          return { x: pad.l, y: i * (h + gap) + pad.t, w: view.w - pad.l - pad.r, h: h - pad.t - pad.b };
        });
    const [A, B] = boxes;
    const K = s.K;
    const nMax = Math.max(K, s.N0) * 1.15;
    const m = msy(s.r, K);
    const half = K / 2;
    const teal = "#0e9aa7";

    // N(t)
    const map1 = axes(ctx, A, [0, s.tMax], [0, nMax], "t (năm)", "N (cá thể)", small);
    hline(ctx, A, map1, K, COLORS.green, "K", size + 1);
    hline(ctx, A, map1, half, COLORS.muted, "K/2", size);
    const ts = Array.from({ length: 301 }, (_, i) => (i / 300) * s.tMax);
    curve(ctx, A, map1, ts.map(t => [t, expN(s.N0, s.r, t)]), COLORS.orange);
    curve(ctx, A, map1, ts.map(t => [t, logisticN(s.N0, s.r, K, t)]), COLORS.blue, s.harvest ? [6, 4] : []);
    if (s.harvest) curve(ctx, A, map1, harvested(s.N0, s.r, K, s.H, s.tMax), COLORS.red);
    const th = timeToHalfK(s.N0, s.r, K);
    if (s.N0 < half && th <= s.tMax) dot(ctx, map1.X(th), map1.Y(half), COLORS.blue);
    legend(
      ctx,
      [["Chữ J: N₀eʳᵗ", COLORS.orange], ["Chữ S (logistic)", COLORS.blue, s.harvest ? [6, 4] : []], ...(s.harvest ? [["Chữ S có khai thác H", COLORS.red]] : [])],
      A.x + 8,
      A.y + 8,
      size
    );

    // dN/dt against N
    const yHi = Math.max(m, s.harvest ? s.H : 0) * 1.3;
    const map2 = axes(ctx, B, [0, nMax], [-0.35 * yHi, yHi], "N (cá thể)", "dN/dt (cá thể/năm)", small);
    const ns = Array.from({ length: 301 }, (_, i) => (i / 300) * nMax);
    curve(ctx, B, map2, ns.map(n => [n, s.r * n]), COLORS.orange);
    curve(ctx, B, map2, ns.map(n => [n, rate(n, s.r, K)]), COLORS.blue);
    if (s.harvest) hline(ctx, B, map2, s.H, COLORS.red, `H = ${fmt(s.H, 0)}`, size);
    // vertex of the parabola: fastest growth
    ctx.save();
    ctx.strokeStyle = teal;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(map2.X(half), map2.Y(0));
    ctx.lineTo(map2.X(half), map2.Y(m));
    ctx.stroke();
    ctx.restore();
    dot(ctx, map2.X(half), map2.Y(m), teal);
    label(ctx, `N = K/2, dN/dt = rK/4 = ${fmt(m, 1)}`, map2.X(half), map2.Y(m) - 12, { size, align: "center", color: teal, bold: true });
    label(ctx, "K", map2.X(K), map2.Y(0) + 9, { size, align: "center", color: COLORS.green, bold: true });

    const note = s.harvest
      ? s.H > m
        ? "H > rK/4: dN/dt < 0 với mọi N, quần thể bị diệt vong."
        : "Giao điểm của parabol và đường H là các trạng thái cân bằng."
      : "Mô hình liên tục, không xét tuổi và giới tính.";
    label(ctx, note, 8, view.h - (small ? 7 : 10), { size, color: s.harvest && s.H > m ? COLORS.red : COLORS.muted });
  },
});
