import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import { initialState, area, perimeter, CHALLENGES, check, MAX_A, MAX_B } from "./model.js";

const LABELS = {
  free: "Tự do (không có mục tiêu)",
  a24: "Diện tích 24 cm², chu vi nhỏ nhất",
  a36: "Diện tích 36 cm², chu vi nhỏ nhất",
  p20: "Chu vi 20 cm, diện tích lớn nhất",
  p22: "Chu vi 22 cm, diện tích lớn nhất",
  a12p16: "Diện tích 12 cm² và chu vi 16 cm",
};

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const top = small ? 42 : 88;
  const bottom = small ? 40 : 64;
  const padL = small ? 42 : 72;
  const padR = 14;
  const cell = Math.max(4, Math.floor(Math.min((view.w - padL - padR) / MAX_A, (view.h - top - bottom) / MAX_B, 60)));
  const x0 = Math.round(padL + (view.w - padL - padR - cell * MAX_A) / 2);
  const y1 = Math.round(top + (view.h - top - bottom - cell * MAX_B) / 2) + cell * MAX_B; // bottom edge of the grid
  return { small, cell, x0, y1 };
}

function status(s) {
  if (s.challenge === "free") return null;
  const c = CHALLENGES[s.challenge];
  const S = area(s.a, s.b);
  const P = perimeter(s.a, s.b);
  const r = check(s.challenge, s.a, s.b);
  if (!r.fixed) {
    const need = [];
    if (c.area != null && S !== c.area) need.push(`S = ${S} cm², cần ${c.area} cm²`);
    if (c.perimeter != null && P !== c.perimeter) need.push(`P = ${P} cm, cần ${c.perimeter} cm`);
    return { text: `Chưa đạt: ${need.join("; ")}`, color: COLORS.red };
  }
  if (!r.optimal) {
    const text = c.optimize === "minPerimeter" ? `S = ${S} cm² đúng, nhưng P = ${P} cm chưa nhỏ nhất` : `P = ${P} cm đúng, nhưng S = ${S} cm² chưa lớn nhất`;
    return { text, color: COLORS.orange };
  }
  const text =
    c.optimize === "minPerimeter"
      ? `Đạt! S = ${S} cm², chu vi P = ${P} cm là nhỏ nhất`
      : c.optimize === "maxArea"
        ? `Đạt! P = ${P} cm, diện tích S = ${S} cm² là lớn nhất`
        : `Đạt! S = ${S} cm² và P = ${P} cm`;
  return { text, color: COLORS.green };
}

// Report the goal once, when the rectangle starts to meet the target.
const settle = (s, api) => {
  const ok = check(s.challenge, s.a, s.b).ok;
  if (ok && !s.met) api.emit("target-met", { target: s.challenge, width: s.a, height: s.b }, "goal");
  s.met = ok;
};

const corner = (p, s, view) => {
  const g = geom(view);
  s.a = clamp(Math.ceil((p.x - g.x0) / g.cell), 1, MAX_A);
  s.b = clamp(Math.ceil((g.y1 - p.y) / g.cell), 1, MAX_B);
};

mount({
  slug: "dien-tich-chu-vi",
  version: "1.0.0",
  title: "Diện tích và chu vi hình chữ nhật",
  hint: "Kéo góc màu cam của hình chữ nhật, hoặc bấm vào một ô trên lưới. Mỗi ô vuông có cạnh 1 cm (hình không vẽ theo tỉ lệ thật).",
  initialState,
  controls: [
    { type: "stepper", key: "a", label: "Cạnh ngang a (cm)", min: 1, max: MAX_A, onChange: settle },
    { type: "stepper", key: "b", label: "Cạnh dọc b (cm)", min: 1, max: MAX_B, onChange: settle },
    { type: "checkbox", key: "showCount", label: "Đánh số các ô vuông" },
    { type: "heading", label: "Thử thách" },
    {
      type: "select",
      key: "challenge",
      label: "Mục tiêu",
      options: Object.keys(CHALLENGES).map(value => ({ value, label: LABELS[value] })),
      // A rectangle that already fits a newly chosen target is not an achievement: no goal event.
      onChange: s => {
        s.met = check(s.challenge, s.a, s.b).ok;
      },
    },
  ],
  readouts: [
    { label: "Số ô vuông đơn vị", value: s => `${area(s.a, s.b)} ô` },
    { label: "Diện tích S = a × b", value: s => `${area(s.a, s.b)} cm²` },
    { label: "Chu vi P = (a + b) × 2", value: s => `${perimeter(s.a, s.b)} cm` },
    { label: "Thử thách", value: s => (s.challenge === "free" ? "–" : check(s.challenge, s.a, s.b).ok ? "Đạt" : "Chưa đạt") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      const m = 22; // forgiving margin around the grid for fingers
      if (p.x < g.x0 - m || p.x > g.x0 + g.cell * MAX_A + m || p.y > g.y1 + m || p.y < g.y1 - g.cell * MAX_B - m) return false;
      s._a0 = s.a;
      s._b0 = s.b;
      corner(p, s, view);
      return true;
    },
    move: (p, s, api, view) => corner(p, s, view),
    up(p, s, api) {
      if (s.a === s._a0 && s.b === s._b0) return;
      api.emit("resize", { width: s.a, height: s.b, area: area(s.a, s.b), perimeter: perimeter(s.a, s.b) }, "action");
      settle(s, api);
    },
  },
  draw(ctx, s, view) {
    const { small, cell, x0, y1 } = geom(view);
    const S = area(s.a, s.b);
    const P = perimeter(s.a, s.b);
    const size = small ? 12 : 16;
    const w = s.a * cell;
    const h = s.b * cell;
    const yt = y1 - h; // top edge of the rectangle

    // formulas
    if (!small) {
      label(ctx, s.challenge === "free" ? "Tự do" : `Thử thách: ${LABELS[s.challenge]}`, view.w / 2, 22, { align: "center", size: 16, bold: true });
    }
    label(ctx, `S = a × b = ${s.a} × ${s.b} = ${S} cm²`, view.w / 2, small ? 12 : 48, { align: "center", size, color: COLORS.blue, bold: true });
    label(ctx, `P = (a + b) × 2 = (${s.a} + ${s.b}) × 2 = ${P} cm`, view.w / 2, small ? 29 : 70, { align: "center", size, color: COLORS.orange, bold: true });

    // unit grid
    ctx.fillStyle = "#fff";
    ctx.fillRect(x0, y1 - cell * MAX_B, cell * MAX_A, cell * MAX_B);
    ctx.fillStyle = "rgba(47, 111, 237, 0.2)";
    ctx.fillRect(x0, yt, w, h);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= MAX_A; i++) {
      ctx.moveTo(x0 + i * cell + 0.5, y1 - cell * MAX_B);
      ctx.lineTo(x0 + i * cell + 0.5, y1);
    }
    for (let j = 0; j <= MAX_B; j++) {
      ctx.moveTo(x0, y1 - j * cell + 0.5);
      ctx.lineTo(x0 + cell * MAX_A, y1 - j * cell + 0.5);
    }
    ctx.stroke();

    // unit squares of the rectangle, counted row by row
    ctx.strokeStyle = "rgba(47, 111, 237, 0.55)";
    ctx.beginPath();
    for (let i = 1; i < s.a; i++) {
      ctx.moveTo(x0 + i * cell + 0.5, yt);
      ctx.lineTo(x0 + i * cell + 0.5, y1);
    }
    for (let j = 1; j < s.b; j++) {
      ctx.moveTo(x0, y1 - j * cell + 0.5);
      ctx.lineTo(x0 + w, y1 - j * cell + 0.5);
    }
    ctx.stroke();
    if (s.showCount && cell >= 16) {
      const fs = clamp(Math.round(cell * 0.4), 8, 15);
      for (let row = 0; row < s.b; row++) {
        for (let col = 0; col < s.a; col++) {
          label(ctx, String(row * s.a + col + 1), x0 + (col + 0.5) * cell, yt + (row + 0.5) * cell, { align: "center", size: fs, color: COLORS.blue });
        }
      }
    }

    // perimeter and the drag handle
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 3;
    ctx.strokeRect(x0, yt, w, h);
    ctx.fillStyle = COLORS.orange;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x0 + w, yt, small ? 7 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // side lengths
    const unit = small ? "" : " cm";
    label(ctx, `a = ${s.a}${unit}`, x0 + w / 2, y1 + (small ? 11 : 15), { align: "center", size: small ? 12 : 15, bold: true });
    label(ctx, `b = ${s.b}${unit}`, x0 - 7, yt + h / 2, { align: "right", size: small ? 12 : 15, bold: true });

    const st = status(s);
    if (st) label(ctx, st.text, view.w / 2, view.h - (small ? 10 : 16), { align: "center", size: small ? 12 : 16, bold: true, color: st.color });
    else if (!small) label(ctx, "Chọn một thử thách ở bảng điều khiển", view.w / 2, view.h - 16, { align: "center", size: 14, color: COLORS.muted });
  },
});
