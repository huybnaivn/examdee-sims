import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { MATERIALS, initialState, heatCapacity, equilibrium, temperatures, current, heat, totalHeat, duration, start, separate, step } from "./model.js";

const NAMES = { water: "Nước", aluminium: "Nhôm", copper: "Đồng", iron: "Sắt", lead: "Chì", oil: "Dầu" };
const OPTIONS = Object.keys(MATERIALS).map(value => ({ value, label: `${NAMES[value]} (c = ${fmt(MATERIALS[value], 0)} J/kg·K)` }));
const SERIES = [COLORS.orange, COLORS.purple]; // curve and frame colour of body 1 and body 2
const SUB = ["₁", "₂"];
const deg = (t, digits = 1) => `${fmt(t, digits)} °C`;
const joule = q => `${fmt(q, 0)} J`;

// Colour of a body by its temperature: blue at 0 °C, red at 100 °C.
const tempColor = t => {
  const f = Math.min(1, Math.max(0, t / 100));
  const mix = (a, b) => Math.round(a + (b - a) * f);
  return `rgb(${mix(47, 229)}, ${mix(111, 72)}, ${mix(237, 77)})`;
};

const changed = (s, api) => {
  separate(s);
  api.pause();
};
const begin = (s, api) => {
  start(s);
  const data = { m1: s.m1, c1: MATERIALS[s.mat1], t1: s.t1, m2: s.m2, c2: MATERIALS[s.mat2], t2: s.t2 };
  api.emit("mix-start", data);
  api.sync(); // the contact button is disabled while heat is flowing
};
const bodyControls = i => [
  { type: "heading", label: `Vật ${i}` },
  { type: "select", key: `mat${i}`, label: "Chất", options: OPTIONS, onChange: changed },
  { type: "slider", key: `m${i}`, label: `Khối lượng m${SUB[i - 1]}`, min: 0.1, max: 5, step: 0.1, unit: "kg", digits: 1, onChange: changed },
  { type: "slider", key: `t${i}`, label: `Nhiệt độ ban đầu t${SUB[i - 1]}`, min: 0, max: 100, step: 1, unit: "°C", digits: 0, onChange: changed },
];

mount({
  slug: "can-bang-nhiet",
  version: "1.0.0",
  title: "Phương trình cân bằng nhiệt",
  hint: "Chọn chất, khối lượng và nhiệt độ của hai vật rồi cho chúng tiếp xúc.",
  initialState,
  step(s, dt, api) {
    if (s.done) return api.pause(); // nothing more happens until the bodies are separated or put in contact again
    if (!s.mixing) begin(s, api); // ▶ Chạy also puts the bodies in contact
    step(s, dt);
    if (!s.done) return;
    api.pause();
    api.sync();
    // One result per run.
    const data = { temperature: equilibrium(s), heat: totalHeat(s), t1: s.t1, t2: s.t2 };
    api.emit("equilibrium", data, "result");
  },
  controls: [
    {
      type: "button",
      label: "Cho hai vật tiếp xúc",
      primary: true,
      disabled: s => s.mixing,
      action(s, api) {
        begin(s, api);
        api.play();
      },
    },
    { type: "button", label: "Tách hai vật ra", visible: s => s.mixing || s.done, action: changed },
    ...bodyControls(1),
    ...bodyControls(2),
  ],
  readouts: [
    { label: "Nhiệt độ vật 1", value: s => deg(current(s).t1) },
    { label: "Nhiệt độ vật 2", value: s => deg(current(s).t2) },
    { label: "Nhiệt độ cân bằng t", value: s => deg(equilibrium(s), 2) },
    { label: "Nhiệt lượng tỏa ra", value: s => joule(heat(s).lost) },
    { label: "Nhiệt lượng thu vào", value: s => joule(heat(s).gained) },
  ],
  draw(ctx, s, view) {
    const small = view.w < 520 || view.h < 420;
    const now = current(s);
    const q = heat(s);
    const teq = equilibrium(s);
    const together = s.mixing || s.done;
    const cold = 3 - q.hot;

    // ---- status ----
    const status = s.done
      ? `Đã cân bằng nhiệt: t = ${deg(teq)}`
      : s.mixing
        ? s.t1 === s.t2
          ? "Hai vật cùng nhiệt độ: không có sự truyền nhiệt"
          : `Nhiệt truyền từ vật ${q.hot} (nóng hơn) sang vật ${cold}`
        : small
          ? "Hai vật chưa tiếp xúc"
          : "Hai vật chưa tiếp xúc (ngăn cách bởi vách cách nhiệt)";
    label(ctx, status, view.w / 2, small ? 11 : 22, { align: "center", size: small ? 13 : 18, bold: true });

    // ---- scene: two bodies in an insulated container ----
    const boxY = small ? 24 : 44;
    const boxH = small ? Math.min(88, view.h * 0.27) : Math.min(190, view.h * 0.26);
    const boxW = Math.min(view.w - (small ? 16 : 60), 560);
    const boxX = (view.w - boxW) / 2;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = small ? 3 : 5;
    ctx.beginPath();
    ctx.rect(boxX, boxY, boxW, boxH);
    ctx.fill();
    ctx.stroke();
    const inset = small ? 8 : 14;
    const gap = together ? 0 : small ? 14 : 28;
    const bw = Math.min((boxW - 2 * inset - (small ? 14 : 28)) / 2, 230);
    const bh = boxH - 2 * inset;
    const by = boxY + inset;
    const mid = view.w / 2;
    [1, 2].forEach(i => {
      const x = i === 1 ? mid - gap / 2 - bw : mid + gap / 2;
      const cx = x + bw / 2;
      const cy = by + bh / 2;
      ctx.fillStyle = tempColor(now[`t${i}`]);
      ctx.fillRect(x, by, bw, bh);
      ctx.strokeStyle = SERIES[i - 1];
      ctx.lineWidth = small ? 3 : 4;
      ctx.strokeRect(x, by, bw, bh);
      const white = { align: "center", color: "#fff" };
      const name = `Vật ${i} · ${NAMES[s[`mat${i}`]]}`;
      if (small) {
        label(ctx, name, cx, cy - 20, { ...white, size: 11, bold: true });
        label(ctx, deg(now[`t${i}`]), cx, cy, { ...white, size: 18, bold: true });
        label(ctx, `m = ${fmt(s[`m${i}`], 1)} kg`, cx, cy + 20, { ...white, size: 10 });
      } else {
        label(ctx, name, cx, cy - 44, { ...white, size: 15, bold: true });
        label(ctx, deg(now[`t${i}`]), cx, cy - 8, { ...white, size: 30, bold: true });
        label(ctx, `m${SUB[i - 1]} = ${fmt(s[`m${i}`], 1)} kg · c${SUB[i - 1]} = ${fmt(MATERIALS[s[`mat${i}`]], 0)} J/kg·K`, cx, cy + 26, { ...white, size: 12 });
        label(ctx, `m${SUB[i - 1]}c${SUB[i - 1]} = ${fmt(heatCapacity(s, i), 0)} J/K`, cx, cy + 46, { ...white, size: 12 });
      }
    });
    if (!together) {
      ctx.fillStyle = COLORS.muted;
      ctx.fillRect(mid - (small ? 2 : 3), boxY, small ? 4 : 6, boxH);
    } else if (s.mixing && s.t1 !== s.t2 && !small) {
      const dir = q.hot === 1 ? 1 : -1;
      arrow(ctx, mid - dir * 34, by + bh - 4, mid + dir * 34, by + bh - 4, COLORS.yellow, 5);
      label(ctx, "Q", mid, by + bh - 20, { align: "center", color: COLORS.yellow, bold: true, size: 15 });
    }

    // ---- heat given off and taken in; doubles as the legend of the graph ----
    const rowY = boxY + boxH + (small ? 13 : 24);
    const size = small ? 11 : 14;
    const verb = i => (s.t1 === s.t2 ? "trao đổi" : i === q.hot ? "tỏa" : "thu");
    const amount = i => joule(i === q.hot ? q.lost : q.gained);
    [1, 2].forEach(i => {
      const text = `● Vật ${i} ${verb(i)}${small ? "" : ": Q ="} ${amount(i)}`;
      label(ctx, text, i === 1 ? boxX : boxX + boxW, rowY, { align: i === 1 ? "left" : "right", size, bold: true, color: SERIES[i - 1] });
    });
    if (view.w >= 700) {
      const h = SUB[q.hot - 1];
      const c = SUB[cold - 1];
      label(ctx, `Q tỏa = Q thu ⇒ m${h}c${h}(t${h} − t) = m${c}c${c}(t − t${c})`, mid, rowY + 24, { align: "center", size: 13, color: COLORS.muted });
    }

    // ---- graph: temperature against time ----
    const gx0 = small ? 30 : 56;
    const gx1 = view.w - (small ? 14 : 40);
    const gy0 = rowY + (small ? 27 : view.w >= 700 ? 52 : 30);
    const gy1 = view.h - (small ? 30 : 52);
    const total = duration(s);
    const tMax = Math.max(total * 1.12, 3);
    const X = t => gx0 + (t / tMax) * (gx1 - gx0);
    const Y = temp => gy1 - (temp / 100) * (gy1 - gy0);
    const tick = small ? 10 : 12;
    ctx.lineWidth = 1;
    for (let temp = 0; temp <= 100; temp += 20) {
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(gx0, Y(temp));
      ctx.lineTo(gx1, Y(temp));
      ctx.stroke();
      if (!small || temp % 40 === 0 || gy1 - gy0 > 130) label(ctx, String(temp), gx0 - 6, Y(temp), { align: "right", size: tick, color: COLORS.muted });
    }
    const every = tMax > 8 ? 2 : 1;
    for (let t = 0; X(t) <= gx1 - (small ? 74 : 96); t += every) {
      label(ctx, fmt(t, 0), X(t), gy1 + 11, { align: "center", size: tick, color: COLORS.muted });
    }
    label(ctx, "thời gian (s)", gx1, gy1 + 11, { align: "right", size: tick, color: COLORS.muted });
    label(ctx, "t (°C)", gx0 + 7, gy0 - 10, { size: tick, color: COLORS.muted });
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx0, gy0 - 16);
    ctx.lineTo(gx0, gy1);
    ctx.lineTo(gx1, gy1);
    ctx.stroke();

    // equilibrium temperature from the formula
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(gx0, Y(teq));
    ctx.lineTo(gx1, Y(teq));
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, `t cân bằng = ${deg(teq)}`, gx1 - 4, Y(teq) + (teq > 85 ? 11 : -9), { align: "right", size: small ? 11 : 13, bold: true, color: COLORS.green });

    // curves up to the present moment, flat after equilibrium; before contact, a faint dashed forecast
    const shown = s.done ? total : s.mixing ? s.time : 0;
    const curve = (key, upTo) => {
      ctx.beginPath();
      ctx.moveTo(X(0), Y(s[key]));
      for (let k = 1; k <= 80 && upTo > 0; k++) ctx.lineTo(X((upTo * k) / 80), Y(temperatures(s, (upTo * k) / 80)[key]));
    };
    [1, 2].forEach(i => {
      const key = `t${i}`;
      ctx.strokeStyle = ctx.fillStyle = SERIES[i - 1];
      ctx.lineJoin = "round";
      if (!together) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        curve(key, tMax);
        ctx.stroke();
        ctx.restore();
      }
      ctx.lineWidth = 3;
      curve(key, shown);
      if (s.done) {
        ctx.lineTo(X(total), Y(teq));
        ctx.lineTo(X(tMax), Y(teq));
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(X(shown), Y(s.done ? teq : now[key]), small ? 4 : 5, 0, Math.PI * 2);
      ctx.fill();
    });
    if (!together && !small) label(ctx, "nét đứt mờ: dự đoán", gx1 - 4, gy0 + 4, { align: "right", size: 12, color: COLORS.muted });

    label(
      ctx,
      small ? "Bỏ qua hao phí nhiệt · thời gian chỉ là minh họa" : "Bỏ qua sự trao đổi nhiệt với môi trường và bình chứa, không có sự chuyển thể. Thời gian trao đổi nhiệt chỉ là minh họa.",
      mid, view.h - (small ? 8 : 16), { align: "center", size: small ? 10 : 12, color: COLORS.muted }
    );
  },
});
