import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { LENGTH, initialState, step, flight, clock, finished, position, grazing, entrySpeed } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** 4,4·10¹⁴ style, for the very large and very small numbers of this topic. */
const sci = (x, digits = 2) => {
  if (!Number.isFinite(x)) return "–";
  if (x === 0) return "0";
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = x / 10 ** e;
  if (Math.abs(m) >= 10 - 0.5 * 10 ** -digits) {
    m /= 10;
    e++;
  }
  return `${fmt(m, digits)}·10${e < 0 ? "⁻" : ""}${String(Math.abs(e)).replace(/\d/g, c => SUP[c])}`;
};
const plateName = sign => (sign > 0 ? "bản dương" : "bản âm"); // the plate the particle moves towards

const restart = (s, api) => {
  s.time = 0;
  api.pause();
};

const fire = (s, api) => {
  s.time = 0;
  api.play();
  const data = { voltage: s.voltage, gap: s.gap, speed: s.mode === "rest" ? 0 : entrySpeed(s) };
  api.emit("fire", data, "action");
};

// One result per flight, when the particle leaves the plates or lands on one.
function report(s, api, f) {
  if (f.rest) {
    const data = { speed: f.vEnd, time: f.tEnd * 1e9, voltage: s.voltage, gap: s.gap };
    api.emit("reached-plate", data, "result");
    return;
  }
  // no exit direction after an impact, no impact point after an exit: the key is left out rather than faked
  const end = f.hit ? { impactX: f.x * 100 } : { exitAngle: f.angle };
  const data = { deflection: f.y * 100, ...end, hit: f.hit ? 1 : 0, voltage: s.voltage, gap: s.gap, speed: f.v0 };
  api.emit("flight-ended", data, "result");
  if (grazing(f)) {
    const edge = { deflection: f.y * 100, margin: (f.d / 2 - f.y) * 100 };
    api.emit("grazing-exit", edge, "goal");
  }
}

function layout(view) {
  const small = view.w < 520 || view.h < 400;
  const top = small ? 26 : 40;
  const bottom = small ? 40 : 58;
  // world: x from −2,5 cm (before the plates) to L + 3 cm, y within ±5,5 cm (the widest gap is 10 cm)
  const sc = Math.min((view.w - 16) / (LENGTH + 5.5), (view.h - top - bottom) / 11.4);
  const left = (view.w - (LENGTH + 5.5) * sc) / 2;
  const cy = top + (view.h - top - bottom) / 2;
  return { small, sc, top, bottom, X: cm => left + (cm + 2.5) * sc, Y: cm => cy - cm * sc };
}

function result(s, f) {
  if (!finished(s, f)) {
    if (f.rest && f.E === 0) return ["U = 0: không có điện trường, hạt đứng yên.", COLORS.muted];
    return [clock(s, f) > 0 ? "Hạt đang bay…" : f.rest ? "Bấm «Thả hạt» để thả hạt từ trạng thái nghỉ." : "Bấm «Bắn hạt» để phóng hạt vào giữa hai bản.", COLORS.muted];
  }
  if (f.rest) return [`Tới ${plateName(f.sign)} với v = √(2|q|U/m) = ${sci(f.vEnd)} m/s`, COLORS.green];
  if (f.hit) return [`Chạm ${plateName(f.sign)} tại x = ${fmt(f.x * 100)} cm (chưa ra khỏi bản)`, COLORS.red];
  const edge = grazing(f) ? " – sát mép bản!" : "";
  return [`Ra khỏi bản: y = ${fmt(f.y * 100)} cm, θ = ${fmt(f.angle, 1)}°${edge}`, COLORS.green];
}

function draw(ctx, s, view) {
  const g = layout(view);
  const { X, Y, small } = g;
  const f = flight(s);
  const t = clock(s, f);
  const done = finished(s, f);
  const now = position(f, t);
  const size = small ? 12 : 14;
  const half = (f.d * 100) / 2;
  const cm = v => v * 100;

  // field lines, from the positive plate down to the negative one
  if (f.E > 0) {
    const n = small ? 6 : 9;
    for (let k = 0; k < n; k++) {
      const x = X(((k + 0.5) * LENGTH) / n);
      arrow(ctx, x, Y(half) + 6, x, Y(-half) - 6, "rgba(107, 120, 144, 0.3)", 1.5);
    }
    label(ctx, "E", X(LENGTH * (1 - 0.5 / n)) + 7, Y(-half * 0.55), { size, color: COLORS.muted, bold: true });
  }

  // plates
  const plate = (y, color, sign, dir) => {
    ctx.fillStyle = color;
    ctx.fillRect(X(0), Y(y) - (dir > 0 ? 7 : 0), LENGTH * g.sc, 7);
    for (let k = 0; k < 6; k++) label(ctx, sign, X(((k + 0.5) * LENGTH) / 6), Y(y) - dir * 16, { size: size + 2, color, bold: true, align: "center" });
  };
  plate(half, COLORS.red, "+", 1);
  plate(-half, COLORS.blue, "−", -1);
  label(ctx, `U = ${fmt(s.voltage)} V,  E = U/d = ${fmt(f.E, 0)} V/m`, X(LENGTH / 2), Math.max(10, Y(half) - 34), { size, bold: true, align: "center" });
  label(ctx, `L = ${fmt(LENGTH)} cm`, X(LENGTH / 2), Math.min(view.h - g.bottom + 4, Y(-half) + 34), { size: size - 1, color: COLORS.muted, align: "center" });

  // separation d, marked to the left of the plates
  const dx = X(-1.6);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(dx, Y(half));
  ctx.lineTo(dx, Y(-half));
  for (const y of [half, -half]) {
    ctx.moveTo(dx - 5, Y(y));
    ctx.lineTo(X(0), Y(y));
  }
  ctx.stroke();
  label(ctx, `d = ${fmt(s.gap, 1)} cm`, Math.max(4, dx - 20), Y(half) - 12, { size: size - 1, color: COLORS.muted });

  if (!f.rest) {
    // entry direction (x axis) and the launch velocity
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(X(-1.2), Y(0));
    ctx.lineTo(X(LENGTH + 3), Y(0));
    ctx.stroke();
    ctx.setLineDash([]);
    if (t === 0) {
      arrow(ctx, X(0) + 10, Y(0), X(0) + 10 + (small ? 34 : 48), Y(0), COLORS.green, 2.5);
      label(ctx, "v₀", X(0) + 30, Y(0) - 12, { size, color: COLORS.green, bold: true, align: "center" });
    }
  }

  // path so far
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 3;
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.beginPath();
  for (let k = 0; k <= 40; k++) {
    const p = position(f, (t * k) / 40);
    ctx[k ? "lineTo" : "moveTo"](X(cm(p.x)), Y(cm(p.y)));
  }
  ctx.stroke();

  let at = [X(cm(now.x)), Y(cm(now.y))];
  if (done && !f.rest && !f.hit) {
    // after the plates there is no force: straight on along the exit direction
    const run = 2.6; // cm
    const tip = [X(LENGTH + run), Y(cm(now.y) + f.sign * f.tan * run)];
    arrow(ctx, at[0], at[1], tip[0], tip[1], COLORS.orange, 3);
    // deflection y at the end of the plates
    if (f.y * 100 * g.sc > 6) {
      ctx.strokeStyle = COLORS.purple;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(X(LENGTH), Y(0));
      ctx.lineTo(X(LENGTH), at[1]);
      ctx.stroke();
      label(ctx, "y", X(LENGTH) - 9, (Y(0) + at[1]) / 2, { size, color: COLORS.purple, bold: true, align: "center" });
      // exit angle θ against the entry direction
      const r = small ? 24 : 34;
      const a = -f.sign * Math.atan(f.tan);
      ctx.strokeStyle = COLORS.green;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(at[0], at[1]);
      ctx.lineTo(at[0] + r + 8, at[1]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(at[0], at[1], r, Math.min(0, a), Math.max(0, a));
      ctx.stroke();
      label(ctx, "θ", at[0] + r + 9, at[1] + (a / 2) * r - f.sign * 2, { size, color: COLORS.green, bold: true });
    }
    at = tip;
  }

  if (done && f.hit) {
    // impact mark
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const [ax, ay] of [[-1, -1], [-1, 1]]) {
      ctx.moveTo(at[0] + 7 * ax, at[1] + 7 * ay);
      ctx.lineTo(at[0] - 7 * ax, at[1] - 7 * ay);
    }
    ctx.stroke();
  }

  // the particle (drawn far larger than life) with the electric force on it
  const inField = !done && f.E > 0;
  const R = small ? 7 : 9;
  if (inField) {
    arrow(ctx, at[0], at[1], at[0], at[1] - f.sign * (small ? 30 : 40), COLORS.red, 2.5);
    label(ctx, "F", at[0] + 9, at[1] - f.sign * (small ? 26 : 34), { size, color: COLORS.red, bold: true });
  }
  if (f.rest && t > 0 && !done) {
    const v = Math.abs(now.vy) / f.vEnd;
    label(ctx, `v = ${sci(Math.abs(now.vy))} m/s`, at[0] + R + 22, at[1], { size, color: COLORS.green, bold: true });
    arrow(ctx, at[0] - R - 8, at[1], at[0] - R - 8, at[1] - f.sign * 44 * v, COLORS.green, 2.5);
  }
  if (!(done && !f.rest && !f.hit)) {
    const proton = s.particle === "proton";
    ctx.fillStyle = proton ? COLORS.red : COLORS.blue;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(at[0], at[1], R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(ctx, proton ? "+" : "−", at[0], at[1] + (proton ? 0 : -1), { size: R * 1.6, color: "#fff", bold: true, align: "center" });
  }

  // outcome and conventions
  const [text, color] = result(s, f);
  ctx.font = `600 ${size + 1}px ${FONT}`;
  const fit = Math.min(size + 1, ((size + 1) * (view.w - 16)) / ctx.measureText(text).width);
  label(ctx, text, view.w / 2, view.h - g.bottom + (small ? 14 : 22), { size: fit, color, bold: true, align: "center" });
  const note = small ? "Bỏ qua trọng lực. Đúng tỉ lệ; hạt vẽ phóng to." : "Chân không, bỏ qua trọng lực. Hình vẽ đúng tỉ lệ (cm); riêng hạt được vẽ phóng to.";
  const noteSize = small ? 11 : 12;
  ctx.font = `${noteSize}px ${FONT}`;
  label(ctx, note, view.w / 2, view.h - (small ? 9 : 14), { size: Math.min(noteSize, (noteSize * (view.w - 16)) / ctx.measureText(note).width), color: COLORS.muted, align: "center" });
}

const across = s => s.mode !== "rest";
const whenDone = (s, text) => {
  const f = flight(s);
  return finished(s, f) ? text(f) : "–";
};

mount({
  slug: "hat-trong-dien-truong",
  version: "1.0.0",
  title: "Chuyển động của hạt mang điện trong điện trường đều",
  hint: "Chỉnh hiệu điện thế, khoảng cách hai bản và tốc độ rồi bắn hạt. Thử làm cho hạt bay ra sát mép bản mà không chạm.",
  initialState,
  step(s, dt, api) {
    const f = flight(s);
    if (!Number.isFinite(f.tEnd)) return api.pause(); // U = 0 and no initial speed: nothing moves
    if (finished(s, f)) s.time = 0; // ▶ on a finished flight fires again
    step(s, dt);
    if (finished(s, f)) {
      api.pause();
      report(s, api, f);
    }
  },
  controls: [
    {
      type: "select", key: "particle", label: "Hạt", onChange: restart,
      options: [
        { value: "electron", label: "Electron (q = −e, m = 9,11·10⁻³¹ kg)" },
        { value: "proton", label: "Proton (q = +e, m = 1,67·10⁻²⁷ kg)" },
      ],
    },
    {
      type: "select", key: "mode", label: "Cách đưa hạt vào", onChange: restart,
      options: [
        { value: "across", label: "Bay vào với v₀ vuông góc đường sức" },
        { value: "rest", label: "Thả không vận tốc đầu từ một bản" },
      ],
    },
    { type: "slider", key: "voltage", label: "Hiệu điện thế U", min: 0, max: 200, step: 1, unit: "V", digits: 0, onChange: restart },
    { type: "slider", key: "gap", label: "Khoảng cách hai bản d", min: 2, max: 10, step: 0.5, unit: "cm", digits: 1, onChange: restart },
    {
      type: "slider", key: "speedE", label: "Tốc độ ban đầu v₀", min: 5, max: 30, step: 0.5, onChange: restart,
      format: v => `${sci(v * 1e6)} m/s`, visible: s => across(s) && s.particle !== "proton",
    },
    {
      type: "slider", key: "speedP", label: "Tốc độ ban đầu v₀", min: 1, max: 10, step: 0.1, onChange: restart,
      format: v => `${sci(v * 1e5)} m/s`, visible: s => across(s) && s.particle === "proton",
    },
    { type: "button", label: "Bắn hạt", primary: true, action: fire, visible: across },
    { type: "button", label: "Thả hạt", primary: true, action: fire, visible: s => !across(s), disabled: s => s.voltage <= 0 },
  ],
  readouts: [
    { label: "Điện trường E = U/d", value: s => `${fmt(flight(s).E, 0)} V/m` },
    { label: "Lực điện F = |q|E", value: s => `${sci(flight(s).force)} N` },
    { label: "Gia tốc a = |q|E/m", value: s => `${sci(flight(s).a)} m/s²` },
    { label: "Độ lệch y khi ra khỏi bản", value: s => whenDone(s, f => (f.rest ? "–" : f.hit ? "chạm bản" : `${fmt(f.y * 100)} cm`)) },
    { label: "Góc lệch θ (tan θ = |q|EL/mv₀²)", value: s => whenDone(s, f => (f.rest || f.hit ? "–" : `${fmt(f.angle, 1)}°`)) },
    { label: "Tốc độ cuối", value: s => whenDone(s, f => `${sci(f.vEnd)} m/s`) },
    { label: "Thời gian bay", value: s => whenDone(s, f => `${fmt(f.tEnd * 1e9, 1)} ns`) },
  ],
  draw,
});
