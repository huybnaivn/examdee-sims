import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import {
  initialState, PRESETS, CODON_TABLE, STOP, MUTATIONS, EFFECTS, EFFECT_SHORT, MIN_LEN,
  transcribe, translate, anticodon, applyMutation, blocked, cleanTemplate, tidy,
} from "./model.js";

const TX_SPEED = 8; // nucleotides per second
const TL_SPEED = 0.8; // codons per second
const BASE_COLOR = { A: "#1f9d6b", T: "#e5484d", U: "#e5484d", G: "#f08c2e", C: "#2f6fed" };
const TARGETS = [
  { value: "none", label: "Không" },
  { value: "0", label: "Tạo đột biến câm" },
  { value: "1", label: "Tạo đột biến sai nghĩa" },
  { value: "2", label: "Tạo đột biến vô nghĩa" },
  { value: "3", label: "Tạo đột biến dịch khung" },
];

const restart = s => {
  s.tx = 0;
  s.tl = 0;
};

const loadPreset = s => {
  const p = PRESETS.find(x => x.value === s.preset);
  if (p) s.template = s.original = p.template;
  s.lastType = s.lastEffect = -1;
  restart(s);
  tidy(s);
};

function geom(s, view) {
  const n = s.template.length;
  const big = view.h > 450 && view.w > 500;
  const side = 30;
  const cw = clamp((view.w - 2 * side) / n, 17, big ? 30 : 24);
  const t = translate(transcribe(s.template));
  let focus = s.mutPos - 0.5;
  if (s.tx < n) focus = s.tx;
  else if (t.codons.length && s.tl < t.codons.length) focus = t.start + 3 * Math.floor(s.tl) + 1.5;
  const total = n * cw;
  const x0 = total <= view.w - 2 * side ? (view.w - total) / 2 : clamp(view.w / 2 - focus * cw, view.w - side - total, side);
  const yD = big ? 64 : 38; // template strand
  const yM = yD + cw + 4; // mRNA being made
  const yTop = yM + cw / 2 + (s.tx < n ? 30 : 12); // line between the two bands
  const yR = Math.min(view.h - 56, yTop + cw * 4 + 70); // mRNA on the ribosome
  return { n, cw, x0, yD, yM, yTop, yR, big, t };
}

// Shrink the font until the line fits the width.
function fit(ctx, text, x, y, maxW, opts) {
  let size = opts.size;
  for (; size > 8; size--) {
    ctx.font = `${opts.bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  label(ctx, text, x, y, { ...opts, size });
}

function base(ctx, ch, x, y, cw, faded, ring) {
  const w = cw - 2;
  ctx.globalAlpha = faded ? 0.25 : 1;
  ctx.fillStyle = BASE_COLOR[ch];
  ctx.beginPath();
  ctx.roundRect(x + 1, y - w / 2, w, w, 4);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (ring) {
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x - 1, y - w / 2 - 2, w + 4, w + 4);
  }
  label(ctx, ch, x + cw / 2, y + 1, { color: "#fff", bold: true, size: Math.round(cw * 0.55), align: "center" });
}

function strand(ctx, g, text, y, left, right, opts = {}) {
  [...text].forEach((ch, i) => {
    const x = g.x0 + i * g.cw;
    base(ctx, ch, x, y, g.cw, opts.upTo != null && i >= opts.upTo, opts.ring === i);
  });
  const size = g.big ? 13 : 11;
  label(ctx, left, g.x0 - 5, y, { size, align: "right", bold: true, color: COLORS.muted });
  label(ctx, right, g.x0 + text.length * g.cw + 5, y, { size, bold: true, color: COLORS.muted });
}

function aminoAcid(ctx, name, x, y, r) {
  ctx.fillStyle = name === "Met" ? COLORS.green : COLORS.purple;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, name, x, y + 1, { color: "#fff", bold: true, size: Math.round(r * 0.8), align: "center" });
}

function drawTable(ctx, s, view) {
  const t = translate(transcribe(s.template));
  const c = Math.min(Math.floor(s.tl), t.codons.length - 1);
  const reading = s.tx >= s.template.length && t.codons.length ? t.codons[c] : null;
  const B = "UCAG";
  const head = 18;
  const cw = (view.w - head - 8) / 4;
  const ch = (view.h - head - 30) / 4;
  const size = Math.max(9, Math.min(14, ch / 5, cw / 6.2));
  fit(ctx, "Bảng mã di truyền (codon trên mRNA → amino acid; KT: bộ ba kết thúc)", view.w / 2, 10, view.w - 8, { size: Math.min(13, size + 1), align: "center", bold: true });
  for (let j = 0; j < 4; j++) label(ctx, B[j], head + cw * (j + 0.5), 28, { size: size + 1, align: "center", bold: true, color: BASE_COLOR[B[j]] });
  for (let i = 0; i < 4; i++) {
    const y = 36 + i * ch;
    label(ctx, B[i], 8, y + ch / 2, { size: size + 1, align: "center", bold: true, color: BASE_COLOR[B[i]] });
    for (let j = 0; j < 4; j++) {
      const x = head + j * cw;
      ctx.strokeStyle = COLORS.grid;
      ctx.strokeRect(x, y, cw, ch);
      for (let k = 0; k < 4; k++) {
        const codon = B[i] + B[j] + B[k];
        const aa = CODON_TABLE[codon];
        const yy = y + (ch * (k + 0.5)) / 4;
        if (codon === reading) {
          ctx.fillStyle = "#fde68a";
          ctx.fillRect(x + 1, yy - ch / 8, cw - 2, ch / 4);
        }
        const color = aa === STOP ? COLORS.red : codon === "AUG" ? COLORS.green : COLORS.ink;
        label(ctx, `${codon} ${aa}`, x + 6, yy, { size, color, bold: aa === STOP || codon === "AUG" });
      }
    }
  }
}

function drawScene(ctx, s, view) {
  const g = geom(s, view);
  const { n, cw, x0, yD, yM, yTop, yR, t } = g;
  const mrna = transcribe(s.template);
  const size = g.big ? 13 : 11;
  const transcribing = s.tx < n;

  // transcription band (nucleus)
  label(ctx, "Phiên mã: mạch khuôn DNA (3'→5') → mRNA (5'→3')", 8, yD - cw / 2 - 10, { size, color: COLORS.muted, bold: true });
  strand(ctx, g, s.template, yD, "3'", "5'", { ring: s.mutPos - 1 });
  strand(ctx, g, mrna.slice(0, Math.floor(s.tx)), yM, "5'", "", {});
  if (transcribing) {
    const x = x0 + s.tx * cw;
    ctx.fillStyle = "rgba(122, 90, 248, 0.25)";
    ctx.strokeStyle = COLORS.purple;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, (yD + yM) / 2, cw * 1.6, cw * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(ctx, "RNA polymerase", x, yM + cw * 1.1, { size, align: "center", color: COLORS.purple, bold: true });
  }

  // translation band (cytoplasm)
  ctx.strokeStyle = COLORS.grid;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, yTop);
  ctx.lineTo(view.w, yTop);
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, "Dịch mã trên ribosome (đọc từ AUG đầu tiên)", 8, yTop + 12, { size, color: COLORS.muted, bold: true });

  const info = [];
  if (!transcribing) {
    const nc = t.codons.length;
    const done = nc === 0 || s.tl >= nc;
    // codon frames from the first AUG
    t.codons.forEach((codon, k) => {
      const x = x0 + (t.start + 3 * k) * cw;
      ctx.fillStyle = k % 2 ? "rgba(31, 42, 68, 0.06)" : "rgba(31, 42, 68, 0.12)";
      ctx.fillRect(x, yR - cw / 2 - 3, 3 * cw, cw + 6);
    });
    const drawMrna = () => {
      strand(ctx, g, mrna, yR, "5'", "3'", {});
      t.codons.forEach((codon, k) => {
        const x = x0 + (t.start + 3 * k) * cw;
        const stop = CODON_TABLE[codon] === STOP;
        if (k === 0 || stop) {
          ctx.strokeStyle = stop ? COLORS.red : COLORS.green;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, yR - cw / 2 - 3, 3 * cw, cw + 6);
        }
      });
    };
    const r = Math.max(11, cw * 0.55);
    const yAA = yR - cw * 2.6 - r;
    if (nc === 0 || done) drawMrna();
    if (nc === 0) {
      info.push("Không có bộ ba mở đầu AUG: không dịch mã.");
    } else if (!done) {
      const c = Math.floor(s.tl);
      const codon = t.codons[c];
      const xc = x0 + (t.start + 3 * c + 1.5) * cw;
      // ribosome: large subunit above, small subunit below the mRNA
      ctx.fillStyle = "rgba(245, 197, 24, 0.28)";
      ctx.strokeStyle = "#c99a06";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(xc - cw * 0.8, yR - cw * 1.7, cw * 3.4, cw * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(xc - cw * 0.8, yR + cw * 0.95, cw * 3.2, cw * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawMrna();
      // polypeptide made so far, newest next to the ribosome
      const made = t.aminoAcids.slice(0, c);
      made.forEach((aa, k) => aminoAcid(ctx, aa, xc - (made.length - k) * (2 * r + 2), yAA, r));
      if (CODON_TABLE[codon] === STOP) {
        info.push(`Codon ${codon}: bộ ba kết thúc, không có tRNA tương ứng → dịch mã dừng.`);
      } else {
        const drop = (1 - Math.min(1, (s.tl - c) / 0.35)) * cw * 2;
        const yA = yR - cw * 1.25 - drop; // anticodon row
        ctx.strokeStyle = COLORS.purple;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(xc, yA - cw / 2);
        ctx.lineTo(xc, yAA - drop + r);
        ctx.stroke();
        strand(ctx, { ...g, x0: xc - 1.5 * cw }, anticodon(codon), yA, "", "", {});
        aminoAcid(ctx, CODON_TABLE[codon], xc, yAA - drop, r);
        info.push(`Codon ${codon} – anticodon ${anticodon(codon)} (tRNA) → ${CODON_TABLE[codon]}${c === 0 ? " (bộ ba mở đầu)" : ""}`);
      }
    } else {
      const w = t.aminoAcids.length * (2 * r + 2);
      t.aminoAcids.forEach((aa, k) => aminoAcid(ctx, aa, view.w / 2 - w / 2 + r + k * (2 * r + 2), yAA, r));
      info.push(t.stopped ? "Gặp bộ ba kết thúc: ribosome tách ra, giải phóng chuỗi polypeptide." : "Hết mRNA mà không gặp bộ ba kết thúc.");
    }
  }
  if (s.lastEffect >= 0) {
    info.unshift(`Đột biến vừa gây: ${EFFECT_SHORT[s.lastEffect]}`);
  }
  if (view.h - yR > 110) {
    fit(ctx, "Hình minh hoạ, không theo tỉ lệ. Kí hiệu amino acid 3 chữ cái; xanh lá: Met (mở đầu).", 8, view.h - 16, view.w - 16, { size, color: COLORS.muted });
  }
  info.slice(0, 2).forEach((line, k) => fit(ctx, line, 8, yR + cw * 1.5 + (g.big ? 24 : 12) + k * (size + 5), view.w - 16, { size, color: k === 0 && s.lastEffect >= 0 ? COLORS.red : COLORS.ink, bold: k === 0 }));
}

function emitDone(s, api) {
  const t = translate(transcribe(s.template));
  api.emit("translation-done", { codons: t.codons.length, aminoAcids: t.aminoAcids.length, stopped: t.stopped ? 1 : 0 }, "result");
  api.pause();
}

mount({
  slug: "phien-ma-dich-ma",
  version: "1.0.0",
  title: "Phiên mã và dịch mã",
  hint: "Bấm ▶ Chạy để xem phiên mã rồi dịch mã. Chạm vào một nucleotide trên mạch khuôn để chọn vị trí gây đột biến.",
  initialState,
  sanitize(incoming, base) {
    for (const key of Object.keys(base)) {
      const v = incoming[key];
      if (typeof v !== typeof base[key] || (typeof v === "number" && !Number.isFinite(v))) continue;
      if ((key === "template" || key === "original") && !new RegExp(`^[ATGC]{${MIN_LEN},36}$`).test(v)) continue;
      base[key] = v;
    }
    return tidy(base);
  },
  step(s, dt, api) {
    const n = s.template.length;
    const nc = translate(transcribe(s.template)).codons.length;
    if (s.tx >= n && s.tl >= nc) restart(s); // pressed ▶ after the end: play again from the start
    if (s.tx < n) {
      s.tx = Math.min(n, s.tx + TX_SPEED * dt);
      if (s.tx >= n && nc === 0) emitDone(s, api);
      return;
    }
    s.tl = Math.min(nc, s.tl + TL_SPEED * dt);
    if (s.tl >= nc) emitDone(s, api);
  },
  controls: [
    { type: "heading", label: "Gene" },
    {
      type: "select",
      key: "preset",
      label: "Chọn gene",
      options: [...PRESETS.map(p => ({ value: p.value, label: p.label })), { value: "custom", label: "Tự nhập mạch khuôn" }],
      onChange: loadPreset,
    },
    {
      type: "custom",
      render(box, api) {
        const head = document.createElement("span");
        head.className = "row-head";
        head.textContent = "Mạch khuôn DNA (3'→5'), chỉ A, T, G, C";
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 36;
        input.spellcheck = false;
        input.autocapitalize = "characters";
        input.style.cssText = "font-family:ui-monospace,monospace;font-size:14px;letter-spacing:1px;padding:6px;width:100%";
        input.addEventListener("change", () => {
          const s = api.state;
          const text = cleanTemplate(input.value);
          if (text.length >= MIN_LEN && text !== s.template) {
            s.template = s.original = text;
            s.preset = "custom";
            s.lastType = s.lastEffect = -1;
            restart(s);
            tidy(s);
            api.emit("param", { key: "template", value: text }, "param");
          }
          api.sync();
        });
        box.append(head, input);
        return () => {
          if (document.activeElement !== input) input.value = api.state.template;
        };
      },
    },
    { type: "button", label: "Phiên mã lại từ đầu", event: "restart-expression", action: (s, api) => (restart(s), api.play()) },
    { type: "checkbox", key: "showTable", label: "Xem bảng mã di truyền" },
    { type: "heading", label: "Đột biến điểm" },
    {
      type: "select",
      key: "mutType",
      label: "Dạng đột biến",
      options: Object.entries(MUTATIONS).map(([value, name]) => ({ value, label: `${name[0].toUpperCase()}${name.slice(1)} một cặp nucleotide` })),
    },
    { type: "stepper", key: "mutPos", label: "Vị trí trên mạch khuôn", min: 1, max: 36, onChange: tidy },
    {
      type: "select",
      key: "mutBase",
      label: "Nucleotide mới trên mạch khuôn",
      options: ["A", "T", "G", "C"].map(b => ({ value: b, label: b })),
      visible: s => s.mutType !== "del",
    },
    {
      type: "button",
      label: "Gây đột biến",
      primary: true,
      disabled: s => !!blocked(s),
      action(s, api) {
        const r = applyMutation(s);
        if (!r) return;
        api.emit("mutation-applied", { type: r.type, effect: r.effect, position: s.mutPos }, "result");
        if (s.target !== "none" && Number(s.target) === r.effect) api.emit("target-effect-made", { effect: r.effect }, "goal");
        api.play();
      },
    },
    { type: "button", label: "Khôi phục gene gốc", event: "restore-gene", action: s => ((s.template = s.original), (s.lastType = s.lastEffect = -1), restart(s), tidy(s)) },
    { type: "heading", label: "Thử thách" },
    { type: "select", key: "target", label: "Yêu cầu", options: TARGETS, onChange: s => (s.lastEffect = -1) },
  ],
  readouts: [
    { label: "mRNA (5'→3')", value: s => transcribe(s.template) },
    { label: "Chuỗi polypeptide", value: s => translate(transcribe(s.template)).aminoAcids.join("–") || "–" },
    { label: "Đột biến vừa gây", value: s => (s.lastEffect >= 0 ? EFFECTS[s.lastEffect] : blocked(s) ?? "–") },
    {
      label: "Thử thách",
      value: s => (s.target === "none" ? "–" : Number(s.target) === s.lastEffect ? "Đã đạt yêu cầu" : "Chưa đạt"),
    },
  ],
  pointer: {
    down(p, s, api, view) {
      if (s.showTable) return false;
      const g = geom(s, view);
      if (Math.abs(p.y - g.yD) > g.cw / 2 + 4) return false;
      const i = Math.floor((p.x - g.x0) / g.cw);
      if (i < 0 || i >= g.n) return false;
      s.mutPos = i + 1;
      api.emit("param", { key: "mutPos", value: s.mutPos }, "param");
    },
  },
  draw(ctx, s, view) {
    if (s.showTable) drawTable(ctx, s, view);
    else drawScene(ctx, s, view);
  },
});
