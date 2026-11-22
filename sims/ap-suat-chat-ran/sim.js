import { mount, fmt, clamp } from "../../kit/v1/kit.js";
import {
  BRICK_FACES, FACE_ORDER, SHOES, SHOE_ORDER, OBJECTS, OBJECT_ORDER, GROUNDS, RANGE, CHALLENGES,
  initialState, solve, compare, place, challengeMet, nextOf, P_LOW, P_HIGH,
} from "./model.js";

const T_DROP = 0.32; // s, falling onto the ground
const T_SINK = 0.75; // s, sinking in
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const GROUND_LOOK = {
  sand: { top: "#f1dca7", deep: "#dcbf7e", edge: "#c9a55d", speck: "#bf9a52" },
  snow: { top: "#fbfdff", deep: "#dbe7f6", edge: "#b9cce6", speck: "#c7d7ee" },
  mud: { top: "#96704e", deep: "#6f5137", edge: "#55402c", speck: "#5f4630" },
  concrete: { top: "#d5dae1", deep: "#b7bec9", edge: "#8f98a6", speck: "#a5adb9" },
};

const slotKey = slot => (slot === "A" ? "slotA" : "slotB");
const fmtP = p => (p >= 1e6 ? `${fmt(p / 1e6, 2)} MPa` : p >= 1e3 ? `${fmt(p / 1e3, 1)} kPa` : `${fmt(p, 0)} Pa`);
const fmtF = f => (f >= 1e4 ? `${fmt(f / 1e3, 0)} kN` : `${fmt(f, 0)} N`);
const fmtS = cm2 => (cm2 >= 1e4 ? `${fmt(cm2 / 1e4, 2)} m²` : `${fmt(cm2, 0)} cm²`);
const easeOut = t => 1 - (1 - t) ** 3;

function geo(view) {
  const small = view.w < 560 || view.h < 420;
  const shelfH = small ? 64 : 96;
  const ground = Math.round(view.h * (small ? 0.6 : 0.62));
  const dentMax = Math.min(view.h * 0.12, 64);
  const headline = small ? 30 : 52;
  const u = Math.max(0.35, Math.min((view.w / 2 - 14) / 215, (ground - shelfH - headline) / 196));
  return { small, shelfH, ground, dentMax, headline, u, xA: view.w * 0.27, xB: view.w * 0.73 };
}

// ---------- characters, drawn in "design" units: origin at the bottom centre, y up is negative ----------
const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

function brickSize(s) {
  const f = BRICK_FACES[s.brickFace] ?? BRICK_FACES.large;
  const k = Math.min(5, 172 / (f.h * s.brickCount)); // design px per cm
  return { w: f.w * k, h: f.h * k, depth: f.d * k * 0.45 };
}

function drawBrick(ctx, s) {
  const { w, h, depth } = brickSize(s);
  const dx = depth * 0.8;
  const dy = depth * 0.55;
  for (let i = 0; i < s.brickCount; i++) {
    const y = -h * (i + 1);
    ctx.fillStyle = "#9b4526";
    ctx.beginPath(); // side
    ctx.moveTo(w / 2, y); ctx.lineTo(w / 2 + dx, y - dy); ctx.lineTo(w / 2 + dx, y - dy + h); ctx.lineTo(w / 2, y + h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e79468";
    ctx.beginPath(); // top
    ctx.moveTo(-w / 2, y); ctx.lineTo(-w / 2 + dx, y - dy); ctx.lineTo(w / 2 + dx, y - dy); ctx.lineTo(w / 2, y);
    ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#d6714a"); g.addColorStop(1, "#bd5a36");
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, y, w, h);
    ctx.strokeStyle = "rgba(90,35,15,.45)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-w / 2, y, w, h);
    ctx.fillStyle = "rgba(90,35,15,.35)";
    for (const hx of [-0.25, 0.25]) {
      ctx.beginPath();
      ctx.ellipse(hx * w, y + h / 2, Math.min(9, w * 0.09), Math.min(6, h * 0.22), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const KID_LIFT = { feet: 0, heels: 18, stilts: 44, skis: 7 };
function drawKid(ctx, s) {
  const shoes = s.kidShoes in SHOES ? s.kidShoes : "feet";
  const lift = KID_LIFT[shoes];
  const big = 0.85 + (clamp(s.kidMass, 20, 90) - 20) / 70 * 0.3; // heavier child, wider body
  // footwear
  if (shoes === "skis") {
    ctx.fillStyle = "#2f6fed";
    rr(ctx, -92, -7, 180, 7, 3.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-92, -3); ctx.quadraticCurveTo(-104, -6, -104, -16); ctx.lineWidth = 5; ctx.strokeStyle = "#2f6fed"; ctx.lineCap = "round"; ctx.stroke();
  }
  if (shoes === "stilts") {
    ctx.strokeStyle = "#a9713d"; ctx.lineWidth = 6; ctx.lineCap = "round";
    for (const x of [-14, 14]) { ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x, -lift - 62); ctx.stroke(); }
    ctx.fillStyle = "#7b5229";
    for (const x of [-14, 14]) ctx.fillRect(x - 9, -lift - 4, 18, 5);
  }
  ctx.save();
  ctx.translate(0, -lift);
  // legs
  ctx.fillStyle = "#2b3a67";
  for (const x of [-14, 14]) { rr(ctx, x - 7 * big, -58, 14 * big, 54, 6); ctx.fill(); }
  // shoes
  for (const x of [-14, 14]) {
    if (shoes === "heels") {
      ctx.fillStyle = "#e5484d";
      ctx.beginPath(); ctx.moveTo(x - 12, -4); ctx.lineTo(x + 8, -8); ctx.lineTo(x + 10, 0 + 0); ctx.lineTo(x + 6, -2); ctx.lineTo(x - 16, 12); ctx.lineTo(x - 18, 9); ctx.closePath(); ctx.fill();
      ctx.fillRect(x + 6, -4, 3.2, 22); // the heel tip
    } else {
      ctx.fillStyle = shoes === "skis" ? "#1f2a44" : "#f08c2e";
      rr(ctx, x - 14, -9, 26, 10, 5); ctx.fill();
      if (shoes === "feet") { ctx.fillStyle = "#fff"; ctx.fillRect(x - 12, -3, 22, 2.4); }
    }
  }
  // body
  const g = ctx.createLinearGradient(0, -120, 0, -56);
  g.addColorStop(0, "#ffb347"); g.addColorStop(1, "#f08c2e");
  ctx.fillStyle = g;
  rr(ctx, -25 * big, -120, 50 * big, 66, 14); ctx.fill();
  // arms
  ctx.strokeStyle = "#f6c9a0"; ctx.lineWidth = 9; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-24 * big, -108); ctx.lineTo(-40 * big, -72); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(24 * big, -108); ctx.lineTo(shoes === "stilts" ? 16 : 40 * big, shoes === "stilts" ? -84 : -72); ctx.stroke();
  // head
  ctx.fillStyle = "#f6c9a0";
  ctx.beginPath(); ctx.arc(0, -144, 23, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#4a2f1d";
  ctx.beginPath(); ctx.arc(0, -150, 23.5, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(0, -158, -22, -146); ctx.fill();
  ctx.fillStyle = "#1f2a44";
  for (const x of [-8, 8]) { ctx.beginPath(); ctx.arc(x, -143, 2.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "rgba(229,72,77,.28)";
  for (const x of [-14, 14]) { ctx.beginPath(); ctx.arc(x, -136, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = "#1f2a44"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -138, 8, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.restore();
}

function drawElephant(ctx, s) {
  const k = 0.9 + (clamp(s.elephantMass, 3000, 6000) - 3000) / 3000 * 0.18;
  ctx.save();
  ctx.scale(k, k);
  const skin = ctx.createLinearGradient(0, -150, 0, 0);
  skin.addColorStop(0, "#aab6c7"); skin.addColorStop(1, "#8492a6");
  ctx.strokeStyle = "#7a8799"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(84, -104); ctx.quadraticCurveTo(100, -86, 94, -62); ctx.stroke(); // tail
  ctx.fillStyle = "#77859a";
  for (const x of [-22, 52]) { rr(ctx, x - 12, -70, 24, 70, 7); ctx.fill(); } // far legs
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(12, -94, 74, 48, 0, 0, Math.PI * 2); ctx.fill(); // body
  for (const x of [-52, 22]) { rr(ctx, x - 12, -72, 24, 72, 7); ctx.fill(); } // near legs
  ctx.fillStyle = "#f4f1e6";
  for (const x of [-52, -22, 22, 52]) for (const t of [-6, 0, 6]) { ctx.beginPath(); ctx.arc(x + t, -3, 2.6, Math.PI, 0); ctx.fill(); }
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(-66, -112, 36, 0, Math.PI * 2); ctx.fill(); // head
  ctx.strokeStyle = "#8f9db1"; ctx.lineWidth = 17;
  ctx.beginPath(); ctx.moveTo(-90, -104); ctx.quadraticCurveTo(-108, -62, -92, -30); ctx.quadraticCurveTo(-86, -20, -78, -30); ctx.stroke(); // trunk
  ctx.strokeStyle = "#fffaf0"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-78, -92); ctx.quadraticCurveTo(-70, -72, -58, -70); ctx.stroke(); // tusk
  ctx.fillStyle = "#7d8ba0";
  ctx.beginPath(); ctx.ellipse(-44, -112, 22, 32, -0.2, 0, Math.PI * 2); ctx.fill(); // ear
  ctx.fillStyle = "#1f2a44";
  ctx.beginPath(); ctx.arc(-78, -120, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawTank(ctx) {
  ctx.fillStyle = "#374151";
  rr(ctx, -95, -32, 190, 32, 16); ctx.fill(); // tracks
  ctx.fillStyle = "#9ca3af";
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-78 + i * 31.2, -16, 10, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#4b5563";
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-78 + i * 31.2, -16, 4, 0, Math.PI * 2); ctx.fill(); }
  const hull = ctx.createLinearGradient(0, -82, 0, -30);
  hull.addColorStop(0, "#7fae6f"); hull.addColorStop(1, "#557f4c");
  ctx.fillStyle = hull;
  ctx.beginPath(); ctx.moveTo(-88, -32); ctx.lineTo(-70, -56); ctx.lineTo(74, -56); ctx.lineTo(92, -32); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#4c7444";
  ctx.fillRect(30, -74, 84, 8); // barrel
  rr(ctx, 110, -76, 10, 12, 2); ctx.fill();
  ctx.fillStyle = "#6a9a5d";
  rr(ctx, -34, -84, 72, 30, 9); ctx.fill(); // turret
  ctx.fillStyle = "#4c7444";
  rr(ctx, -12, -90, 26, 8, 3); ctx.fill();
  ctx.fillStyle = "#f5c518";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 4 : 9; ctx.lineTo(2 + r * Math.cos(a), -69 + r * Math.sin(a)); }
  ctx.closePath(); ctx.fill();
}

function drawObject(ctx, object, s) {
  if (object === "brick") drawBrick(ctx, s);
  else if (object === "kid") drawKid(ctx, s);
  else if (object === "elephant") drawElephant(ctx, s);
  else if (object === "tank") drawTank(ctx, s);
}

/** Where the object touches the ground, in design units from its centre: [{ dx, w }]. */
function patches(object, s) {
  if (object === "brick") return [{ dx: 0, w: brickSize(s).w }];
  if (object === "kid") {
    if (s.kidShoes === "skis") return [{ dx: -2, w: 180 }];
    if (s.kidShoes === "heels") return [{ dx: -6.4, w: 4 }, { dx: 21.6, w: 4 }];
    if (s.kidShoes === "stilts") return [{ dx: -14, w: 7 }, { dx: 14, w: 7 }];
    return [{ dx: -15, w: 26 }, { dx: 13, w: 26 }];
  }
  if (object === "elephant") {
    const k = 0.9 + (clamp(s.elephantMass, 3000, 6000) - 3000) / 3000 * 0.18;
    return [-52, -22, 22, 52].map(x => ({ dx: x * k, w: 24 * k }));
  }
  if (object === "tank") return [{ dx: 0, w: 186 }];
  return [];
}

// ---------- animation bookkeeping (transient) ----------
const anim = (s, slot) => {
  s._anim ??= {};
  // A state restored from the host has no animation: the object is already settled, and silent.
  if (!s._anim[slot]) s._anim[slot] = { t: T_DROP + T_SINK, done: true };
  return s._anim[slot];
};
const drop = (s, slot) => {
  s._anim ??= {};
  s._anim[slot] = { t: 0, done: false };
};
const resettle = (s, object) => {
  for (const slot of ["A", "B"]) {
    if (s[slotKey(slot)] === object || object === "*") {
      const a = anim(s, slot);
      a.t = Math.min(a.t, T_DROP + T_SINK * 0.55);
      a.done = false;
    }
  }
};

function putDown(s, api, slot, object) {
  const other = slot === "A" ? "B" : "A";
  const moved = s[slotKey(other)] === object;
  place(s, slot, object);
  if (object !== "none") drop(s, slot);
  if (moved) delete s._anim?.[other];
  s._needsNew = false;
  s._verdict = "";
  api.sync();
  api.emit("placed", { slot: slot === "A" ? 1 : 2, object: OBJECT_ORDER.indexOf(object) + 1 }, "action");
}

function settled(s, api, slot) {
  const r = solve(s, slot);
  if (!r) return;
  api.emit(
    "pressure-measured",
    { slot: slot === "A" ? 1 : 2, object: OBJECT_ORDER.indexOf(r.object) + 1, force: r.force, area: r.area, pressure: r.pressure },
    "result"
  );
  const other = slot === "A" ? "B" : "A";
  const c = compare(s);
  if (c && anim(s, other).done) {
    const code = c.deeper === "A" ? 1 : c.deeper === "B" ? 2 : 0;
    api.emit("compared", { pressureA: c.a.pressure, pressureB: c.b.pressure, ratio: c.ratio, deeper: code }, "result");
    if (s.guess !== "none" && s._armed && !s._needsNew) {
      s._armed = false;
      s._verdict = s.guess === c.deeper ? "right" : "wrong";
      if (s.guess === c.deeper) api.emit("prediction-correct", { deeper: code, ratio: c.ratio }, "goal");
    }
    s._needsNew = true;
  }
  s._won ??= {};
  if (s.challenge !== "none" && !s._won[s.challenge] && challengeMet(s, s.challenge)) {
    s._won[s.challenge] = true;
    api.emit("challenge-done", { challenge: Object.keys(CHALLENGES).indexOf(s.challenge) }, "goal");
  }
}

const tuned = object => ({
  onChange: s => resettle(s, object),
  onCommit: s => resettle(s, object),
});
const holds = object => s => s.slotA === object || s.slotB === object;
const slotOptions = [{ value: "none", label: "(để trống)" }, ...OBJECT_ORDER.map(o => ({ value: o, label: OBJECTS[o] }))];

mount({
  slug: "ap-suat-chat-ran",
  version: "1.0.0",
  title: "Áp suất trên bề mặt",
  hint: "Kéo một nhân vật trên kệ thả xuống đất, mỗi bên một nhân vật. Chạm vào viên gạch để xoay, chạm vào bạn nhỏ để đổi giày. Ai lún sâu hơn?",
  initialState,
  transport: false,
  step(s, dt, api) {
    s._clock = (s._clock ?? 0) + dt;
    for (const slot of ["A", "B"]) {
      if (s[slotKey(slot)] === "none") continue;
      const a = anim(s, slot);
      if (a.done) continue;
      const before = a.t;
      a.t += dt;
      if (before < T_DROP && a.t >= T_DROP) a.dust = 1;
      if (a.t >= T_DROP + T_SINK) {
        a.done = true;
        settled(s, api, slot);
      }
    }
    for (const slot of ["A", "B"]) {
      const a = s._anim?.[slot];
      if (a?.dust > 0) a.dust = Math.max(0, a.dust - dt * 1.8);
    }
  },
  controls: [
    {
      type: "select", key: "ground", label: "Mặt đất",
      options: Object.entries(GROUNDS).map(([value, g]) => ({ value, label: g.label })),
      onChange: s => resettle(s, "*"),
    },
    { type: "heading", label: "Ai đứng ở đâu" },
    { type: "select", key: "slotA", label: "Bên trái", options: slotOptions, onChange: (s, api) => { const o = s.slotA; s.slotA = "none"; putDownQuiet(s, "A", o); } },
    { type: "select", key: "slotB", label: "Bên phải", options: slotOptions, onChange: (s, api) => { const o = s.slotB; s.slotB = "none"; putDownQuiet(s, "B", o); } },
    { type: "heading", label: "Tùy chỉnh nhân vật" },
    { type: "select", key: "brickFace", label: "Viên gạch: cách đặt", visible: holds("brick"), options: FACE_ORDER.map(f => ({ value: f, label: BRICK_FACES[f].label })), ...tuned("brick") },
    { type: "stepper", key: "brickCount", label: "Số viên gạch chồng lên nhau", min: RANGE.brickCount[0], max: RANGE.brickCount[1], visible: holds("brick"), ...tuned("brick") },
    { type: "slider", key: "brickMass", label: "Khối lượng mỗi viên gạch", min: RANGE.brickMass[0], max: RANGE.brickMass[1], step: 0.5, unit: "kg", digits: 1, visible: holds("brick"), ...tuned("brick") },
    { type: "select", key: "kidShoes", label: "Bạn nhỏ: đi gì dưới chân", visible: holds("kid"), options: SHOE_ORDER.map(k => ({ value: k, label: SHOES[k].label })), ...tuned("kid") },
    { type: "slider", key: "kidMass", label: "Khối lượng bạn nhỏ", min: RANGE.kidMass[0], max: RANGE.kidMass[1], step: 1, unit: "kg", digits: 0, visible: holds("kid"), ...tuned("kid") },
    { type: "slider", key: "elephantMass", label: "Khối lượng chú voi", min: RANGE.elephantMass[0], max: RANGE.elephantMass[1], step: 100, unit: "kg", digits: 0, visible: holds("elephant"), ...tuned("elephant") },
    { type: "heading", label: "Thử sức" },
    {
      type: "select", key: "guess", label: "Em đoán: bên nào lún sâu hơn?",
      options: [
        { value: "none", label: "(chưa đoán)" },
        { value: "A", label: "Bên trái" },
        { value: "B", label: "Bên phải" },
        { value: "equal", label: "Hai bên bằng nhau" },
      ],
      onChange: s => { s._armed = s.guess !== "none"; s._verdict = ""; },
    },
    { type: "select", key: "challenge", label: "Thử thách", options: Object.entries(CHALLENGES).map(([value, label]) => ({ value, label })), onChange: s => resettle(s, "*") },
    {
      type: "button", label: "Dọn sạch mặt đất",
      action(s, api) {
        s.slotA = "none"; s.slotB = "none"; s._anim = {}; s._verdict = ""; s._needsNew = false;
        api.emit("cleared", {}, "action");
      },
    },
  ],
  readouts: [
    { label: "Áp suất bên trái", value: s => { const r = solve(s, "A"); return r ? fmtP(r.pressure) : "–"; } },
    { label: "Áp suất bên phải", value: s => { const r = solve(s, "B"); return r ? fmtP(r.pressure) : "–"; } },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geo(view);
      const card = shelfCards(view, g).find(c => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
      if (card) {
        s._drag = { object: card.object, from: null, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: true };
        return true;
      }
      if (p.y > g.shelfH && p.y < g.ground + g.dentMax + 8) {
        const slot = p.x < view.w / 2 ? "A" : "B";
        const object = s[slotKey(slot)];
        const cx = slot === "A" ? g.xA : g.xB;
        if (object !== "none" && Math.abs(p.x - cx) < 118 * g.u && p.y > g.ground - 205 * g.u) {
          s._drag = { object, from: slot, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
          return true;
        }
      }
      return false;
    },
    move(p, s) {
      const d = s._drag;
      if (!d) return;
      d.x = p.x; d.y = p.y;
      if (Math.hypot(p.x - d.sx, p.y - d.sy) > 9) d.moved = true;
    },
    up(p, s, api, view) {
      const d = s._drag;
      s._drag = null;
      if (!d) return;
      const g = geo(view);
      if (d.from && !d.moved) {
        // a tap: turn the brick, or change what the child wears
        if (d.object === "brick") {
          s.brickFace = nextOf(FACE_ORDER, s.brickFace);
          resettle(s, "brick");
          api.sync();
          api.emit("param", { key: "brickFace", value: s.brickFace }, "param");
          api.emit("object-tapped", { object: 1 }, "action");
        } else if (d.object === "kid") {
          s.kidShoes = nextOf(SHOE_ORDER, s.kidShoes);
          resettle(s, "kid");
          api.sync();
          api.emit("param", { key: "kidShoes", value: s.kidShoes }, "param");
          api.emit("object-tapped", { object: 2 }, "action");
        }
        return;
      }
      if (p.y > g.shelfH + 6) {
        const slot = p.x < view.w / 2 ? "A" : "B";
        if (d.from === slot) return; // put back where it was
        if (d.from) { s[slotKey(d.from)] = "none"; delete s._anim?.[d.from]; }
        putDown(s, api, slot, d.object);
      } else if (d.from) {
        putDown(s, api, d.from, "none"); // dragged back to the shelf
        delete s._anim?.[d.from];
      }
    },
  },
  draw(ctx, s, view) {
    const g = geo(view);
    const look = GROUND_LOOK[s.ground] ?? GROUND_LOOK.sand;
    const clock = s._clock ?? 0;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, g.ground);
    sky.addColorStop(0, "#bfe3ff"); sky.addColorStop(1, "#fff6dd");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, view.w, g.ground + 2);
    const sunX = view.w * 0.5, sunY = g.shelfH + (g.small ? 26 : 44);
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, g.small ? 46 : 80);
    glow.addColorStop(0, "rgba(255,221,120,.95)"); glow.addColorStop(0.35, "rgba(255,221,120,.45)"); glow.addColorStop(1, "rgba(255,221,120,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sunX, sunY, g.small ? 46 : 80, 0, Math.PI * 2); ctx.fill();
    // far hills
    ctx.fillStyle = s.ground === "snow" ? "#e6eefb" : s.ground === "concrete" ? "#dfe4ea" : "#f3e3bb";
    ctx.beginPath(); ctx.moveTo(0, g.ground);
    ctx.quadraticCurveTo(view.w * 0.2, g.ground - 54, view.w * 0.45, g.ground - 14);
    ctx.quadraticCurveTo(view.w * 0.72, g.ground - 70, view.w, g.ground - 22);
    ctx.lineTo(view.w, g.ground); ctx.closePath(); ctx.fill();

    // objects standing on (and sinking into) the ground
    const notches = [];
    for (const slot of ["A", "B"]) {
      const object = s[slotKey(slot)];
      if (object === "none" || (s._drag?.from === slot && s._drag.moved)) continue;
      const r = solve(s, slot);
      const a = anim(s, slot);
      const cx = slot === "A" ? g.xA : g.xB;
      const fall = clamp(a.t / T_DROP, 0, 1);
      const sink = easeOut(clamp((a.t - T_DROP) / T_SINK, 0, 1));
      // Only the tip of a heel or a stilt goes in; the shoe itself then rests on the ground.
      const tip = object === "kid" ? { heels: 17, stilts: 40 }[s.kidShoes] : undefined;
      const depth = Math.min(r.depth * g.dentMax, tip ? tip * g.u : Infinity) * sink;
      const y = g.ground - (1 - fall * fall) * (g.ground - g.shelfH - 30) + depth;
      // soft shadow
      ctx.fillStyle = `rgba(60,45,20,${0.16 * fall})`;
      ctx.beginPath(); ctx.ellipse(cx, g.ground + 2, 96 * g.u * (0.6 + 0.4 * fall), 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(cx, y);
      ctx.scale(g.u, g.u);
      drawObject(ctx, object, s);
      ctx.restore();
      if (fall >= 1) for (const p of patches(object, s)) notches.push({ x0: cx + (p.dx - p.w / 2) * g.u - 1, x1: cx + (p.dx + p.w / 2) * g.u + 1, d: depth });
      // dust kicked up on landing
      if (a.dust > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.55 * a.dust})`;
        for (let i = 0; i < 9; i++) {
          const k = (i / 8 - 0.5) * 2;
          ctx.beginPath();
          ctx.arc(cx + k * 110 * g.u * (1.25 - a.dust * 0.4), g.ground - 6 - (1 - a.dust) * 26 * (1 - Math.abs(k) * 0.5), 5 + 7 * (1 - a.dust), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // the ground, drawn over the sunk part, with an open notch under every contact patch
    notches.sort((p, q) => p.x0 - q.x0);
    const soil = ctx.createLinearGradient(0, g.ground, 0, view.h);
    soil.addColorStop(0, look.top); soil.addColorStop(1, look.deep);
    ctx.fillStyle = soil;
    ctx.beginPath(); ctx.moveTo(0, g.ground);
    for (const n of notches) { ctx.lineTo(n.x0, g.ground); ctx.lineTo(n.x0, g.ground + n.d); ctx.lineTo(n.x1, g.ground + n.d); ctx.lineTo(n.x1, g.ground); }
    ctx.lineTo(view.w, g.ground); ctx.lineTo(view.w, view.h); ctx.lineTo(0, view.h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = look.edge; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(0, g.ground);
    for (const n of notches) { ctx.lineTo(n.x0, g.ground); ctx.lineTo(n.x0, g.ground + n.d); ctx.lineTo(n.x1, g.ground + n.d); ctx.lineTo(n.x1, g.ground); }
    ctx.lineTo(view.w, g.ground); ctx.stroke();
    ctx.fillStyle = look.speck;
    for (let i = 0; i < 90; i++) {
      const x = ((i * 137.5) % 997) / 997 * view.w;
      const y = g.ground + 6 + ((i * 71.3) % 613) / 613 * (view.h - g.ground - 8);
      if (!notches.some(n => x > n.x0 - 3 && x < n.x1 + 3 && y < g.ground + n.d + 4)) ctx.fillRect(x, y, 2, 2);
    }
    if (s.ground === "concrete") {
      ctx.strokeStyle = look.edge; ctx.lineWidth = 1;
      for (let x = 60; x < view.w; x += 150) { ctx.beginPath(); ctx.moveTo(x, g.ground); ctx.lineTo(x - 14, view.h); ctx.stroke(); }
    }

    // a result card under each side
    const cardW = Math.min(250, view.w / 2 - 14);
    const cardH = g.small ? 42 : 86;
    const cardY = Math.min(view.h - cardH - 6, g.ground + g.dentMax + 12);
    const cmp = compare(s);
    for (const slot of ["A", "B"]) {
      const r = solve(s, slot);
      const cx = slot === "A" ? g.xA : g.xB;
      const x = clamp(cx - cardW / 2, 6, view.w - cardW - 6);
      const a = r ? anim(s, slot) : null;
      ctx.save();
      ctx.shadowColor = "rgba(31,42,68,.18)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
      ctx.fillStyle = "rgba(255,255,255,.96)";
      rr(ctx, x, cardY, cardW, cardH, 12); ctx.fill();
      ctx.restore();
      ctx.textBaseline = "middle";
      if (!r) {
        ctx.fillStyle = "#8a96ab"; ctx.textAlign = "center"; ctx.font = `${g.small ? 12 : 14}px ${FONT}`;
        ctx.fillText(slot === "A" ? "Thả một nhân vật vào bên trái" : "Thả một nhân vật vào bên phải", x + cardW / 2, cardY + cardH / 2);
        continue;
      }
      const ready = a.done;
      const deeper = ready && cmp && cmp.deeper === slot;
      const t = clamp((Math.log10(r.pressure) - Math.log10(P_LOW)) / (Math.log10(P_HIGH) - Math.log10(P_LOW)), 0, 1);
      const hue = 140 - 140 * t; // green → red
      ctx.textAlign = "left";
      if (!g.small) {
        ctx.fillStyle = "#6b7890"; ctx.font = `13px ${FONT}`;
        ctx.fillText(`${OBJECTS[r.object]}  ·  F = ${fmtF(r.force)}  ·  S = ${fmtS(r.areaCm2)}`, x + 14, cardY + 19);
      }
      ctx.fillStyle = `hsl(${hue} 70% 36%)`;
      ctx.font = `700 ${g.small ? 16 : 24}px ${FONT}`;
      const py = g.small ? cardY + 14 : cardY + 46;
      ctx.fillText(ready ? `p = ${fmtP(r.pressure)}` : "p = …", x + 14, py);
      if (deeper) {
        ctx.textAlign = "right"; ctx.font = `600 ${g.small ? 11 : 13}px ${FONT}`; ctx.fillStyle = "#e5484d";
        ctx.fillText("lún sâu hơn", x + cardW - 14, py);
      }
      // pressure bar, logarithmic
      const bx = x + 14, bw = cardW - 28, by = cardY + cardH - (g.small ? 12 : 16);
      const bar = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      bar.addColorStop(0, "#35b37e"); bar.addColorStop(0.5, "#f5c518"); bar.addColorStop(1, "#e5484d");
      ctx.fillStyle = "#e8edf5"; rr(ctx, bx, by, bw, 7, 3.5); ctx.fill();
      if (ready) {
        ctx.save(); rr(ctx, bx, by, Math.max(7, bw * t), 7, 3.5); ctx.clip();
        ctx.fillStyle = bar; ctx.fillRect(bx, by, bw, 7); ctx.restore();
      }
    }

    // shelf
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.fillRect(0, 0, view.w, g.shelfH);
    ctx.fillStyle = "#c79a5b";
    ctx.fillRect(0, g.shelfH - 5, view.w, 5);
    ctx.fillStyle = "#a57a42";
    ctx.fillRect(0, g.shelfH - 1.5, view.w, 1.5);
    for (const c of shelfCards(view, g)) {
      const used = s.slotA === c.object || s.slotB === c.object;
      const lifted = s._drag && !s._drag.from && s._drag.object === c.object;
      ctx.save();
      ctx.globalAlpha = used || lifted ? 0.32 : 1;
      const k = (c.h - (g.small ? 18 : 24)) / (c.object === "tank" ? 110 : 200);
      ctx.translate(c.x + c.w / 2, c.y + c.h - (g.small ? 16 : 22));
      ctx.scale(k, k);
      drawObject(ctx, c.object, { ...initialState(), brickFace: "medium", kidShoes: "feet" });
      ctx.restore();
      ctx.fillStyle = used ? "#9aa5b8" : "#1f2a44";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `600 ${g.small ? 10.5 : 13}px ${FONT}`;
      ctx.fillText(OBJECTS[c.object], c.x + c.w / 2, c.y + c.h - (g.small ? 9 : 12));
    }

    // headline: what the comparison shows
    const bothDone = cmp && anim(s, "A").done && anim(s, "B").done;
    let line = "Kéo nhân vật trên kệ thả xuống đất";
    let color = "#1f2a44";
    if (bothDone) {
      const names = { A: OBJECTS[cmp.a.object], B: OBJECTS[cmp.b.object] };
      if (cmp.deeper === "equal") line = `${names.A} và ${names.B} ép lên mặt đất mạnh như nhau!`;
      else {
        const hi = cmp.deeper, lo = hi === "A" ? "B" : "A";
        line = `${names[hi]} ép lên mặt đất mạnh gấp ${fmt(cmp.ratio, cmp.ratio < 10 ? 1 : 0)} lần ${names[lo].toLowerCase()}`;
      }
      if (s.ground === "concrete") line += " (bê tông cứng nên không lún)";
      color = "#b4232a";
    } else if (cmp || s.slotA !== "none" || s.slotB !== "none") line = cmp ? "…" : "Thả thêm một nhân vật vào bên còn trống để so sánh";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let size = g.small ? 14 : 20;
    ctx.font = `700 ${size}px ${FONT}`;
    while (ctx.measureText(line).width > view.w - 20 && size > 10) ctx.font = `700 ${--size}px ${FONT}`;
    const hy = g.shelfH + g.headline / 2 + 2;
    ctx.lineWidth = 5; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineJoin = "round";
    ctx.strokeText(line, view.w / 2, hy);
    ctx.fillStyle = color;
    ctx.fillText(line, view.w / 2, hy);
    const sub =
      s._verdict === "right" ? "✓ Em đoán đúng rồi!" :
      s._verdict === "wrong" ? "Chưa đúng. Hãy để ý diện tích tiếp xúc S, không chỉ là nặng hay nhẹ." :
      s.challenge !== "none" && s._won?.[s.challenge] ? `✓ Hoàn thành thử thách: ${CHALLENGES[s.challenge]}` :
      s.challenge !== "none" ? `Thử thách: ${CHALLENGES[s.challenge]}` : "";
    if (sub && !g.small) {
      ctx.font = `600 13px ${FONT}`;
      ctx.fillStyle = sub.startsWith("✓") ? "#1f9d6b" : "#6b7890";
      ctx.strokeText(sub, view.w / 2, hy + 24);
      ctx.fillText(sub, view.w / 2, hy + 24);
    }

    // bouncing pointer while the ground is empty
    if (s.slotA === "none" && s.slotB === "none" && !s._drag) {
      const by = g.shelfH + g.headline + 20 + Math.sin(clock * 4) * 7;
      ctx.fillStyle = "#2f6fed";
      for (const x of [g.xA, g.xB]) {
        ctx.beginPath(); ctx.moveTo(x - 12, by); ctx.lineTo(x + 12, by); ctx.lineTo(x, by + 16); ctx.closePath(); ctx.fill();
        ctx.fillRect(x - 4, by - 18, 8, 18);
      }
    }

    // the thing being dragged
    if (s._drag?.moved) {
      const d = s._drag;
      const over = d.y > g.shelfH + 6;
      if (over) {
        ctx.fillStyle = "rgba(47,111,237,.10)";
        ctx.fillRect(d.x < view.w / 2 ? 0 : view.w / 2, g.shelfH, view.w / 2, g.ground - g.shelfH);
      }
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.translate(d.x, d.y + 70 * g.u);
      ctx.scale(g.u, g.u);
      drawObject(ctx, d.object, s);
      ctx.restore();
    }

    ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.font = `${g.small ? 9 : 11}px ${FONT}`;
    ctx.fillStyle = s.ground === "mud" ? "rgba(255,255,255,.75)" : "#7c879b";
    ctx.fillText("Hình không theo tỉ lệ; độ lún chỉ minh họa (thang lôgarit), lấy g = 10 N/kg.", view.w - 8, view.h - 6);
  },
});

function shelfCards(view, g) {
  const gap = g.small ? 6 : 12;
  const w = Math.min(g.small ? 84 : 150, (view.w - gap * 5) / 4);
  const x0 = (view.w - (w * 4 + gap * 3)) / 2;
  return OBJECT_ORDER.map((object, i) => ({ object, x: x0 + i * (w + gap), y: 4, w, h: g.shelfH - 10 }));
}

// Chosen from the panel instead of dragged: same rules, the kit reports the change itself.
function putDownQuiet(s, slot, object) {
  const other = slot === "A" ? "B" : "A";
  const moved = object !== "none" && s[slotKey(other)] === object;
  place(s, slot, object);
  if (object !== "none") drop(s, slot);
  else delete s._anim?.[slot];
  if (moved) delete s._anim?.[other];
  s._needsNew = false;
  s._verdict = "";
}
