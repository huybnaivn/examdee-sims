import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  SHAPES, PINS, SIZE, TOLERANCE, centroid, inside, pinOf, lean, toWorld, toPlate, isSettled, plumbLine, stepHang, lineCount, markError,
  criticalAngle, isStable, hasToppled, stepTopple, RIM, surfaceY, equilibriumType, stepBall, initialState, tidy, newShape,
} from "./model.js";

const DEG = 180 / Math.PI;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const isSmall = view => view.w < 560 || view.h < 430;
const plate = s => SHAPES[s.shape] ?? SHAPES.rect;
// cm, the farthest any plate reaches from any of its holes: the swing must fit whatever is hung
const REACH = Math.max(...Object.values(SHAPES).flatMap(({ pts, pins }) => pins.flatMap(p => pts.map(q => Math.hypot(q[0] - p[0], q[1] - p[1])))));

/** Draw text wrapped to maxW; returns the y of the line after the last one. */
function paragraph(ctx, text, x, y, maxW, { size = 13, color = COLORS.ink, bold = false } = {}) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  let line = "";
  for (const word of text.split(" ")) {
    if (line && ctx.measureText(`${line} ${word}`).width > maxW) {
      label(ctx, line, x, y, { size, color, bold });
      y += size + 4;
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  label(ctx, line, x, y, { size, color, bold });
  return y + size + 4;
}

const dot = (ctx, x, y, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

// ---------- hanging plate ----------

function hangView(view) {
  const small = isSmall(view);
  const py = small ? 26 : 46; // the pin
  const scale = Math.min((view.h - py - (small ? 44 : 70)) / REACH, (view.w / 2 - 8) / REACH);
  const px = view.w / 2;
  return { small, px, py, scale, P: (s, q) => [px + toWorld(s, q)[0] * scale, py - toWorld(s, q)[1] * scale] };
}

const pointerOnPlate = (p, s, v) => toPlate(s, [(p.x - v.px) / v.scale, (v.py - p.y) / v.scale]);

// One goal per plate, the first time the mark is close enough.
function checkMark(s, api) {
  if (s.found || !s.guessed || markError(s) > TOLERANCE) return;
  s.found = true;
  api.emit("centre-found", { error: markError(s), lines: lineCount(s) }, "goal");
}

function drawHang(ctx, s, view) {
  const v = hangView(view);
  const { small, px, py, scale } = v;
  const { pts, pins } = plate(s);
  const current = pins.indexOf(pinOf(s));
  const G = centroid(pts);
  const settled = isSettled(s);
  const marked = s.guessed && markError(s) <= TOLERANCE;

  // support
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(px - (small ? 50 : 80), py - (small ? 16 : 22), small ? 100 : 160, small ? 6 : 8);
  ctx.fillRect(px - 2, py - (small ? 12 : 16), 4, small ? 12 : 16);

  // the plate
  const outline = () => {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(...v.P(s, q)) : ctx.moveTo(...v.P(s, q))));
    ctx.closePath();
  };
  outline();
  ctx.fillStyle = "#dbe7ff";
  ctx.fill();
  // plumb lines already drawn on it
  ctx.save();
  outline();
  ctx.clip();
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = small ? 3 : 4; // wider than the string, which lies on the newest of them
  for (let i = 0; i < PINS; i++) {
    if (!(s.traced & (1 << i))) continue;
    const l = plumbLine(s.shape in SHAPES ? s.shape : "rect", i + 1);
    ctx.beginPath();
    ctx.moveTo(...v.P(s, [l.x, l.y]));
    ctx.lineTo(...v.P(s, [l.x + l.dx * 2 * REACH, l.y + l.dy * 2 * REACH]));
    ctx.stroke();
  }
  ctx.restore();
  outline();
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  // holes, numbered on the side towards the middle of the plate
  const hole = Math.max(3, 0.32 * scale);
  pins.forEach((q, i) => {
    const [x, y] = v.P(s, q);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, hole, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const [gx, gy] = v.P(s, G);
    const d = Math.hypot(gx - x, gy - y) || 1;
    label(ctx, String(i + 1), x + ((gx - x) / d) * (hole + 8), y + ((gy - y) / d) * (hole + 8), { size: small ? 10 : 12, align: "center", color: i === current ? COLORS.ink : COLORS.muted, bold: i === current });
  });

  // plumb line from the pin
  const bobY = Math.min(view.h - (small ? 34 : 54), py + (REACH + 1) * scale);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, bobY - 8);
  ctx.stroke();
  ctx.fillStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(px - 5, bobY - 10);
  ctx.lineTo(px + 5, bobY - 10);
  ctx.lineTo(px, bobY);
  ctx.closePath();
  ctx.fill();
  if (!small) label(ctx, "dây dọi", px + 9, bobY - 6, { size: 12, color: COLORS.muted });
  dot(ctx, px, py, small ? 4 : 5, COLORS.ink);

  if (s.showCentre || marked) {
    const [x, y] = v.P(s, G);
    dot(ctx, x, y, small ? 4 : 5, COLORS.red);
    label(ctx, "G", x + 8, y - 9, { size: small ? 12 : 14, bold: true, color: COLORS.red });
  }
  if (s.guessed) {
    const [x, y] = v.P(s, [s.guessX, s.guessY]);
    const a = small ? 5 : 7;
    ctx.strokeStyle = marked ? COLORS.green : COLORS.purple;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - a, y - a);
    ctx.lineTo(x + a, y + a);
    ctx.moveTo(x + a, y - a);
    ctx.lineTo(x - a, y + a);
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  label(ctx, `Treo ở lỗ ${current + 1}`, 8, small ? 10 : 16, { size: small ? 12 : 15, bold: true });
  const n = lineCount(s);
  const text = marked
    ? `Đúng rồi! Dấu × trùng với trọng tâm G (lệch ${fmt(markError(s), 1)} cm).`
    : !settled
      ? "Tấm phẳng dao động quanh chốt rồi dừng lại khi trọng tâm nằm ngay dưới chốt treo."
      : `Khi cân bằng, trọng tâm nằm trên đường dây dọi qua chốt (vết màu cam, đã vẽ ${n}). ` +
        (n < 2 ? "Treo ở một lỗ khác để vẽ thêm một vết." : "Trọng tâm là giao điểm của các vết.") +
        (s.guessed ? " Dấu × chưa trùng với trọng tâm." : "");
  paragraph(ctx, text, 8, view.h - (small ? 25 : 38), view.w - 16, { size: small ? 10 : 13, color: marked ? COLORS.green : COLORS.muted, bold: marked });
}

// ---------- block on a ramp ----------

const RAMP = 52; // cm, length of the ramp
const CORNER = 32; // cm from the foot of the ramp to the lower edge of the block

function drawTopple(ctx, s, view) {
  const small = isSmall(view);
  const top = small ? 56 : 92;
  const bottom = small ? 20 : 30;
  const scale = Math.min((view.w - 20) / 58, (view.h - top - bottom) / 54);
  const ox = (view.w - 56 * scale) / 2 + 2 * scale;
  const oy = view.h - bottom;
  const P = ([x, y]) => [ox + x * scale, oy - y * scale];
  const slope = s.slope / DEG;
  const turn = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];
  const e = [Math.cos(slope), Math.sin(slope)]; // up the ramp
  const along = turn(e, s.tilt); // the block's base direction
  const up = turn(along, Math.PI / 2);
  const C = add([0, 0], e, CORNER); // lower edge, the pivot
  const corners = [C, add(C, along, s.base), add(add(C, along, s.base), up, s.height), add(C, up, s.height)];
  const G = add(add(C, along, s.base / 2), up, s.height / 2);
  const lying = hasToppled(s);
  const standing = s.tilt === 0;
  const stable = isStable(s.base, s.height, slope);
  const tip = add([0, 0], e, RAMP);

  // ground and ramp
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, oy);
  ctx.lineTo(view.w - 4, oy);
  ctx.stroke();
  ctx.fillStyle = "#e6ebf5";
  ctx.beginPath();
  ctx.moveTo(...P([0, 0]));
  ctx.lineTo(...P(tip));
  ctx.lineTo(...P([tip[0], 0]));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.beginPath();
  ctx.moveTo(...P([0, 0]));
  ctx.lineTo(...P(tip));
  ctx.stroke();
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(...P([0, 0]), small ? 30 : 46, -slope, 0);
  ctx.stroke();
  label(ctx, `θ = ${fmt(s.slope, 1)}°`, 8, view.h - bottom / 2, { size: small ? 11 : 14, bold: true, color: COLORS.orange });

  // block
  ctx.fillStyle = "#ffe2c2";
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  corners.forEach((q, i) => (i ? ctx.lineTo(...P(q)) : ctx.moveTo(...P(q))));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // what it rests on: its base, the side it fell onto, or just the lower edge while turning
  const support = standing ? [corners[0], corners[1]] : lying ? [corners[0], corners[3]] : [C, C];
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(...P(support[0]));
  ctx.lineTo(...P(support[1]));
  ctx.stroke();
  ctx.lineCap = "butt";
  if (standing) {
    const size = small ? 10 : 13;
    // beside the lower edge, clear of the ramp, the vertical through G and the notes under the ground
    const [bx, by] = P(C);
    label(ctx, "b", bx - Math.cos(slope) * 9 - Math.sin(slope) * 8, by + Math.sin(slope) * 9 - Math.cos(slope) * 8, { size, bold: true, color: COLORS.green, align: "center" });
    const [hx, hy] = P(add(add(C, along, s.base), up, s.height / 2));
    label(ctx, "H", hx + Math.cos(slope) * 10, hy - Math.sin(slope) * 10, { size, bold: true, color: COLORS.orange, align: "center" });
  }

  // line of action of the weight: the vertical through G, down to the ramp (or the ground)
  const foot = [G[0], G[0] >= 0 && G[0] <= tip[0] ? G[0] * Math.tan(slope) : 0];
  const reach = G[0] / Math.cos(slope); // where the vertical meets the ramp, measured along it
  const lo = Math.min(support[0][0], support[1][0]) / Math.cos(slope);
  const hi = Math.max(support[0][0], support[1][0]) / Math.cos(slope);
  const held = reach >= lo - 1e-6 && reach <= hi + 1e-6;
  const [gx, gy] = P(G);
  const [fx, fy] = P(foot);
  ctx.strokeStyle = held ? COLORS.green : COLORS.red;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  ctx.setLineDash([]);
  dot(ctx, fx, fy, small ? 4 : 5, held ? COLORS.green : COLORS.red);
  arrow(ctx, gx, gy, gx, gy + Math.min(small ? 30 : 46, Math.max(14, fy - gy - 8)), COLORS.red, 2.5);
  label(ctx, "P", gx + 7, gy + (small ? 20 : 28), { size: small ? 11 : 14, bold: true, color: COLORS.red });
  dot(ctx, gx, gy, small ? 3.5 : 4.5, COLORS.ink);
  label(ctx, "G", gx - 8, gy - 8, { size: small ? 11 : 14, bold: true, align: "right" });

  // captions
  const size = small ? 10 : 13;
  let y = small ? 10 : 16;
  const head = lying ? "Khối đã đổ" : standing && stable ? "Khối đứng vững" : "Khối đang đổ";
  label(ctx, head, 8, y, { size: small ? 12 : 15, bold: true, color: standing && stable ? COLORS.green : COLORS.red });
  y += small ? 15 : 22;
  const why = lying
    ? "Nằm xuống, mặt chân đế rộng hơn và trọng tâm thấp hơn nên khối vững hơn. Bấm “Dựng lại khối” để thử lại."
    : standing && stable
      ? "Giá của trọng lực (đường thẳng đứng qua trọng tâm G) còn đi qua mặt chân đế."
      : "Giá của trọng lực rơi ra ngoài mặt chân đế nên khối lật quanh cạnh dưới.";
  y = paragraph(ctx, why, 8, y, view.w - 16, { size, color: COLORS.muted });
  const crit = fmt(criticalAngle(s.base, s.height) * DEG, 1);
  paragraph(ctx, `Góc giới hạn: tan θ₀ = (b/2)/h = b/H nên θ₀ = ${crit}° (h = H/2 là độ cao của trọng tâm so với đáy).`, 8, y, view.w - 16, { size, color: COLORS.ink });
  label(ctx, "Ma sát đủ lớn nên khối không trượt.", view.w - 8, view.h - bottom / 2, { size, align: "right", color: COLORS.muted });
}

// ---------- ball on a curved surface ----------

const BALL = 0.07; // m, radius of the ball
const KIND = {
  stable: ["Cân bằng bền", COLORS.green, "Mặt lõm: lệch khỏi vị trí cân bằng thì trọng tâm của bi lên cao hơn, trọng lực kéo bi trở về."],
  unstable: ["Cân bằng không bền", COLORS.red, "Mặt lồi: lệch khỏi vị trí cân bằng thì trọng tâm của bi hạ thấp, bi lăn ra xa và không tự trở về."],
  neutral: ["Cân bằng phiếm định", COLORS.orange, "Mặt phẳng ngang: lệch đi thì độ cao trọng tâm không đổi, bi nằm yên ở vị trí mới."],
};

function ballView(s, view) {
  const small = isSmall(view);
  const top = small ? 62 : 96;
  const scale = Math.min((view.w - 20) / (2 * RIM + 0.3), (view.h - top - (small ? 14 : 24)) / 1.8);
  const cx = view.w / 2;
  const y0 = top + (view.h - top) / 2 + (small ? 4 : 8); // screen y of the level y = 0
  const slope = s.curvature * s.ballX;
  const k = Math.hypot(slope, 1);
  return {
    small,
    scale,
    cx,
    X: x => cx + x * scale,
    Y: y => y0 - y * scale,
    // centre of the ball: one radius off the track along its normal
    bx: cx + (s.ballX - (slope / k) * BALL) * scale,
    by: y0 - (surfaceY(s.curvature, s.ballX) + BALL / k) * scale,
  };
}

function drawBalance(ctx, s, view) {
  const v = ballView(s, view);
  const { small, X, Y } = v;
  const [name, color, why] = KIND[equilibriumType(s.curvature)];
  const floor = Math.min(view.h - 4, Y(-0.9));

  // the track, filled underneath
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const x = -RIM + (2 * RIM * i) / 80;
    ctx.lineTo(X(x), Y(surfaceY(s.curvature, x)));
  }
  ctx.lineTo(X(RIM), floor);
  ctx.lineTo(X(-RIM), floor);
  ctx.closePath();
  ctx.fillStyle = "#e6ebf5";
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const x = -RIM + (2 * RIM * i) / 80;
    ctx.lineTo(X(x), Y(surfaceY(s.curvature, x)));
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // equilibrium position
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0) - 2.6 * BALL * v.scale);
  ctx.lineTo(X(0), Y(0) + (small ? 26 : 40));
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, "vị trí cân bằng", X(0), Math.min(floor - 8, Y(0) + (small ? 34 : 50)), { size: small ? 10 : 12, align: "center", color: COLORS.muted });

  // ball, its weight, and how far its centre has risen or dropped
  const r = BALL * v.scale;
  dot(ctx, v.bx, v.by, r, COLORS.blue);
  arrow(ctx, v.bx, v.by, v.bx, v.by + (small ? 30 : 44), COLORS.red, 2.5);
  label(ctx, "P", v.bx + 7, v.by + (small ? 24 : 34), { size: small ? 11 : 14, bold: true, color: COLORS.red });
  const rise = surfaceY(s.curvature, s.ballX);
  if (Math.abs(s.ballX) > 0.02) {
    const text = Math.abs(rise) < 0.005 ? "độ cao không đổi" : `${rise > 0 ? "cao hơn" : "thấp hơn"} ${fmt(Math.abs(rise) * 100, 0)} cm`;
    label(ctx, text, clamp(v.bx, 50, view.w - 50), v.by - r - 10, { size: small ? 10 : 12, color, align: "center", bold: true });
  }

  let y = small ? 10 : 16;
  label(ctx, name, 8, y, { size: small ? 12 : 15, bold: true, color });
  y += small ? 15 : 22;
  y = paragraph(ctx, why, 8, y, view.w - 16, { size: small ? 10 : 13, color: COLORS.muted });
  paragraph(ctx, "Kéo viên bi lệch khỏi vị trí cân bằng rồi thả.", 8, y, view.w - 16, { size: small ? 10 : 13 });
}

// ---------- the sim ----------

const hang = s => s.mode === "hang";
const topple = s => s.mode === "topple";
const balance = s => s.mode === "balance";
const stand = s => {
  s.tilt = 0;
  s.tiltSpeed = 0;
};
const marked = s => {
  s.guessed = true;
};

mount({
  slug: "trong-tam-can-bang",
  version: "1.0.0",
  title: "Trọng tâm và các dạng cân bằng",
  hint: "Treo tấm phẳng ở hai lỗ khác nhau để tìm trọng tâm bằng dây dọi; nghiêng dần mặt dốc cho đến khi khối hộp đổ; thả viên bi trên mặt lõm, mặt lồi và mặt phẳng.",
  initialState,
  autoplay: true,
  step(s, dt, api) {
    tidy(s);
    if (hang(s)) {
      if (s._grab == null && stepHang(s, dt)) {
        api.emit("settled", { pin: s.pin, angle: s.angle * DEG, lines: lineCount(s) }, "result");
      }
    } else if (topple(s)) {
      if (stepTopple(s, dt)) {
        api.emit("toppled", { angle: s.slope, criticalAngle: criticalAngle(s.base, s.height) * DEG, base: s.base, height: s.height }, "result");
      }
    } else if (!s._hold) stepBall(s, dt);
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Thí nghiệm",
      options: [
        { value: "hang", label: "Tìm trọng tâm bằng dây dọi" },
        { value: "topple", label: "Khối hộp trên mặt nghiêng" },
        { value: "balance", label: "Các dạng cân bằng" },
      ],
    },
    {
      type: "select",
      key: "shape",
      label: "Tấm phẳng",
      visible: hang,
      onChange: newShape,
      options: [
        { value: "L", label: "Hình chữ L" },
        { value: "rect", label: "Hình chữ nhật" },
        { value: "triangle", label: "Hình tam giác" },
        { value: "polygon", label: "Đa giác bất kì" },
      ],
    },
    { type: "stepper", key: "pin", label: "Treo ở lỗ số", min: 1, max: PINS, visible: hang },
    {
      type: "button",
      label: "Xóa các vết dây dọi",
      visible: hang,
      event: "clear-lines",
      action(s) {
        s.traced = isSettled(s) ? 1 << (s.pin - 1) : 0; // the plate still hangs on its present line
      },
    },
    { type: "checkbox", key: "marking", label: "Đánh dấu × chỗ em cho là trọng tâm (bấm lên tấm phẳng)", visible: hang },
    { type: "slider", key: "guessX", label: "Dấu ×: ngang", min: 0, max: SIZE, step: 0.2, unit: "cm", digits: 1, visible: s => hang(s) && s.marking, onChange: marked, onCommit: checkMark },
    { type: "slider", key: "guessY", label: "Dấu ×: dọc", min: 0, max: SIZE, step: 0.2, unit: "cm", digits: 1, visible: s => hang(s) && s.marking, onChange: marked, onCommit: checkMark },
    { type: "checkbox", key: "showCentre", label: "Hiện trọng tâm G", visible: hang },
    { type: "slider", key: "slope", label: "Góc nghiêng θ", min: 0, max: 45, step: 0.5, visible: topple, format: v => `${fmt(v, 1)}°` },
    { type: "slider", key: "base", label: "Bề rộng đáy b", min: 2, max: 10, step: 0.5, unit: "cm", digits: 1, visible: topple, onChange: stand },
    { type: "slider", key: "height", label: "Chiều cao H", min: 10, max: 30, step: 1, unit: "cm", digits: 0, visible: topple, onChange: stand },
    { type: "button", label: "Dựng lại khối", visible: topple, event: "block-reset", action: stand },
    {
      type: "slider",
      key: "curvature",
      label: "Độ cong của mặt đỡ",
      min: -1.5,
      max: 1.5,
      step: 0.25,
      visible: balance,
      format: v => `${fmt(v)} m⁻¹ (${v > 0 ? "lõm" : v < 0 ? "lồi" : "phẳng"})`,
    },
    {
      type: "slider",
      key: "ballX",
      label: "Vị trí viên bi x",
      min: -RIM,
      max: RIM,
      step: 0.05,
      unit: "m",
      visible: balance,
      onChange(s) {
        s.ballV = 0;
      },
    },
  ],
  readouts: [
    {
      label: "Trạng thái",
      value: s =>
        hang(s)
          ? isSettled(s)
            ? "Tấm phẳng cân bằng"
            : "Tấm phẳng đang dao động"
          : topple(s)
            ? hasToppled(s)
              ? "Khối đã đổ"
              : s.tilt === 0 && isStable(s.base, s.height, s.slope / DEG)
                ? "Khối đứng vững"
                : "Khối đang đổ"
            : KIND[equilibriumType(s.curvature)][0],
    },
    {
      label: "Số đo",
      value: s =>
        hang(s)
          ? `G lệch ${fmt(Math.abs(lean(s)) * DEG, 1)}° so với dây dọi`
          : topple(s)
            ? `θ = ${fmt(s.slope, 1)}°; θ₀ = ${fmt(criticalAngle(s.base, s.height) * DEG, 1)}°`
            : `x = ${fmt(s.ballX)} m; v = ${fmt(s.ballV)} m/s`,
    },
  ],
  pointer: {
    down(p, s, api, view) {
      if (hang(s)) {
        const v = hangView(view);
        const q = pointerOnPlate(p, s, v);
        if (!inside(plate(s).pts, q)) return false;
        if (s.marking) return this.move(p, s, api, view);
        if (Math.hypot(p.x - v.px, p.y - v.py) < 10) return false; // too close to the pin to turn the plate
        s._grab = Math.atan2(v.py - p.y, p.x - v.px) - s.angle;
        s.omega = 0;
      } else if (balance(s)) {
        const v = ballView(s, view);
        if (Math.hypot(p.x - v.bx, p.y - v.by) > BALL * v.scale + 18) return false;
        s._hold = true;
        s.ballV = 0;
      } else return false;
    },
    move(p, s, api, view) {
      if (hang(s) && s.marking) {
        const [x, y] = pointerOnPlate(p, s, hangView(view));
        s.guessX = clamp(Math.round(x * 10) / 10, 0, SIZE);
        s.guessY = clamp(Math.round(y * 10) / 10, 0, SIZE);
        s.guessed = true;
      } else if (hang(s)) {
        const v = hangView(view);
        s.angle = Math.atan2(v.py - p.y, p.x - v.px) - s._grab;
        s.omega = 0;
      } else {
        const v = ballView(s, view);
        s.ballX = clamp((p.x - v.cx) / v.scale, -RIM, RIM);
        s.ballV = 0;
      }
    },
    up(p, s, api) {
      if (hang(s) && s.marking) {
        api.emit("mark", { x: s.guessX, y: s.guessY }, "action");
        checkMark(s, api);
      } else if (hang(s)) {
        delete s._grab;
        api.emit("release", { pin: s.pin, angle: lean(s) * DEG }, "action");
      } else {
        delete s._hold;
        api.emit("ball-release", { x: s.ballX, curvature: s.curvature }, "action");
      }
    },
  },
  draw(ctx, s, view) {
    if (hang(s)) drawHang(ctx, s, view);
    else if (topple(s)) drawTopple(ctx, s, view);
    else drawBalance(ctx, s, view);
  },
});
