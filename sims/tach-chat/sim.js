import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import {
  COMPONENTS, MIXTURES, METHODS, CHALLENGE, PLACES, RECOMMENDED, initialState, endOf, progressOf, analyse, outcome, runSequence,
  distillTemp, mixtureOf, methodOf, miscible,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const DURATION = 4; // seconds of animation per method
const challenge = s => s.mode === "challenge";
const index = (list, id) => list.findIndex(x => x.id === id) + 1;
const sum = comps => Object.values(comps).reduce((a, b) => a + b, 0);
const scale = (comps, f) => Object.fromEntries(Object.entries(comps).map(([id, m]) => [id, m * f]));
const merge = (...list) => list.reduce((out, comps) => (Object.entries(comps).forEach(([id, m]) => (out[id] = (out[id] ?? 0) + m)), out), {});
const names = comps => Object.entries(comps).map(([id, m]) => `${COMPONENTS[id].name} ${fmt(m, 0)} g`).join(" + ");
const cap1 = text => text[0].toUpperCase() + text.slice(1);
const listing = fractions => fractions.map(f => `${cap1(PLACES[f.place])}: ${names(f.comps)}.`).join(" ");

/** What is on stage now: the method being run, what went into it, its fractions and its own progress 0…1. */
function current(s) {
  const P = progressOf(s);
  if (!challenge(s)) {
    const o = outcome(s.mixture, s.method);
    return { ...o, method: methodOf(s.method), p: P, step: 0 };
  }
  const run = runSequence(s.step1, s.step2);
  const step = P < 1 ? 0 : 1;
  return { ...run.steps[step], method: methodOf(run.steps[step].method), p: P - step, step: step + 1, run };
}

function reset(s, api) {
  s.progress = 0;
  s.started = false;
  api.pause();
}

function begin(s, api) {
  s.progress = 0;
  s.started = true;
  if (challenge(s)) api.emit("try-sequence", { step1: index(METHODS, s.step1), step2: index(METHODS, s.step2) }, "action");
  else api.emit("try-method", { mixture: index(MIXTURES, s.mixture), method: index(METHODS, s.method) }, "action");
}

function finish(s, api) {
  s._doneAt = performance.now();
  if (challenge(s)) {
    const run = runSequence(s.step1, s.step2);
    const data = { step1: index(METHODS, s.step1), step2: index(METHODS, s.step2) };
    api.emit("sequence-done", { ...data, success: run.success ? 1 : 0 }, "result");
    if (run.success) api.emit("challenge-solved", data, "goal");
  } else {
    const o = outcome(s.mixture, s.method);
    api.emit("separation-done", { mixture: index(MIXTURES, s.mixture), method: index(METHODS, s.method), success: o.works ? 1 : 0, recommended: o.recommended ? 1 : 0 }, "result");
  }
}

// ---------- drawing ----------

const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));

const rand = (n, a, b) => {
  const v = Math.sin(n * a + b) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Fill a box (local units) with a mixture: liquid layers by density, grains for undissolved solids.
 * `cap` g of liquid fills the box. Grains pile up from the bottom, inside `shape` (the vessel outline) when given.
 * opts: perGram (grains drawn per gram), hang (stack downwards from the top: grains under a magnet).
 */
function contents(ctx, box, comps, cap, shape, { perGram = 2.2, hang = false } = {}) {
  const a = analyse(comps);
  if (!a.ids.length) return;
  const bottom = box.y + box.h;
  const solid = a.undissolved.reduce((m, id) => m + comps[id], 0);
  // liquid layers, densest first; liquids that mix (and dissolved solids) share a layer
  const order = [...a.liquids].sort((p, q) => COMPONENTS[q].density - COMPONENTS[p].density);
  const layers = [];
  for (const id of order) {
    const mass = comps[id] + a.dissolved.filter(d => a.solvent(d) === id).reduce((m, d) => m + comps[d], 0);
    const mate = layers.find(layer => layer.ids.every(other => miscible(other, id)));
    if (mate) Object.assign(mate, { ids: [...mate.ids, id], mass: mate.mass + mass, masses: [...mate.masses, comps[id]] });
    else layers.push({ ids: [id], mass, masses: [comps[id]] });
  }
  let level = bottom;
  layers.forEach((layer, k) => {
    const h = ((layer.mass + (k === 0 ? solid : 0)) / cap) * box.h;
    const total = layer.masses.reduce((x, y) => x + y, 0);
    const rgb = [0, 1, 2].map(c => Math.round(layer.ids.reduce((v, id, j) => v + hex(COMPONENTS[id].color)[c] * layer.masses[j], 0) / total));
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.fillRect(box.x, level - h, box.w, h);
    ctx.fillStyle = "rgba(31, 42, 68, 0.35)";
    ctx.fillRect(box.x, level - h, box.w, 0.35);
    level -= h;
  });
  if (!solid) return;
  // grains: a jittered grid filled row by row from the centre outwards, so the pile takes the vessel's shape
  const m = ctx.getTransform();
  const inShape = (x, y) => !shape || ctx.isPointInPath(shape, m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f);
  const size = 1.15;
  const pitch = 1.5;
  const total = Math.ceil(solid * perGram - 0.01);
  const cols = Math.floor(box.w / pitch);
  const share = a.undissolved.map(id => comps[id] / solid);
  ctx.strokeStyle = "rgba(31, 42, 68, 0.7)";
  ctx.lineWidth = 0.18;
  let placed = 0;
  for (let row = 0, n = 0; placed < total && row < Math.floor(box.h / pitch); row++) {
    for (let k = 0; placed < total && k < cols; k++, n++) {
      const col = Math.floor(cols / 2) + (k % 2 ? 1 : -1) * Math.ceil(k / 2);
      const x = box.x + col * pitch + rand(n, 12.9898, 1.3) * 0.3;
      const y = (hang ? box.y + row * pitch : bottom - (row + 1) * pitch) + rand(n, 78.233, 4.1) * 0.3;
      if (col < 0 || col >= cols || !inShape(x, y) || !inShape(x + size, y) || !inShape(x, y + size) || !inShape(x + size, y + size)) continue;
      // which solid this grain is: fixed per grid place, in proportion to the masses
      let pickAt = rand(n, 39.3468, 2.7);
      const which = Math.max(0, share.findIndex(f => (pickAt -= f) < 0));
      ctx.fillStyle = COMPONENTS[a.undissolved[which]].color;
      ctx.fillRect(x, y, size, size);
      ctx.strokeRect(x, y, size, size);
      placed++;
    }
  }
}

/** A vessel: clip to its outline, draw what is inside, then stroke the outline (unless `opts.stroke` is false). */
function vessel(ctx, path, box, comps, cap, opts = {}) {
  const shape = new Path2D();
  path(shape);
  shape.closePath();
  ctx.save();
  ctx.clip(shape);
  if (opts.stroke !== false) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fillRect(box.x - 20, box.y - 20, box.w + 40, box.h + 40);
  }
  contents(ctx, box, comps, cap, shape, opts);
  ctx.restore();
  if (opts.stroke === false) return;
  ctx.beginPath();
  path(ctx);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 0.6;
  ctx.lineJoin = "round";
  ctx.stroke();
}

const beaker = (x0, y0, x1, y1) => c => {
  c.moveTo(x0, y0);
  c.lineTo(x0, y1);
  c.lineTo(x1, y1);
  c.lineTo(x1, y0);
};
const line = (ctx, pts, width = 0.6, color = COLORS.ink) => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
};
function burner(ctx, x, y, lit) {
  ctx.fillStyle = COLORS.muted;
  ctx.fillRect(x - 5, y, 10, 8);
  if (!lit) return;
  ctx.fillStyle = COLORS.orange;
  ctx.beginPath();
  ctx.moveTo(x, y - 11);
  ctx.quadraticCurveTo(x + 5, y - 3, x, y);
  ctx.quadraticCurveTo(x - 5, y - 3, x, y - 11);
  ctx.fill();
}
const drop = (ctx, x, y0, y1, p, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y0 + ((p * 24) % 1) * (y1 - y0), 0.9, 0, Math.PI * 2);
  ctx.fill();
};

// Each scene is drawn in a 100 × 80 box. `fr(place)` gives the components that end up in that place.
const SCENES = {
  loc({ ctx, p, running, fr, cap, text }) {
    const through = fr("nuoc-loc");
    vessel(ctx, c => {
      c.moveTo(27, 8);
      c.lineTo(47, 40);
      c.lineTo(47, 50);
      c.lineTo(53, 50);
      c.lineTo(53, 40);
      c.lineTo(73, 8);
    }, { x: 27, y: 8, w: 46, h: 32 }, merge(fr("giay-loc"), scale(through, 1 - p)), cap * 0.95);
    ctx.setLineDash([1.5, 1.2]);
    line(ctx, [[31, 10], [50, 38], [69, 10]], 0.5, COLORS.muted);
    ctx.setLineDash([]);
    if (running && sum(through)) drop(ctx, 50, 51, 60, p, COMPONENTS.nuoc.color);
    vessel(ctx, beaker(33, 54, 67, 78), { x: 33, y: 54, w: 34, h: 24 }, scale(through, p), cap * 1.2);
    text("phễu có giấy lọc", 75, 14);
    text("cốc hứng", 69, 70);
  },
  "co-can"({ ctx, p, running, fr, cap, text }) {
    const gone = fr("hoi");
    if (running && sum(gone)) {
      for (const x of [40, 50, 60]) {
        ctx.beginPath();
        for (let y = 36; y >= 12; y -= 1) ctx.lineTo(x + 2 * Math.sin(y * 0.5 + p * 30 + x), y);
        ctx.strokeStyle = "rgba(107, 120, 144, 0.55)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
      text("hơi nước bay lên", 64, 20);
    }
    vessel(ctx, c => {
      c.moveTo(25, 40);
      c.quadraticCurveTo(50, 66, 75, 40);
    }, { x: 25, y: 40, w: 50, h: 13 }, merge(fr("bat"), scale(gone, 1 - p)), cap * 1.1);
    line(ctx, [[22, 78], [27, 54], [73, 54], [78, 78]]);
    burner(ctx, 50, 70, running);
    text("bát sứ", 77, 42);
    text("đèn cồn", 57, 75);
  },
  chiet({ ctx, p, running, fr, cap, text }) {
    const lower = fr("lop-duoi");
    vessel(ctx, c => {
      c.moveTo(45, 5);
      c.lineTo(45, 10);
      c.quadraticCurveTo(28, 18, 34, 30);
      c.lineTo(47, 46);
      c.lineTo(47, 54);
      c.lineTo(53, 54);
      c.lineTo(53, 46);
      c.lineTo(66, 30);
      c.quadraticCurveTo(72, 18, 55, 10);
      c.lineTo(55, 5);
    }, { x: 30, y: 8, w: 40, h: 46 }, merge(fr("pheu"), fr("lop-tren"), scale(lower, 1 - p)), cap * 1.15);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(44, 47.5, 12, 2);
    if (running && sum(lower)) drop(ctx, 50, 55, 62, p, COMPONENTS.nuoc.color);
    vessel(ctx, beaker(36, 58, 64, 78), { x: 36, y: 58, w: 28, h: 20 }, scale(lower, p), cap * 1.15);
    text("phễu chiết", 72, 22);
    text("khoá phễu", 58, 48.5);
  },
  "nam-cham"({ ctx, p, running, fr, cap, text }) {
    const pulled = fr("nam-cham");
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(34, 12, 16, 10);
    ctx.fillStyle = COLORS.blue;
    ctx.fillRect(50, 12, 16, 10);
    text("N", 42, 17, { color: "#fff", align: "center", bold: true, always: true });
    text("S", 58, 17, { color: "#fff", align: "center", bold: true, always: true });
    if (running && sum(pulled)) {
      ctx.setLineDash([1.5, 1.5]);
      for (const x of [42, 50, 58]) line(ctx, [[x, 30], [x, 56]], 0.4, COLORS.muted);
      ctx.setLineDash([]);
    }
    contents(ctx, { x: 35, y: 22.4, w: 30, h: 9 }, scale(pulled, p), 1, null, { perGram: 9, hang: true });
    line(ctx, [[16, 73], [84, 73]], 0.8, COLORS.muted);
    vessel(ctx, c => {
      c.moveTo(24, 72.6);
      c.quadraticCurveTo(50, 38, 76, 72.6);
    }, { x: 24, y: 55, w: 52, h: 17.6 }, merge(fr("giay"), scale(pulled, 1 - p)), cap, { perGram: 9, stroke: false });
    text("nam châm", 68, 17);
    text("tờ giấy", 78, 70);
  },
  "chung-cat"({ ctx, p, running, done, fr, cap, text, input }) {
    const out = fr("binh-hung");
    const temp = distillTemp(input);
    // delivery tube with its cooling jacket
    line(ctx, [[28, 24], [66, 43], [72, 43], [72, 50]], 1.1);
    ctx.fillStyle = "#dff0ff";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(35.6, 31.5);
    ctx.lineTo(38.3, 26.1);
    ctx.lineTo(61.5, 37.7);
    ctx.lineTo(58.8, 43.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    line(ctx, [[37, 28.8], [60.2, 40.4]], 1.1);
    vessel(ctx, c => {
      c.moveTo(20, 16);
      c.lineTo(20, 39);
      c.arc(24, 52, 14, -Math.PI / 2 - 0.29, -Math.PI / 2 + 0.29, true);
      c.lineTo(28, 16);
    }, { x: 10, y: 38, w: 28, h: 28 }, merge(fr("binh-cau"), scale(out, 1 - p)), cap * 1.25);
    // thermometer
    line(ctx, [[24, 6], [24, 30]], 1.2, COLORS.muted);
    if ((running || done) && temp != null) line(ctx, [[24, 14], [24, 30]], 0.6, COLORS.red);
    text((running || done) && temp != null ? `${fmt(temp, 1)} °C` : "nhiệt kế", 27, 8, { always: (running || done) && temp != null, bold: true, color: COLORS.red });
    burner(ctx, 24, 70, running);
    if (running && sum(out)) drop(ctx, 72, 51, 60, p, COMPONENTS[Object.keys(out)[0]].color);
    vessel(ctx, beaker(61, 54, 85, 78), { x: 61, y: 54, w: 24, h: 24 }, scale(out, p), cap * 1.1);
    text("ống sinh hàn (nước lạnh)", 50, 27);
    text("bình cầu", 40, 62);
    text("bình hứng", 87, 60);
  },
};

/** Word-wrap into a width; returns the next y. A paragraph that would pass `bottom` is not drawn at all. */
function wrap(ctx, text, x, y, maxW, opts, lineH, bottom) {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  const rows = [];
  let row = "";
  for (const word of text.split(" ")) {
    if (row && ctx.measureText(`${row} ${word}`).width > maxW) {
      rows.push(row);
      row = word;
    } else row = row ? `${row} ${word}` : word;
  }
  if (row) rows.push(row);
  if (y + (rows.length - 1) * lineH > bottom) return y;
  rows.forEach((r, i) => label(ctx, r, x, y + i * lineH, opts));
  return y + rows.length * lineH;
}

const methodOptions = METHODS.map(m => ({ value: m.id, label: m.name }));

mount({
  slug: "tach-chat",
  version: "1.0.0",
  title: "Tách chất ra khỏi hỗn hợp",
  hint: "Chọn hỗn hợp và phương pháp rồi bấm “Tiến hành”. Dụng cụ vẽ theo quy ước, không theo tỉ lệ; màu chỉ để phân biệt các chất.",
  initialState,
  step(s, dt, api) {
    const end = endOf(s);
    if (progressOf(s) >= end && s.started) {
      // ▶ on a finished run starts it again (but not within the frame that finished it)
      if (performance.now() - (s._doneAt ?? 0) < 250) return api.pause();
      s.started = false;
    }
    if (!s.started) begin(s, api);
    s.progress = Math.min(end, progressOf(s) + dt / DURATION);
    if (s.progress >= end) {
      finish(s, api);
      api.pause();
    }
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Chế độ",
      options: [
        { value: "explore", label: "Khám phá: một hỗn hợp, một phương pháp" },
        { value: "challenge", label: "Thử thách: cát + muối ăn + nước" },
      ],
      onChange: reset,
    },
    { type: "select", key: "mixture", label: "Hỗn hợp", options: MIXTURES.map(m => ({ value: m.id, label: m.name })), onChange: reset, visible: s => !challenge(s) },
    { type: "select", key: "method", label: "Phương pháp", options: methodOptions, onChange: reset, visible: s => !challenge(s) },
    { type: "select", key: "step1", label: "Bước 1", options: methodOptions, onChange: reset, visible: challenge },
    { type: "select", key: "step2", label: "Bước 2 (với phần còn là hỗn hợp)", options: methodOptions, onChange: reset, visible: challenge },
    {
      type: "button",
      label: "Tiến hành",
      primary: true,
      action(s, api) {
        begin(s, api);
        api.play();
      },
    },
  ],
  readouts: [
    { label: "Khối lượng hỗn hợp ban đầu", value: s => `${fmt(sum(challenge(s) ? CHALLENGE.comps : mixtureOf(s.mixture).comps), 0)} g` },
    {
      label: "Tổng các phần sau khi tách (kể cả phần bay hơi)",
      value: s => {
        if (progressOf(s) < endOf(s)) return "–";
        const fractions = challenge(s) ? runSequence(s.step1, s.step2).final : outcome(s.mixture, s.method).fractions;
        return `${fmt(fractions.reduce((m, f) => m + sum(f.comps), 0), 0)} g`;
      },
    },
    {
      label: "Kết quả",
      value: s => {
        if (progressOf(s) < endOf(s)) return "–";
        const ok = challenge(s) ? runSequence(s.step1, s.step2).success : outcome(s.mixture, s.method).works;
        return ok ? "Tách được" : "Chưa tách được";
      },
    },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const small = w < 560 || h < 430;
    const now = current(s);
    const P = progressOf(s);
    const finished = P >= endOf(s);
    const running = now.p > 0 && now.p < 1;
    const size = small ? 11 : 15;
    const lineH = small ? 13 : 21;

    // header and colour legend
    const title = challenge(s) ? `Bước ${now.step}/2 – ${now.method.name}: ${Object.keys(now.input).map(id => COMPONENTS[id].name).join(" + ")}` : `${mixtureOf(s.mixture).name} – ${now.method.name}`;
    label(ctx, title, w / 2, small ? 9 : 22, { size: small ? 12 : 18, bold: true, align: "center" });
    const legendY = small ? 24 : 48;
    const ids = Object.keys(challenge(s) ? CHALLENGE.comps : mixtureOf(s.mixture).comps);
    ctx.font = `${size - 1}px ${FONT}`;
    const widths = ids.map(id => ctx.measureText(COMPONENTS[id].name).width + 30);
    let lx = (w - widths.reduce((a, b) => a + b, 0)) / 2;
    ids.forEach((id, k) => {
      ctx.fillStyle = COMPONENTS[id].color;
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      ctx.fillRect(lx, legendY - 5, 10, 10);
      ctx.strokeRect(lx, legendY - 5, 10, 10);
      label(ctx, COMPONENTS[id].name, lx + 14, legendY, { size: size - 1, color: COLORS.muted });
      lx += widths[k];
    });

    // the apparatus
    const textH = small ? 6 * lineH + 2 : 5 * lineH + 8;
    const top = legendY + (small ? 8 : 16);
    const area = { x: 4, y: top, w: w - 8, h: Math.max(60, h - top - textH) };
    const k = Math.min(area.w / 100, area.h / 80);
    ctx.save();
    ctx.translate(area.x + (area.w - 100 * k) / 2, area.y + (area.h - 80 * k) / 2);
    ctx.scale(k, k);
    SCENES[now.method.id]({
      ctx,
      p: now.p,
      running,
      done: now.p >= 1,
      input: now.input,
      cap: Math.max(sum(now.input), 1),
      fr: place => now.fractions.find(f => f.place === place)?.comps ?? {},
      // apparatus labels are secondary: dropped on a small stage unless marked `always`
      text: (t, x, y, o = {}) => (o.always || k >= 5) && label(ctx, t, x, y, { size: (o.always ? Math.max(11, 2.6 * k) : 12) / k, color: COLORS.muted, ...o }),
    });
    ctx.restore();

    // what happened
    let y = h - textH + lineH / 2;
    const say = (text, extra = {}) => {
      y = wrap(ctx, text, 8, y, w - 16, { size, ...extra }, lineH, h - lineH / 2);
    };
    if (challenge(s)) {
      if (P === 0) {
        say(`Thử thách: tách riêng cát và muối ăn từ hỗn hợp ${names(CHALLENGE.comps)}.`, { bold: true });
        say("Chọn hai phương pháp theo đúng thứ tự rồi bấm “Tiến hành”.", { color: COLORS.muted });
      } else if (!finished) {
        say(`Bước ${now.step}: đang ${now.method.verb}…`, { bold: true });
        if (now.step === 2) say(`Sau bước 1: ${listing(now.run.steps[0].fractions)}`, { color: COLORS.muted });
      } else {
        say(now.run.success ? "✓ Đúng trình tự! Cát và muối ăn đã được tách riêng." : "✗ Chưa tách riêng được cát và muối ăn. Hãy thử trình tự khác.", { bold: true, color: now.run.success ? COLORS.green : COLORS.red });
        say(listing(now.run.final));
        if (!now.run.success) say(now.run.steps.map(st => st.note).join(" "), { color: COLORS.muted });
      }
    } else if (P === 0) {
      say(`Hỗn hợp ban đầu: ${names(now.input)}.`, { bold: true });
      say(`Bấm “Tiến hành” để ${now.method.verb}.`, { color: COLORS.muted });
    } else if (!finished) {
      say(`Đang ${now.method.verb}…`, { bold: true });
    } else {
      const better = methodOf(RECOMMENDED[mixtureOf(s.mixture).id]).verb;
      const verdict = !now.works ? "✗ Không tách được bằng phương pháp này." : now.recommended ? "✓ Tách được: đây là phương pháp phù hợp." : `✓ Tách được, nhưng ${better} mới là cách phù hợp nhất với hỗn hợp này.`;
      say(verdict, { bold: true, color: now.works ? COLORS.green : COLORS.red });
      say(listing(now.fractions));
      say(now.note, { color: COLORS.muted });
    }
  },
});
