import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, R, setup, collisionTime, endTime, before, after, at, angleBetween, extent } from "./model.js";

const PUCK = [COLORS.blue, COLORS.red];
const SUB = ["₁", "₂"];
const VT = 0.4; // s: a velocity arrow is as long as the distance covered in this time
const V_MAX = 4; // m/s, range of each velocity component
const V_STEP = 0.25;

// Any change to the set-up puts the pucks back at their starting points.
const rewind = (s, api) => {
  s.time = 0;
  api.pause();
};

// The "Bước" button calls step() several times in a row; without this guard the call after
// the end would see a finished run and start a new one.
let justEnded = false;

const collided = s => s.time > collisionTime(s);
const afterText = (s, pick, unit) => (collided(s) ? `${fmt(pick(after(s)))} ${unit}` : "–");
const velocityOf = (q, i) => (i ? [q.v2x, q.v2y] : [q.v1x, q.v1y]);

/** Where things go, from the view size, so draw() and the pointer agree. */
function layout(s, view) {
  const small = view.w < 560 || view.h < 430;
  const side = view.w >= 760 && view.w > view.h * 1.2; // momentum diagrams beside the table, else under it
  const dw = side ? clamp(view.w * 0.3, 230, 330) : view.w;
  const dh = side ? view.h : clamp(view.h * 0.36, 112, 250);
  const table = { x: 6, y: 6, w: (side ? view.w - dw : view.w) - 12, h: (side ? view.h : view.h - dh) - 12 };
  const boxes = side
    ? [0, 1].map(i => ({ x: view.w - dw, y: (i * view.h) / 2, w: dw, h: view.h / 2 }))
    : [0, 1].map(i => ({ x: (i * view.w) / 2, y: view.h - dh, w: view.w / 2, h: dh }));
  // World box: the whole run plus the velocity arrows at its two ends. While an arrow is being
  // dragged the box (and the starting points) stay as they were when the drag began.
  let T = s._drag?.T;
  if (!T) {
    const box = extent(s);
    for (const p of [at(s, 0), at(s, endTime(s))]) {
      for (const i of [0, 1]) {
        const [vx, vy] = velocityOf(p, i);
        const tx = (i ? p.x2 : p.x1) + vx * VT;
        const ty = (i ? p.y2 : p.y1) + vy * VT;
        box.minX = Math.min(box.minX, tx);
        box.maxX = Math.max(box.maxX, tx);
        box.minY = Math.min(box.minY, ty);
        box.maxY = Math.max(box.maxY, ty);
      }
    }
    const top = small ? 18 : 26; // status line
    const bottom = small ? 16 : 22; // note
    // the margins leave room for the speed labels beyond the arrow tips
    const scale = Math.min((table.w - (small ? 64 : 120)) / (box.maxX - box.minX), (table.h - top - bottom - (small ? 30 : 44)) / (box.maxY - box.minY), 120);
    T = {
      scale,
      ox: table.x + table.w / 2 - ((box.minX + box.maxX) / 2) * scale,
      oy: table.y + top + (table.h - top - bottom) / 2 + ((box.minY + box.maxY) / 2) * scale,
    };
  }
  return { small, side, table, boxes, T, X: x => T.ox + x * T.scale, Y: y => T.oy - y * T.scale };
}

// Space in a momentum box taken by its title and by the line with the size of the sum.
const HEAD = small => (small ? 22 : 32);
const FOOT = small => (small ? 22 : 30);

/** One momentum triangle: p₁ from the origin, p₂ from its tip, and their sum. */
function drawMomentum(ctx, box, small, title, q, scale) {
  const size = small ? 10 : 13;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x + 4, box.y + 4, box.w - 8, box.h - 8);
  label(ctx, title, box.x + box.w / 2, box.y + (small ? 13 : 18), { size: small ? 11 : 14, bold: true, align: "center" });
  const mid = box.y + HEAD(small) + (box.h - HEAD(small) - FOOT(small)) / 2;
  if (!q) {
    label(ctx, "?", box.x + box.w / 2, mid, { size: 22, align: "center", color: COLORS.muted });
    return;
  }
  label(ctx, `p = ${fmt(q.p)} kg·m/s`, box.x + box.w / 2, box.y + box.h - (small ? 12 : 16), { size, align: "center", color: COLORS.purple, bold: true });
  // centre the triangle O → p₁ → p₁ + p₂ in the box
  const xs = [0, q.p1x, q.px];
  const ys = [0, q.p1y, q.py];
  const ox = box.x + box.w / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * scale;
  const oy = mid + ((Math.min(...ys) + Math.max(...ys)) / 2) * scale;
  const P = (x, y) => [ox + x * scale, oy - y * scale];
  const draw = (from, to, color, text, width, side) => {
    const [x1, y1] = P(...from);
    const [x2, y2] = P(...to);
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;
    arrow(ctx, x1, y1, x2, y2, color, width);
    // name beside the middle of the arrow
    const off = side * (small ? 9 : 12);
    label(ctx, text, (x1 + x2) / 2 - ((y2 - y1) / len) * off, (y1 + y2) / 2 + ((x2 - x1) / len) * off, { size, bold: true, color, align: "center" });
  };
  const turn = Math.sign(q.p1x * q.p2y - q.p1y * q.p2x) || 1; // which side of p₁ the triangle lies on
  draw([0, 0], [q.px, q.py], COLORS.purple, "p", small ? 3 : 4, -turn);
  draw([0, 0], [q.p1x, q.p1y], PUCK[0], `p${SUB[0]}`, 2.5, turn);
  draw([q.p1x, q.p1y], [q.px, q.py], PUCK[1], `p${SUB[1]}`, 2.5, turn);
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(...P(0, 0), 3, 0, Math.PI * 2);
  ctx.fill();
}

const massOnly = { min: 0.5, max: 5, step: 0.5, unit: "kg", digits: 1, onChange: rewind };
const speedOnly = { min: -V_MAX, max: V_MAX, step: V_STEP, unit: "m/s", onChange: rewind };

mount({
  slug: "va-cham-hai-chieu",
  version: "1.0.0",
  title: "Va chạm trên mặt phẳng",
  hint: "Hai đĩa trượt không ma sát trên bàn đệm khí (nhìn từ trên xuống). Chạm vào bàn để đưa hai đĩa về chỗ xuất phát, kéo đầu mũi tên để đổi vận tốc, rồi bấm “Bắt đầu”.",
  initialState,
  step(s, dt, api) {
    if (justEnded) return;
    const end = endTime(s);
    if (s.time >= end) s.time = 0; // “Chạy” on a finished run starts a new one
    if (s.time === 0) {
      api.emit("launch", { m1: s.m1, v1x: s.v1x, v1y: s.v1y, m2: s.m2, v2x: s.v2x, v2y: s.v2y, restitution: s.restitution, offset: s.offset }, "action");
    }
    const prev = s.time;
    const g = setup(s);
    s.time = Math.min(end, s.time + dt);
    if (prev <= g.meet && s.time > g.meet) {
      const a = after(s);
      if (a) {
        api.emit("collision", { v1xAfter: a.v1x, v1yAfter: a.v1y, v2xAfter: a.v2x, v2yAfter: a.v2y, momentumX: a.px, momentumY: a.py, energyLost: Math.max(0, before(s).k - a.k) }, "result");
      } else {
        api.emit("missed", { offset: s.offset, momentumX: before(s).px, momentumY: before(s).py }, "result");
      }
    }
    if (s.time >= end) {
      api.pause();
      justEnded = true;
      setTimeout(() => (justEnded = false));
    }
  },
  controls: [
    { type: "heading", label: "Đĩa 1 (xanh)" },
    { type: "slider", key: "m1", label: "Khối lượng m₁", ...massOnly },
    { type: "slider", key: "v1x", label: "Vận tốc v₁ₓ (sang phải)", ...speedOnly },
    { type: "slider", key: "v1y", label: "Vận tốc v₁ᵧ (lên trên)", ...speedOnly },
    { type: "heading", label: "Đĩa 2 (đỏ)" },
    { type: "slider", key: "m2", label: "Khối lượng m₂", ...massOnly },
    { type: "slider", key: "v2x", label: "Vận tốc v₂ₓ (sang phải)", ...speedOnly },
    { type: "slider", key: "v2y", label: "Vận tốc v₂ᵧ (lên trên)", ...speedOnly },
    { type: "heading", label: "Va chạm" },
    {
      type: "slider",
      key: "restitution",
      label: "Hệ số hồi phục e",
      min: 0,
      max: 1,
      step: 0.05,
      onChange: rewind,
      format: v => (v === 1 ? "1 (đàn hồi)" : v === 0 ? "0 (va chạm mềm)" : fmt(v)),
    },
    {
      type: "slider",
      key: "offset",
      label: "Độ lệch tâm b",
      min: -1,
      max: 1,
      step: 0.05,
      onChange: rewind,
      format: v => `${fmt(v)} m${v === 0 ? " (xuyên tâm)" : Math.abs(v) >= 2 * R ? " (trượt qua nhau)" : ""}`,
    },
    {
      type: "button",
      label: "Bắt đầu",
      primary: true,
      action(s, api) {
        s.time = 0;
        api.play();
      },
    },
  ],
  readouts: [
    { label: "Tốc độ sau va chạm v₁′", value: s => afterText(s, a => Math.hypot(a.v1x, a.v1y), "m/s") },
    { label: "Tốc độ sau va chạm v₂′", value: s => afterText(s, a => Math.hypot(a.v2x, a.v2y), "m/s") },
    {
      label: "Góc giữa v₁′ và v₂′",
      value: s => {
        const a = collided(s) && after(s);
        const angle = a ? angleBetween(a.v1x, a.v1y, a.v2x, a.v2y) : NaN;
        return Number.isFinite(angle) ? `${fmt(angle, 1)}°` : "–";
      },
    },
    { label: "Độ lớn tổng động lượng trước", value: s => `${fmt(before(s).p)} kg·m/s` },
    { label: "Độ lớn tổng động lượng sau", value: s => afterText(s, a => a.p, "kg·m/s") },
    { label: "Tổng động năng trước", value: s => `${fmt(before(s).k)} J` },
    { label: "Tổng động năng sau", value: s => afterText(s, a => a.k, "J") },
    {
      label: "Động năng mất đi",
      value: s => {
        if (!collided(s)) return "–";
        const lost = before(s).k - after(s).k;
        return `${fmt(lost)} J (${fmt((100 * lost) / before(s).k, 0)} %)`;
      },
    },
  ],
  pointer: {
    down(p, s, api, view) {
      if (s.time !== 0) {
        // first touch: back to the start, where the arrows can be dragged
        rewind(s, api);
        api.sync();
        return false;
      }
      const L = layout(s, view);
      const start = at(s, 0);
      const i = [0, 1].find(k => {
        const [vx, vy] = velocityOf(start, k);
        const tipX = L.X((k ? start.x2 : start.x1) + vx * VT);
        const tipY = L.Y((k ? start.y2 : start.y1) + vy * VT);
        return Math.hypot(p.x - tipX, p.y - tipY) < 22;
      });
      if (i === undefined) return false;
      api.pause();
      s._drag = { i, T: L.T, start };
      return true;
    },
    move(p, s) {
      const { i, T, start } = s._drag;
      const snap = v => clamp(Math.round(v / V_STEP) * V_STEP, -V_MAX, V_MAX);
      s[i ? "v2x" : "v1x"] = snap((p.x - (T.ox + (i ? start.x2 : start.x1) * T.scale)) / (T.scale * VT));
      s[i ? "v2y" : "v1y"] = snap(((T.oy - (i ? start.y2 : start.y1) * T.scale) - p.y) / (T.scale * VT));
    },
    up(p, s, api) {
      const i = s._drag.i;
      delete s._drag;
      api.emit("set-velocity", { puck: i + 1, vx: i ? s.v2x : s.v1x, vy: i ? s.v2y : s.v1y }, "action");
    },
  },
  draw(ctx, s, view) {
    const L = layout(s, view);
    const { small, table, X, Y } = L;
    const size = small ? 10 : 13;
    const g = setup(s);
    const drag = s._drag;
    const start = drag ? drag.start : at(s, 0);
    const now = drag ? { ...start, v1x: s.v1x, v1y: s.v1y, v2x: s.v2x, v2y: s.v2y, time: 0, collided: false } : at(s, s.time);
    const r = R * L.T.scale;

    // ----- the table -----
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(table.x, table.y, table.w, table.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.clip();

    const status = drag ? "Kéo để chọn vận tốc" : !g.hit ? "Hai đĩa không chạm nhau" : now.collided ? "Sau va chạm" : "Trước va chạm";
    label(ctx, status, table.x + 8, table.y + (small ? 11 : 15), { size: size + 1, bold: true, color: now.collided ? COLORS.green : COLORS.ink });
    label(ctx, `t = ${fmt(now.time)} s`, table.x + table.w - 8, table.y + (small ? 11 : 15), { size, align: "right", color: COLORS.muted });
    const note = drag
      ? "Thả tay: hai đĩa được xếp lại để gặp nhau với độ lệch b."
      : small
        ? "Đĩa nhẵn: lực tương tác dọc theo đường nối hai tâm."
        : "Đĩa nhẵn, không ma sát: lực tương tác hướng dọc theo đường nối hai tâm.";
    label(ctx, note, table.x + 8, table.y + table.h - (small ? 9 : 12), { size: small ? 10 : 12, color: COLORS.muted });

    // paths: dashed up to the meeting point, solid where the pucks have been
    const meet = drag ? start : at(s, g.meet);
    const centre = (p, i) => [X(i ? p.x2 : p.x1), Y(i ? p.y2 : p.y1)];
    for (const i of [0, 1]) {
      ctx.strokeStyle = PUCK[i];
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(...centre(start, i));
      ctx.lineTo(...centre(meet, i));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(...centre(start, i));
      if (now.time > g.meet) ctx.lineTo(...centre(meet, i));
      ctx.lineTo(...centre(now, i));
      ctx.stroke();
      // where the puck started, and where it was at contact
      ctx.lineWidth = 1.5;
      for (const p of now.collided ? [start, meet] : now.time > 0 ? [start] : []) {
        ctx.beginPath();
        ctx.arc(...centre(p, i), r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (now.collided) {
      // line of centres at contact: the direction of the forces between the pucks
      const [ax, ay] = centre(meet, 0);
      const [bx, by] = centre(meet, 1);
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(ax - (bx - ax) * 0.9, ay - (by - ay) * 0.9);
      ctx.lineTo(bx + (bx - ax) * 0.9, by + (by - ay) * 0.9);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const i of [0, 1]) {
      const [cx, cy] = centre(now, i);
      ctx.fillStyle = PUCK[i];
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      // the mass (or just the puck number) sits behind the centre, clear of the velocity arrow
      const [vx, vy] = velocityOf(now, i);
      const speed = Math.hypot(vx, vy) || Infinity;
      const text = r >= 26 ? `${fmt(i ? s.m2 : s.m1, 1)} kg` : String(i + 1);
      const handle = now.time === 0 && speed === Infinity; // the drag handle of a puck at rest covers its centre
      if (r >= 9 && !handle) label(ctx, text, cx - (vx / speed) * r * 0.45, cy + (vy / speed) * r * 0.45, { size: small ? 9 : 11, bold: true, color: "#fff", align: "center" });
    }
    for (const i of [0, 1]) {
      const [cx, cy] = centre(now, i);
      const [vx, vy] = velocityOf(now, i);
      const tx = cx + vx * VT * L.T.scale;
      const ty = cy - vy * VT * L.T.scale;
      arrow(ctx, cx, cy, tx, ty, COLORS.ink, 2.5);
      if (now.time === 0) {
        // handle to drag, also when the puck is at rest
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = PUCK[i];
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(tx, ty, small ? 5 : 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      const speed = Math.hypot(vx, vy);
      const text = `v${SUB[i]}${now.collided ? "′" : ""} = ${fmt(speed)}${small ? "" : " m/s"}`;
      // beside the arrow tip, on the side away from the other puck; for a puck at rest, under it
      const half = small ? 26 : 44;
      let lx = cx;
      let ly = cy + r + 12;
      if (speed > 1e-9) {
        const [ox, oy] = centre(now, 1 - i);
        const nx = vy / speed; // screen normal of the arrow
        const ny = vx / speed;
        const away = nx * (ox - cx) + ny * (oy - cy) > 0 ? -1 : 1;
        const inside = speed * VT * L.T.scale < r + 6; // a short arrow ends on the puck: label beside the puck instead
        lx = (inside ? cx : tx) + away * nx * (half + 8 + (inside ? r : 0));
        ly = (inside ? cy : ty) + away * ny * (14 + (inside ? r : 0));
      }
      label(ctx, text, clamp(lx, table.x + half, table.x + table.w - half), clamp(ly, table.y + 30, table.y + table.h - 26), {
        size,
        bold: true,
        color: PUCK[i],
        align: "center",
      });
    }
    ctx.restore();

    // ----- momentum vectors and their sums -----
    const b = before(s);
    const a = after(s);
    const shown = !g.hit ? b : collided(s) && !drag ? a : null; // a miss leaves everything as it was
    const fit = q => {
      const xs = [0, q.p1x, q.px];
      const ys = [0, q.p1y, q.py];
      const box = L.boxes[0];
      const room = small ? 26 : 36; // for the names beside the arrows
      return Math.min((box.w - 16 - room) / (Math.max(...xs) - Math.min(...xs) || 1e-9), (box.h - HEAD(small) - FOOT(small) - room) / (Math.max(...ys) - Math.min(...ys) || 1e-9));
    };
    const scale = Math.min(fit(b), a ? fit(a) : Infinity, small ? 40 : 60); // the same for both diagrams
    drawMomentum(ctx, L.boxes[0], small, small ? "Động lượng trước" : "Động lượng trước va chạm", b, scale);
    drawMomentum(ctx, L.boxes[1], small, small ? "Động lượng sau" : "Động lượng sau va chạm", shown, scale);
  },
});
