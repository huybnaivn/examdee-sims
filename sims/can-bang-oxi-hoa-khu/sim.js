import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import {
  REACTIONS, STEPS, LAST_STEP, MAX_COEF, initialState, reactionById, reactionIndex, analyze, pretty, pieces, onText, onSup, subscript,
  clearPractice, checkStep, learnerCoeffs, tally, sanitize,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'; // same as kit label()
const width = (ctx, text, size, bold = true) => {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  return ctx.measureText(text).width;
};
/** label() that shrinks the font until the text fits in maxW; returns the size used. */
const fit = (ctx, text, x, y, maxW, opts) => {
  const tw = width(ctx, text, opts.size, opts.bold);
  const size = tw > maxW ? (opts.size * maxW) / tw : opts.size;
  label(ctx, text, x, y, { ...opts, size });
  return size;
};

const OX = COLORS.green; // element whose oxidation number rises (is oxidised)
const RED = COLORS.red; // element whose oxidation number falls (is reduced)
const ASK = COLORS.orange; // the learner's own input, not yet checked

const practice = s => s.mode === "practice";
// What the canvas reveals: in practice a step's content appears once it has been checked.
const revealed = (s, k) => (!practice(s) ? s.step >= k : s.step > k || (k === 5 && s.step >= 5) || (k === LAST_STEP && s.solved));
const asking = (s, k) => practice(s) && s.step === k && !revealed(s, k);

function halfText(A, h, e) {
  const from = A.species[h.from];
  const to = A.species[h.to];
  const side = (sp, on) => (sp.simple && h.k > 1 ? `${h.el}${subscript(h.k)}${onSup(on)}` : `${h.k > 1 ? h.k : ""}${h.el}${onSup(on)}`);
  return h.ox ? `${side(from, h.a)} → ${side(to, h.b)} + ${e}e` : `${side(from, h.a)} + ${e}e → ${side(to, h.b)}`;
}

function shownCoeffs(s, r, A) {
  if (revealed(s, LAST_STEP)) return { c: r.coeffs, color: i => (A.partial[i] !== null ? COLORS.blue : COLORS.purple) };
  if (asking(s, LAST_STEP)) return { c: learnerCoeffs(s), color: () => ASK };
  if (revealed(s, 5)) return { c: A.partial, color: () => COLORS.blue };
  return { c: A.partial.map(() => null), color: () => COLORS.ink };
}

// Equation with oxidation numbers above the symbols; one line, or reactants / products on two lines.
function drawEquation(ctx, s, r, A, x0, y0, maxW, maxSize) {
  const { c, color } = shownCoeffs(s, r, A);
  const n = A.species.length;
  const nL = r.left.length;
  const items = A.species.map((sp, i) => ({ i, coef: c[i] && c[i] !== 1 ? String(c[i]) : "", parts: pieces(sp.text) }));
  const sep = i => (i === 0 || i === nL ? "" : " + ");
  const itemW = (it, size) => width(ctx, it.coef, size) + it.parts.reduce((w, p) => w + width(ctx, p.text, size), 0);
  const lineW = (list, size, arrowAtEnd) =>
    list.reduce((w, it) => w + width(ctx, sep(it.i), size) + itemW(it, size), 0) + (arrowAtEnd ? width(ctx, " → ", size) : 0);
  const one = lineW(items, 100, true) / 100; // per unit font size, arrow counted once
  let lines = [items];
  let size = Math.min(maxSize, maxW / one);
  if (size < maxSize * 0.72) {
    const two = Math.max(lineW(items.slice(0, nL), 100, true), lineW(items.slice(nL), 100, false)) / 100;
    if (maxW / two > size) {
      lines = [items.slice(0, nL), items.slice(nL)];
      size = Math.min(maxSize, maxW / two);
    }
  }
  const showOn = revealed(s, 1) || asking(s, 1);
  const showRole = revealed(s, 2);
  const lineH = size * (showOn ? 1.6 : 1.1) + (showRole ? size * 0.7 : 0);
  const asked = new Map(); // "speciesIndex:element" → learner key
  if (asking(s, 1)) A.halves.forEach((h, j) => {
    asked.set(`${h.from}:${h.el}`, `p${2 * j + 1}`);
    asked.set(`${h.to}:${h.el}`, `p${2 * j + 2}`);
  });
  // colour an oxidation number only where it is the one that changes
  const roleOf = (i, el) => {
    if (!revealed(s, 2)) return null;
    const sp = A.species[i];
    const h = A.halves.find(q => q.el === el && sp.on[el] === (sp.left ? q.a : q.b));
    return h ? (h.ox ? OX : RED) : null;
  };
  const roles = [];
  lines.forEach((list, li) => {
    const total = lineW(list, size, li === 0);
    let x = x0 + (maxW - total) / 2;
    const y = y0 + li * lineH + (showOn ? size * 1.15 : size * 0.55);
    list.forEach(it => {
      const draw = (text, col) => {
        if (!text) return;
        label(ctx, text, x, y, { size, bold: true, color: col });
        x += width(ctx, text, size);
      };
      draw(sep(it.i), COLORS.muted);
      if (it.i === nL) draw(lines.length === 1 ? " → " : "", COLORS.muted);
      draw(it.coef, color(it.i));
      const start = x;
      for (const p of it.parts) {
        const pw = width(ctx, p.text, size);
        if (p.el && showOn) {
          const key = asked.get(`${it.i}:${p.el}`);
          const value = key ? onText(s[key]) : onText(A.species[it.i].on[p.el]);
          const col = key ? ASK : roleOf(it.i, p.el) ?? COLORS.muted;
          label(ctx, value, x + pw / 2, y - size * 0.82, { size: size * 0.52, bold: !!key || col !== COLORS.muted, color: col, align: "center" });
        }
        draw(p.text, COLORS.ink);
      }
      if (showRole && (it.i === A.reducer || it.i === A.oxidiser)) {
        const red = it.i === A.reducer;
        const text = red ? "chất khử" : "chất oxi hóa";
        const rs = Math.max(10, size * 0.45);
        roles.push({ text, rs, y: y + size * 0.78, cx: (start + x) / 2, tw: width(ctx, text, rs), color: red ? OX : RED });
      }
    });
    if (li === 0 && lines.length === 2) draw2(ctx, " →", x, y, size);
  });
  // role tags under neighbouring species must not run into each other
  roles.sort((p, q) => p.y - q.y || p.cx - q.cx).forEach((t, i) => {
    let left = t.cx - t.tw / 2;
    const prev = roles[i - 1];
    if (prev && prev.y === t.y) left = Math.max(left, prev.left + prev.tw + 8);
    t.left = left;
    label(ctx, t.text, left, t.y, { size: t.rs, bold: true, color: t.color });
  });
  return y0 + lines.length * lineH;
}
const draw2 = (ctx, text, x, y, size) => label(ctx, text, x, y, { size, bold: true, color: COLORS.muted });

mount({
  slug: "can-bang-oxi-hoa-khu",
  version: "1.0.0",
  title: "Cân bằng phản ứng oxi hóa – khử",
  hint: "Chọn phản ứng rồi bấm “Bước tiếp” để xem cân bằng bằng phương pháp thăng bằng electron, hoặc chọn “Tự luyện” để tự làm từng bước.",
  initialState,
  sanitize,
  controls: [
    {
      type: "select",
      key: "reaction",
      label: "Phản ứng",
      options: REACTIONS.map(r => ({ value: r.id, label: `${[r.left, r.right].map(side => side.map(pretty).join(" + ")).join(" → ")}` })),
      onChange: s => clearPractice(s),
    },
    {
      type: "select",
      key: "mode",
      label: "Chế độ",
      options: [
        { value: "demo", label: "Xem lời giải từng bước" },
        { value: "practice", label: "Tự luyện từng bước" },
      ],
      onChange: s => clearPractice(s),
    },
    {
      type: "custom",
      // Practice inputs depend on the reaction and the step, so the labels are built here (kit stepper labels are fixed).
      render(box, api) {
        let sig = "";
        let outs = [];
        const numRow = (key, text, min, max) => {
          const row = document.createElement("div");
          row.className = "row stepper";
          const name = document.createElement("span");
          name.textContent = text;
          const out = document.createElement("output");
          const btn = (t, d) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = t;
            b.setAttribute("aria-label", `${text} ${t}`);
            b.addEventListener("click", () => {
              const s = api.state;
              s[key] = clamp(s[key] + d, min, max);
              s._msg = "";
              api.emit("param", { key, value: s[key] }, "param");
              api.sync();
            });
            return b;
          };
          row.append(name, btn("−", -1), out, btn("+", 1));
          box.append(row);
          outs.push(() => (out.textContent = key.startsWith("p") && key.length === 2 ? onText(api.state[key]) : String(api.state[key])));
        };
        const chips = (key, text, A) => {
          const head = document.createElement("span");
          head.textContent = text;
          const row = document.createElement("div");
          row.style.cssText = "display:flex;flex-wrap:wrap;gap:6px";
          A.species.forEach((sp, i) => {
            if (!sp.left) return;
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = pretty(sp.text);
            b.addEventListener("click", () => {
              api.state[key] = i;
              api.state._msg = "";
              api.emit("param", { key, value: i }, "param");
              api.sync();
            });
            row.append(b);
            outs.push(() => (b.className = api.state[key] === i ? "primary" : ""));
          });
          box.append(head, row);
        };
        return () => {
          const s = api.state;
          const r = reactionById(s.reaction);
          const A = analyze(r);
          const now = `${s.reaction}|${s.mode}|${s.step}|${s.solved}`;
          if (now !== sig) {
            sig = now;
            outs = [];
            box.replaceChildren();
            const ask = practice(s) && !s.solved;
            const [h1, h2] = A.halves;
            const sp = i => pretty(A.species[i].text);
            if (ask && s.step === 1) {
              const head = document.createElement("h2");
              head.textContent = "Số oxi hóa";
              box.append(head);
              [h1, h2].forEach((h, j) => {
                numRow(`p${2 * j + 1}`, `${h.el} trong ${sp(h.from)}`, -4, 8);
                numRow(`p${2 * j + 2}`, `${h.el} trong ${sp(h.to)}`, -4, 8);
              });
            } else if (ask && s.step === 2) {
              chips("pRed", "Chất khử là:", A);
              chips("pOx", "Chất oxi hóa là:", A);
            } else if (ask && s.step === 3) {
              const head = document.createElement("h2");
              head.textContent = "Số electron nhường / nhận";
              box.append(head);
              [h1, h2].forEach((h, j) => numRow(`pe${j + 1}`, `${h.el}${onSup(h.a)} → ${h.el}${onSup(h.b)}`, 1, 12));
            } else if (ask && s.step === 4) {
              const head = document.createElement("h2");
              head.textContent = "Nhân mỗi quá trình với";
              box.append(head);
              [h1, h2].forEach((h, j) => numRow(`pm${j + 1}`, `Quá trình ${h.ox ? "oxi hóa" : "khử"} (${h.el})`, 1, 12));
            } else if (ask && s.step === LAST_STEP) {
              const head = document.createElement("h2");
              head.textContent = "Hệ số";
              box.append(head);
              A.species.forEach((_, i) => numRow(`c${i + 1}`, sp(i), 1, MAX_COEF));
            }
            box.hidden = !box.childElementCount;
          }
          for (const f of outs) f();
        };
      },
    },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: s => practice(s) && !s.solved && [1, 2, 3, 4, LAST_STEP].includes(s.step),
      action(s, api) {
        const r = reactionById(s.reaction);
        const { ok, msg } = checkStep(s);
        s._msg = msg;
        s._ok = ok;
        const done = s.step;
        if (!ok) s.mistakes++;
        else if (s.step === LAST_STEP) s.solved = true;
        else {
          s.step++;
          if (s.step === LAST_STEP) analyze(r).partial.forEach((c, i) => (s[`c${i + 1}`] = c ?? 1));
        }
        api.emit("step", { step: done, practice: 1, correct: ok ? 1 : 0 }, "action");
        if (ok && done === LAST_STEP) {
          api.emit("balanced", { reaction: reactionIndex(s.reaction), electrons: analyze(r).electrons }, "result");
          api.emit("practice-solved", { reaction: reactionIndex(s.reaction), mistakes: s.mistakes }, "goal");
        }
      },
    },
    {
      type: "button",
      label: "Bước tiếp ▶",
      primary: true,
      visible: s => !practice(s) || s.step === 0 || s.step === 5,
      disabled: s => s.step >= LAST_STEP,
      action(s, api) {
        if (s.step >= LAST_STEP) return;
        s.step++;
        s._msg = "";
        if (practice(s) && s.step === LAST_STEP) analyze(reactionById(s.reaction)).partial.forEach((c, i) => (s[`c${i + 1}`] = c ?? 1));
        api.emit("step", { step: s.step, practice: practice(s) ? 1 : 0, correct: 1 }, "action");
        if (!practice(s) && s.step === LAST_STEP) {
          api.emit("balanced", { reaction: reactionIndex(s.reaction), electrons: analyze(reactionById(s.reaction)).electrons }, "result");
        }
      },
    },
    {
      type: "button",
      label: "◀ Bước trước",
      visible: s => !practice(s),
      disabled: s => s.step <= 0,
      action(s, api) {
        if (s.step <= 0) return;
        s.step--;
        api.emit("step", { step: s.step, practice: 0, correct: 1 }, "action");
      },
    },
  ],
  readouts: [
    { label: "Bước", value: s => `${s.step} / ${LAST_STEP}` },
    {
      label: "Số electron trao đổi",
      value: s => (revealed(s, 4) ? `${analyze(reactionById(s.reaction)).electrons} e` : "–"),
    },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const r = reactionById(s.reaction);
    const A = analyze(r);
    const pad = 12;
    const small = w < 520 || h < 400;
    const base = clamp(Math.min(w / 55, h / 34), 11, 15);
    const maxW = w - 2 * pad;

    // step title and reaction name
    let y = small ? 13 : 20;
    fit(ctx, s.solved ? "✓ Đã cân bằng xong" : STEPS[s.step], w / 2, y, maxW, { size: base + 2, bold: true, align: "center", color: s.solved ? COLORS.green : COLORS.ink });
    y += small ? 16 : 22;
    fit(ctx, `${r.name}${practice(s) ? " · tự luyện" : ""}`, w / 2, y, maxW, { size: base - 1, align: "center", color: COLORS.muted });
    y += small ? 8 : 14;

    // equation
    y = drawEquation(ctx, s, r, A, pad, y, maxW, clamp(Math.min(w / 16, h / 10), 18, 40)) + (small ? 4 : 14);

    // the rules, while oxidation numbers are being assigned
    if (s.step === 1 && !s.solved) {
      const rules = [
        "Đơn chất: 0 · Ion đơn nguyên tử: bằng điện tích ion",
        "Trong hợp chất: H +1, O −2, kim loại kiềm +1, kiềm thổ +2, Al +3",
        "Tổng số oxi hóa: bằng 0 trong phân tử, bằng điện tích trong ion",
      ];
      const size = base;
      if (y + rules.length * (size + 8) + 20 < h - 40) {
        label(ctx, "Quy tắc xác định số oxi hóa", w / 2, y + 4, { size, bold: true, align: "center", color: COLORS.muted });
        y += size + 8;
        for (const t of rules) {
          fit(ctx, t, w / 2, y + 4, maxW, { size, align: "center", color: COLORS.muted });
          y += size + 8;
        }
      }
    }

    // half-processes
    const show3 = revealed(s, 3) || asking(s, 3);
    if (show3 || asking(s, 4)) {
      const size = clamp(Math.min(w / 30, h / 20), 13, 22);
      A.halves.forEach((hf, j) => {
        const e = asking(s, 3) ? s[`pe${j + 1}`] : hf.e;
        const mult = revealed(s, 4) ? `${hf.mult} × ` : asking(s, 4) ? `${s[`pm${j + 1}`]} × ` : "";
        const tag = hf.ox ? "Quá trình oxi hóa:" : "Quá trình khử:";
        const body = `${mult}${halfText(A, hf, e)}`;
        const col = hf.ox ? OX : RED;
        const tagW = Math.min(width(ctx, tag, base, false) + 8, maxW * 0.42);
        fit(ctx, tag, pad, y + size / 2, tagW - 4, { size: base, color: col });
        fit(ctx, body, pad + tagW, y + size / 2, maxW - tagW, { size, bold: true, color: asking(s, 3) || asking(s, 4) ? ASK : COLORS.ink });
        y += size + (small ? 6 : 10);
      });
      if (revealed(s, 4)) {
        const [p, q] = A.halves;
        fit(ctx, `BCNN(${p.e}; ${q.e}) = ${A.electrons}  ⇒  tổng số electron nhường = tổng số electron nhận = ${A.electrons}`, w / 2, y + 6, maxW, { size: base, align: "center", color: COLORS.muted });
        y += small ? 18 : 26;
      }
    }

    // atom and charge check
    if (revealed(s, LAST_STEP) || asking(s, LAST_STEP)) {
      const c = revealed(s, LAST_STEP) ? r.coeffs : learnerCoeffs(s);
      const { left, right } = tally(r, c);
      const parts = Object.keys(left.atoms).map(el => [el, left.atoms[el], right.atoms[el]]);
      if (r.left.some(t => t.includes("^"))) parts.push(["điện tích", left.charge, right.charge]);
      const texts = parts.map(([el, a, b]) => ({ text: `${el}: ${a} ${a === b ? "=" : "≠"} ${b}`, ok: a === b }));
      const size = base;
      const gap = 14;
      const rows = [[]];
      let used = 0;
      for (const t of texts) {
        const tw = width(ctx, t.text, size) + gap;
        if (used + tw > maxW && rows.at(-1).length) rows.push([]), (used = 0);
        rows.at(-1).push({ ...t, tw });
        used += tw;
      }
      label(ctx, "Số nguyên tử vế trái : vế phải", w / 2, y + 4, { size: base - 1, align: "center", color: COLORS.muted });
      y += size + 4;
      for (const row of rows) {
        let x = (w - row.reduce((a, t) => a + t.tw, 0) + gap) / 2;
        for (const t of row) {
          label(ctx, t.text, x, y + 4, { size, bold: true, color: t.ok ? COLORS.green : COLORS.red });
          x += t.tw;
        }
        y += size + 6;
      }
    }

    // feedback and convention note at the bottom
    const coefNote = revealed(s, 5) && !asking(s, LAST_STEP) ? (revealed(s, LAST_STEP) ? " · hệ số xanh dương: từ thăng bằng electron, tím: cân bằng thêm" : " · hệ số xanh dương: từ thăng bằng electron") : "";
    const note = (small ? "Số trên kí hiệu: số oxi hóa · e: electron" : "Số ghi trên kí hiệu nguyên tố là số oxi hóa · e: electron · xanh lá: tăng, đỏ: giảm") + coefNote;
    fit(ctx, note, w / 2, h - 9, maxW, { size: base - 2, align: "center", color: COLORS.muted });
    if (s._msg) {
      fit(ctx, s._msg, w / 2, Math.max(y + 10, h - 30), maxW, { size: base, align: "center", bold: true, color: s._ok ? COLORS.green : COLORS.red });
    }
  },
});
