import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import { BINS, SAMPLES, SUBSTANCES, ATOMS, ATOM, initialState, sampleOf, placedIn, place, isCorrect, score, picture } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const TINT = { "Chất tinh khiết": "#dfeaff", "Hỗn hợp": "#ffe9cf" };
const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const selected = s => sampleOf(s.sel) ?? SAMPLES[0];

/** Text centred in a width, shrunk (down to 8 px) until it fits. */
function fit(ctx, text, cx, cy, maxW, { size, bold = false, color = COLORS.ink, align = "center" }) {
  let px = size;
  for (; px > 8; px -= 0.5) {
    ctx.font = `${bold ? "600 " : ""}${px}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  label(ctx, text, cx, cy, { size: px, bold, color, align });
}

// One action per sort; a result each time every sample has a place; the goal when all are right.
function report(s, api, id) {
  const sc = score(s);
  const bin = BINS.findIndex(b => b.id === placedIn(s, id)) + 1;
  api.emit("sort", { sample: SAMPLES.indexOf(sampleOf(id)) + 1, bin, correct: isCorrect(s, id) ? 1 : 0 }, "action");
  if (bin && sc.done) api.emit("all-sorted", { correct: sc.correct, total: sc.total }, "result");
  if (bin && sc.allCorrect) api.emit("all-correct", { total: sc.total }, "goal");
}

// Tree (two parents, four leaf bins) on top, tray of unsorted samples under it, zoom beside or below.
function geom(s, view) {
  const { w, h } = view;
  const small = w < 560 || h < 430;
  const side = w >= 680;
  const zw = side ? Math.min(340, w * 0.38) : w;
  const zh = side ? h : clamp(h * 0.42, 100, 240);
  const zoom = side ? { x: w - zw, y: 0, w: zw, h } : { x: 0, y: h - zh, w, h: zh };
  const mw = side ? w - zw : w;
  const mh = side ? h : h - zh;
  const pad = small ? 4 : 12;
  const gap = small ? 3 : 8;
  const ch = small ? 18 : 30; // chip height
  const ph = small ? 15 : 28; // parent row
  const hh = small ? 14 : 26; // bin header
  const trayLabel = small ? 0 : 24;
  const trayH = trayLabel + 2 * (ch + 4);
  const binsY = pad + ph + 2;
  const binsH = Math.max(40, mh - binsY - trayH - 2 * gap - (small ? 0 : pad));
  const colW = (mw - 2 * pad - 3 * gap) / 4;
  const bins = BINS.map((bin, k) => ({ ...bin, x: pad + k * (colW + gap), y: binsY, w: colW, h: binsH }));
  const tray = { x: pad, y: binsY + binsH + gap, w: mw - 2 * pad, h: trayH, label: trayLabel };
  const tw = (tray.w - 3 * 4) / 4;
  const chips = SAMPLES.map((sample, i) => {
    const bin = bins.find(b => b.id === placedIn(s, sample.id));
    if (!bin) return { sample, x: tray.x + (i % 4) * (tw + 4), y: tray.y + trayLabel + Math.floor(i / 4) * (ch + 4), w: tw, h: ch };
    const mates = SAMPLES.filter(other => placedIn(s, other.id) === bin.id);
    const ht = Math.min(ch, (binsH - hh - 4) / mates.length - 2);
    return { sample, x: bin.x + 3, y: bin.y + hh + 3 + mates.indexOf(sample) * (ht + 2), w: colW - 6, h: ht };
  });
  return { small, side, zoom, pad, ph, hh, bins, tray, chips, colW, gap };
}

function drawParticle(ctx, part, cx, cy, unit) {
  const cos = Math.cos(part.rot ?? 0);
  const sin = Math.sin(part.rot ?? 0);
  for (const [el, dx, dy] of part.atoms) {
    const r = ATOMS[el].r * unit;
    const x = cx + (dx * cos - dy * sin) * unit;
    const y = cy + (dx * sin + dy * cos) * unit;
    ctx.fillStyle = ATOMS[el].color;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (part.charge && r >= 4.5) label(ctx, part.charge, x, y + 0.5, { size: r * 1.5, align: "center", bold: true });
  }
}

function drawZoom(ctx, s, g) {
  const z = g.zoom;
  const sample = selected(s);
  const lines = sample.parts.map(([sub]) => {
    const def = SUBSTANCES[sub];
    return { sub, def, text: def.ions ? `${def.ions.map(([el, charge]) => el + (charge === "+" ? "⁺" : "⁻")).join(", ")} – ${def.name}` : `${def.formula} – ${def.name}` };
  });
  const lineH = g.small ? 15 : 22;
  const size = g.small ? 11 : 14;
  let R, cx, cy, tx, ty, tw;
  if (g.side) {
    R = Math.max(30, Math.min(z.w / 2 - 20, (z.h - 60 - lines.length * lineH - 40) / 2));
    cx = z.x + z.w / 2;
    cy = z.y + 50 + R;
    tx = z.x + 18;
    ty = cy + R + 24;
    tw = z.w - 36;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(z.x, 0);
    ctx.lineTo(z.x, z.h);
    ctx.stroke();
    fit(ctx, `Phóng to: ${sample.name}`, cx, z.y + 24, z.w - 20, { size: 17, bold: true });
  } else {
    R = Math.max(24, Math.min(z.h / 2 - 5, z.w * 0.2));
    cx = z.x + 8 + R;
    cy = z.y + z.h / 2;
    tx = cx + R + 12;
    tw = z.x + z.w - tx - 6;
    ty = cy - ((lines.length + 2) * lineH) / 2 + lineH / 2;
    fit(ctx, `Phóng to: ${sample.name}`, tx, ty, tw, { size: size + 1, bold: true, align: "left" });
    ty += lineH + 2;
  }
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (const part of picture(sample)) drawParticle(ctx, part, cx + part.x * R, cy + part.y * R, ATOM * R);

  // legend: one line per substance
  const unit = g.small ? 3.4 : 4.6;
  for (const line of lines) {
    if (line.def.ions) line.def.ions.forEach(([el, charge], k) => drawParticle(ctx, { atoms: [[el, 0, 0]], charge }, tx + 8 + k * unit * 3.4, ty, unit * 1.15));
    else drawParticle(ctx, { atoms: line.def.shape }, tx + unit * 3.2, ty - unit * 0.3, unit);
    fit(ctx, line.text, tx + unit * 7.6, ty, tw - unit * 7.6, { size, align: "left" });
    ty += lineH;
  }
  fit(ctx, g.small ? "Hình quy ước, không theo tỉ lệ." : "Hình vẽ quy ước, không theo tỉ lệ.", tx, ty + 2, tw, { size: size - 1, color: COLORS.muted, align: "left" });
}

mount({
  slug: "phan-loai-chat",
  version: "1.0.0",
  title: "Chất tinh khiết, hỗn hợp, đơn chất và hợp chất",
  hint: "Bấm vào một mẫu để xem các hạt của nó, rồi kéo mẫu vào đúng nhóm trên sơ đồ phân loại.",
  initialState,
  controls: [
    { type: "select", key: "sel", label: "Mẫu đang xem", options: SAMPLES.map(sample => ({ value: sample.id, label: sample.name })) },
    {
      type: "select",
      key: "bin",
      label: "Nhóm để xếp mẫu này",
      options: BINS.map(bin => ({ value: bin.id, label: `${bin.parent} – ${bin.label.toLowerCase()}` })),
    },
    {
      type: "button",
      label: "Xếp mẫu vào nhóm đã chọn",
      primary: true,
      action(s, api) {
        if (place(s, selected(s).id, s.bin)) report(s, api, selected(s).id);
      },
    },
    {
      type: "button",
      label: "Lấy mẫu ra khỏi nhóm",
      disabled: s => !placedIn(s, selected(s).id),
      action(s, api) {
        if (place(s, selected(s).id, "")) report(s, api, selected(s).id);
      },
    },
  ],
  readouts: [
    { label: "Đã phân loại", value: s => `${score(s).placed}/${score(s).total} mẫu` },
    { label: "Số mẫu đúng", value: s => (score(s).done ? `${score(s).correct}/${score(s).total}` : "– (xếp hết để chấm)") },
  ],
  pointer: {
    down(p, s, api, view) {
      const chip = geom(s, view).chips.find(c => inside(p, { x: c.x, y: c.y - 2, w: c.w, h: c.h + 4 }));
      if (!chip) return false;
      s.sel = chip.sample.id;
      s._drag = { id: chip.sample.id, dx: p.x - chip.x, dy: p.y - chip.y, x0: p.x, y0: p.y, x: chip.x, y: chip.y, w: chip.w, h: chip.h, moved: false, px: p.x, py: p.y };
    },
    move(p, s) {
      const d = s._drag;
      if (!d) return;
      if (Math.hypot(p.x - d.x0, p.y - d.y0) > 6) d.moved = true;
      Object.assign(d, { x: p.x - d.dx, y: p.y - d.dy, px: p.x, py: p.y });
    },
    up(p, s, api, view) {
      const d = s._drag;
      delete s._drag;
      if (!d) return;
      if (!d.moved) {
        api.emit("param", { key: "sel", value: s.sel }, "param");
        return;
      }
      const g = geom(s, view);
      const bin = g.bins.find(b => inside(p, b));
      const target = bin ? bin.id : inside(p, g.tray) ? "" : null; // dropped elsewhere: back where it was
      if (target !== null && place(s, d.id, target)) report(s, api, d.id);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const sc = score(s);
    const drag = s._drag?.moved ? s._drag : null;
    const size = g.small ? 10 : 14;

    // classification tree: two parents over four leaves
    ["Chất tinh khiết", "Hỗn hợp"].forEach((name, k) => {
      const a = g.bins[2 * k];
      const b = g.bins[2 * k + 1];
      ctx.fillStyle = TINT[name];
      ctx.fillRect(a.x, g.pad, b.x + b.w - a.x, g.ph);
      fit(ctx, name, (a.x + b.x + b.w) / 2, g.pad + g.ph / 2, b.x + b.w - a.x - 6, { size: size + 1, bold: true });
    });
    for (const bin of g.bins) {
      const hot = drag && inside({ x: drag.px, y: drag.py }, bin);
      ctx.fillStyle = "#fff";
      ctx.fillRect(bin.x, bin.y, bin.w, bin.h);
      ctx.fillStyle = TINT[bin.parent];
      ctx.fillRect(bin.x, bin.y, bin.w, g.hh);
      ctx.strokeStyle = hot ? COLORS.blue : COLORS.muted;
      ctx.lineWidth = hot ? 2.5 : 1;
      ctx.strokeRect(bin.x, bin.y, bin.w, bin.h);
      fit(ctx, bin.label, bin.x + bin.w / 2, bin.y + g.hh / 2, bin.w - 4, { size, bold: true });
    }

    // tray
    const t = g.tray;
    if (t.label) label(ctx, "Mẫu chưa phân loại: bấm để phóng to, kéo vào nhóm phù hợp", t.x, t.y + 10, { size: 12, color: COLORS.muted });
    if (sc.done) {
      const text = sc.allCorrect ? `✓ Chính xác! Cả ${sc.total} mẫu đã được phân loại đúng.` : `Đúng ${sc.correct}/${sc.total} mẫu. Kéo các mẫu có dấu ✗ sang nhóm khác.`;
      fit(ctx, text, t.x + t.w / 2, t.y + t.label + (t.h - t.label) / 2, t.w - 8, { size: size + 2, bold: true, color: sc.allCorrect ? COLORS.green : COLORS.orange });
    }

    // chips (the dragged one last, under the pointer)
    const chip = (c, x, y) => {
      const placed = placedIn(s, c.sample.id);
      const mark = sc.done && placed ? (isCorrect(s, c.sample.id) ? "✓ " : "✗ ") : "";
      ctx.fillStyle = mark === "✓ " ? "#dff5ea" : mark === "✗ " ? "#fde4e4" : "#fff";
      ctx.strokeStyle = c.sample.id === s.sel ? COLORS.blue : mark === "✓ " ? COLORS.green : mark === "✗ " ? COLORS.red : COLORS.muted;
      ctx.lineWidth = c.sample.id === s.sel ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.roundRect(x, y, c.w, c.h, Math.min(6, c.h / 3));
      ctx.fill();
      ctx.stroke();
      fit(ctx, mark + c.sample.name, x + c.w / 2, y + c.h / 2 + 0.5, c.w - 6, { size: Math.min(size, c.h - 3) });
    };
    for (const c of g.chips) if (!drag || c.sample.id !== drag.id) chip(c, c.x, c.y);
    drawZoom(ctx, s, g);
    if (drag) chip({ sample: sampleOf(drag.id), w: drag.w, h: drag.h }, drag.x, drag.y);
  },
});
