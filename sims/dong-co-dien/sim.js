import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, torque, forces, sideForce, peakTorque, restartTiming } from "./model.js";

const TAU = Math.PI * 2;
const deg = r => (r * 180) / Math.PI;

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const top = small ? 22 : 64;
  const bottom = small ? 58 : 96; // battery row and notes
  const R = Math.max(30, Math.min((view.h - top - bottom) / 2.6, (view.w - (small ? 150 : 260)) / 2.6));
  return { small, R, cx: view.w / 2, cy: top + 1.3 * R, mw: Math.max(24, R * 0.4), size: small ? 12 : 14 };
}

function magnet(ctx, x, y, w, h, north, size) {
  ctx.fillStyle = north ? COLORS.red : COLORS.blue;
  ctx.fillRect(x, y, w, h);
  label(ctx, north ? "N" : "S", x + w / 2, y + h / 2, { color: "#fff", bold: true, size: size + 6, align: "center" });
}

function sideMark(ctx, x, y, r, out) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = ctx.fillStyle = COLORS.ink;
  ctx.lineWidth = 2;
  if (out) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.3, 0, TAU);
    ctx.fill();
  } else {
    const c = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - c, y - c);
    ctx.lineTo(x + c, y + c);
    ctx.moveTo(x + c, y - c);
    ctx.lineTo(x - c, y + c);
    ctx.stroke();
  }
}

// Each finished revolution is one result; the model reports it.
function advance(s, dt, api) {
  const rev = step(s, dt);
  if (rev) {
    api.emit("revolution", { period: rev.period, averageTorque: Math.abs(rev.torque), speed: 1 / rev.period, direction: rev.direction }, "result");
  }
}

const flip = key => (s, api) => {
  s[key] = s[key] === -1 ? 1 : -1;
  restartTiming(s);
  api.emit("direction-flipped", { what: key === "currentDir" ? 1 : 2, currentDir: s.currentDir, fieldDir: s.fieldDir }, "action");
};

mount({
  slug: "dong-co-dien",
  version: "1.0.0",
  title: "Động cơ điện một chiều",
  hint: "Thay đổi dòng điện, từ trường, số vòng dây; tắt cổ góp hoặc đảo chiều dòng điện, từ trường để xem khung dây quay thế nào.",
  initialState,
  step: advance,
  autoplay: true,
  controls: [
    { type: "slider", key: "current", label: "Cường độ dòng điện I", min: 0, max: 5, step: 0.1, unit: "A", digits: 1, onChange: restartTiming },
    { type: "slider", key: "field", label: "Cảm ứng từ B", min: 0, max: 0.5, step: 0.01, unit: "T", onChange: restartTiming },
    { type: "slider", key: "turns", label: "Số vòng dây N", min: 10, max: 200, step: 10, digits: 0, onChange: restartTiming },
    { type: "checkbox", key: "commutator", label: "Có cổ góp (bộ góp điện)", onChange: restartTiming },
    { type: "button", label: "Đảo chiều dòng điện", action: flip("currentDir") },
    { type: "button", label: "Đảo chiều từ trường (đổi cực nam châm)", action: flip("fieldDir") },
  ],
  readouts: [
    { label: "Lực từ lên mỗi cạnh F = NBIl", value: s => `${fmt(sideForce(s), 3)} N` },
    { label: "Mômen lực M", value: s => `${fmt(Math.abs(torque(s)), 4)} N·m` },
    { label: "Góc θ giữa pháp tuyến và B", value: s => `${fmt(deg(s.theta), 0)}°` },
    { label: "Tốc độ quay", value: s => `${fmt(Math.abs(s.omega) / TAU, 2)} vòng/s ${Math.abs(s.omega) < 0.05 ? "" : s.omega < 0 ? "↻" : "↺"}` },
    { label: "Chu kỳ quay đo được", value: s => (s.lastPeriod ? `${fmt(s.lastPeriod, 2)} s` : "–") },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    const { R, cx, cy, mw, size, small } = g;
    const north = s.fieldDir !== -1; // N on the left
    const gap = R * 1.25; // half distance between the pole faces
    const mh = R * 2.5;

    // magnets and field lines (B from N to S)
    magnet(ctx, cx - gap - mw, cy - mh / 2, mw, mh, north, size);
    magnet(ctx, cx + gap, cy - mh / 2, mw, mh, !north, size);
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let k = -2; k <= 2; k++) {
      const y = cy + k * mh * 0.21;
      const x1 = cx - gap + 4;
      const x2 = cx + gap - 4;
      north ? arrow(ctx, x1, y, x2, y, COLORS.blue, 1.5) : arrow(ctx, x2, y, x1, y, COLORS.blue, 1.5);
    }
    ctx.restore();
    label(ctx, "B", north ? cx + gap - 14 : cx - gap + 14, cy - mh * 0.42 - 10, { color: COLORS.blue, bold: true, size, align: "center" });

    // coil seen edge-on, the normal n, and the axle
    const [f1, f2] = forces(s);
    const P = p => [cx + p.x * R, cy - p.y * R];
    const [x1, y1] = P(f1.pos);
    const [x2, y2] = P(f2.pos);
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (!small) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(s.theta) * R * 0.75, cy - Math.sin(s.theta) * R * 0.75);
      ctx.stroke();
      ctx.restore();
      label(ctx, "n", cx + Math.cos(s.theta) * R * 0.85, cy - Math.sin(s.theta) * R * 0.85, { size: 13, color: COLORS.muted, align: "center", bold: true });
    }

    // commutator (split ring, gaps along n) or two slip rings; brushes on the left and right
    const rc = R * 0.22;
    ctx.lineWidth = small ? 4 : 6;
    if (s.commutator) {
      const gapA = 0.35;
      [COLORS.purple, COLORS.green].forEach((color, k) => {
        ctx.strokeStyle = color;
        ctx.beginPath();
        const a0 = -s.theta + gapA / 2 + k * Math.PI;
        ctx.arc(cx, cy, rc, a0, a0 + Math.PI - gapA);
        ctx.stroke();
      });
    } else {
      ctx.strokeStyle = COLORS.purple;
      ctx.beginPath();
      ctx.arc(cx, cy, rc, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = COLORS.green;
      ctx.beginPath();
      ctx.arc(cx, cy, rc * 0.6, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, TAU);
    ctx.fill();
    const bw = small ? 6 : 9;
    ctx.fillStyle = "#555";
    ctx.fillRect(cx - rc - bw - 3, cy - 5, bw, 10);
    ctx.fillRect(cx + rc + 3, cy - 5, bw, 10);

    // battery under the magnets, wired to the brushes
    const by = cy + mh / 2 + (small ? 18 : 30);
    const bl = cx - rc - bw - 3;
    const br = cx + rc + 3 + bw;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bl, cy);
    ctx.lineTo(bl - 8, cy);
    ctx.lineTo(bl - 8, by);
    ctx.lineTo(cx - 8, by);
    ctx.moveTo(cx + 8, by);
    ctx.lineTo(br + 8, by);
    ctx.lineTo(br + 8, cy);
    ctx.lineTo(br, cy);
    ctx.stroke();
    const plusLeft = s.currentDir !== -1;
    for (const [dx, long] of [[-6, plusLeft], [6, !plusLeft]]) {
      ctx.lineWidth = long ? 2 : 5;
      const half = long ? 13 : 7;
      ctx.beginPath();
      ctx.moveTo(cx + dx, by - half);
      ctx.lineTo(cx + dx, by + half);
      ctx.stroke();
    }
    label(ctx, "+", cx + (plusLeft ? -18 : 18), by - 12, { color: COLORS.red, bold: true, size, align: "center" });
    label(ctx, `I = ${fmt(s.current, 1)} A`, cx, by + (small ? 22 : 26), { size, align: "center", bold: true });

    // sides of the coil: ⊙ out of the screen, ⊗ into it; force arrows (left-hand rule)
    const r = small ? 8 : 11;
    const F = sideForce(s);
    const len = F > 0 ? Math.min(1.1 * R, R * (0.25 + 0.35 * Math.sqrt(F))) : 0;
    for (const [f, x, y] of [[f1, x1, y1], [f2, x2, y2]]) {
      if (len && s.current > 0) arrow(ctx, x, y, x, y - Math.sign(f.fy) * len, COLORS.red, small ? 2.5 : 3);
    }
    sideMark(ctx, x1, y1, r, f1.out);
    sideMark(ctx, x2, y2, r, f2.out);
    if (len && s.current > 0) {
      label(ctx, "F", x1 + r + 4, y1 - Math.sign(f1.fy) * len * 0.7, { color: COLORS.red, bold: true, size });
      label(ctx, "F", x2 + r + 4, y2 - Math.sign(f2.fy) * len * 0.7, { color: COLORS.red, bold: true, size });
    }

    // torque: curved arrow around the axle, sweep ∝ |M| / NBIS
    const M = torque(s);
    const peak = peakTorque(s);
    if (peak > 0 && Math.abs(M) > 0.02 * peak) {
      const sweep = 0.4 + 1.6 * (Math.abs(M) / peak);
      const ra = R * 1.12;
      const a0 = -Math.PI / 2 - sweep / 2;
      ctx.strokeStyle = COLORS.purple;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, ra, a0, a0 + sweep);
      ctx.stroke();
      // screen angles grow clockwise; M > 0 is counter-clockwise
      const end = M < 0 ? a0 + sweep : a0;
      const dir = M < 0 ? 1 : -1;
      const ex = cx + ra * Math.cos(end);
      const ey = cy + ra * Math.sin(end);
      arrow(ctx, ex - dir * 6 * -Math.sin(end), ey - dir * 6 * Math.cos(end), ex + dir * 4 * -Math.sin(end), ey + dir * 4 * Math.cos(end), COLORS.purple, 2.5);
      label(ctx, "M", cx, cy - ra - 10, { color: COLORS.purple, bold: true, size, align: "center" });
    }

    // notes
    if (small) {
      label(ctx, "Nhìn dọc trục quay · ⊙ ra, ⊗ vào", view.w / 2, 10, { size: 11, align: "center", color: COLORS.muted });
    } else {
      label(ctx, s.commutator ? "Động cơ có cổ góp: dòng điện trong khung đổi chiều mỗi nửa vòng" : "Không có cổ góp: dòng điện trong khung không đổi chiều", view.w / 2, 20, { size: 15, align: "center", bold: true });
      label(ctx, "Nhìn dọc theo trục quay. ⊙: dòng điện đi ra, ⊗: đi vào mặt phẳng hình. n: pháp tuyến của khung.", view.w / 2, 42, { size: 12, align: "center", color: COLORS.muted });
      label(ctx, "Quy tắc bàn tay trái: đường sức từ hướng vào lòng bàn tay, chiều từ cổ tay đến ngón giữa là chiều dòng điện,", view.w / 2, view.h - 30, { size: 12, align: "center", color: COLORS.muted });
      label(ctx, "ngón cái choãi ra 90° chỉ chiều lực từ. Độ dài mũi tên F không theo tỉ lệ; chuyển động được làm chậm (rôto có bánh đà).", view.w / 2, view.h - 13, { size: 12, align: "center", color: COLORS.muted });
    }
  },
});
