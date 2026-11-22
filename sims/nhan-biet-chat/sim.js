import { mount, COLORS, label } from "../../kit/v1/kit.js";
import {
  SOLUTIONS, SOLUTION_NAMES, REAGENTS, REAGENT_NAMES, REAGENT_SHORT, LOOKS, PRESETS, MAX_TUBES,
  initialState, preset, tubes, tests, addReagent, additions, clearRound, allLabelled, correctCount, determined, outcome, pretty,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const LIQUID = "rgba(190, 215, 240, 0.55)";
const PPT = { "ppt-white": "#f4f4f4", "ppt-yellow": "#f1df8a", "ppt-black": "#4a3a2c" };
const PAPER = { red: COLORS.red, blue: COLORS.blue, purple: COLORS.purple };

function geom(s, view) {
  const n = tubes(s).length;
  const small = view.h < 420 || view.w < 520;
  const banner = small ? 40 : 54;
  const cw = Math.min(110, (view.w - 16) / n);
  const x0 = (view.w - cw * n) / 2;
  const top = banner + (small ? 22 : 30);
  const th = Math.max(60, Math.min(260, (view.h - top) * 0.45));
  const tw = Math.min(cw * 0.5, Math.max(26, th * 0.2));
  return { n, small, banner, cw, x0, tw, top, th, cx: k => x0 + cw * (k + 0.5) };
}

const restart = s => {
  clearRound(s);
  s._last = null;
};

function report(s, api) {
  if (!allLabelled(s)) return;
  const total = tubes(s).length;
  const correct = correctCount(s);
  const n = additions(s);
  api.emit("labelled", { correct, total, additions: n }, "result");
  if (correct === total && determined(s) && n <= preset(s).best) api.emit("identified", { additions: n, best: preset(s).best }, "goal");
}

function add(s, api, k) {
  const o = addReagent(s, k, s.reagent);
  if (!o) return;
  s._last = { k, r: s.reagent };
  api.emit("add-reagent", { tube: k + 1, reagent: s.reagent, look: o.look });
}

function drawTube(ctx, x, y, w, h, look, target) {
  const r = w / 2;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x - r, y + h - r);
    ctx.arc(x, y + h - r, r, Math.PI, 0, true);
    ctx.lineTo(x + r, y);
  };
  // liquid fills the lower 60 %
  const ly = y + h * 0.4;
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = look === "pink" ? "rgba(236, 72, 153, 0.55)" : LIQUID;
  ctx.fillRect(x - r, ly, w, h);
  if (PPT[look]) {
    ctx.fillStyle = "rgba(200, 200, 200, 0.35)"; // cloudy
    ctx.fillRect(x - r, ly, w, h);
    ctx.fillStyle = PPT[look];
    ctx.strokeStyle = "#9aa3b2";
    ctx.beginPath();
    ctx.ellipse(x, y + h - r * 0.6, r, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (look === "gas") {
    ctx.strokeStyle = "#5b6b85";
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const bx = x + ((i * 37) % 11 - 5) * (r / 7);
      const by = ly + ((i * 53) % 17) * ((h * 0.55) / 17);
      ctx.beginPath();
      ctx.arc(bx, by, 1.5 + (i % 3), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  // litmus paper dipped in the sample
  if (PAPER[look]) {
    ctx.fillStyle = "#f1e9d2";
    ctx.fillRect(x - 3, y - 10, 6, h * 0.55);
    ctx.fillStyle = PAPER[look];
    ctx.fillRect(x - 3, ly, 6, y - 10 + h * 0.55 - ly);
  }
  ctx.strokeStyle = target ? COLORS.blue : COLORS.ink;
  ctx.lineWidth = target ? 3 : 1.5;
  path();
  ctx.stroke();
}

const fit = (ctx, text, max, size, bold) => {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  return w > max ? Math.max(8, (size * max) / w) : size;
};

mount({
  slug: "nhan-biet-chat",
  version: "1.0.0",
  title: "Nhận biết dung dịch bằng thuốc thử",
  hint: "Chọn thuốc thử rồi chạm vào một lọ (mỗi lần thử lấy một ít dung dịch làm mẫu thử). Quan sát hiện tượng, rồi dán nhãn cho từng lọ.",
  initialState,
  controls: [
    {
      type: "select",
      key: "preset",
      label: "Bộ lọ mất nhãn",
      options: Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })),
      onChange: restart,
    },
    { type: "heading", label: "Thử" },
    { type: "select", key: "reagent", label: "Thuốc thử", options: REAGENTS.map(r => ({ value: r, label: REAGENT_NAMES[r] })) },
    { type: "stepper", key: "target", label: "Nhỏ vào lọ số", min: 1, max: MAX_TUBES, onChange: s => (s.target = Math.min(s.target, tubes(s).length)) },
    { type: "button", label: "Nhỏ thuốc thử", primary: true, action: (s, api) => add(s, api, Math.min(s.target, tubes(s).length) - 1) },
    { type: "heading", label: "Dán nhãn" },
    ...Array.from({ length: MAX_TUBES }, (_, i) => ({
      type: "select",
      key: `l${i + 1}`,
      label: `Lọ ${i + 1}`,
      options: [{ value: "", label: "— chưa dán nhãn —" }, ...SOLUTIONS.map(f => ({ value: f, label: `${pretty(f)} (${SOLUTION_NAMES[f]})` }))],
      visible: s => i < tubes(s).length,
      onCommit: report,
    })),
    { type: "button", label: "Lượt mới (xáo lại các lọ)", event: "new-round", action: s => (restart(s), (s.seed = Math.floor(Math.random() * 1e6))) },
  ],
  readouts: [
    { label: "Số lần nhỏ thuốc thử", value: s => String(additions(s)) },
    { label: "Ít nhất cần (mọi thứ tự lọ)", value: s => String(preset(s).best) },
    { label: "Số lọ dán nhãn đúng", value: s => (allLabelled(s) ? `${correctCount(s)}/${tubes(s).length}` : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      const k = Math.floor((p.x - g.x0) / g.cw);
      if (k < 0 || k >= g.n || p.y < g.banner || p.y > g.top + g.th + 30) return false;
      s.target = k + 1;
      add(s, api, k);
      return false;
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const hidden = tubes(s);
    const done = allLabelled(s);
    const size = g.small ? 12 : 14;

    // banner: last observation, then (once every tube is labelled) the verdict and the equation
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, view.w, g.banner);
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(0, g.banner - 1, view.w, 1);
    const last = s._last && s._last.k < g.n ? s._last : null;
    const o = last && outcome(hidden[last.k], last.r);
    const line1 = o ? `Lọ ${last.k + 1} + ${REAGENT_NAMES[last.r]}: ${LOOKS[o.look].toLowerCase()}` : "Chọn thuốc thử rồi chạm vào một lọ để thử.";
    label(ctx, line1, view.w / 2, g.banner * 0.32, { align: "center", bold: true, size: fit(ctx, line1, view.w - 16, size + 1, true) });
    let line2;
    if (done) {
      const c = correctCount(s);
      line2 = `Đúng ${c}/${g.n} lọ · ${additions(s)} lần thử (ít nhất ${preset(s).best})`;
      if (o?.eq) line2 += ` · ${pretty(o.eq)}`;
      else if (o?.note) line2 += ` · ${o.note}`;
    } else {
      line2 = "Các lọ chứa: " + preset(s).solutions.map(pretty).join(", ");
    }
    label(ctx, line2, view.w / 2, g.banner * 0.74, { align: "center", color: done && correctCount(s) === g.n ? COLORS.green : COLORS.muted, size: fit(ctx, line2, view.w - 16, size - 1) });

    if (!g.small || view.h > 380) {
      const legend = "Ô màu: hiện tượng thấy được · ↓ kết tủa · ↑ khí · – không có hiện tượng";
      label(ctx, legend, view.w / 2, view.h - 12, { align: "center", color: COLORS.muted, size: fit(ctx, legend, view.w - 16, 12) });
    }

    hidden.forEach((sol, k) => {
      const x = g.cx(k);
      const list = tests(s, k);
      label(ctx, `Lọ ${k + 1}`, x, g.top - (g.small ? 10 : 14), { align: "center", bold: true, size: fit(ctx, `Lọ ${k + 1}`, g.cw - 4, size, true), color: s.target === k + 1 ? COLORS.blue : COLORS.ink });
      drawTube(ctx, x, g.top, g.tw, g.th, list.length ? outcome(sol, list.at(-1)).look : "clear", s.target === k + 1);

      // the learner's label
      const mine = s[`l${k + 1}`];
      let y = g.top + g.th + (g.small ? 12 : 16);
      const text = mine ? pretty(mine) + (done ? (mine === sol ? " ✓" : " ✗") : "") : "?";
      label(ctx, text, x, y, {
        align: "center",
        bold: true,
        size: fit(ctx, text, g.cw - 4, size, true),
        color: !mine ? COLORS.muted : done ? (mine === sol ? COLORS.green : COLORS.red) : COLORS.ink,
      });

      // one chip per reagent tried on this tube (latest result wins)
      const seen = [...new Set(list)];
      const chipH = g.small ? 14 : 17;
      y += g.small ? 14 : 18;
      for (const r of seen) {
        if (y > view.h - chipH / 2 - (g.small && view.h <= 380 ? 0 : 24)) break;
        const look = outcome(sol, r).look;
        const sw = chipH * 0.7;
        const name = REAGENT_SHORT[r];
        const cs = fit(ctx, name, g.cw - sw - 10, g.small ? 10 : 12);
        ctx.font = `${cs}px ${FONT}`;
        const tw = ctx.measureText(name).width;
        const left = x - (tw + sw + 4) / 2;
        label(ctx, name, left, y, { size: cs, color: COLORS.muted });
        const sx = left + tw + 4;
        ctx.fillStyle = PAPER[look] ?? PPT[look] ?? (look === "pink" ? "#ec4899" : "#fff");
        ctx.strokeStyle = COLORS.muted;
        ctx.lineWidth = 1;
        ctx.fillRect(sx, y - sw / 2, sw, sw);
        ctx.strokeRect(sx, y - sw / 2, sw, sw);
        const mark = look.startsWith("ppt") ? "↓" : look === "gas" ? "↑" : look === "clear" ? "–" : "";
        if (mark) label(ctx, mark, sx + sw / 2, y, { align: "center", size: sw, bold: true, color: look === "ppt-black" ? "#fff" : COLORS.ink });
        y += chipH;
      }
    });
  },
});
