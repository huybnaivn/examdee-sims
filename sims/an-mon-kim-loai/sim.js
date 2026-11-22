import { mount, fmt, clamp } from "../../kit/v1/kit.js";
import {
  DAYS, JARS, LIQUIDS, ITEMS, ITEM_ORDER, MISSIONS,
  initialState, jar, corrosion, zincLoss, reason, add, remove, has, contents, restart, step, winner, missionMet,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const LIQUID_COLOR = { boiled: "#dcefff", tap: "#c6e4ff", salt: "#bfe0ee", vinegar: "#f4e9a4" };
const CHIP = {
  boiled: "#7fb8ee", tap: "#4a9be8", salt: "#5fb3c9", vinegar: "#d6bd3a",
  oil: "#e0a528", dry: "#9aa3b2", coat: "#3d7be0", Zn: "#8a94a6", Cu: "#c97b3d",
};
const SHORT = {
  boiled: "Nước đun sôi", tap: "Nước máy", salt: "Nước muối", vinegar: "Giấm",
  oil: "Lớp dầu", dry: "Chất hút ẩm", coat: "Sơn", Zn: "Thanh kẽm", Cu: "Dây đồng",
};
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
const rnd = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };
const mix = (c1, c2, t) => {
  const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const [a, b] = [p(c1), p(c2)];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
};
const pct = v => `${fmt(v * 100, v > 0 && v < 0.1 ? 1 : 0)} %`;

/** Everything that has a position: shelf chips, jars, the tags under each jar. */
function layout(s, view) {
  const small = view.w < 560 || view.h < 430;
  const gap = small ? 5 : 8;
  const perRow = view.w < 430 ? 3 : 5;
  const rows = Math.ceil(ITEM_ORDER.length / perRow);
  const chipH = small ? 24 : 32;
  const chipW = (view.w - gap * (perRow + 1)) / perRow;
  const chips = ITEM_ORDER.map((item, k) => ({
    item, x: gap + (k % perRow) * (chipW + gap), y: gap + Math.floor(k / perRow) * (chipH + gap), w: chipW, h: chipH,
  }));
  const shelfH = rows * (chipH + gap) + gap;
  const timeH = small ? 24 : 34;
  const footer = small ? 56 : 128;
  const top = shelfH + timeH + (small ? 36 : 64);
  const jh = clamp(view.h - top - footer - 8, 70, 380);
  const jw = Math.min(jh * 0.7, (view.w - 16) / 3 - 10, 190);
  const tagH = small ? 16 : 22;
  const jars = JARS.map(i => {
    const cx = (view.w * (i - 0.5)) / 3;
    const x = cx - jw / 2;
    let tx = 0, ty = 0;
    const colW = Math.min(view.w / 3 - 8, 250);
    const tags = contents(s, i).map(item => {
      const w = Math.min(colW, SHORT[item].length * (small ? 5.6 : 7.2) + (small ? 22 : 30));
      if (tx + w > colW - 16 && tx > 0) { tx = 0; ty += tagH + 4; }
      const t = { item, jar: i, x: cx - colW / 2 + 8 + tx, y: top + jh + (small ? 26 : 44) + ty, w, h: tagH };
      tx += w + 4;
      return t;
    });
    return { i, cx, x, y: top, w: jw, h: jh, tags, colW };
  });
  return { small, chips, shelfH, timeH, top, jh, jw, jars, tagH };
}

const jarAt = (L, p) => L.jars.find(j => Math.abs(p.x - j.cx) < j.colW / 2 && p.y > L.shelfH);

function drawIcon(ctx, item, x, y, r) {
  ctx.fillStyle = CHIP[item];
  if (item in LIQUIDS || item === "oil") {
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.bezierCurveTo(x + r * 1.1, y, x + r * 0.9, y + r, x, y + r); ctx.bezierCurveTo(x - r * 0.9, y + r, x - r * 1.1, y, x, y - r); ctx.fill();
  } else if (item === "dry") {
    for (const [dx, dy] of [[-0.5, 0.3], [0.5, 0.3], [0, -0.4]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * 0.42, 0, Math.PI * 2); ctx.fill(); }
  } else if (item === "coat") {
    rr(ctx, x - r * 0.8, y - r * 0.9, r * 1.6, r * 0.9, 2); ctx.fill();
    ctx.fillStyle = "#7a5a3a"; ctx.fillRect(x - r * 0.18, y, r * 0.36, r);
  } else if (item === "Zn") {
    rr(ctx, x - r * 0.35, y - r, r * 0.7, r * 2, 2); ctx.fill();
  } else {
    ctx.strokeStyle = CHIP.Cu; ctx.lineWidth = 2.2; ctx.beginPath();
    for (let k = 0; k <= 12; k++) ctx.lineTo(x + Math.sin(k * 1.6) * r * 0.8, y - r + (k / 12) * r * 2);
    ctx.stroke();
  }
}

function drawJar(ctx, s, g, L, clock, hot) {
  const j = jar(s, g.i);
  const c = corrosion(j, s.day);
  const z = zincLoss(j, s.day);
  const { x, y, w, h, cx } = g;
  const wall = Math.max(3, w * 0.035);
  const inX = x + wall, inW = w - 2 * wall, bottom = y + h - wall;
  const surface = y + h * 0.36;
  const wet = j.liquid !== "none";

  // back of the glass
  ctx.fillStyle = "rgba(255,255,255,.55)";
  rr(ctx, x, y, w, h, [6, 6, w * 0.16, w * 0.16]); ctx.fill();

  ctx.save();
  rr(ctx, inX, y, inW, h - wall, [0, 0, w * 0.13, w * 0.13]); ctx.clip();
  if (wet) {
    const tint = Math.min(1, c * 0.75) * (j.liquid === "vinegar" ? 0.5 : 1);
    const liq = ctx.createLinearGradient(0, surface, 0, bottom);
    liq.addColorStop(0, mix(LIQUID_COLOR[j.liquid], "#d9903f", tint * 0.7));
    liq.addColorStop(1, mix(LIQUID_COLOR[j.liquid], "#b5651d", tint));
    ctx.fillStyle = liq;
    ctx.fillRect(inX, surface, inW, bottom - surface);
    if (j.liquid === "salt") {
      ctx.fillStyle = "rgba(255,255,255,.9)";
      for (let k = 0; k < 14; k++) ctx.fillRect(inX + rnd(k, 3) * (inW - 4), bottom - 3 - rnd(k, 4) * 5, 3, 3);
    }
    // rust flakes settling at the bottom
    ctx.fillStyle = "#9a4a16";
    for (let k = 0; k < Math.round(c * 26); k++) { ctx.beginPath(); ctx.arc(inX + rnd(k, g.i + 9) * inW, bottom - 2 - rnd(k, 5) * 6, 1.6 + rnd(k, 6) * 1.6, 0, Math.PI * 2); ctx.fill(); }
    if (j.oil) {
      const oil = ctx.createLinearGradient(0, surface - 9, 0, surface + 2);
      oil.addColorStop(0, "#f5c453"); oil.addColorStop(1, "#dba520");
      ctx.fillStyle = oil;
      ctx.fillRect(inX, surface - Math.max(6, h * 0.05), inW, Math.max(6, h * 0.05));
    }
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillRect(inX, (j.oil ? surface - Math.max(6, h * 0.05) : surface) - 1, inW, 2);
  } else if (j.dry) {
    for (let k = 0; k < 16; k++) {
      ctx.fillStyle = k % 3 ? "#f3f5f9" : "#dfe4ec";
      ctx.beginPath(); ctx.arc(inX + 6 + rnd(k, 1) * (inW - 12), bottom - 4 - rnd(k, 2) * h * 0.07, Math.max(3, w * 0.035), 0, Math.PI * 2); ctx.fill();
    }
  }

  // the nail: head up, point down
  const nw = Math.max(5, w * 0.075);
  const nTop = y + h * 0.14, nBot = bottom - h * 0.09;
  const body = ctx.createLinearGradient(cx - nw / 2, 0, cx + nw / 2, 0);
  if (j.coat) { body.addColorStop(0, "#2f6fed"); body.addColorStop(0.5, "#6ea0ff"); body.addColorStop(1, "#2459d6"); }
  else { body.addColorStop(0, "#7c8696"); body.addColorStop(0.45, "#e3e8ef"); body.addColorStop(1, "#8b95a5"); }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - nw / 2, nTop); ctx.lineTo(cx + nw / 2, nTop); ctx.lineTo(cx + nw / 2, nBot - nw * 1.4); ctx.lineTo(cx, nBot); ctx.lineTo(cx - nw / 2, nBot - nw * 1.4);
  ctx.closePath(); ctx.fill();
  rr(ctx, cx - nw * 1.25, nTop - nw * 0.55, nw * 2.5, nw * 0.6, 2); ctx.fill();
  ctx.fillStyle = "#33415f"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `700 ${Math.max(9, w * 0.07)}px ${FONT}`;
  ctx.fillText("Fe", cx - nw * 2.6, nTop - nw * 0.2);
  // rust on the part water (or moist air) reaches
  if (c > 0) {
    const from = wet ? (j.oil ? surface - 4 : surface - nw) : nTop;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - nw / 2, from); ctx.lineTo(cx + nw / 2, from); ctx.lineTo(cx + nw / 2, nBot - nw * 1.4); ctx.lineTo(cx, nBot); ctx.lineTo(cx - nw / 2, nBot - nw * 1.4);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = `rgba(150,72,22,${Math.min(0.9, c * 1.1)})`;
    ctx.fillRect(cx - nw, from, nw * 2, nBot - from);
    for (let k = 0; k < Math.round(c * 70); k++) {
      ctx.fillStyle = ["#b5541a", "#8c3d12", "#d1762c"][k % 3];
      ctx.beginPath();
      ctx.ellipse(cx - nw / 2 + rnd(k, g.i) * nw, from + rnd(k, g.i + 4) * (nBot - from), 1.6 + rnd(k, 7) * 2.2, 1.2 + rnd(k, 8) * 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // rust swelling beyond the nail's outline once it is far gone
    ctx.fillStyle = "#a6501a";
    for (let k = 0; k < Math.round(Math.max(0, c - 0.35) * 26); k++) {
      const side = k % 2 ? 1 : -1;
      ctx.beginPath(); ctx.arc(cx + side * (nw / 2 + rnd(k, 11) * 2), from + rnd(k, g.i + 12) * (nBot - nw * 1.6 - from), 1.4 + rnd(k, 13) * 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  // partner metal, wired to the nail head
  if (j.partner !== "none") {
    const px = cx + inW * 0.27;
    ctx.strokeStyle = "#3b4252"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx, nTop - nw * 0.5); ctx.quadraticCurveTo((cx + px) / 2, nTop - nw * 2.6, px, nTop + 2); ctx.stroke();
    if (j.partner === "Zn") {
      const full = nBot - nTop - nw * 2, left = full * (1 - z * 0.85), bw = Math.max(9, w * 0.13) * (1 - z * 0.35);
      const zg = ctx.createLinearGradient(px - bw / 2, 0, px + bw / 2, 0);
      zg.addColorStop(0, "#7d8fb0"); zg.addColorStop(0.5, "#c9d6ec"); zg.addColorStop(1, "#7d8fb0");
      ctx.fillStyle = zg;
      rr(ctx, px - bw / 2, nTop, bw, left, 1); ctx.fill();
      ctx.fillStyle = "#33415f"; ctx.textAlign = "center"; ctx.font = `700 ${Math.max(9, w * 0.07)}px ${FONT}`;
      ctx.fillText("Zn", px, nTop - nw * 1.9);
      ctx.fillStyle = "rgba(60,70,90,.45)";
      for (let k = 0; k < Math.round(z * 18); k++) { ctx.beginPath(); ctx.arc(px - bw / 2 + rnd(k, 21) * bw, nTop + rnd(k, 22) * left, 1.2 + rnd(k, 23), 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.strokeStyle = "#c97b3d"; ctx.lineWidth = Math.max(2, w * 0.018);
      ctx.beginPath();
      const span = nBot - nTop - nw * 2;
      for (let k = 0; k <= 40; k++) ctx.lineTo(px + Math.sin(k * 0.9) * Math.max(4, w * 0.04), nTop + (k / 40) * span);
      ctx.stroke();
      ctx.fillStyle = "#8a4a1c"; ctx.textAlign = "center"; ctx.font = `700 ${Math.max(9, w * 0.07)}px ${FONT}`;
      ctx.fillText("Cu", px, nTop - nw * 1.9);
    }
  }
  // bubbles: hydrogen in acid, and from zinc as it dissolves
  const fizz = wet && s.day > 0 && s.day < DAYS && (j.liquid === "vinegar" && !j.coat ? 1 : z > 0 && z < 0.98 ? 0.6 : 0);
  if (fizz) {
    ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 1.2;
    const bx = j.liquid === "vinegar" && j.partner !== "Zn" ? cx : cx + inW * 0.27;
    for (let k = 0; k < 9 * fizz; k++) {
      const t = (clock * 0.6 + rnd(k, 31)) % 1;
      ctx.beginPath(); ctx.arc(bx + (rnd(k, 32) - 0.5) * nw * 3, nBot - t * (nBot - surface), 1.5 + rnd(k, 33) * 2, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();

  // the glass itself
  ctx.strokeStyle = hot ? "#2f6fed" : "rgba(120,140,170,.75)";
  ctx.lineWidth = hot ? wall + 1.5 : wall;
  rr(ctx, x + wall / 2, y, w - wall, h - wall / 2, [4, 4, w * 0.15, w * 0.15]); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = Math.max(2, w * 0.022); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x + w * 0.16, y + h * 0.1); ctx.lineTo(x + w * 0.16, y + h * 0.7); ctx.stroke();
  ctx.fillStyle = "rgba(120,140,170,.75)";
  rr(ctx, x - wall, y - wall * 1.2, w + wall * 2, wall * 2.2, wall); ctx.fill();
}

function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = text.split(" ");
  let line = "", n = 0;
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(tryLine).width > maxW && line) {
      if (++n === maxLines) { ctx.fillText(`${line}…`, x, y); return; }
      ctx.fillText(line, x, y); y += lineH; line = word;
    } else line = tryLine;
  }
  if (line) ctx.fillText(line, x, y);
}

function changed(s, api, i, item, added) {
  s._verdict = ""; s._msg = ""; s._armed = s.guess !== 0;
  api.pause();
  api.sync();
  api.emit("jar-changed", { jar: i, item: ITEM_ORDER.indexOf(item) + 1, added: added ? 1 : 0 }, "action");
}

function finished(s, api) {
  const cs = JARS.map(i => corrosion(jar(s, i), DAYS));
  const zs = JARS.map(i => zincLoss(jar(s, i), DAYS));
  const top = winner(s);
  api.pause();
  api.emit(
    "run-finished",
    { corrosion1: cs[0] * 100, corrosion2: cs[1] * 100, corrosion3: cs[2] * 100, zinc1: zs[0] * 100, zinc2: zs[1] * 100, zinc3: zs[2] * 100, most: top },
    "result"
  );
  if (s.guess !== 0 && s._armed !== false) {
    s._armed = false;
    s._verdict = top !== 0 && s.guess === top ? "right" : "wrong";
    if (s._verdict === "right") api.emit("prediction-correct", { jar: top }, "goal");
  }
  s._won ??= {};
  if (s.mission !== "none" && !s._won[s.mission] && missionMet(s, s.mission)) {
    s._won[s.mission] = true;
    api.emit("mission-done", { mission: Object.keys(MISSIONS).indexOf(s.mission) }, "goal");
  }
}

mount({
  slug: "an-mon-kim-loai",
  version: "1.0.0",
  title: "Phòng thí nghiệm ăn mòn kim loại",
  hint: "Kéo nước, dầu, sơn, kẽm, đồng trên kệ thả vào từng lọ có đinh sắt, rồi bấm Chạy để tua nhanh 30 ngày. Chạm vào nhãn dưới lọ để lấy vật đó ra.",
  initialState,
  autoplay: true,
  timeScale: s => s.speed,
  step(s, dt, api) {
    s._clock = (s._clock ?? 0) + dt / Math.max(0.5, s.speed);
    if (s.done) {
      // A finished run restored from the host stays finished; pressing Chạy again starts over.
      if (!s._sawDone) { s._sawDone = true; api.pause(); return; }
      restart(s);
    }
    if (step(s, dt)) { s._sawDone = true; finished(s, api); }
  },
  controls: [
    {
      type: "select", key: "speed", label: "Tốc độ tua thời gian",
      options: [{ value: 1, label: "Chậm (1 ngày mỗi giây)" }, { value: 2.5, label: "Vừa (2,5 ngày mỗi giây)" }, { value: 6, label: "Nhanh (6 ngày mỗi giây)" }],
    },
    {
      type: "button", label: "Làm lại từ ngày 0",
      action(s, api) { restart(s); s._verdict = ""; api.emit("restarted", {}, "action"); },
    },
    { type: "heading", label: "Thử sức" },
    {
      type: "select", key: "guess", label: "Em đoán: lọ nào bị ăn mòn nhiều nhất?",
      options: [{ value: 0, label: "(chưa đoán)" }, ...JARS.map(i => ({ value: i, label: `Lọ ${i}` }))],
      onChange: s => { s._armed = s.guess !== 0 && !s.done; s._verdict = ""; },
    },
    { type: "select", key: "mission", label: "Nhiệm vụ", options: Object.entries(MISSIONS).map(([value, label]) => ({ value, label })) },
    { type: "heading", label: "Chỉnh lọ không cần kéo thả" },
    { type: "select", key: "sel", label: "Lọ", options: JARS.map(i => ({ value: i, label: `Lọ ${i}` })) },
    { type: "select", key: "pick", label: "Vật", options: ITEM_ORDER.map(item => ({ value: item, label: ITEMS[item] })) },
    {
      type: "button", label: "Cho vào lọ, hoặc lấy ra nếu đã có",
      action(s, api) {
        if (has(s, s.sel, s.pick)) { remove(s, s.sel, s.pick); changed(s, api, s.sel, s.pick, false); }
        else {
          const msg = add(s, s.sel, s.pick);
          if (msg) { s._msg = msg; return; }
          changed(s, api, s.sel, s.pick, true);
        }
      },
    },
  ],
  readouts: [
    { label: "Ngày", value: s => `${fmt(s.day, 0)} / ${DAYS}` },
    ...JARS.map(i => ({ label: `Lọ ${i}: sắt bị ăn mòn`, value: s => pct(corrosion(jar(s, i), s.day)) })),
  ],
  pointer: {
    down(p, s, api, view) {
      const L = layout(s, view);
      const chip = L.chips.find(c => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
      if (chip) { s._drag = { item: chip.item, x: p.x, y: p.y }; return true; }
      for (const g of L.jars) {
        const tag = g.tags.find(t => p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y - 3 && p.y <= t.y + t.h + 3);
        if (tag) { remove(s, tag.jar, tag.item); changed(s, api, tag.jar, tag.item, false); return true; }
      }
      const g = jarAt(L, p);
      if (g && p.y < g.y + g.h + 8) { s.sel = g.i; api.sync(); api.emit("param", { key: "sel", value: g.i }, "param"); return true; }
      return false;
    },
    move(p, s) { if (s._drag) { s._drag.x = p.x; s._drag.y = p.y; } },
    up(p, s, api, view) {
      const d = s._drag;
      s._drag = null;
      if (!d) return;
      const g = jarAt(layout(s, view), p);
      if (!g) return;
      const msg = add(s, g.i, d.item);
      if (msg) { s._msg = msg; return; }
      s.sel = g.i;
      changed(s, api, g.i, d.item, true);
    },
  },
  draw(ctx, s, view) {
    const L = layout(s, view);
    const clock = s._clock ?? 0;
    ctx.textBaseline = "middle";

    // lab wall and bench
    const wall = ctx.createLinearGradient(0, 0, 0, view.h);
    wall.addColorStop(0, "#eaf2fb"); wall.addColorStop(1, "#f7f3ea");
    ctx.fillStyle = wall; ctx.fillRect(0, 0, view.w, view.h);
    const bench = L.top + L.jh - 4;
    const wood = ctx.createLinearGradient(0, bench, 0, view.h);
    wood.addColorStop(0, "#d8b98a"); wood.addColorStop(0.08, "#c9a36d"); wood.addColorStop(1, "#e9dcc4");
    ctx.fillStyle = wood; ctx.fillRect(0, bench, view.w, view.h - bench);
    ctx.fillStyle = "rgba(120,85,40,.25)"; ctx.fillRect(0, bench, view.w, 3);

    // shelf of things to drag
    ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(0, 0, view.w, L.shelfH);
    ctx.fillStyle = "#c9a36d"; ctx.fillRect(0, L.shelfH - 3, view.w, 3);
    for (const c of L.chips) {
      const lifted = s._drag?.item === c.item;
      ctx.globalAlpha = lifted ? 0.35 : 1;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = CHIP[c.item]; ctx.lineWidth = 1.6;
      rr(ctx, c.x, c.y, c.w, c.h, c.h / 2); ctx.fill(); ctx.stroke();
      drawIcon(ctx, c.item, c.x + c.h * 0.55, c.y + c.h / 2, c.h * 0.26);
      ctx.fillStyle = "#1f2a44"; ctx.textAlign = "left";
      let size = L.small ? 10.5 : 13;
      ctx.font = `600 ${size}px ${FONT}`;
      while (ctx.measureText(SHORT[c.item]).width > c.w - c.h * 1.1 - 6 && size > 8) ctx.font = `600 ${--size}px ${FONT}`;
      ctx.fillText(SHORT[c.item], c.x + c.h * 1.02, c.y + c.h / 2 + 0.5);
      ctx.globalAlpha = 1;
    }

    // time bar
    const tb = { x: 12, y: L.shelfH + 8, w: view.w - 24, h: L.timeH - 10 };
    ctx.fillStyle = "rgba(31,42,68,.10)"; rr(ctx, tb.x, tb.y, tb.w, tb.h, tb.h / 2); ctx.fill();
    const grad = ctx.createLinearGradient(tb.x, 0, tb.x + tb.w, 0);
    grad.addColorStop(0, "#7fb8ee"); grad.addColorStop(1, "#2f6fed");
    ctx.fillStyle = grad; rr(ctx, tb.x, tb.y, Math.max(tb.h, (tb.w * s.day) / DAYS), tb.h, tb.h / 2); ctx.fill();
    ctx.fillStyle = "#1f2a44"; ctx.textAlign = "center"; ctx.font = `700 ${L.small ? 11 : 14}px ${FONT}`;
    ctx.fillText(`Ngày ${fmt(s.day, 0)} / ${DAYS}`, view.w / 2, tb.y + tb.h / 2 + 0.5);

    // headline
    const top = winner(s);
    let line = s.done
      ? top ? `Sau ${DAYS} ngày: đinh ở lọ ${top} bị ăn mòn nhiều nhất` : `Sau ${DAYS} ngày: không có lọ nào đứng đầu một mình`
      : s.day === 0 ? "Chọn vật cho từng lọ, rồi bấm Chạy để xem 30 ngày trôi qua" : "Thời gian đang trôi… quan sát đinh sắt trong từng lọ";
    let color = s.done ? "#b4232a" : "#1f2a44";
    if (s._msg) { line = s._msg; color = "#b45309"; }
    else if (s._verdict === "right") line += ". ✓ Em đoán đúng!";
    else if (s._verdict === "wrong") line += ". Em đoán chưa đúng.";
    else if (s.done && s.mission !== "none") line += s._won?.[s.mission] ? ". ✓ Hoàn thành nhiệm vụ!" : ". Nhiệm vụ chưa đạt.";
    else if (!s.done && s.mission !== "none" && s.day === 0) line = `Nhiệm vụ: ${MISSIONS[s.mission]}`;
    ctx.textAlign = "center";
    let size = L.small ? 12 : 17;
    ctx.font = `700 ${size}px ${FONT}`;
    while (ctx.measureText(line).width > view.w - 16 && size > 9) ctx.font = `700 ${--size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(line, view.w / 2, L.shelfH + L.timeH + (L.small ? 9 : 18));

    // the three jars
    const hot = s._drag ? jarAt(L, s._drag) : null;
    const ranked = JARS.map(i => corrosion(jar(s, i), DAYS)).map((c, _, all) => (c > 0 ? 1 + all.filter(o => o > c).length : 0));
    for (const g of L.jars) {
      const j = jar(s, g.i);
      const c = corrosion(j, s.day);
      ctx.fillStyle = "rgba(60,45,20,.16)";
      ctx.beginPath(); ctx.ellipse(g.cx, g.y + g.h + 1, g.w * 0.56, 6, 0, 0, Math.PI * 2); ctx.fill();
      drawJar(ctx, s, g, L, clock, hot === g);
      // jar number
      ctx.fillStyle = s.sel === g.i ? "#2f6fed" : "#64718a";
      ctx.textAlign = "center"; ctx.font = `700 ${L.small ? 11 : 14}px ${FONT}`;
      ctx.fillText(`Lọ ${g.i}`, g.cx, g.y - (L.small ? 11 : 16));
      if (s.done && ranked[g.i - 1] > 0) {
        const rx = g.x + g.w - 2, ry = g.y + 12;
        ctx.fillStyle = ["#e5484d", "#f08c2e", "#c9a227"][ranked[g.i - 1] - 1] ?? "#8a94a6";
        ctx.beginPath(); ctx.arc(rx, ry, L.small ? 9 : 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = `700 ${L.small ? 10 : 13}px ${FONT}`;
        ctx.fillText(String(ranked[g.i - 1]), rx, ry + 0.5);
      }
      // a plate under the jar: corrosion meter, what is inside, and why
      ctx.save();
      ctx.shadowColor = "rgba(31,42,68,.14)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
      ctx.fillStyle = "rgba(255,255,255,.93)";
      rr(ctx, g.cx - g.colW / 2, g.y + g.h + 6, g.colW, view.h - (g.y + g.h + 6) - (L.small ? 14 : 22), 12); ctx.fill();
      ctx.restore();
      const mw = g.colW - 20, mx = g.cx - mw / 2, my = g.y + g.h + (L.small ? 17 : 28);
      ctx.fillStyle = "rgba(31,42,68,.12)"; rr(ctx, mx, my, mw, 7, 3.5); ctx.fill();
      if (c > 0) { ctx.fillStyle = mix("#f5c518", "#a6401a", c); rr(ctx, mx, my, Math.max(7, mw * c), 7, 3.5); ctx.fill(); }
      ctx.fillStyle = c > 0.02 ? "#a6401a" : "#1f9d6b";
      ctx.font = `700 ${L.small ? 10 : 13}px ${FONT}`; ctx.textAlign = "right";
      ctx.fillText(c > 0.005 ? `đinh bị ăn mòn ${pct(c)}` : "đinh sáng bóng", mx + mw, my - (L.small ? 6 : 9));
      // tags: what is in the jar (tap to take out)
      for (const t of g.tags) {
        ctx.fillStyle = "#fff"; ctx.strokeStyle = CHIP[t.item]; ctx.lineWidth = 1.3;
        rr(ctx, t.x, t.y, t.w, t.h, t.h / 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#1f2a44"; ctx.textAlign = "left"; ctx.font = `600 ${L.small ? 9 : 11.5}px ${FONT}`;
        ctx.fillText(SHORT[t.item], t.x + 8, t.y + t.h / 2 + 0.5);
        ctx.fillStyle = "#8a94a6"; ctx.textAlign = "right"; ctx.fillText("✕", t.x + t.w - 7, t.y + t.h / 2 + 0.5);
      }
      if (!g.tags.length) {
        ctx.fillStyle = "#8a94a6"; ctx.textAlign = "center"; ctx.font = `${L.small ? 9 : 11.5}px ${FONT}`;
        ctx.fillText("chỉ có không khí ẩm", g.cx, L.top + L.jh + (L.small ? 34 : 55));
      }
      if (!L.small) {
        const rows = g.tags.length ? Math.round((g.tags.at(-1).y - g.tags[0].y) / (L.tagH + 4)) + 1 : 1;
        ctx.fillStyle = "#3d4b6b"; ctx.textAlign = "center"; ctx.font = `12px ${FONT}`;
        wrap(ctx, reason(j), g.cx, L.top + L.jh + 44 + rows * (L.tagH + 4) + 12, g.colW - 20, 15, 3);
      }
    }

    // the item being dragged
    if (s._drag) {
      const d = s._drag;
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = CHIP[d.item]; ctx.lineWidth = 2;
      const w = SHORT[d.item].length * 7.6 + 44;
      rr(ctx, d.x - w / 2, d.y - 17, w, 34, 17); ctx.fill(); ctx.stroke();
      drawIcon(ctx, d.item, d.x - w / 2 + 19, d.y, 9);
      ctx.fillStyle = "#1f2a44"; ctx.textAlign = "left"; ctx.font = `600 13px ${FONT}`;
      ctx.fillText(SHORT[d.item], d.x - w / 2 + 35, d.y + 0.5);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = "right"; ctx.textBaseline = "alphabetic"; ctx.font = `${L.small ? 8.5 : 11}px ${FONT}`;
    ctx.fillStyle = "#7c879b";
    ctx.fillText("Tốc độ ăn mòn chỉ minh họa đúng thứ tự nhanh – chậm, không phải số đo thật.", view.w - 8, view.h - 5);
  },
});
