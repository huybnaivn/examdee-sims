import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { DENOMS, MAX_NOTES, MAX_TARGET, ITEMS, itemKey, initialState, dots, dong, sum, basket, total, pay, fewest, phaseOf, sanitize, newTarget } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
// Schematic notes: a plain colour per value, nothing else. Not the look of real money.
const NOTE = ["#8792a8", "#a9805c", "#2f95ad", "#d39a00", "#4c78dd", "#cf5f98", "#3f9d5d", "#c8553d", "#6f58c9"];
const noteColor = value => NOTE[DENOMS.indexOf(value)] ?? COLORS.muted;

const shop = s => s.mode === "shop";
const say = (s, text, good = false) => {
  s._note = text;
  s._good = good;
};

/** Centred text that shrinks to fit maxW. */
function fit(ctx, text, x, y, size, maxW, opts = {}) {
  ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, align: "center", size: w > maxW ? Math.max(7, (size * maxW) / w) : size });
}

/** Centred text wrapped onto at most `maxLines` lines (shrinks instead when it still does not fit); y is the top. */
function para(ctx, text, x, y, size, maxW, maxLines, opts = {}) {
  for (; ; size -= 1) {
    ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
    const lines = [""];
    for (const word of text.split(" ")) {
      const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
      if (ctx.measureText(next).width <= maxW || !lines.at(-1)) lines[lines.length - 1] = next;
      else lines.push(word);
    }
    if (lines.length <= maxLines || size <= 8) return lines.forEach((t, i) => fit(ctx, t, x, y + size * (0.7 + 1.25 * i), size, maxW, opts));
  }
}

// ---------- what the learner does ----------

function clearTrays(s) {
  s.paid = [];
  s.back = [];
  s.phase = "pay";
  say(s, "");
}

function tapNote(s, api, value) {
  const phase = phaseOf(s);
  if (phase === "done") return;
  const tray = phase === "change" ? s.back : s.paid;
  if (tray.length >= MAX_NOTES) return say(s, `Khay đã đủ ${MAX_NOTES} tờ. Em lấy lại bớt hoặc dùng tờ lớn hơn nhé.`);
  tray.push(value);
  say(s, "");
  api.emit("note-tapped", { value, amount: sum(tray), notes: tray.length }, "action");
}

function takeBack(s, api) {
  const tray = phaseOf(s) === "change" ? s.back : s.paid;
  const value = tray.pop();
  say(s, "");
  api.emit("note-removed", { value, amount: sum(tray), notes: tray.length }, "action");
}

function toggleItem(s, api, i) {
  s[itemKey(i)] = !s[itemKey(i)];
  say(s, "");
  api.emit("item-toggled", { item: i, price: ITEMS[i].price, selected: s[itemKey(i)] ? 1 : 0, total: total(s) }, "action");
}

function payNow(s, api) {
  const r = pay(total(s), sum(s.paid));
  if (!r.ok) {
    if (r.reason === "empty") return say(s, "Em chưa chọn món hàng nào. Bấm vào món hàng em muốn mua.");
    say(s, `Chưa đủ tiền: còn thiếu ${dong(r.short)}. Em đưa thêm nhé.`);
    return api.emit("payment-refused", { total: total(s), paid: sum(s.paid), short: r.short }, "action");
  }
  s.back = [];
  s.phase = r.change === 0 ? "done" : "change";
  api.emit("purchase-paid", { total: r.total, paid: r.paid, change: r.change }, "result");
  if (r.change === 0) {
    say(s, "Em đưa vừa đủ tiền, không cần trả lại. Giỏi quá!", true);
    api.emit("exact-change", { total: r.total, paid: r.paid, change: 0, notes: 0, fewest: 0 }, "goal");
  } else {
    say(s, "");
  }
}

function checkChange(s, api) {
  const r = pay(total(s), sum(s.paid));
  const given = sum(s.back);
  if (given !== r.change) {
    say(s, `Chưa đúng. Tiền trả lại = tiền em đưa − tổng tiền hàng = ${dots(r.paid)} − ${dots(r.total)}.`);
    return api.emit("wrong-change", { given, change: r.change }, "action");
  }
  const least = fewest(r.change).length;
  s.phase = "done";
  say(s, `Đúng rồi! ${dots(r.paid)} − ${dots(r.total)} = ${dong(r.change)}.${s.back.length > least ? ` Ít tờ nhất là ${least} tờ.` : ""}`, true);
  api.emit("exact-change", { total: r.total, paid: r.paid, change: r.change, notes: s.back.length, fewest: least }, "goal");
}

function checkFewest(s, api) {
  const given = sum(s.paid);
  if (given !== s.target) {
    say(s, given < s.target ? `Chưa đủ: còn thiếu ${dong(s.target - given)}.` : `Nhiều quá: thừa ${dong(given - s.target)}. Em lấy lại bớt nhé.`);
    return api.emit("wrong-amount", { target: s.target, given }, "action");
  }
  const least = fewest(s.target).length;
  api.emit("amount-made", { amount: given, notes: s.paid.length, fewest: least }, "result");
  if (s.paid.length > least) return say(s, `Đúng ${dong(given)} rồi! Nhưng em dùng ${s.paid.length} tờ, có cách chỉ cần ${least} tờ. Thử lại nhé.`);
  s.phase = "done";
  say(s, `Giỏi quá! ${s.paid.length} tờ là ít nhất.`, true);
  api.emit("fewest-notes", { amount: given, notes: s.paid.length }, "goal");
}

function wallet(box, api) {
  box.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:8px";
  const buttons = DENOMS.map((value, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = dots(value);
    b.setAttribute("aria-label", `Tờ ${dong(value)}`);
    b.style.cssText = `min-height:52px;padding:0;font-size:16px;font-weight:700;color:#fff;background:${NOTE[i]};border:2px solid rgba(0,0,0,0.18);border-radius:6px`;
    b.addEventListener("click", () => {
      tapNote(api.state, api, value);
      api.sync();
    });
    box.append(b);
    return b;
  });
  return () => {
    const off = phaseOf(api.state) === "done";
    for (const b of buttons) b.disabled = off;
  };
}

// ---------- drawing ----------

/** A schematic note: coloured rectangle with its value, nothing else. */
function drawNote(ctx, value, x, y, w, h) {
  ctx.fillStyle = noteColor(value);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(5, h / 5));
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  if (h >= 18) ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
  fit(ctx, dots(value), x + w / 2, y + h / 2 + 0.5, Math.min(h * 0.5, 20), w - 8, { bold: true, color: "#fff" });
}

/** Notes in the order tapped, in as few rows as fit; an empty tray shows a dashed outline. */
function drawTray(ctx, notes, box, empty = "(chưa có tờ nào)") {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.setLineDash([]);
  if (!notes.length) return fit(ctx, empty, box.x + box.w / 2, box.y + box.h / 2, Math.min(13, box.h * 0.5), box.w, { color: COLORS.muted });
  const perRow = Math.min(MAX_NOTES, Math.max(5, Math.floor(box.w / 66)));
  const rows = Math.ceil(notes.length / perRow);
  const nw = Math.min(104, (box.w - 6) / perRow - 4);
  const nh = Math.min((box.h - 4) / rows - 3, nw * 0.5);
  const y0 = box.y + (box.h - rows * (nh + 3) + 3) / 2;
  notes.forEach((value, i) => drawNote(ctx, value, box.x + 5 + (i % perRow) * (nw + 4), y0 + Math.floor(i / perRow) * (nh + 3), nw, nh));
}

/** The shelf: eight price cards in a 4 × 2 grid. draw() and the pointer share it. */
function shelf(view) {
  const small = view.w < 520 || view.h < 420;
  const pad = small ? 6 : 14;
  const gap = small ? 4 : 10;
  const hgt = small ? Math.min(view.h * 0.34, 116) : Math.min(view.h * 0.4, 300);
  const cw = (view.w - 2 * pad - 3 * gap) / 4;
  const ch = (hgt - gap) / 2;
  return { small, pad, bottom: pad + hgt, cards: ITEMS.map((_, i) => ({ x: pad + (i % 4) * (cw + gap), y: pad + Math.floor(i / 4) * (ch + gap), w: cw, h: ch })) };
}

function drawCard(ctx, item, c, picked, dim) {
  ctx.save();
  if (dim) ctx.globalAlpha = 0.4;
  ctx.fillStyle = picked ? "#e6f6ee" : "#fff";
  ctx.strokeStyle = picked ? COLORS.green : COLORS.grid;
  ctx.lineWidth = picked ? 3 : 1.5;
  ctx.beginPath();
  ctx.roundRect(c.x, c.y, c.w, c.h, 8);
  ctx.fill();
  ctx.stroke();
  const flat = c.h < 84; // short card: picture on the left, price on the right
  // ponytail: emoji as the item pictures; draw vector icons if a platform without colour emoji matters
  const icon = flat ? Math.min(c.h * 0.52, c.w * 0.3) : Math.min(c.h * 0.36, c.w * 0.4);
  ctx.font = `${icon}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.ink;
  const tagH = flat ? Math.min(20, c.h * 0.42) : Math.min(30, c.h * 0.24);
  let tx;
  let ty;
  let tw;
  if (flat) {
    ctx.fillText(item.icon, c.x + c.w * 0.2, c.y + c.h / 2 + 1);
    tw = c.w * 0.58;
    tx = c.x + c.w * 0.38;
    ty = c.y + (c.h - tagH) / 2;
  } else {
    ctx.fillText(item.icon, c.x + c.w / 2, c.y + c.h * 0.28);
    fit(ctx, item.name, c.x + c.w / 2, c.y + c.h * 0.57, Math.min(16, c.h * 0.13), c.w - 10, { color: COLORS.ink });
    tw = Math.min(c.w - 16, 130);
    tx = c.x + (c.w - tw) / 2;
    ty = c.y + c.h * 0.7;
  }
  // the price tag
  ctx.fillStyle = "#ffe9a8";
  ctx.strokeStyle = "#d9b44a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(tx, ty, tw, tagH, 4);
  ctx.fill();
  ctx.stroke();
  fit(ctx, `${dots(item.price)} đ`, tx + tw / 2, ty + tagH / 2 + 0.5, tagH * 0.62, tw - 6, { bold: true });
  if (picked) {
    const r = Math.min(10, c.h * 0.17);
    ctx.fillStyle = COLORS.green;
    ctx.beginPath();
    ctx.arc(c.x + c.w - r - 3, c.y + r + 3, r, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, "✓", c.x + c.w - r - 3, c.y + r + 4, { size: r * 1.3, align: "center", bold: true, color: "#fff" });
  }
  ctx.restore();
}

mount({
  slug: "tien-viet-nam",
  version: "1.0.0",
  title: "Tiền Việt Nam: tính tiền và trả lại",
  hint: "Bấm vào món hàng để chọn mua. Bấm vào tờ tiền để đưa tiền.",
  initialState,
  sanitize,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "shop", label: "Mua hàng và tính tiền trả lại" },
        { value: "fewest", label: "Lấy tiền bằng ít tờ nhất" },
      ],
      onChange: clearTrays,
    },
    { type: "custom", render: wallet },
    { type: "button", label: "↩ Lấy lại tờ vừa bấm", disabled: s => phaseOf(s) === "done" || !(phaseOf(s) === "change" ? s.back : s.paid).length, action: takeBack },
    { type: "button", label: "Trả tiền", primary: true, visible: s => shop(s) && phaseOf(s) === "pay", action: payNow },
    { type: "button", label: "Kiểm tra tiền trả lại", primary: true, visible: s => shop(s) && phaseOf(s) === "change", action: checkChange },
    {
      type: "button",
      label: "Mua lượt khác",
      primary: true,
      visible: s => shop(s) && phaseOf(s) === "done",
      event: "new-purchase",
      action: s => {
        ITEMS.forEach((_, i) => (s[itemKey(i)] = false));
        clearTrays(s);
      },
    },
    { type: "button", label: "Kiểm tra", primary: true, visible: s => !shop(s) && phaseOf(s) === "pay", action: checkFewest },
    {
      type: "slider",
      key: "target",
      label: "Số tiền cần lấy",
      min: 1000,
      max: MAX_TARGET,
      step: 1000,
      format: v => dong(v),
      visible: s => !shop(s),
      onChange: clearTrays,
    },
    {
      type: "button",
      label: "Số tiền khác",
      visible: s => !shop(s),
      event: "new-amount",
      action: s => {
        s.target = newTarget(Math.random, s.target);
        clearTrays(s);
      },
    },
    { type: "heading", label: "Chọn hàng (hoặc bấm vào món hàng trên hình)", visible: shop },
    ...ITEMS.map((item, i) => ({
      type: "checkbox",
      key: itemKey(i),
      label: `${item.name}: ${dong(item.price)}`,
      visible: shop,
      disabled: s => phaseOf(s) !== "pay",
      onChange: s => say(s, ""),
    })),
  ],
  readouts: [
    { label: "Tổng tiền hàng", value: s => (shop(s) ? dong(total(s)) : "–") },
    { label: "Tiền em đưa", value: s => `${dong(sum(s.paid))} (${s.paid.length} tờ)` },
    { label: "Tiền trả lại", value: s => (!shop(s) ? "–" : phaseOf(s) === "done" ? dong(sum(s.paid) - total(s)) : "?") },
  ],
  pointer: {
    down(p, s, api, view) {
      if (!shop(s) || phaseOf(s) !== "pay") return false;
      const i = shelf(view).cards.findIndex(c => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
      if (i >= 0) {
        toggleItem(s, api, i);
        api.sync();
      }
      return false;
    },
  },
  draw(ctx, s, view) {
    const { w, h } = view;
    const g = shelf(view);
    const { small, pad } = g;
    const phase = phaseOf(s);
    const th = small ? 17 : 27; // a line of text
    const size = small ? 13 : 18;
    const foot = small ? 0 : 20;
    const mid = w / 2;
    const maxW = w - 2 * pad;
    let y;

    if (shop(s)) {
      const picked = basket(s);
      ITEMS.forEach((item, i) => drawCard(ctx, item, g.cards[i], picked.includes(i), phase !== "pay" && !picked.includes(i)));
      y = g.bottom + (small ? 3 : 8);
      const due = total(s);
      const text = !picked.length
        ? "Em hãy bấm vào món hàng muốn mua."
        : `Tổng tiền hàng: ${picked.length > 1 ? picked.map(i => dots(ITEMS[i].price)).join(" + ") + " = " : ""}${dong(due)}`;
      fit(ctx, text, mid, y + th / 2, size, maxW, { bold: true });
      y += th;
    } else {
      const big = small ? 30 : 54;
      fit(ctx, "Lấy đúng số tiền này bằng ít tờ tiền nhất:", mid, pad + th / 2, size, maxW, { color: COLORS.muted });
      fit(ctx, dong(s.target), mid, pad + th + big * 0.6, big, maxW, { bold: true, color: COLORS.blue });
      y = pad + th + big * 1.3;
    }

    // trays: always room for two, so nothing jumps when the change tray appears
    const trays = shop(s) ? 2 : 1;
    const cap = shop(s) ? (small ? 48 : 84) : small ? 64 : 110;
    const nh = Math.max(14, Math.min(cap, (h - y - foot - th * (trays + 2.2)) / trays));
    const tray = (title, notes, color) => {
      fit(ctx, `${title}: ${dong(sum(notes))}${shop(s) ? "" : ` (${notes.length} tờ)`}`, mid, y + th / 2, size, maxW, { bold: true, color });
      drawTray(ctx, notes, { x: pad, y: y + th, w: maxW, h: nh });
      y += th + nh;
    };
    tray(shop(s) ? "Em đưa" : "Em đã lấy", s.paid, COLORS.blue);
    if (shop(s) && phase !== "pay") tray("Trả lại em", s.back, COLORS.orange);
    else if (shop(s)) {
      // what comes next, greyed out
      fit(ctx, "Trả lại em: ? đồng", mid, y + th / 2, size, maxW, { bold: true, color: "#aab3c5" });
      drawTray(ctx, [], { x: pad, y: y + th, w: maxW, h: nh }, "(trả tiền xong, em sẽ tính tiền trả lại ở đây)");
      y += th + nh;
    }

    // feedback, or what to do next
    let text = s._note;
    let color = s._good ? COLORS.green : COLORS.red;
    if (!text) {
      color = COLORS.muted;
      if (!shop(s)) text = phase === "done" ? "Giỏi quá! Đó là cách dùng ít tờ nhất." : "Bấm vào các tờ tiền, rồi bấm “Kiểm tra”. Mẹo: lấy tờ lớn nhất có thể trước.";
      else if (phase === "pay") text = "Bấm vào các tờ tiền để đưa, rồi bấm “Trả tiền”.";
      else if (phase === "change") text = "Cô bán hàng phải trả lại em bao nhiêu? Bấm tờ tiền, rồi bấm “Kiểm tra tiền trả lại”.";
      else text = `Đã mua xong. Tiền trả lại: ${dong(sum(s.paid) - total(s))}.`;
    }
    if (!shop(s) && phase === "done") text = `${text} ${dots(s.target)} = ${fewest(s.target).map(dots).join(" + ")}.`;
    para(ctx, text, mid, y + (small ? 2 : 8), size, maxW, small ? 2 : 3, { bold: !!s._note, color });
    if (foot) fit(ctx, "Tờ tiền vẽ giản lược, chỉ ghi mệnh giá; không giống tiền thật.", mid, h - foot / 2 - 2, 12, maxW, { color: COLORS.muted });
  },
});
