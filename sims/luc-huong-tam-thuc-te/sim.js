import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, analyse, atMaxSafeSpeed, carPosition, lapLength, bucketSpeed, bucketNormal, G, CAR_MASS, WATER_MASS } from "./model.js";

const SCENES = ["flat", "banked", "bucket"];
const ROAD = "#cdd4e0";
const rad = deg => (deg * Math.PI) / 180;
const isSmall = view => view.w < 560 || view.h < 430;

// One result per finished adjustment; the goal once per road (not again while only the speed is nudged).
const report = (s, api) => {
  const a = analyse(s);
  const data = { scene: SCENES.indexOf(s.scene) + 1, speed: a.speed, radius: a.radius, holds: a.holds ? 1 : 0 };
  if (Number.isFinite(a.limit)) data.limit = a.limit; // no upper limit on a steep, grippy banked road
  api.emit("motion-checked", data, "result");
  const road = `${s.scene}|${s.radius}|${s.mu}|${s.bank}`;
  if (atMaxSafeSpeed(s) && s._found !== road) {
    s._found = road;
    api.emit("max-safe-speed-found", { speed: a.speed, limit: a.limit, radius: a.radius }, "goal");
  }
};

// A skid always starts where the car enters the curve.
const restart = s => {
  if (s.scene !== "bucket" && analyse(s).slip) s.dist = 0;
};

// The first of `texts` that fits the stage width (the last one is the shortest).
function fit(ctx, view, size, bold, texts) {
  ctx.font = `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  return texts.find(t => ctx.measureText(t).width <= view.w - 16) ?? texts.at(-1);
}

// Status line and formula; each is [long, short]. Returns the height used.
function header(ctx, view, ok, texts, formulas) {
  const small = isSmall(view);
  const s1 = small ? 11 : 16;
  const s2 = small ? 10.5 : 14;
  label(ctx, fit(ctx, view, s1, true, texts), view.w / 2, small ? 10 : 20, { size: s1, bold: true, align: "center", color: ok ? COLORS.green : COLORS.red });
  label(ctx, fit(ctx, view, s2, false, formulas), view.w / 2, small ? 25 : 46, { size: s2, align: "center", color: COLORS.muted });
  return small ? 36 : 62;
}

// Top view of the curve. box: { x, y, w, h } to draw in; main: with forces and labels.
function drawTop(ctx, s, a, box, main, small) {
  const Rp = Math.min(box.w, box.h) * (main ? 0.37 : 0.36);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const k = Rp / s.radius; // px per metre
  const roadW = Math.max(main ? 16 : 7, Rp * 0.22);
  const P = d => {
    const p = carPosition({ ...s, dist: d });
    return { x: cx + p.x * k, y: cy - p.y * k, heading: p.heading };
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  // road and its centre line
  ctx.strokeStyle = ROAD;
  ctx.lineWidth = roadW;
  ctx.beginPath();
  ctx.arc(cx, cy, Rp, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, Rp, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  const car = P(s.dist);
  // skid track
  if (a.slip) {
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const p = P((s.dist * i) / 24);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const toO = Math.hypot(cx - car.x, cy - car.y) || 1;
  const ux = (cx - car.x) / toO;
  const uy = (cy - car.y) / toO;
  if (main) {
    label(ctx, "O", cx - 10, cy - 10, { size: small ? 11 : 14, bold: true });
    if (!a.slip) {
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(car.x, car.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    label(ctx, `R = ${fmt(s.radius)} m`, cx - 8, cy + (small ? 11 : 15), { size: small ? 10 : 13, align: "right", color: COLORS.muted });
  }
  // car
  const L = Math.max(main ? 20 : 9, Rp * 0.2);
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(-car.heading);
  ctx.fillStyle = a.slip ? COLORS.red : COLORS.blue;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -L * 0.28, L, L * 0.56, L * 0.12);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(L * 0.12, -L * 0.2, L * 0.16, L * 0.4); // windscreen, at the front
  ctx.restore();
  if (main) {
    // velocity (tangent) and the friction force (towards the centre)
    const size = small ? 11 : 14;
    const Lv = clamp(s.speed * (small ? 1.6 : 2.6), 18, small ? 60 : 110);
    const hx = Math.cos(car.heading);
    const hy = -Math.sin(car.heading);
    arrow(ctx, car.x, car.y, car.x + hx * Lv, car.y + hy * Lv, COLORS.green, small ? 2 : 3);
    label(ctx, "v", car.x + hx * (Lv + 9), car.y + hy * (Lv + 9), { size, bold: true, color: COLORS.green, align: "center" });
    const Lmax = Rp * 0.5; // length of the largest static friction
    const ratio = a.available > 0 ? a.needed / a.available : 2;
    if (a.slip) {
      // what the turn would need, against what the road can give
      const need = Lmax * Math.min(ratio, 1.8);
      ctx.setLineDash([5, 4]);
      arrow(ctx, car.x, car.y, car.x + ux * need, car.y + uy * need, COLORS.purple, 2);
      ctx.setLineDash([]);
      label(ctx, small ? "cần" : "lực cần có", car.x + ux * need + hx * 14, car.y + uy * need + hy * 14, { size: small ? 10 : 12, color: COLORS.purple, bold: true });
    }
    const Lf = a.slip ? (a.available > 0 ? Lmax : 0) : Lmax * ratio;
    arrow(ctx, car.x, car.y, car.x + ux * Lf, car.y + uy * Lf, COLORS.orange, small ? 2.5 : 4);
    if (Lf > 12) label(ctx, a.slip ? "Fms" : "Fmsn", car.x + ux * Lf * 0.6 - hx * (small ? 13 : 20), car.y + uy * Lf * 0.6 - hy * (small ? 11 : 15), { size, bold: true, color: COLORS.orange, align: "center" });
  }
  ctx.restore();
}

function drawFlat(ctx, s, a, view) {
  const small = isSmall(view);
  const found = atMaxSafeSpeed(s);
  const max = `Tốc độ an toàn lớn nhất: vₘₐₓ ≈ ${fmt(a.limit, 1)} m/s`;
  const top = header(
    ctx,
    view,
    a.holds,
    found ? [max] : a.holds ? ["Xe bám đường: lực ma sát nghỉ đóng vai trò lực hướng tâm", "Xe bám đường"] : ["Lực ma sát không đủ lớn: xe trượt, văng ra phía ngoài khúc cua", "Ma sát không đủ: xe trượt ra ngoài!"],
    found
      ? [`vₘₐₓ = √(μ·g·R) = √(${fmt(s.mu)} · ${fmt(G, 1)} · ${fmt(s.radius)}) = ${fmt(a.limit, 1)} m/s`]
      : ["Xe còn bám đường khi m·v²/R ≤ μ·m·g, tức v ≤ vₘₐₓ = √(μ·g·R). Hãy tìm vₘₐₓ.", "Xe còn bám đường khi v ≤ vₘₐₓ = √(μ·g·R)"]
  );
  // needed against available force
  const rowH = small ? 16 : 24;
  const rows = [
    [small ? `Cần m·v²/R = ${fmt(a.needed, 0)} N` : `Lực hướng tâm cần có: m·v²/R = ${fmt(a.needed, 0)} N`, a.needed, a.holds ? COLORS.green : COLORS.red],
    [small ? `Ma sát nghỉ cực đại μ·m·g = ${fmt(a.available, 0)} N` : `Lực ma sát nghỉ cực đại: μ·m·g = ${fmt(a.available, 0)} N`, a.available, COLORS.orange],
  ];
  const y0 = view.h - rows.length * rowH - (small ? 3 : 10);
  const full = Math.min(view.w - 16, 560);
  const most = Math.max(a.needed, a.available, 1);
  rows.forEach(([text, value, color], i) => {
    const y = y0 + i * rowH;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = color;
    ctx.fillRect(8, y, (full * value) / most, rowH - 3);
    ctx.globalAlpha = 1;
    label(ctx, text, 13, y + (rowH - 3) / 2, { size: small ? 10.5 : 14, bold: true });
  });
  if (!small) label(ctx, `Nhìn từ trên xuống · m = ${fmt(CAR_MASS, 0)} kg · g = ${fmt(G, 1)} m/s²`, view.w - 10, y0 - 12, { size: 12, color: COLORS.muted, align: "right" });
  drawTop(ctx, s, a, { x: 0, y: top, w: view.w, h: y0 - top - 4 }, true, small);
}

function drawBanked(ctx, s, a, view) {
  const small = isSmall(view);
  const mg = CAR_MASS * G;
  const noFriction = Math.abs(a.friction) < 0.02 * mg;
  const found = atMaxSafeSpeed(s);
  const texts = found
    ? [`Tốc độ an toàn lớn nhất: vₘₐₓ ≈ ${fmt(a.limit, 1)} m/s`]
    : a.slip > 0
      ? ["Ma sát không đủ: xe trượt lên phía ngoài khúc cua", "Ma sát không đủ: xe trượt ra ngoài!"]
      : a.slip < 0
        ? ["Ma sát không đủ: xe trượt xuống phía trong khúc cua", "Ma sát không đủ: xe trượt vào trong!"]
        : noFriction
          ? ["v = v₀: không cần ma sát, hợp lực của N và P là lực hướng tâm", "v = v₀: không cần ma sát"]
          : [`Xe bám đường; ma sát nghỉ hướng ${a.friction > 0 ? "xuống" : "lên"} dốc vì v ${a.friction > 0 ? ">" : "<"} v₀`, "Xe bám đường nhờ ma sát nghỉ"];
  const v0 = `v₀ = √(g·R·tanα) = ${fmt(a.ideal, 1)} m/s`;
  const top = header(ctx, view, a.holds, texts, [`Tốc độ lí tưởng (không cần ma sát): ${v0}`, v0]);

  const availH = view.h - top;
  const Ls = Math.min(view.w * 0.6, availH * 0.62); // length of the slope on screen
  const al = rad(s.bank);
  const cx = view.w * (small ? 0.5 : 0.45);
  const yBase = view.h - 0.3 * Ls - 8;
  const toe = { x: cx - (Ls * Math.cos(al)) / 2, y: yBase };
  const crest = { x: cx + (Ls * Math.cos(al)) / 2, y: yBase - Ls * Math.sin(al) };
  const size = small ? 11 : 14;

  // road cross-section; the centre of the curve is to the left
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, yBase);
  ctx.lineTo(view.w, yBase);
  ctx.stroke();
  ctx.fillStyle = ROAD;
  ctx.beginPath();
  ctx.moveTo(toe.x, toe.y);
  ctx.lineTo(crest.x, crest.y);
  ctx.lineTo(crest.x, yBase);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(toe.x, toe.y, small ? 22 : 34, -al, 0);
  ctx.stroke();
  label(ctx, `α = ${fmt(s.bank)}°`, toe.x + (small ? 26 : 40), toe.y + (small ? 9 : 12), { size: small ? 10 : 13, bold: true });
  label(ctx, small ? "← tâm khúc cua" : "← tâm khúc cua (nhìn từ phía sau xe)", 8, yBase + (small ? 22 : 30), { size: small ? 10 : 12, color: COLORS.muted });

  // car seen from behind; it slides along the slope when friction is not enough
  const u = { x: Math.cos(al), y: -Math.sin(al) }; // up the slope (outwards)
  const n = { x: -Math.sin(al), y: -Math.cos(al) }; // away from the road surface
  const off = a.slip * (s.dist / lapLength(s)) * Ls * 0.3;
  const base = { x: cx + u.x * off, y: yBase - (Ls * Math.sin(al)) / 2 + u.y * off };
  const cw = Ls * 0.24;
  const ch = Ls * 0.11;
  const wr = ch * 0.3;
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.rotate(-al);
  ctx.fillStyle = COLORS.ink;
  for (const side of [-1, 1]) ctx.fillRect(side * cw * 0.36 - wr * 0.6, -2 * wr, wr * 1.2, 2 * wr);
  ctx.fillStyle = a.slip ? COLORS.red : COLORS.blue;
  ctx.beginPath();
  ctx.roundRect(-cw / 2, -wr - ch, cw, ch, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-cw * 0.34, -wr - ch * 1.75, cw * 0.68, ch * 0.8, 4);
  ctx.fill();
  ctx.restore();
  const C = { x: base.x + n.x * (wr + ch / 2), y: base.y + n.y * (wr + ch / 2) };

  // forces, all on the same scale (the weight is one unit long)
  const unit = Ls * 0.26;
  const cap = v => clamp(v, -1.9, 1.9) * unit;
  const lw = small ? 2.5 : 3.5;
  arrow(ctx, C.x, C.y, C.x, C.y + unit, COLORS.red, lw);
  label(ctx, "P", C.x + 10, C.y + unit - 4, { size, bold: true, color: COLORS.red });
  const N = cap(a.normal / mg);
  arrow(ctx, C.x, C.y, C.x + n.x * N, C.y + n.y * N, COLORS.blue, lw);
  label(ctx, "N", C.x + n.x * N + 10, C.y + n.y * N, { size, bold: true, color: COLORS.blue });
  const f = cap(a.holds ? a.friction / mg : (a.slip * s.mu * a.normal) / mg);
  if (Math.abs(f) > 0.03 * unit) {
    arrow(ctx, base.x, base.y, base.x - u.x * f, base.y - u.y * f, COLORS.orange, lw);
    label(ctx, a.holds ? "Fmsn" : "Fms", base.x - u.x * f + (f > 0 ? -6 : 6), base.y - u.y * f + 12, { size, bold: true, color: COLORS.orange, align: f > 0 ? "right" : "left" });
  }
  if (a.holds) {
    const F = cap(a.accel / G);
    ctx.setLineDash([6, 4]);
    arrow(ctx, C.x, C.y, C.x - F, C.y, COLORS.purple, lw);
    ctx.setLineDash([]);
    label(ctx, small ? "Fht" : "Fht = m·v²/R", C.x - F - 6, C.y - 11, { size, bold: true, color: COLORS.purple, align: "right" });
  }

  if (!small) {
    const bs = Math.min(170, view.w * 0.24, availH * 0.4);
    drawTop(ctx, s, a, { x: view.w - bs - 8, y: top, w: bs, h: bs }, false, small);
    label(ctx, "Nhìn từ trên xuống", view.w - 8 - bs / 2, top + bs + 8, { size: 12, color: COLORS.muted, align: "center" });
    label(ctx, `m = ${fmt(CAR_MASS, 0)} kg · g = ${fmt(G, 1)} m/s²`, view.w - 10, view.h - 14, { size: 12, color: COLORS.muted, align: "right" });
  }
}

function drawBucket(ctx, s, a, view) {
  const small = isSmall(view);
  const vmin = `vₘᵢₙ = √(g·R) = ${fmt(a.limit)} m/s`;
  const top = header(
    ctx,
    view,
    a.holds,
    a.holds
      ? ["Nước không đổ: ở điểm cao nhất v ≥ √(g·R)", "Nước không đổ ra"]
      : ["Nước đổ ra: ở điểm cao nhất v < √(g·R), trọng lực lớn hơn lực hướng tâm cần có", "Nước đổ ra: ở điểm cao nhất v < √(g·R)", "Nước đổ ra ở điểm cao nhất!"],
    [`Tốc độ nhỏ nhất ở điểm cao nhất: ${vmin}`, vmin]
  );
  const foot = small ? 16 : 30;
  const availH = view.h - top - foot;
  const Rp = Math.min(view.w, availH) * (0.2 + 0.07 * s.rope);
  const k = Rp / s.rope; // px per metre
  const cx = view.w / 2;
  const cy = top + availH / 2 + (small ? 4 : 8);
  const size = small ? 11 : 14;
  const phi = s.phi;
  const pos = { x: cx + Rp * Math.sin(phi), y: cy - Rp * Math.cos(phi) };
  const bw = small ? 18 : 30;
  const bh = small ? 16 : 26;

  // path and arm
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, Rp, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, `R = ${fmt(s.rope, 1)} m`, cx + 8, cy + (small ? 10 : 14), { size: small ? 10 : 13, color: COLORS.muted });
  label(ctx, `điểm cao nhất: v = ${fmt(s.vTop, 1)} m/s`, cx, cy - Rp - bh - (small ? 8 : 12), { size: small ? 10 : 13, align: "center", color: COLORS.muted });

  // the water is lost at the top when v is too small (and the bucket is refilled at the bottom)
  const hasWater = a.holds || phi > Math.PI;
  if (!a.holds && phi < 1.5) {
    const tau = (phi * s.rope) / Math.max(s.vTop, 0.5); // roughly the time since the top
    ctx.fillStyle = COLORS.blue;
    for (let j = 0; j < 6; j++) {
      const t = tau * (0.45 + 0.11 * j);
      const y = cy - Rp + 0.5 * G * t * t * k;
      if (y > view.h - foot) continue;
      ctx.beginPath();
      ctx.arc(cx + s.vTop * t * k * 0.6 + (j % 2 ? 4 : -4), y, small ? 2.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // bucket: opening towards the centre, bottom outwards
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(phi);
  if (hasWater) {
    ctx.fillStyle = "#8fc1f5";
    ctx.beginPath();
    ctx.moveTo(-bw * 0.44, -bh * 0.35);
    ctx.lineTo(bw * 0.44, -bh * 0.35);
    ctx.lineTo(bw * 0.35, -bh);
    ctx.lineTo(-bw * 0.35, -bh);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-bw / 2, 0);
  ctx.lineTo(-bw * 0.35, -bh);
  ctx.lineTo(bw * 0.35, -bh);
  ctx.lineTo(bw / 2, 0);
  ctx.stroke();
  ctx.restore();

  // forces on the water (weight = one unit), and the velocity
  const W = { x: pos.x + Math.sin(phi) * bh * 0.65, y: pos.y - Math.cos(phi) * bh * 0.65 };
  const unit = small ? 24 : 42;
  const v = bucketSpeed(s.vTop, s.rope, phi);
  const Lv = clamp(v * (small ? 5 : 9), 12, small ? 50 : 90);
  arrow(ctx, W.x, W.y, W.x + Math.cos(phi) * Lv, W.y + Math.sin(phi) * Lv, COLORS.green, small ? 2 : 3);
  label(ctx, "v", W.x + Math.cos(phi) * (Lv + 9), W.y + Math.sin(phi) * (Lv + 9), { size, bold: true, color: COLORS.green, align: "center" });
  if (hasWater) {
    arrow(ctx, W.x, W.y, W.x, W.y + unit, COLORS.red, small ? 2.5 : 3.5);
    label(ctx, "P", W.x + 9, W.y + unit - 2, { size, bold: true, color: COLORS.red });
    const N = Math.min(bucketNormal(s.vTop, s.rope, phi) / (WATER_MASS * G), 2.4) * unit;
    if (N > 2) {
      arrow(ctx, W.x - 3, W.y, W.x - 3 - Math.sin(phi) * N, W.y + Math.cos(phi) * N, COLORS.blue, small ? 2.5 : 3.5);
      label(ctx, "N", W.x - 3 - Math.sin(phi) * N - 10, W.y + Math.cos(phi) * N, { size, bold: true, color: COLORS.blue, align: "right" });
    }
  }
  const ns = small ? 9.5 : 12;
  const note = fit(ctx, view, ns, false, [
    "Mô hình: tay quay là thanh cứng, nhẹ; tốc độ thay đổi theo định luật bảo toàn cơ năng. N: lực đáy xô ép lên nước.",
    "Mô hình: tay quay là thanh cứng, nhẹ. N: lực đáy xô ép lên nước.",
    "Mô hình: tay quay cứng, nhẹ; N là lực đáy xô ép lên nước",
  ]);
  label(ctx, note, view.w / 2, view.h - foot / 2, { size: ns, color: COLORS.muted, align: "center" });
}

const car = s => s.scene !== "bucket";
const tuned = c => ({ ...c, onChange: restart, onCommit: report });

mount({
  slug: "luc-huong-tam-thuc-te",
  version: "1.0.0",
  title: "Lực hướng tâm trong thực tế",
  hint: "Tăng dần tốc độ và quan sát lúc nào chuyển động tròn không còn giữ được.",
  initialState,
  step,
  autoplay: true,
  // one lap of the car in about 6 s on screen; the bucket at half speed so the eye can follow
  timeScale: s => (s.scene === "bucket" ? 0.5 : Math.max(0.2, lapLength(s) / (s.speed * 6))),
  controls: [
    {
      type: "select",
      key: "scene",
      label: "Tình huống",
      options: [
        { value: "flat", label: "Ô tô qua khúc cua trên đường nằm ngang" },
        { value: "banked", label: "Ô tô qua khúc cua trên mặt đường nghiêng" },
        { value: "bucket", label: "Xô nước quay trong mặt phẳng thẳng đứng" },
      ],
    },
    { type: "slider", key: "speed", label: "Tốc độ xe v", min: 5, max: 40, step: 0.1, format: v => `${fmt(v, 1)} m/s (${fmt(v * 3.6, 0)} km/h)`, visible: car },
    { type: "slider", key: "radius", label: "Bán kính khúc cua R", min: 20, max: 200, step: 5, unit: "m", digits: 0, visible: car },
    { type: "slider", key: "mu", label: "Hệ số ma sát nghỉ μ", min: 0, max: 1, step: 0.05, digits: 2, visible: car },
    { type: "slider", key: "bank", label: "Góc nghiêng mặt đường α", min: 5, max: 40, step: 1, format: v => `${fmt(v, 0)}°`, visible: s => s.scene === "banked" },
    { type: "slider", key: "vTop", label: "Tốc độ ở điểm cao nhất v", min: 1, max: 8, step: 0.1, unit: "m/s", digits: 1, visible: s => s.scene === "bucket" },
    { type: "slider", key: "rope", label: "Bán kính quỹ đạo R", min: 0.4, max: 2, step: 0.1, unit: "m", digits: 1, visible: s => s.scene === "bucket" },
  ].map(tuned),
  readouts: [
    { label: "Gia tốc hướng tâm aₕₜ = v²/R", value: s => `${fmt(analyse(s).accel)} m/s²` },
    { label: "Lực hướng tâm cần có m·v²/R", value: s => `${fmt(analyse(s).needed, s.scene === "bucket" ? 1 : 0)} N` },
    { label: "Tốc độ lí tưởng v₀", value: s => (s.scene === "banked" ? `${fmt(analyse(s).ideal, 1)} m/s` : "–") },
    { label: "Tốc độ nhỏ nhất ở đỉnh", value: s => (s.scene === "bucket" ? `${fmt(analyse(s).limit)} m/s` : "–") },
    {
      label: "Trạng thái",
      value: s => {
        const a = analyse(s);
        if (s.scene === "bucket") return a.holds ? "Nước không đổ" : "Nước đổ ra";
        return a.slip > 0 ? "Trượt ra ngoài" : a.slip < 0 ? "Trượt vào trong" : "Bám đường";
      },
    },
  ],
  draw(ctx, s, view) {
    const a = analyse(s);
    if (s.scene === "bucket") drawBucket(ctx, s, a, view);
    else if (s.scene === "banked") drawBanked(ctx, s, a, view);
    else drawFlat(ctx, s, a, view);
  },
});
