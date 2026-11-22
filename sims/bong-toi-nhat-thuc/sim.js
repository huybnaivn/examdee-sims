import { mount, COLORS, label, fmt, arrow } from "../../kit/v1/kit.js";
import { initialState, placed, screenShadow, halfWidths, SCREEN_X, MIN_GAP, MAX_OBJECT_X, SUN, EARTH, moonPos, axis, eclipse, order } from "./model.js";

const Y_MAX = 40; // cm, half-height of the screen
const UMBRA = "rgba(30, 36, 52, 0.82)";
const PENUMBRA = "rgba(90, 100, 125, 0.35)";
const LIGHT = "rgba(245, 197, 24, 0.13)";

const STATUS = {
  "solar-total": ["Nhật thực toàn phần", "Vùng bóng tối của Mặt Trăng rơi lên Trái Đất: ở đó không nhìn thấy Mặt Trời."],
  "solar-partial": ["Nhật thực một phần", "Trái Đất chỉ nằm trong vùng bóng nửa tối của Mặt Trăng: chỉ thấy một phần Mặt Trời."],
  "lunar-total": ["Nguyệt thực toàn phần", "Mặt Trăng nằm hẳn trong vùng bóng tối của Trái Đất."],
  "lunar-partial": ["Nguyệt thực một phần", "Một phần Mặt Trăng nằm trong vùng bóng tối của Trái Đất."],
  "lunar-penumbral": ["Mặt Trăng ở vùng bóng nửa tối", "Mặt Trăng chỉ hơi mờ đi, rất khó nhận ra."],
  none: ["Không có nhật thực hay nguyệt thực", "Mặt Trời, Trái Đất và Mặt Trăng chưa thẳng hàng."],
};

// ---------- reporting ----------
function reportShadow(s, api) {
  const out = screenShadow(s);
  api.emit("shadow-measured", { umbraWidth: out.umbra, penumbraWidth: out.penumbra, sourceToObject: out.sourceToObject, sourceToScreen: out.sourceToScreen }, "result");
}

// One goal each time the alignment becomes a total eclipse, not on every tick.
function reportEclipse(s, api) {
  const type = eclipse(s.moonAngle);
  if (type !== s._last) {
    if (type === "solar-total") api.emit("total-solar-eclipse", { moonAngle: s.moonAngle }, "goal");
    if (type === "lunar-total") api.emit("total-lunar-eclipse", { moonAngle: s.moonAngle }, "goal");
  }
  s._last = type;
}

// Keep the object at least MIN_GAP in front of the source when either one moves.
const keepGap = s => {
  s.objectX = Math.min(MAX_OBJECT_X, Math.max(s.objectX, s.sourceX + MIN_GAP));
  s.sourceX = Math.min(s.sourceX, s.objectX - MIN_GAP);
};

// ---------- part 1 geometry ----------
function geom1(view) {
  const small = view.w < 520 || view.h < 420;
  const top = small ? 30 : 52;
  const bottom = small ? 48 : 74;
  const right = small ? 64 : 124;
  // 10 cm of room left of the ruler's 0 for the largest bulb
  const k = Math.min((view.w - 8 - right) / (SCREEN_X + 10), (view.h - top - bottom) / (2 * Y_MAX));
  const x0 = 8 + 10 * k + (view.w - 8 - right - (SCREEN_X + 10) * k) / 2;
  const cy = top + (view.h - top - bottom) / 2;
  return { small, k, X: cm => x0 + cm * k, Y: cm => cy - cm * k, cy };
}

function drawShadow(ctx, s, view) {
  const g = geom1(view);
  const { X, Y, k, small } = g;
  const { sourceX: xs, objectX: xo, d, h } = placed(s);
  const sh = screenShadow(s);
  const size = small ? 11 : 13;
  const dist = SCREEN_X - xo;
  const L = xo - xs;

  // light reaching the screen
  ctx.fillStyle = LIGHT;
  ctx.beginPath();
  ctx.moveTo(X(xs), Y(d / 2));
  ctx.lineTo(X(SCREEN_X), Y(Y_MAX));
  ctx.lineTo(X(SCREEN_X), Y(-Y_MAX));
  ctx.lineTo(X(xs), Y(-d / 2));
  ctx.fill();

  // shadow regions between object and screen, clipped to the screen height
  ctx.save();
  ctx.beginPath();
  ctx.rect(X(xo), Y(Y_MAX), X(SCREEN_X) - X(xo), 2 * Y_MAX * k);
  ctx.clip();
  ctx.fillStyle = PENUMBRA;
  ctx.beginPath();
  ctx.moveTo(X(xo), Y(h / 2));
  ctx.lineTo(X(SCREEN_X), Y(sh.p));
  ctx.lineTo(X(SCREEN_X), Y(-sh.p));
  ctx.lineTo(X(xo), Y(-h / 2));
  ctx.fill();
  ctx.fillStyle = UMBRA;
  ctx.beginPath();
  ctx.moveTo(X(xo), Y(h / 2));
  if (sh.u > 0) {
    ctx.lineTo(X(SCREEN_X), Y(sh.u));
    ctx.lineTo(X(SCREEN_X), Y(-sh.u));
  } else {
    ctx.lineTo(X(xo + (h / 2) * (L / (d / 2 - h / 2))), Y(0)); // umbra cone ends before the screen
  }
  ctx.lineTo(X(xo), Y(-h / 2));
  ctx.fill();
  ctx.restore();

  // edge rays: same-side edges bound the umbra, opposite edges bound the penumbra
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, Y(Y_MAX), X(SCREEN_X), 2 * Y_MAX * k);
  ctx.clip();
  ctx.lineWidth = 1.2;
  const ray = (y0, y1, color) => {
    const yEnd = y0 + ((y1 - y0) * (SCREEN_X - xs)) / L;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(X(xs), Y(y0));
    ctx.lineTo(X(SCREEN_X), Y(yEnd));
    ctx.stroke();
  };
  for (const sign of [1, -1]) {
    ray((sign * d) / 2, (sign * h) / 2, COLORS.orange);
    if (d > 0) {
      ctx.setLineDash([5, 4]);
      ray((-sign * d) / 2, (sign * h) / 2, COLORS.orange);
      ctx.setLineDash([]);
    }
  }
  ctx.restore();

  // screen, coloured by what reaches it
  const sw = small ? 7 : 10;
  const band = (y0, y1, color) => {
    const a = Math.max(-Y_MAX, Math.min(y0, y1));
    const b = Math.min(Y_MAX, Math.max(y0, y1));
    if (b <= a) return;
    ctx.fillStyle = color;
    ctx.fillRect(X(SCREEN_X), Y(b), sw, (b - a) * k);
  };
  band(-Y_MAX, Y_MAX, "#fff2a8");
  band(-sh.p, sh.p, "#9ba4b8");
  if (sh.u > 0) band(-sh.u, sh.u, "#262b38");
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(X(SCREEN_X), Y(Y_MAX), sw, 2 * Y_MAX * k);
  label(ctx, "Màn chắn", X(SCREEN_X) + sw / 2, Y(Y_MAX) - 10, { size, align: "center", bold: true });

  // what is on the screen
  const tx = X(SCREEN_X) + sw + 6;
  if (sh.umbra > 0) label(ctx, small ? "tối" : "Bóng tối", tx, Y(0), { size, bold: true });
  if (sh.penumbra > 0.05) {
    const yp = Math.min(Y_MAX - 3, (Math.max(0, sh.u) + sh.p) / 2);
    label(ctx, small ? "nửa tối" : "Bóng nửa tối", tx, Y(yp), { size, color: COLORS.muted, bold: true });
    if (!sh.umbra && !small) label(ctx, "(không có bóng tối)", tx, Y(0), { size: size - 1, color: COLORS.muted });
  }

  // source
  if (d > 0) {
    const glow = ctx.createRadialGradient(X(xs), Y(0), 0, X(xs), Y(0), (d / 2) * k + 14);
    glow.addColorStop(0, "rgba(245,197,24,0.9)");
    glow.addColorStop(1, "rgba(245,197,24,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(X(xs), Y(0), (d / 2) * k + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd84d";
    ctx.strokeStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(X(xs), Y(0), Math.max(3, (d / 2) * k), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(X(xs), Y(0), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // below the source, so it never meets the object's label above the object
  label(ctx, d > 0 ? "Nguồn sáng rộng" : "Nguồn sáng hẹp", Math.max(X(xs), small ? 46 : 56), Y(-Math.max(d / 2, 2)) + 16, { size, align: "center", bold: true, color: COLORS.orange });

  // opaque object
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(X(xo) - Math.max(2, k), Y(h / 2), Math.max(4, 2 * k), h * k);
  label(ctx, "Vật cản", X(xo), Y(h / 2) - 12, { size, align: "center", bold: true });

  // ruler
  const ry = Y(-Y_MAX) + (small ? 14 : 20);
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(X(0), ry);
  ctx.lineTo(X(SCREEN_X), ry);
  ctx.stroke();
  for (let cm = 0; cm <= SCREEN_X; cm += 10) {
    ctx.beginPath();
    ctx.moveTo(X(cm), ry);
    ctx.lineTo(X(cm), ry + 4);
    ctx.stroke();
    if (!small || cm % 20 === 0) label(ctx, `${cm}`, X(cm), ry + 12, { size: size - 2, align: "center", color: COLORS.muted });
  }
  label(ctx, "cm", X(SCREEN_X) + 12, ry + 12, { size: size - 2, color: COLORS.muted });
  for (const [x, c] of [[xs, COLORS.orange], [xo, COLORS.ink]]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(X(x), ry - 1);
    ctx.lineTo(X(x) - 4, ry - 8);
    ctx.lineTo(X(x) + 4, ry - 8);
    ctx.fill();
  }

  // header
  const text = small
    ? `Bóng tối ${fmt(sh.umbra, 1)} cm · nửa tối ${fmt(sh.penumbra, 1)} cm/bên`
    : `Trên màn: bóng tối rộng ${fmt(sh.umbra, 1)} cm · bóng nửa tối rộng ${fmt(sh.penumbra, 1)} cm mỗi bên`;
  label(ctx, text, view.w / 2, small ? 12 : 20, { size: small ? 12 : 15, bold: true, align: "center" });
  if (sh.p > Y_MAX) label(ctx, "Bóng rộng hơn màn chắn", view.w / 2, small ? 26 : 40, { size: size - 1, align: "center", color: COLORS.red });
  if (!small) {
    label(ctx, `Nguồn – vật: ${fmt(L, 0)} cm   ·   Nguồn – màn: ${fmt(SCREEN_X - xs, 0)} cm   ·   Vật – màn: ${fmt(dist, 0)} cm`, view.w / 2, view.h - 16, { size: 13, align: "center", color: COLORS.muted });
  }
}

// ---------- part 2 geometry ----------
function wrap(ctx, text, width, size) {
  ctx.font = `${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const lines = [""];
  for (const word of text.split(" ")) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (ctx.measureText(next).width > width && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  return lines;
}

function geom2(view) {
  const small = view.w < 520 || view.h < 420;
  const top = small ? 58 : 84;
  const bottom = small ? 20 : 30;
  const k = Math.min(view.w / 14, (view.h - top - bottom) / 10.6);
  const cx = view.w * 0.47;
  const cy = top + (view.h - top - bottom) / 2;
  return { small, k, cx, cy, X: x => cx + x * k, Y: y => cy - y * k };
}

function cone(ctx, g, body, which, color) {
  const { L, ex, ey } = axis(body);
  const nx = -ey;
  const ny = ex;
  const far = 20;
  const pt = (x, y) => [g.X(body.x + ex * x + nx * y), g.Y(body.y + ey * x + ny * y)];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...pt(0, body.r));
  if (which === "u" && SUN.r > body.r) {
    const tip = (body.r * L) / (SUN.r - body.r);
    if (tip < far) ctx.lineTo(...pt(tip, 0));
    else {
      const u = halfWidths(SUN.r, body.r, L, far).u;
      ctx.lineTo(...pt(far, u));
      ctx.lineTo(...pt(far, -u));
    }
  } else {
    const p = halfWidths(SUN.r, body.r, L, far)[which];
    ctx.lineTo(...pt(far, p));
    ctx.lineTo(...pt(far, -p));
  }
  ctx.lineTo(...pt(0, -body.r));
  ctx.fill();
}

function drawEclipse(ctx, s, view) {
  const g = geom2(view);
  const { X, Y, k, small } = g;
  const moon = moonPos(s.moonAngle);
  const type = eclipse(s.moonAngle);
  const size = small ? 11 : 13;

  // the Sun, far to the left
  const sr = Math.min(view.h * 0.42, 6.2 * k);
  const sx = X(-6.4) - sr;
  const glow = ctx.createRadialGradient(sx, g.cy, sr * 0.8, sx, g.cy, sr * 1.25);
  glow.addColorStop(0, "rgba(245,197,24,0.5)");
  glow.addColorStop(1, "rgba(245,197,24,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.arc(sx, g.cy, sr, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, "Mặt Trời", Math.max(6, X(-6.4) - (small ? 50 : 70)), g.cy, { size, bold: true, color: "#8a5a00" });
  if (!small) arrow(ctx, X(-5.8), Y(4.2), X(-4.2), Y(4.2), COLORS.orange, 2);
  if (!small) label(ctx, "ánh sáng", X(-5.8), Y(4.2) - 12, { size: 12, color: COLORS.orange });

  // orbit
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(X(0), Y(0), 4 * k, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // bodies
  ctx.fillStyle = "#3d8be0";
  ctx.beginPath();
  ctx.arc(X(0), Y(0), EARTH.r * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4fb36b";
  ctx.beginPath();
  ctx.ellipse(X(-0.25), Y(0.2), 0.35 * k, 0.5 * k, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c9ccd4";
  ctx.beginPath();
  ctx.arc(X(moon.x), Y(moon.y), moon.r * k, 0, Math.PI * 2);
  ctx.fill();

  // shadows (the dark half of each body is the start of its own shadow)
  cone(ctx, g, EARTH, "p", PENUMBRA);
  cone(ctx, g, moon, "p", PENUMBRA);
  cone(ctx, g, EARTH, "u", "rgba(30, 36, 52, 0.55)");
  cone(ctx, g, moon, "u", "rgba(30, 36, 52, 0.7)");
  ctx.strokeStyle = "rgba(31,42,68,0.5)";
  ctx.lineWidth = 1;
  for (const b of [EARTH, moon]) {
    ctx.beginPath();
    ctx.arc(X(b.x), Y(b.y), b.r * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  label(ctx, "Trái Đất", X(0), Y(-EARTH.r) + 12, { size, align: "center", bold: true });
  label(ctx, "Mặt Trăng", X(moon.x), Y(moon.y) + (moon.y >= 0 ? -moon.r * k - 11 : moon.r * k + 11), { size, align: "center", bold: true, color: COLORS.muted });

  // status and order
  const [title, detail] = STATUS[type];
  const color = type.startsWith("solar") || type.startsWith("lunar-t") || type === "lunar-partial" ? COLORS.red : COLORS.ink;
  label(ctx, title, view.w / 2, small ? 12 : 18, { size: small ? 13 : 17, bold: true, align: "center", color });
  label(ctx, `Thứ tự: ${order(s.moonAngle).join(" – ")}`, view.w / 2, small ? 29 : 42, { size: small ? 11 : 13, align: "center", bold: true });
  wrap(ctx, detail, view.w - 16, small ? 11 : 13).slice(0, 2).forEach((line, i) =>
    label(ctx, line, view.w / 2, (small ? 43 : 60) + i * (small ? 13 : 16), { size: small ? 11 : 13, align: "center", color: COLORS.muted })
  );
  label(ctx, "Kích thước và khoảng cách không đúng tỉ lệ", view.w - 8, view.h - (small ? 9 : 14), { size: small ? 10 : 12, align: "right", color: COLORS.muted });
}

mount({
  slug: "bong-toi-nhat-thuc",
  version: "1.0.0",
  title: "Bóng tối, nhật thực và nguyệt thực",
  hint: "Phần 1: kéo nguồn sáng hoặc vật cản để xem bóng trên màn. Phần 2: kéo Mặt Trăng trên quỹ đạo để tạo nhật thực hoặc nguyệt thực.",
  initialState,
  controls: [
    {
      type: "select",
      key: "part",
      label: "Phần",
      options: [
        { value: "shadow", label: "1. Bóng tối và bóng nửa tối" },
        { value: "eclipse", label: "2. Nhật thực và nguyệt thực" },
      ],
    },
    {
      type: "select",
      key: "source",
      label: "Nguồn sáng",
      options: [
        { value: "point", label: "Nguồn sáng hẹp (coi như một điểm)" },
        { value: "bulb", label: "Nguồn sáng rộng (bóng đèn)" },
      ],
      visible: s => s.part === "shadow",
      onCommit: reportShadow,
    },
    { type: "slider", key: "bulbSize", label: "Đường kính bóng đèn", min: 2, max: 20, step: 1, unit: "cm", digits: 0, visible: s => s.part === "shadow" && s.source === "bulb", onCommit: reportShadow },
    { type: "slider", key: "objectSize", label: "Đường kính vật cản", min: 4, max: 16, step: 1, unit: "cm", digits: 0, visible: s => s.part === "shadow", onCommit: reportShadow },
    { type: "slider", key: "sourceX", label: "Vị trí nguồn sáng", min: 0, max: 40, step: 1, unit: "cm", digits: 0, visible: s => s.part === "shadow", onChange: keepGap, onCommit: reportShadow },
    { type: "slider", key: "objectX", label: "Vị trí vật cản", min: MIN_GAP, max: MAX_OBJECT_X, step: 1, unit: "cm", digits: 0, visible: s => s.part === "shadow", onChange: keepGap, onCommit: reportShadow },
    {
      type: "slider",
      key: "moonAngle",
      label: "Vị trí Mặt Trăng trên quỹ đạo",
      min: 0,
      max: 359,
      step: 1,
      format: v => `${fmt(v, 0)}°${v === 180 ? " (phía Mặt Trời)" : v === 0 ? " (phía sau Trái Đất)" : ""}`,
      visible: s => s.part === "eclipse",
      onCommit: reportEclipse,
    },
  ],
  readouts: [
    { label: "Bóng tối trên màn", value: s => (s.part === "shadow" ? `${fmt(screenShadow(s).umbra, 1)} cm` : "–") },
    { label: "Bóng nửa tối (mỗi bên)", value: s => (s.part === "shadow" ? `${fmt(screenShadow(s).penumbra, 1)} cm` : "–") },
    { label: "Hiện tượng", value: s => (s.part === "eclipse" ? STATUS[eclipse(s.moonAngle)][0] : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      if (s.part === "eclipse") {
        const g = geom2(view);
        const m = moonPos(s.moonAngle);
        if (Math.hypot(p.x - g.X(m.x), p.y - g.Y(m.y)) > m.r * g.k + 18) return false;
        s._drag = "moon";
        return true;
      }
      const { X, Y, k } = geom1(view);
      const { sourceX, objectX, d, h } = placed(s);
      if (Math.abs(p.x - X(objectX)) < 16 && Math.abs(p.y - Y(0)) < (h / 2) * k + 16) s._drag = "object";
      else if (Math.hypot(p.x - X(sourceX), p.y - Y(0)) < (d / 2) * k + 18) s._drag = "source";
      else return false;
      return true;
    },
    move(p, s, api, view) {
      if (s._drag === "moon") {
        const g = geom2(view);
        const a = (Math.atan2(g.cy - p.y, p.x - g.cx) * 180) / Math.PI;
        s.moonAngle = Math.round((a + 360) % 360) % 360;
        return;
      }
      const { k } = geom1(view);
      const x = Math.round((p.x - geom1(view).X(0)) / k);
      if (s._drag === "object") s.objectX = Math.min(MAX_OBJECT_X, Math.max(s.sourceX + MIN_GAP, x));
      if (s._drag === "source") s.sourceX = Math.max(0, Math.min(40, s.objectX - MIN_GAP, x));
    },
    up(p, s, api) {
      const what = s._drag;
      s._drag = undefined;
      if (what === "moon") {
        api.emit("moon-moved", { moonAngle: s.moonAngle });
        reportEclipse(s, api);
      } else if (what) reportShadow(s, api);
    },
  },
  draw(ctx, s, view) {
    if (s.part === "eclipse") drawEclipse(ctx, s, view);
    else drawShadow(ctx, s, view);
  },
});
