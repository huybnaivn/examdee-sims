import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { IONS, CATIONS, ANIONS, SOLUTIONS, SOLUTION_KEYS, TYPE, initialState, mix, ionsOf, pickIsRight, prettyIon, prettyTerm, prettyEquation } from "./model.js";

const font = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const pretty = f => prettyTerm({ n: 1, f });
const TYPE_NAME = { [TYPE.none]: "Không có", [TYPE.precipitate]: "Chất kết tủa", [TYPE.gas]: "Chất khí", [TYPE.weak]: "Chất điện li yếu" };

const rand = i => {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

// Text that shrinks to stay inside maxW.
function line(ctx, text, x, y, maxW, { size = 14, ...opts } = {}) {
  ctx.font = font(size, opts.bold);
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: w > maxW ? Math.max(8, (size * maxW) / w) : size });
}

// A new pair of solutions: hide the equations and clear the learner's answer.
const remix = s => {
  s.revealed = false;
  s.pickCation = "none";
  s.pickAnion = "none";
};
const report = (s, api) => {
  const r = mix(s.a, s.b);
  api.emit("mixed", { a: SOLUTION_KEYS.indexOf(r.a), b: SOLUTION_KEYS.indexOf(r.b), reacted: r.reacted ? 1 : 0, productType: r.type }, "result");
};

function observation(r) {
  const rule = r.reactions[0];
  if (r.type === TYPE.precipitate) return `xuất hiện kết tủa màu ${rule.colourName}`;
  if (r.type === TYPE.gas) return rule.c === "NH4" ? "có khí mùi khai thoát ra (rõ hơn khi đun nhẹ)" : "có bọt khí không màu thoát ra";
  return "không thấy hiện tượng rõ rệt, dung dịch vẫn trong suốt";
}

function beaker(ctx, b, tint) {
  const { x, y, w, h } = b;
  const top = y + h * 0.26;
  ctx.fillStyle = tint ? `rgba(47, 111, 237, ${tint})` : "#e4f1fb";
  ctx.fillRect(x, top, w, y + h - top);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 4);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w + 5, y - 4);
  ctx.stroke();
  return { x: x + 4, y: top + 4, w: w - 8, h: y + h - top - 8 }; // room for the ions
}

// Ion "chips", flowed into rows and centred in the box. kind: "+" cation, "-" anion, "m" molecule.
const CHIP = { "+": ["#fdeaea", COLORS.red], "-": ["#e6eefe", COLORS.blue], m: ["#e3f5ec", COLORS.green] };
function chips(ctx, items, box, size) {
  ctx.font = font(size, true);
  const gap = size < 12 ? 3 : 6;
  const ch = size + (size < 12 ? 6 : 10);
  const rows = [[]];
  let rw = 0;
  for (const it of items) {
    it.w = ctx.measureText(it.text).width + size * 0.9;
    if (rows.at(-1).length && rw + it.w > box.w) {
      rows.push([]);
      rw = 0;
    }
    rows.at(-1).push(it);
    rw += it.w + gap;
  }
  let y = box.y + Math.max(0, (box.h - rows.length * (ch + gap) + gap) / 2);
  for (const row of rows) {
    let x = box.x + (box.w - row.reduce((sum, it) => sum + it.w + gap, -gap)) / 2;
    for (const it of row) {
      const [fill, stroke] = CHIP[it.kind];
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(x, y, it.w, ch, ch / 2);
      ctx.fill();
      ctx.stroke();
      label(ctx, it.text, x + it.w / 2, y + ch / 2 + 0.5, { size, bold: true, align: "center" });
      x += it.w + gap;
    }
    y += ch + gap;
  }
}
const ionChip = key => ({ text: prettyIon(key), kind: IONS[key].q > 0 ? "+" : "-" });

mount({
  slug: "phan-ung-trao-doi-ion",
  version: "1.0.0",
  title: "Phản ứng trao đổi ion trong dung dịch",
  hint: "Chọn hai dung dịch để trộn, quan sát hiện tượng rồi chọn cặp ion đã kết hợp với nhau.",
  initialState,
  controls: [
    ...[
      ["a", "Dung dịch 1"],
      ["b", "Dung dịch 2"],
    ].map(([key, text]) => ({
      type: "select",
      key,
      label: text,
      options: SOLUTION_KEYS.map(value => ({ value, label: `${pretty(value)} – ${SOLUTIONS[value].name}` })),
      onChange: remix,
      onCommit: report,
    })),
    { type: "heading", label: "Phương trình ion rút gọn: ion nào phản ứng?" },
    {
      type: "select",
      key: "pickCation",
      label: "Cation tham gia phản ứng",
      disabled: s => s.revealed,
      options: [{ value: "none", label: "Không có (không phản ứng)" }, ...CATIONS.map(value => ({ value, label: prettyIon(value) }))],
    },
    {
      type: "select",
      key: "pickAnion",
      label: "Anion tham gia phản ứng",
      disabled: s => s.revealed,
      options: [{ value: "none", label: "Không có (không phản ứng)" }, ...ANIONS.map(value => ({ value, label: prettyIon(value) }))],
    },
    {
      type: "button",
      label: "Kiểm tra và xem phương trình",
      primary: true,
      visible: s => !s.revealed,
      action(s, api) {
        const r = mix(s.a, s.b);
        const right = pickIsRight(s.a, s.b, s.pickCation, s.pickAnion);
        s.revealed = true;
        api.emit("answer-checked", { correct: right ? 1 : 0, reacted: r.reacted ? 1 : 0 });
        if (right && r.reacted) api.emit("net-ionic-correct", { a: SOLUTION_KEYS.indexOf(r.a), b: SOLUTION_KEYS.indexOf(r.b), productType: r.type }, "goal");
      },
    },
    { type: "button", label: "Làm lại (ẩn phương trình)", visible: s => s.revealed, action: remix, event: "retry" },
  ],
  readouts: [
    { label: "Phản ứng", value: s => (!s.revealed ? "?" : mix(s.a, s.b).reacted ? "Có xảy ra" : "Không xảy ra") },
    { label: "Chất tách khỏi dung dịch", value: s => (!s.revealed ? "?" : TYPE_NAME[mix(s.a, s.b).type]) },
    { label: "Ion không tham gia phản ứng", value: s => (!s.revealed ? "?" : mix(s.a, s.b).spectators.map(prettyIon).join(", ") || "–") },
  ],
  draw(ctx, s, view) {
    const r = mix(s.a, s.b);
    const small = view.w < 560 || view.h < 430;
    const fs = small ? 10.5 : 15;
    const lh = small ? 14 : 25;
    const chip = small ? 10 : view.w < 760 ? 12 : 14;
    const nLines = 7; // observation, three equations, spectators, verdict, convention note
    const textTop = view.h - nLines * lh - (small ? 2 : 12);
    const top = small ? 22 : 58;
    const bh = Math.max(60, Math.min(textTop - top - (small ? 8 : 26), small ? 170 : 300));
    const sideW = Math.min(view.w * 0.25, 220);
    const midW = Math.min(view.w * 0.31, 280);
    const cx = [view.w * 0.16, view.w * 0.5, view.w * 0.84];
    const by = top + (textTop - top - (small ? 8 : 26) - bh) / 2;
    const hasCu = key => SOLUTIONS[key].c === "Cu";

    // the two solutions before mixing
    [r.a, r.b].forEach((key, i) => {
      const x = cx[i * 2] - sideW / 2;
      const box = beaker(ctx, { x, y: by, w: sideW, h: bh }, hasCu(key) ? 0.35 : 0);
      chips(ctx, ionsOf(key).map(ionChip), box, chip);
      label(ctx, small ? pretty(key) : `Dung dịch ${pretty(key)}`, cx[i * 2], by - (small ? 12 : 30), { size: fs + 1, bold: true, align: "center" });
      if (!small) label(ctx, "phân li hoàn toàn thành ion", cx[i * 2], by - 12, { size: 12, align: "center", color: COLORS.muted });
    });
    const ay = by + bh * 0.45;
    arrow(ctx, cx[0] + sideW / 2 + 8, ay, cx[1] - midW / 2 - 8, ay, COLORS.muted, 2);
    arrow(ctx, cx[2] - sideW / 2 - 8, ay, cx[1] + midW / 2 + 8, ay, COLORS.muted, 2);

    // the mixture
    const mx = cx[1] - midW / 2;
    const cuLeft = r.reacted ? r.spectators.includes("Cu") : hasCu(r.a) || hasCu(r.b);
    const box = beaker(ctx, { x: mx, y: by, w: midW, h: bh }, cuLeft ? 0.2 : 0);
    label(ctx, "Sau khi trộn", cx[1], by - (small ? 12 : 30), { size: fs + 1, bold: true, align: "center" });
    const made = r.reactions.flatMap(rule => rule.products.map(p => ({ ...p, rule })));
    const solid = made.find(p => p.mark === "↓");
    const gas = made.find(p => p.mark === "↑");
    if (solid) {
      const sh = Math.max(9, bh * 0.1);
      const y0 = by + bh - 2;
      ctx.fillStyle = solid.rule.colour;
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(mx + 2, y0);
      const n = 14;
      for (let i = 0; i <= n; i++) ctx.lineTo(mx + 2 + ((midW - 4) * i) / n, y0 - sh * (0.65 + 0.35 * rand(i + 3)));
      ctx.lineTo(mx + midW - 2, y0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      box.h -= sh;
    }
    if (gas) {
      ctx.strokeStyle = COLORS.muted;
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc(box.x + 6 + rand(i + 11) * (box.w - 12), box.y + rand(i + 41) * box.h, (small ? 2 : 3.5) * (0.6 + rand(i + 71)), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (s.revealed) label(ctx, `${pretty(gas.f)}↑`, cx[1], box.y - (small ? 12 : 16), { size: chip + 1, bold: true, align: "center", color: COLORS.muted });
    }
    if (s.revealed) {
      // what is left in solution: spectator ions (or every ion when nothing reacts) and weak molecules
      const left = r.reacted ? r.ionic.right.filter(t => t.ion).flatMap(t => Array(t.n).fill(t.ion)) : [...ionsOf(r.a), ...ionsOf(r.b)];
      const molecules = made.filter(p => p.mark === "").map(p => ({ text: pretty(p.f), kind: "m" }));
      chips(ctx, [...molecules, ...left.map(ionChip)], box, chip);
      if (solid) label(ctx, `${pretty(solid.f)}↓ (${solid.rule.colourName})`, cx[1], by + bh + (small ? 8 : 13), { size: small ? 10 : 13, bold: true, align: "center" });
    } else {
      label(ctx, "?", cx[1], box.y + box.h / 2, { size: small ? 26 : 44, bold: true, align: "center", color: COLORS.muted });
    }

    // observation and equations
    const x = small ? 6 : 24;
    const maxW = view.w - 2 * x;
    let y = textTop + lh / 2;
    const put = (text, opts) => {
      line(ctx, text, x, y, maxW, { size: fs, ...opts });
      y += lh;
    };
    put(`Hiện tượng: ${observation(r)}.`, { bold: true, color: r.type === TYPE.precipitate || r.type === TYPE.gas ? COLORS.orange : COLORS.ink });
    if (!s.revealed) {
      put("Ion nào đã kết hợp với nhau? Chọn một cation và một anion (hoặc “Không có”)", { color: COLORS.muted });
      put("rồi bấm “Kiểm tra và xem phương trình”.", { color: COLORS.muted });
    } else {
      const mark = pickIsRight(s.a, s.b, s.pickCation, s.pickAnion) ? ["✓ Bạn chọn đúng.", COLORS.green] : ["✗ Lựa chọn của bạn chưa đúng.", COLORS.red];
      if (r.reacted) {
        put(`${small ? "PT phân tử" : "Phương trình phân tử"}: ${prettyEquation(r.molecular)}`);
        put(`${small ? "Ion đầy đủ" : "Phương trình ion đầy đủ"}: ${prettyEquation(r.ionic)}`);
        put(`${small ? "Ion rút gọn" : "Phương trình ion rút gọn"}: ${r.net.map(prettyEquation).join(";  ")}`, { bold: true, color: COLORS.purple });
        const why = r.reactions.map(rule => rule.why).join("; ");
        put(`${small ? "Không phản ứng" : "Ion không tham gia phản ứng"}: ${r.spectators.map(prettyIon).join(", ")}. ${small ? "Vì" : "Vì sao có phản ứng"}: ${why}.`, { size: fs - (small ? 0.5 : 1) });
      } else {
        put("Không xảy ra phản ứng: không tạo chất kết tủa, chất khí hay chất điện li yếu.", { bold: true, color: COLORS.purple });
        put(r.a === r.b ? "Hai dung dịch giống nhau." : `Các ion ${[...new Set([...ionsOf(r.a), ...ionsOf(r.b)])].map(prettyIon).join(", ")} cùng tồn tại trong dung dịch.`);
        y += lh;
      }
      put(mark[0], { bold: true, color: mark[1] });
    }
    label(ctx, small ? "Hình minh họa tỉ lệ ion; Ag₂SO₄, CH₃COOAg (ít tan) coi như tan." : "Quy ước: số ion trong cốc chỉ minh họa tỉ lệ; Ag₂SO₄ và CH₃COOAg (ít tan) được coi là tan trong dung dịch loãng.", x, view.h - (small ? 8 : 14), { size: small ? 9 : 12, color: COLORS.muted });
  },
});
