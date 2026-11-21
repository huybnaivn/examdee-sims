import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  initialState, step, ready, launch, flightTime, range, impactSpeed, positionAt, hit, strobeInterval, TOLERANCE,
} from "./model.js";

// Same scale on both axes so the parabola has its true shape. O is the launch point, Oy points down.
function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const m = { l: small ? 46 : 80, r: small ? 12 : 28, t: small ? 54 : 72, b: small ? 34 : 50 };
  const W = Math.max(range(s), s.target + TOLERANCE + 1, 8) * 1.04;
  const scale = Math.min((view.w - m.l - m.r) / W, (view.h - m.t - m.b) / s.height);
  const X = x => m.l + x * scale;
  const Y = y => view.h - m.b - (s.height - y) * scale; // ground sits on the bottom margin
  return { small, X, Y, dropX: X(0) - (small ? 24 : 34), r: small ? 6 : 8 };
}

const ball = (ctx, x, y, r, color, alpha = 1) => {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

const fire = (s, api) => {
  launch(s);
  api.emit("launch", { speed: s.speed, height: s.height, gravity: s.gravity });
};

const rearm = (s, api) => {
  ready(s);
  api.pause();
};

mount({
  slug: "nem-ngang",
  version: "1.0.0",
  title: "Chuyển động ném ngang",
  hint: "Chọn độ cao và vận tốc ném rồi nhấn Ném. Bi A được ném ngang, bi B được thả rơi cùng lúc. Hãy ném trúng giỏ trên mặt đất.",
  initialState,
  step(s, dt, api) {
    if (s.phase !== "flying") fire(s, api); // "Chạy" or "Bước" on a waiting or finished throw throws again
    if (step(s, dt) !== "landed") return;
    api.pause();
    api.emit("landed", { time: s.time, range: s.x, impactSpeed: Math.hypot(s.vx, s.vy), theoryTime: flightTime(s), theoryRange: range(s) }, "result");
    if (hit(s)) api.emit("hit-target", { range: s.x, target: s.target, speed: s.speed, height: s.height }, "goal");
  },
  controls: [
    { type: "button", label: "Ném", primary: true, action: (s, api) => (fire(s, api), api.play()) },
    { type: "slider", key: "speed", label: "Vận tốc ném v₀", min: 1, max: 25, step: 0.5, unit: "m/s", digits: 1, onChange: rearm },
    { type: "slider", key: "height", label: "Độ cao h", min: 2, max: 45, step: 1, unit: "m", digits: 0, onChange: rearm },
    {
      type: "select",
      key: "gravity",
      label: "Nơi ném",
      onChange: rearm,
      options: [
        { value: 9.81, label: "Trái Đất (g = 9,81 m/s²)" },
        { value: 1.62, label: "Mặt Trăng (g = 1,62 m/s²)" },
      ],
    },
    { type: "slider", key: "target", label: "Vị trí giỏ (tâm)", min: 4, max: 70, step: 0.5, unit: "m", digits: 1 },
    { type: "checkbox", key: "showStrobe", label: "Hiện ảnh hoạt nghiệm" },
    { type: "checkbox", key: "showDropped", label: "Thả rơi bi B cùng lúc" },
    { type: "checkbox", key: "showVectors", label: "Hiện vectơ vận tốc và hai thành phần" },
  ],
  readouts: [
    { label: "Thời gian t", value: s => `${fmt(s.time)} s` },
    { label: "Tọa độ x = v₀t", value: s => `${fmt(s.x, 1)} m` },
    { label: "Tọa độ y = ½gt²", value: s => `${fmt(s.y, 1)} m` },
    { label: "Thời gian rơi √(2h/g)", value: s => `${fmt(flightTime(s))} s` },
    { label: "Tầm xa L = v₀√(2h/g)", value: s => `${fmt(range(s), 1)} m` },
    { label: "Tốc độ chạm đất √(v₀² + 2gh)", value: s => `${fmt(impactSpeed(s), 1)} m/s` },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { X, Y, small, r } = g;
    const size = small ? 11 : 13;
    const ox = X(0);
    const oy = Y(0);
    const gy = Y(s.height);
    const t = clamp(s.time, 0, flightTime(s));
    const cur = s.phase === "ready" ? { x: 0, y: 0 } : positionAt(s, t);

    // ground
    ctx.fillStyle = "#e6efe0";
    ctx.fillRect(0, gy, view.w, view.h - gy);
    ctx.strokeStyle = "#7da06a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(view.w, gy);
    ctx.stroke();

    // ledge under A and a holder for B
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(ox - (small ? 14 : 20), oy + r, small ? 16 : 22, 4);
    ctx.fillRect(ox - (small ? 12 : 17), oy + r + 4, 3, gy - oy - r - 4);
    if (s.showDropped) {
      ctx.fillRect(g.dropX - 1, oy - r - 12, 2, 8);
      label(ctx, "B", g.dropX - r - 4, oy - r - 6, { size, bold: true, color: COLORS.orange, align: "right" });
    }

    // axes: Ox along the launch level, Oy down
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    arrow(ctx, ox, oy, X(0) + (view.w - X(0)) - 6, oy, COLORS.muted, 1.2);
    arrow(ctx, ox, oy, ox, gy + (small ? 20 : 30), COLORS.muted, 1.2);
    label(ctx, "x", view.w - 10, oy - 9, { size, color: COLORS.muted, align: "center" });
    label(ctx, "y", ox + 9, gy + (small ? 22 : 30), { size, color: COLORS.muted });
    label(ctx, "O", ox + 4, oy - 12, { size, color: COLORS.muted });
    label(ctx, `h = ${fmt(s.height)} m`, ox + 8, gy - 11, { size, color: COLORS.muted });

    // target basket
    const won = s.phase === "landed" && hit(s);
    const bx0 = X(s.target - TOLERANCE);
    const bx1 = X(s.target + TOLERANCE);
    const bh = small ? 8 : 12;
    ctx.strokeStyle = won ? COLORS.green : COLORS.red;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx0, gy - bh);
    ctx.lineTo(bx0, gy);
    ctx.lineTo(bx1, gy);
    ctx.lineTo(bx1, gy - bh);
    ctx.stroke();
    label(ctx, won ? "Trúng giỏ!" : "Giỏ", (bx0 + bx1) / 2, gy + (small ? 12 : 16), { size, bold: true, align: "center", color: won ? COLORS.green : COLORS.red });

    // path traced so far: y = g·x²/(2v₀²)
    if (s.phase !== "ready") {
      ctx.strokeStyle = COLORS.blue;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const p = positionAt(s, (t * i) / 60);
        i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // strobe images every Δt: equal steps along x, growing steps along y, A level with B
    if (s.showStrobe && s.phase !== "ready") {
      const d = strobeInterval(s);
      for (let k = 1; k * d <= t + 1e-9; k++) {
        const p = positionAt(s, k * d);
        if (s.showDropped) {
          ctx.strokeStyle = COLORS.grid;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(g.dropX, Y(p.y));
          ctx.lineTo(X(p.x), Y(p.y));
          ctx.stroke();
          ctx.setLineDash([]);
          ball(ctx, g.dropX, Y(p.y), r * 0.8, COLORS.orange, 0.35);
        }
        ball(ctx, X(p.x), Y(p.y), r * 0.8, COLORS.blue, 0.35);
        // projections on the axes
        ctx.strokeStyle = COLORS.blue;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(X(p.x), oy - 4);
        ctx.lineTo(X(p.x), oy + 4);
        ctx.moveTo(ox - 4, Y(p.y));
        ctx.lineTo(ox + 4, Y(p.y));
        ctx.stroke();
      }
      const note = small ? `Ảnh cách nhau Δt = ${fmt(d)} s` : `Ảnh hoạt nghiệm cách nhau Δt = ${fmt(d)} s (vạch xanh: hình chiếu lên Ox, Oy)`;
      label(ctx, note, view.w - 8, small ? 30 : 14, { size: small ? 10 : 12, color: COLORS.muted, align: "right" });
    }

    // balls now
    if (s.showDropped) ball(ctx, g.dropX, Y(cur.y), r, COLORS.orange);
    ball(ctx, X(cur.x), Y(cur.y), r, COLORS.blue);
    label(ctx, "A", X(cur.x) + r + 3, Y(cur.y) - r - 5, { size, bold: true, color: COLORS.blue });

    if (s.showVectors) {
      const k = small ? 2.2 : 3.2; // px per m/s
      const ax = X(cur.x);
      const ay = Y(cur.y);
      const vy = s.phase === "ready" ? 0 : s.gravity * t;
      arrow(ctx, ax, ay, ax + s.speed * k, ay, COLORS.blue, 2);
      arrow(ctx, ax, ay, ax, ay + vy * k, COLORS.red, 2);
      arrow(ctx, ax, ay, ax + s.speed * k, ay + vy * k, COLORS.green, 2.5);
      label(ctx, "vx", ax + s.speed * k + 4, ay - 8, { size, color: COLORS.blue, bold: true });
      if (vy > 1) label(ctx, "vy", ax - 6, ay + vy * k, { size, color: COLORS.red, bold: true, align: "right" });
      label(ctx, "v", ax + s.speed * k + 6, ay + vy * k + 4, { size, color: COLORS.green, bold: true });
    }

    // what happened
    const lines =
      s.phase === "landed"
        ? [`Chạm đất sau t = ${fmt(s.time)} s, tầm xa L = ${fmt(s.x, 1)} m`, s.showDropped ? "A và B chạm đất cùng lúc" : ""]
        : s.phase === "ready"
          ? ["Nhấn Ném để bắt đầu"]
          : [`t = ${fmt(s.time)} s`];
    lines.forEach((text, i) => text && label(ctx, text, small ? 8 : 12, (small ? 12 : 18) + i * (small ? 18 : 22), {
      size: small ? 11 : 14, bold: i === 0, color: i ? COLORS.muted : COLORS.ink,
    }));
    if (!small && s.phase !== "ready") label(ctx, "Quỹ đạo: y = g·x²/(2v₀²)", view.w - 8, 36, { size: 13, color: COLORS.blue, align: "right" });
  },
});
