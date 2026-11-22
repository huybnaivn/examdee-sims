import { mount, COLORS, label, arrow, fmt, clamp } from "../../kit/v1/kit.js";
import {
  MATERIALS, T_ROOM, T_HOT, T_MELT, DEPTH, REPORT_TIME, STILL_TIME,
  initialState, step, resetRun, rodTemperature, fallTimes, fallenCount, parsePrediction, predict, predictionCorrect,
  buoyantAcceleration, convectionSpeed, velocity, advect,
  absorbedPower, reflectedPower, lostPower, equilibriumTemperature,
} from "./model.js";

const ROWS = [2, 0, 3, 1]; // material shown in each row, top to bottom; deliberately not sorted by conductivity
const ROD_CM = 12;
const isSmall = view => view.w < 520 || view.h < 420;
const clock = t => (t < 120 ? `${fmt(t, 1)} s` : `${Math.floor(t / 60)} phút ${Math.floor(t % 60)} s`);
const mix = (a, b, w) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * w))})`;
const COLD = [185, 196, 214];
const WARM = [240, 140, 46];
const HOT = [229, 72, 77];
const BLUE = [47, 111, 237];
// rod colour; the square root makes the first few tens of degrees visible
const rodColour = T => {
  const f = 2 * Math.sqrt(clamp((T - T_ROOM) / (T_HOT - T_ROOM), 0, 1));
  return f < 1 ? mix(COLD, WARM, f) : mix(WARM, HOT, f - 1);
};

const freshRun = s => {
  resetRun(s);
  delete s._p;
  delete s._trail;
};

const pick = (s, api, i) => {
  const position = predict(s, i);
  if (position) api.emit("predict", { material: i, position }, "action");
};

// ---------- conduction ----------
function condGeom(view) {
  const small = isSmall(view);
  const pad = small ? 10 : 36;
  const top = small ? 46 : 90;
  const bottom = small ? 52 : 100;
  const bw = small ? 20 : 40;
  return { small, pad, top, bw, rowH: (view.h - top - bottom) / 4, x0: pad + bw, x1: view.w - pad - (small ? 14 : 24) };
}

function drawConduction(ctx, s, view) {
  const g = condGeom(view);
  const { small, pad, top, rowH, x0, x1 } = g;
  const size = small ? 11 : 14;
  const times = fallTimes(s);
  const guess = parsePrediction(s.prediction);
  const bottomY = top + 4 * rowH;
  const xw = x0 + (s.distance / ROD_CM) * (x1 - x0);
  const thick = small ? 9 : 16;

  label(ctx, "Dẫn nhiệt: sáp trên thanh nào rơi trước?", pad, small ? 11 : 24, { size: small ? 13 : 18, bold: true });
  label(ctx, `t = ${clock(s.time)}`, view.w - pad, small ? 11 : 24, { size: small ? 13 : 18, bold: true, align: "right", color: COLORS.blue });
  label(ctx, small ? "Bốn thanh cùng cỡ, mỗi thanh gắn một đinh bằng sáp." : "Bốn thanh cùng kích thước được nung nóng một đầu; trên mỗi thanh gắn một chiếc đinh bằng sáp.", pad, small ? 27 : 50, { size: small ? 10 : 13, color: COLORS.muted });

  // heat source
  const hot = ctx.createLinearGradient(pad, 0, x0, 0);
  hot.addColorStop(0, "#f08c2e");
  hot.addColorStop(1, "#e5484d");
  ctx.fillStyle = hot;
  ctx.fillRect(pad, top, g.bw, 4 * rowH);
  label(ctx, `Nguồn nhiệt ${T_HOT} °C`, pad, top - (small ? 7 : 10), { size: small ? 10 : 12, color: COLORS.red, bold: true });

  // where the wax sits
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(xw, top);
  ctx.lineTo(xw, bottomY);
  ctx.stroke();
  ctx.setLineDash([]);

  ROWS.forEach((i, r) => {
    const m = MATERIALS[i];
    const y = top + r * rowH + rowH * 0.5;
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    for (let j = 0; j <= 16; j++) grad.addColorStop(j / 16, rodColour(rodTemperature(m, ((j / 16) * ROD_CM) / 100, s.time)));
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y - thick / 2, x1 - x0, thick);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y - thick / 2, x1 - x0, thick);

    // name, prediction, and (once the result is known) the conductivity
    const ty = y - thick / 2 - (small ? 8 : 12);
    let text = m.name;
    if (s.reported) text += `  k = ${fmt(m.k, 0)} W/(m·K)`;
    label(ctx, text, x0 + 6, ty, { size, bold: true });
    const rank = guess.indexOf(i) + 1;
    if (rank) {
      ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      const right = s.reported && guess.length === 4 ? [...times].sort((a, b) => a - b).indexOf(times[i]) + 1 === rank : null;
      label(ctx, `${small ? "đoán" : "dự đoán"}: thứ ${rank}${right == null ? "" : right ? " ✓" : " ✗"}`, x0 + 14 + ctx.measureText(text).width, ty, {
        size, color: right == null ? COLORS.blue : right ? COLORS.green : COLORS.red,
      });
    }
    // wax and nail
    const fallen = s.time >= times[i];
    const status = fallen ? `rơi lúc ${clock(times[i])}` : `${small ? "sáp" : "chỗ gắn sáp"}: ${fmt(rodTemperature(m, s.distance / 100, s.time), 0)} °C`;
    label(ctx, status, x1 - 4, ty, { size: small ? 10 : 13, align: "right", color: fallen ? COLORS.green : COLORS.muted });
    const nail = small ? 9 : 16;
    ctx.strokeStyle = ctx.fillStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (fallen) {
      const fy = Math.min(top + (r + 1) * rowH - 4, y + thick / 2 + nail + 8);
      ctx.moveTo(xw - nail / 2, fy);
      ctx.lineTo(xw + nail / 2, fy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(xw - nail / 2, fy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(xw, y + thick / 2 + 2);
      ctx.lineTo(xw, y + thick / 2 + nail);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(xw, y + thick / 2 + nail, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.yellow;
      ctx.beginPath();
      ctx.arc(xw, y + thick / 2 + 2, small ? 4 : 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // ruler
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let cm = 0; cm <= ROD_CM; cm++) {
    const x = x0 + (cm / ROD_CM) * (x1 - x0);
    ctx.moveTo(x, bottomY + 2);
    ctx.lineTo(x, bottomY + (cm % 2 ? 5 : 8));
  }
  ctx.stroke();
  for (let cm = 0; cm <= ROD_CM; cm += 2) {
    label(ctx, cm === ROD_CM ? `${cm} cm` : `${cm}`, x0 + (cm / ROD_CM) * (x1 - x0), bottomY + (small ? 14 : 18), { size: small ? 10 : 12, align: "center", color: COLORS.muted });
  }

  // messages
  let status;
  if (s.reported) {
    status = "Thứ tự rơi: đồng → nhôm → sắt → thủy tinh.";
    if (guess.length === 4) status += predictionCorrect(s) ? " Dự đoán đúng!" : " Dự đoán chưa đúng.";
  } else if (s.time > 0) status = `Đã rơi ${fallenCount(s)}/4 đinh sáp…`;
  else if (guess.length === 4) status = "Đã dự đoán xong. Bấm ▶ Chạy để bật nguồn nhiệt.";
  else status = small ? "Bấm các thanh theo thứ tự em đoán sáp rơi, rồi bấm ▶ Chạy." : "Bấm lần lượt vào các thanh theo thứ tự em dự đoán sáp sẽ rơi, rồi bấm ▶ Chạy.";
  const left = times[3] - s.time;
  const note =
    s.reported && left > 0
      ? `Thủy tinh dẫn nhiệt kém: còn ${clock(left)} nữa sáp mới rơi${small ? "." : " (tăng tốc độ mô phỏng để xem)."}`
      : small
        ? "Mô hình 1 chiều, bỏ qua tỏa nhiệt ra không khí."
        : `Mô hình một chiều, bỏ qua tỏa nhiệt ra không khí; đinh rơi khi chỗ gắn sáp đạt ${T_MELT} °C.`;
  const my = bottomY + (small ? 28 : 46);
  label(ctx, status, view.w / 2, my, { size: small ? 11 : 15, bold: true, align: "center", color: s.reported && guess.length === 4 ? (predictionCorrect(s) ? COLORS.green : COLORS.red) : COLORS.ink });
  label(ctx, note, view.w / 2, my + (small ? 13 : 24), { size: small ? 10 : 12, align: "center", color: COLORS.muted });
}

// ---------- convection ----------
const ARROWS = {
  left: [[0.1, 0.5], [0.5, 0.9], [0.9, 0.5], [0.5, 0.1]],
  center: [[0.5, 0.5], [0.28, 0.9], [0.72, 0.9], [0.07, 0.5], [0.93, 0.5], [0.28, 0.1], [0.72, 0.1]],
  top: [],
};
// qualitative temperature 0…1, for colouring only
function warmth(s, x, y) {
  if (s.heater === "top") return clamp((y - 0.62) / 0.2, 0, 1);
  const A = convectionSpeed(s) / DEPTH || 1;
  return clamp(0.5 + (0.4 * velocity(s, x, y).vy) / A + 0.3 * (y - 0.5), 0, 1);
}

function flame(ctx, x, y, h) {
  for (const [k, colour] of [[1, COLORS.orange], [0.55, COLORS.yellow]]) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x, y - h * k);
    ctx.bezierCurveTo(x + h * 0.45 * k, y - h * 0.4 * k, x + h * 0.3 * k, y, x, y);
    ctx.bezierCurveTo(x - h * 0.3 * k, y, x - h * 0.45 * k, y - h * 0.4 * k, x, y - h * k);
    ctx.fill();
  }
}

function drawConvection(ctx, s, view) {
  const small = isSmall(view);
  const pad = small ? 10 : 36;
  const top = small ? 50 : 100;
  const bottom = small ? 68 : 128;
  const bh = view.h - top - bottom;
  const bw = Math.min(view.w - 2 * pad - (small ? 40 : 120), bh * 1.5, 560);
  const bx = (view.w - bw) / 2;
  const by = top;
  const X = x => bx + x * bw;
  const Y = y => by + bh - y * bh;
  const v = convectionSpeed(s);

  label(ctx, "Đối lưu trong cốc nước", pad, small ? 11 : 24, { size: small ? 13 : 18, bold: true });
  label(ctx, `t = ${clock(s.time)}`, view.w - pad, small ? 11 : 24, { size: small ? 13 : 18, bold: true, align: "right", color: COLORS.blue });
  label(ctx, small ? "Nước nóng nhẹ hơn nên đi lên, nước lạnh hơn chìm xuống." : "Nước nóng nở ra, nhẹ hơn nên đi lên; nước lạnh hơn, nặng hơn nên chìm xuống.", pad, small ? 27 : 50, { size: small ? 10 : 13, color: COLORS.muted });

  // water, warm region
  ctx.fillStyle = "#e4f0ff";
  ctx.fillRect(bx, by, bw, bh);
  const hx = s.heater === "center" ? 0.5 : 0.14;
  if (s.heater === "top") {
    const warm = ctx.createLinearGradient(0, by, 0, by + bh * 0.4);
    warm.addColorStop(0, "rgba(229, 72, 77, 0.4)");
    warm.addColorStop(1, "rgba(229, 72, 77, 0)");
    ctx.fillStyle = warm;
    ctx.fillRect(bx, by, bw, bh * 0.4);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();
    const warm = ctx.createRadialGradient(X(hx), Y(0), 2, X(hx), Y(0), bh * 0.75);
    warm.addColorStop(0, "rgba(229, 72, 77, 0.45)");
    warm.addColorStop(1, "rgba(229, 72, 77, 0)");
    ctx.fillStyle = warm;
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
  }

  // tracer particles with a short tail pointing back along the flow
  s._p ??= Array.from({ length: 70 }, (_, n) => ({
    x: ((n % 10) + 0.5) / 10 + 0.03 * Math.sin(n * 7.1),
    y: (Math.floor(n / 10) + 0.5) / 7 + 0.04 * Math.cos(n * 3.3),
  }));
  ctx.lineCap = "round";
  for (const p of s._p) {
    const u = velocity(s, p.x, p.y);
    const colour = mix(BLUE, HOT, warmth(s, p.x, p.y));
    ctx.strokeStyle = ctx.fillStyle = colour;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = small ? 1.5 : 2;
    ctx.beginPath();
    ctx.moveTo(X(p.x), Y(p.y));
    ctx.lineTo(X(p.x - u.vx * 0.12), Y(p.y - u.vy * 0.12));
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), small ? 1.8 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const len = small ? 24 : 40;
  for (const [x, y] of ARROWS[s.heater] ?? []) {
    const u = velocity(s, x, y);
    const n = Math.hypot(u.vx * bw, u.vy * bh) || 1;
    const dx = ((u.vx * bw) / n) * len;
    const dy = ((-u.vy * bh) / n) * len;
    arrow(ctx, X(x) - dx / 2, Y(y) - dy / 2, X(x) + dx / 2, Y(y) + dy / 2, mix(BLUE, HOT, warmth(s, x, y)), small ? 3 : 4);
  }

  // the purple grain and its path
  if (s._trail?.length > 1) {
    ctx.strokeStyle = "rgba(122, 90, 248, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const p of s._trail) ctx.lineTo(X(p.x), Y(p.y));
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.purple;
  ctx.beginPath();
  ctx.arc(X(s.mx), Y(s.my), small ? 5 : 7, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, "hạt thuốc tím", X(s.mx) + (small ? 8 : 11), Y(s.my) + 1, { size: small ? 10 : 12, color: COLORS.purple, bold: true });

  // beaker
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = small ? 2.5 : 3.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(bx, by - (small ? 10 : 18));
  ctx.lineTo(bx, by + bh);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + bw, by - (small ? 10 : 18));
  ctx.stroke();

  // heat source
  if (s.heater === "top") {
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = small ? 3 : 4;
    ctx.beginPath();
    const n = 12;
    for (let i = 0; i <= n; i++) ctx.lineTo(X(0.2 + (0.6 * i) / n), by + (small ? 7 : 11) + (i % 2 ? 4 : -4));
    ctx.stroke();
    label(ctx, "que đun nóng", X(0.82), by + (small ? 7 : 11), { size: small ? 10 : 12, color: COLORS.red, bold: true });
  } else {
    flame(ctx, X(hx), by + bh + (small ? 30 : 52), small ? 24 : 42);
    label(ctx, "đèn cồn", X(hx) + (small ? 14 : 24), by + bh + (small ? 20 : 34), { size: small ? 10 : 12, color: COLORS.orange, bold: true });
  }

  let status;
  if (s.heater === "top") {
    status = s.time >= STILL_TIME
      ? small ? "Đun ở phía trên: không có dòng đối lưu." : "Đun ở phía trên: nước nóng đã nằm trên cùng nên không có dòng đối lưu."
      : small ? "Đun ở phía trên: hạt thuốc tím có chuyển động không?" : "Đun ở phía trên, sát mặt nước: hạt thuốc tím có chuyển động không?";
  } else if (s.loopTime > 0) {
    status = small
      ? `Hạt thuốc tím đi một vòng hết ${fmt(s.loopTime, 1)} s (v ≈ ${fmt(v * 100, 1)} cm/s).`
      : `Hạt thuốc tím đi hết một vòng sau ${fmt(s.loopTime, 1)} s; tốc độ dòng đối lưu ≈ ${fmt(v * 100, 1)} cm/s.`;
  } else {
    status = small
      ? `Lực đẩy lên: a = gβΔT = ${fmt(buoyantAcceleration(s.deltaT), 3)} m/s²; v ≈ ${fmt(v * 100, 1)} cm/s`
      : `Nước nóng hơn ${fmt(s.deltaT, 0)} °C bị đẩy lên với a = gβΔT = ${fmt(buoyantAcceleration(s.deltaT), 3)} m/s²; tốc độ dòng ≈ ${fmt(v * 100, 1)} cm/s.`;
  }
  const my = view.h - (small ? 22 : 40);
  label(ctx, status, view.w / 2, my, { size: small ? 11 : 15, bold: true, align: "center" });
  label(ctx, small ? "Đường đi của dòng nước vẽ quy ước; v ≈ √(gβΔT·h)." : "Đường đi của dòng nước vẽ theo quy ước; tốc độ ước lượng theo v = √(gβΔT·h) với h = 10 cm.", view.w / 2, my + (small ? 13 : 22), {
    size: small ? 10 : 12, align: "center", color: COLORS.muted,
  });
}

// ---------- radiation ----------
function drawRadiation(ctx, s, view) {
  const small = isSmall(view);
  const pad = small ? 10 : 36;
  const size = small ? 10 : 13;
  const lineH = small ? 12 : 18;
  label(ctx, "Bức xạ nhiệt: vật đen và vật trắng", pad, small ? 11 : 24, { size: small ? 13 : 18, bold: true });
  label(ctx, `t = ${clock(s.time)}`, view.w - pad, small ? 11 : 24, { size: small ? 13 : 18, bold: true, align: "right", color: COLORS.blue });
  label(ctx, small ? "Hai tấm giống nhau, chỉ khác màu bề mặt, cùng được chiếu sáng." : "Hai tấm kim loại giống hệt nhau, chỉ khác màu bề mặt, được một ngọn đèn chiếu sáng như nhau.", pad, small ? 27 : 50, { size: small ? 10 : 13, color: COLORS.muted });

  const lampY = small ? 52 : 100;
  const lampR = small ? 9 : 16;
  const textH = 3 * lineH + (small ? 20 : 44); // three lines under each plate and the closing note
  const ph = small ? 10 : 18;
  const py = view.h - textH - ph - (small ? 8 : 14);
  const pw = Math.min(view.w * 0.28, 220);
  const cx = view.w / 2;

  const glow = ctx.createRadialGradient(cx, lampY, lampR * 0.4, cx, lampY, lampR * 3);
  glow.addColorStop(0, `rgba(245, 197, 24, ${0.3 + 0.5 * (s.irradiance / 1000)})`);
  glow.addColorStop(1, "rgba(245, 197, 24, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, lampY, lampR * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.yellow;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, lampY, lampR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, `Đèn: E = ${fmt(s.irradiance, 0)} W/m²`, cx + lampR + (small ? 8 : 14), lampY, { size, bold: true });

  [["black", 0.27, s.tBlack, "Vật đen"], ["white", 0.73, s.tWhite, "Vật trắng"]].forEach(([which, fx, T, name], n) => {
    const px = view.w * fx;
    const side = n ? 1 : -1; // thermometer on the outer side
    // light in (same for both), light reflected (much more for the white plate)
    for (const off of [-0.3, 0, 0.3]) {
      const tx = px + off * pw;
      const a = Math.atan2(py - lampY, tx - cx);
      arrow(ctx, cx + Math.cos(a) * lampR * 1.6, lampY + Math.sin(a) * lampR * 1.6, tx, py - 3, "rgba(240, 140, 46, 0.8)", small ? 1.5 : 2.5);
    }
    const frac = reflectedPower(s, which) / (reflectedPower(s, which) + absorbedPower(s, which) || 1);
    const rl = small ? 34 : 64;
    if (s.irradiance > 0) {
      for (const off of [-0.15, 0.15]) {
        arrow(ctx, px + off * pw, py - 4, px + off * pw + side * rl * 0.5, py - 4 - rl, `rgba(245, 197, 24, ${0.35 + 0.65 * frac})`, 1 + (small ? 3 : 5) * frac);
      }
    }
    // plate
    ctx.fillStyle = which === "black" ? "#20242e" : "#ffffff";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.fillRect(px - pw / 2, py, pw, ph);
    ctx.strokeRect(px - pw / 2, py, pw, ph);
    // thermometer 20…80 °C
    const th = Math.max(40, py - lampY - (small ? 44 : 90));
    const tw = small ? 7 : 10;
    const tx = clamp(px + side * (pw / 2 + (small ? 12 : 26)), pad + tw, view.w - pad - tw);
    const level = clamp((T - 20) / 60, 0, 1);
    ctx.fillStyle = "#fff";
    ctx.fillRect(tx - tw / 2, py + ph - th, tw, th);
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(tx - tw / 2, py + ph - th * level, tw, th * level);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(tx - tw / 2, py + ph - th, tw, th);
    ctx.beginPath();
    for (let d = 20; d <= 80; d += 10) {
      const y = py + ph - (th * (d - 20)) / 60;
      ctx.moveTo(tx + (side * tw) / 2, y);
      ctx.lineTo(tx + side * (tw / 2 + (d % 20 ? 3 : 5)), y);
    }
    ctx.stroke();
    if (!small) {
      for (const d of [20, 50, 80]) label(ctx, `${d}`, tx + side * (tw / 2 + 9), py + ph - (th * (d - 20)) / 60, { size: 11, color: COLORS.muted, align: n ? "left" : "right" });
    }
    label(ctx, `${fmt(T, 1)} °C`, tx - side * (tw / 2 + 4), py + ph - th - (small ? 8 : 12), { size: small ? 12 : 16, bold: true, align: n ? "right" : "left", color: COLORS.red });
    // energy balance
    const ty = py + ph + lineH * 0.8;
    label(ctx, name, px, ty, { size: small ? 11 : 15, bold: true, align: "center" });
    label(ctx, `hấp thụ ${fmt(absorbedPower(s, which), 1)} W, phản xạ ${fmt(reflectedPower(s, which), 1)} W`, px, ty + lineH, { size, align: "center" });
    label(ctx, `tỏa ra ${fmt(lostPower(T), 1)} W, cân bằng ở ${fmt(equilibriumTemperature(s, which), 1)} °C`, px, ty + 2 * lineH, { size, align: "center", color: COLORS.muted });
  });

  const done = s.time >= REPORT_TIME;
  const note = done
    ? "Đã ghi kết quả sau 5 phút: vật đen nóng lên nhiều hơn vật trắng."
    : small ? "Kết quả được ghi sau 5 phút chiếu sáng (hãy tăng tốc độ)." : "Kết quả được ghi sau 5 phút chiếu sáng; hãy tăng tốc độ mô phỏng. Hình vẽ không theo tỉ lệ.";
  label(ctx, note, cx, view.h - (small ? 9 : 18), { size: small ? 10 : 13, align: "center", bold: done, color: done ? COLORS.green : COLORS.muted });
}

const inMode = mode => s => s.mode === mode;
const guessButton = i => ({
  type: "button",
  label: `Dự đoán tiếp theo: ${MATERIALS[i].name.toLowerCase()}`,
  action: (s, api) => pick(s, api, i),
  visible: inMode("conduction"),
  disabled: s => s.time > 0 || parsePrediction(s.prediction).includes(i),
});

mount({
  slug: "truyen-nhiet",
  version: "1.0.0",
  title: "Dẫn nhiệt, đối lưu và bức xạ nhiệt",
  hint: "Chọn thí nghiệm, bấm ▶ Chạy để bật nguồn nhiệt. Với dẫn nhiệt, hãy dự đoán thứ tự sáp rơi trước khi chạy.",
  initialState,
  timeScale: s => (s.mode === "convection" ? 1 : s.speed),
  step(s, dt, api) {
    step(s, dt);
    if (s.mode === "convection" && s._p) {
      s._p = s._p.map(p => advect(s, p, dt));
      s._n = (s._n ?? 0) + 1;
      if (s._n % 6 === 0) (s._trail ??= []).push({ x: s.mx, y: s.my });
      if (s._trail?.length > 400) s._trail.shift();
    }
    if (s.reported) return;
    if (s.mode === "conduction" && fallenCount(s) >= 3) {
      // three nails down settle the order; the glass rod takes many minutes more
      s.reported = true;
      const t = fallTimes(s);
      api.emit("conduction-done", { distance: s.distance, copper: t[0], aluminium: t[1], iron: t[2], glass: t[3], predicted: parsePrediction(s.prediction).length === 4 ? 1 : 0, correct: predictionCorrect(s) ? 1 : 0 }, "result");
      if (predictionCorrect(s)) api.emit("order-predicted", { distance: s.distance }, "goal");
    } else if (s.mode === "convection" && (s.loopTime > 0 || (s.heater === "top" && s.time >= STILL_TIME))) {
      s.reported = true;
      api.emit("convection-done", { deltaT: s.deltaT, speed: convectionSpeed(s) * 100, loopTime: s.loopTime, circulating: s.loopTime > 0 ? 1 : 0 }, "result");
    } else if (s.mode === "radiation" && s.time >= REPORT_TIME) {
      s.reported = true;
      api.emit("radiation-done", { irradiance: s.irradiance, blackTemperature: s.tBlack, whiteTemperature: s.tWhite, time: s.time }, "result");
    }
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Thí nghiệm",
      options: [
        { value: "conduction", label: "Dẫn nhiệt (các thanh chất rắn)" },
        { value: "convection", label: "Đối lưu (cốc nước được đun)" },
        { value: "radiation", label: "Bức xạ nhiệt (vật đen, vật trắng)" },
      ],
      onChange: freshRun,
    },
    {
      type: "select",
      key: "speed",
      label: "Tốc độ mô phỏng",
      options: [
        { value: 1, label: "× 1 (thời gian thực)" },
        { value: 10, label: "× 10" },
        { value: 100, label: "× 100" },
      ],
      visible: s => s.mode !== "convection",
    },
    { type: "slider", key: "distance", label: "Khoảng cách từ đầu nung đến sáp", min: 3, max: 10, step: 0.5, unit: "cm", digits: 1, visible: inMode("conduction"), onChange: freshRun },
    { type: "heading", label: "Dự đoán thứ tự sáp rơi", visible: inMode("conduction") },
    ...ROWS.map(guessButton),
    {
      type: "button",
      label: "Xóa dự đoán",
      action: s => (s.prediction = ""),
      event: "prediction-cleared",
      visible: inMode("conduction"),
      disabled: s => s.time > 0 || !s.prediction,
    },
    {
      type: "select",
      key: "heater",
      label: "Vị trí đun",
      options: [
        { value: "left", label: "Dưới đáy, lệch về bên trái" },
        { value: "center", label: "Dưới đáy, chính giữa" },
        { value: "top", label: "Phía trên, sát mặt nước" },
      ],
      visible: inMode("convection"),
      onChange: freshRun,
    },
    { type: "slider", key: "deltaT", label: "Nước chỗ đun nóng hơn xung quanh", min: 2, max: 30, step: 1, unit: "°C", digits: 0, visible: inMode("convection"), onChange: freshRun },
    { type: "slider", key: "irradiance", label: "Cường độ chiếu sáng E", min: 200, max: 1000, step: 50, unit: "W/m²", digits: 0, visible: inMode("radiation"), onChange: freshRun },
    {
      type: "button",
      label: "Làm lại thí nghiệm",
      action(s, api) {
        freshRun(s);
        s.prediction = "";
        api.pause();
      },
      event: "restart",
    },
  ],
  readouts: [
    { label: "Thời gian thí nghiệm", value: s => clock(s.time) },
    {
      label: "Diễn biến",
      value: s =>
        s.mode === "conduction"
          ? `đã rơi ${fallenCount(s)}/4 đinh sáp`
          : s.mode === "convection"
            ? `dòng đối lưu ≈ ${fmt(convectionSpeed(s) * 100, 1)} cm/s`
            : `đen ${fmt(s.tBlack, 1)} °C, trắng ${fmt(s.tWhite, 1)} °C`,
    },
  ],
  pointer: {
    down(p, s, api, view) {
      if (s.mode !== "conduction") return false;
      const g = condGeom(view);
      const r = Math.floor((p.y - g.top) / g.rowH);
      if (r < 0 || r > 3 || p.x < g.pad) return false;
      pick(s, api, ROWS[r]);
    },
  },
  draw(ctx, s, view) {
    if (s.mode === "convection") drawConvection(ctx, s, view);
    else if (s.mode === "radiation") drawRadiation(ctx, s, view);
    else drawConduction(ctx, s, view);
  },
});
