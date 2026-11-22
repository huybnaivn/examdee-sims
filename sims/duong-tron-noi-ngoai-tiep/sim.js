import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, solve, foot, bisectorFoot, dist, POSITION } from "./model.js";

const X_LIM = [-7, 7];
const Y_LIM = [-6, 5];
const CIRC = COLORS.blue; // perpendicular bisectors, circumscribed circle, O
const INC = COLORS.green; // angle bisectors, inscribed circle, I
const KEYS = { A: ["ax", "ay"], B: ["bx", "by"], C: ["cx", "cy"] };
const snap = v => Math.round(v * 2) / 2; // vertices sit on half units

function geom(view) {
  const small = view.w < 520 || view.h < 420;
  const top = small ? 44 : 62;
  const bottom = small ? 8 : 14;
  const k = Math.min((view.w - 16) / (X_LIM[1] - X_LIM[0] + 1), (view.h - top - bottom) / (Y_LIM[1] - Y_LIM[0] + 1.5));
  const cx = view.w / 2;
  const cy = top + (view.h - top - bottom) / 2;
  const midY = (Y_LIM[0] + Y_LIM[1]) / 2;
  return {
    small,
    k,
    S: ([x, y]) => [cx + x * k, cy - (y - midY) * k],
    inv: p => ({ x: (p.x - cx) / k, y: midY + (cy - p.y) / k }),
  };
}

function line(ctx, P, Q, color, width = 2, dash) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash ?? []);
  ctx.beginPath();
  ctx.moveTo(P[0], P[1]);
  ctx.lineTo(Q[0], Q[1]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function circle(ctx, C, r, color, width = 2.5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(C[0], C[1], r, 0, Math.PI * 2);
  ctx.stroke();
}

function dot(ctx, P, color, r = 5) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(P[0], P[1], r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Small right-angle mark at F, between the directions to P and to Q (screen points). */
function rightMark(ctx, F, P, Q, color, m = 8) {
  const u = unit(F, P);
  const w = unit(F, Q);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(F[0] + u[0] * m, F[1] + u[1] * m);
  ctx.lineTo(F[0] + (u[0] + w[0]) * m, F[1] + (u[1] + w[1]) * m);
  ctx.lineTo(F[0] + w[0] * m, F[1] + w[1] * m);
  ctx.stroke();
}
const unit = (F, P) => {
  const d = Math.hypot(P[0] - F[0], P[1] - F[1]) || 1;
  return [(P[0] - F[0]) / d, (P[1] - F[1]) / d];
};

const WHERE = {
  [POSITION.inside]: "Tam giác nhọn: tâm O nằm trong tam giác",
  [POSITION.onSide]: "Tam giác vuông: O là trung điểm cạnh huyền",
  [POSITION.outside]: "Tam giác tù: tâm O nằm ngoài tam giác",
};

// One result per finished move; the goal fires once each time O lands on a side (a right triangle).
function report(s, api) {
  const m = solve(s);
  if (m.degenerate) {
    s._right = false;
    return;
  }
  api.emit("circles-measured", { R: m.R, r: m.r, position: m.position }, "result");
  const right = m.position === POSITION.onSide;
  if (right && !s._right) api.emit("circumcentre-on-side", { R: m.R, hypotenuse: 2 * m.R }, "goal");
  s._right = right;
}

const coord = (key, name, lim) => ({ type: "slider", key, label: name, min: lim[0], max: lim[1], step: 0.5, onCommit: report });

mount({
  slug: "duong-tron-noi-ngoai-tiep",
  version: "1.0.0",
  title: "Đường tròn ngoại tiếp và nội tiếp tam giác",
  hint: "Kéo các đỉnh A, B, C. Ba đường trung trực cắt nhau tại tâm O của đường tròn ngoại tiếp; ba đường phân giác cắt nhau tại tâm I của đường tròn nội tiếp.",
  initialState,
  controls: [
    { type: "checkbox", key: "showCircum", label: "Đường trung trực và đường tròn ngoại tiếp (O; R)" },
    { type: "checkbox", key: "showIn", label: "Đường phân giác và đường tròn nội tiếp (I; r)" },
    { type: "heading", label: "Tọa độ các đỉnh" },
    coord("ax", "A: hoành độ", X_LIM),
    coord("ay", "A: tung độ", Y_LIM),
    coord("bx", "B: hoành độ", X_LIM),
    coord("by", "B: tung độ", Y_LIM),
    coord("cx", "C: hoành độ", X_LIM),
    coord("cy", "C: tung độ", Y_LIM),
  ],
  readouts: [
    { label: "Ba cạnh a = BC, b = CA, c = AB", value: s => { const m = solve(s); return `${fmt(m.a)}; ${fmt(m.b)}; ${fmt(m.c)}`; } },
    { label: "Diện tích S, nửa chu vi p", value: s => { const m = solve(s); return `${fmt(m.S)}; ${fmt(m.p)}`; } },
    { label: "R = abc/(4S)", value: s => { const m = solve(s); return m.degenerate ? "–" : fmt(m.R); } },
    { label: "r = S/p", value: s => { const m = solve(s); return m.degenerate ? "–" : fmt(m.r); } },
    {
      label: "OI và √(R² − 2Rr) (hệ thức Euler)",
      value: s => {
        const m = solve(s);
        return m.degenerate ? "–" : `${fmt(dist(m.O, m.I))} = ${fmt(Math.sqrt(Math.max(0, m.R ** 2 - 2 * m.R * m.r)))}`;
      },
    },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      let best = null;
      let bestD = g.small ? 24 : 20;
      for (const [name, [kx, ky]] of Object.entries(KEYS)) {
        const [x, y] = g.S([s[kx], s[ky]]);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) [best, bestD] = [name, d];
      }
      if (!best) return false;
      s._drag = best;
      s._from = `${s[KEYS[best][0]]},${s[KEYS[best][1]]}`;
    },
    move(p, s, api, view) {
      if (!s._drag) return;
      const w = geom(view).inv(p);
      const [kx, ky] = KEYS[s._drag];
      s[kx] = clamp(snap(w.x), ...X_LIM);
      s[ky] = clamp(snap(w.y), ...Y_LIM);
    },
    up(p, s, api) {
      const name = s._drag;
      s._drag = null;
      if (!name) return;
      const [kx, ky] = KEYS[name];
      if (`${s[kx]},${s[ky]}` === s._from) return;
      api.emit("vertex-moved", { vertex: name, x: s[kx], y: s[ky] }, "action");
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const m = solve(s);
    const fs = g.small ? 12 : 14;
    const [A, B, C] = [m.A, m.B, m.C].map(g.S);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = X_LIM[0]; x <= X_LIM[1]; x++) {
      const [sx] = g.S([x, 0]);
      ctx.moveTo(sx, g.S([0, Y_LIM[1] + 0.5])[1]);
      ctx.lineTo(sx, g.S([0, Y_LIM[0] - 0.5])[1]);
    }
    for (let y = Y_LIM[0]; y <= Y_LIM[1]; y++) {
      const [, sy] = g.S([0, y]);
      ctx.moveTo(g.S([X_LIM[0] - 0.5, 0])[0], sy);
      ctx.lineTo(g.S([X_LIM[1] + 0.5, 0])[0], sy);
    }
    ctx.stroke();

    if (!m.degenerate) {
      const O = g.S(m.O);
      const I = g.S(m.I);
      const far = Math.hypot(view.w, view.h);

      if (s.showCircum) {
        // perpendicular bisectors through the midpoints of the sides, with right-angle marks
        for (const [P, Q] of [[A, B], [B, C], [C, A]]) {
          const M = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
          const u = unit(P, Q);
          const n = [-u[1], u[0]];
          line(ctx, [M[0] - n[0] * far, M[1] - n[1] * far], [M[0] + n[0] * far, M[1] + n[1] * far], CIRC + "99", 1.5);
          rightMark(ctx, M, Q, [M[0] + n[0], M[1] + n[1]], CIRC, g.small ? 6 : 8);
          // equal halves
          for (const t of [0.25, 0.75]) {
            const T = [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];
            line(ctx, [T[0] - n[0] * 5, T[1] - n[1] * 5], [T[0] + n[0] * 5, T[1] + n[1] * 5], CIRC, 1.5);
          }
        }
        circle(ctx, O, m.R * g.k, CIRC);
        line(ctx, O, A, CIRC, 2, [6, 4]);
        const mid = [(O[0] + A[0]) / 2, (O[1] + A[1]) / 2];
        label(ctx, "R", mid[0], mid[1] - 10, { align: "center", size: fs + 1, bold: true, color: CIRC });
      }

      if (s.showIn) {
        for (const [V, P, Q] of [[A, B, C], [B, C, A], [C, A, B]]) line(ctx, V, bisectorFoot(V, P, Q), INC + "aa", 1.5);
        circle(ctx, I, m.r * g.k, INC);
        const H = foot(I, B, C); // touch point on BC
        line(ctx, I, H, INC, 2, [5, 3]);
        rightMark(ctx, H, I, C, INC, g.small ? 6 : 8);
        const mid = [(I[0] + H[0]) / 2, (I[1] + H[1]) / 2];
        const side = unit(B, C);
        label(ctx, "r", mid[0] + side[0] * 9, mid[1] + side[1] * 9, { align: "center", size: fs + 1, bold: true, color: INC });
      }

      // triangle
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(...A);
      ctx.lineTo(...B);
      ctx.lineTo(...C);
      ctx.closePath();
      ctx.stroke();

      // names on the far sides of the two centres, so they do not collide when O and I are close
      const io = Math.hypot(O[0] - I[0], O[1] - I[1]) > 1 ? unit(I, O) : [0.6, -0.8];
      if (s.showIn) {
        dot(ctx, I, INC);
        label(ctx, "I", I[0] - io[0] * 13, I[1] - io[1] * 13, { align: "center", size: fs + 1, bold: true, color: INC });
      }
      if (s.showCircum) {
        dot(ctx, O, m.position === POSITION.onSide ? COLORS.red : CIRC, m.position === POSITION.onSide ? 7 : 5);
        label(ctx, "O", O[0] + io[0] * 13, O[1] + io[1] * 13, { align: "center", size: fs + 1, bold: true, color: CIRC });
      }
    } else {
      line(ctx, A, B, COLORS.ink, 2.5);
      line(ctx, B, C, COLORS.ink, 2.5);
      line(ctx, C, A, COLORS.ink, 2.5);
    }

    // vertices, names pushed away from the centroid
    const G = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
    for (const [name, P] of [["A", A], ["B", B], ["C", C]]) {
      dot(ctx, P, COLORS.ink, g.small ? 7 : 8);
      const u = unit(G, P);
      const d = u[0] === 0 && u[1] === 0 ? [0, -1] : u;
      label(ctx, name, P[0] + d[0] * 18, P[1] + d[1] * 18, { align: "center", size: fs + 3, bold: true });
    }

    // headline on a clear band (the bisector lines run to the canvas edge)
    ctx.fillStyle = "rgba(247, 249, 253, 0.9)";
    ctx.fillRect(0, 0, view.w, g.small ? 40 : 56);
    const head = m.degenerate
      ? "A, B, C thẳng hàng: không tạo thành tam giác"
      : `R = abc/(4S) = ${fmt(m.R)}     r = S/p = ${fmt(m.r)}`;
    label(ctx, head, view.w / 2, g.small ? 13 : 21, { align: "center", size: g.small ? 14 : 19, bold: true });
    if (!m.degenerate) {
      label(ctx, WHERE[m.position], view.w / 2, g.small ? 31 : 45, {
        align: "center",
        size: g.small ? 11 : 14,
        bold: m.position === POSITION.onSide,
        color: m.position === POSITION.onSide ? COLORS.red : COLORS.muted,
      });
    }
  },
});
