import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, cell, run, step, anodeHalf, cathodeHalf, overall, metal, metalIndex, METALS } from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const LOOK = {
  Mg: { metal: "#c9ced6", sol: "rgba(200, 210, 225, 0.25)" },
  Zn: { metal: "#9aa3ad", sol: "rgba(200, 210, 225, 0.25)" },
  Fe: { metal: "#6b6f76", sol: "rgba(150, 200, 140, 0.3)" },
  Cu: { metal: "#c8742a", sol: "rgba(40, 110, 220, 0.3)" },
  Ag: { metal: "#d9dde3", sol: "rgba(200, 210, 225, 0.25)" },
};
const E = x => `${x > 0 ? "+" : ""}${fmt(x, 3)}`;

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
const line = (ctx, text, x, y, maxW, size, opts = {}) => label(ctx, text, x, y, { ...opts, size: fit(ctx, text, maxW, size, opts.bold) });

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 8 : 18;
  const wire = small ? 66 : 116;
  const bw = Math.min(view.w * 0.36, 240);
  const arch = wire + (small ? 30 : 50); // top of the salt bridge
  const by0 = arch + (small ? 22 : 34);
  const textH = small ? 40 : 70;
  const by1 = Math.min(view.h - textH - (small ? 14 : 22), by0 + 400);
  return { small, pad, wire, arch, bw, by0, by1, liquid: by0 + (by1 - by0) * 0.15, xl: view.w * 0.25, xr: view.w * 0.75, ew: small ? 12 : 18 };
}

function beaker(ctx, g, x, sol) {
  const x0 = x - g.bw / 2;
  ctx.fillStyle = sol;
  ctx.fillRect(x0, g.liquid, g.bw, g.by1 - g.liquid);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x0, g.by0);
  ctx.lineTo(x0, g.by1);
  ctx.lineTo(x0 + g.bw, g.by1);
  ctx.lineTo(x0 + g.bw, g.by0);
  ctx.stroke();
}

function bridge(ctx, s, g, r, view) {
  // inverted U tube from the inner part of one beaker to the other
  const a = g.xl + g.bw * 0.28;
  const b = g.xr - g.bw * 0.28;
  const top = g.arch;
  const bottom = g.liquid + (g.by1 - g.liquid) * 0.45;
  const w = g.small ? 12 : 18;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(a, bottom);
    ctx.lineTo(a, top + w);
    ctx.quadraticCurveTo(a, top, a + w, top);
    ctx.lineTo(b - w, top);
    ctx.quadraticCurveTo(b, top, b, top + w);
    ctx.lineTo(b, bottom);
  };
  ctx.lineCap = "round";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = w + 4;
  path();
  ctx.stroke();
  ctx.strokeStyle = "#f1f4f9";
  ctx.lineWidth = w;
  path();
  ctx.stroke();
  ctx.lineCap = "butt";
  const fs = g.small ? 10 : 13;
  line(ctx, "Cầu muối KNO₃", view.w / 2, top + w + fs, b - a - w, fs, { align: "center", bold: true, color: COLORS.muted });
  if (r.same) return;
  // K⁺ drifts toward the cathode beaker, NO₃⁻ toward the anode beaker
  const toCathode = r.anodeSide === "left" ? 1 : -1;
  const span = b - a;
  const drift = (s.t / s.duration) * 3;
  for (let i = 0; i < 8; i++) {
    for (const [sign, color] of [[1, COLORS.purple], [-1, COLORS.orange]]) {
      let u = (i + (sign > 0 ? 0.25 : 0.75)) / 8 + sign * toCathode * drift;
      u -= Math.floor(u);
      const x = a + w + u * (span - 2 * w);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, top + (sign > 0 ? -w * 0.18 : w * 0.18), g.small ? 2.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const mid = view.w / 2;
  const len = g.small ? 20 : 32;
  for (const [k, dir, name, color] of [[0, toCathode, "K⁺", COLORS.purple], [1, -toCathode, "NO₃⁻", COLORS.orange]]) {
    const y = top + w + fs * (2.6 + k * 1.4);
    arrow(ctx, mid - (dir * len) / 2 - dir * 10, y, mid + (dir * len) / 2 - dir * 10, y, color, 2);
    label(ctx, name, mid + (dir * len) / 2 - dir * 6, y, { size: fs, bold: true, color, align: dir > 0 ? "left" : "right" });
  }
}

function electrode(ctx, g, x, m, width, plated) {
  const top = g.wire;
  const tip = g.liquid + (g.by1 - g.liquid) * 0.82;
  ctx.fillStyle = LOOK[m.id].metal;
  ctx.fillRect(x - width / 2 - plated, g.liquid, width + 2 * plated, tip - g.liquid + plated);
  ctx.fillRect(x - width / 2, top, width, tip - top);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - width / 2 - plated, g.liquid, width + 2 * plated, tip - g.liquid + plated);
  label(ctx, m.id, x, g.liquid - (g.small ? 9 : 14), { size: g.small ? 11 : 14, bold: true, align: "center" });
}

function stopRun(s, api) {
  const r = run(s);
  api.emit("run-stopped", { time: s.t, charge: r.q, anodeMassLoss: r.anodeLoss, cathodeMassGain: r.cathodeGain, emf: r.emf }, "result");
}
const restart = (s, api) => {
  s.t = 0;
  api.pause();
};
const assembled = (s, api) => {
  const c = cell(s);
  api.emit("cell-assembled", { anode: metalIndex(c.anode.id), cathode: metalIndex(c.cathode.id), emf: c.emf }, "result");
};
const option = m => ({ value: m.id, label: `${m.id} trong ${m.salt} 1 M (E° = ${E(m.E)} V)` });

mount({
  slug: "pin-dien-hoa",
  version: "1.0.0",
  title: "Pin điện hóa",
  hint: "Chọn hai điện cực để lắp pin, rồi bấm Chạy để pin phát điện qua điện trở R. Quá trình tự dừng khi hết thời gian đã đặt.",
  initialState,
  timeScale: s => s.duration / 8, // the whole run plays in about 8 s
  step(s, dt, api) {
    if (s.t >= s.duration) s.t = 0; // pressing Chạy after a finished run starts a new one
    if (step(s, dt)) {
      api.pause();
      stopRun(s, api);
    }
  },
  controls: [
    { type: "heading", label: "Lắp pin" },
    { type: "select", key: "left", label: "Điện cực bên trái", options: METALS.map(option), onChange: restart, onCommit: assembled },
    { type: "select", key: "right", label: "Điện cực bên phải", options: METALS.map(option), onChange: restart, onCommit: assembled },
    { type: "heading", label: "Cho pin hoạt động" },
    { type: "slider", key: "R", label: "Điện trở mạch ngoài R", min: 1, max: 100, step: 1, unit: "Ω", digits: 0, onChange: restart },
    { type: "slider", key: "duration", label: "Thời gian đóng mạch t", min: 60, max: 7200, step: 60, format: v => `${fmt(v / 60, 0)} phút (${fmt(v, 0)} s)`, onChange: restart },
    {
      type: "button",
      label: "Ngắt mạch và ghi kết quả",
      visible: s => s.t > 0 && s.t < s.duration,
      action(s, api) {
        api.pause();
        stopRun(s, api);
        s.duration = Math.max(60, s.t); // the run is over; Chạy starts a new one
        s.t = s.duration;
      },
    },
  ],
  readouts: [
    { label: "Anode (cực âm)", value: s => { const c = cell(s); return c.same ? "–" : `${c.anode.id}, E° = ${E(c.anode.E)} V`; } },
    { label: "Cathode (cực dương)", value: s => { const c = cell(s); return c.same ? "–" : `${c.cathode.id}, E° = ${E(c.cathode.E)} V`; } },
    { label: "Suất điện động E°pin", value: s => `${fmt(cell(s).emf, 3)} V` },
    { label: "Cường độ dòng điện I = E/R", value: s => `${fmt(cell(s).current, 4)} A` },
    { label: "Thời gian đã chạy", value: s => `${fmt(s.t, 0)} s` },
    { label: "Điện lượng Q = I·t", value: s => `${fmt(run(s).q, 1)} C` },
    { label: "Số mol electron Q/F", value: s => `${fmt(run(s).ne, 5)} mol` },
    { label: "Anode: khối lượng giảm", value: s => `${fmt(run(s).anodeLoss, 4)} g` },
    { label: "Cathode: khối lượng tăng", value: s => `${fmt(run(s).cathodeGain, 4)} g` },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    const r = run(s);
    const size = g.small ? 11 : 14;
    const W = view.w - 2 * g.pad;
    const L = metal(s.left);
    const Rm = metal(s.right);

    const head = r.same
      ? "Hai điện cực giống nhau: E°pin = 0 V, không có dòng điện"
      : `E°pin = E°(${r.cathode.ion}/${r.cathode.id}) − E°(${r.anode.ion}/${r.anode.id}) = ${E(r.cathode.E)} − (${E(r.anode.E)}) = ${fmt(r.emf, 3)} V`;
    line(ctx, head, view.w / 2, g.small ? 10 : 18, W, size + 1, { align: "center", bold: true, color: r.same ? COLORS.red : COLORS.ink });
    if (!r.same) line(ctx, overall(r.anode, r.cathode), view.w / 2, g.small ? 26 : 40, W, size, { align: "center", color: COLORS.purple, bold: true });

    // outer circuit: resistor in the wire, voltmeter across it
    const mid = view.w / 2;
    const rw = g.small ? 34 : 50;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.xl, g.wire);
    ctx.lineTo(mid - rw / 2, g.wire);
    ctx.moveTo(mid + rw / 2, g.wire);
    ctx.lineTo(g.xr, g.wire);
    const vy = g.wire - (g.small ? 18 : 34);
    const vr = g.small ? 11 : 16;
    ctx.moveTo(mid - rw, g.wire);
    ctx.lineTo(mid - rw, vy);
    ctx.lineTo(mid - vr, vy);
    ctx.moveTo(mid + vr, vy);
    ctx.lineTo(mid + rw, vy);
    ctx.lineTo(mid + rw, g.wire);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillRect(mid - rw / 2, g.wire - 7, rw, 14);
    ctx.strokeRect(mid - rw / 2, g.wire - 7, rw, 14);
    ctx.beginPath();
    ctx.arc(mid, vy, vr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(ctx, "V", mid, vy, { size, bold: true, align: "center" });
    label(ctx, `${fmt(r.emf, 3)} V`, mid + rw + 6, vy, { size, bold: true, color: COLORS.blue });
    label(ctx, `R = ${fmt(s.R, 0)} Ω`, mid, g.wire + (g.small ? 14 : 18), { size: size - 1, align: "center", color: COLORS.muted });

    // electrons in the wire: from the anode to the cathode
    if (!r.same) {
      const dir = r.anodeSide === "left" ? 1 : -1;
      for (const x of [(g.xl + mid - rw) / 2, (mid + rw + g.xr) / 2]) {
        arrow(ctx, x - dir * 14, g.wire - 9, x + dir * 14, g.wire - 9, COLORS.blue, 2);
        label(ctx, "e", x, g.wire + (g.small ? 9 : 12), { size: size - 1, bold: true, align: "center", color: COLORS.blue });
      }
      if (s.t > 0) {
        // moving electrons, positions follow the elapsed time
        const len = g.xr - g.xl;
        for (let i = 0; i < 10; i++) {
          let u = i / 10 + (s.t / s.duration) * 4;
          u -= Math.floor(u);
          const x = dir > 0 ? g.xl + u * len : g.xr - u * len;
          if (Math.abs(x - mid) < rw / 2 + 3) continue;
          ctx.fillStyle = COLORS.blue;
          ctx.beginPath();
          ctx.arc(x, g.wire, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // beakers, bridge, electrodes
    beaker(ctx, g, g.xl, LOOK[L.id].sol);
    beaker(ctx, g, g.xr, LOOK[Rm.id].sol);
    bridge(ctx, s, g, r, view);
    const thin = r.anodeLoss / (r.anodeLoss + 0.5); // 0…1, drawn exaggerated
    const thick = (r.cathodeGain / (r.cathodeGain + 2)) * g.ew * 0.8;
    const wl = !r.same && r.anodeSide === "left" ? g.ew * (1 - 0.7 * thin) : g.ew;
    const wr = !r.same && r.anodeSide === "right" ? g.ew * (1 - 0.7 * thin) : g.ew;
    const xl = g.xl - g.bw * 0.12;
    const xr = g.xr + g.bw * 0.12;
    electrode(ctx, g, xl, L, wl, !r.same && r.anodeSide === "right" ? thick : 0);
    electrode(ctx, g, xr, Rm, wr, !r.same && r.anodeSide === "left" ? thick : 0);
    // wire runs from the electrode tops
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xl, g.wire);
    ctx.lineTo(g.xl, g.wire);
    ctx.moveTo(xr, g.wire);
    ctx.lineTo(g.xr, g.wire);
    ctx.stroke();

    // ions leaving the anode, ions reaching the cathode
    if (!r.same) {
      const yi = g.liquid + (g.by1 - g.liquid) * 0.62;
      const out = g.small ? 24 : 40;
      for (const [x, m, isAnode] of [[xl, L, r.anodeSide === "left"], [xr, Rm, r.anodeSide === "right"]]) {
        const side = x < mid ? -1 : 1; // away from the bridge
        const x1 = x + side * (g.ew / 2 + 4);
        const x2 = x1 + side * out;
        if (isAnode) arrow(ctx, x1, yi, x2, yi, COLORS.red, 2);
        else arrow(ctx, x2, yi, x1, yi, COLORS.red, 2);
        label(ctx, m.ion, (x1 + x2) / 2, yi - (g.small ? 9 : 12), { size: size - 1, bold: true, align: "center", color: COLORS.red });
      }
    }

    // roles and half-reactions under each beaker
    const colW = g.bw + 20;
    for (const [x, m, side] of [[g.xl, L, "left"], [g.xr, Rm, "right"]]) {
      const isAnode = !r.same && r.anodeSide === side;
      const role = r.same ? "Không có cực" : isAnode ? "Anode (cực âm)" : "Cathode (cực dương)";
      const eq = r.same ? `E° = ${E(m.E)} V` : isAnode ? anodeHalf(m) : cathodeHalf(m);
      const y = g.by1 + (g.small ? 11 : 16);
      line(ctx, `${role} · ${m.salt} 1 M`, x, y, colW, size, { align: "center", bold: true, color: r.same ? COLORS.muted : isAnode ? COLORS.red : COLORS.blue });
      line(ctx, eq, x, y + (g.small ? 14 : 20), colW, size, { align: "center", bold: true });
      if (!g.small && !r.same) {
        const dm = isAnode ? `khối lượng giảm ${fmt(r.anodeLoss, 4)} g` : `khối lượng tăng ${fmt(r.cathodeGain, 4)} g`;
        line(ctx, dm, x, y + 40, colW, size - 1, { align: "center", color: COLORS.muted });
      }
    }
    const note = g.small
      ? "Không theo tỉ lệ; mũi tên xanh: chiều electron"
      : "Hình minh họa, không theo tỉ lệ; độ mòn và lớp bám được phóng đại. Mũi tên xanh: chiều electron (dòng điện ngược lại). Bỏ qua điện trở trong.";
    line(ctx, note, view.w / 2, view.h - (g.small ? 6 : 10), view.w - 16, g.small ? 10 : 12, { align: "center", color: COLORS.muted });
  },
});
