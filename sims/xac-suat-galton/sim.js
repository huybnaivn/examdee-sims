import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, clear, busy, binomial, theory, stats, sanitize, MAX_ROWS, MAX_PENDING } from "./model.js";

// Everything is placed from the view size and the number of rows.
function geom(s, view) {
  const small = view.w < 560 || view.h < 420;
  const n = s.rows;
  const dx = Math.min((view.w - 52) / (n + 1), small ? 34 : 64); // bin width = peg spacing
  const top = small ? 12 : 24;
  const base = view.h - (small ? 24 : 50); // bottom of the histogram
  const dy = Math.min(((base - top) * 0.48) / n, dx * 0.85);
  const br = clamp(dx * 0.16, 2.5, 6); // ball radius
  const pr = clamp(dx * 0.07, 1.5, 3.5); // peg radius
  const cx = view.w / 2;
  const histTop = top + n * dy + (small ? 22 : 34);
  return {
    small, n, dx, dy, br, pr, base, histTop,
    x: (i, k) => cx + (k - i / 2) * dx, // after i rows with k turns to the right
    y: i => top + i * dy,
  };
}

/** Bins as they look right now: balls still in the air are not in their bin yet. */
function landed(s) {
  const bins = [...s.bins];
  for (const b of s._balls ?? []) bins[b.path.reduce((a, r) => a + r, 0)]--;
  return bins;
}

const drop = (count, primary) => ({
  type: "button",
  label: `Thả ${count} viên bi`,
  primary,
  disabled: s => s.continuous,
  action(s, api) {
    s.pending = Math.min(MAX_PENDING, s.pending + count);
    api.play();
    api.emit("drop", { count }, "action");
  },
});

mount({
  slug: "xac-suat-galton",
  version: "1.0.0",
  title: "Bảng Galton và phân phối nhị thức",
  hint: "Mô hình: ở mỗi hàng đinh, viên bi rẽ phải với xác suất p, rẽ trái với xác suất 1 − p. Ô thứ k chứa các viên bi đã rẽ phải k lần. Ban đầu đã có sẵn 100 viên bi.",
  initialState,
  sanitize,
  autoplay: true,
  step(s, dt, api) {
    const was = busy(s);
    step(s, dt);
    if (!was || busy(s)) return;
    // The batch has just finished: one result for the whole sample so far.
    const r = stats(s.bins);
    const t = theory(s.rows, s.p);
    api.emit("batch-done", { balls: r.n, mean: r.mean, sd: r.sd, expectedMean: t.mean, expectedSd: t.sd }, "result");
  },
  controls: [
    { type: "slider", key: "rows", label: "Số hàng đinh n", min: 1, max: MAX_ROWS, step: 1, digits: 0, onChange: clear },
    { type: "slider", key: "p", label: "Xác suất rẽ phải p", min: 0, max: 1, step: 0.05, onChange: clear },
    drop(1, true),
    drop(10),
    drop(100),
    { type: "checkbox", key: "continuous", label: "Thả liên tục", onChange: (s, api) => s.continuous && api.play() },
    { type: "checkbox", key: "showTheory", label: "Hiện phân phối lí thuyết" },
    {
      type: "button",
      label: "Xóa các viên bi",
      action(s) {
        clear(s);
        s.continuous = false;
      },
    },
  ],
  readouts: [
    { label: "Số viên bi N", value: s => fmt(stats(landed(s)).n, 0) },
    { label: "x̄ (mẫu) | np", value: s => `${stats(landed(s)).n ? fmt(stats(landed(s)).mean) : "–"} | ${fmt(theory(s.rows, s.p).mean)}` },
    { label: "s (mẫu) | √(np(1 − p))", value: s => `${stats(landed(s)).n ? fmt(stats(landed(s)).sd) : "–"} | ${fmt(theory(s.rows, s.p).sd)}` },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { n, dx, base, histTop, small } = g;
    const bins = landed(s);
    const st = stats(bins);
    const th = theory(n, s.p);
    const probs = bins.map((_, k) => binomial(n, k, s.p));
    const left = g.x(n, 0) - dx / 2;

    // pegs
    ctx.fillStyle = COLORS.muted;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k <= i; k++) {
        ctx.beginPath();
        ctx.arc(g.x(i, k), g.y(i) + g.br + g.pr, g.pr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // bins
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k <= n + 1; k++) {
      ctx.moveTo(left + k * dx, g.y(n) + g.br + 2);
      ctx.lineTo(left + k * dx, base);
    }
    ctx.stroke();
    ctx.strokeStyle = COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(left, base);
    ctx.lineTo(left + (n + 1) * dx, base);
    ctx.stroke();

    // histogram of relative frequencies against the binomial probabilities, on one scale
    const freq = bins.map(c => (st.n ? c / st.n : 0));
    const top = Math.max(...freq, ...(s.showTheory || !st.n ? probs : [0]), 1e-9);
    const H = base - histTop - (small ? 12 : 18);
    const fs = small ? 10 : 13;
    ctx.fillStyle = "rgba(47, 111, 237, 0.75)";
    bins.forEach((c, k) => {
      const h = (freq[k] / top) * H;
      ctx.fillRect(g.x(n, k) - dx * 0.38, base - h, dx * 0.76, h);
    });
    bins.forEach((c, k) => {
      // the count sits above the bar, or above the theory dot when that is higher
      const bar = (freq[k] / top) * H;
      const dot = s.showTheory ? (probs[k] / top) * H + (small ? 3 : 5) : 0;
      if (c && dx >= 18) label(ctx, fmt(c, 0), g.x(n, k), base - Math.max(bar, dot) - (small ? 6 : 9), { size: fs, align: "center", color: COLORS.blue, bold: true });
      label(ctx, String(k), g.x(n, k), base + (small ? 9 : 13), { size: fs, align: "center", color: COLORS.muted });
    });
    label(ctx, "k =", left - 3, base + (small ? 9 : 13), { size: fs, align: "right", color: COLORS.muted });
    if (!small) label(ctx, "k: số lần viên bi rẽ phải (số thứ tự của ô)", view.w / 2, base + 36, { size: 13, align: "center", color: COLORS.muted });
    if (s.showTheory) {
      ctx.strokeStyle = ctx.fillStyle = COLORS.orange;
      ctx.lineWidth = 2;
      ctx.beginPath();
      probs.forEach((q, k) => ctx.lineTo(g.x(n, k), base - (q / top) * H));
      ctx.stroke();
      probs.forEach((q, k) => {
        ctx.beginPath();
        ctx.arc(g.x(n, k), base - (q / top) * H, small ? 3 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // balls in the air: off a peg sideways by half a spacing, then down into the bin
    ctx.fillStyle = COLORS.red;
    for (const b of s._balls ?? []) {
      const i = Math.min(Math.floor(b.t), n);
      const f = b.t - i;
      let k = 0;
      for (let j = 0; j < i; j++) k += b.path[j];
      const x = i < n ? g.x(i, k) + (b.path[i] - 0.5) * dx * f : g.x(n, k);
      const y = g.y(i) + (i < n ? g.dy : base - g.br - g.y(n)) * f * f;
      ctx.beginPath();
      ctx.arc(x, y, g.br, 0, Math.PI * 2);
      ctx.fill();
    }

    // sample against theory, in the two free corners beside the triangle of pegs
    const lh = small ? 14 : 22;
    const size = small ? 11 : 15;
    const y0 = small ? 9 : 18;
    const sample = ["Thực nghiệm", `N = ${fmt(st.n, 0)}`, `x̄ = ${st.n ? fmt(st.mean) : "–"}`, `s = ${st.n ? fmt(st.sd) : "–"}`];
    const model = ["Lí thuyết", `n = ${n}; p = ${fmt(s.p)}`, `np = ${fmt(th.mean)}`, `√(np(1 − p)) = ${fmt(th.sd)}`];
    sample.forEach((text, i) => label(ctx, text, 10, y0 + i * lh, { size, bold: i === 0, color: i ? COLORS.ink : COLORS.blue }));
    model.forEach((text, i) => label(ctx, text, view.w - 10, y0 + i * lh, { size, bold: i === 0, color: i ? COLORS.ink : COLORS.orange, align: "right" }));
  },
});
