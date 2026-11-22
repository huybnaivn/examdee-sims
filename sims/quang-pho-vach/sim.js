import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import {
  initialState, ELEMENTS, SOURCES, VISIBLE, element, linesOf, emission, absorptionLines, coincide, identify,
  wavelengthToRgb, unknownElement, check, nextUnknown,
} from "./model.js";

const FORM = { H: "Khí hiđrô", Na: "Hơi natri", Hg: "Hơi thủy ngân", He: "Khí heli", Ne: "Khí neon" };
const gasLabel = id => `${FORM[id]} (${id})`;
const gasOptions = ELEMENTS.map(e => ({ value: e.id, label: gasLabel(e.id) }));
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const rgb = nm => `rgb(${wavelengthToRgb(nm).join(",")})`;

// `solved` can be forged by a saved state: it only counts while the guess really is the unknown gas.
const isSolved = s => s.solved === true && identify(unknownElement(s).lines) === s.guess;

// One result per chosen source (emission) or gas (absorption).
const report = (s, api) => {
  if (s.mode === "unknown") return;
  const id = s.mode === "emission" ? s.source : s.gas;
  const absorption = s.mode === "absorption" ? 1 : 0;
  const data = { source: SOURCES.indexOf(id), lines: linesOf(id).length, continuous: absorption || id === "lamp" ? 1 : 0, absorption };
  api.emit("spectrum-shown", data, "result");
};

// What is on screen: a title, one or two spectra, a message.
function scene(s) {
  if (s.mode === "absorption") {
    const name = element(s.gas).name;
    return {
      title: `Quang phổ vạch hấp thụ của ${name}`,
      strips: [
        { caption: `Ánh sáng trắng đi qua ${FORM[s.gas].toLowerCase()} nguội hơn: quang phổ vạch hấp thụ`, continuous: true, dark: absorptionLines(s.gas) },
        { caption: `Quang phổ vạch phát xạ của ${name} (để so sánh)`, bright: linesOf(s.gas) },
      ],
      message: "Vạch tối nằm đúng vị trí vạch sáng của chính khí đó. Khí phải có nhiệt độ thấp hơn nguồn sáng trắng.",
    };
  }
  if (s.mode === "unknown") {
    const target = unknownElement(s);
    const solved = isSolved(s);
    const ref = element(s.guess);
    const matched = coincide(target.lines, ref.lines);
    return {
      title: "Nhận biết khí chưa biết",
      strips: [
        { caption: solved ? `Khí chưa biết: ${target.name} (${target.id})` : "Quang phổ vạch phát xạ của khí chưa biết", bright: target.lines },
        { caption: `Mẫu so sánh: ${ref.name} (${ref.id})`, bright: ref.lines },
      ],
      message: solved
        ? `Đúng! Cả ${target.lines.length} vạch trùng nhau: khí chưa biết là ${target.name}.`
        : s.checked
          ? `Chưa đúng: chỉ ${matched}/${target.lines.length} vạch trùng với ${ref.name}. Hãy đổi mẫu so sánh.`
          : "So sánh vị trí các vạch, đổi mẫu cho đến khi trùng khớp rồi bấm Kiểm tra.",
      good: solved,
      bad: s.checked && !solved,
    };
  }
  const e = emission(s.source);
  if (e.continuous) {
    return {
      title: "Quang phổ liên tục của đèn sợi đốt",
      strips: [{ caption: "Dây tóc nóng sáng: quang phổ liên tục", continuous: true }],
      message: "Vật rắn nóng sáng phát ra quang phổ liên tục: một dải màu liền nhau từ đỏ đến tím.",
    };
  }
  return {
    title: `Quang phổ vạch phát xạ của ${element(s.source).name}`,
    strips: [{ caption: `${FORM[s.source]} loãng nóng sáng: quang phổ vạch phát xạ`, bright: e.lines }],
    message: "Mỗi nguyên tố có quang phổ vạch riêng: số vạch, vị trí và màu các vạch đặc trưng cho nguyên tố đó.",
  };
}

// Draw `text` centred on at most `max` lines; returns the y after the last line.
function wrapped(ctx, text, cx, y, width, { size, color, bold, max = 2 }) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const lines = [""];
  for (const word of text.split(" ")) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (ctx.measureText(next).width <= width || !lines.at(-1)) lines[lines.length - 1] = next;
    else lines.push(word);
  }
  lines.slice(0, max).forEach((line, i) => label(ctx, line, cx, y + size * 0.7 + i * (size + 4), { size, color, bold, align: "center" }));
  return y + Math.min(lines.length, max) * (size + 4);
}

function drawStrip(ctx, x, y, w, h, strip) {
  const X = nm => x + ((nm - VISIBLE[0]) / (VISIBLE[1] - VISIBLE[0])) * w;
  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, w, h);
  if (strip.continuous) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    for (let nm = VISIBLE[0]; nm <= VISIBLE[1]; nm += 10) g.addColorStop((nm - VISIBLE[0]) / (VISIBLE[1] - VISIBLE[0]), rgb(nm));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  const lw = w < 420 ? 2 : 3;
  for (const nm of strip.bright ?? []) {
    ctx.fillStyle = rgb(nm);
    ctx.fillRect(X(nm) - lw / 2, y, lw, h);
  }
  ctx.fillStyle = "#000";
  for (const nm of strip.dark ?? []) ctx.fillRect(X(nm) - lw / 2, y, lw, h);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  return X;
}

// Wavelengths written vertically under their lines; a label that would overlap the last one moves right.
function drawLineLabels(ctx, lines, X, y, size) {
  let prev = -Infinity;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  for (const nm of lines) {
    const lx = Math.max(X(nm), prev + size + 2);
    prev = lx;
    ctx.beginPath();
    ctx.moveTo(X(nm), y);
    ctx.lineTo(lx, y + 6);
    ctx.stroke();
    ctx.save();
    ctx.translate(lx, y + 8);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = COLORS.ink;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(nm.toFixed(1).replace(".", ","), 0, 0);
    ctx.restore();
  }
}

// Principle of the prism spectroscope. Not to scale.
function drawSetup(ctx, s, x, y, w, h) {
  const yc = y + h * 0.42;
  const at = f => x + w * f;
  const ly = y + h - 8;
  const lamp = s.mode !== "emission" || s.source === "lamp";
  const sourceName = s.mode === "absorption" ? "Đèn sợi đốt" : s.mode === "unknown" ? "Khí chưa biết" : lamp ? "Đèn sợi đốt" : FORM[s.source];
  // beam
  ctx.strokeStyle = "#f2c94c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(at(0.07), yc);
  ctx.lineTo(at(0.66), yc);
  ctx.stroke();
  // source: a bulb for the lamp, a discharge tube for a gas
  ctx.fillStyle = "#ffe08a";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (s.mode === "emission" && !lamp) ctx.roundRect(at(0.05) - 7, yc - 22, 14, 44, 7);
  else if (s.mode === "unknown") ctx.roundRect(at(0.05) - 7, yc - 22, 14, 44, 7);
  else ctx.arc(at(0.05), yc, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, sourceName, at(0.05), ly, { size: 12, align: "center", color: COLORS.muted });
  // cool gas cell
  if (s.mode === "absorption") {
    ctx.fillStyle = "rgba(47, 111, 237, 0.18)";
    ctx.strokeStyle = COLORS.blue;
    ctx.beginPath();
    ctx.roundRect(at(0.2) - 26, yc - 20, 52, 40, 6);
    ctx.fill();
    ctx.stroke();
    label(ctx, `${FORM[s.gas]} nguội hơn`, at(0.2), ly, { size: 12, align: "center", color: COLORS.blue });
  }
  // collimator: a tube with a slit
  ctx.strokeStyle = COLORS.ink;
  ctx.fillStyle = "rgba(31, 42, 68, 0.08)";
  ctx.fillRect(at(0.36), yc - 15, w * 0.16, 30);
  ctx.strokeRect(at(0.36), yc - 15, w * 0.16, 30);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(at(0.36), yc - 15);
  ctx.lineTo(at(0.36), yc - 3);
  ctx.moveTo(at(0.36), yc + 3);
  ctx.lineTo(at(0.36), yc + 15);
  ctx.stroke();
  label(ctx, "Ống chuẩn trực", at(0.44), ly, { size: 12, align: "center", color: COLORS.muted });
  // dispersed rays, then the prism over them
  const px = at(0.66);
  const sx = at(0.93);
  const spread = h * 0.3;
  [[700, 0.15], [620, 0.38], [560, 0.6], [490, 0.8], [420, 1]].forEach(([nm, f]) => {
    ctx.strokeStyle = rgb(nm);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, yc);
    ctx.lineTo(sx, yc - spread * 0.4 + spread * 1.3 * f);
    ctx.stroke();
  });
  ctx.fillStyle = "#dfeaff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, yc - 26);
  ctx.lineTo(px + 24, yc + 18);
  ctx.lineTo(px - 24, yc + 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  label(ctx, "Lăng kính", px, ly, { size: 12, align: "center", color: COLORS.muted });
  // dark chamber screen
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(sx, yc - spread * 0.6, 5, spread * 1.8);
  label(ctx, "Buồng tối", sx, ly, { size: 12, align: "center", color: COLORS.muted });
}

mount({
  slug: "quang-pho-vach",
  version: "1.0.0",
  title: "Quang phổ liên tục, quang phổ vạch phát xạ và hấp thụ",
  hint: "Chọn nguồn sáng để xem quang phổ, rồi nhận biết một chất khí bằng cách so sánh vị trí các vạch.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Thí nghiệm",
      options: [
        { value: "emission", label: "Quang phổ phát xạ của nguồn sáng" },
        { value: "absorption", label: "Quang phổ vạch hấp thụ" },
        { value: "unknown", label: "Nhận biết khí chưa biết" },
      ],
      onCommit: report,
    },
    {
      type: "select",
      key: "source",
      label: "Nguồn sáng",
      options: [{ value: "lamp", label: "Đèn sợi đốt (vật rắn nóng sáng)" }, ...gasOptions],
      visible: s => s.mode === "emission",
      onCommit: report,
    },
    { type: "select", key: "gas", label: "Khí đặt trước đèn sợi đốt", options: gasOptions, visible: s => s.mode === "absorption", onCommit: report },
    {
      type: "select",
      key: "guess",
      label: "Mẫu so sánh",
      options: gasOptions,
      visible: s => s.mode === "unknown",
      disabled: isSolved,
      onChange: s => {
        s.checked = false;
        s.solved = false;
      },
    },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: s => s.mode === "unknown",
      disabled: isSolved,
      action(s, api) {
        const out = check(s);
        const data = { correct: out.correct ? 1 : 0, matched: out.matched, total: out.total, tries: s.tries };
        api.emit("guess-checked", data, "result");
        if (out.correct) api.emit("gas-identified", { gas: SOURCES.indexOf(s.guess), tries: s.tries }, "goal");
      },
    },
    { type: "button", label: "Khí chưa biết khác", visible: s => s.mode === "unknown", action: s => void nextUnknown(s), event: "next-unknown" },
    { type: "checkbox", key: "showLabels", label: "Hiện bước sóng các vạch (nm)" },
  ],
  readouts: [
    {
      label: "Loại quang phổ",
      value: s => (s.mode === "absorption" ? "vạch hấp thụ" : s.mode === "emission" && s.source === "lamp" ? "liên tục" : "vạch phát xạ"),
    },
    {
      label: "Số vạch trong vùng nhìn thấy",
      value: s => {
        if (s.mode === "emission" && s.source === "lamp") return "0";
        return String((s.mode === "unknown" ? unknownElement(s).lines : linesOf(s.mode === "emission" ? s.source : s.gas)).length);
      },
    },
    {
      label: "Vạch trùng với mẫu so sánh",
      value: s => (s.mode === "unknown" && s.checked ? `${coincide(unknownElement(s).lines, linesOf(s.guess))}/${unknownElement(s).lines.length}` : "–"),
    },
  ],
  draw(ctx, s, view) {
    const sc = scene(s);
    const small = view.w < 480 || view.h < 400;
    const pad = small ? 16 : 32;
    const x = pad;
    const w = view.w - 2 * pad;
    const size = small ? 11 : 13;
    const n = sc.strips.length;
    const capH = size + 8;
    const labelH = small ? 40 : 48;
    const axisH = 30;
    const textH = 4 * (size + 4) + 6;
    const titleH = small ? 22 : 34;
    const setupH = view.w >= 520 && view.h >= 470 ? clamp(view.h * 0.26, 100, 220) : 0;
    const free = view.h - titleH - setupH - axisH - textH - n * capH - 8;
    // wavelength labels under every strip if they fit, else only under the first one
    const rows = !s.showLabels ? 0 : (free - n * labelH) / n >= 26 ? n : 1;
    const stripH = clamp((free - rows * labelH - (n - rows) * 8) / n, 18, n === 1 ? 170 : 110);
    const total = titleH + setupH + n * (capH + stripH) + rows * labelH + (n - rows) * 8 + axisH + textH;
    const top = Math.max(0, (view.h - total) / 2);

    label(ctx, sc.title, view.w / 2, top + titleH / 2 + 2, { size: small ? 13 : 17, bold: true, align: "center" });
    let y = top + titleH;
    if (setupH) {
      drawSetup(ctx, s, x, y, w, setupH - 10);
      label(ctx, "Sơ đồ nguyên lí máy quang phổ lăng kính (không theo tỉ lệ)", view.w / 2, y + 4, { size: 11, align: "center", color: COLORS.muted });
      y += setupH;
    }
    let X = null;
    sc.strips.forEach((strip, i) => {
      label(ctx, strip.caption, x, y + capH / 2, { size, color: COLORS.ink, bold: true });
      y += capH;
      X = drawStrip(ctx, x, y, w, stripH, strip);
      y += stripH;
      if (i < rows) drawLineLabels(ctx, strip.bright ?? strip.dark ?? [], X, y, small ? 10 : 11);
      y += i < rows ? labelH : 8;
    });
    // wavelength axis
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    for (let nm = 400; nm <= 750; nm += 50) {
      ctx.moveTo(X(nm), y);
      ctx.lineTo(X(nm), y + 5);
    }
    ctx.stroke();
    for (let nm = 400; nm <= 700; nm += small ? 100 : 50) label(ctx, String(nm), X(nm), y + 14, { size: 11, align: "center", color: COLORS.muted });
    label(ctx, "λ (nm)", x + w, y + 14, { size: 11, align: "right", color: COLORS.muted });
    y += axisH - 4;
    y = wrapped(ctx, sc.message, view.w / 2, y, w, { size, bold: true, color: sc.good ? COLORS.green : sc.bad ? COLORS.red : COLORS.ink });
    wrapped(ctx, "Chỉ vẽ các vạch sáng nhất trong vùng nhìn thấy; màu trên màn hình chỉ gần đúng.", view.w / 2, y + 2, w, { size: size - 1, color: COLORS.muted });
  },
});
