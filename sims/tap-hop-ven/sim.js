import { mount, COLORS, clamp, label } from "../../kit/v1/kit.js";
import { MAX_ELEMS, BITS, PRESETS, presetElems, initialState, sanitize, setCount, OPS, opOf, pick, apply, counts, union2, union3, isSubset, toggle, nextLabel, braces, circles, regionAt, layout, CONTEXTS, surveyOf, newSurvey } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const NAMES = ["A", "B", "C"];
const SET_COLORS = [COLORS.blue, COLORS.red, COLORS.green];
const GLOW = "rgba(245, 197, 24, 0.42)";

/** Centred text that shrinks to fit maxW. */
function fit(ctx, text, x, y, size, maxW, opts = {}) {
  ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, align: opts.align ?? "center", size: w > maxW ? Math.max(9, (size * maxW) / w) : size });
}

/** Break a sentence into lines no wider than maxW. */
function wrap(ctx, text, size, maxW) {
  ctx.font = `${size}px ${FONT}`;
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  return [...lines, line];
}

const explore = s => s.mode === "explore";
const survey = s => s.mode === "survey";
const three = s => explore(s) && setCount(s) === 3;
const selected = s => s.elems[clamp(Math.round(s.sel) || 1, 1, Math.max(1, s.elems.length)) - 1];

/** Where everything is on the canvas in the explore activity (shared by draw and the pointer). */
function scene(s, view) {
  const small = view.w < 520 || view.h < 420;
  const top = small ? 60 : 104;
  const pad = small ? 6 : 20;
  const box = { x: pad, y: top, w: view.w - 2 * pad, h: view.h - top - pad };
  const sets = setCount(s);
  const chip = clamp(Math.min(box.w, box.h) / 15, 10, 24);
  const rings = circles(sets, box);
  // the names sit just outside each circle, on the side away from the others; elements keep clear of them
  const tags = rings.map((c, i) => {
    const a = [(-3 * Math.PI) / 4, -Math.PI / 4, Math.PI / 4][i];
    const d = c.r + (small ? 9 : 14);
    return { x: c.x + d * Math.cos(a), y: c.y + d * Math.sin(a), r: small ? 9 : 13 };
  });
  const corner = { x: box.x + (small ? 10 : 16), y: box.y + (small ? 11 : 16), r: small ? 9 : 13 };
  return { small, box, sets, chip, rings, tags, corner, at: layout(s.elems, sets, box, chip, [...tags, corner]) };
}

/** Fill every region of the diagram whose mask passes `test`. */
function fillRegions(ctx, rings, box, test) {
  for (let m = 0; m < 2 ** rings.length; m++) {
    if (!test(m)) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    rings.forEach((c, i) => {
      ctx.beginPath();
      if (!(m & (1 << i))) ctx.rect(box.x, box.y, box.w, box.h); // outside this circle
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.clip("evenodd");
    });
    ctx.fillStyle = GLOW;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.restore();
  }
}

function drawFrame(ctx, rings, box, small, tags = []) {
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  rings.forEach((c, i) => {
    ctx.strokeStyle = SET_COLORS[i];
    ctx.lineWidth = small ? 2 : 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.stroke();
    if (tags[i]) label(ctx, NAMES[i], tags[i].x, tags[i].y, { align: "center", size: small ? 15 : 22, bold: true, color: SET_COLORS[i] });
  });
}

function place(s, api, index, r) {
  const e = s.elems[index];
  if (!e) return;
  if (e.r !== r) {
    e.r = r;
    s.preset = "tu"; // the sets no longer follow the preset's rule
  }
  api.emit("element-placed", { index: index + 1, region: r, inA: r & 1, inB: (r >> 1) & 1, inC: (r >> 2) & 1 }, "action");
}

const toggleButton = (i, visible) => ({
  type: "button",
  label: `Cho vào / lấy ra khỏi ${NAMES[i]}`,
  visible,
  disabled: s => !selected(s),
  action: (s, api) => {
    const e = selected(s);
    if (e) place(s, api, s.elems.indexOf(e), toggle(e, 1 << i).r);
  },
});

function opPad(box, api) {
  box.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px";
  const buttons = OPS.slice(1).map(op => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = op.label;
    b.style.cssText = "min-height:48px;font-weight:600;padding:4px";
    b.addEventListener("click", () => {
      const s = api.state;
      s.op = opOf(s).code === op.code ? 0 : op.code; // press again to clear
      api.emit("param", { key: "op", value: s.op }, "param");
      if (s.op) api.emit("operation-shown", { operation: op.code, size: apply(s.elems, setCount(s), op.code).length }, "result");
      api.sync();
    });
    box.append(b);
    return b;
  });
  return () => {
    const s = api.state;
    const active = opOf(s).code;
    OPS.slice(1).forEach((op, i) => {
      const b = buttons[i];
      b.hidden = op.sets > setCount(s);
      b.setAttribute("aria-pressed", String(active === op.code));
      b.style.background = active === op.code ? COLORS.yellow : "";
      b.style.borderColor = active === op.code ? COLORS.orange : "";
    });
  };
}

const freshSurvey = s => {
  s.answer = 0;
  s._solved = false;
  s._tries = 0;
  s._note = "";
};

function checkSurvey(s, api) {
  if (s._solved) return;
  const q = surveyOf(s);
  const c = CONTEXTS[q.ctx];
  if (s.answer === q.answer) {
    s._solved = true;
    s._note = "";
    api.emit("survey-solved", { type: q.type, answer: q.answer, wrongTries: s._tries }, "goal");
  } else {
    s._tries += 1;
    s._note = q.type === 2 ? `Chưa đúng. Gợi ý: ${q.a} + ${q.b} lớn hơn ${q.total}; phần thừa ra là các bạn được đếm hai lần.` : `Chưa đúng. Gợi ý: các bạn ${c.verb} cả hai đã được đếm hai lần trong ${q.a} + ${q.b}.`;
    api.emit("wrong-answer", { type: q.type, answer: s.answer }, "action");
  }
}

function problemText(q) {
  const c = CONTEXTS[q.ctx];
  const given = `${q.a} bạn ${c.verb} ${c.a}, ${q.b} bạn ${c.verb} ${c.b}`;
  if (q.type === 0) return `${c.who} ${q.total} ${c.unit}: ${given}, trong đó ${q.both} bạn ${c.verb} cả hai. Hỏi có bao nhiêu bạn ${c.none}?`;
  if (q.type === 1) return `Khảo sát một nhóm bạn: ${given}, trong đó ${q.both} bạn ${c.verb} cả hai. Hỏi có tất cả bao nhiêu bạn ${c.verb} ít nhất một trong hai?`;
  return `${c.who} ${q.total} ${c.unit}, bạn nào cũng ${c.verb} ${c.a} hoặc ${c.b}. Có ${given}. Hỏi có bao nhiêu bạn ${c.verb} cả hai?`;
}

function drawSurvey(ctx, s, view) {
  const { w, h } = view;
  const small = w < 520 || h < 420;
  const q = surveyOf(s);
  const c = CONTEXTS[q.ctx];
  const pad = small ? 6 : 20;
  const size = small ? 12.5 : 18;
  const lines = wrap(ctx, problemText(q), size, w - 2 * pad - 4);
  let y = small ? 12 : 22;
  for (const line of lines) {
    label(ctx, line, pad + 2, y, { size });
    y += size * 1.3;
  }
  const work = [`${q.a} + ${q.b} − ${q.both} = ${q.union};  ${q.total} − ${q.union} = ${q.neither}`, `${q.a} + ${q.b} − ${q.both} = ${q.union}`, `${q.a} + ${q.b} − ${q.total} = ${q.both}`][q.type];
  const status = s._solved ? `Đúng rồi! ${work}` : s._note || "Chọn câu trả lời rồi bấm «Kiểm tra»";
  fit(ctx, status, w / 2, y + 3, small ? 12 : 16, w - 12, { bold: true, color: s._solved ? COLORS.green : s._note ? COLORS.red : COLORS.muted });
  const top = y + (small ? 14 : 22);
  const box = { x: pad, y: top, w: w - 2 * pad, h: h - top - pad };
  const rings = circles(2, { ...box, y: box.y + 20, h: box.h - 34 });
  if (s._solved) fillRegions(ctx, rings, box, [m => m === 0, m => m !== 0, m => m === 3][q.type]);
  drawFrame(ctx, rings, box, small);
  const [a, b] = rings;
  const num = small ? 20 : 30;
  const cap = small ? 12 : 16;
  const show = v => (s._solved ? String(v) : "?");
  fit(ctx, `${c.a}: ${q.a}`, a.x - a.r * 0.3, a.y - a.r - cap * 0.75, cap, a.r * 1.5, { bold: true, color: SET_COLORS[0] });
  fit(ctx, `${c.b}: ${q.b}`, b.x + b.r * 0.3, b.y - b.r - cap * 0.75, cap, b.r * 1.5, { bold: true, color: SET_COLORS[1] });
  label(ctx, show(q.onlyA), a.x - a.r * 0.45, a.y, { align: "center", size: num, bold: true, color: SET_COLORS[0] });
  label(ctx, show(q.onlyB), b.x + b.r * 0.45, b.y, { align: "center", size: num, bold: true, color: SET_COLORS[1] });
  label(ctx, q.type === 2 ? show(q.both) : String(q.both), (a.x + b.x) / 2, a.y, { align: "center", size: num, bold: true, color: COLORS.purple });
  if (!small) label(ctx, "cả hai", (a.x + b.x) / 2, a.y + num * 0.9, { align: "center", size: 13, color: COLORS.purple });
  const by = box.y + box.h - cap * 0.8;
  if (q.type !== 1 || s._solved) label(ctx, `${c.none[0].toUpperCase()}${c.none.slice(1)}: ${q.type === 2 ? 0 : show(q.neither)}`, box.x + 8, by, { size: cap, bold: true });
  if (q.type !== 1) label(ctx, `Tất cả: ${q.total}`, box.x + box.w - 8, by, { size: cap, bold: true, align: "right", color: COLORS.muted });
}

mount({
  slug: "tap-hop-ven",
  version: "1.0.0",
  title: "Tập hợp và biểu đồ Ven",
  hint: "Kéo một phần tử vào vùng em muốn, hoặc chọn phần tử rồi bấm nút. Bấm một phép toán để tô vùng của nó trên biểu đồ.",
  initialState,
  sanitize,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "explore", label: "Tìm hiểu tập hợp" },
        { value: "survey", label: "Giải bài toán khảo sát" },
      ],
      onChange: freshSurvey,
    },
    {
      type: "select",
      key: "sets",
      label: "Số tập hợp",
      visible: explore,
      options: [
        { value: 2, label: "Hai tập hợp A, B" },
        { value: 3, label: "Ba tập hợp A, B, C" },
      ],
      onChange: s => {
        s.op = opOf(s).code;
      },
    },
    {
      type: "select",
      key: "preset",
      label: "Các phần tử",
      visible: explore,
      options: [
        { value: "boi", label: "Số từ 1 đến 12: bội của 2, 3, 4" },
        { value: "uoc", label: "Ước của 12, 18, 30" },
        { value: "chu", label: "Chữ cái của TOAN, TIN, NAM" },
        { value: "tu", label: "Tự xếp (bắt đầu từ U)" },
      ],
      onChange: s => {
        s.elems = presetElems(s.preset);
        s.sel = 1;
      },
    },
    { type: "heading", label: "Tô màu phép toán", visible: explore },
    { type: "custom", render: opPad, visible: explore },
    { type: "heading", label: "Phần tử đang chọn (viền đậm)", visible: explore },
    {
      type: "stepper",
      key: "sel",
      label: "Phần tử thứ",
      min: 1,
      max: MAX_ELEMS,
      visible: explore,
      onChange: s => {
        s.sel = clamp(s.sel, 1, Math.max(1, s.elems.length));
      },
    },
    toggleButton(0, explore),
    toggleButton(1, explore),
    toggleButton(2, three),
    {
      type: "button",
      label: "Thêm một phần tử",
      visible: explore,
      disabled: s => s.elems.length >= MAX_ELEMS,
      action: (s, api) => {
        if (s.elems.length >= MAX_ELEMS) return;
        s.elems.push({ t: nextLabel(s.elems), r: 0 });
        s.sel = s.elems.length;
        s.preset = "tu";
        api.emit("element-added", { count: s.elems.length }, "action");
      },
    },
    {
      type: "button",
      label: "Xoá phần tử đang chọn",
      visible: explore,
      disabled: s => s.elems.length <= 1,
      action: (s, api) => {
        const e = selected(s);
        if (!e || s.elems.length <= 1) return;
        s.elems.splice(s.elems.indexOf(e), 1);
        s.sel = clamp(s.sel, 1, s.elems.length);
        s.preset = "tu";
        api.emit("element-removed", { count: s.elems.length }, "action");
      },
    },
    { type: "slider", key: "answer", label: "Câu trả lời", min: 0, max: 60, step: 1, digits: 0, visible: survey, disabled: s => s._solved },
    { type: "stepper", key: "answer", label: "Chỉnh từng đơn vị", min: 0, max: 60, visible: survey, disabled: s => s._solved },
    { type: "button", label: "Kiểm tra", primary: true, visible: survey, disabled: s => s._solved, action: checkSurvey },
    {
      type: "button",
      label: "Bài khác",
      visible: survey,
      event: "new-survey",
      action: s => {
        Object.assign(s, newSurvey(Math.random, s));
        freshSurvey(s);
      },
    },
  ],
  readouts: [
    { label: "Số phần tử của A", value: s => String(survey(s) ? surveyOf(s).a : counts(s.elems, setCount(s)).A) },
    { label: "Số phần tử của B", value: s => String(survey(s) ? surveyOf(s).b : counts(s.elems, setCount(s)).B) },
    { label: "Số phần tử của A ∩ B", value: s => (survey(s) ? (q => (q.type === 2 && !s._solved ? "?" : String(q.both)))(surveyOf(s)) : String(counts(s.elems, setCount(s)).AB)) },
    { label: "Số phần tử của A ∪ B", value: s => (survey(s) ? (q => (q.type === 2 || s._solved ? String(q.union) : "?"))(surveyOf(s)) : String(apply(s.elems, setCount(s), 1).length)) },
  ],
  pointer: {
    down(p, s, api, view) {
      if (!explore(s)) return false;
      const { at, chip } = scene(s, view);
      let best = -1;
      at.forEach((q, i) => {
        if (Math.hypot(p.x - q.x, p.y - q.y) <= chip * 1.3 && (best < 0 || Math.hypot(p.x - q.x, p.y - q.y) < Math.hypot(p.x - at[best].x, p.y - at[best].y))) best = i;
      });
      if (best < 0) return false;
      s.sel = best + 1;
      s._drag = { i: best, x: p.x, y: p.y, x0: p.x, y0: p.y, moved: false };
    },
    move(p, s) {
      const d = s._drag;
      if (!d) return;
      d.x = p.x;
      d.y = p.y;
      if (Math.hypot(p.x - d.x0, p.y - d.y0) > 5) d.moved = true;
    },
    up(p, s, api, view) {
      const d = s._drag;
      s._drag = null;
      if (!d || !d.moved) return;
      const { rings, box } = scene(s, view);
      const m = regionAt(p.x, p.y, rings, box);
      const e = s.elems[d.i];
      // dropped outside U: the element goes back; with two sets the C membership is kept
      if (m >= 0 && e) place(s, api, d.i, setCount(s) === 3 ? m : (e.r & BITS.C) | m);
    },
  },
  draw(ctx, s, view) {
    if (survey(s)) return drawSurvey(ctx, s, view);
    const { w } = view;
    const { small, box, sets, chip, rings, tags, corner, at } = scene(s, view);
    const op = opOf(s);
    const c = counts(s.elems, sets);
    const result = op.code ? apply(s.elems, sets, op.code) : [];

    // header: the highlighted set, the counting formula, what the sets are
    const [y1, y2, y3] = small ? [13, 31, 47] : [24, 56, 84];
    if (op.code) fit(ctx, `${op.label}${op.code === 5 ? " trong U" : ""} = ${braces(result)}  (${result.length} phần tử)`, w / 2, y1, small ? 15 : 24, w - 12, { bold: true, color: COLORS.ink });
    else fit(ctx, `A = ${braces(pick(s.elems, sets, m => m & 1))}   B = ${braces(pick(s.elems, sets, m => m & 2))}`, w / 2, y1, small ? 14 : 22, w - 12, { bold: true });
    const formula =
      sets === 3
        ? `n(A ∪ B ∪ C) = ${c.A} + ${c.B} + ${c.C} − ${c.AB} − ${c.AC} − ${c.BC} + ${c.ABC} = ${union3(c.A, c.B, c.C, c.AB, c.AC, c.BC, c.ABC)}`
        : `n(A ∪ B) = n(A) + n(B) − n(A ∩ B) = ${c.A} + ${c.B} − ${c.AB} = ${union2(c.A, c.B, c.AB)}`;
    fit(ctx, formula, w / 2, y2, small ? 12.5 : 18, w - 12, { bold: true, color: COLORS.purple });
    const names = PRESETS[s.preset]?.names ?? [];
    const legend = names[0] ? NAMES.slice(0, sets).map((n, i) => `${n}: ${names[i]}`).join("  ·  ") : sets === 3 && !small ? "n(A ∪ B ∪ C) = n(A) + n(B) + n(C) − n(A ∩ B) − n(A ∩ C) − n(B ∩ C) + n(A ∩ B ∩ C)" : "n(A) là số phần tử của tập hợp A";
    fit(ctx, legend, w / 2, y3, small ? 11 : 14, w - 12, { color: COLORS.muted });

    // the diagram
    if (op.code) fillRegions(ctx, rings, box, op.test);
    drawFrame(ctx, rings, box, small, tags);
    label(ctx, "U", corner.x, corner.y, { align: "center", size: small ? 14 : 20, bold: true, color: COLORS.muted });

    // relations worth noticing: empty sets, subsets, disjoint sets
    const notes = [];
    const size = [c.A, c.B, c.C];
    for (let i = 0; i < sets; i++) if (!size[i]) notes.push(`${NAMES[i]} = ∅`);
    for (let i = 0; i < sets; i++)
      for (let j = 0; j < sets; j++) {
        if (i === j || !size[i] || !size[j]) continue;
        const sub = isSubset(s.elems, 1 << i, 1 << j);
        const back = isSubset(s.elems, 1 << j, 1 << i);
        if (sub && back) i < j && notes.push(`${NAMES[i]} = ${NAMES[j]}`);
        else if (sub) notes.push(`${NAMES[i]} ⊂ ${NAMES[j]}`);
        else if (i < j && !s.elems.some(e => (e.r & (1 << i)) && (e.r & (1 << j)))) notes.push(`${NAMES[i]} ∩ ${NAMES[j]} = ∅`);
      }
    if (notes.length) label(ctx, notes.slice(0, 3).join("   "), box.x + box.w - 8, box.y + box.h - (small ? 9 : 14), { align: "right", size: small ? 12 : 16, bold: true, color: COLORS.green });

    // the elements
    const lit = new Set(result);
    const sel = selected(s);
    const r = chip * 0.82;
    s.elems.forEach((e, i) => {
      const drag = s._drag?.i === i && s._drag.moved;
      const p = drag ? s._drag : at[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = lit.has(e.t) ? COLORS.yellow : "#fff";
      ctx.globalAlpha = drag ? 0.85 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = e === sel ? COLORS.ink : COLORS.muted;
      ctx.lineWidth = e === sel ? 3 : 1;
      ctx.stroke();
      label(ctx, e.t, p.x, p.y + 0.5, { align: "center", size: e.t.length > 2 ? r * 0.8 : e.t.length > 1 ? r * 0.95 : r * 1.15, bold: true });
    });
  },
});
