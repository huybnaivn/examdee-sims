import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, electrolyze, discharged, step, SETUPS, VOLUME, F, VM } from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const COPPER = "#b5652d";
const GRAPHITE = "#4b5260";
const setupIndex = s => Math.max(0, SETUPS.findIndex(x => x.id === s.setup));
const isCu = s => s.setup.startsWith("cuso4");

// Fixed pseudo-random numbers so ions and bubbles keep their places between frames.
const rnd = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clock = s => {
  const m = Math.floor(s.t / 60);
  const sec = Math.round(s.t - m * 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 8 : 20;
  const bw = Math.min(view.w - 2 * pad, small ? 340 : 480);
  const bx0 = (view.w - bw) / 2;
  const by0 = small ? 62 : 104;
  const by1 = view.h - (small ? 66 : 112);
  const liquid = by0 + (by1 - by0) * 0.14;
  const ew = small ? 12 : 18;
  const tip = by0 + (by1 - by0) * 0.8;
  return { small, pad, bw, bx0, bx1: bx0 + bw, by0, by1, liquid, ew, tip, xc: bx0 + bw * 0.2, xa: bx0 + bw * 0.8, src: small ? 34 : 56 };
}

// Ions in solution: how many of each to draw, scaled to the amount left.
function ions(s, r) {
  const k = n => Math.round(10 * Math.max(0, n) / r.n0);
  if (isCu(s)) {
    return [
      { name: "Cu²⁺", color: "#1d5bd8", dir: -1, n: k(r.cuLeft) },
      { name: "SO₄²⁻", color: COLORS.orange, dir: 1, n: 10 },
      { name: "H⁺", color: COLORS.red, dir: -1, n: Math.round(k(2 * r.h2so4) * 0.6) },
    ];
  }
  return [
    { name: "Na⁺", color: COLORS.purple, dir: -1, n: 10 },
    { name: "Cl⁻", color: COLORS.green, dir: 1, n: k(r.clLeft) },
    s.setup === "nacl-membrane"
      ? { name: "OH⁻", color: COLORS.muted, dir: 0, n: Math.round(k(r.naoh) * 0.8) }
      : { name: "ClO⁻", color: "#0e8a8a", dir: 0, n: Math.round(k(r.naclo) * 0.8) },
  ];
}

function drawIons(ctx, s, g, r) {
  const left = g.xc + g.ew;
  const right = g.xa - g.ew;
  const top = g.liquid + 10;
  const bottom = g.by1 - (g.small ? 22 : 30);
  const drift = (s.t / s.duration) * 1.5; // ions move toward the electrode of opposite sign while the run goes on
  const rad = g.small ? 4 : 5;
  ions(s, r).forEach((ion, k) => {
    for (let i = 0; i < ion.n; i++) {
      // OH⁻ (with a membrane) stays in the cathode half; ClO⁻ is spread out
      const span = ion.dir === 0 && s.setup === "nacl-membrane" ? 0.45 : 1;
      let u = ((i + 0.85 * rnd(i, k + 1)) / ion.n) * span + ion.dir * drift * (0.7 + 0.6 * rnd(i, k + 7));
      u -= Math.floor(u);
      if (span < 1) u = Math.min(u, span);
      const x = left + u * (right - left);
      const y = top + rnd(i, k + 3) * (bottom - top);
      ctx.fillStyle = ion.color;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      if (!g.small) label(ctx, ion.name.includes("⁻") ? "−" : "+", x, y, { size: 9, align: "center", color: "#fff", bold: true });
    }
  });
  // legend along the bottom of the beaker
  const items = ions(s, r);
  const size = g.small ? 10 : 12;
  ctx.font = `${size}px ${FONT}`;
  const widths = items.map(it => ctx.measureText(it.name).width + 18);
  let x = g.bx0 + (g.bw - widths.reduce((a, w) => a + w, 0)) / 2;
  const y = g.by1 - (g.small ? 9 : 13);
  items.forEach((it, i) => {
    ctx.fillStyle = it.color;
    ctx.beginPath();
    ctx.arc(x + 5, y, 4, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, it.name, x + 12, y, { size, color: COLORS.ink });
    x += widths[i];
  });
}

function drawBubbles(ctx, s, g, x, gas, faded) {
  const n = Math.round(4 + s.current * 2.4);
  const h = g.tip - g.liquid;
  for (let i = 0; i < n; i++) {
    let u = rnd(i, x) + (s.t / s.duration) * 6 * (0.6 + rnd(i, 9));
    u -= Math.floor(u);
    if (faded && u > 0.5) continue; // Cl₂ is taken up by the solution before it reaches the top
    const y = g.tip - u * h;
    const bx = x + (rnd(i, 5) - 0.5) * g.ew * 2.6;
    ctx.beginPath();
    ctx.arc(bx, y, 2 + rnd(i, 2) * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = gas === "Cl₂" ? "rgba(190, 210, 60, 0.75)" : "rgba(255, 255, 255, 0.85)";
    ctx.fill();
    ctx.strokeStyle = gas === "Cl₂" ? "#8a9a1c" : "#8aa0c0";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawElectrode(ctx, g, x, color, width, deposit) {
  const top = g.by0 - (g.small ? 14 : 22);
  if (deposit > 0) {
    ctx.fillStyle = COPPER;
    ctx.fillRect(x - width / 2 - deposit, g.liquid, width + 2 * deposit, g.tip - g.liquid + deposit);
  }
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, top, width, g.tip - top);
}

const gasNames = (s, r) => {
  const stage2 = r.stage === 2;
  const cathode = s.setup === "cuso4-copper" || (s.setup === "cuso4-inert" && !stage2) ? null : "H₂";
  const anode = s.setup === "cuso4-copper" ? null : s.setup.startsWith("nacl") && !stage2 ? "Cl₂" : "O₂";
  return { cathode, anode };
};

function lines(s, r) {
  const d = discharged(s.setup, r.stage);
  const L = (sym, mol) => `${sym}: ${fmt(mol * VM, 3)} L`;
  const cathode = [d.cathode.eq];
  const anode = [d.anode.eq];
  if (r.cu > 0 || isCu(s)) cathode.push(`Δm = +${fmt(r.cathodeMass, 3)} g Cu`);
  if (r.h2 > 0 || !isCu(s)) cathode.push(L("H₂", r.h2));
  if (s.setup === "cuso4-copper") anode.push(`Δm = ${fmt(r.anodeMass, 3)} g`);
  else if (s.setup === "nacl-open") anode.push(r.o2 > 0 ? L("O₂", r.o2) : "Cl₂ + 2NaOH → NaCl + NaClO + H₂O");
  else {
    if (r.cl2 > 0 || s.setup === "nacl-membrane") anode.push(L("Cl₂", r.cl2));
    if (r.o2 > 0 || s.setup === "cuso4-inert") anode.push(L("O₂", r.o2));
  }
  return { cathode, anode };
}

function fit(ctx, text, maxW, size, bold) {
  let sz = size;
  const set = () => (ctx.font = `${bold ? "600 " : ""}${sz}px ${FONT}`);
  set();
  while (sz > 8 && ctx.measureText(text).width > maxW) {
    sz--;
    set();
  }
  return sz;
}

const report = (s, api) => {
  const r = electrolyze(s);
  api.emit(
    "run-stopped",
    { setup: setupIndex(s), time: s.t, charge: r.q, massDeposited: r.cathodeMass, anodeMassChange: r.anodeMass, gasCathode: r.gasCathode, gasAnode: r.gasAnode, gasVolume: r.gasCathode + r.gasAnode },
    "result"
  );
};

const restart = (s, api) => {
  s.t = 0;
  api.pause();
};

mount({
  slug: "dien-phan",
  version: "1.0.0",
  title: "Điện phân dung dịch",
  hint: "Chọn dung dịch và điện cực, đặt cường độ dòng điện và thời gian rồi bấm Chạy. Quá trình tự dừng khi hết thời gian đã đặt.",
  initialState,
  timeScale: s => s.duration / 8, // the whole run plays in about 8 s
  step(s, dt, api) {
    if (s.t >= s.duration) s.t = 0; // pressing Chạy after a finished run starts a new one
    if (step(s, dt)) {
      api.pause();
      report(s, api);
    }
  },
  controls: [
    { type: "select", key: "setup", label: "Dung dịch và điện cực", options: SETUPS.map(x => ({ value: x.id, label: x.label })), onChange: restart },
    { type: "slider", key: "conc", label: "Nồng độ muối ban đầu", min: 0.1, max: 1, step: 0.05, unit: "mol/L", onChange: restart },
    { type: "slider", key: "current", label: "Cường độ dòng điện I", min: 0.5, max: 5, step: 0.1, unit: "A", digits: 1, onChange: restart },
    {
      type: "slider",
      key: "duration",
      label: "Thời gian điện phân t",
      min: 60,
      max: 3600,
      step: 60,
      format: v => `${fmt(v / 60, 0)} phút (${fmt(v, 0)} s)`,
      onChange: restart,
    },
  ],
  readouts: [
    { label: "Thời gian đã chạy", value: s => `${fmt(s.t, 0)} s` },
    { label: "Điện lượng Q = I·t", value: s => `${fmt(electrolyze(s).q, 0)} C` },
    { label: "Số mol electron Q/F", value: s => `${fmt(electrolyze(s).ne, 4)} mol` },
    { label: "Cathode: khối lượng tăng", value: s => `${fmt(electrolyze(s).cathodeMass, 3)} g` },
    { label: "Anode: khối lượng thay đổi", value: s => `${fmt(electrolyze(s).anodeMass, 3)} g` },
    { label: "Khí thoát ra ở cathode (đkc)", value: s => `${fmt(electrolyze(s).gasCathode, 3)} L` },
    { label: "Khí thoát ra ở anode (đkc)", value: s => `${fmt(electrolyze(s).gasAnode, 3)} L` },
    {
      label: "Ion còn lại trong dung dịch",
      value: s => {
        const r = electrolyze(s);
        return isCu(s) ? `[Cu²⁺] = ${fmt(r.cuLeft / VOLUME, 3)} M` : `[Cl⁻] = ${fmt(r.clLeft / VOLUME, 3)} M`;
      },
    },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    const r = electrolyze(s);
    const size = g.small ? 11 : 14;

    // status
    const done = s.t >= s.duration;
    const status = g.small
      ? `t = ${clock(s)} / ${fmt(s.duration / 60, 0)} phút · Q = ${fmt(r.q, 0)} C`
      : `t = ${fmt(s.t, 0)} s / ${fmt(s.duration, 0)} s · I = ${fmt(s.current, 1)} A · Q = I·t = ${fmt(r.q, 0)} C · V = ${fmt(VOLUME * 1000, 0)} mL${done ? " · đã dừng" : ""}`;
    label(ctx, status, view.w / 2, g.small ? 10 : 18, { size: fit(ctx, status, view.w - 16, size, true), align: "center", bold: true, color: done ? COLORS.green : COLORS.ink });

    // source and wires: the long thin plate is the positive pole
    const sx = view.w / 2;
    const top = g.by0 - (g.small ? 14 : 22);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.xc, top);
    ctx.lineTo(g.xc, g.src);
    ctx.lineTo(sx - 6, g.src);
    ctx.moveTo(sx + 6, g.src);
    ctx.lineTo(g.xa, g.src);
    ctx.lineTo(g.xa, top);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx - 6, g.src - 7);
    ctx.lineTo(sx - 6, g.src + 7);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + 6, g.src - 13);
    ctx.lineTo(sx + 6, g.src + 13);
    ctx.stroke();
    label(ctx, "−", sx - 16, g.src - 11, { size, bold: true, color: COLORS.blue, align: "center" });
    label(ctx, "+", sx + 17, g.src - 11, { size, bold: true, color: COLORS.red, align: "center" });
    // electrons in the outer circuit: out of the anode, into the cathode
    const ax = (g.xa + sx) / 2;
    const cx = (g.xc + sx) / 2;
    arrow(ctx, ax + 12, g.src - 8, ax - 12, g.src - 8, COLORS.blue, 2);
    arrow(ctx, cx + 12, g.src - 8, cx - 12, g.src - 8, COLORS.blue, 2);
    label(ctx, "e", ax, g.src + 9, { size: size - 1, color: COLORS.blue, align: "center", bold: true });
    label(ctx, "e", cx, g.src + 9, { size: size - 1, color: COLORS.blue, align: "center", bold: true });
    // electrode names sit inside the beaker, above the liquid, so no wire crosses them
    const ny = (g.by0 + g.liquid) / 2;
    label(ctx, g.small ? "Cathode (−)" : "Cathode (cực âm)", g.xc + g.ew / 2 + 6, ny, { size, bold: true, color: COLORS.blue });
    label(ctx, g.small ? "Anode (+)" : "Anode (cực dương)", g.xa - g.ew / 2 - 6, ny, { size, bold: true, align: "right", color: COLORS.red });

    // solution
    const cuConc = r.cuLeft / VOLUME;
    ctx.fillStyle = isCu(s) ? `rgba(40, 110, 220, ${0.06 + 0.38 * Math.min(1, cuConc)})` : "rgba(170, 200, 230, 0.22)";
    ctx.fillRect(g.bx0, g.liquid, g.bw, g.by1 - g.liquid);
    if (s.setup === "nacl-membrane") {
      ctx.strokeStyle = COLORS.muted;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(g.bx0 + g.bw / 2, g.liquid);
      ctx.lineTo(g.bx0 + g.bw / 2, g.by1 - (g.small ? 18 : 26)); // stop above the ion legend
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, "màng ngăn", g.bx0 + g.bw / 2 + 5, g.liquid + 10, { size: g.small ? 10 : 12, color: COLORS.muted });
    }
    drawIons(ctx, s, g, r);

    // electrodes: inert ones are graphite; a copper anode thins as it dissolves
    const deposit = r.cu > 0 ? Math.min(g.small ? 4 : 6, 1 + r.cathodeMass * 0.9) : 0;
    drawElectrode(ctx, g, g.xc, GRAPHITE, g.ew, deposit);
    const anodeW = s.setup === "cuso4-copper" ? g.ew * (1 - Math.min(0.6, -r.anodeMass / 10)) : g.ew;
    drawElectrode(ctx, g, g.xa, s.setup === "cuso4-copper" ? COPPER : GRAPHITE, anodeW, 0);
    if (s.t > 0) {
      const gas = gasNames(s, r);
      if (gas.cathode) drawBubbles(ctx, s, g, g.xc, gas.cathode, false);
      if (gas.anode) drawBubbles(ctx, s, g, g.xa, gas.anode, s.setup === "nacl-open" && gas.anode === "Cl₂");
    }

    // beaker
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(g.bx0, g.by0);
    ctx.lineTo(g.bx0, g.by1);
    ctx.lineTo(g.bx1, g.by1);
    ctx.lineTo(g.bx1, g.by0);
    ctx.stroke();

    // half-reactions and products under each electrode
    const text = lines(s, r);
    const colW = g.bw / 2 - 6;
    const lh = g.small ? 14 : 19;
    for (const [x, list] of [[g.bx0 + g.bw / 4, text.cathode], [g.bx0 + (3 * g.bw) / 4, text.anode]]) {
      list.slice(0, g.small ? 2 : 3).forEach((t, i) => {
        const sz = fit(ctx, t, colW, size, i === 0);
        label(ctx, t, x, g.by1 + 12 + i * lh, { size: sz, align: "center", bold: i === 0, color: i === 0 ? COLORS.ink : COLORS.blue });
      });
    }
    const note = g.small
      ? "Hình minh họa, không theo tỉ lệ. V khí ở đkc."
      : `Hình minh họa, không theo tỉ lệ. Mũi tên xanh: chiều electron ở mạch ngoài. F = ${fmt(F, 0)} C/mol; V khí ở đkc (25 °C, 1 bar): n × ${fmt(VM)} L/mol.`;
    label(ctx, note, view.w / 2, view.h - (g.small ? 7 : 12), { size: fit(ctx, note, view.w - 16, g.small ? 10 : 12, false), align: "center", color: COLORS.muted });
  },
});
