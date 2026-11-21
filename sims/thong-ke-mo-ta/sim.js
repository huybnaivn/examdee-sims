import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { MIN, MAX, CAP, PRESETS, initialState, stats, sanitize } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const num = v => (v === null ? "–" : fmt(v));

function tag(ctx, text, x, y, opts = {}) {
  ctx.save();
  ctx.font = `600 ${opts.size ?? 13}px ${FONT}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.bg;
  ctx.strokeText(text, x, y);
  ctx.restore();
  label(ctx, text, x, y, { size: 13, bold: true, ...opts });
}

// While a point is held below the axis it is about to be removed, so it no longer counts.
const live = s => (s._drag?.remove ? s.points.filter((_, i) => i !== s._drag.i) : s.points);

function geom(s, view) {
  const small = view.w < 520 || view.h < 400;
  const pad = small ? 18 : 40;
  const unit = (view.w - 2 * pad) / (MAX - MIN);
  const boxH = small ? 20 : 34;
  let lineY = view.h - (s.showBox ? 88 + boxH + (small ? 0 : 22) : 66);
  let top = small ? 30 : 46;
  const spare = Math.max(0, (lineY - top - 320) / 2); // on a tall stage keep the picture together, centred
  lineY -= spare;
  top += spare;
  const count = {};
  for (const v of s.points) count[v] = (count[v] ?? 0) + 1;
  const d = Math.min(unit * 0.92, 26, (lineY - top - 18) / Math.max(1, ...Object.values(count)));
  const X = v => pad + (v - MIN) * unit;
  const seen = {};
  const dots = s.points.map((v, i) => {
    const k = (seen[v] = (seen[v] ?? -1) + 1);
    return { i, v, x: X(v), y: lineY - 5 - d * (k + 0.5) };
  });
  return { small, unit, boxH, lineY, top, d, X, dots, count, value: p => clamp(Math.round((p.x - pad) / unit) + MIN, MIN, MAX) };
}

// One `result` per change of the sample.
const report = api => {
  const t = stats(api.state.points);
  const data = t.n ? { count: t.n, mean: t.mean, median: t.median, sd: t.sd } : { count: 0 };
  api.emit("stats-updated", data, "result");
};

mount({
  slug: "thong-ke-mo-ta",
  version: "1.0.0",
  title: "Số trung bình, trung vị và mốt",
  hint: "Bấm phía trên trục số để thêm điểm, kéo điểm để đổi giá trị, kéo điểm xuống dưới trục số để xóa.",
  initialState,
  sanitize,
  controls: [
    {
      type: "select",
      key: "preset",
      label: "Mẫu số liệu",
      options: [
        { value: "outlier", label: "Có một giá trị bất thường" },
        { value: "plain", label: "Không có giá trị bất thường" },
        { value: "bimodal", label: "Có hai mốt" },
        { value: "nomode", label: "Không có mốt" },
        { value: "custom", label: "Tự chọn" },
      ],
      onChange(s, api) {
        if (!PRESETS[s.preset]) return;
        s.points = [...PRESETS[s.preset]];
        report(api);
      },
    },
    { type: "checkbox", key: "showBox", label: "Hiện biểu đồ hộp (tứ phân vị)" },
    { type: "heading", label: "Thêm, xóa bằng nút bấm" },
    { type: "slider", key: "newValue", label: "Giá trị", min: MIN, max: MAX, step: 1, digits: 0 },
    {
      type: "button",
      label: "Thêm một điểm có giá trị này",
      disabled: s => s.points.length >= CAP,
      action(s, api) {
        s.points.push(s.newValue);
        s.preset = "custom";
        const data = { value: s.newValue };
        api.emit("point-added", data, "action");
        report(api);
      },
    },
    {
      type: "button",
      label: "Xóa một điểm có giá trị này",
      disabled: s => !s.points.includes(s.newValue),
      action(s, api) {
        s.points.splice(s.points.lastIndexOf(s.newValue), 1);
        s.preset = "custom";
        const data = { value: s.newValue };
        api.emit("point-removed", data, "action");
        report(api);
      },
    },
    {
      type: "button",
      label: "Xóa tất cả các điểm",
      disabled: s => !s.points.length,
      action(s, api) {
        const data = { count: s.points.length };
        s.points = [];
        s.preset = "custom";
        api.emit("points-cleared", data, "action");
        report(api);
      },
    },
  ],
  readouts: [
    { label: "Số điểm n", value: s => `${live(s).length}${s.points.length >= CAP ? " (tối đa)" : ""}` },
    { label: "Số trung bình x̄", value: s => num(stats(live(s)).mean) },
    { label: "Trung vị Me", value: s => num(stats(live(s)).median) },
    {
      label: "Mốt Mo",
      value: s => {
        const t = stats(live(s));
        return t.modes.length ? t.modes.map(v => fmt(v)).join("; ") : t.n ? "không có" : "–";
      },
    },
    { label: "Khoảng biến thiên R", value: s => num(stats(live(s)).range) },
    {
      label: "Tứ phân vị Q₁; Q₂; Q₃",
      value: s => {
        const t = stats(live(s));
        return `${num(t.q1)}; ${num(t.median)}; ${num(t.q3)}`;
      },
    },
    { label: "Độ lệch chuẩn s", value: s => num(stats(live(s)).sd) },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      const near = g.dots.map(dot => Math.hypot(p.x - dot.x, p.y - dot.y));
      const i = near.indexOf(Math.min(...near));
      if (i >= 0 && near[i] <= g.d / 2 + 10) {
        s._drag = { i, from: s.points[i] };
      } else if (p.y < g.lineY + 8 && s.points.length < CAP) {
        s.points.push(g.value(p));
        s._drag = { i: s.points.length - 1, added: true };
      } else {
        return false;
      }
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      s.points[s._drag.i] = g.value(p);
      s._drag.remove = p.y > g.lineY + 34;
    },
    up(p, s, api) {
      const drag = s._drag;
      s._drag = undefined;
      const value = s.points[drag.i];
      if (drag.remove) {
        s.points.splice(drag.i, 1);
        if (drag.added) return; // added and thrown away in one gesture: nothing happened
        const data = { value: drag.from };
        api.emit("point-removed", data, "action");
      } else if (drag.added) {
        const data = { value };
        api.emit("point-added", data, "action");
      } else if (value !== drag.from) {
        const data = { from: drag.from, to: value };
        api.emit("point-moved", data, "action");
      } else {
        return;
      }
      s.preset = "custom";
      report(api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { X, lineY, small, d } = g;
    const t = stats(live(s));
    const size = small ? 11 : 13;
    const inside = (x, half) => clamp(x, half + 4, view.w - half - 4);

    // median, behind the points
    if (t.n) {
      ctx.strokeStyle = COLORS.green;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(X(t.median), g.top - 4);
      ctx.lineTo(X(t.median), lineY);
      ctx.stroke();
      ctx.setLineDash([]);
      tag(ctx, `Trung vị Me = ${fmt(t.median)}`, inside(X(t.median), small ? 52 : 62), g.top - 15, { size, align: "center", color: COLORS.green });
    }

    // the number line: a beam resting on the mean
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(X(MIN) - 10, lineY);
    ctx.lineTo(X(MAX) + 10, lineY);
    ctx.stroke();
    ctx.lineWidth = 1;
    const every = g.unit >= 22 ? 1 : 5;
    for (let v = MIN; v <= MAX; v++) {
      const major = v % 5 === 0;
      ctx.beginPath();
      ctx.moveTo(X(v), lineY);
      ctx.lineTo(X(v), lineY + (major ? 6 : 3));
      ctx.stroke();
      // the fulcrum takes the place of the labels under it
      if (v % every === 0 && !(t.n && Math.abs(X(v) - X(t.mean)) < 16)) {
        label(ctx, String(v), X(v), lineY + 14, { size: size - 1, align: "center", color: COLORS.muted });
      }
    }

    // points, stacked when values repeat
    const dragging = s._drag?.i;
    for (const dot of g.dots) {
      const gone = dragging === dot.i && s._drag.remove;
      const mode = !gone && t.modes.includes(dot.v);
      ctx.globalAlpha = gone ? 0.35 : 1;
      ctx.fillStyle = gone ? COLORS.red : mode ? COLORS.purple : COLORS.blue;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, Math.max(2, d / 2 - 1), 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (dragging === dot.i && !gone) {
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    for (const v of t.modes) {
      tag(ctx, "Mo", X(v), lineY - 5 - d * g.count[v] - 9, { size, align: "center", color: COLORS.purple });
    }
    if (s._drag?.remove) tag(ctx, "Thả tay để xóa điểm này", view.w / 2, lineY - 40, { size, align: "center", color: COLORS.red });
    if (!s.points.length) {
      tag(ctx, "Chưa có số liệu", view.w / 2, (g.top + lineY) / 2 - 10, { size: size + 2, align: "center", color: COLORS.muted });
      tag(ctx, "Bấm vào đây để thêm điểm", view.w / 2, (g.top + lineY) / 2 + 12, { size, align: "center", color: COLORS.muted });
    }

    if (!t.n) return;

    // mean: the balance point
    const xm = X(t.mean);
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.moveTo(xm, lineY + 3);
    ctx.lineTo(xm + 11, lineY + 20);
    ctx.lineTo(xm - 11, lineY + 20);
    ctx.closePath();
    ctx.fill();
    const meanText = small ? `x̄ = ${fmt(t.mean)}` : `Số trung bình x̄ = ${fmt(t.mean)} (điểm cân bằng)`;
    tag(ctx, meanText, inside(xm, small ? 30 : 125), lineY + 31, { size, align: "center", color: COLORS.orange });

    // one standard deviation on each side of the mean
    const y = lineY + 45;
    const x1 = Math.max(4, X(t.mean - t.sd));
    const x2 = Math.min(view.w - 4, X(t.mean + t.sd));
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.moveTo(x1, y - 4);
    ctx.lineTo(x1, y + 4);
    ctx.moveTo(x2, y - 4);
    ctx.lineTo(x2, y + 4);
    ctx.stroke();
    tag(ctx, small ? `x̄ ± s,  s = ${fmt(t.sd)}` : `từ x̄ − s đến x̄ + s,  độ lệch chuẩn s = ${fmt(t.sd)}`, inside(xm, small ? 50 : 135), y + 12, { size: size - 1, align: "center", color: COLORS.orange });

    // box plot: whiskers to the smallest and largest value
    if (s.showBox && t.q1 !== null) {
      const y0 = lineY + 70;
      const ym = y0 + g.boxH / 2;
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X(t.min), ym);
      ctx.lineTo(X(t.q1), ym);
      ctx.moveTo(X(t.q3), ym);
      ctx.lineTo(X(t.max), ym);
      for (const v of [t.min, t.max]) {
        ctx.moveTo(X(v), ym - g.boxH / 4);
        ctx.lineTo(X(v), ym + g.boxH / 4);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(47, 111, 237, 0.18)";
      ctx.fillRect(X(t.q1), y0, X(t.q3) - X(t.q1), g.boxH);
      ctx.strokeRect(X(t.q1), y0, X(t.q3) - X(t.q1), g.boxH);
      ctx.strokeStyle = COLORS.green;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(X(t.median), y0);
      ctx.lineTo(X(t.median), y0 + g.boxH);
      ctx.stroke();
      // names under the box, skipping one that would sit on top of its neighbour
      const used = [];
      for (const [name, v, color] of [["Me", t.median, COLORS.green], ["Q₁", t.q1, COLORS.ink], ["Q₃", t.q3, COLORS.ink]]) {
        if (used.some(x => Math.abs(X(v) - x) < 15)) continue;
        used.push(X(v));
        label(ctx, name, X(v), y0 + g.boxH + 10, { size: size - 1, align: "center", color, bold: true });
      }
      if (!small) {
        label(ctx, "Biểu đồ hộp: hai râu kéo dài đến giá trị nhỏ nhất và giá trị lớn nhất", view.w / 2, y0 + g.boxH + 30, { size: 12, align: "center", color: COLORS.muted });
      }
    }
  },
});
