import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, restState, step, flux, launch, fluxTrend, XMAX } from "./model.js";

const WINDOW = 6; // s of history on the graph
const MAGNET = 6; // cm, drawn length of the bar
const COPPER = "#c8742a";

/** Next 1-2-5 value at or above v. */
const nice = v => {
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(s, view) {
  const small = view.w < 560 || view.h < 420;
  const graph = { x0: small ? 34 : 56, x1: view.w - (small ? 10 : 24), y1: view.h - (small ? 8 : 26) };
  graph.h = small ? clamp(view.h * 0.3, 70, 110) : clamp(view.h * 0.3, 120, 220);
  graph.y0 = graph.y1 - graph.h;
  const sceneH = graph.y0 - (small ? 16 : 30);
  const k = Math.min((view.w - 20) / (2 * XMAX + MAGNET + 2), 22); // px per cm along the axis
  const rc = clamp(sceneH * 0.2, 24, 90); // coil radius on screen
  const cx = view.w / 2;
  const ay = (small ? 40 : 80) + rc; // axis
  const dr = small ? 18 : clamp(sceneH * 0.095, 24, 44); // dial radius
  const dy = ay + rc + (small ? 8 : 18) + dr;
  const mh = rc * 0.5;
  return { small, graph, k, rc, cx, ay, dr, dy, mh, mx: cx + s.pos * k, ml: MAGNET * k };
}

function history(s) {
  if (s._hist) return s._hist;
  s._hist = [];
  // A first pass already under way (the opening state): replay it from rest with the same
  // settings, so the graph shows how the magnet got here.
  if (s.auto && s.passes === 0 && s.side === -1 && s.autoTo === XMAX) {
    const r = { ...restState(), turns: s.turns, strength: s.strength, flipped: s.flipped, speed: s.speed };
    r.time = s.time - (s.pos + XMAX) / s.speed;
    for (let n = 1; r.pos < s.pos - 1e-9; n++) {
      step(r, 1 / 120);
      if (n % 4 === 0) s._hist.push([r.time, r.emf, flux(r)]);
    }
  }
  return s._hist;
}

function record(s) {
  const hist = history(s);
  hist.push([s.time, s.emf, flux(s)]);
  while (hist[0][0] < s.time - WINDOW) hist.shift();
}

function drawGraph(ctx, s, g, full) {
  const { x0, x1, y0, y1, h } = g.graph;
  const ym = (y0 + y1) / 2;
  const size = g.small ? 10 : 12;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x0, y0, x1 - x0, h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, x1 - x0, h);
  const t1 = Math.max(s.time, WINDOW);
  const tx = t => x1 - ((t1 - t) / WINDOW) * (x1 - x0);
  ctx.beginPath();
  for (let t = Math.ceil(t1 - WINDOW); t <= t1; t++) {
    ctx.moveTo(tx(t), y0);
    ctx.lineTo(tx(t), y1);
    if (!g.small && tx(t) < x1 - 40) label(ctx, `${t}`, tx(t), y1 + 11, { size: 11, align: "center", color: COLORS.muted });
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(x0, ym);
  ctx.lineTo(x1, ym);
  ctx.stroke();
  const amp = h / 2 - 8;
  const curve = (col, scale, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.beginPath();
    history(s).forEach((p, i) => {
      const y = ym - clamp(p[col] / scale, -1.1, 1.1) * amp;
      if (i) ctx.lineTo(tx(p[0]), y);
      else ctx.moveTo(tx(p[0]), y);
    });
    ctx.stroke();
  };
  curve(2, s.strength * 1e-3, COLORS.green, 1.5);
  curve(1, full, COLORS.blue, 2.5);
  label(ctx, fmt(full, 3), x0 - 4, ym - amp, { size, align: "right", color: COLORS.blue });
  label(ctx, "0", x0 - 4, ym, { size, align: "right", color: COLORS.muted });
  label(ctx, fmt(-full, 3), x0 - 4, ym + amp, { size, align: "right", color: COLORS.blue });
  label(ctx, "e (V)", x0, y0 - 8, { size: size + 1, bold: true, color: COLORS.blue });
  label(ctx, g.small ? "Φ (thang riêng)" : "Φ qua mỗi vòng (thang riêng, đỉnh = Φ₀)", x0 + (g.small ? 44 : 56), y0 - 8, { size, color: COLORS.green });
  label(ctx, g.small ? `t: ${WINDOW} s gần nhất` : "t (s)", x1, g.small ? y0 - 8 : y1 + 11, { size, align: "right", color: COLORS.muted });
}

mount({
  slug: "cam-ung-dien-tu",
  version: "1.0.0",
  title: "Cảm ứng điện từ",
  hint: "Kéo nam châm lại gần, ra xa hoặc xuyên qua cuộn dây và quan sát kim điện kế.",
  initialState,
  autoplay: true,
  step(s, dt, api) {
    const { passes, auto } = s;
    step(s, dt);
    const n = (s._n = (s._n ?? 0) + 1);
    if (n % 4 === 0) record(s);
    if ((auto && n % 12 === 0) || auto !== s.auto) api.sync(); // keep the position slider on the magnet
    // One result per completed pass, not per frame.
    if (s.passes !== passes) {
      const data = { peakEmf: s.lastPeakEmf, turns: s.turns, peakSpeed: s.lastPeakSpeed };
      api.emit("pass-completed", data, "result");
    }
  },
  controls: [
    { type: "button", label: "Cho nam châm chạy qua cuộn dây", primary: true, action: s => launch(s), event: "magnet-launched", disabled: s => s.auto },
    { type: "slider", key: "speed", label: "Tốc độ khi tự chạy", min: 5, max: 60, step: 5, unit: "cm/s", digits: 0 },
    {
      type: "slider",
      key: "x",
      label: "Vị trí nam châm",
      min: -XMAX,
      max: XMAX,
      step: 0.5,
      unit: "cm",
      digits: 1,
      onChange: s => {
        s.auto = false;
      },
    },
    { type: "slider", key: "turns", label: "Số vòng dây N", min: 50, max: 500, step: 50, unit: "vòng", digits: 0 },
    { type: "slider", key: "strength", label: "Độ mạnh nam châm Φ₀", min: 0.2, max: 2, step: 0.1, unit: "mWb", digits: 1 },
    { type: "checkbox", key: "flipped", label: "Đổi cực nam châm (cực S ở bên phải)" },
  ],
  readouts: [
    { label: "Từ thông qua mỗi vòng Φ", value: s => `${fmt(flux(s) * 1e3, 3)} mWb` },
    { label: "Suất điện động cảm ứng e", value: s => `${fmt(s.emf, 3)} V` },
    { label: "Vận tốc nam châm", value: s => `${fmt(s.v, 1)} cm/s` },
    { label: "|e| lớn nhất lần qua gần nhất", value: s => (s.passes ? `${fmt(s.lastPeakEmf, 3)} V` : "–") },
    { label: "Số lần qua cuộn dây", value: s => `${s.passes}` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      if (Math.abs(p.x - g.mx) > g.ml / 2 + 12 || Math.abs(p.y - g.ay) > g.mh / 2 + 16) return false;
      s.auto = false;
      s.x = s.pos;
      s._grab = p.x - g.mx;
      api.play();
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      s.x = clamp((p.x - s._grab - g.cx) / g.k, -XMAX, XMAX);
    },
    up(p, s, api) {
      const data = { position: s.x };
      api.emit("magnet-released", data, "action");
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { small, cx, ay, rc, k, dr, dy } = g;
    const size = small ? 12 : 15;
    const pole = s.flipped ? -1 : 1;
    const full = nice(Math.max(0.01, ...history(s).map(p => Math.abs(p[1])), Math.abs(s.emf)));
    const flowing = Math.abs(s.emf) > full * 0.02;

    // axis
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(10, ay);
    ctx.lineTo(view.w - 10, ay);
    ctx.stroke();
    ctx.setLineDash([]);

    // coil: back halves, magnet, front halves
    const loops = clamp(Math.round(s.turns / 50), 1, 10);
    const gap = small ? 5 : 9;
    const rx = rc * 0.2;
    const lx = i => cx + (i - (loops - 1) / 2) * gap;
    const half = (from, to, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      for (let i = 0; i < loops; i++) {
        ctx.beginPath();
        ctx.ellipse(lx(i), ay, rx, rc, 0, from, to);
        ctx.stroke();
      }
    };
    half(Math.PI / 2, (3 * Math.PI) / 2, "#e2b78f", small ? 2 : 3);

    const x0 = g.mx - g.ml / 2;
    const y0 = ay - g.mh / 2;
    const right = pole > 0 ? COLORS.red : COLORS.blue;
    const left = pole > 0 ? COLORS.blue : COLORS.red;
    ctx.fillStyle = left;
    ctx.fillRect(x0, y0, g.ml / 2, g.mh);
    ctx.fillStyle = right;
    ctx.fillRect(g.mx, y0, g.ml / 2, g.mh);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, g.ml, g.mh);
    label(ctx, pole > 0 ? "S" : "N", g.mx - g.ml / 4, ay, { color: "#fff", bold: true, size: size + 1, align: "center" });
    label(ctx, pole > 0 ? "N" : "S", g.mx + g.ml / 4, ay, { color: "#fff", bold: true, size: size + 1, align: "center" });

    half(-Math.PI / 2, Math.PI / 2, COPPER, small ? 2.5 : 4);

    // magnet velocity
    if (Math.abs(s.v) > 0.5) {
      const len = Math.sign(s.v) * clamp(Math.abs(s.v) * (small ? 0.8 : 1.4), 14, small ? 44 : 90);
      const vy = ay + g.mh / 2 + (small ? 9 : 13);
      arrow(ctx, g.mx - len / 2, vy, g.mx + len / 2, vy, COLORS.orange, 2.5);
      label(ctx, "v", g.mx - len / 2 - Math.sign(len) * 8, vy, { color: COLORS.orange, bold: true, size, align: "center" });
    }

    // induced current on the near side of the turns: e > 0 circulates right-handed about +x, i.e. downward in front
    if (flowing) {
      const dir = Math.sign(s.emf);
      const ix = lx(loops - 1) + rx + (small ? 7 : 11);
      const iy = ay - rc * 0.62; // above the magnet, which passes along the axis
      arrow(ctx, ix, iy - dir * rc * 0.28, ix, iy + dir * rc * 0.28, COLORS.red, 2.5);
      label(ctx, "I", ix + 8, iy, { color: COLORS.red, bold: true, size });
    }

    // fields inside the coil: B of the magnet, Bc of the induced current
    const by = ay - rc - (small ? 11 : 20);
    const bl = small ? 30 : 52;
    const off = small ? 36 : 80;
    arrow(ctx, cx - off - (pole * bl) / 2, by, cx - off + (pole * bl) / 2, by, COLORS.green, 3);
    label(ctx, "B", cx - off, by - (small ? 10 : 14), { color: COLORS.green, bold: true, size, align: "center" });
    if (flowing) {
      const dir = Math.sign(s.emf);
      arrow(ctx, cx + off - (dir * bl) / 2, by, cx + off + (dir * bl) / 2, by, COLORS.purple, 3);
      label(ctx, "B", cx + off - 3, by - (small ? 10 : 14), { color: COLORS.purple, bold: true, size, align: "center" });
      label(ctx, "c", cx + off + size * 0.4, by - (small ? 7 : 10), { color: COLORS.purple, bold: true, size: size * 0.75, align: "center" });
    }

    // galvanometer, wired to the two ends of the coil
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(lx(side < 0 ? 0 : loops - 1), ay + rc);
      ctx.lineTo(cx + side * dr * 0.6, dy - dr * 0.8);
    }
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const pivot = dy + dr * 0.55;
    const swing = (50 * Math.PI) / 180;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const a = (i / 2) * swing;
      ctx.moveTo(cx + dr * 1.05 * Math.sin(a), pivot - dr * 1.05 * Math.cos(a));
      ctx.lineTo(cx + dr * 1.25 * Math.sin(a), pivot - dr * 1.25 * Math.cos(a));
    }
    ctx.stroke();
    const a = clamp(s.emf / full, -1, 1) * swing;
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = small ? 2 : 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, pivot);
    ctx.lineTo(cx + dr * 1.2 * Math.sin(a), pivot - dr * 1.2 * Math.cos(a));
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(cx, pivot, small ? 2 : 3, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, "Điện kế G", cx + dr + 10, dy - size * 0.6, { size: size - 1, bold: true });
    label(ctx, `thang ±${fmt(full, 3)} V`, cx + dr + 10, dy + size * 0.6, { size: size - 2, color: COLORS.muted });
    label(ctx, `e = ${fmt(s.emf, 3)} V`, cx - dr - 10, dy - size * 0.6, { size, bold: true, color: COLORS.blue, align: "right" });
    label(ctx, `v = ${fmt(s.v, 1)} cm/s`, cx - dr - 10, dy + size * 0.6, { size: size - 2, color: COLORS.orange, align: "right" });

    // Lenz's law in words
    const trend = flowing ? fluxTrend(s) : 0;
    const lenz = small
      ? ["Nam châm đứng yên: Φ không đổi, e = 0", "Φ tăng → từ trường cảm ứng ngược chiều B", "Φ giảm → từ trường cảm ứng cùng chiều B"]
      : [
          "Nam châm đứng yên: từ thông không đổi, không có dòng điện cảm ứng.",
          "Từ thông qua cuộn dây tăng → từ trường cảm ứng ngược chiều từ trường của nam châm.",
          "Từ thông qua cuộn dây giảm → từ trường cảm ứng cùng chiều từ trường của nam châm.",
        ];
    label(ctx, lenz[trend > 0 ? 1 : trend < 0 ? 2 : 0], cx, dy + dr + (small ? 12 : 22), { size: small ? 11 : 14, align: "center", color: trend ? COLORS.purple : COLORS.muted, bold: !!trend });

    // top row: flux, turns, drawing convention
    label(ctx, `Φ = ${fmt(flux(s) * 1e3, 3)} mWb`, 10, small ? 11 : 20, { size, bold: true, color: COLORS.green });
    if (!small) label(ctx, `N = ${s.turns} vòng`, lx(loops - 1) + rx + 34, ay - rc * 0.62, { size: 13, bold: true, color: COPPER });
    label(ctx, small ? "Hình không theo tỉ lệ" : "Hình vẽ tượng trưng, không theo tỉ lệ. Nam châm được coi là lưỡng cực điểm trên trục cuộn dây.", view.w - 10, small ? 11 : 20, {
      size: small ? 10 : 12,
      align: "right",
      color: COLORS.muted,
    });

    drawGraph(ctx, s, g, full);
  },
});
