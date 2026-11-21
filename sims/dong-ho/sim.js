import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { initialState, minuteAngle, hourAngle, words, to12, elapsed, duration, matches, dragMinute, dragHour, total, split, newTarget, pad } from "./model.js";

const HOUR = COLORS.blue;
const MINUTE = COLORS.red;

// Keys without a control can be forged by the host: keep them whole and in range.
const target = s => ({ hour: (((Math.round(s.targetHour) || 12) % 12) + 12) % 12 || 12, minute: (((Math.round(s.targetMinute) || 0) % 60) + 60) % 60 });
const targetText = s => {
  const t = target(s);
  const w = words(t.hour, t.minute);
  return t.minute > 30 ? w.alt : w.main;
};
const spoken = (h, m) => {
  const { hour, period } = to12(h);
  return `${words(hour, m).main} ${period}`;
};

// One goal per target, when the hands first show it.
const check = (s, api) => {
  const ok = s.mode === "set" && matches(s.hour, s.minute, target(s).hour, target(s).minute);
  if (ok && !s.solved) api.emit("target-reached", { hours: target(s).hour, minutes: target(s).minute }, "goal");
  s.solved = ok;
};

function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const top = small ? 50 : 84;
  const bottom = small ? 40 : 66;
  const R = Math.max(40, Math.min(view.w / 2 - 30, (view.h - top - bottom) / 2 - 18));
  return { small, top, bottom, R, cx: view.w / 2, cy: top + (view.h - top - bottom) / 2 };
}

const polar = (g, deg, r) => [g.cx + r * Math.sin((deg * Math.PI) / 180), g.cy - r * Math.cos((deg * Math.PI) / 180)];
const angleOf = (g, p) => ((Math.atan2(p.x - g.cx, g.cy - p.y) * 180) / Math.PI + 360) % 360;
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

function hand(ctx, g, deg, len, width, color) {
  const [x, y] = polar(g, deg, len);
  const [bx, by] = polar(g, deg + 180, len * 0.15);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(x, y);
  ctx.stroke();
}

function face(ctx, g) {
  const { R } = g;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = Math.max(3, R * 0.035);
  ctx.beginPath();
  ctx.arc(g.cx, g.cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    const [x1, y1] = polar(g, i * 6, R * (big ? 0.86 : 0.92));
    const [x2, y2] = polar(g, i * 6, R * 0.97);
    ctx.strokeStyle = big ? COLORS.ink : COLORS.muted;
    ctx.lineWidth = big ? 3 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (big) {
      const [mx, my] = polar(g, i * 6, R + 13); // minutes, outside the rim
      label(ctx, String(i), mx, my, { align: "center", size: g.small ? 10 : 12, color: COLORS.muted });
    }
  }
  for (let h = 1; h <= 12; h++) {
    const [x, y] = polar(g, h * 30, R * 0.72);
    label(ctx, String(h), x, y, { align: "center", size: Math.max(13, Math.round(R * 0.17)), bold: true });
  }
}

mount({
  slug: "dong-ho",
  version: "1.0.0",
  title: "Xem đồng hồ",
  hint: "Kéo kim dài (kim phút, màu đỏ) hoặc kim ngắn (kim giờ, màu xanh). Kim phút quay một vòng thì kim giờ đi thêm một số.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "read", label: "Đọc giờ" },
        { value: "set", label: "Quay kim đúng giờ" },
        { value: "elapsed", label: "Tính thời gian đã trôi qua" },
      ],
      // Hands that already show the target when the mode is chosen are not an achievement.
      onChange: s => {
        s.solved = matches(s.hour, s.minute, target(s).hour, target(s).minute);
      },
    },
    { type: "button", label: "Giờ khác", primary: true, visible: s => s.mode === "set", event: "new-target", action: s => {
      const t = newTarget(Math.random, { hour: s.hour, minute: s.minute });
      s.targetHour = t.hour;
      s.targetMinute = t.minute;
      s.solved = false;
    } },
    { type: "slider", key: "hour", label: "Giờ", min: 0, max: 23, step: 1, format: v => `${v} giờ`, onCommit: check },
    { type: "slider", key: "minute", label: "Phút", min: 0, max: 59, step: 1, format: v => `${v} phút`, onCommit: check },
    { type: "heading", label: "Giờ bắt đầu", visible: s => s.mode === "elapsed" },
    { type: "slider", key: "startHour", label: "Giờ bắt đầu", min: 0, max: 23, step: 1, format: v => `${v} giờ`, visible: s => s.mode === "elapsed" },
    { type: "slider", key: "startMinute", label: "Phút bắt đầu", min: 0, max: 59, step: 1, format: v => `${v} phút`, visible: s => s.mode === "elapsed" },
    { type: "button", label: "Lấy giờ trên đồng hồ làm giờ bắt đầu", visible: s => s.mode === "elapsed", event: "start-set", action: s => {
      s.startHour = s.hour;
      s.startMinute = s.minute;
    } },
  ],
  readouts: [
    { label: "Đồng hồ điện tử", value: s => `${pad(s.hour)}:${pad(s.minute)}` },
    { label: "Đọc là", value: s => spoken(s.hour, s.minute) },
    { label: "Thời gian đã trôi qua", value: s => (s.mode === "elapsed" ? duration(elapsed(s.startHour, s.startMinute, s.hour, s.minute)) : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      const r = Math.hypot(p.x - g.cx, p.y - g.cy);
      if (r > g.R * 1.1) return false;
      const a = angleOf(g, p);
      const dm = gap(a, minuteAngle(s.minute));
      const dh = gap(a, hourAngle(s.hour, s.minute));
      const near = 28;
      if (dm > near && dh > near) return false;
      // Both near (hands overlap): the far end of the face belongs to the long minute hand.
      s._hand = dm <= near && (dh > near || r > g.R * 0.55) ? "minute" : "hour";
      s._from = total(s.hour, s.minute);
    },
    move(p, s, api, view) {
      if (!s._hand) return;
      const a = angleOf(geom(view), p);
      const t = total(s.hour, s.minute);
      Object.assign(s, split(s._hand === "minute" ? dragMinute(t, a) : dragHour(t, a)));
    },
    up(p, s, api) {
      const moved = s._hand && s._from !== total(s.hour, s.minute);
      s._hand = null;
      if (!moved) return;
      const data = { hours: s.hour, minutes: s.minute };
      if (s.mode === "elapsed") data.elapsedMinutes = elapsed(s.startHour, s.startMinute, s.hour, s.minute);
      api.emit("time-set", data, "result");
      check(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const big = g.small ? 17 : 24;
    const sub = g.small ? 13 : 16;
    const w = words(s.hour, s.minute);
    if (s.mode === "read") {
      label(ctx, w.main, view.w / 2, g.small ? 16 : 26, { align: "center", size: big, bold: true });
      if (w.alt) label(ctx, `hay ${w.alt}`, view.w / 2, g.small ? 37 : 58, { align: "center", size: sub, color: COLORS.muted });
    } else if (s.mode === "set") {
      label(ctx, `Quay kim chỉ ${targetText(s)}`, view.w / 2, g.small ? 16 : 26, { align: "center", size: big, bold: true });
      const ok = matches(s.hour, s.minute, target(s).hour, target(s).minute);
      label(ctx, ok ? "Đúng rồi!" : "Kéo kim cho đúng nhé", view.w / 2, g.small ? 37 : 58, {
        align: "center",
        size: sub,
        bold: ok,
        color: ok ? COLORS.green : COLORS.muted,
      });
    } else {
      const d = elapsed(s.startHour, s.startMinute, s.hour, s.minute);
      label(ctx, `Từ ${pad(s.startHour)}:${pad(s.startMinute)} đến ${pad(s.hour)}:${pad(s.minute)}`, view.w / 2, g.small ? 16 : 26, { align: "center", size: big, bold: true });
      label(ctx, `Đã trôi qua: ${duration(d)}`, view.w / 2, g.small ? 37 : 58, { align: "center", size: sub, bold: true, color: COLORS.orange });
    }

    face(ctx, g);
    if (s.mode === "elapsed") {
      // the path of the hour hand, then the start time as faint hands
      const a0 = hourAngle(s.startHour, s.startMinute);
      const d = elapsed(s.startHour, s.startMinute, s.hour, s.minute);
      ctx.strokeStyle = "rgba(240, 140, 46, 0.45)";
      ctx.lineWidth = g.R * 0.1;
      ctx.lineCap = "butt";
      ctx.beginPath();
      const sweep = Math.min(d, 719.5) / 2; // degrees of the hour hand, at most one round
      ctx.arc(g.cx, g.cy, g.R * 0.5, ((a0 - 90) * Math.PI) / 180, ((a0 + sweep - 90) * Math.PI) / 180);
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      hand(ctx, g, a0, g.R * 0.5, Math.max(5, g.R * 0.06), COLORS.muted);
      hand(ctx, g, minuteAngle(s.startMinute), g.R * 0.8, Math.max(3, g.R * 0.035), COLORS.muted);
      ctx.globalAlpha = 1;
    }
    hand(ctx, g, hourAngle(s.hour, s.minute), g.R * 0.5, Math.max(6, g.R * 0.065), HOUR);
    hand(ctx, g, minuteAngle(s.minute), g.R * 0.82, Math.max(3.5, g.R * 0.035), MINUTE);
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, Math.max(5, g.R * 0.05), 0, Math.PI * 2);
    ctx.fill();

    // digital clock
    const y = view.h - g.bottom / 2;
    const text = `${pad(s.hour)}:${pad(s.minute)}`;
    const bw = g.small ? 70 : 96;
    const bh = g.small ? 26 : 36;
    const bx = g.small ? view.w / 2 - bw / 2 : view.w / 2 - bw - 8;
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.roundRect(bx, y - bh / 2, bw, bh, 6);
    ctx.fill();
    label(ctx, text, bx + bw / 2, y + 1, { align: "center", size: g.small ? 18 : 24, bold: true, color: "#7CF5B5" });
    if (!g.small) label(ctx, `= ${spoken(s.hour, s.minute)}`, view.w / 2, y, { size: 16, color: COLORS.muted });
  },
});
