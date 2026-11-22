import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, magnets, polesOf, earthMagnet, fieldAt, compassAngle, forceOn, interaction, neutralPoint, onNeutral, fieldLines, BOX, MAG, EARTH } from "./model.js";

const RAD = Math.PI / 180;
const N_RED = COLORS.red;
const S_BLUE = COLORS.blue;
const LINE = COLORS.purple;

// The whole canvas is the sheet; the model box is fitted into it.
function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const top = small ? 22 : 44;
  const bottom = small ? 20 : 30;
  const scale = Math.min((view.w - 12) / BOX.w, (view.h - top - bottom) / BOX.h);
  const cx = view.w / 2;
  const cy = top + (view.h - top - bottom) / 2;
  return {
    small, top, bottom, scale, cx, cy,
    X: x => cx + x * scale,
    Y: y => cy - y * scale,
    wx: px => (px - cx) / scale,
    wy: py => (cy - py) / scale,
  };
}

const rnd = (i, j, k) => {
  const v = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

/** Point (world) inside magnet m, with a margin (u). */
const inMagnet = (m, x, y, margin = 0) => {
  const c = Math.cos(m.a * RAD);
  const sn = Math.sin(m.a * RAD);
  const u = (x - m.x) * c + (y - m.y) * sn;
  const v = -(x - m.x) * sn + (y - m.y) * c;
  return Math.abs(u) <= MAG.len / 2 + margin && Math.abs(v) <= MAG.wid / 2 + margin;
};
const covered = (s, x, y) => (s.scene === "earth" ? Math.hypot(x, y) < EARTH.r + 0.05 : magnets(s).some(m => inMagnet(m, x, y, 0.05)));

/** Label on a pale backdrop so it stays readable over the filings. */
function tag(ctx, text, x, y, { size = 12, bold = false, color = COLORS.ink, bg = "rgba(251, 248, 241, 0.88)" } = {}) {
  ctx.font = `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = ctx.measureText(text).width;
  ctx.fillStyle = bg;
  ctx.fillRect(x - w / 2 - 4, y - size * 0.7, w + 8, size * 1.4);
  label(ctx, text, x, y, { size, bold, color, align: "center" });
}

const strength = (s, x, y) => {
  const b = fieldAt(s, x, y);
  return Math.hypot(b.x, b.y);
};

// Probe released (or moved by slider): one reading, and the goal the first time it sits on the neutral point.
function reportProbe(s, api) {
  if (s.scene === "earth") {
    const r = Math.hypot(s.px, s.py);
    const min = EARTH.r + 0.25;
    if (r < min) {
      const k = r ? min / r : 1;
      s.px = r ? s.px * k : 0;
      s.py = r ? s.py * k : min;
    }
  }
  api.emit("compass-read", { x: s.px, y: s.py, angle: compassAngle(s, s.px, s.py), strength: strength(s, s.px, s.py) }, "result");
  const now = onNeutral(s);
  if (now && !s.found) api.emit("neutral-point", { x: s.px, y: s.py, strength: strength(s, s.px, s.py) }, "goal");
  s.found = now;
}

function drawMagnet(ctx, g, m, name) {
  const L = MAG.len * g.scale;
  const W = MAG.wid * g.scale;
  ctx.save();
  ctx.translate(g.X(m.x), g.Y(m.y));
  ctx.rotate(-m.a * RAD);
  ctx.shadowColor = "rgba(31, 42, 68, 0.25)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = S_BLUE;
  ctx.fillRect(-L / 2, -W / 2, L / 2, W);
  ctx.fillStyle = N_RED;
  ctx.fillRect(0, -W / 2, L / 2, W);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-L / 2, -W / 2, L, W);
  ctx.restore();
  const size = clamp(W * 0.6, 10, 16);
  const [n, sp] = polesOf(m, MAG.len / 4);
  label(ctx, "N", g.X(n.x), g.Y(n.y), { color: "#fff", bold: true, size, align: "center" });
  label(ctx, "S", g.X(sp.x), g.Y(sp.y), { color: "#fff", bold: true, size, align: "center" });
  if (name) tag(ctx, name, g.X(m.x), g.Y(m.y) - W / 2 - (g.small ? 9 : 11), { size: g.small ? 10 : 12, color: COLORS.muted });
}

function drawNeedle(ctx, x, y, angle, half, width = 3) {
  const c = Math.cos(angle * RAD) * half;
  const sn = -Math.sin(angle * RAD) * half;
  const px = (-sn / half) * width;
  const py = (c / half) * width;
  ctx.fillStyle = N_RED;
  ctx.beginPath();
  ctx.moveTo(x + c, y + sn);
  ctx.lineTo(x + px, y + py);
  ctx.lineTo(x - px, y - py);
  ctx.fill();
  ctx.fillStyle = "#9aa5b8";
  ctx.beginPath();
  ctx.moveTo(x - c, y - sn);
  ctx.lineTo(x + px, y + py);
  ctx.lineTo(x - px, y - py);
  ctx.fill();
}

function drawEarth(ctx, g) {
  const R = EARTH.r * g.scale;
  const x = g.X(0);
  const y = g.Y(0);
  const grad = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R);
  grad.addColorStop(0, "#7fb8f0");
  grad.addColorStop(1, "#2f6fb8");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  // spin axis
  ctx.strokeStyle = COLORS.ink;
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - R - 14);
  ctx.lineTo(x, y + R + 14);
  ctx.stroke();
  ctx.setLineDash([]);
  // the "magnet" inside the Earth: N towards the geographic south
  drawMagnet(ctx, { ...g, scale: (g.scale * 1.1) / MAG.len * EARTH.r }, { ...earthMagnet(), x: 0, y: 0 }, "");
  const size = g.small ? 11 : 13;
  const bg = "rgba(15, 26, 51, 0.85)";
  tag(ctx, "Bắc địa lí", x, y - R - 22, { size, bold: true, color: "#fff", bg });
  tag(ctx, "Nam địa lí", x, y + R + 22, { size, bold: true, color: "#fff", bg });
}

function drawProbe(ctx, g, s) {
  const r = g.small ? 15 : 19;
  const x = g.X(s.px);
  const y = g.Y(s.py);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawNeedle(ctx, x, y, compassAngle(s, s.px, s.py), r - 3, 3.5);
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawLines(ctx, g, s) {
  const color = s.scene === "earth" ? "#c9b8ff" : LINE;
  ctx.strokeStyle = color;
  ctx.lineWidth = s.scene === "earth" ? 1.8 : 1.4;
  for (const line of fieldLines(s, s.scene === "earth" ? 22 : 12)) {
    ctx.beginPath();
    line.forEach(([x, y], i) => (i ? ctx.lineTo(g.X(x), g.Y(y)) : ctx.moveTo(g.X(x), g.Y(y))));
    ctx.stroke();
    // one arrowhead per line, at a visible point roughly in its middle
    const visible = line.filter(([x, y]) => !covered(s, x, y) && Math.abs(g.X(x) - g.cx) < g.cx - 8 && g.Y(y) > g.top && g.Y(y) < 2 * g.cy - g.top);
    if (visible.length > 6) {
      const k = Math.floor(visible.length / 2);
      const [x0, y0] = visible[k - 1];
      const [x1, y1] = visible[k];
      const a = Math.atan2(g.Y(y1) - g.Y(y0), g.X(x1) - g.X(x0));
      const hx = g.X(x1);
      const hy = g.Y(y1);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(hx + 6 * Math.cos(a), hy + 6 * Math.sin(a));
      ctx.lineTo(hx - 5 * Math.cos(a - 0.5), hy - 5 * Math.sin(a - 0.5));
      ctx.lineTo(hx - 5 * Math.cos(a + 0.5), hy - 5 * Math.sin(a + 0.5));
      ctx.fill();
    }
  }
}

mount({
  slug: "nam-cham-tu-pho",
  version: "1.0.0",
  title: "Nam châm và từ phổ",
  hint: "Kéo nam châm hoặc la bàn thử trên tấm bìa. Đặt la bàn vào chỗ từ trường triệt tiêu giữa hai cực cùng tên.",
  initialState,
  controls: [
    {
      type: "select",
      key: "scene",
      label: "Thí nghiệm",
      options: [
        { value: "magnets", label: "Nam châm thẳng trên tấm bìa" },
        { value: "earth", label: "Từ trường Trái Đất" },
      ],
      onCommit: s => (s.found = false),
    },
    {
      type: "select",
      key: "count",
      label: "Số nam châm",
      options: [
        { value: 1, label: "Một nam châm" },
        { value: 2, label: "Hai nam châm" },
      ],
      visible: s => s.scene === "magnets",
      onCommit: s => (s.found = false),
    },
    { type: "heading", label: "Nam châm 1", visible: s => s.scene === "magnets" },
    { type: "slider", key: "x1", label: "Vị trí ngang", min: -5, max: 5, step: 0.1, digits: 1, visible: s => s.scene === "magnets", onCommit: s => (s.found = false) },
    { type: "slider", key: "a1", label: "Góc quay (hướng S → N)", min: 0, max: 345, step: 15, unit: "°", digits: 0, visible: s => s.scene === "magnets", onCommit: s => (s.found = false) },
    {
      type: "button",
      label: "Đảo cực nam châm 1",
      visible: s => s.scene === "magnets",
      action(s, api) {
        s.a1 = (((s.a1 + 180) % 360) + 360) % 360;
        s.found = false;
        api.emit("flip-magnet", { index: 1, angle: s.a1 }, "action");
      },
    },
    { type: "heading", label: "Nam châm 2", visible: s => s.scene === "magnets" && s.count === 2 },
    { type: "slider", key: "x2", label: "Vị trí ngang", min: -5, max: 5, step: 0.1, digits: 1, visible: s => s.scene === "magnets" && s.count === 2, onCommit: s => (s.found = false) },
    { type: "slider", key: "a2", label: "Góc quay (hướng S → N)", min: 0, max: 345, step: 15, unit: "°", digits: 0, visible: s => s.scene === "magnets" && s.count === 2, onCommit: s => (s.found = false) },
    {
      type: "button",
      label: "Đảo cực nam châm 2",
      visible: s => s.scene === "magnets" && s.count === 2,
      action(s, api) {
        s.a2 = (((s.a2 + 180) % 360) + 360) % 360;
        s.found = false;
        api.emit("flip-magnet", { index: 2, angle: s.a2 }, "action");
      },
    },
    { type: "heading", label: "La bàn thử" },
    { type: "slider", key: "px", label: "Vị trí ngang", min: -5.8, max: 5.8, step: 0.05, digits: 2, onCommit: reportProbe },
    { type: "slider", key: "py", label: "Vị trí dọc", min: -3.4, max: 3.4, step: 0.05, digits: 2, onCommit: reportProbe },
    { type: "heading", label: "Hiển thị" },
    { type: "checkbox", key: "showFilings", label: "Mạt sắt", visible: s => s.scene === "magnets" },
    { type: "checkbox", key: "showLines", label: "Đường sức từ" },
    { type: "checkbox", key: "showCompass", label: "Nhiều kim nam châm nhỏ", visible: s => s.scene === "magnets" },
  ],
  readouts: [
    { label: "Hai nam châm", value: s => ({ repel: "đẩy nhau", attract: "hút nhau" })[interaction(s)] ?? "–" },
    { label: "Kim la bàn thử chỉ hướng", value: s => `${fmt(((compassAngle(s, s.px, s.py) % 360) + 360) % 360, 0)}°` },
    { label: "Độ mạnh từ trường (tương đối)", value: s => fmt(strength(s, s.px, s.py), 3) },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      const r = g.small ? 15 : 19;
      if (Math.hypot(p.x - g.X(s.px), p.y - g.Y(s.py)) < r + 10) {
        s._drag = { what: "probe" };
        return true;
      }
      const x = g.wx(p.x);
      const y = g.wy(p.y);
      const ms = magnets(s);
      for (let j = ms.length - 1; j >= 0; j--) {
        if (inMagnet(ms[j], x, y, 0.15)) {
          s._drag = { what: j, dx: ms[j].x - x, dy: ms[j].y - y };
          return true;
        }
      }
      return false;
    },
    move(p, s, api, view) {
      const g = geom(view);
      const x = g.wx(p.x);
      const y = g.wy(p.y);
      const d = s._drag;
      if (!d) return;
      if (d.what === "probe") {
        s.px = clamp(x, -5.8, 5.8);
        s.py = clamp(y, -3.4, 3.4);
      } else {
        const k = d.what + 1;
        s[`x${k}`] = clamp(Math.round((x + d.dx) * 10) / 10, -5, 5);
        s[`y${k}`] = clamp(y + d.dy, -3, 3);
        s.found = false;
      }
    },
    up(p, s, api) {
      const d = s._drag;
      s._drag = null;
      if (!d) return;
      if (d.what === "probe") return reportProbe(s, api);
      const k = d.what + 1;
      api.emit("move-magnet", { index: k, x: s[`x${k}`], y: s[`y${k}`], angle: s[`a${k}`] }, "action");
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const earth = s.scene === "earth";

    // sheet
    ctx.fillStyle = earth ? "#0f1a33" : "#fbf8f1";
    ctx.fillRect(0, 0, view.w, view.h);

    // iron filings: short dashes along B, faint where the field is weak
    if (s.showFilings && !earth) {
      const sp = g.small ? 8 : 10;
      ctx.lineWidth = 1.3;
      ctx.lineCap = "round";
      for (let i = 0; i * sp < view.w + sp; i++) {
        for (let j = 0; j * sp < view.h + sp; j++) {
          const px = (i + rnd(i, j, 1)) * sp;
          const py = (j + rnd(i, j, 2)) * sp;
          const x = g.wx(px);
          const y = g.wy(py);
          if (covered(s, x, y)) continue;
          const b = fieldAt(s, x, y);
          const m = Math.hypot(b.x, b.y);
          // where the field is too weak to line them up, filings keep a random tilt
          const order = clamp(m / 0.03, 0, 1);
          const a = Math.atan2(-b.y, b.x) + (1 - order) * (rnd(i, j, 3) - 0.5) * Math.PI;
          const half = sp * (0.3 + 0.12 * rnd(i, j, 4));
          ctx.strokeStyle = `rgba(60, 60, 66, ${0.25 + 0.6 * clamp(Math.sqrt(m) / 0.5, 0, 1)})`;
          ctx.beginPath();
          ctx.moveTo(px - half * Math.cos(a), py - half * Math.sin(a));
          ctx.lineTo(px + half * Math.cos(a), py + half * Math.sin(a));
          ctx.stroke();
        }
      }
    }

    if (s.showLines) drawLines(ctx, g, s);

    if (s.showCompass || earth) {
      const sp = earth ? (g.small ? 40 : 54) : g.small ? 38 : 48;
      for (let px = sp / 2; px < view.w; px += sp) {
        for (let py = g.top + sp / 2; py < view.h - g.bottom; py += sp) {
          const x = g.wx(px);
          const y = g.wy(py);
          if (covered(s, x, y) || (earth && Math.hypot(x, y) < EARTH.r + 0.3)) continue;
          ctx.fillStyle = earth ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.85)";
          ctx.beginPath();
          ctx.arc(px, py, sp * 0.32, 0, Math.PI * 2);
          ctx.fill();
          drawNeedle(ctx, px, py, compassAngle(s, x, y), sp * 0.28, 2.5);
        }
      }
    }

    if (earth) drawEarth(ctx, g);
    const ms = magnets(s);
    ms.forEach((m, j) => drawMagnet(ctx, g, m, ms.length > 1 ? `Nam châm ${j + 1}` : ""));

    // forces between the magnets
    const kind = interaction(s);
    if (kind) {
      ms.forEach((m, j) => {
        const f = forceOn(s, j);
        const mag = Math.hypot(f.x, f.y);
        if (mag < 1e-4) return;
        const len = clamp(Math.sqrt(mag) * 120, 14, 60);
        // start where the force direction leaves the magnet's outline
        const phi = Math.atan2(f.y, f.x) - m.a * RAD;
        const t = Math.min(MAG.len / 2 / Math.abs(Math.cos(phi) || 1e-9), MAG.wid / 2 / Math.abs(Math.sin(phi) || 1e-9)) * g.scale + 3;
        const x0 = g.X(m.x) + (t * f.x) / mag;
        const y0 = g.Y(m.y) - (t * f.y) / mag;
        arrow(ctx, x0, y0, x0 + (len * f.x) / mag, y0 - (len * f.y) / mag, COLORS.orange, 3);
      });
    }

    // neutral point, once found
    const n = s.found && neutralPoint(s);
    if (n) {
      ctx.strokeStyle = COLORS.green;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(g.X(n.x), g.Y(n.y), (g.small ? 15 : 19) + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawProbe(ctx, g, s);

    // titles and notes
    const size = g.small ? 12 : 15;
    const ink = earth ? "#ffffff" : COLORS.ink;
    const muted = earth ? "#b8c4dc" : COLORS.muted;
    const head = earth
      ? "Từ trường Trái Đất"
      : kind
        ? `Hai nam châm ${kind === "repel" ? "đẩy nhau: hai cực gần nhau cùng tên" : "hút nhau: hai cực gần nhau khác tên"}`
        : "Từ phổ của nam châm thẳng";
    const bg = earth ? "rgba(15, 26, 51, 0.85)" : undefined;
    tag(ctx, n ? (g.small ? "Đã tìm thấy điểm B = 0" : "Đã tìm thấy điểm trung hòa: từ trường triệt tiêu (B = 0)") : head, view.w / 2, g.small ? 11 : 20, {
      size, bold: true, color: n ? COLORS.green : ink, bg,
    });
    const note = earth
      ? g.small
        ? "Gần Bắc địa lí là cực từ S. Trục từ lệch ~11°. Không theo tỉ lệ."
        : "Gần cực Bắc địa lí là cực từ Nam (S) của Trái Đất; trục từ lệch trục quay khoảng 11°. Hình không theo tỉ lệ."
      : g.small
        ? "Đường sức từ: ra ở N, vào ở S. Mô hình hai cực từ."
        : "Đường sức từ đi ra ở cực Bắc (N), đi vào ở cực Nam (S). Mô hình hai cực từ điểm; độ mạnh chỉ là tương đối.";
    tag(ctx, note, view.w / 2, view.h - (g.small ? 9 : 14), { size: g.small ? 10 : 12, color: muted, bg });
  },
});
