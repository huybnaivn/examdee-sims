import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import {
  SURFACES, ROUGHNESS, MEASURED_KEY, TRACK, initialState, step, normal, maxStatic, moving, frictionFor,
  startTime, endTime, pullAt, positionAt, phase, rankingRight, tidy,
} from "./model.js";

const KIND = { static: "ma sát nghỉ", sliding: "ma sát trượt", rolling: "ma sát lăn" };
const SUPPORT = { wide: "mặt rộng", narrow: "mặt hẹp", rollers: "con lăn" };
const BLOCK = { L: 10, wide: [3, 5], narrow: [5, 3] }; // cm: length, [height, depth] per face

const scaleRange = s => [1, 2, 5, 10, 20].find(r => r >= maxStatic(s) * 1.15) ?? 20;
const currentFriction = s => (phase(s) === "static" ? frictionFor(s, pullAt(s, s.time)) : { force: moving(s), kind: s.support === "rollers" ? "rolling" : "sliding" });

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const sceneH = Math.round(view.h * (small ? 0.46 : 0.48));
  const cm = Math.min(view.w / (small ? 40 : 46), sceneH / 13); // px per cm
  // x0 leaves room on the left for the friction arrow and its label; travel is the track length in px
  return { small, sceneH, cm, surfaceY: sceneH - (small ? 26 : 40), x0: 3.6 * cm, travel: view.w * (small ? 0.2 : 0.3) };
}

function drawSurface(ctx, s, g, view) {
  const y = g.surfaceY;
  const h = g.small ? 12 : 16;
  const colors = { kinh: "#cfe6f3", go: "#c99a63", tham: "#b8484e", giay: "#8d8478" };
  ctx.fillStyle = colors[s.surface];
  ctx.fillRect(0, y, view.w, h);
  ctx.save();
  if (s.surface === "go") {
    ctx.strokeStyle = "rgba(90, 55, 20, 0.35)";
    ctx.beginPath();
    for (let x = 0; x < view.w; x += 40) {
      ctx.moveTo(x, y + 4);
      ctx.bezierCurveTo(x + 10, y + 2, x + 20, y + 8, x + 38, y + 6);
    }
    ctx.stroke();
  } else if (s.surface === "kinh") {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    for (let x = 10; x < view.w; x += 70) {
      ctx.moveTo(x, y + h - 3);
      ctx.lineTo(x + 12, y + 3);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = s.surface === "tham" ? "rgba(255, 200, 200, 0.5)" : "rgba(40, 30, 20, 0.45)";
    for (let i = 0; i < view.w / 3; i++) {
      const x = (i * 37) % view.w;
      const yy = y + ((i * 13) % (h - 3));
      if (s.surface === "tham") ctx.fillRect(x, y - 2 + ((i * 7) % 3), 1.5, 5);
      else ctx.fillRect(x, yy, 2, 2);
    }
  }
  ctx.restore();
  label(ctx, SURFACES[s.surface].name, view.w - 8, y + h + (g.small ? 8 : 12), { size: g.small ? 11 : 13, align: "right", color: COLORS.muted });
}

function drawScene(ctx, s, view, g) {
  drawSurface(ctx, s, g, view);
  const c = g.cm;
  const [H, D] = s.support === "narrow" ? BLOCK.narrow : BLOCK.wide;
  const roll = s.support === "rollers";
  const travel = g.travel;
  const pos = positionAt(s, s.time);
  const bx = g.x0 + (pos / TRACK) * travel;
  const lift = roll ? 1.6 * c : 0;
  const by = g.surfaceY - lift; // bottom of the block
  const L = BLOCK.L * c;
  const dx = D * c * 0.45;
  const dy = D * c * 0.35;
  // a row of rollers laid along the track; each one rolls forward half as far as the block on top of it
  if (roll) {
    const r = 0.8 * c;
    const shift = ((pos / TRACK) * travel) / 2;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    for (let x = g.x0 + r; x <= g.x0 + travel / 2 + L; x += 3.2 * c) {
      ctx.fillStyle = "#9aa3b2";
      ctx.beginPath();
      ctx.arc(x + shift, g.surfaceY - r, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + shift, g.surfaceY - r);
      ctx.lineTo(x + shift + r * Math.cos(shift / r), g.surfaceY - r + r * Math.sin(shift / r));
      ctx.stroke();
    }
  }
  // block: front face, top face and right face in oblique view, so the contact face shows
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#6b4a26";
  ctx.fillStyle = "#e2b77c";
  ctx.beginPath();
  ctx.moveTo(bx, by - H * c);
  ctx.lineTo(bx + dx, by - H * c - dy);
  ctx.lineTo(bx + L + dx, by - H * c - dy);
  ctx.lineTo(bx + L, by - H * c);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#c99a5d";
  ctx.beginPath();
  ctx.moveTo(bx + L, by);
  ctx.lineTo(bx + L + dx, by - dy);
  ctx.lineTo(bx + L + dx, by - H * c - dy);
  ctx.lineTo(bx + L, by - H * c);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#d7a96b";
  ctx.fillRect(bx, by - H * c, L, H * c);
  ctx.strokeRect(bx, by - H * c, L, H * c);
  label(ctx, `${s.mass * 1000 >= 1000 ? fmt(s.mass, 1) + " kg" : fmt(s.mass * 1000, 0) + " g"}`, bx + L / 2, by - (H * c) / 2, { size: g.small ? 11 : 13, align: "center", bold: true, color: "#5a3a16" });

  // spring scale from the hook on the right face to the hand
  const F = pullAt(s, s.time);
  const range = scaleRange(s);
  const hy = by - (H * c) / 2;
  const hookX = bx + L + dx / 2;
  const bodyX = hookX + 2.2 * c;
  const bodyL = Math.min(11 * c, view.w - bodyX - 4 * c);
  const ext = (F / range) * bodyL * 0.55; // spring stretch, pointer position
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hookX, hy);
  ctx.lineTo(bodyX, hy);
  ctx.stroke();
  const bh = 1.8 * c;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(bodyX, hy - bh / 2, bodyL, bh, bh / 2);
  ctx.fill();
  ctx.stroke();
  // graduations 0..range from the right end leftwards (the hook side moves away as the spring stretches)
  const zeroX = bodyX + bodyL * 0.85;
  const ticks = range <= 2 ? range * 10 : range;
  for (let i = 0; i <= ticks; i++) {
    const tx = zeroX - (i / ticks) * bodyL * 0.55;
    const major = range <= 2 ? i % 5 === 0 : true;
    ctx.beginPath();
    ctx.moveTo(tx, hy - bh / 2 + 2);
    ctx.lineTo(tx, hy - bh / 2 + (major ? bh * 0.38 : bh * 0.22));
    ctx.stroke();
  }
  label(ctx, "0", zeroX, hy + bh * 0.2, { size: 9, align: "center", color: COLORS.muted });
  label(ctx, `${range}`, zeroX - bodyL * 0.55, hy + bh * 0.2, { size: 9, align: "center", color: COLORS.muted });
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(zeroX - ext - 1.5, hy - bh / 2 + 1, 3, bh - 2);
  label(ctx, `Fk = ${fmt(F, F < 1 ? 3 : 2)} N`, bodyX + bodyL / 2, hy - bh / 2 - (g.small ? 9 : 11), { size: g.small ? 12 : 14, bold: true, align: "center", color: COLORS.blue });
  // hand
  ctx.fillStyle = "#f1c9a5";
  ctx.strokeStyle = COLORS.ink;
  ctx.beginPath();
  ctx.roundRect(bodyX + bodyL + 2, hy - 1.1 * c, 2.4 * c, 2.2 * c, c * 0.8);
  ctx.fill();
  ctx.stroke();

  const fr = currentFriction(s);
  // forces on the block, drawn to the scale of the spring balance: pull Fk under the balance, friction at the contact face
  const unit = (6 * c) / range;
  if (F > 1e-4) arrow(ctx, hookX, hy + bh / 2 + 7, hookX + Math.max(6, F * unit), hy + bh / 2 + 7, COLORS.blue, 2.5);
  if (fr.force > 1e-4) {
    const tip = bx + L * 0.6 - Math.max(6, fr.force * unit);
    arrow(ctx, bx + L * 0.6, by - 3, tip, by - 3, COLORS.orange, 2.5);
    label(ctx, "Fms", Math.min(tip, bx) - 4, by - 10, { size: g.small ? 11 : 12, bold: true, align: "right", color: COLORS.orange });
  }
  const status = phase(s) === "static"
    ? s.time > 0 ? `Khối gỗ đứng yên: lực ma sát nghỉ = lực kéo = ${fmt(F, 2)} N` : "Bấm ▶ Chạy để kéo khối gỗ"
    : `Khối gỗ ${roll ? "lăn" : "trượt"}${phase(s) === "done" ? " xong" : " đều"}: ${KIND[fr.kind]} = ${fmt(fr.force, roll ? 3 : 2)} N`;
  label(ctx, status, 10, g.small ? 13 : 20, { size: g.small ? 12 : 15, bold: true });
  label(ctx, `N = P = 10·m = ${fmt(normal(s), 2)} N · đặt ${SUPPORT[s.support]}`, 10, g.small ? 29 : 42, { size: g.small ? 11 : 13, color: COLORS.muted });
}

function drawGraph(ctx, s, view, g) {
  const left = g.small ? 34 : 50;
  const right = view.w - (g.small ? 10 : 24);
  const top = g.sceneH + (g.small ? 22 : 34);
  const bottom = view.h - (g.small ? 22 : 34);
  if (bottom - top < 30) return;
  const tEnd = endTime(s);
  const yMax = scaleRange(s);
  const X = t => left + ((right - left) * t) / tEnd;
  const Y = f => bottom - ((bottom - top) * f) / yMax;
  label(ctx, "Số chỉ lực kế F (N) theo thời gian t (s)", left, top - (g.small ? 12 : 16), { size: g.small ? 11 : 13, bold: true });
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const f = (yMax * i) / 4;
    ctx.beginPath();
    ctx.moveTo(left, Y(f));
    ctx.lineTo(right, Y(f));
    ctx.stroke();
    label(ctx, fmt(f, 2), left - 4, Y(f), { size: 10, align: "right", color: COLORS.muted });
  }
  for (let t = 0; t <= tEnd + 1e-9; t += 1) label(ctx, fmt(t, 0), X(t), bottom + 9, { size: 10, align: "center", color: COLORS.muted });
  ctx.strokeStyle = COLORS.ink;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();
  if (s.time <= 0) return;
  const t0 = startTime(s);
  if (s.time > t0) {
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    for (const [f, color, text] of [[maxStatic(s), COLORS.red, `Fms nghỉ cực đại ${fmt(maxStatic(s), 3)} N`], [moving(s), COLORS.orange, `${s.support === "rollers" ? "Fms lăn" : "Fms trượt"} ${fmt(moving(s), 3)} N`]]) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(left, Y(f));
      ctx.lineTo(right, Y(f));
      ctx.stroke();
      if (s.support !== "rollers" || color === COLORS.orange) label(ctx, text, right - 2, Y(f) + (color === COLORS.red || s.support === "rollers" ? -8 : 9), { size: g.small ? 10 : 12, align: "right", color });
    }
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const n = 240;
  const pts = [...Array(n + 1).keys()].map(i => (s.time * i) / n);
  if (t0 < s.time) pts.push(t0);
  pts.sort((a, b) => a - b).forEach((t, i) => (i ? ctx.lineTo(X(t), Y(pullAt(s, t))) : ctx.moveTo(X(t), Y(pullAt(s, t)))));
  ctx.stroke();
}

const restart = s => {
  s.time = 0;
};

const rankOptions = [{ value: "", label: "— chọn —" }, ...ROUGHNESS.map(k => ({ value: k, label: SURFACES[k].name }))];
const clearVerdict = s => (s.verdict = "");

mount({
  slug: "luc-ma-sat",
  version: "1.0.0",
  title: "Lực ma sát",
  hint: "Bấm ▶ Chạy: tay kéo lực kế mạnh dần cho đến khi khối gỗ chuyển động, rồi kéo cho khối gỗ chuyển động đều. Đổi mặt tiếp xúc, cách đặt và khối lượng để so sánh.",
  initialState,
  step(s, dt, api) {
    if (phase(s) === "done") {
      if (s._ended) return; // finished in this very batch of steps: stay there until it has been drawn
      s.time = 0; // ▶ Chạy on a finished run pulls again from rest
    }
    const before = phase(s);
    step(s, dt);
    const now = phase(s);
    if (before === "static" && now !== "static") {
      if (s.support !== "rollers") s[MEASURED_KEY[s.surface]] = moving(s);
      api.emit("start-moving", { maxStatic: maxStatic(s), moving: moving(s), mass: s.mass, normal: normal(s), rollers: s.support === "rollers" ? 1 : 0 }, "result");
    }
    if (now === "done") {
      s._ended = true;
      api.pause();
    }
  },
  sanitize(incoming, base) {
    const out = {};
    for (const key of Object.keys(base)) {
      const v = incoming[key];
      if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) out[key] = v;
    }
    return tidy({ ...base, ...out });
  },
  controls: [
    { type: "select", key: "surface", label: "Mặt tiếp xúc", options: ROUGHNESS.map(k => ({ value: k, label: SURFACES[k].name })), onChange: restart },
    {
      type: "select",
      key: "support",
      label: "Cách đặt khối gỗ",
      options: [
        { value: "wide", label: "Mặt rộng tiếp xúc" },
        { value: "narrow", label: "Mặt hẹp tiếp xúc" },
        { value: "rollers", label: "Đặt trên các con lăn" },
      ],
      onChange: restart,
    },
    { type: "slider", key: "mass", label: "Khối lượng khối gỗ", min: 0.1, max: 1, step: 0.1, onChange: restart, format: v => `${fmt(v * 1000, 0)} g` },
    { type: "button", label: "Kéo lại từ đầu", action: (s, api) => (restart(s), api.play()), event: "pull-again" },
    { type: "heading", label: "XẾP CÁC MẶT THEO LỰC MA SÁT TRƯỢT, TỪ NHỎ ĐẾN LỚN" },
    { type: "select", key: "rank1", label: "1. Nhỏ nhất", options: rankOptions, onChange: clearVerdict },
    { type: "select", key: "rank2", label: "2.", options: rankOptions, onChange: clearVerdict },
    { type: "select", key: "rank3", label: "3.", options: rankOptions, onChange: clearVerdict },
    { type: "select", key: "rank4", label: "4. Lớn nhất", options: rankOptions, onChange: clearVerdict },
    {
      type: "button",
      label: "Kiểm tra xếp hạng",
      action(s, api) {
        const right = rankingRight(s);
        s.verdict = right ? "right" : "wrong";
        const measured = Object.values(MEASURED_KEY).filter(k => s[k] > 0).length;
        api.emit("rank-check", { correct: right ? 1 : 0, measured });
        if (right) api.emit("surfaces-ranked", { measured }, "goal");
      },
    },
  ],
  readouts: [
    { label: "Số chỉ lực kế (lực kéo)", value: s => `${fmt(pullAt(s, s.time), 3)} N` },
    { label: "Lực ma sát", value: s => (s.time > 0 ? `${KIND[currentFriction(s).kind]}, ${fmt(currentFriction(s).force, 3)} N` : "–") },
    { label: "Áp lực lên mặt tiếp xúc", value: s => `${fmt(normal(s), 2)} N` },
    { label: "Đã đo ma sát trượt", value: s => ROUGHNESS.filter(k => s[MEASURED_KEY[k]] > 0).map(k => `${SURFACES[k].name.replace("Mặt ", "")} ${fmt(s[MEASURED_KEY[k]], 2)} N`).join("; ") || "chưa có" },
    { label: "Xếp hạng", value: s => (s.verdict === "right" ? "Đúng" : s.verdict === "wrong" ? "Chưa đúng, thử đo thêm" : "–") },
  ],
  draw(ctx, s, view) {
    s._ended = false;
    const g = geom(view);
    drawScene(ctx, s, view, g);
    drawGraph(ctx, s, view, g);
  },
});
