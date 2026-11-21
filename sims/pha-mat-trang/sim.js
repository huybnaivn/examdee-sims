import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, PHASES, PERIOD, angleOf, dayOf, litFraction, litSide, phaseIndex, lunarLabel, targetOf, matches, newQuestion } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const LIGHT = "#f6f1d3";
const DARK = "#3a4560";
const SKY = "#1b2238";
const RAD = Math.PI / 180;

const hidden = s => s.quiz && !s.solved; // in quiz mode the phase name is the answer

function layout(view) {
  const pad = 10;
  // the top view is S high and 1,12·S wide: a strip of sunlight on the left, then the orbit
  const S = Math.max(110, Math.min(view.h - 30, (view.w * 0.62) / 1.12));
  const top = { x: pad, y: Math.max(4, (view.h - 20 - S) / 2), S, W: S * 1.12 };
  const E = { x: top.x + S * 0.62, y: top.y + S / 2 };
  const r = S * 0.34;
  const side = { x: top.x + top.W + 12, y: 8, w: view.w - top.x - top.W - 12 - pad, h: view.h - 16 };
  return { top, E, r, side, small: view.w < 560 || view.h < 380 };
}
const moonAt = (L, deg) => ({ x: L.E.x - L.r * Math.cos(deg * RAD), y: L.E.y + L.r * Math.sin(deg * RAD) });

/** The disc as seen from Earth (northern hemisphere): lit part on the right while waxing. */
function disc(ctx, x, y, R, deg) {
  const side = litSide(deg);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fillStyle = DARK;
  ctx.fill();
  ctx.clip();
  if (side !== "none") {
    ctx.fillStyle = LIGHT;
    if (side === "all") ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
    else {
      ctx.fillRect(side === "right" ? x : x - R, y - R, R, 2 * R);
      // terminator: half-ellipse of semi-axis R·|cos θ|, dark for a crescent, lit for a gibbous Moon
      ctx.fillStyle = litFraction(deg) < 0.5 ? DARK : LIGHT;
      ctx.beginPath();
      ctx.ellipse(x, y, R * Math.abs(Math.cos(deg * RAD)), R, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = "#8a93a8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();
}

/** A body seen from above: the half facing the Sun (left) is lit. */
function body(ctx, x, y, R, lit, dark) {
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.arc(x, y, R, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.fill();
  ctx.strokeStyle = "#8a93a8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();
}

/** Draw text wrapped to `maxW`, centred on x. Returns the y after the last line. */
function wrap(ctx, text, x, y, maxW, opts) {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? line + " " + word : word;
    if (line && ctx.measureText(next).width > maxW) {
      label(ctx, line, x, y, { ...opts, align: "center" });
      y += opts.size * 1.3;
      line = word;
    } else line = next;
  }
  label(ctx, line, x, y, { ...opts, align: "center" });
  return y + opts.size * 1.3;
}

function placed(s, api) {
  const deg = angleOf(s.day);
  api.emit("moon-placed", { day: s.day, phase: phaseIndex(deg), lit: litFraction(deg) }, "result");
  if (s.quiz && !s.solved && matches(s)) {
    s.solved = true;
    api.emit("phase-matched", { target: targetOf(s), day: s.day }, "goal");
  }
}

mount({
  slug: "pha-mat-trang",
  version: "1.0.0",
  title: "Các pha của Mặt Trăng",
  hint: "Kéo Mặt Trăng trên quỹ đạo (hoặc bấm Chạy) và xem hình dạng Mặt Trăng nhìn từ Trái Đất.",
  initialState,
  step: (s, dt) => step(s, dt),
  controls: [
    {
      type: "slider",
      key: "day",
      label: "Số ngày sau trăng mới",
      min: 0,
      max: PERIOD,
      step: 0.1,
      format: v => `${fmt(v, 1)} ngày (${lunarLabel(v)} âm lịch)`,
      onCommit: placed,
    },
    { type: "slider", key: "speed", label: "Tốc độ khi chạy", min: 0.5, max: 5, step: 0.5, unit: "ngày/giây", digits: 1 },
    { type: "checkbox", key: "quiz", label: "Chế độ câu hỏi: đặt Mặt Trăng đúng pha được hỏi", onChange: s => (s.solved = false) },
    {
      type: "button",
      label: "Câu hỏi mới",
      primary: true,
      visible: s => s.quiz,
      action(s, api) {
        api.emit("new-question", { target: newQuestion(s) }, "action");
      },
    },
  ],
  readouts: [
    { label: "Góc θ (tính từ trăng mới)", value: s => `${fmt(angleOf(s.day), 0)}°` },
    { label: "Phần đĩa được chiếu sáng", value: s => `${fmt(litFraction(angleOf(s.day)) * 100, 0)} %` },
    { label: "Ngày âm lịch", value: s => lunarLabel(s.day) },
    { label: "Pha", value: s => (hidden(s) ? "?" : PHASES[phaseIndex(angleOf(s.day))]) },
  ],
  pointer: {
    down(p, s, api, view) {
      const L = layout(view);
      const m = moonAt(L, angleOf(s.day));
      const d = Math.hypot(p.x - L.E.x, p.y - L.E.y);
      if (Math.hypot(p.x - m.x, p.y - m.y) > 26 && Math.abs(d - L.r) > 22) return false;
      api.pause();
      s._drag = true;
      this.move(p, s, api, view);
    },
    move(p, s, api, view) {
      const L = layout(view);
      s.day = Math.round(dayOf(Math.atan2(p.y - L.E.y, -(p.x - L.E.x)) / RAD) * 10) / 10 % PERIOD;
    },
    up(p, s, api) {
      s._drag = false;
      placed(s, api);
    },
  },
  draw(ctx, s, view) {
    const L = layout(view);
    const { top, E, r, side, small } = L;
    const deg = angleOf(s.day);
    const size = small ? 11 : 13;

    // ---- top view ----
    ctx.fillStyle = "#eef2fa";
    ctx.fillRect(top.x, top.y, top.W, top.S);
    const rays = small ? 4 : 6;
    for (let i = 0; i < rays; i++) {
      const y = top.y + (top.S * (i + 0.5)) / rays;
      arrow(ctx, top.x + 4, y, top.x + top.S * 0.1, y, COLORS.orange, 2);
    }
    label(ctx, small ? "Ánh sáng Mặt Trời" : "Ánh sáng Mặt Trời chiếu tới", top.x + 4, top.y + 9, { size: size - 1, color: COLORS.orange, bold: true });

    ctx.strokeStyle = "#9aa6bf";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(E.x, E.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // direction of motion (anticlockwise seen from above the North Pole)
    const a = moonAt(L, 225);
    arrow(ctx, a.x + 9, a.y + 9, a.x - 7, a.y - 7, "#9aa6bf", 2);

    // what is seen from Earth at each of the eight positions (hidden in quiz mode)
    if (!s.quiz) {
      const ri = r + top.S * 0.11;
      for (let i = 0; i < 8; i++) {
        disc(ctx, E.x - ri * Math.cos(i * 45 * RAD), E.y + ri * Math.sin(i * 45 * RAD), Math.max(5, top.S * 0.035), i * 45);
      }
    }

    const er = Math.max(9, top.S * 0.06);
    body(ctx, E.x, E.y, er, "#7fb3ff", "#1f3f7a");
    label(ctx, "Trái Đất", E.x, E.y + er + 9, { size: size - 1, align: "center" });

    const m = moonAt(L, deg);
    const mr = Math.max(7, top.S * 0.035);
    // the half of the Moon that faces Earth: this is what we see
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 3;
    const toE = Math.atan2(E.y - m.y, E.x - m.x);
    ctx.beginPath();
    ctx.arc(m.x, m.y, mr + 3, toE - Math.PI / 2, toE + Math.PI / 2);
    ctx.stroke();
    body(ctx, m.x, m.y, mr, LIGHT, DARK);
    if (s._drag) {
      ctx.strokeStyle = COLORS.blue;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(m.x, m.y, mr + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    label(ctx, "Mặt Trăng", m.x, m.y - mr - 10, { size: size - 1, align: "center", bold: true });

    label(ctx, small ? "Nhìn từ trên cực Bắc · không theo tỉ lệ" : "Nhìn từ phía trên cực Bắc. Kích thước, khoảng cách không theo tỉ lệ.", top.x, top.y + top.S + 10, { size: small ? 10 : 12, color: COLORS.muted });
    if (!small) label(ctx, "Viền xanh: nửa Mặt Trăng hướng về Trái Đất", top.x, top.y + top.S + 26, { size: 12, color: COLORS.blue });

    // ---- view from Earth ----
    const cx = side.x + side.w / 2;
    let y = side.y + size;
    if (s.quiz) {
      y = wrap(ctx, "Đặt Mặt Trăng để thấy:", cx, y, side.w, { size, color: COLORS.muted });
      y = wrap(ctx, PHASES[targetOf(s)], cx, y, side.w, { size: size + 1, bold: true, color: COLORS.purple });
      y += 4;
    }
    const R = Math.max(18, Math.min(side.w * 0.34, side.h * (s.quiz ? 0.17 : 0.22), 80));
    const box = { x: cx - R - 14, y, w: 2 * R + 28, h: 2 * R + 34 };
    ctx.fillStyle = SKY;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 8);
    ctx.fill();
    label(ctx, small ? "Nhìn từ Trái Đất" : "Nhìn từ Trái Đất (Bắc bán cầu)", cx, box.y + 11, { size: size - 2, color: "#c9d2e8", align: "center" });
    disc(ctx, cx, box.y + 22 + R, R, deg);
    y = box.y + box.h + size + 2;
    if (hidden(s)) {
      y = wrap(ctx, "Pha: ?", cx, y, side.w, { size: size + 1, bold: true });
    } else {
      y = wrap(ctx, PHASES[phaseIndex(deg)], cx, y, side.w, { size: size + 1, bold: true, color: s.quiz ? COLORS.green : COLORS.ink });
      if (s.quiz) y = wrap(ctx, "Đúng rồi!", cx, y, side.w, { size, bold: true, color: COLORS.green });
    }
    y = wrap(ctx, `${lunarLabel(s.day)} âm lịch`, cx, y + 2, side.w, { size, color: COLORS.muted });
    y = wrap(ctx, `θ = ${fmt(deg, 0)}°`, cx, y, side.w, { size, color: COLORS.muted });
    y = wrap(ctx, `Phần sáng: ${fmt(litFraction(deg) * 100, 0)} %`, cx, y, side.w, { size, color: COLORS.muted });
    if (!small && y + 40 < side.y + side.h) {
      wrap(ctx, "Trăng đầu tháng sáng ở bên phải, cuối tháng sáng ở bên trái.", cx, y + 8, side.w, { size: 12, color: COLORS.muted });
    }
  },
});
