import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import {
  MIN_LENGTH, MAX_LENGTH, MAX_ROUNDS, initialState, complement, hydrogenBonds, composition, templateOf,
  lengthOf, roundOf, roundsOf, fork, generations, withOriginal, totals, timeOf, shownRound,
  commitProgress, step, restart, check,
} from "./model.js";

const FONT = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const OLD = { line: COLORS.blue, tint: "#dbe6fd" }; // strands of the original molecule
const NEW = { line: COLORS.orange, tint: "#fde6cf" }; // strands made during replication
const SUP = "⁰¹²³⁴⁵";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitLabel(ctx, text, x, y, maxW, opts) {
  ctx.font = FONT(opts.size, opts.bold);
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: w > maxW ? Math.max(8, (opts.size * maxW) / w) : opts.size });
}

function wrap(ctx, text, maxW, size, bold) {
  ctx.font = FONT(size, bold);
  const lines = [""];
  for (const word of text.split(" ")) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (ctx.measureText(next).width > maxW && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  return lines;
}

const line = (ctx, x1, y1, x2, y2) => {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

function statusText(f, L) {
  if (f.t <= 0) return "Phân tử DNA mạch kép: A liên kết với T bằng 2 liên kết hydro, G liên kết với C bằng 3 liên kết hydro. Bấm Chạy để bắt đầu tái bản.";
  if (f.complete) return "Kết quả: 2 phân tử DNA con giống hệt phân tử mẹ; mỗi phân tử con gồm 1 mạch của phân tử mẹ và 1 mạch mới (nguyên tắc bán bảo toàn).";
  if (f.leading < L) return "Helicase tháo xoắn, tách hai mạch đơn. DNA polymerase gắn nucleotide tự do vào mạch khuôn theo nguyên tắc bổ sung; mạch mới chỉ kéo dài theo chiều 5′ → 3′.";
  return "Mạch liên tục đã tổng hợp xong. Trên mạch khuôn còn lại, các đoạn Okazaki được tổng hợp ngược chiều tháo xoắn rồi được ligase nối lại.";
}

// One result per finished round.
const report = (s, api) => {
  const round = roundOf(s);
  const t = totals(templateOf(s), round);
  const c = composition(templateOf(s));
  api.emit("round-finished", { round, molecules: t.molecules, withOriginal: t.withOriginal, nucleotidesUsed: t.nucleotidesUsed, nucleotidesThisRound: (c.nucleotides * t.molecules) / 2, hydrogenBonds: c.hydrogen }, "result");
};

const power = n => `2${SUP[n]} = ${2 ** n}`;

mount({
  slug: "tai-ban-adn",
  version: "1.0.0",
  title: "Tái bản DNA",
  hint: "Bấm Chạy để xem chạc tái bản mở dần. Trước khi chạy đủ n lượt, hãy dự đoán có bao nhiêu phân tử còn giữ mạch của phân tử ban đầu.",
  initialState,
  step(s, dt, api) {
    if (roundOf(s) >= roundsOf(s)) return api.pause();
    const before = Math.floor(s.progress);
    const finished = step(s, dt);
    if (Math.floor(s.progress) !== before) api.sync(); // keep the progress slider in step
    if (finished) {
      report(s, api);
      api.pause(); // look at the result; "Chạy" starts the next round
    }
  },
  controls: [
    { type: "slider", key: "length", label: "Số cặp nucleotide của phân tử", min: MIN_LENGTH, max: MAX_LENGTH, step: 1, digits: 0, unit: "cặp", onChange: s => void restart(s) },
    {
      type: "stepper",
      key: "rounds",
      label: "Số lượt tái bản n",
      min: 1,
      max: MAX_ROUNDS,
      onChange(s) {
        s.round = roundOf(s);
        s.verdict = "none";
      },
    },
    {
      type: "slider",
      key: "progress",
      label: "Tiến trình của lượt đang xem",
      min: 0,
      max: 100,
      step: 1,
      format: v => `${fmt(v, 0)} %`,
      onCommit(s, api) {
        if (commitProgress(s)) report(s, api);
      },
    },
    { type: "button", label: "Tái bản lại từ phân tử ban đầu", event: "restart", action: s => void restart(s) },
    { type: "heading", label: "Dự đoán sau n lượt" },
    { type: "stepper", key: "guess", label: "Số phân tử còn mạch ban đầu", min: 0, max: 2 ** MAX_ROUNDS, onChange: s => void (s.verdict = "none") },
    {
      type: "button",
      label: "Kiểm tra dự đoán",
      primary: true,
      action(s, api) {
        const correct = check(s);
        const data = { rounds: roundsOf(s), guess: s.guess, roundsShown: roundOf(s) };
        if (correct) api.emit("prediction-correct", { ...data, molecules: 2 ** roundsOf(s) }, "goal");
        else api.emit("prediction-wrong", data);
      },
    },
  ],
  readouts: [
    { label: "Số nucleotide của phân tử (N)", value: s => `${composition(templateOf(s)).nucleotides}` },
    { label: "A = T; G = C", value: s => `${composition(templateOf(s)).A}; ${composition(templateOf(s)).G}` },
    { label: "Liên kết hydro H = 2A + 3G", value: s => `${composition(templateOf(s)).hydrogen}` },
    { label: "Số phân tử sau k lượt đã xong", value: s => power(roundOf(s)) },
    { label: "Nucleotide tự do đã dùng N(2ᵏ − 1)", value: s => fmt(totals(templateOf(s), roundOf(s)).nucleotidesUsed, 0) },
    {
      label: "Dự đoán của em",
      value: s => (s.verdict === "right" ? `đúng ✓ (${withOriginal(roundsOf(s))} phân tử)` : s.verdict === "wrong" ? "chưa đúng, hãy theo dõi màu của các mạch" : "chưa kiểm tra"),
    },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 430;
    const pad = small ? 6 : 16;
    const fs = small ? 10 : 13;
    const lineH = fs + (small ? 3 : 6);
    const seq = templateOf(s);
    const other = complement(seq);
    const L = lengthOf(s);
    const f = fork(seq, timeOf(s));
    const done = roundOf(s);
    const shown = shownRound(s);
    const W = view.w - 2 * pad;

    // ---- sizes, then centre the whole picture vertically ----
    const endW = small ? 14 : 24; // room for the 3′ / 5′ marks
    const dx = Math.min((W - 2 * endW) / L, small ? 26 : 62);
    const tw = dx - 2;
    const th = Math.min(tw, small ? 15 : 34);
    const bond = small ? 4 : 9; // gap that holds the hydrogen bonds
    const pitch = th + bond;
    const sep = th * (small ? 0.9 : 1.2); // gap between the two daughter molecules
    const forkH = sep + 4 * th + 2 * bond + (small ? 14 : 26);
    const molecules = generations(done);
    const cols = Math.min(molecules.length, 8);
    const rows = Math.ceil(molecules.length / cols);
    const rowH = small ? 11 : 24;
    const gap = small ? 4 : 12;
    const statusLines = small ? 4 : 3;
    const total = lineH + gap + lineH + forkH + lineH + gap + statusLines * lineH + gap + 3 * lineH + rows * rowH;
    let y = Math.max(pad, (view.h - total) / 2);

    // ---- legend ----
    const legend = [[small ? "mạch ban đầu" : "mạch của phân tử ban đầu", OLD.line, 0], [small ? "mạch mới" : "mạch mới tổng hợp", NEW.line, 0], ["helicase", COLORS.purple, 1], [small ? "ligase đã nối" : "chỗ ligase đã nối", COLORS.green, 1]];
    let lx = pad;
    for (const [text, color, dot] of legend) {
      ctx.fillStyle = color;
      if (dot) {
        ctx.beginPath();
        ctx.arc(lx + 4, y + lineH / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(lx, y + lineH / 2 - 2, small ? 10 : 16, 4);
      const tx = lx + (dot ? 11 : small ? 13 : 21);
      label(ctx, text, tx, y + lineH / 2, { size: fs - 1, color: COLORS.muted });
      ctx.font = FONT(fs - 1);
      lx = tx + ctx.measureText(text).width + (small ? 7 : 18);
    }
    y += lineH + gap;

    // ---- the fork ----
    fitLabel(ctx, small ? "Mạch liên tục: tổng hợp cùng chiều tháo xoắn →" : "Mạch khuôn 3′ → 5′ và mạch mới liên tục (mạch dẫn đầu), tổng hợp cùng chiều tháo xoắn →", pad, y + lineH / 2, W, { size: fs, color: COLORS.muted });
    y += lineH;
    const cy = y + forkH / 2;
    const x0 = (view.w - L * dx) / 2;
    const X = i => x0 + (i + 0.5) * dx;
    const open = i => Math.min(1, Math.max(0, f.unwound - i)); // 0 = still paired, 1 = fully apart
    const reach = sep / 2 + th / 2 + pitch; // centre of an old strand once the fork has passed
    const yTop = i => cy - (pitch / 2 + open(i) * (reach - pitch / 2));
    const yBot = i => cy + (pitch / 2 + open(i) * (reach - pitch / 2));
    const topStrand = OLD;
    const botStrand = shown === 1 ? OLD : NEW; // from round 2 on, the molecule on show has one newer strand

    const tile = (x, yc, base, strand, alpha = 1) => {
      ctx.globalAlpha = alpha;
      roundRect(ctx, x - tw / 2, yc - th / 2, tw, th, Math.min(4, th / 4));
      ctx.fillStyle = strand.tint;
      ctx.fill();
      ctx.strokeStyle = strand.line;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      label(ctx, base, x, yc + 0.5, { size: Math.min(th - 3, small ? 11 : 16), bold: true, align: "center" });
      ctx.globalAlpha = 1;
    };
    const bonds = (x, ya, yb, base) => {
      const n = hydrogenBonds(base);
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      for (let k = 0; k < n; k++) {
        const bx = x + (k - (n - 1) / 2) * Math.min(5, tw / 4);
        line(ctx, bx, ya + th / 2 + 1, bx, yb - th / 2 - 1);
      }
    };
    const backbone = (points, strand) => {
      ctx.strokeStyle = strand.line;
      ctx.lineWidth = small ? 2.5 : 3.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    };
    const off = th / 2 + 3; // backbone sits just outside the bases

    // old strands and the bonds that still hold them together
    const idx = Array.from({ length: L }, (_, i) => i);
    backbone([[X(0) - dx / 2, yTop(0) - off], ...idx.map(i => [X(i), yTop(i) - off]), [X(L - 1) + dx / 2, yTop(L - 1) - off]], topStrand);
    backbone([[X(0) - dx / 2, yBot(0) + off], ...idx.map(i => [X(i), yBot(i) + off]), [X(L - 1) + dx / 2, yBot(L - 1) + off]], botStrand);
    for (const i of idx) {
      if (open(i) === 0) bonds(X(i), yTop(i), yBot(i), seq[i]);
      tile(X(i), yTop(i), seq[i], topStrand);
      tile(X(i), yBot(i), other[i], botStrand);
    }
    const marks = { size: fs + 1, bold: true, align: "center", color: COLORS.muted };
    label(ctx, "3′", x0 - endW / 2, yTop(0) - off + 2, marks);
    label(ctx, "5′", x0 + L * dx + endW / 2, yTop(L - 1) - off + 2, marks);
    label(ctx, "5′", x0 - endW / 2, yBot(0) + off - 2, marks);
    label(ctx, "3′", x0 + L * dx + endW / 2, yBot(L - 1) + off - 2, marks);

    // leading strand: one piece, growing towards the fork
    const yLead = cy - sep / 2 - th / 2;
    const yLag = cy + sep / 2 + th / 2;
    if (f.leading > 0) {
      backbone([[X(0) - dx / 2 + 2, yLead + off], [X(f.leading - 1) + dx / 2 - 2, yLead + off]], NEW);
      for (let i = 0; i < f.leading; i++) {
        bonds(X(i), yLead - pitch, yLead, seq[i]);
        tile(X(i), yLead, other[i], NEW);
      }
    }
    // lagging strand: fragments growing away from the fork, sealed by ligase afterwards
    f.fragments.forEach((frag, j) => {
      if (!frag.made) return;
      const right = frag.start + frag.len - 1;
      const left = right - frag.made + 1;
      const sealedRight = f.fragments[j + 1]?.joined;
      backbone([[X(left) - dx / 2 + (frag.joined ? 0 : 3), yLag - off], [X(right) + dx / 2 - (sealedRight ? 0 : 3), yLag - off]], NEW);
      for (let i = left; i <= right; i++) {
        bonds(X(i), yLag, yLag + pitch, seq[i]);
        tile(X(i), yLag, seq[i], NEW);
      }
      if (frag.joined) {
        ctx.fillStyle = COLORS.green;
        ctx.beginPath();
        ctx.arc(X(left) - dx / 2, yLag - off, small ? 3 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // free nucleotides on their way in
    const frac = v => v - Math.floor(v);
    if (f.t >= 1 && f.leading < L) {
      const a = frac(f.t - 1);
      tile(X(f.leading), yLead + (1 - a) * sep * 0.6, other[f.leading], NEW, 0.2 + 0.6 * a);
    }
    const growing = f.fragments.find(frag => f.t >= frag.begin && frag.made < frag.len);
    if (growing) {
      const a = frac(f.t - growing.begin);
      const i = growing.start + growing.len - 1 - growing.made;
      tile(X(i), yLag - (1 - a) * sep * 0.6, seq[i], NEW, 0.2 + 0.6 * a);
    }
    // helicase at the fork
    if (f.unwound > 0 && f.unwound < L) {
      ctx.fillStyle = COLORS.purple;
      ctx.beginPath();
      ctx.arc(x0 + f.unwound * dx, cy, Math.min(pitch / 2 - 1, small ? 5 : 8), 0, Math.PI * 2);
      ctx.fill();
    }
    y += forkH;
    fitLabel(ctx, small ? "Mạch gián đoạn: các đoạn Okazaki ← rồi ligase nối" : "Mạch khuôn 5′ → 3′ và mạch mới gián đoạn (mạch ra chậm): các đoạn Okazaki tổng hợp ngược chiều tháo xoắn ←, sau đó ligase nối lại", pad, y + lineH / 2, W, { size: fs, color: COLORS.muted });
    y += lineH + gap;

    // ---- what is happening, and the counts for this round ----
    const title = done >= roundsOf(s) && s.progress < 100 ? "Xem lại cơ chế" : `Lượt ${shown}`;
    const count = `${title}: đã gắn ${f.added}/${2 * L} nucleotide tự do, tạo ${f.hydrogen} liên kết hydro mới.`;
    const text = wrap(ctx, `${count} ${statusText(f, L)}`, W, fs).slice(0, statusLines);
    text.forEach((row, i) => label(ctx, row, pad, y + lineH * (i + 0.5), { size: fs }));
    y += statusLines * lineH + gap;

    // ---- all molecules after the finished rounds ----
    const kept = withOriginal(done);
    const summary =
      done === 0
        ? "Ban đầu: 1 phân tử DNA, cả hai mạch là mạch ban đầu."
        : `Sau ${done} lượt: ${power(done)} phân tử DNA, trong đó ${kept} phân tử còn 1 mạch ban đầu và ${molecules.length - kept} phân tử chỉ gồm mạch mới.`;
    const head = wrap(ctx, summary, W, fs, true).slice(0, 2);
    head.forEach((row, i) => label(ctx, row, pad, y + lineH * (i + 0.5), { size: fs, bold: true }));
    y += head.length * lineH + 2;
    const cellW = Math.min(W / cols, small ? 80 : 150);
    const thick = small ? 3 : 5;
    ctx.lineCap = "round";
    ctx.lineWidth = thick;
    molecules.forEach((strands, k) => {
      const mx = pad + (k % cols) * cellW;
      const my = y + Math.floor(k / cols) * rowH + rowH / 2;
      // odd molecules are drawn old strand below, like the lower daughter at the fork
      (k % 2 ? [...strands].reverse() : strands).forEach((made, j) => {
        ctx.strokeStyle = made === 0 ? OLD.line : NEW.line;
        line(ctx, mx + thick, my + (j ? 1 : -1) * (thick / 2 + 0.5), mx + cellW - thick - (small ? 3 : 8), my + (j ? 1 : -1) * (thick / 2 + 0.5));
      });
    });
    if (y + rows * rowH + lineH <= view.h) {
      fitLabel(ctx, "Sơ đồ phẳng: chuỗi xoắn kép được vẽ duỗi thẳng, không theo tỉ lệ; bỏ qua đoạn mồi.", pad, y + rows * rowH + lineH / 2 + 2, W, { size: fs - 1, color: COLORS.muted });
    }
  },
});
