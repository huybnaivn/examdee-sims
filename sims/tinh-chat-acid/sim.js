import { mount, COLORS, label } from "../../kit/v1/kit.js";
import {
  REAGENTS, TARGETS, REAGENT_INFO, TARGET_INFO, initialState, outcome, tubeLook, isDone, perform, doneCount, reactedCount, complete, pretty,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const CELLS = REAGENTS.length * TARGETS.length;
const LIQUID = { clear: "rgba(190, 215, 240, 0.55)", pink: "rgba(236, 72, 153, 0.5)", blue: "rgba(47, 130, 237, 0.55)", green: "rgba(150, 205, 140, 0.6)" };
const SOLID = { Zn: "#aab2bd", Fe: "#5d6470", Cu: "#b8652e", CuO: "#222", CaCO3: "#f4f4f0" };
const PPT = { white: "#f6f6f6", blue: "#4f9be8" };
const PAPER = { purple: COLORS.purple, red: COLORS.red, blue: COLORS.blue };

/** Font size at which `text` fits in `max` px (never below 9). */
const fit = (ctx, text, max, size, bold) => {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  return w > max ? Math.max(9, (size * max) / w) : size;
};

// One result per experiment; the goal once, when the last cell of the table is filled.
function run(s, api) {
  const was = complete(s);
  const o = perform(s);
  if (!o) return;
  const data = { reagent: REAGENTS.indexOf(s.reagent), target: TARGETS.indexOf(s.target), reacted: o.r };
  api.emit("experiment", data, "result");
  if (!was && complete(s)) api.emit("table-complete", { experiments: CELLS }, "goal");
}

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 6 : 16;
  const banner = small ? 52 : 84;
  const foot = small ? 0 : 22;
  const tubeW = small ? Math.min(80, view.w * 0.22) : Math.min(220, view.w * 0.28);
  const gw = Math.min(view.w - tubeW - pad * 2, 600);
  const rowH = Math.min(small ? 26 : 44, (view.h - banner - pad * 2 - foot) / (TARGETS.length + 1));
  const first = small ? 62 : 130;
  const x0 = (view.w - tubeW - gw) / 2;
  return { small, pad, banner, tubeW, x0, gx: x0 + tubeW, gy: banner + pad, gw, rowH, first, cw: (gw - first) / REAGENTS.length, gh: rowH * (TARGETS.length + 1) };
}

function drawTube(ctx, x, y, w, h, look) {
  const r = w / 2;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x - r, y + h - r);
    ctx.arc(x, y + h - r, r, Math.PI, 0, true);
    ctx.lineTo(x + r, y);
  };
  const ly = y + h * (1 - look.level);
  ctx.save();
  path();
  ctx.clip();
  if (look.level > 0) {
    ctx.fillStyle = LIQUID[look.liquid] ?? LIQUID.clear;
    ctx.fillRect(x - r, ly, w, h);
  }
  if (look.ppt) {
    ctx.fillStyle = "rgba(200, 200, 200, 0.3)"; // cloudy
    ctx.fillRect(x - r, ly, w, h);
    ctx.fillStyle = PPT[look.ppt];
    ctx.strokeStyle = "#8f9bb0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y + h - r * 0.5, r, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (look.solid) {
    // a small heap at the bottom
    ctx.fillStyle = SOLID[look.solid];
    ctx.strokeStyle = "#7d8798";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y + h - r * 0.55, r * 0.72, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (look.gas) {
    ctx.strokeStyle = "#5b6b85";
    ctx.lineWidth = 1;
    const span = y + h - r - ly;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(x + (((i * 37) % 11) - 5) * (r / 7), ly + 4 + (((i * 53) % 17) / 17) * span, 1.5 + (i % 3), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  if (look.paper) {
    // litmus paper: the dipped part shows the new colour
    const pw = Math.max(5, w * 0.22);
    const bottom = y + h * 0.72;
    ctx.fillStyle = PAPER.purple;
    ctx.fillRect(x - pw / 2, y - 10, pw, bottom - y + 10);
    if (look.level > 0) {
      ctx.fillStyle = PAPER[look.paper];
      ctx.fillRect(x - pw / 2, ly, pw, bottom - ly);
    }
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  path();
  ctx.stroke();
}

mount({
  slug: "tinh-chat-acid",
  version: "1.0.0",
  title: "Tính chất hóa học của acid và base",
  hint: "Chọn dung dịch và chất trong ống nghiệm rồi bấm «Làm thí nghiệm», hoặc chạm thẳng vào một ô của bảng. Làm đủ các ô để hoàn thành bảng tính chất.",
  initialState,
  controls: [
    { type: "select", key: "reagent", label: "Dung dịch cho vào", options: REAGENTS.map(r => ({ value: r, label: REAGENT_INFO[r].name })) },
    { type: "select", key: "target", label: "Chất trong ống nghiệm", options: TARGETS.map(t => ({ value: t, label: TARGET_INFO[t].name })) },
    { type: "button", label: "Làm thí nghiệm", primary: true, action: run },
  ],
  readouts: [
    { label: "Thí nghiệm đã làm", value: s => `${doneCount(s)}/${CELLS}` },
    { label: "Có phản ứng / đổi màu", value: s => String(reactedCount(s)) },
    { label: "Bảng tính chất", value: s => (complete(s) ? "Đã hoàn thành ✓" : "Chưa đủ") },
  ],
  pointer: {
    // Tapping a cell of the table chooses that pair and does the experiment.
    down(p, s, api, view) {
      const g = geom(view);
      const col = Math.floor((p.x - g.gx - g.first) / g.cw);
      const row = Math.floor((p.y - g.gy) / g.rowH) - 1;
      if (col >= 0 && col < REAGENTS.length && row >= 0 && row < TARGETS.length) {
        s.reagent = REAGENTS[col];
        s.target = TARGETS[row];
        run(s, api);
        api.sync();
      }
      return false;
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const done = isDone(s, s.reagent, s.target);
    const o = outcome(s.reagent, s.target);
    const formula = pretty(REAGENT_INFO[s.reagent].formula);
    const isAcid = REAGENT_INFO[s.reagent].kind === "acid";
    const partner = s.target === "neut" ? (isAcid ? "dung dịch NaOH" : "dung dịch HCl") : TARGET_INFO[s.target].short;
    const size = g.small ? 12 : 16;

    // banner: the pair, what is observed, the equation (or why nothing happens)
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, view.w, g.banner);
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(0, g.banner - 1, view.w, 1);
    const lines = [
      [`${formula} + ${partner}`, COLORS.ink, true, size + 1],
      done ? [o.obs, o.r ? COLORS.green : COLORS.muted, false, size] : ["Chưa làm thí nghiệm này: bấm «Làm thí nghiệm» hoặc chạm vào ô.", COLORS.muted, false, size],
      done ? [o.eq ? pretty(o.eq) : o.note, o.eq ? COLORS.blue : COLORS.muted, !!o.eq, size] : ["", COLORS.muted, false, size],
    ];
    lines.forEach(([text, color, bold, sz], i) => {
      label(ctx, text, view.w / 2, (g.banner * (i + 0.5)) / 3, { align: "center", color, bold, size: fit(ctx, text, view.w - 12, sz, bold) });
    });

    // test tube with the chosen substance, before or after the solution is added
    const tw = Math.min(g.tubeW * 0.42, g.small ? 30 : 58);
    const th = Math.min(g.gh - (g.small ? 40 : 70), tw * 5);
    const tx = g.x0 + g.tubeW / 2 - (g.small ? 2 : 6);
    const ty = g.gy + (g.small ? 16 : 30);
    drawTube(ctx, tx, ty, tw, th, tubeLook(s.reagent, s.target, done));
    const cap = done ? `đã thêm ${formula}` : "chưa thêm dung dịch";
    const capW = g.tubeW - 6;
    label(ctx, partner, tx, ty + th + (g.small ? 12 : 18), { align: "center", bold: true, size: fit(ctx, partner, capW, size - 1, true) });
    label(ctx, cap, tx, ty + th + (g.small ? 26 : 38), { align: "center", color: COLORS.muted, size: fit(ctx, cap, capW, size - 2) });

    // property table: rows are the substances in the tube, columns the four solutions
    ctx.fillStyle = "#fff";
    ctx.fillRect(g.gx, g.gy, g.gw, g.gh);
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(g.gx, g.gy, g.gw, g.rowH);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let r = 1; r <= TARGETS.length + 1; r++) {
      ctx.beginPath();
      ctx.moveTo(g.gx, g.gy + g.rowH * r);
      ctx.lineTo(g.gx + g.gw, g.gy + g.rowH * r);
      ctx.stroke();
    }
    for (let c = 0; c <= REAGENTS.length; c++) {
      const x = c === 0 ? g.gx : g.gx + g.first + g.cw * c;
      ctx.beginPath();
      ctx.moveTo(x, g.gy);
      ctx.lineTo(x, g.gy + g.gh);
      ctx.stroke();
    }
    const cellSize = g.small ? 11 : 14;
    REAGENTS.forEach((r, c) => {
      const cx = g.gx + g.first + g.cw * (c + 0.5);
      const head = pretty(REAGENT_INFO[r].formula);
      label(ctx, head, cx, g.gy + g.rowH / 2, { align: "center", bold: true, size: fit(ctx, head, g.cw - 4, cellSize, true), color: r === s.reagent ? COLORS.blue : COLORS.ink });
      TARGETS.forEach((t, k) => {
        const cy = g.gy + g.rowH * (k + 1.5);
        if (c === 0) {
          const name = g.small ? TARGET_INFO[t].short : TARGET_INFO[t].name.replace(/ \(.*\)$/, "");
          label(ctx, name, g.gx + 5, cy, { size: fit(ctx, name, g.first - 8, cellSize), color: t === s.target ? COLORS.blue : COLORS.ink, bold: t === s.target });
        }
        if (isDone(s, r, t)) {
          const res = outcome(r, t);
          const color = t === "quy" ? PAPER[res.look.paper] : res.r ? COLORS.green : COLORS.muted;
          label(ctx, res.mark, cx, cy, { align: "center", bold: !!res.r, color, size: fit(ctx, res.mark, g.cw - 4, cellSize, !!res.r) });
        } else {
          label(ctx, "?", cx, cy, { align: "center", color: "#c3cbd9", size: cellSize });
        }
        if (r === s.reagent && t === s.target) {
          ctx.strokeStyle = COLORS.blue;
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - g.cw / 2 + 1, cy - g.rowH / 2 + 1, g.cw - 2, g.rowH - 2);
          ctx.strokeStyle = COLORS.grid;
          ctx.lineWidth = 1;
        }
      });
    });

    if (!g.small) {
      const note = "↑ có khí thoát ra · ↓ có kết tủa · – không có hiện tượng · Dung dịch loãng, nhiệt độ thường; hình vẽ minh họa, không theo tỉ lệ.";
      label(ctx, note, view.w / 2, view.h - 14, { align: "center", color: COLORS.muted, size: fit(ctx, note, view.w - 16, 12) });
    }
  },
});
