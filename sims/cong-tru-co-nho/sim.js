import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import { MAX, initialState, whole, digits, valid, answer, columns, carries, stepOf, checkDigit, blocks, newQuestion } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const PLACE = ["đơn vị", "chục", "trăm", "nghìn", "chục nghìn"];
const A = COLORS.blue; // first number
const B = COLORS.orange; // second number
const R = COLORS.green; // result, carried blocks
const ANIM = 800; // ms, regrouping animation

const practice = s => s.mode === "practice";
const sub = s => s.op === "sub";
const sign = s => (sub(s) ? "−" : "+");
const nums = s => [whole(s.a, 0, MAX), whole(s.b, 0, MAX)];
const cols = s => columns(s.a, s.b, s.op);
const done = s => !!cols(s) && stepOf(s) >= cols(s).length;

/** Centred text that shrinks to fit maxW. */
function fit(ctx, text, x, y, size, maxW, opts = {}) {
  ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, align: "center", size: w > maxW ? Math.max(8, (size * maxW) / w) : size });
}

function restart(s) {
  if (practice(s) && !valid(s.a, s.b, s.op)) [s.a, s.b] = [s.b, s.a];
  s.step = 0;
  s._mistakes = 0;
  s._wrong = -1;
  s._t0 = 0;
}

/** The calculation is finished: one result, and a goal when every digit was entered right. */
function finish(s, api) {
  const [a, b] = nums(s);
  const data = { a, b, operation: sub(s) ? -1 : 1, answer: answer(a, b, s.op), carries: carries(cols(s)) };
  api.emit("calculated", data, "result");
  if (practice(s) && !s._mistakes) api.emit("all-digits-right", data, "goal");
}

function go(s, api, to) {
  s.step = to;
  s._wrong = -1;
  s._t0 = performance.now();
  api.emit("step", { step: to, steps: cols(s).length }, "action");
  if (done(s)) finish(s, api);
}

/** What the learner says for one column, in the textbook wording. */
function say(c, s) {
  const write = `viết ${c.digit}`;
  if (!sub(s)) {
    if (!c.hasX && !c.hasY) return `Nhớ 1 sang hàng ${PLACE[c.place]}, ${write}.`;
    const one = c.hasX && c.hasY ? `${c.x} cộng ${c.y} bằng ${c.x + c.y}` : "";
    const lone = c.hasX ? c.x : c.y;
    const head = one ? (c.carryIn ? `${one}, thêm 1 bằng ${c.sum}` : one) : c.carryIn ? `${lone} thêm 1 bằng ${c.sum}` : `Hạ ${lone}`;
    return `${head}, ${write}${c.carryOut ? ", nhớ 1" : ""}.`;
  }
  const t = c.y + c.carryIn;
  if (!c.hasY && !c.carryIn) return `Hạ ${c.x}, ${write}.`;
  const head = c.hasY && c.carryIn ? `${c.y} thêm 1 bằng ${t}; ` : "";
  return c.carryOut
    ? `${head}${c.x} không trừ được ${t}, lấy ${c.x + 10} trừ ${t} bằng ${c.digit}, ${write}, nhớ 1.`
    : `${head}${c.x} trừ ${t} bằng ${c.digit}, ${write}.`;
}

/** What the blocks did in the last step. */
function blockNote(pic, s) {
  if (!pic.moves.length) return "";
  const m = pic.moves;
  return sub(s)
    ? `Đổi 1 ${PLACE[m[0].from]} thành 10 ${PLACE[m[0].to]}${m.length > 1 ? `, rồi đổi tiếp đến hàng ${PLACE[m.at(-1).to]}` : ""}.`
    : `Gộp 10 ${PLACE[m[0].from]} thành 1 ${PLACE[m[0].to]}.`;
}

function digitPad(box, api) {
  box.style.cssText = "display:grid;grid-template-columns:repeat(5,1fr);gap:8px";
  const buttons = Array.from({ length: 10 }, (_, d) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(d);
    b.setAttribute("aria-label", `Viết chữ số ${d}`);
    b.style.cssText = "min-height:54px;font-size:22px;font-weight:600;padding:0";
    b.addEventListener("click", () => {
      const s = api.state;
      const k = stepOf(s);
      const list = cols(s);
      if (!list || k >= list.length) return;
      const correct = checkDigit(list, k, d);
      api.emit("digit-entered", { place: list[k].place, digit: d, correct: correct ? 1 : 0 }, "action");
      if (correct) {
        s.step = k + 1;
        s._wrong = -1;
        s._t0 = performance.now();
        if (done(s)) finish(s, api);
      } else {
        s._mistakes++;
        s._wrong = d;
      }
      api.sync();
    });
    box.append(b);
    return b;
  });
  return () => {
    const s = api.state;
    buttons.forEach((b, d) => {
      b.disabled = !cols(s) || done(s);
      b.style.background = s._wrong === d ? "#fde2e2" : "";
      b.style.color = s._wrong === d ? COLORS.red : "";
    });
  };
}

// ---------- drawing ----------

/** One block of a place value, centred in a slot of side c. Shapes differ by place; not to scale. */
function block(ctx, place, x, y, c, color, alpha = 1, crossed = false) {
  ctx.save();
  ctx.globalAlpha = alpha * (crossed ? 0.35 : 1);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1;
  const rect = (w, h) => ctx.fillRect(x - w / 2, y - h / 2, w, h);
  if (place === 0) {
    rect(c * 0.44, c * 0.44);
  } else if (place === 1 || place === 4) {
    const w = c * (place === 1 ? 0.26 : 0.5);
    const h = c * 0.9;
    rect(w, h);
    if (c >= 20) {
      ctx.beginPath();
      for (let i = 1; i < 10; i++) {
        ctx.moveTo(x - w / 2, y - h / 2 + (h * i) / 10);
        ctx.lineTo(x + w / 2, y - h / 2 + (h * i) / 10);
      }
      ctx.stroke();
    }
  } else {
    const d = place === 3 ? c * 0.16 : 0; // a thousand is a cube: add a top and a side
    const w = c * 0.82 - d;
    const x0 = x - (w + d) / 2;
    const y0 = y - (w + d) / 2 + d;
    if (d) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + d, y0 - d);
      ctx.lineTo(x0 + w + d, y0 - d);
      ctx.lineTo(x0 + w + d, y0 + w - d);
      ctx.lineTo(x0 + w, y0 + w);
      ctx.lineTo(x0 + w, y0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fill();
      ctx.fillStyle = color;
    }
    ctx.fillRect(x0, y0, w, w);
    if (c >= 20) {
      ctx.beginPath();
      for (let i = 1; i < 4; i++) {
        ctx.moveTo(x0 + (w * i) / 4, y0);
        ctx.lineTo(x0 + (w * i) / 4, y0 + w);
        ctx.moveTo(x0, y0 + (w * i) / 4);
        ctx.lineTo(x0 + w, y0 + (w * i) / 4);
      }
      ctx.stroke();
    }
  }
  if (crossed) {
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = Math.max(1.5, c * 0.07);
    ctx.beginPath();
    ctx.moveTo(x - c * 0.3, y - c * 0.3);
    ctx.lineTo(x + c * 0.3, y + c * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

/** Panels for `n` places inside the rectangle; each holds up to 20 slots in the grid that gives the biggest slot. */
function panels(box, n) {
  const gap = 6;
  const head = box.h < 150 ? 16 : 22;
  const pw = (box.w - gap * (n - 1)) / n;
  const ph = box.h - head;
  let best = { c: 0 };
  for (const gx of [2, 3, 4, 5, 7, 10]) {
    const gy = Math.ceil(20 / gx);
    const c = Math.min((pw - 6) / gx, (ph - 6) / gy);
    if (c > best.c) best = { c, gx, gy };
  }
  best.c = Math.min(best.c, 64);
  return {
    head,
    pw,
    ph,
    ...best,
    x: place => box.x + (n - 1 - place) * (pw + gap), // highest place on the left
    slot(place, i) {
      const left = this.x(place) + (pw - best.gx * best.c) / 2;
      return { x: left + ((i % best.gx) + 0.5) * best.c, y: box.y + head + 3 + (Math.floor(i / best.gx) + 0.5) * best.c };
    },
  };
}

function drawBlocks(ctx, s, box, n, t) {
  const [a, b] = nums(s);
  const k = stepOf(s);
  const pic = blocks(a, b, s.op, k);
  const g = panels(box, n);
  const da = digits(a);
  for (let p = 0; p < n; p++) {
    const x = g.x(p);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = p === k && !done(s) ? COLORS.purple : COLORS.grid;
    ctx.lineWidth = p === k && !done(s) ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(x, box.y + g.head, g.pw, g.ph, 8);
    ctx.fill();
    ctx.stroke();
    fit(ctx, `${pic.have[p]} ${PLACE[p]}`, x + g.pw / 2, box.y + g.head / 2, g.head < 20 ? 11 : 14, g.pw - 2, { bold: true, color: COLORS.muted });
    const arriving = t < 1 && !sub(s) && pic.moves.some(m => m.to === p);
    for (let i = 0; i < pic.have[p]; i++) {
      const at = g.slot(p, i);
      // not done yet: first number, second number, then carried blocks; done: the result
      const color = p < k ? R : i < (da[p] ?? 0) ? A : sub(s) || i >= pic.have[p] - (p === k && k > 0 && pic.moves.some(m => m.to === p) ? 1 : 0) ? R : B;
      block(ctx, p, at.x, at.y, g.c, color, arriving && i === pic.have[p] - 1 ? t : 1);
    }
    for (let i = 0; i < pic.removed[p]; i++) {
      const at = g.slot(p, pic.have[p] + i);
      block(ctx, p, at.x, at.y, g.c, B, 1, true);
    }
  }
  // regrouping in flight: ten blocks gather into one of the next place (addition),
  // or one block leaves for the place on its right, where it has become ten (subtraction)
  if (t < 1) {
    const e = t * t * (3 - 2 * t);
    for (const m of pic.moves) {
      const to = g.slot(m.to, sub(s) ? pic.have[m.to] + pic.removed[m.to] - 1 : pic.have[m.to] - 1);
      for (let i = 0; i < (sub(s) ? 1 : 10); i++) {
        const from = g.slot(m.from, pic.have[m.from] + i);
        block(ctx, m.from, from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, g.c, sub(s) ? A : B, 1 - e);
      }
    }
  }
}

function drawSum(ctx, s, box, n) {
  const [a, b] = nums(s);
  const list = cols(s);
  const k = stepOf(s);
  const rowH = Math.min(box.h / 3.9, box.w / (n + 1.6) / 0.72, 92);
  const cw = rowH * 0.72;
  const size = rowH * 0.8;
  const right = box.x + (box.w + (n + 1) * cw) / 2; // right edge of the ones column
  const top = box.y + (box.h - rowH * 3.9) / 2 + rowH * 0.7; // below the row of small carries
  const cx = p => right - (p + 0.5) * cw;
  const rowY = r => top + (r + 0.5) * rowH + (r === 2 ? rowH * 0.2 : 0);
  // the column being worked on
  if (list && k < list.length) {
    ctx.fillStyle = COLORS.purple + "22";
    ctx.beginPath();
    ctx.roundRect(cx(k) - cw / 2 + 1, top - rowH * 0.7, cw - 2, rowH * 3.9, 6);
    ctx.fill();
  }
  digits(a).forEach((d, p) => label(ctx, String(d), cx(p), rowY(0), { size, align: "center", bold: true, color: A }));
  digits(b).forEach((d, p) => label(ctx, String(d), cx(p), rowY(1), { size, align: "center", bold: true, color: B }));
  label(ctx, sign(s), cx(n) , (rowY(0) + rowY(1)) / 2, { size: size * 0.8, align: "center", bold: true });
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = Math.max(2, rowH * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx(n) - cw / 2, top + 2 * rowH + rowH * 0.08);
  ctx.lineTo(right, top + 2 * rowH + rowH * 0.08);
  ctx.stroke();
  if (!list) return;
  const result = answer(a, b, s.op);
  list.forEach((c, i) => {
    if (i < k) {
      const leadingZero = done(s) && c.place >= String(result).length;
      label(ctx, String(c.digit), cx(c.place), rowY(2), { size, align: "center", bold: true, color: leadingZero ? COLORS.grid : R });
      // the small "nhớ 1": above the next column when adding, beside the subtrahend digit when subtracting
      if (c.carryOut) {
        if (sub(s)) label(ctx, "1", cx(c.place + 1) - cw * 0.42, rowY(1) + rowH * 0.28, { size: size * 0.4, align: "center", bold: true, color: COLORS.red });
        else label(ctx, "1", cx(c.place + 1), top - rowH * 0.32, { size: size * 0.45, align: "center", bold: true, color: COLORS.red });
      }
    } else if (i === k && practice(s)) {
      label(ctx, "?", cx(c.place), rowY(2), { size, align: "center", bold: true, color: COLORS.purple });
    }
  });
}

const api = mount({
  slug: "cong-tru-co-nho",
  version: "1.0.0",
  title: "Cộng, trừ có nhớ theo cột dọc",
  hint: "Tính từ phải sang trái, từ hàng đơn vị. Đủ 10 thì nhớ 1 sang hàng bên trái.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "explore", label: "Xem từng bước" },
        { value: "practice", label: "Luyện tập: tự viết từng chữ số" },
      ],
      onChange: restart,
    },
    {
      type: "button",
      label: "Bước tiếp ▶",
      primary: true,
      visible: s => !practice(s),
      disabled: s => !cols(s) || done(s),
      action: (s, api) => go(s, api, stepOf(s) + 1),
    },
    { type: "button", label: "◀ Lùi một bước", visible: s => !practice(s), disabled: s => stepOf(s) === 0, action: (s, api) => go(s, api, stepOf(s) - 1) },
    { type: "custom", render: digitPad, visible: practice },
    { type: "heading", label: "Chọn phép tính" },
    {
      type: "select",
      key: "op",
      label: "Phép tính",
      options: [
        { value: "add", label: "Cộng (+)" },
        { value: "sub", label: "Trừ (−)" },
      ],
      onChange: restart,
    },
    { type: "slider", key: "a", label: "Số thứ nhất", min: 0, max: MAX, step: 1, format: v => String(v), visible: s => !practice(s), onChange: restart },
    { type: "slider", key: "b", label: "Số thứ hai", min: 0, max: MAX, step: 1, format: v => String(v), visible: s => !practice(s), onChange: restart },
    {
      type: "select",
      key: "size",
      label: "Phép tính khác dùng số có",
      options: [2, 3, 4].map(value => ({ value, label: `${value} chữ số` })),
    },
    {
      type: "button",
      label: "Phép tính khác",
      event: "new-calculation",
      action: s => {
        Object.assign(s, newQuestion(Math.random, s.op, s.size));
        restart(s);
      },
    },
  ],
  readouts: [
    { label: "Phép tính", value: s => `${nums(s)[0]} ${sign(s)} ${nums(s)[1]} = ${done(s) ? answer(s.a, s.b, s.op) : "?"}` },
    { label: "Số lần nhớ", value: s => (done(s) ? String(carries(cols(s))) : "?") },
    { label: "Số lần viết sai", value: s => (practice(s) ? String(s._mistakes) : "–") },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const [a, b] = nums(s);
    const list = cols(s);
    const k = stepOf(s);
    const t = s._t0 ? clamp((performance.now() - s._t0) / ANIM, 0, 1) : 1;
    // ponytail: own one-shot tween via redraw instead of the kit's play loop, which would add Chạy/Bước buttons
    if (t < 1) requestAnimationFrame(() => api.redraw());
    const wide = w >= 560;
    const small = w < 520 || h < 420;
    const pad = small ? 8 : 16;
    const n = Math.max(2, String(a).length, String(b).length, list ? list.length : 0);
    const textH = small ? 46 : 76;
    const noteH = small ? 13 : 20;
    const sumBox = wide
      ? { x: pad, y: pad, w: Math.min(w * 0.38, 360), h: h - textH - 2 * pad }
      : { x: pad, y: pad / 2, w: w - 2 * pad, h: Math.min(h * 0.4, 190) };
    const textY = wide ? h - textH : sumBox.y + sumBox.h;
    const blockBox = wide
      ? { x: sumBox.x + sumBox.w + pad, y: pad, w: w - sumBox.w - 3 * pad, h: h - textH - noteH - 2 * pad }
      : { x: pad, y: textY + textH, w: w - 2 * pad, h: h - textY - textH - noteH - 2 };

    drawSum(ctx, s, sumBox, n);

    // what to say, and what the blocks did
    const size = small ? 14 : 19;
    const line1 = textY + textH * 0.3;
    const line2 = textY + textH * 0.72;
    if (!list) {
      fit(ctx, `${a} bé hơn ${b}: ở lớp này chưa trừ được.`, w / 2, line1, size, w - 2 * pad, { bold: true, color: COLORS.red });
      fit(ctx, "Em chọn số thứ nhất lớn hơn hoặc bằng số thứ hai nhé.", w / 2, line2, size * 0.85, w - 2 * pad, { color: COLORS.muted });
      return;
    }
    const pic = blocks(a, b, s.op, k);
    const spoken = k > 0 ? `Hàng ${PLACE[list[k - 1].place]}: ${say(list[k - 1], s)}` : "";
    let second;
    let color = COLORS.muted;
    if (done(s)) {
      second = `Vậy ${a} ${sign(s)} ${b} = ${answer(a, b, s.op)}.${practice(s) ? (s._mistakes ? " Em làm xong rồi!" : " Đúng hết, giỏi quá!") : ""}`;
      color = COLORS.green;
    } else if (practice(s)) {
      second = s._wrong >= 0 ? `Chưa phải ${s._wrong}. Em tính lại hàng ${PLACE[list[k].place]} nhé.` : `Hàng ${PLACE[list[k].place]}: em viết chữ số nào? Bấm số ở bên dưới.`;
      if (s._wrong >= 0) color = COLORS.red;
    } else {
      second = k === 0 ? "Bấm “Bước tiếp” để tính hàng đơn vị trước." : blockNote(pic, s) || `Tiếp theo: hàng ${PLACE[list[k].place]}.`;
    }
    if (spoken) fit(ctx, spoken, w / 2, line1, size, w - 2 * pad, { bold: true });
    fit(ctx, second, w / 2, spoken ? line2 : (line1 + line2) / 2, spoken ? size * 0.88 : size, w - 2 * pad, { bold: !spoken || done(s), color });

    if (blockBox.h >= 50) {
      drawBlocks(ctx, s, blockBox, n, t);
      const colours = sub(s) ? "Xanh dương: số bị trừ · gạch chéo: đã lấy đi · xanh lá: hiệu. " : "Xanh dương: số thứ nhất · cam: số thứ hai · xanh lá: nhớ sang và tổng. ";
      const legend = `${small ? "" : colours}Khối vẽ không theo tỉ lệ.`;
      fit(ctx, legend, blockBox.x + blockBox.w / 2, blockBox.y + blockBox.h + noteH / 2 + 1, small ? 10 : 12, blockBox.w, { color: COLORS.muted });
    }
  },
});
