import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, forces, task, duration, machinePower, progress, powerUnits, MACHINES } from "./model.js";

const LANE_COLORS = [COLORS.blue, COLORS.purple];
const machineName = (s, k) => (MACHINES[s[`machine${k}`]] ?? MACHINES.person).name;
const J = a => (Math.abs(a) >= 10000 ? `${fmt(a / 1000, 2)} kJ` : `${fmt(a, 0)} J`);
const W = w => {
  const u = powerUnits(w);
  return `${w >= 1000 ? `${fmt(u.kW, 2)} kW` : `${fmt(w, 0)} W`} ≈ ${fmt(u.HP, 2)} HP`;
};
const restart = s => {
  s.time = 0;
};

function finish(s, k, api) {
  const t = duration(s, k);
  const a = task(s);
  api.emit("task-done", { machine: k, work: a.total, usefulWork: a.useful, time: t, power: a.total / t }, "result");
  if (k === 1 && t <= s.targetTime) {
    api.emit("target-met", { time: t, targetTime: s.targetTime, power: machinePower(s, 1) }, "goal");
  }
}

function drawBox(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}

function laneHeader(ctx, s, k, x, y, small, align = "center") {
  const t = duration(s, k);
  const done = progress(s, k) >= 1;
  const late = k === 1 && t > s.targetTime;
  const size = small ? 11 : 13;
  label(ctx, `Máy ${k}: ${machineName(s, k)}`, x, y, { align, bold: true, size, color: LANE_COLORS[k - 1] });
  label(ctx, `P = ${W(machinePower(s, k))}`, x, y + size + 3, { align, size, color: COLORS.muted });
  const clock = `t = ${fmt(Math.min(s.time, t), 1)} / ${fmt(t, 1)} s${done ? " ✓" : ""}`;
  label(ctx, clock, x, y + 2 * (size + 3), { align, size, bold: done, color: late ? COLORS.red : COLORS.ink });
}

function drawLift(ctx, s, view, top, bottom, small) {
  const fs = forces(s);
  const laneW = view.w / 2;
  const headerH = small ? 44 : 56;
  const ground = bottom;
  const beam = top + headerH + 14;
  const box = Math.min(small ? 30 : 46, laneW * 0.22);
  const travel = ground - beam - box - 22; // px for the whole height h (not to scale)
  for (const k of [1, 2]) {
    const cx = laneW * (k - 0.5);
    laneHeader(ctx, s, k, cx, top + 8, small);
    // gantry and machine on the beam
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(cx - laneW * 0.32, beam - 4, laneW * 0.64, 6);
    ctx.fillRect(cx - laneW * 0.32, beam - 4, 5, ground - beam + 4);
    drawBox(ctx, cx - 14, beam - 16, 28, 14, LANE_COLORS[k - 1]);
    // load
    const p = progress(s, k);
    const by = ground - box - p * travel;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, beam + 2);
    ctx.lineTo(cx, by);
    ctx.stroke();
    // target height
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.muted;
    ctx.beginPath();
    ctx.moveTo(cx - laneW * 0.3, ground - box - travel);
    ctx.lineTo(cx + laneW * 0.42, ground - box - travel);
    ctx.stroke();
    ctx.setLineDash([]);
    drawBox(ctx, cx - box / 2, by, box, box, "#d9b37c");
    label(ctx, `${fmt(s.mass, 0)} kg`, cx, by + box / 2, { align: "center", size: small ? 10 : 12, bold: true });
    // forces: F up along the rope, P down (equal at constant speed)
    const len = Math.min(small ? 26 : 40, travel * 0.3);
    arrow(ctx, cx + box / 2 + 8, by + box / 2, cx + box / 2 + 8, by + box / 2 - len, COLORS.green, 2.5);
    label(ctx, "F", cx + box / 2 + 16, by + box / 2 - len + 4, { color: COLORS.green, bold: true, size: small ? 11 : 13 });
    // P is drawn from the top edge down into the box so it never crosses the ground line
    arrow(ctx, cx - box / 2 - 8, by - len + box * 0.9, cx - box / 2 - 8, by + box * 0.9, COLORS.red, 2.5);
    label(ctx, "P", cx - box / 2 - 20, by + box * 0.9 - 4, { color: COLORS.red, bold: true, size: small ? 11 : 13 });
    // displacement s = h
    const sx = cx + laneW * 0.36;
    arrow(ctx, sx, ground - box / 2, sx, ground - box / 2 - travel, COLORS.orange, 2);
    label(ctx, `h = ${fmt(s.distance, 1)} m`, sx - 4, ground - box / 2 - travel / 2, { align: "right", size: small ? 10 : 12, color: COLORS.orange, bold: true });
  }
  ctx.fillStyle = COLORS.muted;
  ctx.fillRect(0, ground, view.w, 3);
  if (!small) label(ctx, `F cùng hướng s (α = 0°): A = F·s = ${J(fs[0].work)};  trọng lực ngược hướng (α = 180°): A = ${J(fs[1].work)}`, view.w / 2, ground + 14, { align: "center", size: 12, color: COLORS.muted });
}

function drawPush(ctx, s, view, top, bottom, small) {
  const fs = forces(s);
  const [F, P, N, Fms] = fs;
  const laneH = (bottom - top) / 2;
  const a = (s.angle * Math.PI) / 180;
  const box = Math.min(small ? 30 : 60, laneH * 0.3);
  const x0 = small ? 14 : 40;
  const x1 = view.w - (small ? 44 : 90) - box; // room on the right for the F arrow
  const unit = Math.min(small ? 36 : 80, laneH * 0.35) / Math.max(F.force, Fms.force); // px per N, F and Fms to the same scale
  const sz = small ? 11 : 13;
  for (const k of [1, 2]) {
    const ly = top + laneH * (k - 1);
    const floor = ly + laneH - (small ? 6 : 36);
    laneHeader(ctx, s, k, x0, ly + 8, small, "left");
    ctx.fillStyle = COLORS.muted;
    ctx.fillRect(x0 - 10, floor, x1 - x0 + box + 20, 3);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.muted;
    ctx.strokeRect(x1, floor - box, box, box);
    ctx.setLineDash([]);
    const bx = x0 + progress(s, k) * (x1 - x0);
    drawBox(ctx, bx, floor - box, box, box, "#d9b37c");
    const cx = bx + box / 2;
    const cy = floor - box / 2;
    // P and N are perpendicular to s (α = 90°): drawn short, they do no work
    const v = box / 2 + (small ? 6 : 12);
    arrow(ctx, cx, cy, cx, cy + v, COLORS.red, 2);
    arrow(ctx, cx, cy, cx, cy - v, COLORS.muted, 2);
    label(ctx, "N", cx - 4, cy - v + 2, { align: "right", color: COLORS.muted, bold: true, size: sz });
    label(ctx, "P", cx + 5, cy + v - 2, { color: COLORS.red, bold: true, size: sz });
    const fl = Math.max(14, F.force * unit);
    if (s.angle > 0) {
      ctx.strokeStyle = COLORS.green;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(22, fl * 0.5), -a, 0);
      ctx.stroke();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + fl, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    arrow(ctx, cx, cy, cx + fl * Math.cos(a), cy - fl * Math.sin(a), COLORS.green, 2.5);
    label(ctx, "F", cx + fl * Math.cos(a) + 5, cy - fl * Math.sin(a) - 4, { color: COLORS.green, bold: true, size: sz + 1 });
    if (!small) label(ctx, "α", cx + Math.min(22, fl * 0.5) + 6, cy - 7, { color: COLORS.green, size: 12 });
    const fm = Math.max(10, Fms.force * unit);
    arrow(ctx, bx, floor - 4, bx - fm, floor - 4, COLORS.orange, 2.5);
    label(ctx, "Fms", bx - fm - 4, floor - 12, { align: "right", color: COLORS.orange, bold: true, size: sz });
    if (!small) {
      arrow(ctx, x0, floor + 12, x1, floor + 12, COLORS.orange, 1.5);
      label(ctx, `s = ${fmt(s.distance, 1)} m`, (x0 + x1) / 2, floor + 25, { align: "center", size: 12, color: COLORS.orange, bold: true });
    }
  }
}

mount({
  slug: "cong-va-cong-suat",
  version: "1.0.0",
  title: "Công và công suất",
  hint: "Chọn công việc và hai máy rồi bấm ▶ Chạy để xem máy nào làm xong trước. Máy 1 cần xong trong thời hạn cho phép.",
  initialState,
  timeScale: s => Math.max(duration(s, 1), duration(s, 2)) / 4, // the slower machine takes 4 s on screen
  step(s, dt, api) {
    for (const k of step(s, dt)) finish(s, k, api);
    if (s.time >= Math.max(duration(s, 1), duration(s, 2))) api.pause();
  },
  controls: [
    {
      type: "select",
      key: "task",
      label: "Công việc",
      options: [
        { value: "lift", label: "Nâng vật lên cao" },
        { value: "push", label: "Kéo thùng trên sàn" },
      ],
    },
    { type: "slider", key: "mass", label: "Khối lượng m", min: 5, max: 500, step: 5, unit: "kg", digits: 0 },
    { type: "slider", key: "distance", label: "Quãng đường s", min: 1, max: 20, step: 0.5, unit: "m", digits: 1, format: (v, s) => `${s.task === "lift" ? "h" : "s"} = ${fmt(v, 1)} m` },
    { type: "slider", key: "angle", label: "Góc α giữa dây kéo và mặt sàn", min: 0, max: 60, step: 1, unit: "°", digits: 0, visible: s => s.task === "push" },
    { type: "slider", key: "mu", label: "Hệ số ma sát μ", min: 0.05, max: 0.8, step: 0.05, digits: 2, visible: s => s.task === "push" },
    { type: "slider", key: "efficiency", label: "Hiệu suất H", min: 10, max: 100, step: 5, unit: "%", digits: 0 },
    { type: "heading", label: "Hai máy" },
    { type: "select", key: "machine1", label: "Máy 1", options: Object.entries(MACHINES).map(([value, m]) => ({ value, label: m.power ? `${m.name} (${fmt(m.power, 0)} W)` : m.name })) },
    { type: "slider", key: "power1", label: "Công suất máy 1", min: 0.1, max: 20, step: 0.1, unit: "kW", digits: 1, visible: s => s.machine1 === "motor" },
    { type: "select", key: "machine2", label: "Máy 2", options: Object.entries(MACHINES).map(([value, m]) => ({ value, label: m.power ? `${m.name} (${fmt(m.power, 0)} W)` : m.name })) },
    { type: "slider", key: "power2", label: "Công suất máy 2", min: 0.1, max: 20, step: 0.1, unit: "kW", digits: 1, visible: s => s.machine2 === "motor" },
    { type: "slider", key: "targetTime", label: "Thời hạn cho máy 1", min: 1, max: 120, step: 1, unit: "s", digits: 0 },
  ].map(c => (c.key ? { ...c, onChange: restart } : c)),
  readouts: [
    { label: "Lực kéo F", value: s => `${fmt(forces(s)[0].force, 1)} N, α = ${fmt(forces(s)[0].alpha, 0)}°` },
    { label: "Công có ích A = F·s·cosα", value: s => J(task(s).useful) },
    { label: "Công toàn phần A_tp = A/H", value: s => J(task(s).total) },
    { label: "Công của trọng lực", value: s => J(forces(s)[1].work) },
    { label: "Công của phản lực N", value: s => (s.task === "push" ? J(forces(s)[2].work) : "không có") },
    { label: "Công của lực ma sát", value: s => (s.task === "push" ? J(forces(s)[3].work) : "không có") },
    { label: "Máy 1: t = A_tp/P", value: s => `${fmt(duration(s, 1), 1)} s` },
    { label: "Máy 2: t = A_tp/P", value: s => `${fmt(duration(s, 2), 1)} s` },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 430;
    const title = small ? "A = F·s·cosα   P = A/t   H = A/A_tp" : "A = F·s·cosα      P = A/t      H = A_ci / A_tp";
    label(ctx, title, view.w / 2, small ? 12 : 22, { align: "center", bold: true, size: small ? 12 : 16 });
    const top = small ? 26 : 44;
    const bottom = view.h - (small ? 26 : 58);
    if (s.task === "push") drawPush(ctx, s, view, top, bottom, small);
    else drawLift(ctx, s, view, top, bottom, small);
    const t1 = duration(s, 1);
    const verdict = t1 <= s.targetTime ? `Máy 1 kịp thời hạn ${fmt(s.targetTime, 0)} s` : `Máy 1 không kịp thời hạn ${fmt(s.targetTime, 0)} s`;
    label(ctx, verdict, view.w / 2, view.h - (small ? 18 : 24), { align: "center", size: small ? 11 : 13, bold: true, color: t1 <= s.targetTime ? COLORS.green : COLORS.red });
    label(ctx, "Hình không theo tỉ lệ · 1 mã lực (HP) ≈ 746 W", view.w / 2, view.h - (small ? 6 : 9), { align: "center", size: small ? 10 : 11, color: COLORS.muted });
  },
});
