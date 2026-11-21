// Statistical charts of a small table: bar, pie, line and pictograph (grades 6–8).

export const CAP = 8; // categories
export const MAX_VALUE = 1000;
export const NAME_LEN = 20;
export const SCALES = [1, 2, 5, 10, 20, 50, 100];

export const PRESETS = {
  "the-thao": {
    title: "Môn thể thao yêu thích của học sinh lớp 6A",
    unit: "học sinh",
    labels: ["Bóng đá", "Cầu lông", "Bơi lội", "Cờ vua", "Bóng rổ"],
    values: [12, 8, 6, 4, 5],
    scale: 2,
    icon: "person",
  },
  sach: {
    title: "Số sách quyên góp của các lớp khối 6",
    unit: "quyển",
    labels: ["6A", "6B", "6C", "6D"],
    values: [40, 25, 35, 50],
    scale: 10,
    icon: "book",
  },
  "nhiet-do": {
    title: "Nhiệt độ trung bình các tháng đầu năm (°C)",
    unit: "°C",
    labels: ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6"],
    values: [17, 18, 21, 25, 28, 29],
    scale: 5,
    icon: "star",
  },
};
export const CUSTOM = { title: "Số liệu của em", unit: "" };

export const initialState = () => {
  const p = PRESETS["the-thao"];
  return { dataset: "the-thao", labels: [...p.labels], values: [...p.values], chart: "all", scale: p.scale, icon: p.icon, selected: -1 };
};

export const cleanValue = v => (Number.isFinite(v) ? Math.min(MAX_VALUE, Math.max(0, Math.round(v * 10) / 10)) : 0);
export const cleanName = (t, i) => String(t ?? "").trim().slice(0, NAME_LEN) || `Mục ${i + 1}`;

/** Validate state from the host: arrays of at most CAP names and values, everything else by type. */
export function sanitize(incoming, base) {
  const out = {};
  for (const key of ["dataset", "chart", "icon", "scale"]) {
    if (typeof incoming[key] === typeof base[key] && (typeof base[key] !== "number" || Number.isFinite(incoming[key]))) out[key] = incoming[key];
  }
  if (Array.isArray(incoming.values)) {
    const values = incoming.values.slice(0, CAP).map(v => cleanValue(typeof v === "number" ? v : NaN));
    const names = Array.isArray(incoming.labels) ? incoming.labels : [];
    out.values = values;
    out.labels = values.map((_, i) => cleanName(typeof names[i] === "string" ? names[i] : "", i));
  }
  const n = (out.values ?? base.values).length;
  const sel = incoming.selected;
  out.selected = Number.isInteger(sel) && sel >= -1 && sel < n ? sel : Math.min(base.selected, n - 1);
  // a table that is no longer the preset must not carry the preset's name
  const p = PRESETS[out.dataset ?? base.dataset];
  if (!p || String(p.values) !== String(out.values ?? base.values) || String(p.labels) !== String(out.labels ?? base.labels)) out.dataset = "custom";
  return out;
}

export const total = values => values.reduce((a, b) => a + b, 0);

/** Integers proportional to `weights` adding up to exactly `units` (largest remainder method). */
export function largestRemainder(weights, units) {
  const sum = total(weights);
  if (!(sum > 0)) return weights.map(() => 0);
  const exact = weights.map(w => (w / sum) * units);
  const out = exact.map(Math.floor);
  let left = units - total(out);
  const order = exact.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k++, left--) out[order[k][1]]++;
  return out;
}

/** Percentages to one decimal place that add up to exactly 100 (all 0 when the total is 0). */
export const percents = values => largestRemainder(values, 1000).map(t => t / 10);
/** Central angles of the pie in degrees, to one decimal place, adding up to exactly 360. */
export const angles = values => largestRemainder(values, 3600).map(t => t / 10);

/** Axis for bar and line charts: tick step 1, 2 or 5 × 10ᵏ, at most 8 steps, top ≥ the largest value. */
export function axis(max) {
  if (!(max > 0)) return { top: 5, step: 1 };
  const raw = max / 8;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = Number(([1, 2, 5, 10].map(k => k * p).find(s => s >= raw)).toPrecision(6));
  return { top: Number((Math.ceil(max / step - 1e-9) * step).toPrecision(12)), step };
}

/** Height of a bar (or of a point on the line chart) above the axis, H being the height of `top`. */
export const barHeight = (value, top, H) => (top > 0 ? (value / top) * H : 0);

/** Pictograph: how many icons a value needs when each icon stands for `scale` units. */
export function icons(value, scale) {
  const count = scale > 0 ? value / scale : 0;
  const full = Math.floor(count + 1e-9);
  return { count, full, part: Math.max(0, count - full) };
}
