import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { BOND, REACTIONS, reactionById, deltaH, bondEstimate, scaledH, isExo, profile, initialState, nextQuestion } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
function fit(ctx, text, x, y, maxW, opts) {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: w > maxW ? (opts.size * maxW) / w : opts.size });
}

const species = ([f, st, k]) => `${k > 1 ? k : ""}${f}(${st})`;
const equation = r => `${r.reactants.map(species).join(" + ")}  →  ${r.products.map(species).join(" + ")}`;
const num = v => (v < 0 ? `(${fmt(v, 1)})` : fmt(v, 1));
const terms = list => list.map(([, , k, h]) => (k > 1 ? `${k}·${num(h)}` : num(h))).join(" + ");
const kind = dH => (isExo(dH) ? "tỏa nhiệt" : "thu nhiệt");
const refName = r => r.reactants[r.ref][0];
const index = s => REACTIONS.indexOf(reactionById(s.reaction)) + 1;

const report = (s, api) => {
  const r = reactionById(s.reaction);
  const total = scaledH(r, s.amount);
  api.emit("reaction-committed", { reaction: index(s), amount: s.amount, deltaH: total, exo: isExo(total) ? 1 : 0 }, "result");
};

const answer = exo => (s, api) => {
  const right = isExo(deltaH(reactionById(s.reaction))) === exo;
  s._fb = right ? "right" : "wrong";
  api.emit("answer", { reaction: index(s), exo: exo ? 1 : 0, correct: right ? 1 : 0 });
  if (right) api.emit("classified", { reaction: index(s), exo: exo ? 1 : 0 }, "goal");
};

function diagram(ctx, s, r, box, small) {
  const off = profile(r, false);
  const on = profile(r, true);
  const lo = Math.min(0, off.dH);
  const hi = off.ea;
  const pad = small ? 18 : 26;
  const Y = e => box.y + pad + ((hi - e) / (hi - lo)) * (box.h - 2 * pad);
  const xs = { a: box.x + 34, b: box.x + box.w * 0.3, peak: box.x + box.w * 0.52, c: box.x + box.w * 0.74, d: box.x + box.w - 6 };

  // axes
  arrow(ctx, box.x + 14, box.y + box.h, box.x + 14, box.y + 2, COLORS.muted, 1.5);
  arrow(ctx, box.x + 14, box.y + box.h, box.x + box.w, box.y + box.h, COLORS.muted, 1.5);
  label(ctx, "H", box.x + 24, box.y + 8, { size: 13, bold: true, color: COLORS.muted });
  label(ctx, "Tiến trình phản ứng", box.x + box.w, box.y + box.h - 10, { size: small ? 10 : 12, align: "right", color: COLORS.muted });

  const curve = (ea, color, dash) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(xs.a, Y(0));
    ctx.lineTo(xs.b, Y(0));
    const m1 = (xs.b + xs.peak) / 2;
    const m2 = (xs.peak + xs.c) / 2;
    ctx.bezierCurveTo(m1, Y(0), m1, Y(ea), xs.peak, Y(ea));
    ctx.bezierCurveTo(m2, Y(ea), m2, Y(off.dH), xs.c, Y(off.dH));
    ctx.lineTo(xs.d, Y(off.dH));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  curve(off.ea, COLORS.ink, []);
  if (s.catalyst) curve(on.ea, COLORS.green, [7, 5]);

  const size = small ? 11 : 13;
  label(ctx, "Chất đầu", xs.a, Y(0) - 10, { size, bold: true });
  label(ctx, "Sản phẩm", xs.c, Y(off.dH) - 10, { size, bold: true });
  // Ea arrows from the reactant level to each peak
  arrow(ctx, xs.peak - 14, Y(0), xs.peak - 14, Y(off.ea) + 3, COLORS.purple, 2);
  label(ctx, "Eₐ", xs.peak - 20, (Y(0) + Y(off.ea)) / 2, { size, bold: true, color: COLORS.purple, align: "right" });
  if (s.catalyst) {
    arrow(ctx, xs.peak + 14, Y(0), xs.peak + 14, Y(on.ea) + 3, COLORS.green, 2);
    label(ctx, "Eₐ (xúc tác)", xs.peak + 20, (Y(0) + Y(on.ea)) / 2, { size, bold: true, color: COLORS.green });
  }
  // ΔrH arrow from reactants to products
  const color = isExo(off.dH) ? COLORS.red : COLORS.blue;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(xs.b, Y(0));
  ctx.lineTo(xs.d - 18, Y(0));
  ctx.stroke();
  ctx.setLineDash([]);
  arrow(ctx, xs.d - 18, Y(0), xs.d - 18, Y(off.dH), color, 2.5);
  label(ctx, `ΔrH° ${isExo(off.dH) ? "< 0" : "> 0"}`, xs.d - 24, (Y(0) + Y(off.dH)) / 2, { size, bold: true, color, align: "right" });
}

mount({
  slug: "nang-luong-phan-ung",
  version: "1.0.0",
  title: "Enthalpy và sơ đồ năng lượng phản ứng",
  hint: "Chọn phản ứng và lượng chất. Bật chế độ đố vui để tự tính ΔrH° rồi phân loại phản ứng.",
  initialState,
  controls: [
    {
      type: "select",
      key: "reaction",
      label: "Phản ứng",
      options: REACTIONS.map(r => ({ value: r.id, label: r.name })),
      visible: s => !s.quiz,
      onCommit: report,
    },
    {
      type: "slider",
      key: "amount",
      label: "Lượng chất đầu",
      min: 0.1,
      max: 10,
      step: 0.1,
      format: (v, s) => `${fmt(v, 1)} mol ${refName(reactionById(s.reaction))}`,
      visible: s => !s.quiz,
      onCommit: report,
    },
    { type: "checkbox", key: "catalyst", label: "Có chất xúc tác", visible: s => !s.quiz },
    { type: "checkbox", key: "showBonds", label: "Ước tính theo năng lượng liên kết", visible: s => !s.quiz },
    { type: "heading", label: "Đố vui" },
    {
      type: "checkbox",
      key: "quiz",
      label: "Phản ứng tỏa nhiệt hay thu nhiệt?",
      onChange(s) {
        s._fb = "";
        if (s.quiz) s.reaction = nextQuestion(s.reaction);
      },
    },
    { type: "button", label: "Tỏa nhiệt (ΔrH° < 0)", visible: s => s.quiz, action: answer(true) },
    { type: "button", label: "Thu nhiệt (ΔrH° > 0)", visible: s => s.quiz, action: answer(false) },
    {
      type: "button",
      label: "Câu khác",
      visible: s => s.quiz,
      event: "new-question",
      action(s) {
        s.reaction = nextQuestion(s.reaction);
        s._fb = "";
      },
    },
  ],
  readouts: [
    { label: "ΔrH° (theo phương trình)", value: s => (s.quiz && !s._fb ? "?" : `${fmt(deltaH(reactionById(s.reaction)), 1)} kJ`) },
    { label: "ΔH của lượng chất", value: s => (s.quiz ? "–" : `${fmt(scaledH(reactionById(s.reaction), s.amount), 1)} kJ`) },
    { label: "Phân loại", value: s => (s.quiz && !s._fb ? "?" : kind(deltaH(reactionById(s.reaction)))) },
  ],
  draw(ctx, s, view) {
    const r = reactionById(s.reaction);
    const dH = deltaH(r);
    const small = view.w < 560 || view.h < 430;
    const W = view.w - 20;
    const size = small ? 12 : 15;
    const lh = small ? 17 : 23;
    const hidden = s.quiz && !s._fb;

    fit(ctx, s.quiz ? `Đố vui: ${r.name.toLowerCase()}` : r.name, 10, small ? 12 : 18, W, { size: size + 1, bold: true, color: s.quiz ? COLORS.purple : COLORS.ink });
    fit(ctx, `${equation(r)}${hidden ? "" : `     ΔrH°₂₉₈ = ${fmt(dH, 1)} kJ`}`, 10, small ? 31 : 44, W, { size, bold: true });

    const lines = [];
    const data = [...r.reactants, ...r.products].map(([f, st, , h]) => `${f}(${st}): ${fmt(h, 1)}`).join(";  ");
    lines.push([`ΔfH°₂₉₈ (kJ/mol)  ${data}`, COLORS.muted]);
    lines.push(["ΔrH° = ΣΔfH°(sản phẩm) − ΣΔfH°(chất đầu)", COLORS.ink]);
    if (hidden) {
      lines.push(["Tính ΔrH° rồi chọn: phản ứng tỏa nhiệt hay thu nhiệt?", COLORS.purple]);
    } else {
      lines.push([`= [${terms(r.products)}] − [${terms(r.reactants)}] = ${fmt(dH, 1)} kJ  →  ${kind(dH)}`, isExo(dH) ? COLORS.red : COLORS.blue]);
      if (s.quiz) {
        lines.push([s._fb === "right" ? "✓ Đúng! Bấm “Câu khác” để làm tiếp." : `Chưa đúng: ΔrH° ${isExo(dH) ? "< 0 nên phản ứng tỏa nhiệt" : "> 0 nên phản ứng thu nhiệt"}.`, s._fb === "right" ? COLORS.green : COLORS.red]);
      } else {
        const k = r.reactants[r.ref][2];
        lines.push([`${fmt(s.amount, 1)} mol ${refName(r)} (${fmt(s.amount * r.molar, 1)} g): ΔH = ${fmt(dH, 1)} · ${fmt(s.amount, 1)}${k > 1 ? ` : ${k}` : ""} = ${fmt(scaledH(r, s.amount), 1)} kJ`, COLORS.ink]);
        if (s.showBonds) {
          const e = bondEstimate(r);
          const sum = b => Object.entries(b).map(([n, c]) => `${c > 1 ? c + "·" : ""}${BOND[n]}`).join(" + ");
          if (e === null) lines.push(["Năng lượng liên kết: chỉ dùng để ước tính khi mọi chất đều ở thể khí", COLORS.muted]);
          else {
            const used = [...Object.keys(r.bonds.broken), ...Object.keys(r.bonds.formed)].map(n => `${n} ${BOND[n]}`).join(";  ");
            lines.push([`Eb (kJ/mol): ${used}`, COLORS.muted]);
            lines.push([`ΔrH ≈ ΣEb(chất đầu) − ΣEb(sản phẩm) = [${sum(r.bonds.broken)}] − [${sum(r.bonds.formed)}] ≈ ${fmt(e, 0)} kJ`, COLORS.orange]);
          }
        }
      }
    }

    const textH = lines.length * lh + 22;
    const top = small ? 44 : 62;
    const box = { x: 10, y: top, w: Math.min(view.w - 20, 720), h: view.h - top - textH - 8 };
    if (hidden) {
      label(ctx, "?", view.w / 2, box.y + box.h / 2, { size: Math.min(90, box.h * 0.6), align: "center", bold: true, color: COLORS.grid });
    } else if (box.h > 60) {
      diagram(ctx, s, r, box, small);
    }
    const y0 = view.h - textH + 4;
    lines.forEach(([t, color], i) => fit(ctx, t, 10, y0 + i * lh, W, { size: size - (i === 0 ? 2 : 1), color, bold: i === 2 }));
    fit(ctx, "Sơ đồ không theo tỉ lệ; Eₐ chỉ để minh họa. Số liệu ở 298 K, 1 bar.", 10, view.h - 9, W, { size: small ? 10 : 12, color: COLORS.muted });
  },
});
