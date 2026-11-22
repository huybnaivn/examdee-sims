import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, PLACES, OBJECTS, reading, isGoodGuess, cleanGuess, balanceWorks } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const THEME = {
  earth: { sky: "#dcefff", ground: "#8ccf8a", dark: false },
  moon: { sky: "#141829", ground: "#9aa1b0", dark: true },
  mars: { sky: "#f4d7bd", ground: "#c46a3f", dark: false },
  jupiter: { sky: "#f1e2c9", ground: "#d2a877", dark: false },
  orbit: { sky: "#0b1026", ground: "#59627a", dark: true },
};

const NOTES = {
  moon: "Bằng khoảng 1/6 so với trên Trái Đất.",
  mars: "Bằng khoảng 0,38 lần so với trên Trái Đất.",
  jupiter: "Sao Mộc là hành tinh khí, không có mặt đất rắn: g tính ở đỉnh tầng mây.",
  orbit: "Trái Đất vẫn hút, nhưng trạm và mọi vật cùng rơi tự do nên lực kế chỉ 0 N.",
};

const unjudge = s => {
  s.verdict = 0;
};

// One result per finished choice of place, object or rounding.
const report = (s, api) => {
  const r = reading(s);
  const data = { mass: r.mass, weight: r.weight, gravity: r.g };
  api.emit("weighed", data, "result");
};

function wrap(ctx, text, maxW, size) {
  ctx.font = `${size}px ${FONT}`;
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

// Text on a white plate, readable on any sky.
function tag(ctx, text, x, y, { size = 13, color = COLORS.ink, bold = false, align = "center", maxX = Infinity, minX = 0 } = {}) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width + 12;
  const h = size + 8;
  let left = align === "center" ? x - w / 2 : align === "left" ? x : x - w;
  left = Math.max(minX, Math.min(left, maxX - w));
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.fillRect(left, y - h / 2, w, h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, y - h / 2, w, h);
  label(ctx, text, left + 6, y, { size, color, bold });
}

const HEIGHT = { astronaut: 1, crate: 0.8, rock: 0.6, weight: 0.62 };

/** Draws the object with its top centre at (x, top); S is the size of the tallest object. */
function drawObject(ctx, kind, x, top, S) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineJoin = "round";
  const box = (bx, by, bw, bh, fill) => {
    ctx.fillStyle = fill;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);
  };
  if (kind === "astronaut") {
    box(x - 0.2 * S, top + 0.64 * S, 0.16 * S, 0.36 * S, "#fff");
    box(x + 0.04 * S, top + 0.64 * S, 0.16 * S, 0.36 * S, "#fff");
    box(x - 0.36 * S, top + 0.36 * S, 0.12 * S, 0.3 * S, "#fff");
    box(x + 0.24 * S, top + 0.36 * S, 0.12 * S, 0.3 * S, "#fff");
    box(x - 0.24 * S, top + 0.32 * S, 0.48 * S, 0.36 * S, "#fff");
    box(x - 0.1 * S, top + 0.42 * S, 0.2 * S, 0.12 * S, COLORS.orange);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, top + 0.19 * S, 0.19 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2f4a7a";
    ctx.beginPath();
    ctx.ellipse(x, top + 0.2 * S, 0.12 * S, 0.09 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "crate") {
    const a = 0.8 * S;
    box(x - a / 2, top, a, a, "#c89a5b");
    ctx.beginPath();
    ctx.moveTo(x - a / 2, top);
    ctx.lineTo(x + a / 2, top + a);
    ctx.moveTo(x + a / 2, top);
    ctx.lineTo(x - a / 2, top + a);
    ctx.stroke();
  } else if (kind === "rock") {
    const h = 0.6 * S;
    ctx.fillStyle = "#8d94a3";
    ctx.beginPath();
    ctx.moveTo(x - 0.1 * S, top);
    ctx.lineTo(x + 0.22 * S, top + 0.12 * h);
    ctx.lineTo(x + 0.38 * S, top + 0.6 * h);
    ctx.lineTo(x + 0.26 * S, top + h);
    ctx.lineTo(x - 0.3 * S, top + h);
    ctx.lineTo(x - 0.4 * S, top + 0.5 * h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    const h = 0.62 * S;
    ctx.fillStyle = "#d9a441";
    ctx.beginPath();
    ctx.moveTo(x - 0.07 * S, top);
    ctx.lineTo(x + 0.07 * S, top);
    ctx.lineTo(x + 0.07 * S, top + 0.22 * h);
    ctx.lineTo(x + 0.2 * S, top + 0.3 * h);
    ctx.lineTo(x + 0.26 * S, top + h);
    ctx.lineTo(x - 0.26 * S, top + h);
    ctx.lineTo(x - 0.2 * S, top + 0.3 * h);
    ctx.lineTo(x - 0.07 * S, top + 0.22 * h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawBackdrop(ctx, s, view, groundY, small) {
  const t = THEME[s.place];
  ctx.fillStyle = t.sky;
  ctx.fillRect(0, 0, view.w, view.h);
  if (t.dark) {
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 46; i++) {
      // fixed pseudo-random stars
      const x = ((i * 7919) % 997) / 997;
      const y = ((i * 6007) % 991) / 991;
      ctx.fillRect(x * view.w, y * groundY, i % 5 ? 1.2 : 2, i % 5 ? 1.2 : 2);
    }
    if (!small) {
      // the Earth in the sky
      const r = Math.min(view.w, view.h) * 0.07;
      ctx.fillStyle = "#3f7fe0";
      ctx.beginPath();
      ctx.arc(view.w - r * 2, groundY - r * 2.4, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#58b06c";
      ctx.beginPath();
      ctx.ellipse(view.w - r * 2.2, groundY - r * 2.5, r * 0.45, r * 0.3, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = t.ground;
  ctx.fillRect(0, groundY, view.w, view.h - groundY);
  if (s.place === "jupiter") {
    ctx.fillStyle = "#b9865a";
    ctx.fillRect(0, groundY + (view.h - groundY) * 0.55, view.w, (view.h - groundY) * 0.2);
  }
}

mount({
  slug: "trong-luong-khoi-luong",
  version: "1.0.0",
  title: "Khối lượng và trọng lượng",
  hint: "Đem cùng một vật đi cân ở nhiều nơi. Số chỉ nào thay đổi, số chỉ nào giữ nguyên?",
  initialState,
  controls: [
    {
      type: "select",
      key: "place",
      label: "Nơi cân",
      options: Object.entries(PLACES).map(([value, p]) => ({ value, label: p.name })),
      onChange: unjudge,
      onCommit: report,
    },
    {
      type: "select",
      key: "object",
      label: "Vật được cân",
      options: Object.entries(OBJECTS).map(([value, o]) => ({ value, label: `${o.name} (${fmt(o.mass)} kg)` })),
      onChange: unjudge,
      onCommit: report,
    },
    { type: "checkbox", key: "approx", label: "Trên Trái Đất lấy tròn g = 10 N/kg (như sách giáo khoa)", onChange: unjudge, onCommit: report },
    { type: "heading", label: "Thử dự đoán" },
    { type: "checkbox", key: "predict", label: "Che số chỉ lực kế để em dự đoán", onChange: unjudge },
    {
      // The kit has no number-entry control.
      type: "custom",
      visible: s => s.predict,
      render(box, api) {
        const head = document.createElement("span");
        head.className = "row-head";
        head.textContent = "Em dự đoán lực kế chỉ (N)";
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "decimal";
        input.setAttribute("aria-label", "Dự đoán số chỉ lực kế, đơn vị niutơn");
        input.style.cssText = "width:100%;font:inherit;padding:8px 10px;border:1px solid #dfe5f0;border-radius:8px;";
        input.addEventListener("change", () => {
          const s = api.state;
          s.guess = cleanGuess(Number(input.value.trim().replace(",", ".")));
          s.verdict = 0;
          api.emit("param", { key: "guess", value: s.guess }, "param");
          api.sync();
        });
        box.append(head, input);
        return () => {
          if (document.activeElement !== input) input.value = String(api.state.guess).replace(".", ",");
        };
      },
    },
    {
      type: "button",
      label: "Kiểm tra dự đoán",
      primary: true,
      visible: s => s.predict,
      disabled: s => s.verdict !== 0,
      action(s, api) {
        if (s.verdict !== 0) return;
        const r = reading(s);
        const ok = isGoodGuess(s.guess, r.weight);
        s.verdict = ok ? 1 : -1;
        const tried = { guess: cleanGuess(s.guess), weight: r.weight, correct: ok ? 1 : 0 };
        api.emit("predict", tried, "action");
        const won = { mass: r.mass, weight: r.weight, gravity: r.g, guess: cleanGuess(s.guess) };
        // The goal is a weight somewhere other than the Earth.
        if (ok && s.place !== "earth") api.emit("weight-predicted", won, "goal");
      },
    },
  ],
  readouts: [
    { label: "Khối lượng m (cân đòn)", value: s => `${fmt(reading(s).mass)} kg` },
    { label: "g tại nơi cân", value: s => (s.place === "orbit" ? "không trọng lượng" : `${fmt(reading(s).g)} N/kg`) },
    { label: "Trọng lượng P (lực kế)", value: s => (s.predict && !s.verdict ? "? N" : `${fmt(reading(s).weight, 1)} N`) },
    { label: "Độ dãn lò xo", value: s => (s.predict && !s.verdict ? "?" : `${fmt(reading(s).extension * 100)} cm`) },
  ],
  draw(ctx, s, view) {
    const r = reading(s);
    const t = THEME[s.place];
    const small = view.w < 520 || view.h < 400;
    const ink = t.dark ? "#f2f5fb" : COLORS.ink;
    const muted = t.dark ? "#b9c2d6" : "#4c586e";
    const hidden = s.predict && !s.verdict;
    const orbit = s.place === "orbit";
    const strip = small ? 30 : 44;
    const groundY = view.h - strip;
    drawBackdrop(ctx, s, view, groundY, small);

    // header: where, the formula, a note
    const big = small ? 14 : 18;
    const mid = small ? 13 : 15;
    const tiny = small ? 11 : 13;
    let y = small ? 13 : 20;
    label(ctx, orbit ? PLACES.orbit.name : `${PLACES[s.place].name}: g = ${fmt(r.g)} N/kg`, view.w / 2, y, { align: "center", size: big, bold: true, color: ink });
    y += big + 5;
    const formula = orbit
      ? `Lực kế chỉ ${hidden ? "?" : "0"} N, khối lượng vẫn là ${fmt(r.mass)} kg`
      : `P = m · g = ${fmt(r.mass)} × ${fmt(r.g)} = ${hidden ? "?" : fmt(r.weight, 1)} N`;
    label(ctx, formula, view.w / 2, y, { align: "center", size: mid, color: ink });
    y += mid + 3;
    let note = s.place === "earth" ? (s.approx ? "Sách giáo khoa lấy tròn: vật 1 kg có trọng lượng 10 N (P = 10 · m)." : "Chính xác hơn: vật 1 kg có trọng lượng khoảng 9,81 N.") : NOTES[s.place];
    let noteColor = muted;
    if (s.verdict === 1) {
      note = `Đúng rồi! Lực kế chỉ ${fmt(r.weight, 1)} N.`;
      noteColor = t.dark ? "#6fe0a8" : "#11734c";
    } else if (s.verdict === -1) {
      note = `Chưa đúng: em đoán ${fmt(cleanGuess(s.guess), 1)} N, lực kế chỉ ${fmt(r.weight, 1)} N.`;
      noteColor = t.dark ? "#ff9a9d" : "#b3262b";
    } else if (hidden) {
      note = orbit ? "Em thử đoán: trên trạm vũ trụ lực kế chỉ bao nhiêu niutơn?" : "Em thử tính P = m · g rồi nhập vào ô dự đoán.";
    }
    for (const line of wrap(ctx, note, view.w - 24, tiny)) {
      label(ctx, line, view.w / 2, y, { align: "center", size: tiny, color: noteColor });
      y += tiny + 3;
    }

    const top = y + 4;
    const H = groundY - top;
    const S = clamp(H * 0.24, 26, 96); // size of the tallest object
    const objH = HEIGHT[s.object] * S;
    const xs = view.w * 0.25;
    const xb = view.w * 0.71;

    // ---------- spring scale on a stand ----------
    const arm = Math.max(34, view.w * 0.09);
    const bw = clamp(H * 0.1, 14, 30);
    const bodyLen = H * 0.34;
    const yb0 = top + 12;
    const yb1 = yb0 + bodyLen;
    const yz = yb0 + bodyLen * 0.14;
    const yf = yb1 - bodyLen * 0.08;
    const frac = hidden ? 0.5 : clamp(r.weight / r.fullScale, 0, 1);
    const yp = yz + frac * (yf - yz);
    ctx.strokeStyle = t.dark ? "#cfd6e6" : COLORS.ink;
    ctx.lineWidth = small ? 3 : 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(xs - arm - 12, groundY);
    ctx.lineTo(xs - arm + 12, groundY);
    ctx.moveTo(xs - arm, groundY);
    ctx.lineTo(xs - arm, top + 2);
    ctx.lineTo(xs, top + 2);
    ctx.lineTo(xs, yb0);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(xs - bw / 2, yb0, bw, bodyLen);
    ctx.strokeRect(xs - bw / 2, yb0, bw, bodyLen);
    if (hidden) {
      ctx.fillStyle = "#c9d2e3";
      ctx.fillRect(xs - bw / 2 + 1, yb0 + 1, bw - 2, bodyLen - 2);
      label(ctx, "?", xs, (yb0 + yb1) / 2, { align: "center", bold: true, size: small ? 14 : 18 });
    } else {
      // spring
      ctx.strokeStyle = COLORS.blue;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xs, yb0 + 3);
      const coils = 9;
      for (let i = 1; i <= coils; i++) {
        ctx.lineTo(xs + (i % 2 ? 1 : -1) * bw * 0.28, yb0 + 3 + ((yp - yb0 - 3) * (i - 0.5)) / coils);
      }
      ctx.lineTo(xs, yp);
      ctx.stroke();
      // scale marks
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const ty = yz + ((yf - yz) * i) / 10;
        ctx.beginPath();
        ctx.moveTo(xs - bw / 2, ty);
        ctx.lineTo(xs - bw / 2 + (i % 5 ? 4 : 8), ty);
        ctx.stroke();
      }
      label(ctx, "0", xs - bw / 2 - 4, yz, { align: "right", size: small ? 9 : 11, color: muted });
      label(ctx, fmt(r.fullScale), xs - bw / 2 - 4, yf, { align: "right", size: small ? 9 : 11, color: muted });
      // pointer
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(xs - bw / 2, yp);
      ctx.lineTo(xs + bw / 2, yp);
      ctx.stroke();
    }
    // rod, hook and the object
    const hookY = yb1 + 6 + frac * (yf - yz);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xs, hidden ? yb1 : yp);
    ctx.lineTo(xs, hookY);
    ctx.stroke();
    drawObject(ctx, s.object, xs, hookY, S);
    tag(ctx, hidden ? "P = ? N" : `P = ${fmt(r.weight, 1)} N`, xs + bw / 2 + 8, hidden ? (yb0 + yb1) / 2 : Math.max(yp, yb0 + 12), {
      align: "left",
      bold: true,
      size: small ? 12 : 15,
      color: "#b3262b",
    });

    // ---------- beam balance ----------
    const works = balanceWorks(r.g);
    const pivotY = groundY - H * 0.62;
    const bl = Math.min(view.w * 0.17, H * 0.5);
    const sl = H * 0.3;
    const tilt = works ? 0 : -0.22;
    ctx.fillStyle = t.dark ? "#cfd6e6" : COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(xb, pivotY);
    ctx.lineTo(xb - 9, groundY);
    ctx.lineTo(xb + 9, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(xb - bl * 0.5, groundY - 5, bl, 5);
    const ends = [-1, 1].map(side => ({ x: xb + side * bl * Math.cos(tilt), y: pivotY + side * bl * Math.sin(tilt) }));
    ctx.strokeStyle = t.dark ? "#cfd6e6" : COLORS.ink;
    ctx.lineWidth = small ? 3 : 4;
    ctx.beginPath();
    ctx.moveTo(ends[0].x, ends[0].y);
    ctx.lineTo(ends[1].x, ends[1].y);
    ctx.stroke();
    const pw = bl * 0.62;
    ends.forEach((e, i) => {
      const panY = e.y + sl;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x - pw, panY);
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + pw, panY);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x - pw - 3, panY);
      ctx.lineTo(e.x + pw + 3, panY);
      ctx.stroke();
      const lift = works ? 0 : sl * 0.22; // in free fall nothing presses on the pans
      const size = Math.min(S * 0.8, (sl - 6) / HEIGHT[s.object], (pw * 2) / 0.8);
      if (i === 0) drawObject(ctx, s.object, e.x, panY - HEIGHT[s.object] * size - lift, size);
      else {
        const ws = Math.min(size, pw * 1.5);
        drawObject(ctx, "weight", e.x - ws * 0.3, panY - HEIGHT.weight * ws - lift, ws);
        drawObject(ctx, "weight", e.x + ws * 0.32, panY - HEIGHT.weight * ws * 0.7 - lift * 1.6, ws * 0.7);
      }
    });
    tag(ctx, works ? `m = ${fmt(r.mass)} kg` : `Không cân được (m vẫn là ${fmt(r.mass)} kg)`, xb, pivotY - (small ? 14 : 20), {
      bold: true,
      size: small ? 12 : 15,
      color: "#1c4fc0",
      maxX: view.w - 4,
      minX: 4,
    });
    if (works && !small) label(ctx, "thăng bằng với các quả cân", xb, pivotY + 16, { align: "center", size: 12, color: muted });

    // captions on the ground
    const cy = groundY + strip / 2;
    const cs = small ? 11 : 13;
    tag(ctx, small ? "Lực kế: đo trọng lượng" : "Lực kế: đo trọng lượng P (N)", xs, cy, { size: cs, minX: 4 });
    tag(ctx, small ? "Cân đòn: đo khối lượng" : "Cân đòn: đo khối lượng m (kg)", xb, cy, { size: cs, maxX: view.w - 4 });
  },
});
