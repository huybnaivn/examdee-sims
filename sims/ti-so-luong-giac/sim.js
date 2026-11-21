import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, sides, ratios, rad, deg, EXACT, TASKS, taskMet } from "./model.js";

const MIN_A = 5;
const MAX_A = 85;
const MIN_BC = 2;
const MAX_BC = 8;
const FNS = ["sin", "cos", "tan", "cot"];

// A (right angle) is anchored bottom right; B to its left, C above it. The ratio text sits in a band on top.
function geom(s, view) {
  const small = view.w < 520 || view.h < 420;
  const lines = s.showSimilar ? 5 : 4;
  const band = 12 + lines * (small ? 16 : 20);
  const padR = small ? 70 : 110;
  const k = Math.min((view.w - padR - 34) / MAX_BC, (view.h - band - 34) / MAX_BC);
  const { ab, ac } = sides(s.alpha, s.bc);
  // centre the largest possible triangle in the free area
  const free = view.w - padR - 34 - MAX_BC * k;
  const A = { x: view.w - padR - free / 2, y: view.h - 24 - Math.max(0, view.h - band - 34 - MAX_BC * k) / 2 };
  return { small, band, k, A, B: { x: A.x - ab * k, y: A.y }, C: { x: A.x, y: A.y - ac * k } };
}

const exact = (s, fn) => {
  const a = s.atC ? 90 - s.alpha : s.alpha;
  return EXACT[a] ? ` = ${EXACT[a][fn]}` : "";
};
const angleName = s => (s.atC ? "C" : "α");

function commit(s, api) {
  const r = ratios(s.alpha, s.bc);
  api.emit("angle-committed", { angle: s.alpha, sin: r.sin, cos: r.cos, tan: r.tan }, "result");
  if (!s.taskDone && taskMet(s.alpha, s.task)) {
    s.taskDone = true;
    api.emit("angle-found", { angle: s.alpha, task: s.task }, "goal");
  }
}

function side(ctx, p, q, color, text, off, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
  ctx.stroke();
  label(ctx, text, (p.x + q.x) / 2 + off.x, (p.y + q.y) / 2 + off.y, { color, size, align: off.align ?? "center", bold: true });
}

mount({
  slug: "ti-so-luong-giac",
  version: "1.0.0",
  title: "Tỉ số lượng giác của góc nhọn",
  hint: "Kéo đỉnh C lên xuống để đổi góc α, kéo đỉnh B sang ngang để phóng to, thu nhỏ tam giác.",
  initialState,
  controls: [
    { type: "slider", key: "alpha", label: "Góc α = góc B", min: MIN_A, max: MAX_A, step: 1, unit: "°", digits: 0, onCommit: commit },
    { type: "slider", key: "bc", label: "Cạnh huyền BC", min: MIN_BC, max: MAX_BC, step: 0.1, unit: "cm", digits: 1, onCommit: commit },
    { type: "checkbox", key: "atC", label: "Xét góc C = 90° − α (góc phụ)" },
    { type: "checkbox", key: "showSimilar", label: "Hiện tam giác đồng dạng nhỏ hơn" },
    { type: "heading", label: "Tìm góc từ tỉ số" },
    {
      type: "select",
      key: "task",
      label: "Nhiệm vụ: chỉnh α (làm tròn đến độ) sao cho",
      options: TASKS.map((t, i) => ({ value: i, label: t ? t.text : "Không có nhiệm vụ" })),
      onChange(s, api) {
        s.taskDone = false;
        commit(s, api);
      },
    },
  ],
  readouts: [
    ...FNS.map(fn => ({ label: `${fn} α`, value: s => `${fmt(ratios(s.alpha, s.bc)[fn], 4)}${EXACT[s.alpha] ? ` (= ${EXACT[s.alpha][fn]})` : ""}` })),
    { label: "sin α = cos(90° − α)", value: s => `${fmt(ratios(s.alpha, 1).sin, 4)} = ${fmt(ratios(90 - s.alpha, 1).cos, 4)}` },
    { label: "tan α · cot α", value: s => fmt(ratios(s.alpha, 1).tan * ratios(s.alpha, 1).cot, 4) },
    { label: "sin²α + cos²α", value: s => fmt(ratios(s.alpha, 1).sin ** 2 + ratios(s.alpha, 1).cos ** 2, 4) },
    { label: "Nhiệm vụ", value: s => (!s.task ? "–" : taskMet(s.alpha, s.task) ? `Đạt: α = ${s.alpha}°` : "Chưa đạt") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      const near = q => Math.hypot(p.x - q.x, p.y - q.y) < 24;
      s._drag = near(g.C) ? "C" : near(g.B) ? "B" : null;
      return s._drag !== null;
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      const { ab } = sides(s.alpha, s.bc);
      if (s._drag === "C") {
        // AB stays, AC follows the pointer: α = arctan(AC / AB)
        const want = Math.max(0.05, (g.A.y - p.y) / g.k);
        let a = clamp(Math.round(deg(Math.atan2(want, ab))), MIN_A, MAX_A);
        while (ab / Math.cos(rad(a)) > MAX_BC && a > MIN_A) a--;
        while (ab / Math.cos(rad(a)) < MIN_BC && a < MAX_A) a++;
        s.alpha = a;
        s.bc = clamp(Math.round((ab / Math.cos(rad(a))) * 10) / 10, MIN_BC, MAX_BC);
      } else if (s._drag === "B") {
        // α stays, the triangle grows or shrinks: a similar triangle
        const newAb = Math.max(0.05, (g.A.x - p.x) / g.k);
        s.bc = clamp(Math.round((newAb / Math.cos(rad(s.alpha))) * 10) / 10, MIN_BC, MAX_BC);
      }
    },
    up(p, s, api) {
      if (!s._drag) return;
      api.emit("drag-vertex", { vertex: s._drag === "C" ? 1 : 2, angle: s.alpha, hypotenuse: s.bc });
      s._drag = null;
      commit(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { A, B, C, small } = g;
    const size = small ? 12 : 14;
    const r = ratios(s.alpha, s.bc, s.atC);
    const oppName = s.atC ? "AB" : "AC";
    const adjName = s.atC ? "AC" : "AB";
    const n = angleName(s);

    // ratio band
    const lh = small ? 16 : 20;
    const lines = [
      ["sin", "đối", "huyền", oppName, "BC", r.opp, r.hyp],
      ["cos", "kề", "huyền", adjName, "BC", r.adj, r.hyp],
      ["tan", "đối", "kề", oppName, adjName, r.opp, r.adj],
      ["cot", "kề", "đối", adjName, oppName, r.adj, r.opp],
    ];
    lines.forEach(([fn, top, bot, p, q, x, y], i) => {
      const text = small
        ? `${fn} ${n} = ${p}/${q} = ${fmt(x, 2)}/${fmt(y, 2)} ≈ ${fmt(x / y, 4)}${exact(s, fn)}`
        : `${fn} ${n} = ${top}/${bot} = ${p}/${q} = ${fmt(x, 2)}/${fmt(y, 2)} ≈ ${fmt(x / y, 4)}${exact(s, fn)}`;
      label(ctx, text, 10, 14 + i * lh, { size, color: COLORS.ink });
    });

    // similar triangle B A' C' with half the hypotenuse
    if (s.showSimilar) {
      const h = 0.5;
      const A2 = { x: B.x + (A.x - B.x) * h, y: A.y };
      const C2 = { x: A2.x, y: B.y + (C.y - B.y) * h };
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(A2.x, A2.y);
      ctx.lineTo(C2.x, C2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, "A'", A2.x - 4, A2.y - 10, { size: 12, align: "right", color: COLORS.muted });
      label(ctx, "C'", C2.x + 5, C2.y + 12, { size: 12, color: COLORS.muted });
      const r2 = ratios(s.alpha, s.bc * h);
      label(ctx, `Tam giác A'BC' nhỏ hơn: A'C'/BC' = ${fmt(r2.opp, 2)}/${fmt(r2.hyp, 2)} ≈ ${fmt(r2.sin, 4)} = sin α`, 10, 14 + 4 * lh, { size: small ? 11 : 13, color: COLORS.muted });
    }

    // sides, coloured by role for the angle being studied
    const red = COLORS.red;
    const blue = COLORS.blue;
    const tag = (role, len) => `${role} ${fmt(len, 2)}${small ? "" : " cm"}`;
    side(ctx, A, C, s.atC ? blue : red, tag(s.atC ? "kề" : "đối", sides(s.alpha, s.bc).ac), { x: 8, y: 0, align: "left" }, size);
    side(ctx, B, A, s.atC ? red : blue, tag(s.atC ? "đối" : "kề", sides(s.alpha, s.bc).ab), { x: 0, y: 14 }, size);
    const nx = C.y - B.y;
    const ny = -(C.x - B.x);
    const nl = Math.hypot(nx, ny) || 1;
    side(ctx, B, C, COLORS.purple, tag("huyền", s.bc), { x: (nx / nl) * 16, y: (ny / nl) * 16, align: "right" }, size);

    // right angle at A
    const q = 12;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(A.x - q, A.y - q, q, q);

    // studied angle
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (s.atC) ctx.arc(C.x, C.y, 30, Math.PI / 2, Math.PI / 2 + rad(90 - s.alpha));
    else ctx.arc(B.x, B.y, 30, -rad(s.alpha), 0);
    ctx.stroke();
    const mid = -rad(s.alpha) / 2;
    const [lx, ly] = s.atC ? [C.x + 12, C.y + 24] : [B.x + 48 * Math.cos(mid) + 14, B.y + 48 * Math.sin(mid)];
    label(ctx, s.atC ? `C = ${90 - s.alpha}°` : `α = ${s.alpha}°`, lx, ly, { size, color: COLORS.orange, bold: true });

    // vertices (B and C are handles)
    const ok = s.task && taskMet(s.alpha, s.task);
    for (const [P, name, dx, dy, handle] of [[A, "A", 10, 12, false], [B, "B", -12, 8, true], [C, "C", 12, -6, true]]) {
      ctx.fillStyle = handle ? (ok && P === C ? COLORS.green : COLORS.yellow) : COLORS.ink;
      ctx.beginPath();
      ctx.arc(P.x, P.y, handle ? 7 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (handle) {
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      label(ctx, name, P.x + dx, P.y + dy, { size: size + 1, bold: true, align: dx < 0 ? "right" : "left" });
    }
  },
});
