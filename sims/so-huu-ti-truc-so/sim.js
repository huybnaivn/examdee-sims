import { mount, COLORS, arrow, label } from "../../kit/v1/kit.js";
import {
  P_MAX, Q_MAX, initialState, numbers, reduce, compare, lcm, snap, primeFactors, decimal, decimalText, fromDecimal,
  lineRange, setAt, parseOrder, swap, isOrdered, nextSet,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const minus = n => (n < 0 ? `−${-n}` : `${n}`);
/** A piece of a text row: a whole number as text, anything else as a stacked fraction. */
const F = (p, q) => (q === 1 ? minus(p) : { n: `${Math.abs(p)}`, d: `${q}`, neg: p < 0 });
const inline = (p, q) => (q === 1 ? minus(p) : `${minus(p)}/${q}`);
const SIGN = { "-1": "<", 0: "=", 1: ">" };
const solvedCount = s => Math.max(0, Math.round(s.solved) || 0);

/** One centred row of text pieces and stacked fractions; shrinks to fit maxW. */
function row(ctx, items, cx, y, { size = 14, color = COLORS.ink, bold = false, maxW = Infinity, align = "center" } = {}) {
  ctx.save();
  const widths = sz => {
    ctx.font = `${bold ? "600 " : ""}${sz}px ${FONT}`;
    return items.map(it =>
      it === "|" ? sz * 0.5 : typeof it === "string" ? ctx.measureText(it).width : Math.max(ctx.measureText(it.n).width, ctx.measureText(it.d).width) + sz * 0.4 + (it.neg ? ctx.measureText("−").width + 2 : 0)
    );
  };
  const sum = w => w.reduce((a, b) => a + b, 0);
  let w = widths(size);
  if (sum(w) > maxW) {
    size = Math.max(9, (size * maxW) / sum(w));
    w = widths(size);
  }
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(1, size / 12);
  let x = align === "right" ? cx - sum(w) : cx - sum(w) / 2;
  items.forEach((it, i) => {
    ctx.textAlign = "left";
    if (it === "|") {
      // absolute-value bar, as tall as a stacked fraction
      ctx.beginPath();
      ctx.moveTo(x + w[i] / 2, y - size * 1.2);
      ctx.lineTo(x + w[i] / 2, y + size * 1.3);
      ctx.stroke();
    } else if (typeof it === "string") {
      ctx.fillText(it, x, y);
    } else {
      let fx = x;
      if (it.neg) {
        ctx.fillText("−", x, y);
        fx += ctx.measureText("−").width + 2;
      }
      const fw = x + w[i] - fx;
      ctx.textAlign = "center";
      ctx.fillText(it.n, fx + fw / 2, y - size * 0.62);
      ctx.fillText(it.d, fx + fw / 2, y + size * 0.7);
      ctx.beginPath();
      ctx.moveTo(fx + 1, y);
      ctx.lineTo(fx + fw - 1, y);
      ctx.stroke();
    }
    x += w[i];
  });
  ctx.restore();
}

function dot(ctx, x, y, r, color, hollow) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = hollow ? "#fff" : color;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(s, view) {
  const small = view.w < 520 || view.h < 400;
  const { a, b } = numbers(s);
  const set = setAt(s.setIndex);
  const order = s.mode === "order";
  const two = s.mode === "compare";
  const values = order ? set.map(([p, q]) => p / q) : two ? [a[0] / a[1], b[0] / b[1]] : [a[0] / a[1]];
  const M = lineRange(values);
  const pad = small ? 18 : 52;
  // ordering zooms in on the whole numbers around the set; otherwise the line is symmetric about 0
  const lo = order ? Math.floor(Math.min(...values)) : -M;
  const hi = order ? Math.ceil(Math.max(...values)) : M;
  const unit = (view.w - 2 * pad) / (hi - lo);
  const X = v => pad + (v - lo) * unit;
  const third = !order && !small && view.h >= 500; // room for a third line of text
  // cards (ordering)
  const gap = small ? 20 : 26;
  const cw = Math.min(150, (view.w - 2 * pad - 3 * gap) / 4);
  const ch = small ? 58 : 92;
  const cy = small ? 50 : 96;
  const cx0 = (view.w - 4 * cw - 3 * gap) / 2;
  const cards = [0, 1, 2, 3].map(k => ({ x: cx0 + k * (cw + gap), y: cy, w: cw, h: ch }));
  const top = order ? cy + ch : small ? 68 : third ? 150 : 110;
  const above = order ? (small ? 126 : 150) : small ? 54 : 70;
  const below = order ? 34 : two ? (small ? 86 : 104) : s.showOpposite ? (small ? 110 : 132) : small ? 62 : 74;
  const y = top + above + Math.max(0, (view.h - top - above - below) / 2);
  return { small, a, b, set, order, two, lo, hi, pad, unit, X, y, cards, third };
}

function drawAxis(ctx, g, view, subs) {
  const { X, y, lo, hi, unit, small } = g;
  arrow(ctx, X(lo) - g.pad * 0.6, y, X(hi) + g.pad * 0.7, y, COLORS.ink, 2);
  // equal parts of every unit segment: [parts, colour, side] with side −1 above, 1 below, 0 both
  for (const [q, color, side] of subs) {
    if (unit / q < 3) continue;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = lo * q; k <= hi * q; k++) {
      if (k % q === 0) continue;
      ctx.moveTo(X(k / q), y - (side <= 0 ? 7 : 0));
      ctx.lineTo(X(k / q), y + (side >= 0 ? 7 : 0));
    }
    ctx.stroke();
  }
  const every = unit < 16 ? 5 : unit < 26 ? 2 : 1;
  ctx.strokeStyle = COLORS.ink;
  for (let n = lo; n <= hi; n++) {
    ctx.lineWidth = n === 0 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(X(n), y - 11);
    ctx.lineTo(X(n), y + 11);
    ctx.stroke();
    if (n % every === 0) label(ctx, minus(n), X(n), y + 21, { size: small ? 11 : 13, align: "center", color: COLORS.muted, bold: n === 0 });
  }
}

function drawExplore(ctx, s, g, view) {
  const { X, y, small, a } = g;
  const [p, q] = a;
  const [rp, rq] = reduce(p, q);
  const size = small ? 11.5 : 14;
  const maxW = view.w - 28;
  const d = decimal(p, q);
  const text = decimalText(p, q);

  // fraction = reduced fraction = decimal
  const head = [F(p, q), "  =  "];
  if (rq !== q) head.push(F(rp, rq), "  =  ");
  if (rq !== 1) head.push(text);
  else if (rq === q) head.splice(1); // a whole number written as itself
  else head.pop();
  row(ctx, head, view.w / 2, small ? 24 : 40, { size: small ? 17 : 26, bold: true, maxW });

  const factors = primeFactors(rq);
  const den = factors.length > 1 ? `mẫu ${rq} = ${factors.join(" · ")}` : `mẫu ${rq}`;
  const bad = [...new Set(factors.filter(f => f !== 2 && f !== 5))].join(", ");
  const kind =
    rq === 1
      ? "Số nguyên cũng là số hữu tỉ (viết được với mẫu số 1)."
      : d.rep
        ? `${small ? "Vô hạn tuần hoàn" : "Số thập phân vô hạn tuần hoàn"}, chu kì ${d.rep}: ${den} có ước nguyên tố ${bad}${small ? "" : " (khác 2 và 5)"}.`
        : `${small ? "Hữu hạn" : "Số thập phân hữu hạn"}: ${den} không có ước nguyên tố ${small ? "" : "nào "}khác 2 và 5.`;
  row(ctx, [kind], view.w / 2, small ? 54 : 90, { size, color: d.rep ? COLORS.orange : COLORS.green, bold: true, maxW });

  if (g.third && rq !== 1) {
    // back from the decimal to the fraction, as done by hand
    const f = fromDecimal(d);
    const back = [`Đổi ngược lại:  ${text}  =  `, { n: d.rep ? `${f.all} − ${f.minus}` : `${Math.abs(f.num)}`, d: `${f.den}`, neg: d.negative }];
    if (f.den !== rq) back.push("  =  ", F(rp, rq));
    row(ctx, back, view.w / 2, 128, { size, color: COLORS.muted, maxW });
  }

  drawAxis(ctx, g, view, [[q, COLORS.blue, 0]]);
  // the |p| parts counted from 0
  ctx.strokeStyle = "rgba(47, 111, 237, 0.4)";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(X(0), y);
  ctx.lineTo(X(p / q), y);
  ctx.stroke();

  const xa = X(p / q);
  const xo = X(-p / q);
  if (s.showOpposite && p !== 0) {
    const near = Math.abs(xa - xo) < (small ? 44 : 56);
    dot(ctx, xo, y, small ? 6 : 7, COLORS.purple, true);
    row(ctx, [F(-p, q)], xo, y - (small ? 32 : 38) - (near ? (small ? 30 : 36) : 0), { size: small ? 12 : 15, color: COLORS.purple, bold: true });
    // equal distances to 0
    const yb = y + (small ? 36 : 40);
    const reach = Math.max(Math.abs(xa - X(0)) / 2, small ? 16 : 20);
    for (const [x, color, dir] of [[xa, COLORS.blue, Math.sign(p)], [xo, COLORS.purple, -Math.sign(p)]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X(0), yb - 5);
      ctx.lineTo(X(0), yb + 5);
      ctx.moveTo(X(0), yb);
      ctx.lineTo(x, yb);
      ctx.moveTo(x, yb - 5);
      ctx.lineTo(x, yb + 5);
      ctx.stroke();
      row(ctx, [F(Math.abs(p), q)], X(0) + dir * reach, yb + (small ? 19 : 22), { size: small ? 11 : 13, color });
    }
  }
  dot(ctx, xa, y, small ? 7 : 9, COLORS.blue);
  row(ctx, [F(p, q)], xa, y - (small ? 32 : 38), { size: small ? 12 : 15, color: COLORS.blue, bold: true });

  let ty = y + (s.showOpposite ? (small ? 80 : 94) : small ? 42 : 50);
  const count = p === 0 ? "điểm 0 biểu diễn số 0." : `từ 0 đếm ${Math.abs(p)} phần sang ${p > 0 ? "phải" : "trái"}.`;
  const cut = q === 1 ? "Mỗi đoạn đơn vị là 1 phần; " : `Chia mỗi đoạn đơn vị thành ${q} phần bằng nhau; `;
  row(ctx, [cut + count], view.w / 2, ty, { size, color: COLORS.muted, maxW });
  if (s.showOpposite) {
    ty += small ? 22 : 28;
    const line = small
      ? ["Số đối của ", F(p, q), " là ", F(-p, q), ";   ", "|", F(p, q), "|", " = ", "|", F(-p, q), "|", " = ", F(Math.abs(p), q)]
      : ["Số đối của ", F(p, q), " là ", F(-p, q), ".   Khoảng cách đến điểm 0:  ", "|", F(p, q), "|", " = ", "|", F(-p, q), "|", " = ", F(Math.abs(p), q)];
    row(ctx, line, view.w / 2, ty, { size, maxW });
  }
}

function drawCompare(ctx, s, g, view) {
  const { X, y, small, a, b } = g;
  const size = small ? 11.5 : 14;
  const maxW = view.w - 28;
  const c = compare(a[0], a[1], b[0], b[1]);
  row(ctx, [F(...a), `  ${SIGN[c]}  `, F(...b)], view.w / 2, small ? 24 : 40, { size: small ? 17 : 26, bold: true, maxW });
  const k = lcm(a[1], b[1]);
  const na = a[0] * (k / a[1]);
  const nb = b[0] * (k / b[1]);
  const why =
    a[1] === b[1]
      ? [`Cùng mẫu dương ${k}: so sánh hai tử số,  ${minus(na)} ${SIGN[c]} ${minus(nb)}.`]
      : ["Quy đồng mẫu dương:  ", F(...a), ...(a[1] === k ? [] : [" = ", F(na, k)]), ",   ", F(...b), ...(b[1] === k ? [] : [" = ", F(nb, k)]), `;   ${minus(na)} ${SIGN[c]} ${minus(nb)}.`];
  row(ctx, why, view.w / 2, small ? 54 : 90, { size, color: COLORS.muted, maxW });

  drawAxis(ctx, g, view, [[a[1], COLORS.blue, -1], [b[1], COLORS.orange, 1]]);
  const xa = X(a[0] / a[1]);
  const xb = X(b[0] / b[1]);
  dot(ctx, xa, y, small ? 7 : 9, COLORS.blue);
  row(ctx, [F(...a)], xa, y - (small ? 32 : 38), { size: small ? 12 : 15, color: COLORS.blue, bold: true });
  dot(ctx, xb, y, small ? 5 : 6, COLORS.orange);
  row(ctx, [F(...b)], xb, y + (small ? 48 : 54), { size: small ? 12 : 15, color: COLORS.orange, bold: true });
  const where = c === 0 ? "Hai số bằng nhau: cùng một điểm trên trục số." : "Trên trục số, điểm biểu diễn số nhỏ hơn nằm bên trái.";
  row(ctx, [where], view.w / 2, y + (small ? 76 : 92), { size, color: COLORS.muted, maxW });
}

const cardItem = ([p, q, form]) => (form === "d" ? decimalText(p, q) : F(p, q));

function drawOrder(ctx, s, g, view) {
  const { X, y, small, set, cards } = g;
  const ids = parseOrder(s.order);
  const right = s.status === "right";
  const size = small ? 11.5 : 14;
  label(ctx, "Sắp xếp các số theo thứ tự tăng dần (từ bé đến lớn)", view.w / 2, small ? 14 : 30, { size: small ? 13 : 18, align: "center", bold: true });
  const note = right
    ? ["Đúng rồi! Trên trục số, số bé hơn nằm bên trái.", COLORS.green]
    : s.status === "wrong"
      ? ["Chưa đúng. Hãy đổi các số về cùng một dạng rồi so sánh lại.", COLORS.red]
      : ["Kéo một thẻ thả vào chỗ thẻ khác để đổi chỗ, rồi bấm Kiểm tra.", COLORS.muted];
  row(ctx, [note[0]], view.w / 2, small ? 34 : 64, { size, color: note[1], bold: s.status !== "", maxW: view.w - 12 });

  const sel = Math.round(s.pick) - 1;
  cards.forEach((c, k) => {
    const dragged = s._drag === "card" && k === sel;
    const x = dragged ? c.x + s._dx : c.x;
    ctx.beginPath();
    ctx.roundRect(x, c.y, c.w, c.h, 10);
    ctx.fillStyle = right ? "#e8f7f0" : "#fff";
    ctx.fill();
    ctx.strokeStyle = right ? COLORS.green : k === sel ? COLORS.blue : COLORS.grid;
    ctx.lineWidth = k === sel || right ? 3 : 2;
    ctx.stroke();
    row(ctx, [cardItem(set[ids[k]])], x + c.w / 2, c.y + c.h / 2, { size: small ? 16 : 24, bold: true, maxW: c.w - 8 });
    if (k < 3) label(ctx, "<", c.x + c.w + (cards[1].x - cards[0].x - c.w) / 2, c.y + c.h / 2, { size: small ? 15 : 20, align: "center", color: right ? COLORS.green : COLORS.muted, bold: true });
  });

  drawAxis(ctx, g, view, [[10, COLORS.muted, 0]]);
  if (!right) {
    label(ctx, "Sắp xếp đúng để xem các số trên trục số.", view.w / 2, y - (small ? 40 : 50), { size, align: "center", color: COLORS.muted });
    return;
  }
  const tones = [COLORS.blue, COLORS.purple, COLORS.orange, COLORS.red];
  ids.forEach((id, k) => {
    const [p, q] = set[id];
    const x = X(p / q);
    const ly = y - (small ? 28 : 34) - k * (small ? 28 : 32);
    ctx.strokeStyle = tones[k];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, ly - 12);
    ctx.stroke();
    dot(ctx, x, y, 4, tones[k]);
    row(ctx, [cardItem(set[id])], x - 4, ly, { size: small ? 11 : 13, color: tones[k], bold: true, align: "right" });
  });
}

const place = (which, s, api) => {
  const [p, q] = numbers(s)[which];
  api.emit("number-placed", { value: p / q, position: p, parts: q }, "result");
  if (s.mode === "compare") {
    const { a, b } = numbers(s);
    api.emit("compared", { first: a[0] / a[1], second: b[0] / b[1], sign: compare(a[0], a[1], b[0], b[1]) }, "result");
  }
};

const move = (s, api, from, to) => {
  if (s.status === "right" || to < 0 || to > 3 || from === to) return;
  s.order = swap(s.order, from, to);
  s.pick = to + 1;
  s.status = "";
  api.emit("card-moved", { from: from + 1, to: to + 1 }, "action");
};

const explore = s => s.mode !== "order";
const ordering = s => s.mode === "order";

mount({
  slug: "so-huu-ti-truc-so",
  version: "1.0.0",
  title: "Số hữu tỉ trên trục số",
  hint: "Kéo điểm trên trục số hoặc đổi tử số, mẫu số. Mẫu số cho biết mỗi đoạn đơn vị được chia thành mấy phần bằng nhau.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Hoạt động",
      options: [
        { value: "explore", label: "Biểu diễn một số hữu tỉ" },
        { value: "compare", label: "So sánh hai số hữu tỉ" },
        { value: "order", label: "Sắp xếp các số (luyện tập)" },
      ],
    },
    { type: "slider", key: "num", label: "Tử số a", min: -P_MAX, max: P_MAX, step: 1, digits: 0, visible: explore, onCommit: (s, api) => place("a", s, api) },
    { type: "slider", key: "den", label: "Mẫu số b (số phần bằng nhau)", min: 1, max: Q_MAX, step: 1, digits: 0, visible: explore, onCommit: (s, api) => place("a", s, api) },
    { type: "checkbox", key: "showOpposite", label: "Hiện số đối và giá trị tuyệt đối", visible: s => s.mode === "explore" },
    { type: "slider", key: "num2", label: "Tử số c của số thứ hai", min: -P_MAX, max: P_MAX, step: 1, digits: 0, visible: s => s.mode === "compare", onCommit: (s, api) => place("b", s, api) },
    { type: "slider", key: "den2", label: "Mẫu số d của số thứ hai", min: 1, max: Q_MAX, step: 1, digits: 0, visible: s => s.mode === "compare", onCommit: (s, api) => place("b", s, api) },
    { type: "stepper", key: "pick", label: "Thẻ đang chọn", min: 1, max: 4, visible: ordering, disabled: s => s.status === "right" },
    { type: "button", label: "◀ Chuyển thẻ sang trái", visible: ordering, disabled: s => s.status === "right" || s.pick <= 1, action: (s, api) => move(s, api, s.pick - 1, s.pick - 2) },
    { type: "button", label: "Chuyển thẻ sang phải ▶", visible: ordering, disabled: s => s.status === "right" || s.pick >= 4, action: (s, api) => move(s, api, s.pick - 1, s.pick) },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: ordering,
      disabled: s => s.status === "right",
      action(s, api) {
        if (isOrdered(setAt(s.setIndex), s.order)) {
          s.status = "right";
          s.solved = solvedCount(s) + 1;
          api.emit("ordered", { count: 4, solved: s.solved }, "goal");
        } else {
          s.status = "wrong";
          api.emit("wrong-order", {}, "action");
        }
      },
    },
    { type: "button", label: "Bộ số khác", visible: ordering, action: s => nextSet(s), event: "new-set", eventKind: "action" },
  ],
  readouts: [
    { label: "Số thứ nhất", value: s => `${inline(...numbers(s).a)} = ${decimalText(...numbers(s).a)}` },
    {
      label: "Dạng thập phân",
      value: s => {
        const [p, q] = numbers(s).a;
        const d = decimal(p, q);
        return reduce(p, q)[1] === 1 ? "số nguyên" : d.rep ? `vô hạn tuần hoàn, chu kì ${d.rep}` : "hữu hạn";
      },
    },
    { label: "Số đối; giá trị tuyệt đối", value: s => `${inline(-numbers(s).a[0] || 0, numbers(s).a[1])}; ${inline(Math.abs(numbers(s).a[0]), numbers(s).a[1])}` },
    { label: "Số bộ đã sắp xếp đúng", value: s => `${solvedCount(s)}` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      if (g.order) {
        const k = g.cards.findIndex(c => p.x >= c.x - 6 && p.x <= c.x + c.w + 6 && p.y >= c.y - 6 && p.y <= c.y + c.h + 6);
        if (k < 0 || s.status === "right") return false;
        s.pick = k + 1;
        s._drag = "card";
        s._x0 = p.x;
        s._dx = 0;
        api.sync();
        return true;
      }
      if (Math.abs(p.y - g.y) > 60) return false;
      const v = (p.x - g.X(0)) / g.unit;
      s._drag = g.two && Math.abs(v - g.b[0] / g.b[1]) < Math.abs(v - g.a[0] / g.a[1]) ? "b" : "a";
      this.move(p, s, api, view);
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      if (s._drag === "card") {
        s._dx = p.x - s._x0;
        return;
      }
      const v = (p.x - g.X(0)) / g.unit;
      if (s._drag === "b") s.num2 = snap(v, g.b[1]);
      else s.num = snap(v, g.a[1]);
    },
    up(p, s, api, view) {
      const what = s._drag;
      s._drag = "";
      if (what === "card") {
        const g = geom(s, view);
        const from = Math.round(s.pick) - 1;
        const cx = g.cards[from].x + g.cards[from].w / 2 + s._dx;
        const to = g.cards.reduce((best, c, k) => (Math.abs(c.x + c.w / 2 - cx) < Math.abs(g.cards[best].x + g.cards[best].w / 2 - cx) ? k : best), from);
        s._dx = 0;
        move(s, api, from, to);
      } else if (what) {
        place(what, s, api);
      }
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    if (g.order) drawOrder(ctx, s, g, view);
    else if (g.two) drawCompare(ctx, s, g, view);
    else drawExplore(ctx, s, g, view);
  },
});
