import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, measure, nextChallenge, dragAngle, TARGETS, R_MIN, R_MAX, R_STEP } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
/** Font size at which `text` is no wider than maxW (never above `size`). */
function fitted(ctx, text, maxW, size, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  return w > maxW ? Math.max(9, Math.floor((size * maxW) / w)) : size;
}

const cm = x => `${fmt(x)} cm`;
const cm2 = x => `${fmt(x)} cm²`;
const sector = s => s.mode !== "ring";

// One result per finished adjustment; the goal once per challenge.
function report(s, api) {
  const m = measure(s);
  if (!sector(s)) return api.emit("ring-set", { outer: m.R, inner: m.r, area: m.ring }, "result");
  api.emit("sector-set", { angle: m.n, radius: m.R, arcLength: m.arc, sectorArea: m.sector }, "result");
  if (m.hit && !s.solved) {
    s.solved = true;
    api.emit("target-area-reached", { challenge: s.challenge, target: m.target, area: m.sector, radius: m.R, angle: m.n }, "goal");
  }
}

function lines(s, m, small) {
  const out = [];
  if (!sector(s)) {
    if (small) return [[`S = π(R² − r²) ≈ ${cm2(m.ring)}`, COLORS.blue, true]];
    out.push([`Hình vành khuyên: S = π(R² − r²) = π · (${fmt(m.R)}² − ${fmt(m.r)}²) ≈ ${cm2(m.ring)}`, COLORS.blue, true]);
    out.push([`= hình tròn lớn − hình tròn nhỏ ≈ ${fmt(m.disc)} − ${fmt(Math.PI * m.r * m.r)} (cm²)`, COLORS.muted]);
    return out;
  }
  if (small) {
    out.push([`l ≈ ${cm(m.arc)};  S ≈ ${cm2(m.sector)}`, COLORS.ink, true]);
  } else {
    out.push([`Độ dài cung:  l = πRn/180 = π · ${fmt(m.R)} · ${fmt(m.n)} / 180 ≈ ${cm(m.arc)}`, COLORS.orange, true]);
    out.push([`Diện tích hình quạt:  S = πR²n/360 = π · ${fmt(m.R)}² · ${fmt(m.n)} / 360 ≈ ${cm2(m.sector)}`, COLORS.blue, true]);
    out.push([`Cách khác:  S = l·R/2 ≈ ${cm2((m.arc * m.R) / 2)}`, COLORS.muted]);
  }
  if (m.target != null) {
    const k = TARGETS[(Math.floor(s.challenge) - 1) % TARGETS.length];
    const want = small ? `Cần S ≈ ${cm2(m.target)}` : `Thử thách: tạo hình quạt có S = ${k}π cm² ≈ ${cm2(m.target)}`;
    if (m.hit) out.push([`${want}. Đạt!`, COLORS.green, true]);
    else out.push([`${want} (${m.sector > m.target ? "đang lớn hơn" : "đang nhỏ hơn"})`, COLORS.red, true]);
  }
  return out;
}

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(s, view) {
  const m = measure(s);
  const small = view.w < 560 || view.h < 420;
  const text = lines(s, m, small);
  const gap = small ? 16 : 21;
  const top = 8 + text.length * gap;
  const bottom = small ? 16 : 24;
  const pad = small ? 20 : 30; // room for the labels round the circle
  const avail = Math.max(20, Math.min(view.w - 2 * pad, view.h - top - bottom - 2 * pad) / 2);
  const k = avail / Math.max(m.R, 5); // px per cm: small circles look small, large ones zoom the grid out
  const cx = view.w / 2;
  const cy = top + (view.h - top - bottom) / 2;
  const at = (deg, rad) => [cx + rad * Math.cos((deg * Math.PI) / 180), cy - rad * Math.sin((deg * Math.PI) / 180)];
  return { m, small, text, gap, top, k, cx, cy, at, Rp: m.R * k };
}

function disc(ctx, x, y, r, fill, stroke, width = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function segment(ctx, p, q, color, width = 2, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(...p);
  ctx.lineTo(...q);
  ctx.stroke();
  ctx.setLineDash([]);
}

const radius = (key, labelText, min, max, visible) => ({
  type: "slider", key, label: labelText, min, max, step: R_STEP, unit: "cm", digits: 1, visible,
  onChange(s, api) {
    // the hole is always at least half a centimetre narrower than the disc
    if (key === "R" && s.r > s.R - R_STEP) s.r = s.R - R_STEP;
    if (key === "r" && s.R < s.r + R_STEP) s.R = s.r + R_STEP;
    api.sync();
  },
  onCommit: report,
});

mount({
  slug: "cung-quat-tron",
  version: "1.0.0",
  title: "Độ dài cung tròn và diện tích hình quạt",
  hint: "Kéo điểm B trên đường tròn để đổi số đo cung AB, hoặc dùng thanh trượt.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Hình",
      options: [
        { value: "sector", label: "Cung tròn và hình quạt tròn" },
        { value: "ring", label: "Hình vành khuyên" },
      ],
      onCommit: report,
    },
    radius("R", "Bán kính R", R_MIN, R_MAX),
    radius("r", "Bán kính nhỏ r", R_STEP, R_MAX - R_STEP, s => !sector(s)),
    { type: "slider", key: "angle", label: "Số đo cung n", min: 0, max: 360, step: 1, format: v => `${fmt(v, 0)}°`, visible: sector, onCommit: report },
    {
      type: "button",
      label: "Thử thách: diện tích cho trước",
      primary: true,
      visible: sector,
      action(s) {
        s.challenge = nextChallenge(s);
        s.solved = false;
      },
      event: "challenge-started",
    },
  ],
  readouts: [
    { label: "Số đo cung n", value: s => (sector(s) ? `${fmt(measure(s).n, 0)}° ≈ ${fmt(measure(s).radians, 3)} rad` : "–") },
    { label: "Độ dài cung l", value: s => (sector(s) ? cm(measure(s).arc) : "–") },
    { label: "Diện tích hình quạt S", value: s => (sector(s) ? cm2(measure(s).sector) : "–") },
    { label: "Chu vi đường tròn C = 2πR", value: s => cm(measure(s).circumference) },
    { label: "Diện tích hình tròn πR²", value: s => cm2(measure(s).disc) },
    { label: "Diện tích hình vành khuyên", value: s => (sector(s) ? "–" : cm2(measure(s).ring)) },
  ],
  pointer: {
    down(p, s, api, view) {
      if (!sector(s)) return false;
      const g = geom(s, view);
      const [bx, by] = g.at(g.m.n, g.Rp);
      const d = Math.hypot(p.x - g.cx, p.y - g.cy);
      // the handle B, or anywhere on the circle itself
      if (Math.hypot(p.x - bx, p.y - by) > 24 && Math.abs(d - g.Rp) > 14) return false;
      s._from = s.angle;
      this.move(p, s, api, view);
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      if (Math.hypot(p.x - g.cx, p.y - g.cy) < 6) return; // direction is undefined at the centre
      s.angle = dragAngle(s.angle, (Math.atan2(g.cy - p.y, p.x - g.cx) * 180) / Math.PI);
    },
    up(p, s, api) {
      if (s._from === s.angle) return;
      api.emit("angle-dragged", { angle: s.angle }, "action");
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { m, small, k, cx, cy, at, Rp } = g;
    const size = small ? 13 : 15;
    ctx.lineCap = "round";

    // 1 cm grid through the centre
    ctx.beginPath();
    for (let x = cx % k; x < view.w; x += k) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, view.h);
    }
    for (let y = cy % k; y < view.h; y += k) {
      ctx.moveTo(0, y);
      ctx.lineTo(view.w, y);
    }
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.stroke();

    const O = [cx, cy];
    const A = at(0, Rp);
    if (!sector(s)) {
      const rp = m.r * k;
      ctx.beginPath();
      ctx.arc(cx, cy, Rp, 0, Math.PI * 2);
      ctx.arc(cx, cy, rp, 0, Math.PI * 2, true);
      ctx.fillStyle = "rgba(47, 111, 237, 0.25)";
      ctx.fill("evenodd");
      disc(ctx, cx, cy, Rp, null, COLORS.ink);
      disc(ctx, cx, cy, rp, null, COLORS.ink);
      segment(ctx, O, A, COLORS.orange, 2.5);
      const q = at(135, rp);
      segment(ctx, O, q, COLORS.green, 2.5);
      label(ctx, small ? "R" : `R = ${cm(m.R)}`, cx + Math.max(rp + 6, Rp * 0.55), cy + 12, { size, bold: true, color: COLORS.orange });
      label(ctx, small ? "r" : `r = ${cm(m.r)}`, q[0] - 6, q[1] - 10, { size, bold: true, color: COLORS.green, align: "right" });
    } else {
      const B = at(m.n, Rp);
      const t = (-m.n * Math.PI) / 180; // canvas angles grow clockwise
      disc(ctx, cx, cy, Rp, null, COLORS.muted, 1.5);
      if (m.n > 0) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, Rp, 0, t, true);
        ctx.closePath();
        ctx.fillStyle = "rgba(47, 111, 237, 0.22)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, Rp, 0, t, true);
        ctx.strokeStyle = COLORS.orange;
        ctx.lineWidth = small ? 4 : 5;
        ctx.stroke();
        // central angle
        const ra = Math.min(small ? 18 : 26, Rp * 0.4);
        ctx.beginPath();
        ctx.arc(cx, cy, ra, 0, t, true);
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const mid = m.n / 2;
        const [ax, ay] = at(mid, ra + (small ? 13 : 17));
        label(ctx, `${fmt(m.n, 0)}°`, ax, ay, { size: small ? 12 : 13, align: "center" });
        const [lx, ly] = at(mid, Rp + (small ? 11 : 15));
        label(ctx, "l", lx, ly, { size: size + 1, bold: true, color: COLORS.orange, align: "center" });
      }
      segment(ctx, O, A, COLORS.ink);
      segment(ctx, O, B, COLORS.ink);
      label(ctx, small ? "R" : `R = ${cm(m.R)}`, cx + Rp / 2, cy + 12, { size, bold: true, align: "center" });
      disc(ctx, ...A, 4, COLORS.ink);
      label(ctx, m.n === 360 || m.n === 0 ? "A ≡ B" : "A", A[0] + 9, A[1] + (m.n > 340 || m.n < 20 ? 14 : 0), { size, bold: true });
      disc(ctx, ...B, small ? 7 : 8, COLORS.blue, "#fff"); // the handle
      if (m.n > 0 && m.n < 360) {
        const [x, y] = at(m.n, Rp + (small ? 15 : 19));
        label(ctx, "B", x, y, { size, bold: true, color: COLORS.blue, align: "center" });
      }
    }
    disc(ctx, cx, cy, 3.5, COLORS.ink);
    // O sits outside the sector, opposite its bisector
    const [ox, oy] = sector(s) && m.n > 0 ? at(m.n / 2 + 180, 13) : [cx - 10, cy + 11];
    label(ctx, "O", ox, oy, { size, align: "center" });

    // text, on a light band so the grid does not cut through it
    ctx.fillStyle = "rgba(247, 249, 253, 0.88)";
    ctx.fillRect(0, 0, view.w, g.top);
    g.text.forEach(([txt, color, bold], i) => label(ctx, txt, 10, 8 + g.gap * (i + 0.5), { size: fitted(ctx, txt, view.w - 20, small ? 12 : 14, bold), color, bold }));
    const note = small ? "Mỗi ô lưới: 1 cm" : sector(s) ? "Mỗi ô lưới là 1 cm. Cung AB tính từ A ngược chiều kim đồng hồ đến B." : "Mỗi ô lưới là 1 cm.";
    ctx.fillStyle = "rgba(247, 249, 253, 0.88)";
    ctx.fillRect(0, view.h - (small ? 17 : 22), view.w, 22);
    label(ctx, note, view.w / 2, view.h - (small ? 9 : 12), { align: "center", size: small ? 11 : 12, color: COLORS.muted });
  },
});
