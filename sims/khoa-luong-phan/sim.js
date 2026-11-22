import { mount, COLORS, label } from "../../kit/v1/kit.js";
import {
  ORGANISMS, FEATURES, PRESET, initialState, analyze, feature, has,
  progress, answer, choose, nextOrganism, found, addQuestion, undo,
} from "./model.js";

const FONT = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const YES = COLORS.green;
const NO = COLORS.red;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, maxW, size, bold) {
  ctx.font = FONT(size, bold);
  const lines = [""];
  for (const word of text.split(" ")) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (ctx.measureText(next).width > maxW && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  return lines;
}

const isFollow = s => s.mode !== "build";
const activeKey = s => (isFollow(s) ? PRESET : s.key);
const list = group => group.map(i => ORGANISMS[i].name).join(", ");

function banner(s, a, p) {
  if (isFollow(s)) {
    const name = ORGANISMS[p.organism].name;
    if (p.identified) {
      const all = found(s).every(Boolean) ? " Em đã định danh được cả 8 con vật." : " Hãy chọn con vật tiếp theo.";
      const wrong = s.mistakes > 0 ? `, trả lời sai ${s.mistakes} lần` : "";
      return { text: `✓ Đã định danh được ${name} sau ${p.steps} câu hỏi${wrong}.${all}`, color: COLORS.green };
    }
    const q = feature(p.feature).question;
    if (s.lastWrong) return { text: `Chưa đúng. Hãy nghĩ lại về ${name}: ${q}`, color: COLORS.red };
    return { text: `${name} – câu hỏi ${p.done + 1}: ${q}`, color: COLORS.ink };
  }
  if (a.flagged.length) {
    const node = a.nodes.find(n => n.path === a.flagged[0]);
    return { text: `Câu hỏi “${feature(node.feature).label}?” (viền đỏ) không tách được nhóm: mọi con vật trong nhóm đều trả lời giống nhau. Hãy hoàn tác và chọn đặc điểm khác.`, color: COLORS.red };
  }
  if (a.valid) {
    return { text: `✓ Khóa hợp lệ: ${a.nodes.length} câu hỏi đưa mỗi con vật về một nhánh riêng; cần nhiều nhất ${a.depth} câu hỏi để định danh một con vật.`, color: COLORS.green };
  }
  return { text: `Nhóm cần tách (viền cam): ${list(a.next.group)}. Chọn một đặc điểm mà chỉ một số con vật trong nhóm có.`, color: COLORS.ink };
}

/** Horizontal slot of every node: leaves take one slot per organism, a question sits midway between its branches. */
function layout(a) {
  const questions = new Set(a.nodes.map(n => n.path));
  const leaves = new Map(a.leaves.map(leaf => [leaf.path, leaf]));
  const pos = new Map();
  let slots = 0;
  const place = path => {
    let x;
    if (questions.has(path)) x = (place(path + "y") + place(path + "n")) / 2;
    else {
      const weight = Math.max(1, leaves.get(path).group.length);
      x = slots + weight / 2;
      slots += weight;
    }
    pos.set(path, x);
    return x;
  };
  place("");
  return { pos, slots };
}

function drawTree(ctx, s, a, p, box, small) {
  const { pos, slots } = layout(a);
  const follow = isFollow(s);
  const done = found(s);
  const fs = small ? 10 : 13;
  const iconSize = small ? 17 : 26;
  const nodeH = small ? 17 : 26;
  const leafH = iconSize + fs + (small ? 6 : 12);
  const levels = Math.max(0, ...a.leaves.map(leaf => leaf.path.length));
  const rowH = Math.min(small ? 46 : 84, (box.h - leafH - nodeH / 2) / Math.max(1, levels));
  const slotW = box.w / slots;
  const top = box.y + Math.max(0, (box.h - leafH - nodeH / 2 - rowH * levels) / 2) + nodeH / 2;
  const X = path => box.x + pos.get(path) * slotW;
  const Y = path => top + path.length * rowH;
  const visited = path => follow && p.full.path.slice(0, p.done).startsWith(path);

  // branches
  for (const node of a.nodes) {
    for (const side of ["y", "n"]) {
      const child = node.path + side;
      const on = visited(child);
      const [x1, y1, x2, y2] = [X(node.path), Y(node.path) + nodeH / 2, X(child), Y(child) - (a.nodes.some(n => n.path === child) ? nodeH / 2 : 2)];
      ctx.strokeStyle = side === "y" ? YES : NO;
      ctx.globalAlpha = on || !follow ? 1 : 0.55;
      ctx.lineWidth = on ? 4 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (rowH >= 30) {
        const text = side === "y" ? "có" : "không";
        const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
        ctx.font = FONT(fs - 1, true);
        const tw = ctx.measureText(text).width + 4;
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(mx - tw / 2, my - fs / 2 - 1, tw, fs + 2);
        label(ctx, text, mx, my, { size: fs - 1, bold: true, align: "center", color: side === "y" ? YES : NO });
      }
    }
  }

  // questions
  for (const node of a.nodes) {
    const text = `${feature(node.feature).label}?`;
    const current = follow && !p.identified && node.path === p.full.path.slice(0, p.done);
    const flagged = a.flagged.includes(node.path);
    ctx.font = FONT(fs, true);
    const w = ctx.measureText(text).width + (small ? 8 : 16);
    const [x, y] = [X(node.path), Y(node.path)];
    roundRect(ctx, x - w / 2, y - nodeH / 2, w, nodeH, nodeH / 2);
    ctx.fillStyle = flagged ? "#fdecec" : current ? "#fff1b8" : "#fff";
    ctx.fill();
    ctx.strokeStyle = flagged ? COLORS.red : current ? COLORS.orange : COLORS.ink;
    ctx.lineWidth = flagged || current ? 2.5 : 1.2;
    ctx.stroke();
    label(ctx, text, x, y + 0.5, { size: fs, bold: true, align: "center", color: flagged ? COLORS.red : COLORS.ink });
  }

  // ends of the key
  for (const leaf of a.leaves) {
    const n = leaf.group.length;
    const [x, y] = [X(leaf.path), Y(leaf.path)];
    if (n === 0) {
      label(ctx, "∅", x, y + iconSize / 2, { size: iconSize * 0.8, align: "center", color: COLORS.muted });
      label(ctx, "trống", x, y + iconSize + fs / 2 + 2, { size: fs - 1, align: "center", color: COLORS.muted });
      continue;
    }
    const w = Math.max(1, n) * slotW - 4;
    const here = follow && n === 1 && leaf.group[0] === p.organism && p.identified;
    const target = !follow && leaf === a.next;
    if (n > 1 || here) {
      roundRect(ctx, x - w / 2, y, w, leafH, 8);
      ctx.fillStyle = here ? "#dff5ea" : target ? "#fff4e5" : "#fff";
      ctx.fill();
      ctx.strokeStyle = here ? COLORS.green : target ? COLORS.orange : COLORS.muted;
      ctx.lineWidth = here || target ? 2.5 : 1;
      ctx.setLineDash(here || target ? [] : [4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    leaf.group.forEach((i, k) => {
      const cx = x + (k - (n - 1) / 2) * slotW;
      label(ctx, ORGANISMS[i].icon, cx, y + iconSize / 2 + 3, { size: iconSize, align: "center" });
      const name = ORGANISMS[i].name;
      ctx.font = FONT(fs - 1);
      const size = Math.min(fs - 1, ((fs - 1) * (slotW - 3)) / ctx.measureText(name).width);
      label(ctx, name, cx, y + iconSize + fs / 2 + 5, { size, align: "center", color: follow && done[i] ? COLORS.green : COLORS.ink, bold: follow && done[i] });
      if (follow && done[i]) label(ctx, "✓", cx + iconSize * 0.6, y + 6, { size: fs, bold: true, color: COLORS.green, align: "center" });
    });
  }
}

function drawTable(ctx, s, a, p, box, small) {
  const follow = isFollow(s);
  const fs = small ? 10 : 13;
  const nameW = small ? 76 : 150;
  const colW = (box.w - nameW) / FEATURES.length;
  const rowH = Math.min(small ? 26 : 40, box.h / (ORGANISMS.length + 1.6));
  const headH = rowH * 1.6;
  const rows = follow ? [p.organism] : (a.next?.group ?? []);
  const column = follow ? (p.identified ? null : p.feature) : s.feature;
  const h = headH + rowH * ORGANISMS.length;
  const y0 = box.y + Math.max(0, (box.h - h) / 2);
  ctx.fillStyle = "#fff";
  ctx.fillRect(box.x, y0, box.w, h);
  // highlighted rows and column
  ctx.fillStyle = follow ? "#e4edff" : "#fff4e5";
  for (const i of rows) ctx.fillRect(box.x, y0 + headH + i * rowH, box.w, rowH);
  const c = FEATURES.findIndex(f => f.id === column);
  if (c >= 0) {
    ctx.fillStyle = "rgba(245, 197, 24, 0.28)";
    ctx.fillRect(box.x + nameW + c * colW, y0, colW, h);
  }
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x, y0, box.w, h);
  ctx.beginPath();
  ORGANISMS.forEach((_, i) => {
    ctx.moveTo(box.x, y0 + headH + i * rowH);
    ctx.lineTo(box.x + box.w, y0 + headH + i * rowH);
  });
  ctx.stroke();
  FEATURES.forEach((f, k) => {
    const cx = box.x + nameW + (k + 0.5) * colW;
    const words = f.label.split(" ");
    const lines = words.length > 1 && small ? [words[0], words.slice(1).join(" ")] : [f.label];
    lines.forEach((line, j) => label(ctx, line, cx, y0 + headH / 2 + (j - (lines.length - 1) / 2) * (fs + 2), { size: fs, bold: true, align: "center" }));
    ORGANISMS.forEach((_, i) => {
      const yes = has(f.id, i);
      label(ctx, yes ? "✓" : "–", cx, y0 + headH + (i + 0.5) * rowH, { size: fs + 3, bold: yes, align: "center", color: yes ? COLORS.green : COLORS.muted });
    });
  });
  label(ctx, "Con vật", box.x + 6, y0 + headH / 2, { size: fs, bold: true, color: COLORS.muted });
  ORGANISMS.forEach((o, i) => {
    const cy = y0 + headH + (i + 0.5) * rowH;
    label(ctx, o.icon, box.x + 5, cy + 1, { size: Math.min(rowH - 6, small ? 15 : 22) });
    label(ctx, o.name, box.x + (small ? 26 : 38), cy, { size: fs, bold: rows.includes(i) });
  });
}

function reply(s, api, yes) {
  const r = answer(s, yes);
  if (!r) return;
  api.emit("answer", { organism: r.organism + 1, question: r.question, yes: yes ? 1 : 0, correct: r.correct ? 1 : 0 });
  if (r.identified) api.emit("identified", { organism: r.organism + 1, steps: r.steps, mistakes: r.mistakes }, "result");
}

const asking = s => isFollow(s) && !progress(s).identified;
const building = s => !isFollow(s);
const keyStatus = a => (a.valid ? "hợp lệ ✓" : a.flagged.length ? "có câu hỏi không tách nhóm" : "chưa tách hết các con vật");

mount({
  slug: "khoa-luong-phan",
  version: "1.0.0",
  title: "Khóa lưỡng phân phân loại sinh vật",
  hint: "Trả lời Có hoặc Không theo đặc điểm của con vật để đi dọc khóa lưỡng phân. Sau đó thử tự xây dựng khóa của em.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Chế độ",
      options: [
        { value: "follow", label: "Dùng khóa có sẵn để định danh" },
        { value: "build", label: "Tự xây dựng khóa lưỡng phân" },
      ],
    },
    {
      type: "select",
      key: "organism",
      label: "Con vật cần định danh",
      visible: isFollow,
      onChange: s => choose(s, s.organism),
      options: ORGANISMS.map(o => ({ value: o.id, label: `${o.icon} ${o.name}` })),
    },
    { type: "button", label: "Có", primary: true, visible: asking, action: (s, api) => reply(s, api, true) },
    { type: "button", label: "Không", visible: asking, action: (s, api) => reply(s, api, false) },
    { type: "button", label: "Con vật tiếp theo", primary: true, visible: s => isFollow(s) && !asking(s), event: "next-organism", action: s => void nextOrganism(s) },
    {
      type: "select",
      key: "feature",
      label: "Đặc điểm dùng để tách nhóm",
      visible: building,
      options: FEATURES.map(f => ({ value: f.id, label: f.question })),
    },
    {
      type: "button",
      label: "Thêm câu hỏi này vào khóa",
      primary: true,
      visible: building,
      disabled: s => !analyze(s.key).next,
      action(s, api) {
        const path = analyze(s.key).next?.path;
        if (!addQuestion(s)) return;
        const a = analyze(s.key);
        const splits = a.flagged.includes(path) ? 0 : 1;
        api.emit("question-added", { questions: a.nodes.length, splits });
        if (a.valid) api.emit("key-built", { questions: a.nodes.length, depth: a.depth }, "goal");
      },
    },
    { type: "button", label: "Hoàn tác câu hỏi cuối", visible: building, disabled: s => !analyze(s.key).nodes.length, event: "question-removed", action: s => void undo(s) },
    { type: "button", label: "Xóa cả khóa", visible: building, disabled: s => !analyze(s.key).nodes.length, event: "key-cleared", action: s => void (s.key = "") },
    { type: "checkbox", key: "showTable", label: "Xem bảng đặc điểm thay cho sơ đồ khóa" },
  ],
  readouts: [
    { label: "Đã định danh bằng khóa có sẵn", value: s => `${found(s).filter(Boolean).length}/${ORGANISMS.length}` },
    { label: "Trả lời sai (con vật này)", value: s => `${s.mistakes}` },
    { label: "Số câu hỏi của khóa", value: s => `${analyze(activeKey(s)).nodes.length}` },
    { label: "Độ sâu của khóa", value: s => `${analyze(activeKey(s)).depth} câu hỏi` },
    { label: "Khóa của em", value: s => keyStatus(analyze(s.key)) },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 430;
    const pad = small ? 6 : 16;
    const fs = small ? 11 : 15;
    const a = analyze(activeKey(s));
    const p = progress(s);
    const follow = isFollow(s);

    // banner: the animal in hand (follow mode) and what to do now
    const lineH = fs + (small ? 3 : 6);
    const bannerH = lineH * (small ? 3 : 2) + 4;
    const iconW = follow ? bannerH : 0;
    if (follow) label(ctx, ORGANISMS[p.organism].icon, pad + iconW / 2, pad + bannerH / 2, { size: bannerH * 0.72, align: "center" });
    const b = banner(s, a, p);
    const lines = wrap(ctx, b.text, view.w - 2 * pad - iconW - 6, fs, true).slice(0, small ? 3 : 2);
    lines.forEach((line, i) =>
      label(ctx, line, pad + iconW + (follow ? 6 : 0), pad + bannerH / 2 + (i - (lines.length - 1) / 2) * lineH, { size: fs, bold: true, color: b.color })
    );

    const box = { x: pad, y: pad + bannerH + (small ? 4 : 12), w: view.w - 2 * pad };
    box.h = view.h - box.y - pad;
    if (s.showTable) drawTable(ctx, s, a, p, box, small);
    else drawTree(ctx, s, a, p, box, small);
  },
});
