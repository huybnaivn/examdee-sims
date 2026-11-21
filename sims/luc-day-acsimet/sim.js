import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  TANK_W, LEVEL0, Z_MAX, initialState, step, lift, unsettle, level, submergedVolume, submergedFraction,
  weight, buoyancy, outcome, blockDensity, blockSide, liquidDensity,
} from "./model.js";

const WORLD_H = Z_MAX + 0.2; // room for the largest block at its highest position
const TANK_H = 0.5;
const TINT = {
  water: "rgba(47, 111, 237, 0.3)",
  oil: "rgba(240, 180, 40, 0.42)",
  brine: "rgba(31, 157, 107, 0.3)",
  mercury: "rgba(120, 130, 150, 0.55)",
  custom: "rgba(122, 90, 248, 0.3)",
};
const NAME = { floating: "Vật nổi", suspended: "Vật lơ lửng", sunk: "Vật chìm xuống đáy" };
const CODE = { floating: 1, suspended: 0, sunk: -1 };

const geom = view => {
  const small = view.w < 520 || view.h < 420;
  const top = small ? 58 : 96;
  const bottom = small ? 40 : 78; // room under the tank for the weight arrow of a block lying on the floor
  const scale = Math.min((view.h - top - bottom) / WORLD_H, (view.w - (small ? 150 : 300)) / TANK_W);
  const x0 = (view.w - TANK_W * scale) / 2;
  const floor = view.h - bottom;
  return { small, scale, x0, x1: x0 + TANK_W * scale, floor, Y: m => floor - m * scale };
};
const blockRect = (s, g) => {
  const side = blockSide(s) * g.scale;
  return { x: (g.x0 + g.x1) / 2 - side / 2, y: g.Y(s.z) - side, side };
};
// While a slider is being dragged the block keeps moving but reports nothing; once the adjustment is
// committed it is unsettled again, so exactly one `settled` follows, when it is at rest.
const moved = s => {
  s._adjusting = true;
  unsettle(s);
};
const committed = s => {
  s._adjusting = false;
  unsettle(s);
};

mount({
  slug: "luc-day-acsimet",
  version: "1.0.0",
  title: "Lực đẩy Ác-si-mét",
  hint: "Kéo vật lên xuống rồi thả tay, hoặc đổi khối lượng, thể tích và chất lỏng.",
  initialState,
  autoplay: true,
  step(s, dt, api) {
    if (s._held || s.settled) return;
    step(s, dt);
    if (!s.settled || s._adjusting) return;
    // One result per time the block comes to rest.
    const data = { state: CODE[outcome(s)], submergedFraction: submergedFraction(s), buoyantForce: buoyancy(s), weight: weight(s) };
    api.emit("settled", data, "result");
  },
  controls: [
    { type: "heading", label: "Vật" },
    { type: "slider", key: "mass", label: "Khối lượng m", min: 0.1, max: 10, step: 0.1, unit: "kg", digits: 1, onChange: moved, onCommit: committed },
    { type: "slider", key: "volume", label: "Thể tích V", min: 0.5, max: 4, step: 0.1, unit: "dm³", digits: 1, onChange: moved, onCommit: committed },
    { type: "heading", label: "Chất lỏng" },
    {
      type: "select",
      key: "liquid",
      label: "Chất lỏng",
      onChange: moved,
      onCommit: committed,
      options: [
        { value: "water", label: "Nước (D = 1 000 kg/m³)" },
        { value: "oil", label: "Dầu (D = 800 kg/m³)" },
        { value: "brine", label: "Nước muối (D = 1 200 kg/m³)" },
        { value: "mercury", label: "Thủy ngân (D = 13 600 kg/m³)" },
        { value: "custom", label: "Chất lỏng khác (tự chọn D)" },
      ],
    },
    {
      type: "slider", key: "customDensity", label: "Khối lượng riêng chất lỏng", min: 500, max: 14000, step: 100,
      unit: "kg/m³", digits: 0, onChange: moved, onCommit: committed, visible: s => s.liquid === "custom",
    },
    {
      type: "button",
      label: "Nhấc vật lên rồi thả",
      action(s, api) {
        lift(s);
        api.play();
        const data = { height: s.z, submergedFraction: 0 };
        api.emit("release", data);
      },
    },
  ],
  readouts: [
    { label: "Khối lượng riêng của vật D", value: s => `${fmt(blockDensity(s), 0)} kg/m³` },
    { label: "Trọng lượng P = 10·m", value: s => `${fmt(weight(s), 1)} N` },
    { label: "Lực đẩy Ác-si-mét F_A = d·V chìm", value: s => `${fmt(buoyancy(s), 1)} N` },
    { label: "Thể tích phần chìm", value: s => `${fmt(submergedVolume(s) * 1e3)} dm³ (${fmt(submergedFraction(s) * 100, 0)} %)` },
    { label: "Mực chất lỏng dâng thêm", value: s => `${fmt((level(s) - LEVEL0) * 100)} cm` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      const b = blockRect(s, g);
      const pad = 14;
      if (p.x < b.x - pad || p.x > b.x + b.side + pad || p.y < b.y - pad || p.y > b.y + b.side + pad) return false;
      s._held = true;
      s._grab = p.y - g.Y(s.z);
      unsettle(s);
    },
    move(p, s, api, view) {
      const g = geom(view);
      s.z = clamp((g.floor - (p.y - s._grab)) / g.scale, 0, Z_MAX);
    },
    up(p, s, api) {
      s._held = false;
      unsettle(s);
      api.play();
      const data = { height: s.z, submergedFraction: submergedFraction(s) };
      api.emit("release", data);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    const { small, scale, x0, x1, floor, Y } = g;
    const b = blockRect(s, g);
    const lv = level(s);
    const size = small ? 12 : 14;
    const kind = outcome(s);
    const P = weight(s);
    const FA = buoyancy(s);

    // status
    const sign = kind === "floating" ? "<" : kind === "sunk" ? ">" : "=";
    const status = s._held
      ? "Đang giữ vật"
      : !s.settled
        ? "Vật đang chuyển động…"
        : kind === "floating"
          ? `${NAME[kind]}: chìm ${fmt(submergedFraction(s) * 100, 0)} % thể tích`
          : `${NAME[kind]} (${kind === "sunk" ? "P > F_A" : "F_A = P"})`;
    label(ctx, status, view.w / 2, small ? 12 : 22, { align: "center", size: small ? 14 : 18, bold: true });
    label(ctx, `D vật = ${fmt(blockDensity(s), 0)} ${sign} D lỏng = ${fmt(liquidDensity(s), 0)} kg/m³`, view.w / 2, small ? 30 : 48, {
      align: "center", size, color: COLORS.muted,
    });

    // block, then the liquid over it so the submerged part looks under the surface
    ctx.fillStyle = "#c79a63";
    ctx.fillRect(b.x, b.y, b.side, b.side);
    ctx.fillStyle = TINT[s.liquid];
    ctx.fillRect(x0, Y(lv), x1 - x0, floor - Y(lv));
    ctx.strokeStyle = "#8a6435";
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.side, b.side);

    // tank walls and a centimetre scale on the right wall
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x0, Y(TANK_H));
    ctx.lineTo(x0, floor);
    ctx.lineTo(x1, floor);
    ctx.lineTo(x1, Y(TANK_H));
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let cm = 0; cm <= 50; cm += 5) {
      const y = Y(cm / 100);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x1 + (cm % 10 ? 4 : 8), y);
      ctx.stroke();
      if (cm % 10 === 0 && cm) label(ctx, `${cm}${cm === 50 && !small ? " cm" : ""}`, x1 + 11, y, { size: small ? 10 : 12, color: COLORS.muted });
    }

    // liquid surface now, and where it was before the block went in
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, Y(lv));
    ctx.lineTo(x1, Y(lv));
    ctx.stroke();
    if (lv - LEVEL0 > 1e-4) {
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x0 - 6, Y(LEVEL0));
      ctx.lineTo(x1, Y(LEVEL0));
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, small ? "mực đầu" : "mực ban đầu", x0 - 9, Y(LEVEL0) + 7, { align: "right", size: small ? 10 : 12, color: COLORS.muted });
      label(ctx, `dâng ${fmt((lv - LEVEL0) * 100)} cm`, x0 - 9, Y(lv) - 7, { align: "right", size: small ? 10 : 12, color: COLORS.blue, bold: true });
      if (!small) label(ctx, `= ${fmt(submergedVolume(s) * 1e3)} dm³ bị chiếm chỗ`, x0 - 9, Y(lv) - 23, { align: "right", size: 12, color: COLORS.blue });
    }

    // forces: values in a fixed row under the heading, arrows drawn to one scale and tagged by name
    const row = small ? 47 : 76;
    label(ctx, `P = ${fmt(P, 1)} N`, view.w / 2 - 12, row, { align: "right", size: size + 1, bold: true, color: COLORS.red });
    label(ctx, `F_A = ${fmt(FA, 1)} N`, view.w / 2 + 12, row, { size: size + 1, bold: true, color: COLORS.blue });
    const cx = b.x + b.side / 2;
    const dx = Math.max(b.side / 4, 9);
    const yP = b.y + b.side / 2; // the weight acts at the centre of the block
    const perN = Math.min(scale * 0.01, (scale * 0.26) / Math.max(P, FA), (view.h - (small ? 18 : 32) - yP) / P);
    arrow(ctx, cx - dx, yP, cx - dx, yP + P * perN, COLORS.red);
    label(ctx, "P", cx - dx - 7, yP + P * perN - 7, { align: "right", size, bold: true, color: COLORS.red });
    if (FA > 0) {
      const subH = (submergedVolume(s) / (blockSide(s) * 0.1)) * scale; // submerged height, px
      const yF = Y(s.z) - subH / 2; // centre of the submerged part
      arrow(ctx, cx + dx, yF, cx + dx, yF - FA * perN, COLORS.blue);
      label(ctx, "F_A", cx + dx + 7, yF - FA * perN + 7, { size, bold: true, color: COLORS.blue });
    }

    label(
      ctx,
      small ? "Bình và vật cùng dày 1 dm · g = 10 N/kg" : "Bình và vật cùng dày 1 dm nên hình vẽ đúng tỉ lệ. Lấy g = 10 N/kg (d = 10·D). Hai vectơ lực vẽ cùng một tỉ lệ.",
      view.w / 2, view.h - (small ? 9 : 18), { align: "center", size: small ? 10 : 12, color: COLORS.muted }
    );
  },
});
