import { mount, COLORS, arrow, label, clamp } from "../../kit/v1/kit.js";
import {
  MAX_Z, SUBSHELLS, FIRST_BOX, BOX_COUNT, ELEMENTS, EXCEPTIONS, initialState, subName, boxesIn, configString, shortString,
  unpaired, block, blockCode, period, valence, group, valenceSubshells, idealFill, boxOf, cycleSlot, addArrow, clearBox, checkFilling,
} from "./model.js";

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = n => String(n).split("").map(d => SUB[d]).join("");
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ERRORS = {
  count: (s, r) => `Số electron đã xếp là ${r.electrons}, cần ${s.z}.`,
  pauli: () => "Nguyên lí Pauli: hai electron trong một ô phải có chiều ngược nhau.",
  hund: () => "Quy tắc Hund: trong một phân lớp, xếp mỗi ô một electron cùng chiều trước rồi mới ghép đôi.",
  order: () => "Chưa đúng thứ tự mức năng lượng 1s 2s 2p 3s 3p 4s 3d 4p (chú ý ngoại lệ của Cr, Cu).",
};

const solved = s => s.mode === "practice" && s.checked && checkFilling(s.z, s.fill).ok;
const revealed = s => s.mode !== "practice" || solved(s);
const clearDiagram = s => {
  s.fill = initialState().fill;
  s.checked = false;
};
const cursorBox = s => clamp(Math.round(s.cursor) || 1, 1, BOX_COUNT) - 1;

const edited = (s, api, box) => {
  s.checked = false;
  api.emit("edit-orbital", { box: box + 1, electrons: boxOf(s.fill, box).replaceAll("-", "").length }, "action");
};

function check(s, api) {
  if (s.checked) return; // one result per finished diagram, not per click
  s.checked = true;
  const r = checkFilling(s.z, s.fill);
  api.emit("diagram-checked", { z: s.z, correct: r.ok ? 1 : 0, errors: r.errors.length, electrons: r.electrons }, "result");
  if (r.ok) api.emit("diagram-correct", { z: s.z }, "goal");
}

// Energy ladder: one row per subshell (lowest at the bottom), s, p and d boxes in three columns.
function geom(view) {
  const { w, h } = view;
  const small = w < 560 || h < 430;
  const head = small ? 38 : 70;
  const lw = small ? 24 : 36; // room for the "3d" label before each group of boxes
  const gap = small ? 5 : 9;
  const bw = clamp(Math.min((w - 3 * lw - 12) / 9, (h - head - 6) / 8 - gap), 12, 46);
  const rowH = bw + gap;
  const x0 = Math.max(4, (w - 3 * lw - 9 * bw) / 2);
  const top = head + Math.max(0, (h - head - 6 - 8 * rowH) / 2);
  const rowY = i => top + (7 - i) * rowH;
  const boxes = [];
  SUBSHELLS.forEach((ss, i) => {
    for (let j = 0; j < boxesIn(ss); j++) {
      boxes.push({ i, j, x: x0 + lw * (ss.l + 1) + [0, 1, 4][ss.l] * bw + j * bw, y: rowY(i), index: FIRST_BOX[i] + j });
    }
  });
  const infoX = x0 + 2 * lw + 4 * bw + (small ? 10 : 20);
  return { small, bw, x0, lw, top, rowH, rowY, boxes, info: { x: infoX, y: rowY(5) + 2, w: w - infoX - 6, bottom: h - 4 } };
}

/** Word-wrap `text` into the width; returns the y after the last line (stops at `bottom`). */
function wrap(ctx, text, x, y, maxW, opts, lineH, bottom = Infinity) {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  let line = "";
  const flush = () => {
    if (line && y <= bottom) label(ctx, line, x, y, opts);
    if (line) y += lineH;
    line = "";
  };
  for (const word of text.split(" ")) {
    if (line && ctx.measureText(`${line} ${word}`).width > maxW) flush();
    line = line ? `${line} ${word}` : word;
  }
  flush();
  return y;
}

function spin(ctx, x, y, bw, up, color) {
  const a = up ? y + bw * 0.8 : y + bw * 0.2;
  const b = up ? y + bw * 0.2 : y + bw * 0.8;
  const k = bw * 0.17 * (up ? 1 : -1);
  ctx.strokeStyle = color;
  ctx.lineWidth = bw < 22 ? 1.5 : 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, a);
  ctx.lineTo(x, b);
  ctx.moveTo(x - Math.abs(k), b + k);
  ctx.lineTo(x, b);
  ctx.lineTo(x + Math.abs(k), b + k);
  ctx.stroke();
}

const practice = s => s.mode === "practice";

mount({
  slug: "cau-hinh-electron",
  version: "1.0.0",
  title: "Cấu hình electron và ô orbital",
  hint: "Chọn nguyên tố bằng thanh Z. Mức năng lượng tăng dần từ dưới lên, vẽ cách đều (không theo tỉ lệ). Ở chế độ luyện tập, bấm nửa trái hoặc nửa phải của một ô để đặt mũi tên: ↑ → ↓ → trống.",
  initialState,
  controls: [
    {
      type: "slider",
      key: "z",
      label: "Số hiệu nguyên tử Z",
      min: 1,
      max: MAX_Z,
      step: 1,
      format: z => `${z} – ${ELEMENTS[z - 1][0]} (${ELEMENTS[z - 1][1]})`,
      onChange: clearDiagram,
      onCommit(s, api) {
        api.emit("z-committed", { z: s.z, unpaired: unpaired(s.z), block: blockCode(s.z) }, "result");
      },
    },
    {
      type: "select",
      key: "mode",
      label: "Chế độ",
      options: [
        { value: "view", label: "Xem cách điền electron" },
        { value: "practice", label: "Luyện tập: tự điền vào ô orbital" },
      ],
      onChange: clearDiagram,
    },
    { type: "heading", label: "Điền bằng bàn phím", visible: practice },
    { type: "stepper", key: "cursor", label: "Ô đang chọn", min: 1, max: BOX_COUNT, visible: practice },
    {
      type: "button",
      label: "Thêm ↑ vào ô",
      visible: practice,
      action(s, api) {
        s.fill = addArrow(s.fill, cursorBox(s), "u");
        edited(s, api, cursorBox(s));
      },
    },
    {
      type: "button",
      label: "Thêm ↓ vào ô",
      visible: practice,
      action(s, api) {
        s.fill = addArrow(s.fill, cursorBox(s), "d");
        edited(s, api, cursorBox(s));
      },
    },
    {
      type: "button",
      label: "Xoá ô đang chọn",
      visible: practice,
      action(s, api) {
        s.fill = clearBox(s.fill, cursorBox(s));
        edited(s, api, cursorBox(s));
      },
    },
    { type: "button", label: "Kiểm tra", primary: true, visible: practice, action: check },
    {
      type: "button",
      label: "Xoá hết",
      visible: practice,
      action(s, api) {
        clearDiagram(s);
        edited(s, api, cursorBox(s));
      },
    },
  ],
  readouts: [
    { label: "Cấu hình electron", value: s => (revealed(s) ? configString(s.z) : "?") },
    { label: "Số electron độc thân", value: s => (revealed(s) ? String(unpaired(s.z)) : "?") },
    { label: "Số electron hoá trị", value: s => (revealed(s) ? String(valence(s.z)) : "?") },
    { label: "Khối nguyên tố", value: s => (revealed(s) ? block(s.z) : "?") },
    { label: "Vị trí", value: s => (revealed(s) ? `ô ${s.z}, chu kì ${period(s.z)}, nhóm ${group(s.z).label}` : "?") },
  ],
  pointer: {
    down(p, s, api, view) {
      if (!practice(s)) return false;
      const g = geom(view);
      const box = g.boxes.find(b => p.x >= b.x && p.x < b.x + g.bw && p.y >= b.y - 3 && p.y < b.y + g.bw + 3);
      if (!box) return false;
      s.fill = cycleSlot(s.fill, box.index, p.x < box.x + g.bw / 2 ? 0 : 1);
      s.cursor = box.index + 1;
      edited(s, api, box.index);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const { small, bw } = g;
    const [symbol, name] = ELEMENTS[s.z - 1];
    const show = revealed(s);
    const fill = practice(s) ? s.fill : idealFill(s.z);
    const result = checkFilling(s.z, fill);
    const valenceRows = show ? valenceSubshells(s.z) : [];
    const exception = show && EXCEPTIONS[s.z];

    // header
    const config = show ? configString(s.z) : `Luyện tập: xếp ${s.z} electron vào các ô orbital rồi bấm “Kiểm tra”.`;
    if (small) {
      label(ctx, `${sub(s.z)}${symbol} (${name})${show ? ` · ${shortString(s.z)}` : ""}`, view.w / 2, 11, { size: 13, bold: true, align: "center" });
      label(ctx, show ? config : `Xếp ${s.z} electron vào các ô orbital`, view.w / 2, 27, { size: 11, align: "center", color: COLORS.muted });
    } else {
      label(ctx, `${sub(s.z)}${symbol} – ${name}${show ? `:  ${shortString(s.z)}` : ""}`, view.w / 2, 24, { size: 21, bold: true, align: "center" });
      label(ctx, show ? `Cấu hình electron: ${config}` : config, view.w / 2, 52, { size: 15, align: "center", color: COLORS.muted });
    }

    // energy axis, only when there is a margin for it
    if (g.x0 > 34) {
      arrow(ctx, g.x0 - 14, g.rowY(0) + bw, g.x0 - 14, g.rowY(7), COLORS.muted, 2);
      label(ctx, "E", g.x0 - 26, g.rowY(7) + 8, { color: COLORS.muted, bold: true, align: "center" });
    }

    // rows: label, then the boxes
    const size = small ? 11 : 14;
    SUBSHELLS.forEach((ss, i) => {
      const first = g.boxes[FIRST_BOX[i]];
      const star = exception && (i === 5 || i === 6);
      label(ctx, `${star && !small ? "★" : ""}${subName(ss)}`, first.x - 4, first.y + bw / 2, { size, align: "right", bold: true, color: star ? COLORS.orange : COLORS.ink });
    });
    for (const b of g.boxes) {
      ctx.fillStyle = valenceRows.includes(b.i) ? "#dfeaff" : "#fff";
      ctx.fillRect(b.x, b.y, bw, bw);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x, b.y, bw, bw);
      const pair = boxOf(fill, b.index);
      const clash = pair === "uu" || pair === "dd";
      [0, 1].forEach(k => {
        if (pair[k] !== "-") spin(ctx, b.x + bw * (k ? 0.68 : 0.32), b.y, bw, pair[k] === "u", practice(s) && s.checked && clash ? COLORS.red : COLORS.blue);
      });
    }
    if (practice(s)) {
      const c = g.boxes[cursorBox(s)];
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 3;
      ctx.strokeRect(c.x - 1.5, c.y - 1.5, bw + 3, bw + 3);
    }

    // facts (or feedback) in the free corner under the 3d row
    const { x, w, bottom } = g.info;
    const lineH = small ? 14 : 21;
    const opt = { size: small ? 11 : 15 };
    let y = g.info.y + lineH / 2;
    const say = (text, extra = {}) => {
      y = wrap(ctx, text, x, y, w, { ...opt, ...extra }, lineH, bottom) + (small ? 1 : 4);
    };
    if (practice(s) && !show) {
      say(`Đã xếp ${result.electrons}/${s.z} electron`, { bold: true });
      if (s.checked) for (const code of result.errors) say(`✗ ${ERRORS[code](s, result)}`, { color: COLORS.red });
      else say("Bấm nửa trái hoặc nửa phải của ô để đặt ↑, ↓.", { color: COLORS.muted });
    } else {
      if (practice(s)) say("✓ Chính xác!", { bold: true, color: COLORS.green });
      say(`Electron độc thân: ${unpaired(s.z)}`, { bold: true });
      say(`Electron hoá trị: ${valence(s.z)}`);
      say(`Khối ${block(s.z)} · chu kì ${period(s.z)} · nhóm ${group(s.z).label}`);
      if (exception) say(`★ Ngoại lệ: ${exception}.`, { color: COLORS.orange });
      say("Ô tô màu: phân lớp chứa electron hoá trị.", { color: COLORS.muted, size: small ? 10 : 12 });
    }
  },
});
