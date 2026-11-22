import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import {
  MATERIALS, ORDER, OBJECTS, CLOTHS, PAPER, initialState, signAfterRub, rub, interaction, strength,
  paperLifted, leafAngle, touchElectroscope, tidy,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ANIM = 0.9; // s, electron transfer animation

const chargeWord = q => (q > 0 ? "nhiễm điện dương" : q < 0 ? "nhiễm điện âm" : "chưa nhiễm điện");
const chargeText = q => (q ? `${q > 0 ? "+" : "−"}${Math.abs(q)}` : "0");
const objKey = w => (w === 2 ? "q2" : "q1");
const objMat = (s, w) => (w === 2 ? s.m2 : s.m1);

// Half width and half height of each material's drawing, in units of u.
const SIZE = {
  ruler: [1.3, 0.21],
  glass: [1.3, 0.13],
  balloon: [0.62, 0.78],
  wool: [0.8, 0.55],
  silk: [0.8, 0.55],
  hair: [0.6, 0.6],
};

function drawSigns(ctx, q, x, y, hw, u) {
  const n = Math.abs(q);
  if (!n) return;
  const rows = n > 6 ? 2 : 1;
  const cols = Math.ceil(n / rows);
  const gap = Math.min((2 * hw * 0.9) / cols, u * 0.42);
  const size = Math.max(11, Math.min(17, u * 0.42));
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = r === rows - 1 ? n - cols * (rows - 1) : cols;
    label(ctx, q > 0 ? "+" : "−", x + (c - (inRow - 1) / 2) * gap, y + (r - (rows - 1) / 2) * size * 0.95, {
      size,
      bold: true,
      align: "center",
      color: q > 0 ? COLORS.red : COLORS.blue,
    });
  }
}

function drawItem(ctx, mat, x, y, u, q) {
  const [hw, hh] = SIZE[mat].map(v => v * u);
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.ink;
  if (mat === "ruler") {
    ctx.fillStyle = "rgba(250, 214, 110, 0.9)";
    ctx.fillRect(x - hw, y - hh, 2 * hw, 2 * hh);
    ctx.strokeRect(x - hw, y - hh, 2 * hw, 2 * hh);
    ctx.beginPath();
    for (let i = 1; i < 20; i++) {
      const tx = x - hw + (i * 2 * hw) / 20;
      ctx.moveTo(tx, y - hh);
      ctx.lineTo(tx, y - hh + (i % 5 ? 0.3 : 0.6) * hh);
    }
    ctx.stroke();
  } else if (mat === "glass") {
    ctx.fillStyle = "rgba(190, 226, 246, 0.95)";
    ctx.beginPath();
    ctx.roundRect(x - hw, y - hh, 2 * hw, 2 * hh, hh);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.moveTo(x - hw + hh, y - hh * 0.4);
    ctx.lineTo(x + hw - hh, y - hh * 0.4);
    ctx.stroke();
  } else if (mat === "balloon") {
    ctx.fillStyle = "#ef6b6b";
    ctx.beginPath();
    ctx.ellipse(x, y, hw, hh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + hh);
    ctx.quadraticCurveTo(x + 0.2 * u, y + hh + 0.3 * u, x, y + hh + 0.5 * u);
    ctx.stroke();
  } else if (mat === "wool" || mat === "silk") {
    ctx.fillStyle = mat === "wool" ? "#dcc49e" : "#f4d6e4";
    ctx.beginPath();
    ctx.roundRect(x - hw, y - hh, 2 * hw, 2 * hh, 0.2 * u);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = mat === "wool" ? "rgba(140, 105, 60, 0.45)" : "rgba(255,255,255,0.9)";
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      const ty = y - hh + (i * 2 * hh) / 6;
      ctx.moveTo(x - hw + 4, ty);
      if (mat === "wool") ctx.lineTo(x + hw - 4, ty);
      else ctx.bezierCurveTo(x - hw / 3, ty - 5, x + hw / 3, ty + 5, x + hw - 4, ty);
    }
    ctx.stroke();
  } else if (mat === "hair") {
    ctx.fillStyle = "#f1c9a5";
    ctx.beginPath();
    ctx.ellipse(x, y + 0.1 * u, hw * 0.8, hh * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5b3a24";
    ctx.beginPath();
    ctx.ellipse(x, y - 0.12 * u, hw, hh * 0.7, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
  drawSigns(ctx, q, x, mat === "hair" ? y - 0.3 * u : y, hw, u);
}

const small = view => view.w < 560 || view.h < 430;

function caption(ctx, s, view, lines) {
  const sm = small(view);
  lines.forEach((t, i) => label(ctx, t, view.w / 2, view.h - (lines.length - i) * (sm ? 15 : 19) + 2, { size: sm ? 11 : 13, align: "center", color: COLORS.muted }));
}

// ---------- rub scene ----------
function rubGeom(view) {
  const sm = small(view);
  const col = view.w / 3;
  const u = Math.min(col / 3.1, view.h * 0.13, 70);
  const y = view.h * (sm ? 0.42 : 0.42);
  return { sm, u, y, x: [col * 0.5, col * 1.5, col * 2.5] }; // object 1, cloth, object 2
}

function drawRub(ctx, s, view) {
  const g = rubGeom(view);
  const items = [
    { mat: s.m1, q: s.q1, title: "Vật 1" },
    { mat: s.cloth, q: s.qc, title: "Vật dùng để cọ" },
    { mat: s.m2, q: s.q2, title: "Vật 2" },
  ];
  if (s.showOrder) {
    const names = ORDER.map(m => (m === "balloon" ? "cao su" : m === "ruler" ? "nhựa" : MATERIALS[m].short.replace(/^(mảnh|đũa) /, "")));
    label(ctx, g.sm ? "Dãy nhiễm điện (dễ mất e⁻ → dễ nhận e⁻):" : "Dãy nhiễm điện, từ chất dễ mất electron (+) đến chất dễ nhận electron (−):", view.w / 2, 14, { size: g.sm ? 11 : 13, align: "center", color: COLORS.muted });
    label(ctx, names.join("  ›  "), view.w / 2, g.sm ? 30 : 34, { size: g.sm ? 12 : 14, align: "center", bold: true });
  }
  if (s._msg) label(ctx, s._msg, view.w / 2, s.showOrder ? (g.sm ? 50 : 60) : 16, { size: g.sm ? 12 : 14, align: "center", bold: true, color: s._ok ? COLORS.green : COLORS.red });
  items.forEach((it, i) => {
    drawItem(ctx, it.mat, g.x[i], g.y, g.u, it.q);
    const ly = g.y + g.u * 1.05 + 10;
    label(ctx, it.title, g.x[i], ly, { size: g.sm ? 11 : 13, align: "center", color: COLORS.muted });
    label(ctx, MATERIALS[it.mat].name, g.x[i], ly + (g.sm ? 15 : 18), { size: g.sm ? 12 : 14, align: "center", bold: true });
    label(ctx, `${chargeText(it.q)} · ${chargeWord(it.q)}`, g.x[i], ly + (g.sm ? 30 : 37), { size: g.sm ? 10 : 12, align: "center", color: it.q > 0 ? COLORS.red : it.q < 0 ? COLORS.blue : COLORS.muted });
  });
  // electrons flying during a rub
  const a = s._anim;
  if (a) {
    const from = g.x[a.from];
    const to = g.x[a.to];
    const k = Math.min(1, a.t / ANIM);
    for (let i = 0; i < a.n; i++) {
      const p = Math.min(1, Math.max(0, k * 1.6 - i * 0.12));
      const x = from + (to - from) * p;
      const y = g.y - g.u * 0.9 - Math.sin(p * Math.PI) * g.u * 0.6 + i * 3;
      ctx.fillStyle = COLORS.blue;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, "−", x, y, { size: 11, align: "center", bold: true, color: "#fff" });
    }
  }
  caption(ctx, s, view, g.sm
    ? ["Chỉ electron (−) di chuyển khi cọ xát.", "Mỗi dấu + hoặc − ứng với rất nhiều điện tích."]
    : ["Khi cọ xát, chỉ electron (−) di chuyển từ vật này sang vật kia; vật mất electron nhiễm điện dương.", "Mỗi dấu + hoặc − tượng trưng cho rất nhiều điện tích (hình không theo tỉ lệ)."]);
}

// ---------- paper scene ----------
function drawPaper(ctx, s, view) {
  const sm = small(view);
  const mat = objMat(s, s.use);
  const q = s[objKey(s.use)];
  const u = Math.min(view.w / 3.4, view.h * 0.14, 60);
  const tableY = view.h * 0.66;
  const ox = view.w / 2;
  const oy = tableY - u * 2.3;
  ctx.fillStyle = "#d9c2a3";
  ctx.fillRect(16, tableY, view.w - 32, 8);
  const lifted = paperLifted(q);
  const bitW = Math.max(7, u * 0.22);
  for (let i = 0; i < PAPER; i++) {
    const up = i < lifted;
    const bx = up ? ox + (i - (lifted - 1) / 2) * bitW * 1.25 : ox + (i - (PAPER - 1) / 2) * bitW * 1.7;
    const by = up ? oy + SIZE[mat][1] * u + bitW * 0.45 + (i % 2) * 3 : tableY - bitW * 0.35;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(((i * 37) % 9 - 4) * 0.08);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.fillRect(-bitW / 2, -bitW * 0.3, bitW, bitW * 0.6);
    ctx.strokeRect(-bitW / 2, -bitW * 0.3, bitW, bitW * 0.6);
    ctx.restore();
  }
  drawItem(ctx, mat, ox, oy, u, q);
  label(ctx, `${MATERIALS[mat].name} (vật ${s.use}): ${chargeText(q)}`, ox, 18, { size: sm ? 12 : 14, align: "center", bold: true });
  label(ctx, q ? `Hút ${lifted}/${PAPER} mẩu giấy vụn` : "Chưa nhiễm điện: không hút giấy vụn", ox, sm ? 36 : 42, { size: sm ? 12 : 14, align: "center", color: q ? COLORS.green : COLORS.muted });
  caption(ctx, s, view, sm
    ? ["Mẩu giấy trung hòa vẫn bị hút (hưởng ứng),", "dù vật nhiễm điện dương hay âm."]
    : ["Mẩu giấy không nhiễm điện vẫn bị vật nhiễm điện hút (do hưởng ứng), dù vật nhiễm điện dương hay âm.", "Vật nhiễm điện càng nhiều thì hút được càng nhiều mẩu giấy."]);
}

// ---------- pair scene ----------
const pairTarget = s => (s.near ? interaction(s.q1, s.q2) * Math.min(0.42, 0.012 * strength(s.q1, s.q2) + (s.q1 || s.q2 ? 0.06 : 0)) : 0);

function drawPair(ctx, s, view) {
  const sm = small(view);
  const u = Math.min(view.w / 6.2, view.h * 0.13, 56);
  const px = view.w * 0.36;
  const py = sm ? 34 : 48;
  const L = view.h * 0.42;
  const theta = s._theta ?? pairTarget(s);
  const x1 = px + L * Math.sin(theta);
  const y1 = py + L * Math.cos(theta);
  // stand
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(px - 50, py - 6, 100, 6);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(x1, y1 - SIZE[s.m1][1] * u);
  ctx.stroke();
  drawItem(ctx, s.m1, x1, y1, u, s.q1);
  // object 2 held at the same height
  const rest1 = px + SIZE[s.m1][0] * u;
  const x2 = Math.min(view.w - SIZE[s.m2][0] * u - 6, rest1 + SIZE[s.m2][0] * u + (s.near ? 0.45 : 2.2) * u);
  drawItem(ctx, s.m2, x2, py + L, u, s.q2);
  const lab = sm ? 11 : 13;
  label(ctx, `Vật 1 (treo): ${MATERIALS[s.m1].short}, ${chargeText(s.q1)}`, 10, view.h - (sm ? 62 : 80), { size: lab });
  label(ctx, `Vật 2: ${MATERIALS[s.m2].short}, ${chargeText(s.q2)}`, 10, view.h - (sm ? 46 : 60), { size: lab });
  const it = interaction(s.q1, s.q2);
  let msg = "Vật 2 ở xa: chưa thấy tác dụng";
  if (s.near) {
    msg = it === 0 ? "Hai vật chưa nhiễm điện: không hút, không đẩy"
      : it < 0 ? "Hai vật nhiễm điện cùng dấu: đẩy nhau"
        : s.q1 && s.q2 ? "Hai vật nhiễm điện khác dấu: hút nhau"
          : "Vật nhiễm điện hút vật không nhiễm điện";
    const ay = py + L - u * 0.9;
    if (it) {
      const dir = it > 0 ? 1 : -1;
      arrow(ctx, x1, ay, x1 + dir * 0.7 * u, ay, it > 0 ? COLORS.green : COLORS.red, 2.5);
      arrow(ctx, x2, ay, x2 - dir * 0.7 * u, ay, it > 0 ? COLORS.green : COLORS.red, 2.5);
    }
  }
  label(ctx, msg, view.w / 2, 14, { size: sm ? 12 : 15, align: "center", bold: true, color: s.near && it ? (it > 0 ? COLORS.green : COLORS.red) : COLORS.muted });
  caption(ctx, s, view, [sm ? "Cùng dấu thì đẩy, khác dấu thì hút." : "Hai vật nhiễm điện cùng loại thì đẩy nhau, khác loại thì hút nhau."]);
}

// ---------- electroscope ----------
function drawElectroscope(ctx, s, view) {
  const sm = small(view);
  const q = s[objKey(s.use)];
  const mat = objMat(s, s.use);
  const u = Math.min(view.w / 5.5, view.h * 0.11, 48);
  const cx = view.w / 2;
  const knobY = view.h * 0.36;
  const jarTop = knobY + u * 0.8;
  const jarH = Math.min(view.h * 0.4, u * 4);
  const jarW = u * 2.6;
  const rodEnd = jarTop + jarH * 0.42;
  // jar
  ctx.fillStyle = "rgba(220, 235, 248, 0.6)";
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx - jarW / 2, jarTop, jarW, jarH, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#8a6a4a";
  ctx.fillRect(cx - u * 0.45, jarTop - 4, u * 0.9, 10); // stopper
  // rod and knob
  ctx.strokeStyle = "#8a8f99";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, knobY);
  ctx.lineTo(cx, rodEnd);
  ctx.stroke();
  ctx.fillStyle = "#b7bcc6";
  ctx.beginPath();
  ctx.arc(cx, knobY, u * 0.28, 0, Math.PI * 2);
  ctx.fill();
  // leaves
  const half = ((leafAngle(s.qe) / 2) * Math.PI) / 180;
  const len = jarH * 0.42;
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, rodEnd);
    ctx.lineTo(cx + side * len * Math.sin(half), rodEnd + len * Math.cos(half));
    ctx.stroke();
    if (s.qe) {
      const n = Math.min(3, Math.ceil(Math.abs(s.qe) / 3));
      for (let i = 1; i <= n; i++) {
        const f = (i / (n + 1)) * 0.9 + 0.1;
        label(ctx, s.qe > 0 ? "+" : "−", cx + side * (len * f * Math.sin(half) + 9), rodEnd + len * f * Math.cos(half), {
          size: 13, bold: true, align: "center", color: s.qe > 0 ? COLORS.red : COLORS.blue,
        });
      }
    }
  }
  ctx.lineCap = "butt";
  // object held above the knob
  drawItem(ctx, mat, cx, knobY - u * 1.25, u, q);
  label(ctx, `Góc giữa hai lá: ${fmt(leafAngle(s.qe), 0)}°   ·   Điện nghiệm: ${chargeText(s.qe)}`, cx, sm ? 14 : 18, { size: sm ? 12 : 14, align: "center", bold: true });
  label(ctx, `${MATERIALS[mat].name} (vật ${s.use}): ${chargeText(q)}`, cx, sm ? 30 : 38, { size: sm ? 11 : 13, align: "center", color: COLORS.muted });
  caption(ctx, s, view, [sm ? "Hai lá nhiễm điện cùng dấu nên đẩy nhau." : "Hai lá kim loại nhiễm điện cùng dấu nên đẩy nhau và xòe ra; điện tích càng nhiều, lá xòe càng rộng."]);
}

// ---------- actions ----------
function doRub(s, api, which) {
  const mat = objMat(s, which);
  const sign = signAfterRub(mat, s.cloth);
  const gained = rub(s, which);
  const predicted = s.guess === "+" ? 1 : s.guess === "-" ? -1 : 0;
  s._anim = gained ? { from: gained > 0 ? which * 2 - 2 : 1, to: gained > 0 ? 1 : which * 2 - 2, t: 0, n: Math.min(6, Math.abs(gained)) } : null;
  if (predicted) {
    s._ok = predicted === sign;
    s._msg = s._ok
      ? `Đúng! ${MATERIALS[mat].name} ${chargeWord(sign)}.`
      : `Chưa đúng: ${MATERIALS[mat].short} ${sign > 0 ? "mất" : "nhận thêm"} electron nên ${chargeWord(sign)}.`;
  } else {
    s._msg = gained ? "" : "Vật đã nhiễm điện tối đa, cọ thêm không tăng.";
    s._ok = false;
  }
  api.emit("rub", { object: which, gained, charge: s[objKey(which)], clothCharge: s.qc, prediction: predicted }, "action");
  if (predicted && predicted === sign) api.emit("prediction-correct", { object: which, sign }, "goal");
  s.guess = "";
  api.play();
}

const objectOptions = OBJECTS.map(m => ({ value: m, label: MATERIALS[m].name }));
const inScene = (...names) => s => names.includes(s.scene);

mount({
  slug: "nhiem-dien",
  version: "1.0.0",
  title: "Sự nhiễm điện do cọ xát",
  hint: "Chọn vật, dự đoán dấu điện tích rồi bấm Cọ xát. Sau đó đổi thí nghiệm để thử hút giấy vụn, cho hai vật lại gần nhau hoặc dùng điện nghiệm.",
  initialState,
  autoplay: true,
  step(s, dt) {
    if (s._anim) {
      s._anim.t += dt;
      if (s._anim.t > ANIM) s._anim = null;
    }
    const target = pairTarget(s);
    s._theta = (s._theta ?? target) + (target - (s._theta ?? target)) * Math.min(1, dt * 5);
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
    {
      type: "select",
      key: "scene",
      label: "Thí nghiệm",
      options: [
        { value: "rub", label: "Cọ xát hai vật" },
        { value: "paper", label: "Hút mẩu giấy vụn" },
        { value: "pair", label: "Đưa hai vật nhiễm điện lại gần" },
        { value: "electroscope", label: "Điện nghiệm" },
      ],
      onChange: s => (s._msg = ""),
    },
    { type: "select", key: "m1", label: "Vật 1", options: objectOptions, onChange: s => (s.q1 = 0) },
    { type: "select", key: "m2", label: "Vật 2", options: objectOptions, onChange: s => (s.q2 = 0) },
    { type: "select", key: "cloth", label: "Vật dùng để cọ", options: CLOTHS.map(m => ({ value: m, label: MATERIALS[m].name })), onChange: s => (s.qc = 0), visible: inScene("rub") },
    {
      type: "select",
      key: "guess",
      label: "Em dự đoán vật được cọ sẽ",
      options: [
        { value: "", label: "— chưa dự đoán —" },
        { value: "+", label: "nhiễm điện dương (+)" },
        { value: "-", label: "nhiễm điện âm (−)" },
      ],
      visible: inScene("rub"),
    },
    { type: "button", label: "Cọ xát vật 1", primary: true, action: (s, api) => doRub(s, api, 1), visible: inScene("rub") },
    { type: "button", label: "Cọ xát vật 2", action: (s, api) => doRub(s, api, 2), visible: inScene("rub") },
    { type: "checkbox", key: "showOrder", label: "Hiện dãy nhiễm điện", visible: inScene("rub") },
    {
      type: "select",
      key: "use",
      label: "Dùng vật",
      options: [
        { value: 1, label: "Vật 1" },
        { value: 2, label: "Vật 2" },
      ],
      visible: inScene("paper", "electroscope"),
    },
    {
      type: "button",
      label: "Đưa vật 2 lại gần vật 1",
      primary: true,
      visible: s => s.scene === "pair" && !s.near,
      action(s, api) {
        s.near = true;
        api.emit("move-object", { near: 1 });
        if (s.q1 && s.q2) api.emit("bring-together", { interaction: interaction(s.q1, s.q2), q1: s.q1, q2: s.q2 }, "result");
        api.play();
      },
    },
    {
      type: "button",
      label: "Đưa vật 2 ra xa",
      visible: s => s.scene === "pair" && s.near,
      action(s, api) {
        s.near = false;
        api.emit("move-object", { near: 0 });
        api.play();
      },
    },
    {
      type: "button",
      label: "Chạm vật vào núm điện nghiệm",
      primary: true,
      visible: inScene("electroscope"),
      action(s, api) {
        const moved = touchElectroscope(s, s.use);
        api.emit("touch-electroscope", { object: s.use, moved, charge: s.qe, angle: leafAngle(s.qe) });
      },
    },
    { type: "button", label: "Chạm tay vào núm (làm mất điện tích)", visible: inScene("electroscope"), action: s => (s.qe = 0), event: "ground-electroscope" },
    {
      type: "button",
      label: "Làm mất điện tích mọi vật",
      action(s) {
        s.q1 = s.q2 = s.qc = s.qe = 0;
        s._msg = "";
      },
      event: "discharge-all",
    },
  ],
  readouts: [
    { label: "Vật 1", value: s => `${MATERIALS[s.m1].name}: ${chargeText(s.q1)}` },
    { label: "Vật 2", value: s => `${MATERIALS[s.m2].name}: ${chargeText(s.q2)}` },
    { label: "Vật dùng để cọ", value: s => `${MATERIALS[s.cloth].name}: ${chargeText(s.qc)}` },
    { label: "Điện nghiệm", value: s => `${chargeText(s.qe)} (lá xòe ${fmt(leafAngle(s.qe), 0)}°)` },
  ],
  draw(ctx, s, view) {
    ctx.font = `13px ${FONT}`;
    if (s.scene === "paper") drawPaper(ctx, s, view);
    else if (s.scene === "pair") drawPair(ctx, s, view);
    else if (s.scene === "electroscope") drawElectroscope(ctx, s, view);
    else drawRub(ctx, s, view);
  },
});
