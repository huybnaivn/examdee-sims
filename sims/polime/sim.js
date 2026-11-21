import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { POLYMERS, polymerById, initialState, step, unitMass, monomerMass, polymerMass, waterReleased, isCondensation, targetOf, newTarget, N_MIN, N_MAX, N_STEP, SHOW, WATER } from "./model.js";

const SUBS = "₀₁₂₃₄₅₆₇₈₉";
const pretty = f => f.replace(/\d/g, d => SUBS[d]);
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** label() shrunk to fit maxW. */
function fit(ctx, text, x, y, maxW, opts) {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: w > maxW ? (opts.size * maxW) / w : opts.size });
}

const kindText = p => (isCondensation(p) ? "Phản ứng trùng ngưng" : p.ring ? "Phản ứng trùng hợp (mở vòng)" : "Phản ứng trùng hợp");
const equation = p => {
  const left = p.monomers.map(m => `n ${m.struct}`).join(" + ");
  return `${left}  →  (${p.repeat})ₙ${p.water ? ` + ${p.water}n H₂O` : ""}`;
};

const report = (s, api) => {
  const p = polymerById(s.polymer);
  api.emit("polymer-committed", { polymer: POLYMERS.indexOf(p) + 1, n: s.n, molarMass: polymerMass(p, s.n) }, "result");
};

function drawChain(ctx, s, p, x0, x1, yChain, yPool, small) {
  const gap = (x1 - x0) / SHOW;
  const bw = gap * 0.84;
  const bh = Math.min(30, Math.max(18, gap * 0.42));
  const two = p.monomers.length === 2;
  const prog = Math.max(0, Math.min(SHOW, s.progress));
  const pos = k => {
    const t = Math.max(0, Math.min(1, prog - k)); // 0 = waiting in the pool, 1 = in the chain
    const e = t * t * (3 - 2 * t);
    return { x: x0 + gap * (k + 0.5), y: yPool + (yChain - yPool) * e, t };
  };
  // bonds between joined neighbours
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  for (let k = 1; k < SHOW; k++) {
    const a = pos(k - 1);
    const b = pos(k);
    if (a.t < 1 || b.t < 1) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (prog >= 1) {
    label(ctx, "…", x0 - 4, yChain, { size: 18, align: "right", bold: true });
    if (prog >= SHOW) label(ctx, "…", x1 + 4, yChain, { size: 18, bold: true });
  }
  for (let k = 0; k < SHOW; k++) {
    const { x, y, t } = pos(k);
    const m = p.monomers[two ? k % 2 : 0];
    const color = two && k % 2 ? COLORS.orange : COLORS.blue;
    ctx.fillStyle = t >= 1 ? color : "#fff";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(t > 0 ? [] : [4, 3]);
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, bh / 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    fit(ctx, pretty(m.formula), x, y + 1, bw - 6, { size: small ? 11 : 13, align: "center", bold: true, color: t >= 1 ? "#fff" : color });
    // condensation: each new amide bond gives off one H2O
    if (two && k > 0 && t > 0.6 && prog < k + 1.8) {
      const rise = (prog - k - 0.6) * 40;
      label(ctx, "H₂O", x - gap / 2, yChain - bh / 2 - 8 - rise, { size: small ? 10 : 12, align: "center", bold: true, color: COLORS.red });
    }
  }
  // bracket the first repeating unit
  if (prog >= (two ? 2 : 1)) {
    const left = x0 + gap * 0.04;
    const right = x0 + gap * (two ? 1.96 : 0.96);
    ctx.strokeStyle = COLORS.purple;
    ctx.lineWidth = 2;
    for (const [x, d] of [[left, 1], [right, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x + 5 * d, yChain - bh / 2 - 6);
      ctx.lineTo(x, yChain - bh / 2 - 6);
      ctx.lineTo(x, yChain + bh / 2 + 6);
      ctx.lineTo(x + 5 * d, yChain + bh / 2 + 6);
      ctx.stroke();
    }
    label(ctx, "mắt xích", (left + right) / 2, yChain + bh / 2 + 16, { size: small ? 10 : 12, align: "center", color: COLORS.purple, bold: true });
  }
}

mount({
  slug: "polime",
  version: "1.0.0",
  title: "Polime và phản ứng trùng hợp",
  hint: "Chọn monomer và hệ số polime hóa n. Bấm ▶ Chạy để xem các monomer nối lại thành mạch.",
  initialState,
  step,
  controls: [
    {
      type: "select",
      key: "polymer",
      label: "Monomer → polime",
      options: POLYMERS.map(p => ({ value: p.id, label: `${p.monomers.map(m => m.name).join(" + ")} → ${p.polymer}` })),
      onCommit: report,
    },
    {
      type: "slider",
      key: "n",
      label: "Hệ số polime hóa n",
      min: N_MIN,
      max: N_MAX,
      step: N_STEP,
      format: v => fmt(v, 0),
      onCommit: report,
    },
    { type: "heading", label: "Bài tập" },
    {
      type: "checkbox",
      key: "quiz",
      label: "Tìm n khi biết phân tử khối polime",
      onChange(s) {
        if (s.quiz) s.targetN = newTarget();
        s._fb = "";
      },
    },
    {
      type: "button",
      label: "Đề mới",
      visible: s => s.quiz,
      event: "new-problem",
      action(s) {
        s.targetN = newTarget();
        s._fb = "";
      },
    },
    {
      type: "button",
      label: "Kiểm tra n",
      primary: true,
      visible: s => s.quiz,
      action(s, api) {
        const p = polymerById(s.polymer);
        const ok = s.n === targetOf(s);
        s._fb = ok ? "right" : "wrong";
        api.emit("answer-checked", { n: s.n, correct: ok ? 1 : 0 });
        if (ok) api.emit("n-found", { polymer: POLYMERS.indexOf(p) + 1, n: s.n, molarMass: polymerMass(p, s.n) }, "goal");
      },
    },
  ],
  readouts: [
    { label: "Loại phản ứng", value: s => kindText(polymerById(s.polymer)) },
    { label: "M mắt xích", value: s => `${fmt(unitMass(polymerById(s.polymer)), 1)} g/mol` },
    { label: "M polime", value: s => (s.quiz ? "?" : `${fmt(polymerMass(polymerById(s.polymer), s.n), 1)} g/mol`) },
    { label: "H₂O tách ra", value: s => { const p = polymerById(s.polymer); return p.water ? `${fmt(waterReleased(p, s.n), 0)} mol / 1 mol polime` : "không có"; } },
  ],
  draw(ctx, s, view) {
    const p = polymerById(s.polymer);
    const small = view.w < 560 || view.h < 430;
    const W = view.w - 20;
    const size = small ? 13 : 16;
    let y = small ? 14 : 22;
    label(ctx, kindText(p), 10, y, { size: size + 1, bold: true, color: isCondensation(p) ? COLORS.orange : COLORS.blue });
    y += small ? 22 : 30;
    fit(ctx, equation(p), 10, y, W, { size, bold: true });
    y += small ? 18 : 24;
    fit(ctx, `${p.monomers.map(m => m.name).join(" + ")}  →  ${p.polymer}`, 10, y, W, { size: size - 2, color: COLORS.muted });

    // chain scene
    const bottomH = small ? 74 : 104;
    const top = y + (small ? 30 : 46);
    const bottom = view.h - bottomH;
    const yChain = top + (bottom - top) * 0.3;
    const yPool = top + (bottom - top) * 0.82;
    const margin = small ? 18 : 30;
    drawChain(ctx, s, p, margin, Math.min(view.w - margin, margin + 110 * SHOW), yChain, yPool, small);

    // numbers
    const u = unitMass(p);
    const lines = [];
    const water = p.water ? ` = ${fmt(monomerMass(p), 1)} − ${p.water}·${WATER}` : "";
    lines.push([`M mắt xích${water} = ${fmt(u, 1)} g/mol`, COLORS.ink]);
    if (s.quiz) {
      const M = polymerMass(p, targetOf(s));
      lines.push([`Đề: polime có M = ${fmt(M, 1)} g/mol. Tìm n.  Đang chọn n = ${fmt(s.n, 0)}`, COLORS.purple]);
      lines.push(
        s._fb === "right"
          ? [`✓ Đúng: n = ${fmt(M, 1)} : ${fmt(u, 1)} = ${fmt(s.n, 0)}`, COLORS.green]
          : s._fb === "wrong"
            ? ["Chưa đúng: n = M polime : M mắt xích", COLORS.red]
            : ["Kéo thanh n rồi bấm “Kiểm tra n”", COLORS.muted]
      );
    } else {
      lines.push([`M polime = n · M mắt xích = ${fmt(s.n, 0)} · ${fmt(u, 1)} = ${fmt(polymerMass(p, s.n), 1)} g/mol`, COLORS.blue]);
      lines.push([p.water ? `Tách ra ${p.water}n = ${fmt(waterReleased(p, s.n), 0)} phân tử H₂O cho mỗi phân tử polime` : "Không tách ra phân tử nhỏ nào", COLORS.muted]);
    }
    const lh = small ? 17 : 24;
    lines.forEach(([t, color], i) => fit(ctx, t, 10, view.h - bottomH + 8 + i * lh, W, { size: size - 1, bold: i === 1, color }));
    fit(ctx, `Hình chỉ vẽ ${SHOW} monomer, không theo tỉ lệ; bỏ qua nhóm ở hai đầu mạch.`, 10, view.h - 10, W, { size: small ? 10 : 12, color: COLORS.muted });
  },
});
