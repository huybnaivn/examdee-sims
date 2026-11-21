import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, SPECIES, IDS, byId, web, energyAt, longestChain, addLink, removeLink, hasLink, removeSpecies, parseLinks, linksText, parseRemoved, removedText, E0 } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
// node positions inside the web box (0–1), roughly by trophic level from the bottom
const POS = {
  co: [0.42, 0.92],
  chauchau: [0.14, 0.72],
  chuot: [0.42, 0.6],
  tho: [0.72, 0.72],
  ech: [0.12, 0.45],
  ran: [0.24, 0.24],
  cu: [0.5, 0.08],
  vikhuan: [0.82, 0.38],
};
const ROLE = { producer: COLORS.green, consumer: COLORS.orange, decomposer: "#8b5e34" };
const LEVEL_COLORS = ["#1f9d6b", "#7cb342", "#f5a524", "#f08c2e", "#e5484d", "#b23a8a", "#7a5af8"];
const MEASURE = document.createElement("canvas").getContext("2d"); // text widths for hit tests
const options = SPECIES.map(sp => ({ value: sp.id, label: sp.name }));
const energyText = e => `${fmt(e, e >= 100 ? 0 : e >= 1 ? 2 : 4)} kJ`;

const REASONS = {
  self: () => "Không thể nối một loài với chính nó.",
  duplicate: () => "Mũi tên này đã có trong lưới.",
  cycle: () => "Bị từ chối: mũi tên này tạo thành vòng khép kín, năng lượng không thể quay ngược lại.",
  removed: () => "Bị từ chối: có loài đã bị loại bỏ khỏi quần xã.",
  diet: (f, t) =>
    byId[t].role === "producer"
      ? `Bị từ chối: ${byId[t].name} là sinh vật sản xuất, không ăn sinh vật khác.`
      : `Bị từ chối: ${byId[t].name} không ăn ${byId[f].name.toLowerCase()}.`,
  unknown: () => "Loài không có trong mô phỏng.",
};

function layout(view) {
  const wide = view.w > view.h * 1.3;
  const pad = 8;
  const webBox = wide
    ? { x: pad, y: 22, w: view.w * 0.58 - pad, h: view.h - 44 }
    : { x: pad, y: 18, w: view.w - 2 * pad, h: view.h * 0.6 - 18 };
  const pyr = wide
    ? { x: view.w * 0.6, y: 10, w: view.w * 0.4 - pad, h: view.h - 20 }
    : { x: pad, y: view.h * 0.6 + 6, w: view.w - 2 * pad, h: view.h * 0.4 - 12 };
  const size = Math.min(view.w, view.h) < 400 ? 11 : 13;
  return { wide, webBox, pyr, size };
}

function nodes(ctx, L) {
  ctx.font = `600 ${L.size}px ${FONT}`;
  const out = {};
  for (const sp of SPECIES) {
    const [u, v] = POS[sp.id];
    const name = sp.role === "decomposer" && L.webBox.w < 420 ? "Vi khuẩn" : sp.name;
    const w = ctx.measureText(name).width + 14;
    const h = L.size * 1.9;
    const x = L.webBox.x + w / 2 + u * (L.webBox.w - w);
    const y = L.webBox.y + h / 2 + v * (L.webBox.h - h);
    out[sp.id] = { x, y, w, h, name };
  }
  return out;
}

const hit = (N, p) => IDS.find(id => Math.abs(p.x - N[id].x) <= N[id].w / 2 + 4 && Math.abs(p.y - N[id].y) <= N[id].h / 2 + 4);

/** Point where the segment from the centre of `n` towards (tx, ty) leaves its box. */
function edge(n, tx, ty, gap = 3) {
  const dx = tx - n.x;
  const dy = ty - n.y;
  const t = Math.min((n.w / 2 + gap) / Math.abs(dx || 1e-9), (n.h / 2 + gap) / Math.abs(dy || 1e-9));
  return { x: n.x + dx * t, y: n.y + dy * t };
}

function afterChange(s, api) {
  const w = web(s);
  if (w.levels > 0) {
    api.emit("pyramid", { levels: w.levels, topEnergy: Number(energyAt(w.levels, s.efficiency).toPrecision(6)), efficiency: s.efficiency }, "result");
  }
}

function tryLink(s, api, from, to) {
  const before = web(s).levels;
  const verdict = addLink(s, from, to);
  if (!verdict.ok) {
    s._msg = { text: REASONS[verdict.reason](from, to), bad: true };
    api.emit("link-rejected", { from, to, reason: verdict.reason }, "action");
    return;
  }
  s._msg = { text: `Đã nối: ${byId[from].name} → ${byId[to].name}`, bad: false };
  api.emit("link-added", { from, to }, "action");
  const after = web(s).levels;
  if (after > before && after >= 3) api.emit("chain-complete", { levels: after }, "goal");
  afterChange(s, api);
}

mount({
  slug: "chuoi-thuc-an",
  version: "1.0.0",
  title: "Chuỗi, lưới thức ăn và tháp năng lượng",
  hint: "Kéo từ loài bị ăn sang loài ăn nó để nối mũi tên. Loại bỏ một loài để xem những loài phụ thuộc vào nó.",
  initialState,
  sanitize(incoming, base) {
    const out = {};
    for (const key of Object.keys(base)) if (typeof incoming[key] === typeof base[key]) out[key] = incoming[key];
    if (!Number.isFinite(out.efficiency)) delete out.efficiency;
    if ("links" in out) out.links = linksText(parseLinks(out.links));
    if ("removed" in out) out.removed = removedText(parseRemoved(out.removed));
    return out;
  },
  controls: [
    { type: "heading", label: "Nối mũi tên (hoặc kéo trên hình)" },
    { type: "select", key: "from", label: "Sinh vật bị ăn (gốc mũi tên)", options },
    { type: "select", key: "to", label: "Sinh vật ăn nó (đầu mũi tên)", options },
    { type: "button", label: "Thêm mũi tên", primary: true, action: (s, api) => tryLink(s, api, s.from, s.to) },
    {
      type: "button",
      label: "Xoá mũi tên này",
      disabled: s => !hasLink(s, s.from, s.to),
      action(s, api) {
        if (!removeLink(s, s.from, s.to)) return;
        s._msg = { text: `Đã xoá: ${byId[s.from].name} → ${byId[s.to].name}`, bad: false };
        api.emit("link-removed", { from: s.from, to: s.to }, "action");
        afterChange(s, api);
      },
    },
    { type: "heading", label: "Loại bỏ một loài" },
    { type: "select", key: "target", label: "Loài", options },
    {
      type: "button",
      label: "Loại bỏ loài này",
      disabled: s => parseRemoved(s.removed).has(s.target),
      action(s, api) {
        const collapsed = removeSpecies(s, s.target);
        s._msg = { text: `Đã loại bỏ ${byId[s.target].name.toLowerCase()}: ${collapsed} loài khác bị chết theo.`, bad: collapsed > 0 };
        api.emit("species-removed", { species: s.target, collapsed }, "action");
        afterChange(s, api);
      },
    },
    {
      type: "button",
      label: "Khôi phục tất cả các loài",
      disabled: s => !s.removed,
      action(s, api) {
        s.removed = "";
        s._msg = null;
        api.emit("species-restored", {}, "action");
        afterChange(s, api);
      },
    },
    { type: "heading", label: "Tháp năng lượng" },
    {
      type: "slider",
      key: "efficiency",
      label: "Hiệu suất sinh thái e",
      min: 5,
      max: 20,
      step: 1,
      unit: "%",
      digits: 0,
      onCommit: afterChange,
    },
  ],
  readouts: [
    { label: "Số bậc dinh dưỡng", value: s => fmt(web(s).levels, 0) },
    { label: "Năng lượng ở bậc cao nhất", value: s => (web(s).levels ? energyText(energyAt(web(s).levels, s.efficiency)) : "–") },
    { label: "Một chuỗi dài nhất", value: s => longestChain(web(s)).map(id => byId[id].name).join(" → ") || "–" },
  ],
  pointer: {
    down(p, s, api, view) {
      const id = hit(nodes(MEASURE, layout(view)), p);
      if (!id) return false;
      s._drag = { from: id, x: p.x, y: p.y };
    },
    move(p, s) {
      if (s._drag) Object.assign(s._drag, { x: p.x, y: p.y });
    },
    up(p, s, api, view) {
      const d = s._drag;
      s._drag = null;
      if (!d) return;
      const to = hit(nodes(MEASURE, layout(view)), p);
      if (!to || to === d.from) {
        // a tap selects the species in the panel
        s.from = s.target = d.from;
        return;
      }
      s.from = d.from;
      s.to = to;
      tryLink(s, api, d.from, to);
    },
  },
  draw(ctx, s, view) {
    const L = layout(view);
    const N = nodes(ctx, L);
    const w = web(s);
    const { size } = L;

    // ---- food web ----
    label(ctx, "Lưới thức ăn", L.webBox.x, 10, { size, bold: true });
    if (!L.wide && view.w >= 640) label(ctx, "Mũi tên: từ sinh vật bị ăn đến sinh vật ăn nó (chiều của dòng năng lượng)", L.webBox.x + 100, 10, { size: 12, color: COLORS.muted });
    if (L.wide) label(ctx, "Mũi tên: từ sinh vật bị ăn đến sinh vật ăn nó (chiều của dòng năng lượng)", L.webBox.x, L.webBox.y + L.webBox.h + 12, { size: 12, color: COLORS.muted });
    for (const [f, t] of w.links) {
      const live = w.alive(f) && w.alive(t);
      const a = edge(N[f], N[t].x, N[t].y, 2);
      const b = edge(N[t], N[f].x, N[f].y, 4);
      ctx.save();
      ctx.globalAlpha = live ? 1 : 0.25;
      arrow(ctx, a.x, a.y, b.x, b.y, t === "vikhuan" ? ROLE.decomposer : COLORS.ink, 2);
      ctx.restore();
    }
    if (s._drag) {
      const a = N[s._drag.from];
      ctx.setLineDash([5, 4]);
      arrow(ctx, a.x, a.y, s._drag.x, s._drag.y, COLORS.blue, 2);
      ctx.setLineDash([]);
    }
    for (const sp of SPECIES) {
      const n = N[sp.id];
      const removed = w.removed.has(sp.id);
      const collapsed = w.collapsed.has(sp.id);
      ctx.beginPath();
      ctx.roundRect(n.x - n.w / 2, n.y - n.h / 2, n.w, n.h, n.h / 2);
      ctx.fillStyle = removed || collapsed ? "#e6e8ee" : "#fff";
      ctx.fill();
      ctx.lineWidth = s.target === sp.id ? 3 : 2;
      ctx.strokeStyle = removed || collapsed ? "#a0a8b8" : ROLE[sp.role];
      if (collapsed) ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, n.name, n.x, n.y, { size, bold: true, align: "center", color: removed || collapsed ? COLORS.muted : COLORS.ink });
      if (removed || collapsed) {
        label(ctx, removed ? "đã loại bỏ" : "chết theo", n.x, n.y + n.h / 2 + size * 0.6, { size: size - 2, align: "center", color: COLORS.red });
        if (removed) {
          ctx.strokeStyle = COLORS.red;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(n.x - n.w / 2 + 4, n.y);
          ctx.lineTo(n.x + n.w / 2 - 4, n.y);
          ctx.stroke();
        }
      }
      const lv = w.level[sp.id];
      if (lv) {
        const bx = n.x + n.w / 2 - 2;
        const by = n.y - n.h / 2 + 1;
        ctx.fillStyle = LEVEL_COLORS[(lv - 1) % LEVEL_COLORS.length];
        ctx.beginPath();
        ctx.arc(bx, by, size * 0.62, 0, Math.PI * 2);
        ctx.fill();
        label(ctx, String(lv), bx, by + 0.5, { size: size - 2, bold: true, align: "center", color: "#fff" });
      }
    }
    if (s._msg) {
      ctx.font = `${size}px ${FONT}`;
      const text = s._msg.text;
      const tw = Math.min(ctx.measureText(text).width + 12, L.webBox.w);
      ctx.fillStyle = s._msg.bad ? "#fdeced" : "#e7f6ef";
      ctx.fillRect(L.webBox.x + L.webBox.w - tw, 2, tw, size * 1.6);
      ctx.save();
      ctx.beginPath();
      ctx.rect(L.webBox.x + L.webBox.w - tw, 2, tw, size * 1.6);
      ctx.clip();
      label(ctx, text, L.webBox.x + L.webBox.w - tw + 6, 2 + size * 0.8, { size, color: s._msg.bad ? COLORS.red : COLORS.green });
      ctx.restore();
    }

    // ---- energy pyramid ----
    const P = L.pyr;
    label(ctx, L.wide || P.w >= 500 ? `Tháp năng lượng (E₀ = ${fmt(E0, 0)} kJ, e = ${fmt(s.efficiency, 0)} %)` : `Tháp năng lượng (e = ${fmt(s.efficiency, 0)} %)`, P.x, P.y + size * 0.6, { size, bold: true });
    const n = w.levels;
    if (!n) {
      label(ctx, "Chưa có chuỗi thức ăn nào bắt đầu từ sinh vật sản xuất.", P.x, P.y + size * 2.4, { size: size - 1, color: COLORS.muted });
      return;
    }
    const top = P.y + size * 1.8;
    const bottom = P.y + P.h - (L.wide ? size * 2.8 : 2);
    const barH = Math.min(L.wide ? 54 : 30, (bottom - top) / n);
    const maxW = L.wide ? P.w * 0.95 : Math.min(P.w * 0.5, 420);
    const left = L.wide ? P.x : P.x + Math.max(0, (P.w - maxW - 140) / 2); // stacked: bars + labels centred
    const minW = maxW * 0.18;
    const span = Math.log10(energyAt(1, s.efficiency) / energyAt(n, s.efficiency)) || 1;
    for (let k = 1; k <= n; k++) {
      const e = energyAt(k, s.efficiency);
      // widths on a logarithmic scale, so that every level stays visible
      const bw = n === 1 ? maxW : minW + ((maxW - minW) * Math.log10(e / energyAt(n, s.efficiency))) / span;
      const y = bottom - barH * k;
      const cx = L.wide ? P.x + P.w / 2 : left + maxW / 2;
      ctx.fillStyle = LEVEL_COLORS[(k - 1) % LEVEL_COLORS.length];
      ctx.fillRect(cx - bw / 2, y + 1, bw, barH - 2);
      const text = `Bậc ${k}: ${energyText(e)}`;
      ctx.font = `600 ${size - 1}px ${FONT}`;
      if (L.wide && ctx.measureText(text).width < bw - 8) {
        label(ctx, text, cx, y + barH / 2, { size: size - 1, align: "center", bold: true, color: "#fff" });
      } else if (L.wide) {
        label(ctx, text, cx + bw / 2 + 6, y + barH / 2, { size: size - 1, bold: true });
      } else {
        label(ctx, text, left + maxW + 8, y + barH / 2, { size: size - 1, bold: true });
      }
    }
    if (L.wide) {
      label(ctx, "Năng lượng bậc k = E₀·eᵏ⁻¹.", P.x, P.y + P.h - size * 1.6, { size: 12, color: COLORS.muted });
      label(ctx, "Độ rộng các bậc vẽ theo thang logarit, không theo tỉ lệ.", P.x, P.y + P.h - size * 0.4, { size: 12, color: COLORS.muted });
    } else {
      label(ctx, "Độ rộng không theo tỉ lệ", left + maxW + 8, top - 2, { size: size - 2, color: COLORS.muted });
    }
  },
});
