import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { PLANETS, DAYS_PER_YEAR, BELT, QUIZ_ORDER, initialState, step, angleAt, isInner, compare, quizTap, validIndex, tidy } from "./model.js";

const A_MAX = PLANETS[PLANETS.length - 1].a;
const TYPE = { rock: "đất đá", gas: "khí" };

const years = y => (y < 2 ? `${fmt(y, 3)} năm (${fmt(y * DAYS_PER_YEAR, 0)} ngày)` : `${fmt(y, 2)} năm`);

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const strip = small ? 50 : 76; // size comparison at the bottom
  const top = small ? 20 : 30; // convention note
  const sceneH = Math.max(60, view.h - strip - top);
  const R = Math.max(30, Math.min(view.w / 2 - (small ? 10 : 24), sceneH / 2 - 6));
  return { small, strip, top, sceneH, cx: view.w / 2, cy: top + sceneH / 2, R };
}

const orbitRadius = (s, k, g) => (s.layout === "scale" ? (g.R * PLANETS[k].a) / A_MAX : g.R * (0.17 + (0.83 * k) / 7));
const bodyRadius = (k, g) => Math.max(2.5, (2.5 + 2.2 * Math.sqrt(PLANETS[k].diameter)) * Math.min(1, g.R / 180));
const beltRadius = (s, g) => (s.layout === "scale" ? (g.R * BELT) / A_MAX : (orbitRadius(s, 3, g) + orbitRadius(s, 4, g)) / 2);

function position(s, k, g) {
  const r = orbitRadius(s, k, g);
  const a = angleAt(PLANETS[k], s.time);
  return { x: g.cx + r * Math.cos(a), y: g.cy - r * Math.sin(a), r: bodyRadius(k, g) };
}

// Quiz board: a progress row and a 4 × 2 grid of planet chips in a fixed shuffled order.
function quizGeom(g, view) {
  const x0 = 10;
  const w = view.w - 20;
  const rowY = g.top + (g.small ? 34 : 48);
  const gridTop = rowY + (g.small ? 22 : 34);
  const chipW = w / 4;
  const chipH = Math.min(86, (view.h - g.strip - gridTop - 8) / 2);
  const chips = QUIZ_ORDER.map((k, n) => ({ k, x: x0 + (n % 4) * chipW, y: gridTop + Math.floor(n / 4) * chipH, w: chipW, h: chipH }));
  return { x0, w, rowY, chips };
}

const reportCompare = (s, api) => {
  if (!validIndex(s.selected) || !validIndex(s.compare) || s.selected === s.compare) return;
  api.emit("compare-planets", { first: s.selected, second: s.compare, ...compare(s.selected, s.compare) }, "result");
};

const resetQuiz = s => {
  s.quizStep = 0;
  s.quizMistakes = 0;
  s._msg = "";
};

function drawPlanet(ctx, k, x, y, r) {
  const p = PLANETS[k];
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (k === 5) {
    // Saturn's rings
    ctx.strokeStyle = "#a8925a";
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r * 0.45, -0.35, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSizes(ctx, view, g) {
  const y0 = view.h - g.strip;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, y0, view.w, g.strip);
  ctx.strokeStyle = COLORS.grid;
  ctx.beginPath();
  ctx.moveTo(0, y0);
  ctx.lineTo(view.w, y0);
  ctx.stroke();
  const size = g.small ? 10 : 12;
  label(ctx, g.small ? "Đường kính so sánh (đúng tỉ lệ)" : "Đường kính các hành tinh so sánh với nhau (đúng tỉ lệ; Mặt Trời gấp 109 lần Trái Đất, không vẽ)", 8, y0 + 9, { size, color: COLORS.muted });
  const rMax = (g.strip - 9 - 2 * size - 2) / 2;
  const cy = y0 + 13 + rMax + 2;
  const slot = view.w / PLANETS.length;
  PLANETS.forEach((p, k) => {
    const x = slot * (k + 0.5);
    drawPlanet(ctx, k, x, cy, Math.max(0.8, (rMax * p.diameter) / 11.21));
    label(ctx, p.short, x, view.h - size / 2 - 3, { size: slot < 52 ? 9 : size, align: "center", color: COLORS.ink });
  });
}

function drawCard(ctx, k, x, y, color, title) {
  const p = PLANETS[k];
  const lines = [
    `Cách Mặt Trời: ${fmt(p.a, 3)} AU`,
    `Chu kì: ${years(p.period)}`,
    `Đường kính: ${fmt(p.diameter, 2)} lần Trái Đất`,
    `Hành tinh ${TYPE[p.type]}, vòng ${isInner(p) ? "trong" : "ngoài"}`,
  ];
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, 214, 106, 8);
  ctx.fill();
  ctx.stroke();
  label(ctx, `${title}: ${p.name}`, x + 10, y + 15, { bold: true, size: 13, color });
  lines.forEach((t, i) => label(ctx, t, x + 10, y + 36 + i * 19, { size: 12 }));
}

function drawOrbits(ctx, s, view, g) {
  const note = s.layout === "scale"
    ? g.small ? "Khoảng cách đúng tỉ lệ · cỡ Mặt Trời, hành tinh phóng to" : "Khoảng cách đúng tỉ lệ (1 AU = khoảng cách Trái Đất – Mặt Trời). Mặt Trời và hành tinh vẽ phóng to."
    : g.small ? "Khoảng cách không theo tỉ lệ (bố trí cho dễ nhìn)" : "Khoảng cách không theo tỉ lệ (bố trí cho dễ nhìn). Mặt Trời và hành tinh vẽ phóng to.";
  label(ctx, note, view.w / 2, g.top / 2 + 2, { size: g.small ? 11 : 13, align: "center", color: COLORS.muted });

  // orbits (drawn as circles: real ones are slightly elliptical)
  ctx.lineWidth = 1;
  PLANETS.forEach((p, k) => {
    ctx.strokeStyle = k === s.selected ? COLORS.blue : k === s.compare ? COLORS.orange : COLORS.grid;
    ctx.lineWidth = k === s.selected || k === s.compare ? 2 : 1;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, orbitRadius(s, k, g), 0, Math.PI * 2);
    ctx.stroke();
  });
  // asteroid belt between the inner and the outer planets
  ctx.setLineDash([1, 5]);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(g.cx, g.cy, beltRadius(s, g), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Sun
  const sunR = (s.layout === "scale" ? 5 : 11) * Math.min(1, g.R / 160) + 2;
  const glow = ctx.createRadialGradient(g.cx, g.cy, sunR * 0.3, g.cx, g.cy, sunR * 2.2);
  glow.addColorStop(0, "rgba(245,197,24,0.9)");
  glow.addColorStop(1, "rgba(245,197,24,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(g.cx, g.cy, sunR * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5a524";
  ctx.beginPath();
  ctx.arc(g.cx, g.cy, sunR, 0, Math.PI * 2);
  ctx.fill();

  PLANETS.forEach((p, k) => {
    const q = position(s, k, g);
    drawPlanet(ctx, k, q.x, q.y, q.r);
    if (k === s.selected || k === s.compare) {
      ctx.strokeStyle = k === s.selected ? COLORS.blue : COLORS.orange;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    const named = k === s.selected || k === s.compare || (!g.small && (s.layout === "easy" || p.a > BELT));
    // inner planets crowd the Sun at true scale: their names go in a list under it
    const crowded = s.layout === "scale" && p.a < BELT;
    if (named && !crowded) label(ctx, p.name, q.x + q.r + 5, q.y - q.r - 4, { size: g.small ? 11 : 12, bold: k === s.selected, color: COLORS.ink });
  });
  if (s.layout === "scale") {
    const inner = [s.selected, s.compare].filter((k, i, a) => validIndex(k) && PLANETS[k].a < BELT && a.indexOf(k) === i);
    const text = inner.length ? `${inner.map(k => PLANETS[k].name).join(", ")}: sát Mặt Trời` : "4 hành tinh vòng trong: sát Mặt Trời";
    label(ctx, text, g.cx, g.cy + Math.max(26, beltRadius(s, g) + 12), { size: g.small ? 11 : 12, align: "center", color: COLORS.ink, bold: inner.length > 0 });
  }

  if (!g.small) {
    if (validIndex(s.selected)) drawCard(ctx, s.selected, 10, g.top + 4, COLORS.blue, "A");
    if (validIndex(s.compare) && s.compare !== s.selected) {
      drawCard(ctx, s.compare, view.w - 224, g.top + 4, COLORS.orange, "B");
      if (validIndex(s.selected)) {
        const c = compare(s.selected, s.compare);
        label(ctx, `TA : TB = ${fmt(c.periodRatio, 3)}    aA : aB = ${fmt(c.distanceRatio, 3)}`, view.w - 224, g.top + 124, { size: 12, color: COLORS.muted });
      }
    }
  }
}

function drawQuiz(ctx, s, view, g) {
  const q = quizGeom(g, view);
  label(ctx, "Chạm các hành tinh theo thứ tự từ gần đến xa Mặt Trời", view.w / 2, g.top + 4, { size: g.small ? 12 : 15, bold: true, align: "center" });
  const msg = s._msg || (s.quizStep === PLANETS.length ? `Hoàn thành! Số lần chọn sai: ${s.quizMistakes}` : `Đã xếp ${s.quizStep}/8 · chọn sai ${s.quizMistakes} lần`);
  label(ctx, msg, view.w / 2, g.top + (g.small ? 19 : 26), { size: g.small ? 11 : 13, align: "center", color: s.quizStep === PLANETS.length ? COLORS.green : COLORS.muted });
  // progress row: Sun, then the planets placed so far
  const slot = q.w / 9;
  ctx.fillStyle = "#f5a524";
  ctx.beginPath();
  ctx.arc(q.x0 + slot / 2, q.rowY, g.small ? 7 : 10, 0, Math.PI * 2);
  ctx.fill();
  for (let n = 0; n < PLANETS.length; n++) {
    const x = q.x0 + slot * (n + 1.5);
    if (n < s.quizStep) {
      drawPlanet(ctx, n, x, q.rowY - (g.small ? 4 : 6), g.small ? 4 : 6);
      label(ctx, PLANETS[n].short, x, q.rowY + (g.small ? 7 : 10), { size: g.small ? 9 : 11, align: "center" });
    } else {
      label(ctx, String(n + 1), x, q.rowY, { size: 11, align: "center", color: COLORS.muted });
    }
  }
  for (const c of q.chips) {
    const done = c.k < s.quizStep;
    ctx.fillStyle = done ? COLORS.grid : "#fff";
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6, 8);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = done ? 0.35 : 1;
    drawPlanet(ctx, c.k, c.x + c.w / 2, c.y + c.h * 0.42, Math.min(c.h * 0.22, 3 + 1.6 * Math.sqrt(PLANETS[c.k].diameter) * (g.small ? 1 : 1.6)));
    label(ctx, g.small ? PLANETS[c.k].short : PLANETS[c.k].name, c.x + c.w / 2, c.y + c.h - 14, { size: g.small ? 11 : 13, align: "center" });
    ctx.globalAlpha = 1;
  }
}

mount({
  slug: "he-mat-troi",
  version: "1.0.0",
  title: "Hệ Mặt Trời",
  hint: "Chạm một hành tinh để xem thông tin; chạm thêm hành tinh thứ hai để so sánh.",
  initialState,
  step,
  autoplay: true,
  sanitize(incoming, base) {
    const out = {};
    for (const key of Object.keys(base)) {
      const v = incoming[key];
      if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) out[key] = v;
    }
    return tidy({ ...base, ...out });
  },
  controls: [
    { type: "slider", key: "speed", label: "Tốc độ thời gian", min: 0.05, max: 10, step: 0.05, format: v => `${fmt(v, 2)} năm/giây` },
    {
      type: "select",
      key: "layout",
      label: "Cách vẽ khoảng cách",
      options: [
        { value: "easy", label: "Dễ nhìn (không theo tỉ lệ)" },
        { value: "scale", label: "Đúng tỉ lệ khoảng cách" },
      ],
    },
    { type: "select", key: "selected", label: "Hành tinh A", options: [{ value: -1, label: "— chưa chọn —" }, ...PLANETS.map((p, k) => ({ value: k, label: p.name }))], onCommit: reportCompare },
    { type: "select", key: "compare", label: "So sánh với hành tinh B", options: [{ value: -1, label: "— chưa chọn —" }, ...PLANETS.map((p, k) => ({ value: k, label: p.name }))], onCommit: reportCompare },
    { type: "checkbox", key: "quiz", label: "Đố vui: xếp hành tinh theo khoảng cách", onChange: resetQuiz },
    { type: "button", label: "Làm lại câu đố", action: resetQuiz, event: "quiz-restart", visible: s => s.quiz },
  ],
  readouts: [
    { label: "Thời gian trôi qua", value: s => `${fmt(s.time, 2)} năm` },
    { label: "Hành tinh A", value: s => (validIndex(s.selected) ? PLANETS[s.selected].name : "–") },
    { label: "Khoảng cách tới Mặt Trời", value: s => (validIndex(s.selected) ? `${fmt(PLANETS[s.selected].a, 3)} AU` : "–") },
    { label: "Chu kì quay quanh Mặt Trời", value: s => (validIndex(s.selected) ? years(PLANETS[s.selected].period) : "–") },
    { label: "Đường kính (so với Trái Đất)", value: s => (validIndex(s.selected) ? `${fmt(PLANETS[s.selected].diameter, 2)} lần` : "–") },
    { label: "Loại hành tinh", value: s => (validIndex(s.selected) ? `${TYPE[PLANETS[s.selected].type]}, vòng ${isInner(PLANETS[s.selected]) ? "trong" : "ngoài"}` : "–") },
    { label: "Chu kì A ÷ chu kì B", value: s => (validIndex(s.selected) && validIndex(s.compare) ? fmt(compare(s.selected, s.compare).periodRatio, 3) : "–") },
    { label: "Khoảng cách A ÷ khoảng cách B", value: s => (validIndex(s.selected) && validIndex(s.compare) ? fmt(compare(s.selected, s.compare).distanceRatio, 3) : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      if (s.quiz) {
        const chip = quizGeom(g, view).chips.find(c => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
        if (!chip || chip.k < s.quizStep || s.quizStep === PLANETS.length) return false;
        const out = quizTap(s, chip.k);
        s._msg = out === "wrong" ? `Chưa đúng: ${PLANETS[chip.k].name} chưa phải hành tinh tiếp theo.` : "";
        api.emit("quiz-pick", { index: chip.k, correct: out === "wrong" ? 0 : 1 });
        if (out === "done") api.emit("planets-ordered", { mistakes: s.quizMistakes }, "goal");
        api.sync();
        return false;
      }
      let best = -1;
      let bestD = Infinity;
      PLANETS.forEach((_, k) => {
        const q = position(s, k, g);
        const d = Math.hypot(p.x - q.x, p.y - q.y) - q.r;
        if (d < bestD) [best, bestD] = [k, d];
      });
      if (bestD > 16) return false;
      if (best !== s.selected) {
        if (validIndex(s.selected)) s.compare = s.selected;
        s.selected = best;
      }
      api.emit("select-planet", { index: best, distance: PLANETS[best].a, period: PLANETS[best].period });
      reportCompare(s, api);
      api.sync();
      return false;
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    if (s.quiz) drawQuiz(ctx, s, view, g);
    else drawOrbits(ctx, s, view, g);
    drawSizes(ctx, view, g);
  },
});
