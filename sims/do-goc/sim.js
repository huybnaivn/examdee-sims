import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import {
  RADIUS, TYPE_CODE, initialState, norm, angleOf, classify, snapDegree, readProtractor, snapProtractor,
  question, startQuestion, nextQuestion, isCorrect,
} from "./model.js";

const rad = d => (d * Math.PI) / 180;
const NAMES = { zero: "góc không", acute: "góc nhọn", right: "góc vuông", obtuse: "góc tù", straight: "góc bẹt" };
const WHY = { zero: "hai cạnh trùng nhau", acute: "bé hơn 90°", right: "bằng 90°", obtuse: "lớn hơn 90°, bé hơn 180°", straight: "bằng 180°" };
const SCALE = { inner: "trong", outer: "ngoài" };
const TONE = { inner: COLORS.blue, outer: COLORS.red };
const practice = s => s.mode !== "measure";
const done = s => s.status === "right";
/** Is the measure of the angle on show? In practice only once the answer is right. */
const revealed = s => (practice(s) ? done(s) : s.showMeasure);
const solvedCount = s => Math.max(0, Math.round(s.solved) || 0);

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(s, view) {
  const small = view.w < 520 || view.h < 400;
  const head = small ? 46 : 80;
  const L = Math.max(50, Math.min(view.w / 2 - 22, (view.h - head) / 2 - 18)); // arm length, px
  const O = { x: view.w / 2, y: head + (view.h - head) / 2 };
  const P = (x, y) => ({ x: O.x + x * L, y: O.y - y * L });
  const end = dir => P(Math.cos(rad(dir)), Math.sin(rad(dir)));
  const C = P(clamp(s.px, -1, 1), clamp(s.py, -1, 1));
  return { small, L, O, P, end, C, R: RADIUS * L };
}

/** Centred text that shrinks to stay inside the stage. */
function fit(ctx, text, view, y, opts) {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = ctx.measureText(text).width;
  label(ctx, text, view.w / 2, y, { ...opts, align: "center", size: Math.min(opts.size, (opts.size * (view.w - 20)) / w) });
}

const dirTo = (from, p) => (Math.atan2(from.y - p.y, p.x - from.x) * 180) / Math.PI;

function drawProtractor(ctx, s, g) {
  const { C, R } = g;
  const at = (r, d) => [r * Math.cos(rad(d)), -r * Math.sin(rad(d))];
  ctx.save();
  ctx.translate(C.x, C.y);
  ctx.rotate(-rad(s.rot));
  const base = R * 0.1;
  ctx.beginPath();
  ctx.arc(0, 0, R, Math.PI, 0);
  ctx.lineTo(R, base);
  ctx.lineTo(-R, base);
  ctx.closePath();
  ctx.fillStyle = "rgba(47, 111, 237, 0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(31, 42, 68, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // base line through both zeros, and the centre mark
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-R, 0);
  ctx.lineTo(R, 0);
  ctx.moveTo(0, base);
  ctx.lineTo(0, -R * 0.16);
  ctx.stroke();

  const fine = R >= 150 ? 1 : 5;
  ctx.beginPath();
  for (let d = 0; d <= 180; d += fine) {
    const len = d % 10 === 0 ? 0.09 : d % 5 === 0 ? 0.06 : 0.035;
    ctx.moveTo(...at(R, d));
    ctx.lineTo(...at(R * (1 - len), d));
  }
  const rIn = R * 0.6; // inner ring of numbers
  for (let d = 0; d <= 180; d += 10) {
    ctx.moveTo(...at(rIn + R * 0.11, d));
    ctx.lineTo(...at(rIn + R * 0.07, d));
  }
  ctx.stroke();

  const size = clamp(R * 0.075, 8, 14);
  const rOut = R * 0.91 - size * 0.8;
  const every = r => [10, 20, 30].find(e => r * rad(e) >= size * 2) ?? 30;
  // outer scale: 0 at the left end, clockwise; inner scale: 0 at the right end, counter-clockwise
  for (const [r, value, color, step] of [[rOut, d => 180 - d, TONE.outer, every(rOut)], [rIn, d => d, TONE.inner, every(rIn)]]) {
    for (let d = 0; d <= 180; d += 10) {
      if (value(d) % step !== 0) continue;
      const lift = clamp(d, (size * 40) / r, 180 - (size * 40) / r); // keep 0 and 180 clear of the base line
      const [x, y] = at(r, lift);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 2 - rad(lift));
      label(ctx, `${value(d)}`, 0, 0, { size, align: "center", color, bold: value(d) === 0 });
      ctx.restore();
    }
  }
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  return { rOut, rIn, size };
}

const report = (s, api) => {
  const angle = angleOf(s);
  api.emit("angle-set", { angle, type: TYPE_CODE[classify(angle)] }, "result");
};
const placed = (s, api) => {
  const r = readProtractor(s);
  api.emit("protractor-placed", { centered: r.reason === "center" ? 0 : 1, aligned: r.ok ? 1 : 0 }, "action");
};
const noNumber = () => "";

mount({
  slug: "do-goc",
  version: "1.0.0",
  title: "Góc và thước đo góc",
  hint: "Kéo đầu các cạnh để đổi góc. Kéo phần giữa thước để di chuyển, kéo vành thước để xoay. Đặt tâm thước vào đỉnh O và cho một cạnh đi qua vạch 0.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Hoạt động",
      options: [
        { value: "measure", label: "Đo góc" },
        { value: "read", label: "Luyện tập: đọc số đo góc" },
        { value: "draw", label: "Luyện tập: vẽ góc cho trước" },
      ],
      onChange: s => {
        if (practice(s)) startQuestion(s);
      },
    },
    { type: "slider", key: "dir1", label: "Xoay cạnh Ox", min: 0, max: 359, step: 1, unit: "°", digits: 0, visible: s => !practice(s), onCommit: report },
    {
      type: "slider",
      key: "dir2",
      label: "Xoay cạnh Oy",
      min: 0,
      max: 359,
      step: 1,
      visible: s => s.mode !== "read",
      disabled: done,
      format: (v, s) => (practice(s) ? "" : `${v}°`), // would give the drawing away
      onChange: s => {
        if (practice(s)) s.status = "";
      },
      onCommit: report,
    },
    { type: "checkbox", key: "showMeasure", label: "Hiện số đo góc", visible: s => !practice(s) },
    {
      type: "slider",
      key: "answer",
      label: "Số đo em đọc được",
      min: 0,
      max: 180,
      step: 1,
      unit: "°",
      digits: 0,
      visible: s => s.mode === "read",
      disabled: done,
      onChange: s => {
        s.status = "";
      },
    },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: practice,
      disabled: done,
      action(s, api) {
        const target = question(s.qIndex).target;
        const angle = angleOf(s);
        if (isCorrect(s)) {
          s.status = "right";
          s.solved = solvedCount(s) + 1;
          if (s.mode === "read") api.emit("reading-correct", { angle, answer: s.answer, solved: s.solved }, "goal");
          else api.emit("drawing-correct", { target, angle, solved: s.solved }, "goal");
        } else {
          s.status = "wrong";
          api.emit("wrong-answer", { target, value: s.mode === "read" ? s.answer : angle }, "action");
        }
      },
    },
    { type: "button", label: "Câu khác", visible: practice, action: s => nextQuestion(s), event: "new-question", eventKind: "action" },
    { type: "heading", label: "Thước đo góc" },
    {
      type: "button",
      label: "Đặt tâm thước vào đỉnh O",
      action(s, api) {
        s.px = s.py = 0;
        placed(s, api);
      },
    },
    { type: "slider", key: "rot", label: "Xoay thước", min: 0, max: 359, step: 1, unit: "°", digits: 0, onCommit: placed },
    { type: "slider", key: "px", label: "Đưa thước sang trái, sang phải", min: -1, max: 1, step: 0.01, format: noNumber, onCommit: placed },
    { type: "slider", key: "py", label: "Đưa thước xuống, lên", min: -1, max: 1, step: 0.01, format: noNumber, onCommit: placed },
  ],
  readouts: [
    { label: "Số đo góc xOy", value: s => (revealed(s) ? `${angleOf(s)}°` : "?") },
    { label: "Loại góc", value: s => (revealed(s) ? NAMES[classify(angleOf(s))] : "?") },
    {
      label: "Thang đo cần đọc",
      value: s => {
        const r = readProtractor(s);
        return r.ok ? `thang ${SCALE[r.scale]}` : "chưa đặt đúng thước";
      },
    },
    { label: "Số câu luyện tập đúng", value: s => `${solvedCount(s)}` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      const arms = s.mode === "measure" ? ["dir1", "dir2"] : s.mode === "draw" && !done(s) ? ["dir2"] : [];
      const arm = arms.find(k => Math.hypot(p.x - g.end(s[k]).x, p.y - g.end(s[k]).y) < 26);
      if (arm) {
        s._drag = arm;
        return true;
      }
      // protractor: its own frame, x along the base line, y towards the arc
      const dx = p.x - g.C.x;
      const dy = g.C.y - p.y;
      const c = Math.cos(rad(s.rot));
      const sn = Math.sin(rad(s.rot));
      const local = { x: dx * c + dy * sn, y: -dx * sn + dy * c };
      const d = Math.hypot(local.x, local.y);
      if (d > g.R + 10 || local.y < -g.R * 0.1 - 10) return false;
      if (d > g.R * 0.62) {
        s._drag = "rotate";
        s._off = s.rot - dirTo(g.C, p);
      } else {
        s._drag = "move";
        s._off = { x: p.x - g.C.x, y: p.y - g.C.y };
      }
      return true;
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      if (s._drag === "rotate") {
        s.rot = snapDegree(dirTo(g.C, p) + s._off);
      } else if (s._drag === "move") {
        s.px = clamp((p.x - s._off.x - g.O.x) / g.L, -1, 1);
        s.py = clamp((g.O.y - (p.y - s._off.y)) / g.L, -1, 1);
      } else if (s._drag) {
        s[s._drag] = snapDegree(dirTo(g.O, p));
        if (practice(s)) s.status = "";
      }
    },
    up(p, s, api) {
      const what = s._drag;
      s._drag = "";
      if (what === "rotate" || what === "move") {
        Object.assign(s, snapProtractor(s));
        placed(s, api);
      } else if (what) {
        report(s, api);
      }
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { small, L, O, R } = g;
    const angle = angleOf(s);
    const type = classify(angle);
    const show = revealed(s);
    const r = readProtractor(s);
    const target = question(s.qIndex).target;

    // angle mark: the smaller turn from Ox to Oy
    const ccw = norm(s.dir2 - s.dir1) <= 180;
    const ra = L * 0.2;
    ctx.fillStyle = "rgba(240, 140, 46, 0.22)";
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (angle === 90) {
      const a = g.P(0.14 * Math.cos(rad(s.dir1)), 0.14 * Math.sin(rad(s.dir1)));
      const b = g.P(0.14 * Math.cos(rad(s.dir2)), 0.14 * Math.sin(rad(s.dir2)));
      ctx.moveTo(O.x, O.y);
      ctx.lineTo(a.x, a.y);
      ctx.lineTo(a.x + b.x - O.x, a.y + b.y - O.y);
      ctx.lineTo(b.x, b.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.moveTo(O.x, O.y);
      ctx.arc(O.x, O.y, ra, -rad(s.dir1), -rad(s.dir2), ccw);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(O.x, O.y, ra, -rad(s.dir1), -rad(s.dir2), ccw);
      ctx.stroke();
    }

    // the two arms
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const dir of [s.dir1, s.dir2]) {
      const e = g.end(dir);
      ctx.beginPath();
      ctx.moveTo(O.x, O.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }

    const marks = drawProtractor(ctx, s, g);

    // where to read: the other arm on the scale whose zero lies on the first arm
    if (r.ok) {
      const dir = r.zeroArm === 1 ? s.dir2 : s.dir1;
      const ring = r.scale === "outer" ? marks.rOut : marks.rIn;
      ctx.strokeStyle = TONE[r.scale];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(O.x + ring * Math.cos(rad(dir)), O.y - ring * Math.sin(rad(dir)), marks.size * 1.25, 0, Math.PI * 2);
      ctx.stroke();
    }

    // names, handles
    const bis = rad(s.dir1 + (ccw ? 1 : -1) * (angle / 2));
    label(ctx, "O", O.x - 16 * Math.cos(bis), O.y + 16 * Math.sin(bis), { size: small ? 14 : 17, align: "center", bold: true });
    const movable = s.mode === "measure" ? [true, true] : [false, s.mode === "draw" && !done(s)];
    [[s.dir1, "x"], [s.dir2, "y"]].forEach(([dir, name], k) => {
      const e = g.end(dir);
      if (movable[k]) {
        ctx.fillStyle = COLORS.orange;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, small ? 8 : 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      label(ctx, name, e.x + 17 * Math.cos(rad(dir)), e.y - 17 * Math.sin(rad(dir)), { size: small ? 14 : 17, align: "center", bold: true });
    });
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(O.x, O.y, 4, 0, Math.PI * 2);
    ctx.fill();
    if (show && angle > 0) {
      const rl = ra + (small ? 16 : 22);
      label(ctx, `${angle}°`, O.x + rl * Math.cos(bis), O.y - rl * Math.sin(bis), { size: small ? 14 : 18, align: "center", bold: true, color: COLORS.orange });
    }

    // what is asked, and what the protractor says
    const kind = `${NAMES[type]} (${WHY[type]})`;
    const title = done(s)
      ? `Đúng rồi! Góc xOy = ${angle}°: ${kind}`
      : s.mode === "read"
        ? "Góc xOy bằng bao nhiêu độ?"
        : s.mode === "draw"
          ? `Vẽ góc xOy có số đo ${target}°: kéo cạnh Oy`
          : show
            ? `Góc xOy = ${angle}°: ${kind}`
            : "Dùng thước đo góc để đo góc xOy";
    fit(ctx, title, view, small ? 14 : 28, { size: small ? 14 : 20, bold: true, color: done(s) ? COLORS.green : COLORS.ink });
    const zero = r.ok ? (r.zeroArm === 1 ? ["Ox", "Oy"] : ["Oy", "Ox"]) : [];
    const guide =
      s.status === "wrong"
        ? [s.mode === "read" ? "Chưa đúng. Cạnh góc đi qua vạch 0 của thang nào thì đọc thang đó." : "Chưa đúng. Hãy dùng thước đo lại góc vừa vẽ.", COLORS.red]
        : r.ok
          ? [`${zero[0]} đi qua vạch 0 của thang ${SCALE[r.scale]}: đọc thang ${SCALE[r.scale]} ${show && small ? "" : `tại cạnh ${zero[1]}`}${show ? `${small ? "" : ", "}được ${Math.round(r.value)}°` : ""}.`, TONE[r.scale]]
          : r.reason === "center"
            ? ["Đặt tâm thước trùng với đỉnh O của góc.", COLORS.muted]
            : r.reason === "outside"
              ? ["Cạnh còn lại nằm ngoài thước: hãy xoay thước nửa vòng.", COLORS.muted]
              : ["Xoay thước để một cạnh của góc đi qua vạch 0.", COLORS.muted];
    fit(ctx, guide[0], view, small ? 33 : 58, { size: small ? 12 : 15, color: guide[1], bold: r.ok || s.status === "wrong" });
  },
});
