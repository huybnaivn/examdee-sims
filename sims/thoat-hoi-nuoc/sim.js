import { mount, COLORS, label, fmt, arrow } from "../../kit/v1/kit.js";
import {
  initialState, rate, opening, bubbleDistance, measureTime, newQuestion, strongest, baseline,
  QUIZ_CHANGES, FACTOR_CODE, TUBE_LENGTH, TUBE_DIAMETER, MINUTES_PER_SECOND,
} from "./model.js";

const COVER_CODE = { none: 0, upper: 1, lower: 2, both: 3 };
const LEAF = "#3f9b4a";
const VASELINE = "rgba(245, 197, 24, 0.75)";
const WATER = "#cfe3ff";

const restart = s => {
  s.t = 0;
};
const covered = (s, side) => s.cover === side || s.cover === "both";

function report(s, api) {
  const E = rate(s);
  api.emit(
    "measurement-done",
    { rate: E, distance: bubbleDistance(E, s.t), time: s.t, light: s.light, temperature: s.temperature, humidity: s.humidity, wind: s.wind, cover: COVER_CODE[s.cover] },
    "result"
  );
}

function leaf(ctx, s, x, y, len, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = LEAF;
  ctx.beginPath();
  ctx.ellipse(len / 2, 0, len / 2, len / 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b6e33";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  // vaseline: a yellow film on the covered surface (upper = the side facing up)
  ctx.lineWidth = 3;
  ctx.strokeStyle = VASELINE;
  const up = Math.cos(angle) >= 0 ? -1 : 1; // which half-ellipse faces the sky
  for (const [side, sign] of [["upper", up], ["lower", -up]]) {
    if (!covered(s, side)) continue;
    ctx.beginPath();
    ctx.ellipse(len / 2, 0, len / 2, len / 5, 0, sign < 0 ? Math.PI : 0, sign < 0 ? 2 * Math.PI : Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

function stoma(ctx, x, y, w, open) {
  const gap = w * 0.35 * open;
  ctx.fillStyle = "#6cc070";
  ctx.strokeStyle = "#2b6e33";
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * (gap / 2 + w * 0.25), y, w * 0.25, w * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function closeUp(ctx, s, cx, cy, R, small, phase) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = "#eef6ff";
  ctx.fill();
  ctx.clip();
  const top = cy - R * 0.28;
  const bot = cy + R * 0.28;
  const ep = R * 0.1;
  ctx.fillStyle = "#cdeccf";
  ctx.fillRect(cx - R, top, 2 * R, bot - top);
  ctx.fillStyle = "#a4d9a8";
  ctx.fillRect(cx - R, top, 2 * R, ep);
  ctx.fillRect(cx - R, bot - ep, 2 * R, ep);
  // mesophyll cells
  ctx.fillStyle = "#7fc785";
  for (let i = -3; i <= 3; i++) {
    for (const yy of [top + ep + R * 0.12, bot - ep - R * 0.12]) {
      ctx.beginPath();
      ctx.arc(cx + i * R * 0.28, yy, R * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const a = opening(s.light);
  const E = rate(s);
  const sw = R * 0.42;
  // one stoma on the upper epidermis, three on the lower (more stomata underneath)
  const stomata = [
    { x: cx, y: top + ep / 2, side: "upper", dir: -1 },
    ...[-0.55, 0, 0.55].map(f => ({ x: cx + f * R, y: bot - ep / 2, side: "lower", dir: 1 })),
  ];
  for (const st of stomata) {
    stoma(ctx, st.x, st.y, sw, a);
    if (covered(s, st.side)) {
      ctx.fillStyle = VASELINE;
      ctx.fillRect(st.x - sw, st.y + (st.dir < 0 ? -ep * 1.6 : ep * 0.4), 2 * sw, ep * 1.2);
      continue;
    }
    // water vapour leaving: more dots, faster, when the rate is higher
    const n = Math.round(Math.min(6, E * 0.8));
    for (let k = 0; k < n; k++) {
      const f = (phase * (0.4 + E * 0.05) + k / n) % 1;
      const yy = st.y + st.dir * (ep + f * R * 0.6);
      const xx = st.x + Math.sin(k * 2.3 + f * 4) * sw * 0.5 + f * s.wind * R * 0.08;
      ctx.fillStyle = `rgba(47, 111, 237, ${0.85 * (1 - f)})`;
      ctx.beginPath();
      ctx.arc(xx, yy, Math.max(2, R * 0.035), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  const size = small ? 10 : 12;
  label(ctx, "Mặt trên", cx, cy - R * 0.62, { size, align: "center", color: COLORS.muted });
  label(ctx, "Mặt dưới", cx, cy + R * 0.66, { size, align: "center", color: COLORS.muted });
  label(ctx, a > 0 ? `Khí khổng mở ${fmt(a * 100, 0)} %` : "Khí khổng đóng (tối)", cx, cy + R + (small ? 9 : 12), { size, align: "center", bold: true, color: a > 0 ? COLORS.green : COLORS.red });
  const cond = `${fmt(s.temperature, 0)} °C · độ ẩm ${fmt(s.humidity, 0)} % · gió ${fmt(s.wind, 1)} m/s`;
  label(ctx, cond, cx, cy + R + (small ? 22 : 30), { size, align: "center", bold: true });
}

mount({
  slug: "thoat-hoi-nuoc",
  version: "1.0.0",
  title: "Thoát hơi nước ở thực vật",
  hint: "Bấm ▶ Chạy để đo: bọt khí trong ống mao dẫn chạy theo lượng nước cành lá hút vào để bù lượng nước thoát ra.",
  initialState,
  step(s, dt, api) {
    const T = measureTime(s);
    if (s.t >= T) s.t = 0; // ▶ after a finished measurement starts a new one
    s._phase = (s._phase ?? 0) + dt;
    s.t = Math.min(T, s.t + dt * MINUTES_PER_SECOND);
    if (s.t >= T) {
      report(s, api);
      api.pause();
    }
  },
  controls: [
    { type: "heading", label: "Điều kiện môi trường" },
    { type: "slider", key: "light", label: "Cường độ ánh sáng", min: 0, max: 100, step: 5, unit: "%", digits: 0, onChange: restart },
    { type: "slider", key: "temperature", label: "Nhiệt độ", min: 10, max: 40, step: 1, unit: "°C", digits: 0, onChange: restart },
    { type: "slider", key: "humidity", label: "Độ ẩm không khí", min: 20, max: 100, step: 5, unit: "%", digits: 0, onChange: restart },
    { type: "slider", key: "wind", label: "Tốc độ gió", min: 0, max: 5, step: 0.5, unit: "m/s", digits: 1, onChange: restart },
    {
      type: "select",
      key: "cover",
      label: "Bôi vaseline lên lá",
      onChange: restart,
      options: [
        { value: "none", label: "Không bôi" },
        { value: "upper", label: "Mặt trên của lá" },
        { value: "lower", label: "Mặt dưới của lá" },
        { value: "both", label: "Cả hai mặt" },
      ],
    },
    { type: "stepper", key: "period", label: "Thời gian đo (phút)", min: 1, max: 5, onChange: restart },
    { type: "heading", label: "Câu hỏi" },
    { type: "checkbox", key: "quiz", label: "Chế độ câu hỏi: nhân tố nào mạnh nhất?", onChange: s => s.quiz && newQuestion(s) },
    {
      type: "select",
      key: "answer",
      label: "Thay đổi làm tốc độ tăng nhiều nhất",
      options: Object.entries(QUIZ_CHANGES).map(([value, c]) => ({ value, label: c.text })),
      visible: s => s.quiz,
      onChange: s => (s._feedback = ""),
    },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: s => s.quiz,
      action(s, api) {
        const ok = s.answer === strongest(s);
        s._feedback = ok ? "ok" : "no";
        api.emit("quiz-answer", { factor: FACTOR_CODE[s.answer], correct: ok ? 1 : 0 });
        if (ok) api.emit("strongest-factor-found", { factor: FACTOR_CODE[s.answer] }, "goal");
      },
    },
    { type: "button", label: "Câu hỏi khác", visible: s => s.quiz, event: "new-question", action: s => (newQuestion(s), (s._feedback = "")) },
  ],
  readouts: [
    { label: "Tốc độ thoát hơi nước", value: s => `${fmt(rate(s), 2)} mm³/phút` },
    { label: "Bọt khí đã đi", value: s => `${fmt(bubbleDistance(rate(s), s.t), 1)} mm` },
    { label: "Thời gian đo", value: s => `${fmt(s.t, 2)} / ${fmt(measureTime(s), 2)} phút` },
    {
      label: "Câu hỏi",
      value: s => {
        if (!s.quiz) return "–";
        const b = baseline(s);
        return `Từ ánh sáng ${fmt(b.light, 0)} %, ${fmt(b.temperature, 0)} °C, độ ẩm ${fmt(b.humidity, 0)} %, gió ${fmt(b.wind, 1)} m/s (không bôi vaseline): thay đổi nào làm tốc độ tăng nhiều nhất? Hãy thử từng thay đổi rồi đo.`;
      },
    },
    { label: "Kết quả", value: s => (!s.quiz || !s._feedback ? "–" : s._feedback === "ok" ? "Đúng!" : "Chưa đúng, hãy đo thử từng thay đổi.") },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 450;
    const size = small ? 10 : 13;
    const E = rate(s);
    const dist = bubbleDistance(E, s.t);
    const phase = s._phase ?? 0;

    // capillary along the bottom
    const capY = view.h - (small ? 38 : 64);
    const tubeTop = view.h * (small ? 0.5 : 0.52);
    const stemTop = small ? 26 : 44;
    const len = Math.min(view.w * 0.16, (tubeTop - stemTop) * 0.62, 120); // leaf length
    const tubeW = small ? 18 : 26;
    const tx = len + 8; // stem axis, leaves fit on its left
    const x0 = tx + tubeW / 2;
    const x1 = view.w - (small ? 26 : 50);
    const mm = (x1 - x0) / TUBE_LENGTH;
    const tw = small ? 7 : 10;
    ctx.fillStyle = WATER;
    ctx.fillRect(x0, capY - tw / 2, x1 - x0, tw);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, capY - tw / 2, x1 - x0, tw);
    for (let d = 0; d <= TUBE_LENGTH; d += 10) {
      const x = x1 - d * mm;
      ctx.beginPath();
      ctx.moveTo(x, capY + tw / 2);
      ctx.lineTo(x, capY + tw / 2 + (d % 50 ? 4 : 8));
      ctx.stroke();
      if (d % 50 === 0) label(ctx, `${d}`, x, capY + tw / 2 + 16, { size, align: "center", color: COLORS.muted });
    }
    label(ctx, `mm (ống mao dẫn đường kính ${fmt(TUBE_DIAMETER)} mm)`, x1, capY + tw / 2 + (small ? 28 : 34), { size, align: "right", color: COLORS.muted });
    // the open end dips into a beaker on the right; the bubble moves toward the shoot
    const bx = x1 - dist * mm;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(bx, capY, tw * 0.9, tw / 2 - 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.blue;
    ctx.stroke();
    if (E > 0) arrow(ctx, bx - tw * 1.4, capY - tw * 1.6, bx - tw * 4, capY - tw * 1.6, COLORS.blue, 2);

    // potometer: water-filled tube rising at the left, shoot in the stopper
    ctx.fillStyle = WATER;
    ctx.fillRect(tx - tubeW / 2, tubeTop, tubeW, capY - tubeTop + tw / 2);
    ctx.strokeStyle = COLORS.ink;
    ctx.strokeRect(tx - tubeW / 2, tubeTop, tubeW, capY - tubeTop + tw / 2);
    ctx.fillStyle = "#9b6b43";
    ctx.fillRect(tx - tubeW / 2 - 3, tubeTop - 10, tubeW + 6, 14);
    // stem and leaves
    ctx.strokeStyle = "#5b7f2a";
    ctx.lineWidth = small ? 3 : 4;
    ctx.beginPath();
    ctx.moveTo(tx, capY - 20);
    ctx.lineTo(tx, stemTop);
    ctx.stroke();
    const ys = [0.15, 0.45, 0.78].map(f => stemTop + f * (tubeTop - 14 - stemTop));
    ys.forEach((y, i) => {
      leaf(ctx, s, tx, y, len, i % 2 ? -0.45 : -Math.PI + 0.45);
      if (i < 2) leaf(ctx, s, tx, y + 10, len * 0.85, i % 2 ? -Math.PI + 0.5 : -0.5);
    });

    // environment: light, wind
    const sunX = tx + len + (small ? 22 : 40);
    const sunY = small ? 20 : 34;
    const glow = s.light / 100;
    ctx.fillStyle = `rgba(245, 197, 24, ${0.15 + 0.85 * glow})`;
    ctx.beginPath();
    ctx.arc(sunX, sunY, small ? 9 : 14, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 8 && glow > 0; k++) {
      const ang = (k * Math.PI) / 4;
      const r1 = small ? 12 : 18;
      const r2 = r1 + 6 + 8 * glow;
      ctx.strokeStyle = `rgba(245, 197, 24, ${glow})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sunX + r1 * Math.cos(ang), sunY + r1 * Math.sin(ang));
      ctx.lineTo(sunX + r2 * Math.cos(ang), sunY + r2 * Math.sin(ang));
      ctx.stroke();
    }
    for (let k = 0; k < Math.ceil(s.wind); k++) {
      const y = tubeTop - 10 - k * (small ? 9 : 14);
      const off = ((phase * 40 + k * 17) % 30) * 0.2;
      arrow(ctx, 4 + off, y, (small ? 22 : 34) + off, y, "rgba(107, 120, 144, 0.8)", 1.5);
    }

    // leaf close-up
    const R = Math.min(view.w * 0.21, (capY - (small ? 40 : 70)) * 0.42, 140);
    const cx = view.w - R - (small ? 12 : 40);
    const cy = (small ? 22 : 40) + R + (small ? 8 : 14);
    closeUp(ctx, s, cx, cy, R, small, phase);
    if (!small) label(ctx, "Phóng to lát cắt ngang của lá", cx, cy - R - 12, { size, align: "center", color: COLORS.muted });

    // the result of the measurement, with the formula behind the bubble
    const lines = [`E = ${fmt(E, 2)} mm³/phút`, `x = E·t/S = ${fmt(dist, 1)} mm sau ${fmt(s.t, 2)} phút`];
    lines.forEach((t, i) => label(ctx, t, x0 + tubeW, capY - tw - (small ? 26 : 44) + i * (size + 5), { size: size + 1, bold: i === 0, color: i ? COLORS.ink : COLORS.blue }));
    if (!small) label(ctx, "Mô hình đơn giản, bỏ qua thoát hơi nước qua cutin; hình không theo tỉ lệ.", 8, view.h - 12, { size: 11, color: COLORS.muted });
  },
});
