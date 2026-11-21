import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import {
  CAP, MAX_VALUE, NAME_LEN, SCALES, PRESETS, CUSTOM, initialState, sanitize, cleanValue, cleanName,
  total, percents, angles, axis, barHeight, icons,
} from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
// one colour per category, the same in every chart
const PALETTE = [COLORS.blue, COLORS.orange, COLORS.green, COLORS.red, COLORS.purple, "#c99a06", "#13a3b5", "#d6409f"];
const CHART_CODE = { all: 0, bar: 1, pie: 2, line: 3, picto: 4 };
const MAX_ICONS = 25; // per row
let hits = []; // clickable shapes of the last draw, for the pointer

const meta = s => PRESETS[s.dataset] ?? CUSTOM;
const dim = (s, i) => s.selected >= 0 && s.selected !== i;

const reportChart = (s, api) =>
  api.emit("chart-chosen", { type: CHART_CODE[s.chart], categories: s.values.length, total: total(s.values) }, "result");

// The table is edited outside the kit's own controls, so the editor reports the change itself.
function dataChanged(s, api, key) {
  s.dataset = "custom";
  if (key === "labels") api.emit("param", { key: "labels", value: [...s.labels] }, "param");
  else api.emit("param", { key: "values", value: [...s.values] }, "param");
  api.emit("data-changed", { categories: s.values.length, total: total(s.values) }, "action");
  api.sync();
}

function fit(ctx, text, x, y, maxW, { size = 13, min = 8, ...rest } = {}) {
  let k = size;
  for (; k > min; k--) {
    ctx.font = `${rest.bold ? "600 " : ""}${k}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  ctx.font = `${rest.bold ? "600 " : ""}${k}px ${FONT}`;
  // still too wide at the smallest size: cut it short
  while (text.length > 1 && ctx.measureText(text).width > maxW) text = text.slice(0, -2) + "…";
  label(ctx, text, x, y, { size: k, ...rest });
}

function empty(ctx, R, text) {
  fit(ctx, text, R.x + R.w / 2, R.y + R.h / 2, R.w - 8, { size: 13, align: "center", color: COLORS.muted });
}

// ---------- shared axes for the bar and the line chart ----------
function axes(ctx, s, R, small) {
  const n = s.values.length;
  const { top, step } = axis(Math.max(0, ...s.values));
  const size = small ? 10 : 12;
  ctx.font = `${size}px ${FONT}`;
  const left = R.x + 6 + ctx.measureText(fmt(top, 2)).width;
  const P = { x: left + 4, y: R.y + 2 * size + 8, w: R.x + R.w - left - 8, h: R.h - (2 * size + 8) - (small ? 16 : 22) };
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let v = 0; v <= top + 1e-9; v += step) {
    const y = P.y + P.h - barHeight(v, top, P.h);
    ctx.beginPath();
    ctx.moveTo(P.x, y);
    ctx.lineTo(P.x + P.w, y);
    ctx.stroke();
    label(ctx, fmt(v, 2), P.x - 4, y, { size, align: "right", color: COLORS.muted });
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.beginPath();
  ctx.moveTo(P.x, P.y - 4);
  ctx.lineTo(P.x, P.y + P.h);
  ctx.lineTo(P.x + P.w, P.y + P.h);
  ctx.stroke();
  const slot = P.w / Math.max(1, n);
  const X = i => P.x + slot * (i + 0.5);
  const Y = v => P.y + P.h - barHeight(v, top, P.h);
  s.labels.forEach((name, i) =>
    fit(ctx, name, X(i), P.y + P.h + (small ? 8 : 11), slot - 2, { size, align: "center", bold: s.selected === i, color: dim(s, i) ? COLORS.muted : COLORS.ink })
  );
  const unit = meta(s).unit;
  if (unit && !small) label(ctx, `(${unit})`, R.x + 2, R.y + 2, { size: 11, color: COLORS.muted });
  return { P, slot, X, Y, size };
}

function drawBar(ctx, s, R, small) {
  if (!s.values.length) return empty(ctx, R, "Chưa có số liệu");
  const { P, slot, X, Y, size } = axes(ctx, s, R, small);
  const bw = Math.min(slot * 0.62, 70);
  s.values.forEach((v, i) => {
    const y = Y(v);
    ctx.globalAlpha = dim(s, i) ? 0.3 : 1;
    ctx.fillStyle = PALETTE[i];
    ctx.fillRect(X(i) - bw / 2, y, bw, P.y + P.h - y);
    ctx.globalAlpha = 1;
    if (s.selected === i) {
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(X(i) - bw / 2, y, bw, P.y + P.h - y);
    }
    label(ctx, fmt(v, 1), X(i), y - size * 0.7, { size, align: "center", bold: s.selected === i, color: dim(s, i) ? COLORS.muted : COLORS.ink });
    hits.push({ i, rect: [X(i) - slot / 2, P.y, slot, P.h + 20] });
  });
}

function drawLine(ctx, s, R, small) {
  if (!s.values.length) return empty(ctx, R, "Chưa có số liệu");
  const { slot, X, Y, size } = axes(ctx, s, R, small);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  s.values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.stroke();
  s.values.forEach((v, i) => {
    ctx.globalAlpha = dim(s, i) ? 0.35 : 1;
    ctx.fillStyle = PALETTE[i];
    ctx.beginPath();
    ctx.arc(X(i), Y(v), s.selected === i ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    label(ctx, fmt(v, 1), X(i), Y(v) - size - 2, { size, align: "center", bold: s.selected === i, color: dim(s, i) ? COLORS.muted : COLORS.ink });
    hits.push({ i, rect: [X(i) - slot / 2, R.y, slot, R.h] });
  });
}

function drawPie(ctx, s, R, small) {
  if (!s.values.length) return empty(ctx, R, "Chưa có số liệu");
  if (!(total(s.values) > 0)) return empty(ctx, R, "Tổng bằng 0: không vẽ được biểu đồ hình quạt tròn");
  const pc = percents(s.values);
  const an = angles(s.values);
  const legendW = Math.min(190, R.w * 0.48);
  const legend = R.w - legendW >= 130 && R.h >= 24 * s.values.length * 0.6;
  const area = legend ? R.w - legendW : R.w;
  const note = !small;
  const r = Math.max(10, Math.min(area / 2 - 8, (R.h - (note ? 22 : 4)) / 2 - 4));
  const cx = R.x + area / 2;
  const cy = R.y + r + 4;
  let a = -90; // from the top, clockwise, as in the textbook
  s.values.forEach((v, i) => {
    const a0 = (a * Math.PI) / 180;
    const a1 = ((a + an[i]) * Math.PI) / 180;
    a += an[i];
    if (!an[i]) return;
    const out = s.selected === i ? Math.min(8, r * 0.06) : 0; // pull the selected slice out a little
    const mid = (a0 + a1) / 2;
    const ox = cx + out * Math.cos(mid);
    const oy = cy + out * Math.sin(mid);
    ctx.globalAlpha = dim(s, i) ? 0.3 : 1;
    ctx.fillStyle = PALETTE[i];
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, r, a0, a1);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (an[i] >= (small ? 30 : 20)) {
      label(ctx, `${fmt(pc[i], 1)}%`, ox + r * 0.62 * Math.cos(mid), oy + r * 0.62 * Math.sin(mid), {
        size: Math.max(9, Math.min(14, r * 0.13)),
        align: "center",
        bold: true,
        color: "#fff",
      });
    }
    hits.push({ i, pie: { cx, cy, r, a0, a1 } });
  });
  if (legend) {
    const lh = Math.min(24, (R.h - 8) / s.values.length);
    const x = R.x + area + 4;
    let y = R.y + Math.max(lh / 2, (R.h - lh * s.values.length) / 2);
    s.values.forEach((v, i) => {
      ctx.globalAlpha = dim(s, i) ? 0.3 : 1;
      ctx.fillStyle = PALETTE[i];
      ctx.fillRect(x, y - 6, 12, 12);
      ctx.globalAlpha = 1;
      fit(ctx, `${s.labels[i]}: ${fmt(pc[i], 1)}% (${fmt(an[i], 1)}°)`, x + 17, y, legendW - 22, {
        size: 12,
        bold: s.selected === i,
        color: dim(s, i) ? COLORS.muted : COLORS.ink,
      });
      hits.push({ i, rect: [x, y - lh / 2, legendW, lh] });
      y += lh;
    });
  }
  if (note) fit(ctx, "Làm tròn đến 0,1 sao cho tổng đúng 100% và 360°", cx, R.y + R.h - 8, area - 8, { size: 11, align: "center", color: COLORS.muted });
}

function icon(ctx, kind, x, y, d) {
  const r = d / 2;
  ctx.beginPath();
  if (kind === "star") {
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.42 : r;
      ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
    }
    ctx.closePath();
  } else if (kind === "person") {
    ctx.arc(x, y - r * 0.5, r * 0.36, 0, Math.PI * 2);
    ctx.moveTo(x - r * 0.62, y + r);
    ctx.lineTo(x - r * 0.62, y + r * 0.25);
    ctx.quadraticCurveTo(x - r * 0.62, y - r * 0.05, x, y - r * 0.05);
    ctx.quadraticCurveTo(x + r * 0.62, y - r * 0.05, x + r * 0.62, y + r * 0.25);
    ctx.lineTo(x + r * 0.62, y + r);
    ctx.closePath();
  } else {
    ctx.rect(x - r * 0.7, y - r * 0.85, r * 1.4, r * 1.7);
  }
  ctx.fill();
  if (kind === "book") {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.42, y - r * 0.85);
    ctx.lineTo(x - r * 0.42, y + r * 0.85);
    ctx.stroke();
  }
}

function drawPicto(ctx, s, R, small) {
  if (!s.values.length) return empty(ctx, R, "Chưa có số liệu");
  const n = s.values.length;
  const size = small ? 10 : 12;
  const keyH = small ? 16 : 22;
  const nameW = Math.min(small ? 46 : 92, R.w * 0.28);
  const rowH = Math.min(40, (R.h - keyH) / n);
  const counts = s.values.map(v => icons(v, s.scale));
  const most = Math.min(MAX_ICONS, Math.max(1, ...counts.map(c => Math.ceil(c.count - 1e-9))));
  const iconsW = R.w - nameW - 8;
  const d = Math.max(3, Math.min(rowH * 0.8, iconsW / most));
  s.values.forEach((v, i) => {
    const y = R.y + rowH * (i + 0.5);
    const c = counts[i];
    const faded = dim(s, i);
    if (s.selected === i) {
      ctx.fillStyle = "#eef3ff";
      ctx.fillRect(R.x, y - rowH / 2, R.w, rowH);
    }
    fit(ctx, s.labels[i], R.x + 2, y, nameW - 6, { size, bold: s.selected === i, color: faded ? COLORS.muted : COLORS.ink });
    ctx.globalAlpha = faded ? 0.3 : 1;
    ctx.fillStyle = PALETTE[i];
    const shown = Math.min(c.full, MAX_ICONS);
    for (let k = 0; k < shown; k++) icon(ctx, s.icon, R.x + nameW + d * (k + 0.5), y, d * 0.9);
    if (c.part > 1e-9 && shown < MAX_ICONS) {
      // part of an icon: cut it off at the fraction
      const x0 = R.x + nameW + d * shown;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y - d, d * c.part, 2 * d);
      ctx.clip();
      icon(ctx, s.icon, x0 + d / 2, y, d * 0.9);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (c.full > MAX_ICONS) label(ctx, "…", R.x + R.w - 6, y, { size, align: "right", bold: true });
    hits.push({ i, rect: [R.x, y - rowH / 2, R.w, rowH] });
  });
  const ky = R.y + rowH * n + keyH / 2 + 2;
  ctx.fillStyle = COLORS.ink;
  icon(ctx, s.icon, R.x + 8, ky, small ? 11 : 14);
  const over = counts.some(c => c.count > MAX_ICONS);
  fit(ctx, `= ${fmt(s.scale, 0)} ${meta(s).unit}${over ? "  (quá nhiều biểu tượng: tăng giá trị mỗi biểu tượng)" : ""}`.trim(), R.x + 18, ky, R.w - 20, {
    size,
    color: over ? COLORS.red : COLORS.muted,
  });
}

const CHARTS = [
  ["bar", "Biểu đồ cột", drawBar],
  ["pie", "Biểu đồ hình quạt tròn", drawPie],
  ["line", "Biểu đồ đoạn thẳng", drawLine],
  ["picto", "Biểu đồ tranh", drawPicto],
];

// ---------- table editor (arrays in state, so a custom control) ----------
function editor(box, api) {
  const list = document.createElement("div");
  list.style.cssText = "display:flex;flex-direction:column;gap:6px";
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = "+ Thêm hạng mục";
  add.addEventListener("click", () => {
    const s = api.state;
    if (s.values.length >= CAP) return;
    s.labels.push(`Mục ${s.values.length + 1}`);
    s.values.push(1);
    s.selected = s.values.length - 1;
    dataChanged(s, api, "values");
  });
  box.append(list, add);
  let rows = [];
  const input = (type, css) => {
    const el = document.createElement("input");
    el.type = type;
    el.style.cssText = `font:inherit;font-size:14px;padding:6px 8px;border:1px solid #dfe5f0;border-radius:8px;min-width:0;${css}`;
    return el;
  };
  const build = n => {
    list.replaceChildren();
    rows = Array.from({ length: n }, (_, i) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:6px;padding:2px;border-radius:8px";
      const swatch = document.createElement("span");
      swatch.style.cssText = `flex:none;width:12px;height:12px;border-radius:3px;background:${PALETTE[i]}`;
      const name = input("text", "flex:1");
      name.maxLength = NAME_LEN;
      name.setAttribute("aria-label", `Tên hạng mục ${i + 1}`);
      const value = input("number", "width:76px;text-align:right");
      Object.assign(value, { min: 0, max: MAX_VALUE, step: "any" });
      value.setAttribute("aria-label", `Giá trị hạng mục ${i + 1}`);
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "×";
      del.setAttribute("aria-label", `Xóa hạng mục ${i + 1}`);
      del.style.cssText = "flex:none;width:34px;min-height:34px;padding:0;font-size:18px";
      const select = () => {
        api.state.selected = i;
        paint();
        api.redraw();
      };
      name.addEventListener("focus", select);
      value.addEventListener("focus", select);
      name.addEventListener("change", () => {
        const s = api.state;
        s.labels[i] = cleanName(name.value, i);
        name.value = s.labels[i];
        dataChanged(s, api, "labels");
      });
      value.addEventListener("change", () => {
        const s = api.state;
        s.values[i] = cleanValue(value.value === "" ? 0 : Number(value.value));
        value.value = s.values[i];
        dataChanged(s, api, "values");
      });
      del.addEventListener("click", () => {
        const s = api.state;
        s.labels.splice(i, 1);
        s.values.splice(i, 1);
        if (s.selected >= s.values.length || s.selected > i) s.selected--;
        dataChanged(s, api, "values");
      });
      row.append(swatch, name, value, del);
      list.append(row);
      return { row, name, value };
    });
  };
  const paint = () => rows.forEach((r, i) => (r.row.style.background = api.state.selected === i ? "#eef3ff" : ""));
  return () => {
    const s = api.state;
    if (rows.length !== s.values.length) build(s.values.length);
    rows.forEach((r, i) => {
      // never overwrite what the learner is typing
      if (document.activeElement !== r.name && r.name.value !== s.labels[i]) r.name.value = s.labels[i];
      if (document.activeElement !== r.value && r.value.value !== String(s.values[i])) r.value.value = s.values[i];
    });
    add.disabled = s.values.length >= CAP;
    paint();
  };
}

mount({
  slug: "bieu-do-thong-ke",
  version: "1.0.0",
  title: "Biểu đồ thống kê",
  hint: "Sửa bảng số liệu ở bảng bên; bấm vào một cột, hình quạt, điểm hay hàng tranh để tô đậm cùng hạng mục trên mọi biểu đồ.",
  initialState,
  sanitize,
  controls: [
    {
      type: "select",
      key: "dataset",
      label: "Bộ số liệu",
      options: [
        { value: "the-thao", label: "Môn thể thao yêu thích (lớp 6A)" },
        { value: "sach", label: "Sách quyên góp của khối 6" },
        { value: "nhiet-do", label: "Nhiệt độ trung bình theo tháng" },
        { value: "custom", label: "Số liệu tự nhập" },
      ],
      onChange(s) {
        const p = PRESETS[s.dataset];
        if (!p) return;
        Object.assign(s, { labels: [...p.labels], values: [...p.values], scale: p.scale, icon: p.icon, selected: 0 });
      },
    },
    { type: "heading", label: "Bảng số liệu (tối đa 8 hạng mục)" },
    { type: "custom", render: editor },
    {
      type: "select",
      key: "chart",
      label: "Loại biểu đồ",
      options: [
        { value: "all", label: "Cả bốn loại" },
        { value: "bar", label: "Biểu đồ cột" },
        { value: "pie", label: "Biểu đồ hình quạt tròn" },
        { value: "line", label: "Biểu đồ đoạn thẳng" },
        { value: "picto", label: "Biểu đồ tranh" },
      ],
      onCommit: reportChart,
    },
    {
      type: "select",
      key: "scale",
      label: "Mỗi biểu tượng ứng với",
      options: SCALES.map(v => ({ value: v, label: String(v) })),
      visible: s => s.chart === "picto" || s.chart === "all",
    },
    {
      type: "select",
      key: "icon",
      label: "Biểu tượng",
      options: [
        { value: "person", label: "Người" },
        { value: "book", label: "Quyển sách" },
        { value: "star", label: "Ngôi sao" },
      ],
      visible: s => s.chart === "picto" || s.chart === "all",
    },
  ],
  readouts: [
    { label: "Số hạng mục", value: s => String(s.values.length) },
    { label: "Tổng", value: s => fmt(total(s.values), 1) },
    {
      label: "Đang chọn",
      value: s => {
        const i = s.selected;
        if (i < 0 || i >= s.values.length) return "–";
        const t = total(s.values) > 0;
        return `${s.labels[i]}: ${fmt(s.values[i], 1)}${t ? ` (${fmt(percents(s.values)[i], 1)}%; ${fmt(angles(s.values)[i], 1)}°)` : ""}`;
      },
    },
  ],
  pointer: {
    down(p, s, api) {
      const hit = hits.find(h => {
        if (h.rect) {
          const [x, y, w, hh] = h.rect;
          return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + hh;
        }
        const { cx, cy, r, a0, a1 } = h.pie;
        if (Math.hypot(p.x - cx, p.y - cy) > r) return false;
        let a = Math.atan2(p.y - cy, p.x - cx);
        while (a < a0) a += 2 * Math.PI;
        return a <= a1;
      });
      const i = hit ? hit.i : -1;
      if (i === s.selected) return false;
      s.selected = i;
      if (i >= 0) api.emit("category-selected", { index: i, value: s.values[i] }, "action");
      api.sync();
      return false;
    },
  },
  draw(ctx, s, view) {
    hits = [];
    const small = view.w < 560 || view.h < 430;
    const pad = small ? 6 : 14;
    const head = small ? 20 : 34;
    fit(ctx, meta(s).title, view.w / 2, head / 2 + 2, view.w - 2 * pad, { size: small ? 13 : 16, bold: true, align: "center" });
    const shown = s.chart === "all" ? CHARTS : CHARTS.filter(c => c[0] === s.chart);
    const cols = shown.length > 1 ? 2 : 1;
    const rows = Math.ceil(shown.length / cols);
    const cw = (view.w - pad) / cols;
    const ch = (view.h - head - pad) / rows;
    const th = small ? 14 : 22; // panel title
    shown.forEach(([, name, drawChart], k) => {
      const x = pad / 2 + (k % cols) * cw + pad / 2;
      const y = head + Math.floor(k / cols) * ch;
      if (cols > 1) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(x - 2, y, cw - pad + 4, ch - pad / 2);
      }
      label(ctx, name, x + 4, y + th / 2 + 2, { size: small ? 11 : 14, bold: true, color: COLORS.muted });
      drawChart(ctx, s, { x: x + 2, y: y + th + 2, w: cw - pad - 4, h: ch - th - pad }, small || cols > 1 && view.w < 760);
    });
  },
});
