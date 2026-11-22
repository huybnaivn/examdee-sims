import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, cross, sample, breed, clear, bornOf, write, gameteName, affected, carrier, pedigree, check, FEMALES, MALES, MAX_BORN } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const TRAIT = { colour: "mù màu đỏ – lục", haemo: "máu khó đông" };
const SICK = { colour: "bị mù màu", haemo: "bị bệnh" };
const SHADE = { normal: "#d7f0e4", carrier: "#fbd9a8", sick: "#e5484d" };
const pct = x => `${fmt(x * 100, 1)}%`;
const phenoName = (g, s) => (affected(g) ? SICK[s.trait] : carrier(g) ? "bình thường, mang allele bệnh" : "bình thường");

let memo = { key: "", value: null };
const seen = s => {
  const key = [s.seed, s.born, s.mother, s.father].join("|");
  if (memo.key !== key) memo = { key, value: sample(s) };
  return memo.value;
};
let pedMemo = { seed: NaN, value: null };
const ped = s => {
  if (pedMemo.seed !== s.pedSeed) pedMemo = { seed: s.pedSeed, value: pedigree(s.pedSeed) };
  return pedMemo.value;
};

/** Pedigree symbol: square for a male, circle for a female; filled = affected, centre dot = carrier. */
function symbol(ctx, x, y, r, sex, sick, dot) {
  ctx.beginPath();
  if (sex === "m") ctx.rect(x - r, y - r, 2 * r, 2 * r);
  else ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = sick ? COLORS.ink : "#fff";
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (dot) {
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, r * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSquare(ctx, c, x, y, hdr, cell) {
  const size = Math.max(10, Math.min(17, cell * 0.24));
  ctx.fillStyle = "#fdeced";
  ctx.fillRect(x, y + hdr, hdr, cell * c.motherGametes.length);
  ctx.fillStyle = "#e9f0fe";
  ctx.fillRect(x + hdr, y, cell * 2, hdr);
  label(ctx, "♀", x + hdr * 0.3, y + hdr * 0.72, { size: Math.min(15, hdr * 0.5), color: COLORS.red, align: "center", bold: true });
  label(ctx, "♂", x + hdr * 0.72, y + hdr * 0.3, { size: Math.min(15, hdr * 0.5), color: COLORS.blue, align: "center", bold: true });
  c.fatherGametes.forEach((g, j) => label(ctx, gameteName(g), x + hdr + cell * (j + 0.5), y + hdr / 2, { size, bold: true, align: "center", color: COLORS.blue }));
  c.motherGametes.forEach((g, i) => label(ctx, gameteName(g), x + hdr / 2, y + hdr + cell * (i + 0.5), { size, bold: true, align: "center", color: COLORS.red }));
  c.grid.forEach((row, i) =>
    row.forEach((g, j) => {
      const cx = x + hdr + cell * j;
      const cy = y + hdr + cell * i;
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx, cy, cell, cell);
      const icon = cell >= 46;
      label(ctx, write(g), cx + cell / 2, cy + (icon ? cell * 0.3 : cell / 2), { size, bold: true, align: "center" });
      if (icon) symbol(ctx, cx + cell / 2, cy + cell * 0.68, cell * 0.13, g.length === 2 ? "f" : "m", affected(g), carrier(g));
    })
  );
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  const rows = c.motherGametes.length;
  ctx.beginPath();
  for (let i = 0; i <= rows; i++) {
    ctx.moveTo(x, y + hdr + cell * i);
    ctx.lineTo(x + hdr + cell * 2, y + hdr + cell * i);
  }
  for (let j = 0; j <= 2; j++) {
    ctx.moveTo(x + hdr + cell * j, y);
    ctx.lineTo(x + hdr + cell * j, y + hdr + cell * rows);
  }
  ctx.moveTo(x, y);
  ctx.lineTo(x + hdr, y + hdr);
  ctx.stroke();
  ctx.strokeRect(x, y, hdr + cell * 2, hdr + cell * rows);
}

/** One stacked bar: fractions normal / carrier / affected. */
function bar(ctx, x, y, w, h, parts) {
  let at = x;
  for (const [f, color] of parts) {
    ctx.fillStyle = color;
    ctx.fillRect(at, y, w * f, h);
    at += w * f;
  }
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawBars(ctx, s, c, box, small) {
  const n = bornOf(s);
  const k = seen(s);
  const size = small ? 10 : 12;
  const daughters = k.AA + k.Aa + k.aa;
  const sons = k.A + k.a;
  const nameW = small ? 58 : 104;
  const bw = box.w - nameW - (small ? 44 : 60);
  let y = box.y;
  if (!small) {
    label(ctx, "Tỉ lệ kiểu hình theo giới tính", box.x, y + 6, { size: 14, bold: true });
    y += 24;
  }
  // legend
  let lx = box.x;
  for (const [text, color] of [["bình thường", SHADE.normal], ["mang allele bệnh", SHADE.carrier], [SICK[s.trait], SHADE.sick]]) {
    ctx.fillStyle = color;
    ctx.fillRect(lx, y - 5, 10, 10);
    ctx.strokeStyle = COLORS.muted;
    ctx.strokeRect(lx, y - 5, 10, 10);
    label(ctx, text, lx + 14, y, { size, color: COLORS.muted });
    ctx.font = `${size}px ${FONT}`;
    lx += ctx.measureText(text).width + 26;
  }
  y += small ? 12 : 22;
  const gap = small ? 4 : 12;
  const rowH = Math.max(9, Math.min(34, (box.y + box.h - y - 2 * (size * 1.4 + 4 + gap)) / 4));
  const rows = [
    ["Con gái", [[c.daughters.AA, SHADE.normal], [c.daughters.Aa, SHADE.carrier], [c.daughters.aa, SHADE.sick]], c.daughtersAffected,
      daughters ? [[k.AA / daughters, SHADE.normal], [k.Aa / daughters, SHADE.carrier], [k.aa / daughters, SHADE.sick]] : null, daughters ? k.aa / daughters : 0, daughters],
    ["Con trai", [[c.sons.A, SHADE.normal], [c.sons.a, SHADE.sick]], c.sonsAffected,
      sons ? [[k.A / sons, SHADE.normal], [k.a / sons, SHADE.sick]] : null, sons ? k.a / sons : 0, sons],
  ];
  for (const [name, theory, sickT, seenParts, sickS, count] of rows) {
    label(ctx, name, box.x, y + size * 0.6, { size: size + 1, bold: true });
    y += size * 1.4;
    label(ctx, "Lí thuyết", box.x, y + rowH / 2, { size, color: COLORS.muted });
    bar(ctx, box.x + nameW, y, bw, rowH, theory);
    label(ctx, pct(sickT), box.x + nameW + bw + 6, y + rowH / 2, { size, color: COLORS.red, bold: true });
    y += rowH + 4;
    label(ctx, small ? "Quan sát" : `Quan sát (${fmt(count, 0)})`, box.x, y + rowH / 2, { size, color: COLORS.muted });
    if (seenParts) {
      bar(ctx, box.x + nameW, y, bw, rowH, seenParts);
      label(ctx, pct(sickS), box.x + nameW + bw + 6, y + rowH / 2, { size, color: COLORS.red });
    } else label(ctx, "chưa sinh con", box.x + nameW, y + rowH / 2, { size, color: COLORS.muted });
    y += rowH + gap;
  }
  if (!small) label(ctx, `Số % màu đỏ: tỉ lệ ${SICK[s.trait]}. Quan sát trên ${fmt(n, 0)} con sinh ngẫu nhiên.`, box.x, y + 2, { size: 11, color: COLORS.muted });
}

function drawCross(ctx, s, view) {
  const c = cross(s.mother, s.father);
  const small = view.w < 560;
  const pad = small ? 8 : 24;
  const size = small ? 12 : 15;
  label(ctx, `P:  ♀ ${write(c.mother)}  ×  ♂ ${write(c.father)}`, pad, small ? 13 : 24, { size: small ? 14 : 19, bold: true });
  if (!small) label(ctx, `♀ ${phenoName(c.mother, s)}  ×  ♂ ${phenoName(c.father, s)} · bệnh ${TRAIT[s.trait]}, allele lặn a trên X, Y không mang allele`, pad, 48, { size: 12, color: COLORS.muted });

  const leftW = small ? view.w * 0.5 : view.w * 0.42;
  const y0 = small ? 28 : 72;
  const hdr = small ? 22 : 36;
  const availH = small ? view.h * 0.5 - y0 : view.h * 0.55 - y0;
  const rows = c.motherGametes.length;
  const cell = Math.max(20, Math.min((leftW - pad - hdr) / 2, (availH - hdr) / 2, 100));
  drawSquare(ctx, c, pad, y0, hdr, cell);
  const sqBottom = y0 + hdr + cell * rows;

  // expected classes, as text
  const rx = pad + hdr + cell * 2 + (small ? 10 : 30);
  const lines = [
    ["Con gái:", Object.entries(c.daughters).filter(([, f]) => f).map(([g, f]) => `${pct(f)} ${write(g)}`).join(" : ")],
    ["Con trai:", Object.entries(c.sons).filter(([, f]) => f).map(([g, f]) => `${pct(f)} ${write(g)}`).join(" : ")],
  ];
  let y = y0 + (small ? 8 : 14);
  label(ctx, "Tỉ lệ kiểu gene (lí thuyết)", rx, y, { size: size - 2, color: COLORS.muted });
  y += size * 1.5;
  ctx.font = `600 ${size}px ${FONT}`;
  const rw = view.w - rx - pad;
  for (const [who, text] of lines) {
    label(ctx, who, rx, y, { size, bold: true });
    // wrap the classes under the name when they do not fit beside it
    const parts = text.split(" : ");
    let line = "";
    for (const part of parts) {
      const next = line ? `${line} : ${part}` : part;
      if (line && ctx.measureText(next).width > rw) {
        y += size * 1.35;
        label(ctx, line + " :", rx, y, { size, bold: true });
        line = part;
      } else line = next;
    }
    y += size * 1.35;
    label(ctx, line, rx, y, { size, bold: true });
    y += size * 1.6;
  }
  if (!small) {
    label(ctx, `Cả đàn con: ${pct(c.childrenAffected)} ${SICK[s.trait]}`, rx, y, { size: 13, color: COLORS.red, bold: true });
    label(ctx, "Mỗi ô của bảng có xác suất như nhau; con trai nhận X từ mẹ, Y từ bố.", pad, sqBottom + 18, { size: 12, color: COLORS.muted });
  }
  const by = Math.max(sqBottom + (small ? 8 : 40), small ? 0 : y + 10);
  drawBars(ctx, s, c, { x: pad, y: by, w: view.w - 2 * pad, h: view.h - by - (small ? 4 : 10) }, small);
}

function drawPedigree(ctx, s, view) {
  const p = ped(s);
  const small = view.w < 560;
  const pad = small ? 8 : 24;
  const r = Math.max(8, Math.min(18, view.w / 40, view.h / 30));
  const top = small ? 30 : 60;
  const legendH = small ? 34 : 54;
  const rowGap = (view.h - top - legendH - 3 * r) / 2.4;
  const yOf = gen => top + r + (gen - 1) * rowGap;
  const x0 = pad + (small ? 18 : 30);
  const W = view.w - x0 - pad;
  const kids = p.persons.filter(x => x.gen === 3);
  const pos = {
    "I-1": 0.45, "I-2": 0.75,
    "II-1": 0.12, "II-2": 0.42, "II-3": 0.82,
  };
  kids.forEach((x, i) => (pos[x.id] = 0.02 + (0.54 * (i + 0.5)) / kids.length));
  const at = x => ({ x: x0 + W * pos[x.id], y: yOf(x.gen) });

  label(ctx, `Phả hệ bệnh ${TRAIT[s.trait]}`, pad, small ? 12 : 22, { size: small ? 13 : 17, bold: true });
  if (!small) label(ctx, "Người được đánh dấu «?» có kiểu gene gì? Chọn đáp án ở bảng điều khiển.", pad, 42, { size: 12, color: COLORS.muted });

  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  const couple = (a, b, children) => {
    const A = at(a), B = at(b);
    ctx.beginPath();
    ctx.moveTo(A.x + r, A.y);
    ctx.lineTo(B.x - r, B.y);
    const mid = (A.x + B.x) / 2;
    const yBar = A.y + rowGap * 0.55;
    ctx.moveTo(mid, A.y);
    ctx.lineTo(mid, yBar);
    const xs = children.map(c => at(c).x);
    ctx.moveTo(Math.min(mid, ...xs), yBar);
    ctx.lineTo(Math.max(mid, ...xs), yBar);
    for (const x of xs) {
      ctx.moveTo(x, yBar);
      ctx.lineTo(x, yBar + rowGap * 0.45 - r);
    }
    ctx.stroke();
  };
  const P = p.persons;
  couple(P[0], P[1], [P[3], P[4]]);
  couple(P[2], P[3], kids);

  const known = s.solved;
  P.forEach((x, i) => {
    const { x: cx, y: cy } = at(x);
    const target = i === p.target;
    symbol(ctx, cx, cy, r, x.sex, x.affected, known && carrier(x.genotype) && p.sets[i].length === 1);
    if (target && !known) {
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      label(ctx, "?", cx, cy, { size: r * 1.1, bold: true, align: "center", color: COLORS.orange });
    }
    label(ctx, x.id.split("-")[1], cx + r + 3, cy - r, { size: Math.max(9, r * 0.6), color: COLORS.muted });
    const sure = p.sets[i].length === 1;
    const text = known ? (sure ? write(p.sets[i][0]) : "XᴬX?") : x.sex === "m" ? write(x.genotype) : "";
    if (text && (!small || known || x.gen !== 3)) label(ctx, text, cx, cy + r + 10, { size: small ? 10 : 12, align: "center", color: target ? COLORS.green : COLORS.muted, bold: target });
  });
  ["I", "II", "III"].forEach((g, i) => label(ctx, g, pad, yOf(i + 1), { size: small ? 12 : 15, bold: true, color: COLORS.muted }));

  // feedback and legend
  const ly = view.h - legendH + (small ? 8 : 12);
  if (s.checked) {
    const t = P[p.target];
    const text = s.solved
      ? `Đúng: ${t.id} có kiểu gene ${write(t.genotype)}.`
      : "Chưa đúng. Gợi ý: con trai nhận X từ mẹ; con gái nhận một X từ bố.";
    label(ctx, text, view.w - pad, small ? 12 : 22, { size: small ? 11 : 13, bold: true, align: "right", color: s.solved ? COLORS.green : COLORS.red });
  }
  const items = [["m", false, false, "nam bình thường"], ["m", true, false, "nam bị bệnh"], ["f", false, false, "nữ bình thường"], ["f", true, false, "nữ bị bệnh"]];
  if (known) items.push(["f", false, true, "nữ mang allele bệnh"]);
  let lx = pad;
  let row = 0;
  const lsize = small ? 10 : 12;
  ctx.font = `${lsize}px ${FONT}`;
  for (const [sex, sick, dot, text] of items) {
    const w = ctx.measureText(text).width + 30;
    if (lx + w > view.w - pad) {
      lx = pad;
      row++;
    }
    symbol(ctx, lx + 6, ly + row * 16, 6, sex, sick, dot);
    label(ctx, text, lx + 16, ly + row * 16, { size: lsize, color: COLORS.muted });
    lx += w;
  }
  if (known && !small) label(ctx, "Sau khi trả lời đúng: kiểu gene suy ra được của mọi người (XᴬX? là chưa xác định được).", pad, ly + (row + 1) * 16 + 4, { size: 11, color: COLORS.muted });
}

const restart = s => {
  s.born = 0;
};
const commitCross = (s, api) => {
  const c = cross(s.mother, s.father);
  api.emit("cross-result", { sonsAffected: c.sonsAffected, daughtersAffected: c.daughtersAffected, daughtersCarrier: c.daughtersCarrier, childrenAffected: c.childrenAffected }, "result");
};
const isCross = s => s.view === "cross";
const isPed = s => s.view === "pedigree";

mount({
  slug: "di-truyen-lien-ket-gioi-tinh",
  version: "1.0.0",
  title: "Di truyền liên kết với giới tính",
  hint: "Chọn kiểu gene của mẹ và bố để xem giao tử, sơ đồ lai và tỉ lệ con bị bệnh theo giới tính; ở chế độ phả hệ, suy luận kiểu gene của người được đánh dấu.",
  initialState,
  controls: [
    {
      type: "select",
      key: "view",
      label: "Nội dung",
      options: [
        { value: "cross", label: "Sơ đồ lai và tỉ lệ đời con" },
        { value: "pedigree", label: "Phả hệ ba thế hệ" },
      ],
    },
    {
      type: "select",
      key: "trait",
      label: "Tính trạng (allele lặn a trên X)",
      options: [
        { value: "colour", label: "Bệnh mù màu đỏ – lục" },
        { value: "haemo", label: "Bệnh máu khó đông" },
      ],
    },
    { type: "heading", label: "Bố mẹ (P)", visible: isCross },
    {
      type: "select",
      key: "mother",
      label: "Mẹ (♀)",
      visible: isCross,
      onChange: restart,
      onCommit: commitCross,
      options: FEMALES.map(g => ({ value: g, label: `${write(g)} – ${g === "AA" ? "bình thường" : g === "Aa" ? "bình thường, mang allele bệnh" : "bị bệnh"}` })),
    },
    {
      type: "select",
      key: "father",
      label: "Bố (♂)",
      visible: isCross,
      onChange: restart,
      onCommit: commitCross,
      options: MALES.map(g => ({ value: g, label: `${write(g)} – ${g === "A" ? "bình thường" : "bị bệnh"}` })),
    },
    { type: "heading", label: "Sinh con ngẫu nhiên", visible: isCross },
    { type: "slider", key: "batch", label: "Số con mỗi lần sinh", min: 10, max: 1000, step: 10, digits: 0, visible: isCross },
    {
      type: "button",
      label: "Sinh thêm con",
      primary: true,
      visible: isCross,
      disabled: s => bornOf(s) >= MAX_BORN,
      action(s, api) {
        const count = breed(s, s.batch);
        if (count) api.emit("breed", { count, total: s.born }, "action");
      },
    },
    { type: "button", label: "Xoá kết quả", action: clear, event: "clear-offspring", visible: isCross, disabled: s => bornOf(s) === 0 },
    { type: "heading", label: "Suy luận từ phả hệ", visible: isPed },
    {
      type: "select",
      key: "answer",
      label: "Kiểu gene của người «?»",
      visible: isPed,
      onChange: s => (s.checked = false),
      options: [{ value: "", label: "— chọn kiểu gene —" }, ...FEMALES.map(g => ({ value: g, label: write(g) })), ...MALES.map(g => ({ value: g, label: write(g) }))],
    },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: isPed,
      disabled: s => !s.answer || s.solved,
      action(s, api) {
        if (check(s)) api.emit("genotype-deduced", { attempts: s.attempts }, "goal");
        else api.emit("wrong-answer", { attempts: s.attempts }, "action");
      },
    },
    {
      type: "button",
      label: "Phả hệ mới",
      visible: isPed,
      event: "new-pedigree",
      action(s) {
        s.pedSeed = (Math.max(0, Math.floor(s.pedSeed) || 0) + 1) % 1e6;
        Object.assign(s, { answer: "", attempts: 0, checked: false, solved: false });
      },
    },
  ],
  readouts: [
    { label: "Con trai bị bệnh (lí thuyết)", value: s => pct(cross(s.mother, s.father).sonsAffected) },
    { label: "Con gái bị bệnh (lí thuyết)", value: s => pct(cross(s.mother, s.father).daughtersAffected) },
    { label: "Số con đã sinh ngẫu nhiên", value: s => fmt(bornOf(s), 0) },
  ],
  draw(ctx, s, view) {
    if (isPed(s)) drawPedigree(ctx, s, view);
    else drawCross(ctx, s, view);
  },
});
