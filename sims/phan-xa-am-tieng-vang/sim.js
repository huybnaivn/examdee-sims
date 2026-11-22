import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  initialState, distanceOf, reflectance, echoDelay, echoHeard, minEchoDistance, seaDepth, sonarDelay,
  answerOk, delayOf, emitPulse, advance, V_AIR, V_SEA, ECHO_GAP, D_RANGE,
} from "./model.js";

const WAVE = COLORS.blue;
const ECHO = COLORS.purple;
const ms = t => `${fmt(t * 1000, t < 0.1 ? 1 : 0)} ms`;
const sec = t => `${fmt(t, 3)} s`;

function geomWall(s, view) {
  const small = view.w < 560 || view.h < 420;
  const top = small ? 40 : 66;
  const tl = small ? 54 : 74; // timeline band at the bottom
  const groundY = view.h - tl - (small ? 14 : 22);
  const x0 = small ? 34 : 60; // the person
  const ppm = (view.w - x0 - (small ? 36 : 60)) / (D_RANGE[1] + 2); // px per metre
  const person = clamp((groundY - top) * 0.45, 36, 80);
  const mouth = { x: x0 + person * 0.16, y: groundY - person * 0.86 };
  const wallX = mouth.x + distanceOf(s) * ppm;
  return { small, top, tl, groundY, x0, ppm, person, mouth, wallX };
}

function drawPerson(ctx, x, ground, h, shouting) {
  const head = h * 0.13;
  ctx.strokeStyle = COLORS.ink;
  ctx.fillStyle = COLORS.ink;
  ctx.lineWidth = Math.max(2, h * 0.05);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, ground - h + head, head, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, ground - h + 2 * head);
  ctx.lineTo(x, ground - h * 0.42);
  ctx.lineTo(x - h * 0.14, ground);
  ctx.moveTo(x, ground - h * 0.42);
  ctx.lineTo(x + h * 0.14, ground);
  // hands cupped at the mouth
  ctx.moveTo(x, ground - h * 0.7);
  ctx.lineTo(x + h * 0.15, ground - h * 0.78);
  ctx.lineTo(x + h * 0.16, ground - h * 0.86);
  ctx.stroke();
  if (shouting) {
    ctx.beginPath();
    ctx.arc(x + head * 0.55, ground - h + head * 1.15, head * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWall(ctx, s, x, top, ground) {
  const w = 16;
  const h = ground - top;
  if (s.surface === "curtain") {
    ctx.fillStyle = "#b07cc6";
    ctx.fillRect(x, top, w, h);
    ctx.strokeStyle = "#8a5aa3";
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let y = top; y <= ground; y += 4) ctx.lineTo(x + 3 + k * 5 + 2 * Math.sin(y / 7 + k), y);
      ctx.stroke();
    }
  } else if (s.surface === "wood") {
    ctx.fillStyle = "#c8915a";
    ctx.fillRect(x, top, w, h);
    ctx.strokeStyle = "#9c6a3a";
    ctx.lineWidth = 1;
    for (let y = top + 14; y < ground; y += 14) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#a9b1bf";
    ctx.fillRect(x, top, w, h);
    ctx.strokeStyle = "#8a93a3";
    ctx.lineWidth = 1;
    for (let y = top + 10, r = 0; y < ground; y += 10, r++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.moveTo(x + (r % 2 ? 5 : 11), y - 10);
      ctx.lineTo(x + (r % 2 ? 5 : 11), y);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, top, w, h);
}

/** A short train of wavefronts: arcs of radius r around (cx, cy), between angles a0 and a1. */
function fronts(ctx, cx, cy, r, a0, a1, color, amp) {
  for (let k = 0; k < 3; k++) {
    const rk = r - k * 5;
    if (rk <= 0) continue;
    ctx.strokeStyle = color;
    ctx.globalAlpha = amp * (1 - k * 0.3);
    ctx.lineWidth = 1 + 2.5 * amp;
    ctx.beginPath();
    ctx.arc(cx, cy, rk, a0, a1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawTimeline(ctx, s, view, g) {
  const delay = echoDelay(distanceOf(s));
  const x0 = g.small ? 14 : 24;
  const x1 = view.w - (g.small ? 14 : 24);
  const y = view.h - g.tl + (g.small ? 26 : 36);
  const tMax = Math.max(0.2, delay * 1.25);
  const X = t => x0 + ((x1 - x0) * t) / tMax;
  const size = g.small ? 10 : 12;
  ctx.fillStyle = "rgba(240, 140, 46, 0.22)";
  ctx.fillRect(X(0), y - 10, X(ECHO_GAP) - X(0), 20);
  label(ctx, g.small ? "âm còn lưu trong tai 1/15 s" : "âm phát ra còn lưu trong tai 1/15 s", X(0) + 3, y - 18, { size, color: COLORS.orange });
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  for (let t = 0; t <= tMax + 1e-9; t += tMax > 0.5 ? 0.1 : 0.05) {
    ctx.beginPath();
    ctx.moveTo(X(t), y - 3);
    ctx.lineTo(X(t), y + 3);
    ctx.stroke();
  }
  label(ctx, "0", X(0), y + 12, { size, align: "center", color: COLORS.muted });
  label(ctx, `${fmt(tMax, 2)} s`, x1, y + 12, { size, align: "right", color: COLORS.muted });
  const heard = echoHeard(delay);
  const shown = !s.flying || s.returned;
  ctx.fillStyle = heard ? COLORS.green : COLORS.red;
  ctx.globalAlpha = shown ? 1 : 0.35;
  ctx.fillRect(X(delay) - 2, y - 12, 4, 24);
  ctx.globalAlpha = 1;
  label(ctx, `âm phản xạ về: ${ms(delay)}`, clamp(X(delay), x0 + 60, x1 - 60), y + 12, { size, align: "center", bold: true, color: heard ? COLORS.green : COLORS.red });
  if (s.flying || s.t > 0) {
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(X(Math.min(s.t, tMax)), y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWallScene(ctx, s, view) {
  const g = geomWall(s, view);
  const d = distanceOf(s);
  const delay = echoDelay(d);
  const heard = echoHeard(delay);
  const r = reflectance(s);

  // ground
  ctx.fillStyle = "#e7dfcf";
  ctx.fillRect(0, g.groundY, view.w, 6);

  // distance
  const dy = g.groundY + (g.small ? 9 : 13);
  arrow(ctx, (g.mouth.x + g.wallX) / 2, dy, g.mouth.x, dy, COLORS.muted, 1.5);
  arrow(ctx, (g.mouth.x + g.wallX) / 2, dy, g.wallX, dy, COLORS.muted, 1.5);
  label(ctx, `d = ${fmt(d, 1)} m`, (g.mouth.x + g.wallX) / 2, dy - 9, { size: g.small ? 11 : 13, align: "center", bold: true });

  // waves (image-source picture: the echo spreads from the mirror image of the mouth behind the wall)
  if (s.flying) {
    const rPx = V_AIR * s.t * g.ppm;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, g.top, g.wallX, g.groundY - g.top);
    ctx.clip();
    fronts(ctx, g.mouth.x, g.mouth.y, rPx, -0.9, 0.9, WAVE, 1);
    const image = 2 * g.wallX - g.mouth.x;
    if (rPx > g.wallX - g.mouth.x) fronts(ctx, image, g.mouth.y, rPx, Math.PI - 0.9, Math.PI + 0.9, ECHO, Math.max(0.12, r));
    ctx.restore();
  }

  drawPerson(ctx, g.x0, g.groundY, g.person, s.flying && s.t < ECHO_GAP);
  drawWall(ctx, s, g.wallX, g.top, g.groundY);

  // headline
  const size = g.small ? 12 : 15;
  label(ctx, `t = 2d/v = 2 · ${fmt(d, 1)} / ${V_AIR} = ${sec(delay)}`, view.w / 2, g.small ? 11 : 20, { size, bold: true, align: "center" });
  const done = !s.flying || s.returned;
  const verdict = heard
    ? `t ≥ 1/15 s: nghe được tiếng vang${r < 0.3 ? " (rất nhỏ)" : ""}`
    : g.small
      ? "t < 1/15 s: không có tiếng vang riêng"
      : "t < 1/15 s: âm phản xạ trùng âm phát ra, không nghe thấy tiếng vang riêng";
  label(ctx, done ? verdict : `Âm đang truyền… (chậm ${fmt(2 / delay, 0)} lần)`, view.w / 2, g.small ? 27 : 44, {
    size: g.small ? 11 : 13, align: "center", bold: done, color: done ? (heard ? COLORS.green : COLORS.red) : COLORS.muted,
  });
  if (!g.small) label(ctx, "Người và tường không vẽ theo tỉ lệ; khoảng cách thì đúng tỉ lệ.", view.w - 12, g.top - 2, { size: 11, align: "right", color: COLORS.muted });

  drawTimeline(ctx, s, view, g);
}

function geomSea(view) {
  const small = view.w < 560 || view.h < 420;
  const top = small ? 36 : 56;
  const surface = top + (view.h - top) * 0.16;
  const bed = view.h - (small ? 34 : 50);
  return { small, top, surface, bed, cx: view.w * 0.42 };
}

function drawSonarScene(ctx, s, view) {
  const g = geomSea(view);
  const h = seaDepth(s.seed);
  // sky and sea
  ctx.fillStyle = "#e6f1fb";
  ctx.fillRect(0, 0, view.w, g.surface);
  const sea = ctx.createLinearGradient(0, g.surface, 0, g.bed);
  sea.addColorStop(0, "#5aa7e0");
  sea.addColorStop(1, "#1d4f8a");
  ctx.fillStyle = sea;
  ctx.fillRect(0, g.surface, view.w, view.h - g.surface);
  // sea floor, its shape depends on the seed
  ctx.fillStyle = "#8a6f4d";
  ctx.beginPath();
  ctx.moveTo(0, view.h);
  for (let x = 0; x <= view.w; x += 8) {
    const bump = x === Math.round(g.cx / 8) * 8 ? 0 : Math.abs(x - g.cx) < 40 ? 0 : 6 * Math.sin(x / 23 + s.seed) + 5 * Math.sin(x / 9 + 2 * s.seed);
    ctx.lineTo(x, g.bed + bump);
  }
  ctx.lineTo(view.w, view.h);
  ctx.fill();
  ctx.fillRect(g.cx - 40, g.bed, 80, view.h - g.bed);

  // ultrasound pulse
  if (s.flying) {
    const f = (V_SEA * s.t) / h; // fraction of the depth covered: down 0 → 1, back 1 → 2
    const down = f <= 1;
    const y = g.surface + 14 + (down ? f : Math.max(0, 2 - f)) * (g.bed - g.surface - 14);
    for (let k = 0; k < 3; k++) {
      const yk = y + (down ? -1 : 1) * k * 5;
      ctx.strokeStyle = down ? "#ffffff" : "#ffd84d";
      ctx.globalAlpha = 1 - k * 0.3;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(g.cx - 26, yk + (down ? -6 : 6));
      ctx.quadraticCurveTo(g.cx, yk + (down ? 6 : -6), g.cx + 26, yk + (down ? -6 : 6));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ship
  const sw = g.small ? 70 : 100;
  ctx.fillStyle = "#e5484d";
  ctx.beginPath();
  ctx.moveTo(g.cx - sw / 2, g.surface - 12);
  ctx.lineTo(g.cx + sw / 2, g.surface - 12);
  ctx.lineTo(g.cx + sw * 0.38, g.surface + 6);
  ctx.lineTo(g.cx - sw * 0.38, g.surface + 6);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(g.cx - sw * 0.2, g.surface - 26, sw * 0.4, 14);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(g.cx - 5, g.surface + 6, 10, 6); // transducer
  label(ctx, "máy phát – thu siêu âm", g.cx + sw * 0.4 + 8, g.surface + 12, { size: g.small ? 10 : 12, color: "#ffffff" });

  // depth marker
  const xm = g.cx + (g.small ? 60 : 110);
  arrow(ctx, xm, (g.surface + g.bed) / 2, xm, g.surface + 4, "#ffffff", 1.5);
  arrow(ctx, xm, (g.surface + g.bed) / 2, xm, g.bed - 2, "#ffffff", 1.5);
  label(ctx, s.solved ? `h = ${fmt(h, 0)} m` : "h = ?", xm + 8, (g.surface + g.bed) / 2, { size: g.small ? 13 : 16, bold: true, color: "#ffffff" });

  // headline
  const size = g.small ? 12 : 15;
  label(ctx, "Đo độ sâu đáy biển: h = v · t / 2, v = 1500 m/s", view.w / 2, g.small ? 11 : 18, { size, bold: true, align: "center" });
  const line2 = s.solved
    ? `Đúng! h = 1500 · ${sec(sonarDelay(h))} / 2 = ${fmt(h, 0)} m`
    : s.measured
      ? `Thời gian từ lúc phát đến lúc thu: t = ${sec(s.measured)}`
      : s.flying
        ? "Sóng siêu âm đang truyền…"
        : "Bấm “Phát sóng siêu âm” để đo thời gian t";
  label(ctx, line2, view.w / 2, g.small ? 26 : 40, { size: g.small ? 11 : 13, align: "center", bold: !!s.measured, color: s.solved ? COLORS.green : COLORS.ink });
  label(ctx, g.small ? "Không theo tỉ lệ." : "Hình không theo tỉ lệ.", view.w - 10, view.h - 12, { size: 11, align: "right", color: "#e6f1fb" });
}

const restart = s => {
  s.flying = false;
  s.returned = false;
  s.t = 0;
};

mount({
  slug: "phan-xa-am-tieng-vang",
  version: "1.0.0",
  title: "Phản xạ âm, tiếng vang và đo độ sâu",
  hint: "Kéo bức tường ra xa hoặc lại gần rồi hét một tiếng. Ở cảnh tàu biển, đo thời gian sóng siêu âm đi và về để tính độ sâu.",
  initialState,
  timeScale: s => Math.max(1e-3, delayOf(s) / 2.2), // slow motion: the round trip lasts about 2 s
  step(s, dt, api) {
    if (!s.flying) return api.pause();
    if (advance(s, dt)) {
      const delay = delayOf(s);
      if (s.scene === "sonar") {
        s.measured = delay;
        api.emit("sonar-echo", { delay }, "result");
      } else {
        api.emit("echo", { distance: distanceOf(s), delay, heard: echoHeard(delay) ? 1 : 0, amplitude: reflectance(s) }, "result");
      }
    }
  },
  controls: [
    {
      type: "select",
      key: "scene",
      label: "Thí nghiệm",
      options: [
        { value: "wall", label: "Tiếng vang trước bức tường" },
        { value: "sonar", label: "Đo độ sâu đáy biển bằng siêu âm" },
      ],
      onCommit: restart,
    },
    { type: "slider", key: "distance", label: "Khoảng cách đến tường d", min: D_RANGE[0], max: D_RANGE[1], step: 0.5, unit: "m", digits: 1, visible: s => s.scene === "wall", onCommit: restart },
    {
      type: "select",
      key: "surface",
      label: "Mặt phản xạ",
      options: [
        { value: "concrete", label: "Tường bê tông (cứng, nhẵn: phản xạ tốt)" },
        { value: "wood", label: "Vách gỗ" },
        { value: "curtain", label: "Rèm vải dày, xốp (hấp thụ âm)" },
      ],
      visible: s => s.scene === "wall",
      onCommit: restart,
    },
    {
      type: "button",
      label: "Hét một tiếng",
      primary: true,
      visible: s => s.scene === "wall",
      action(s, api) {
        emitPulse(s);
        api.play();
        api.emit("shout", { distance: distanceOf(s) }, "action");
      },
    },
    {
      type: "button",
      label: "Phát sóng siêu âm",
      primary: true,
      visible: s => s.scene === "sonar",
      action(s, api) {
        emitPulse(s);
        api.play();
        api.emit("ping", {}, "action");
      },
    },
    { type: "slider", key: "answer", label: "Độ sâu em tính được h", min: 0, max: 4500, step: 1, unit: "m", digits: 0, visible: s => s.scene === "sonar" && !s.solved },
    {
      type: "button",
      label: "Kiểm tra độ sâu",
      visible: s => s.scene === "sonar" && !s.solved,
      action(s, api) {
        const h = seaDepth(s.seed);
        const ok = answerOk(s.answer, h);
        s._msg = ok ? "" : s.measured ? "Chưa đúng. Dùng h = v · t / 2 với v = 1500 m/s." : "Hãy phát sóng siêu âm để đo t trước đã.";
        api.emit("depth-answer", { answer: s.answer, correct: ok ? 1 : 0 }, "result");
        if (ok) {
          s.solved = true;
          api.emit("depth-found", { depth: h, answer: s.answer, delay: sonarDelay(h) }, "goal");
        }
      },
    },
    {
      type: "button",
      label: "Vùng biển khác",
      visible: s => s.scene === "sonar",
      action(s, api) {
        s.seed = (Math.round(s.seed) % 99999) + 1;
        s.solved = false;
        s.measured = 0;
        s.answer = 0;
        s._msg = "";
        restart(s);
        api.emit("new-sea", { seed: s.seed }, "action");
      },
    },
  ],
  readouts: [
    { label: "Thời gian âm đi và về", value: s => (s.scene === "sonar" ? (s.measured ? sec(s.measured) : "–") : sec(echoDelay(distanceOf(s)))) },
    { label: "Tiếng vang", value: s => (s.scene === "sonar" ? "–" : echoHeard(echoDelay(distanceOf(s))) ? "nghe được" : "không nghe riêng được") },
    { label: "Khoảng cách nhỏ nhất có tiếng vang", value: () => `≈ ${fmt(minEchoDistance(), 1)} m` },
    { label: "Âm phản xạ so với âm tới", value: s => (s.scene === "sonar" ? "–" : `${fmt(reflectance(s) * 100, 0)} %`) },
    { label: "Nhận xét", value: s => (s.scene === "sonar" ? (s.solved ? "Đúng rồi!" : s._msg || "–") : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      if (s.scene !== "wall") return false;
      const g = geomWall(s, view);
      if (Math.abs(p.x - g.wallX - 8) > 22 || p.y < g.top - 10 || p.y > g.groundY + 10) return false;
      restart(s);
      return true;
    },
    move(p, s, api, view) {
      const g = geomWall(s, view);
      s.distance = clamp(Math.round(((p.x - 8 - g.mouth.x) / g.ppm) * 2) / 2, D_RANGE[0], D_RANGE[1]);
    },
    up(p, s, api) {
      api.emit("move-wall", { distance: s.distance }, "action");
    },
  },
  draw(ctx, s, view) {
    if (s.scene === "sonar") drawSonarScene(ctx, s, view);
    else drawWallScene(ctx, s, view);
  },
});
