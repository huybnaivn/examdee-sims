import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, runners, position, finishTime, averageSpeed, stopWindow, step, raceEnd, check } from "./model.js";

const COLOR = { A: COLORS.red, B: COLORS.blue, C: COLORS.green };
const QUESTIONS = [
  { value: "fastest", label: "Vật nào chạy nhanh nhất (đường dốc nhất)?" },
  { value: "first", label: "Vật nào về đích đầu tiên?" },
  { value: "still", label: "Vật nào có lúc đứng yên (đoạn nằm ngang)?" },
  { value: "speedB", label: "Đọc tốc độ của B trên đồ thị (m/s)" },
  { value: "avgA", label: "Tốc độ trung bình của A cả quãng đường (m/s)" },
];
const numeric = s => s.question === "speedB" || s.question === "avgA";

const speedFormat = v => `${fmt(v, 1)} m/s = ${fmt(v * 3.6, 1)} km/h`;

// Any change of the race restarts the stopwatch.
const restart = s => {
  s.time = 0;
  s.finished = false;
  s._fb = undefined;
};

function niceStep(range, ticks) {
  const raw = range / ticks;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(m => m * p).find(v => v >= raw);
}

function geom(s, view) {
  const small = view.w < 520 || view.h < 420;
  const n = runners(s).length;
  const laneH = small ? 20 : 30;
  const track = { x0: small ? 22 : 50, x1: view.w - (small ? 26 : 50), y0: small ? 30 : 48, laneH, n };
  track.y1 = track.y0 + laneH * n;
  const graph = { x0: small ? 44 : 70, x1: view.w - (small ? 14 : 40), y0: track.y1 + (small ? 34 : 56), y1: view.h - (small ? 30 : 44) };
  return { small, track, graph, tMax: Math.max(1, raceEnd(s)) };
}

function drawRunner(ctx, x, y, r, name) {
  ctx.fillStyle = COLOR[name];
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, name, x, y + 0.5, { color: "#fff", bold: true, size: r * 1.2, align: "center" });
}

mount({
  slug: "toc-do-chuyen-dong",
  version: "1.0.0",
  title: "Tốc độ và đồ thị quãng đường – thời gian",
  hint: "Chọn tốc độ rồi bấm Chạy. Rê chuột trên đồ thị để đọc quãng đường ở từng thời điểm, sau đó trả lời câu hỏi.",
  initialState,
  step(s, dt, api) {
    if (s.finished) restart(s); // ▶ after a finished race runs it again
    if (step(s, dt)) {
      api.pause();
      api.sync();
      const data = {};
      for (const r of runners(s)) {
        data[`time${r.name}`] = finishTime(r, s.length);
        data[`avgSpeed${r.name}`] = averageSpeed(r, s.length);
      }
      api.emit("race-finished", data, "result");
    }
  },
  controls: [
    { type: "heading", label: "Cuộc đua" },
    { type: "slider", key: "length", label: "Chiều dài đường chạy", min: 50, max: 400, step: 50, unit: "m", digits: 0, onChange: restart },
    { type: "slider", key: "vA", label: "Tốc độ của A", min: 1, max: 10, step: 0.5, format: speedFormat, onChange: restart },
    { type: "slider", key: "vB", label: "Tốc độ của B", min: 1, max: 10, step: 0.5, format: speedFormat, onChange: restart },
    { type: "checkbox", key: "three", label: "Thêm vật C", onChange: restart },
    { type: "slider", key: "vC", label: "Tốc độ của C", min: 1, max: 10, step: 0.5, format: speedFormat, onChange: restart, visible: s => s.three },
    { type: "checkbox", key: "stop", label: "A dừng lại ở giữa đường", onChange: restart },
    { type: "slider", key: "stopTime", label: "Thời gian A dừng", min: 1, max: 10, step: 1, unit: "s", digits: 0, onChange: restart, visible: s => s.stop },
    { type: "checkbox", key: "showSlope", label: "Hiện cách đọc tốc độ từ độ dốc" },
    { type: "heading", label: "Câu hỏi đọc đồ thị (sau khi chạy xong)" },
    { type: "select", key: "question", label: "Câu hỏi", options: QUESTIONS, onChange: s => (s._fb = undefined) },
    {
      type: "select",
      key: "answer",
      label: "Trả lời",
      options: [
        { value: "A", label: "A" },
        { value: "B", label: "B" },
        { value: "C", label: "C" },
        { value: "none", label: "Không có vật nào" },
      ],
      visible: s => !numeric(s),
      onChange: s => (s._fb = undefined),
    },
    { type: "slider", key: "guess", label: "Trả lời", min: 0, max: 12, step: 0.1, unit: "m/s", digits: 1, visible: numeric, onChange: s => (s._fb = undefined) },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      disabled: s => !s.finished,
      action(s, api) {
        const ok = check(s);
        s._fb = ok ? "Đúng!" : "Chưa đúng, hãy đọc lại đồ thị.";
        if (ok) api.emit("answered", { question: QUESTIONS.findIndex(q => q.value === s.question) + 1 }, "goal");
      },
    },
  ],
  readouts: [
    { label: "Đồng hồ bấm giờ", value: s => `${fmt(s.time, 2)} s` },
    {
      label: "Về đích",
      value: s => {
        const done = runners(s).filter(r => s.time >= finishTime(r, s.length) - 1e-9);
        return done.length ? done.map(r => `${r.name}: ${fmt(finishTime(r, s.length), 2)} s`).join(" · ") : "–";
      },
    },
    { label: "Nhận xét", value: s => s._fb ?? (s.finished ? "Chọn câu trả lời rồi bấm Kiểm tra" : "Chạy hết cuộc đua trước") },
  ],
  pointer: {
    down: () => false,
    hover(p, s, api, view) {
      const { graph: g, tMax } = geom(s, view);
      const inside = p.x >= g.x0 && p.x <= g.x1 && p.y >= g.y0 - 10 && p.y <= g.y1 + 10;
      s._hover = inside ? Math.min(s.time, ((p.x - g.x0) / (g.x1 - g.x0)) * tMax) : undefined;
    },
  },
  draw(ctx, s, view) {
    const { small, track: tr, graph: g, tMax } = geom(s, view);
    const list = runners(s);
    const size = small ? 11 : 13;
    const X = d => tr.x0 + (d / s.length) * (tr.x1 - tr.x0);

    // stopwatch
    label(ctx, `Đồng hồ: ${fmt(s.time, 2)} s`, tr.x0, small ? 12 : 20, { bold: true, size: small ? 13 : 16 });
    if (!small) label(ctx, "Vật chuyển động thẳng trên đường chạy", tr.x1, 20, { align: "right", size: 13, color: COLORS.muted });

    // track, distance markers, finish line
    ctx.fillStyle = "#e9edf5";
    ctx.fillRect(tr.x0, tr.y0, tr.x1 - tr.x0, tr.y1 - tr.y0);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    for (let i = 1; i < tr.n; i++) {
      ctx.beginPath();
      ctx.moveTo(tr.x0, tr.y0 + tr.laneH * i);
      ctx.lineTo(tr.x1, tr.y0 + tr.laneH * i);
      ctx.stroke();
    }
    const mark = niceStep(s.length, small ? 4 : 8);
    for (let d = 0; d <= s.length + 1e-9; d += mark) {
      ctx.strokeStyle = COLORS.muted;
      ctx.beginPath();
      ctx.moveTo(X(d), tr.y1);
      ctx.lineTo(X(d), tr.y1 + 5);
      ctx.stroke();
      label(ctx, `${fmt(d, 0)} m`, X(d), tr.y1 + 13, { size: small ? 10 : 12, align: "center", color: COLORS.muted });
    }
    ctx.fillStyle = COLORS.ink;
    for (let y = tr.y0, k = 0; y < tr.y1; y += 5, k++) ctx.fillRect(X(s.length) + (k % 2) * 4, y, 4, Math.min(5, tr.y1 - y));
    list.forEach((r, i) => {
      const w = stopWindow(r);
      if (w) {
        ctx.strokeStyle = COLORS.orange;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(X(r.stopAt), tr.y0 + tr.laneH * i + 2);
        ctx.lineTo(X(r.stopAt), tr.y0 + tr.laneH * (i + 1) - 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      drawRunner(ctx, X(position(r, s.length, s.time)), tr.y0 + tr.laneH * (i + 0.5), tr.laneH * 0.36, r.name);
    });

    // s–t graph
    const T = t => g.x0 + (t / tMax) * (g.x1 - g.x0);
    const S = d => g.y1 - (d / s.length) * (g.y1 - g.y0);
    const ts = niceStep(tMax, small ? 4 : 8);
    const ss = niceStep(s.length, small ? 4 : 5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.grid;
    for (let t = ts; t <= tMax + 1e-9; t += ts) {
      ctx.beginPath();
      ctx.moveTo(T(t), g.y0);
      ctx.lineTo(T(t), g.y1);
      ctx.stroke();
    }
    for (let d = ss; d <= s.length + 1e-9; d += ss) {
      ctx.beginPath();
      ctx.moveTo(g.x0, S(d));
      ctx.lineTo(g.x1, S(d));
      ctx.stroke();
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(g.x0, g.y0 - 8);
    ctx.lineTo(g.x0, g.y1);
    ctx.lineTo(g.x1 + 6, g.y1);
    ctx.stroke();
    for (let t = 0; t <= tMax + 1e-9; t += ts) label(ctx, fmt(t, 1), T(t), g.y1 + 10, { size: size - 1, align: "center", color: COLORS.muted });
    for (let d = 0; d <= s.length + 1e-9; d += ss) label(ctx, fmt(d, 0), g.x0 - 5, S(d), { size: size - 1, align: "right", color: COLORS.muted });
    label(ctx, "s (m)", g.x0 + 6, g.y0 - 12, { size, bold: true });
    label(ctx, "t (s)", g.x1, g.y1 + (small ? 22 : 26), { size, bold: true, align: "right" });
    if (!small) label(ctx, "Đồ thị quãng đường – thời gian", (g.x0 + g.x1) / 2, g.y0 - 14, { size: 14, bold: true, align: "center" });

    list.forEach((r, i) => {
      const w = stopWindow(r);
      const tf = finishTime(r, s.length);
      const knots = [0, ...(w ? [w.t1, w.t2] : []), tf].filter(t => t < s.time);
      ctx.strokeStyle = COLOR[r.name];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      [...knots, Math.min(s.time, tf)].forEach((t, k) => ctx[k ? "lineTo" : "moveTo"](T(t), S(position(r, s.length, t))));
      ctx.stroke();
      // legend
      const lx = g.x0 + 12 + i * (small ? 34 : 46);
      ctx.beginPath();
      ctx.moveTo(lx, g.y0 + 2);
      ctx.lineTo(lx + (small ? 12 : 18), g.y0 + 2);
      ctx.stroke();
      label(ctx, r.name, lx + (small ? 15 : 22), g.y0 + 2, { size, bold: true, color: COLOR[r.name] });
    });

    // reading the speed from the slope: Δs over the same Δt for every runner, from the start
    if (s.showSlope) {
      const firstStop = Math.min(...list.map(r => stopWindow(r)?.t1 ?? Infinity), s.time);
      const dt = [10, 5, 2, 1, 0.5].find(v => v <= Math.min(ts, firstStop)) ?? 0;
      if (dt > 0) {
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.5;
        const tags = list.map(r => ({ r, ds: position(r, s.length, dt) })).sort((a, b) => b.ds - a.ds);
        for (const { r, ds } of tags) {
          ctx.strokeStyle = COLOR[r.name];
          ctx.beginPath();
          ctx.moveTo(T(dt), g.y1);
          ctx.lineTo(T(dt), S(ds));
          ctx.stroke();
        }
        ctx.setLineDash([]);
        // labels beside the line, stacked so they never overlap
        let y = -Infinity;
        for (const { r, ds } of tags) {
          y = Math.max(S(ds), y + size + 3);
          const text = `${r.name}: Δs = ${fmt(ds, 1)} m`;
          ctx.font = `600 ${size - 1}px system-ui, sans-serif`;
          const w = ctx.measureText(text).width + 6;
          const x = T(dt) + 4;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillRect(x, y - size / 2 - 1, w, size + 2);
          label(ctx, text, x + 3, y, { size: size - 1, color: COLOR[r.name], bold: true });
        }
        label(ctx, `Δt = ${fmt(dt, 1)} s   →   v = Δs / Δt`, T(dt) + 5, g.y1 - 9, { size: size - 1, color: COLORS.ink });
      } else {
        label(ctx, "Chạy thêm một chút để đọc độ dốc", g.x0 + 8, g.y1 - 10, { size: size - 1, color: COLORS.muted });
      }
    }

    // hover: read s at a moment t
    if (s._hover != null) {
      const t = s._hover;
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(T(t), g.y0);
      ctx.lineTo(T(t), g.y1);
      ctx.stroke();
      ctx.setLineDash([]);
      const lines = [`t = ${fmt(t, 1)} s`];
      for (const r of list) {
        const d = position(r, s.length, t);
        ctx.fillStyle = COLOR[r.name];
        ctx.beginPath();
        ctx.arc(T(t), S(d), 4, 0, Math.PI * 2);
        ctx.fill();
        lines.push(`${r.name}: s = ${fmt(d, 1)} m`);
      }
      const bw = small ? 104 : 130;
      const bx = T(t) + bw + 12 > g.x1 ? T(t) - bw - 8 : T(t) + 8;
      const lh = size + 4;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(bx, g.y0 + 14, bw, lh * lines.length + 6);
      lines.forEach((text, k) => label(ctx, text, bx + 6, g.y0 + 14 + lh * (k + 0.5) + 3, { size, color: k ? COLOR[list[k - 1].name] : COLORS.ink, bold: k === 0 }));
    }
  },
});
