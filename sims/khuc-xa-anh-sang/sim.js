import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { MEDIA, mediumOf, initialState, reflectionAngle, refractionAngle, criticalAngle, reflectance } from "./model.js";

const MAX_ANGLE = 89;
const rad = d => (d * Math.PI) / 180;
const layout = view => ({
  o: { x: view.w / 2, y: view.h / 2 },
  R: Math.max(40, Math.min(view.w / 2 - 28, view.h / 2 - 36)),
});

const mediumName = (key, n) => MEDIA.find(m => m.value === key)?.label ?? `Tùy chỉnh`;
const options = [...MEDIA.map(m => ({ value: m.value, label: `${m.label} (n = ${fmt(m.n)})` })), { value: "custom", label: "Tùy chỉnh" }];

// Picking a preset sets the index; moving the index slider switches the preset to match.
const pick = (mKey, nKey) => (s, api) => {
  const m = MEDIA.find(x => x.value === s[mKey]);
  if (m) s[nKey] = m.n;
  api.sync();
};
const tune = (mKey, nKey) => (s, api) => {
  const m = mediumOf(s[nKey]);
  if (m !== s[mKey]) {
    s[mKey] = m;
    api.sync();
  }
};

// One result per finished change (slider released, medium picked, drag ended). The goal fires
// when the learner lands on the critical angle, once until they leave it again.
const CRITICAL_TOLERANCE = 0.5; // degrees, one slider step
const report = (s, api) => {
  const r = refractionAngle(s.n1, s.n2, s.angle);
  // no refracted ray on total internal reflection: the key is left out rather than faked
  api.emit("refraction", { incidence: s.angle, ...(r !== null && { refraction: r }), totalReflection: r === null ? 1 : 0, n1: s.n1, n2: s.n2 }, "result");
  const c = criticalAngle(s.n1, s.n2);
  const at = c !== null && Math.abs(s.angle - c) <= CRITICAL_TOLERANCE;
  if (at && !s._atCritical) api.emit("critical-angle-found", { angle: s.angle, critical: c, n1: s.n1, n2: s.n2 }, "goal");
  s._atCritical = at;
};

function ray(ctx, x1, y1, x2, y2, alpha) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0.3, 1);
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  arrow(ctx, x1, y1, x1 + (x2 - x1) * 0.58, y1 + (y2 - y1) * 0.58, COLORS.red, 3);
  ctx.restore();
}

function arc(ctx, o, radius, from, to, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(o.x, o.y, radius, Math.min(from, to), Math.max(from, to));
  ctx.stroke();
}

mount({
  slug: "khuc-xa-anh-sang",
  version: "1.0.0",
  title: "Khúc xạ ánh sáng",
  hint: "Kéo đèn chiếu để đổi góc tới. Chọn môi trường ở hai bên mặt phân cách.",
  initialState,
  // The preset names are derived from the indices, so host state can never make them disagree.
  sanitize(incoming, base) {
    const out = {};
    for (const key of ["angle", "n1", "n2"]) {
      out[key] = Number.isFinite(incoming[key]) ? incoming[key] : base[key];
    }
    out.n1 = clamp(out.n1, 1, 2.5);
    out.n2 = clamp(out.n2, 1, 2.5);
    out.medium1 = mediumOf(out.n1);
    out.medium2 = mediumOf(out.n2);
    return out;
  },
  controls: [
    { type: "slider", key: "angle", label: "Góc tới i", min: 0, max: MAX_ANGLE, step: 0.5, unit: "°", digits: 1, onCommit: report },
    { type: "heading", label: "Môi trường 1 (chứa tia tới)" },
    { type: "select", key: "medium1", label: "Chất", options, onChange: pick("medium1", "n1"), onCommit: report },
    { type: "slider", key: "n1", label: "Chiết suất n₁", min: 1, max: 2.5, step: 0.01, onChange: tune("medium1", "n1"), onCommit: report },
    { type: "heading", label: "Môi trường 2 (chứa tia khúc xạ)" },
    { type: "select", key: "medium2", label: "Chất", options, onChange: pick("medium2", "n2"), onCommit: report },
    { type: "slider", key: "n2", label: "Chiết suất n₂", min: 1, max: 2.5, step: 0.01, onChange: tune("medium2", "n2"), onCommit: report },
  ],
  readouts: [
    { label: "Góc tới i", value: s => `${fmt(s.angle, 1)}°` },
    { label: "Góc phản xạ i′", value: s => `${fmt(reflectionAngle(s.angle), 1)}°` },
    {
      label: "Góc khúc xạ r",
      value: s => {
        const r = refractionAngle(s.n1, s.n2, s.angle);
        return r === null ? "không có tia khúc xạ" : `${fmt(r, 1)}°`;
      },
    },
    {
      label: "Góc giới hạn",
      value: s => {
        const c = criticalAngle(s.n1, s.n2);
        return c === null ? "không có" : `${fmt(c, 1)}°`;
      },
    },
    { label: "Phần ánh sáng bị phản xạ", value: s => `${fmt(reflectance(s.n1, s.n2, s.angle) * 100, 1)} %` },
  ],
  pointer: {
    down(p, s, api, view) {
      const { o } = layout(view);
      if (p.y > o.y) return false;
      this.move(p, s, api, view);
      return true;
    },
    move(p, s, api, view) {
      const { o } = layout(view);
      const a = (Math.atan2(o.x - p.x, o.y - p.y) * 180) / Math.PI;
      s.angle = clamp(Math.round(a * 2) / 2, 0, MAX_ANGLE);
    },
    up(p, s, api) {
      api.emit("aim", { angle: s.angle });
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const { o, R } = layout(view);
    const i = rad(s.angle);
    const r = refractionAngle(s.n1, s.n2, s.angle);
    const crit = criticalAngle(s.n1, s.n2);
    const refl = reflectance(s.n1, s.n2, s.angle);
    const small = view.w < 520;
    const size = small ? 12 : 14;

    // the two media, tinted by optical density
    const tint = n => `rgba(47, 111, 237, ${0.04 + (n - 1) * 0.2})`;
    ctx.fillStyle = tint(s.n1);
    ctx.fillRect(0, 0, view.w, o.y);
    ctx.fillStyle = tint(s.n2);
    ctx.fillRect(0, o.y, view.w, view.h - o.y);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, o.y);
    ctx.lineTo(view.w, o.y);
    ctx.stroke();
    label(ctx, `Môi trường 1: ${mediumName(s.medium1)}, n₁ = ${fmt(s.n1)}`, 12, 18, { size, bold: true });
    label(ctx, `Môi trường 2: ${mediumName(s.medium2)}, n₂ = ${fmt(s.n2)}`, 12, view.h - 18, { size, bold: true });
    label(ctx, "Mặt phân cách", view.w - 12, o.y - 12, { size: size - 1, align: "right", color: COLORS.muted });

    // protractor ticks and the normal
    ctx.strokeStyle = "rgba(107, 120, 144, 0.45)";
    ctx.lineWidth = 1.5;
    for (let d = 0; d < 360; d += 10) {
      const a = rad(d);
      const r1 = R * 0.9;
      const r2 = R * (d % 30 === 0 ? 0.96 : 0.93);
      ctx.beginPath();
      ctx.moveTo(o.x + r1 * Math.sin(a), o.y - r1 * Math.cos(a));
      ctx.lineTo(o.x + r2 * Math.sin(a), o.y - r2 * Math.cos(a));
      ctx.stroke();
    }
    ctx.strokeStyle = COLORS.muted;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(o.x, o.y - R);
    ctx.lineTo(o.x, o.y + R);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, "Pháp tuyến", o.x + 8, o.y + R - 8, { size: size - 1, color: COLORS.muted });

    // critical-angle direction, when total internal reflection is possible
    if (crit !== null) {
      const c = rad(crit);
      const at = rho => [o.x - rho * Math.sin(c), o.y - rho * Math.cos(c)];
      // starts away from the centre so it stays clear of the angle labels
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.moveTo(...at(Math.min(R * 0.8, Math.max(R * 0.55, R * 0.36 + 64))));
      ctx.lineTo(...at(R * 0.98));
      ctx.stroke();
      ctx.setLineDash([]);
      const [lx, ly] = at(R + 12);
      label(ctx, `Góc giới hạn ${fmt(crit, 1)}°`, Math.max(8, lx), Math.max(38, ly), {
        size: size - 1, color: COLORS.orange, bold: true, align: lx < 120 ? "left" : "right",
      });
    }

    // rays: incident, reflected, refracted (brightness follows the reflected fraction)
    const src = { x: o.x - R * Math.sin(i), y: o.y - R * Math.cos(i) };
    ray(ctx, src.x, src.y, o.x, o.y, 1);
    ray(ctx, o.x, o.y, o.x + R * Math.sin(i), o.y - R * Math.cos(i), refl);
    if (r !== null) {
      const rr = rad(r);
      ray(ctx, o.x, o.y, o.x + R * Math.sin(rr), o.y + R * Math.cos(rr), 1 - refl);
    }

    // angles
    const up = -Math.PI / 2;
    const ar = Math.min(54, R * 0.36);
    arc(ctx, o, ar, up - i, up, COLORS.blue);
    arc(ctx, o, ar - 8, up, up + i, COLORS.green);
    // Angle labels: between the normal and the ray when there is room, otherwise outside the ray.
    const angleLabel = (text, ang, sx, sy, color) => {
      const inside = ang > rad(50);
      const a = inside ? ang / 2 : ang + 0.22;
      const rho = inside ? ar + 30 : ar + 4;
      label(ctx, text, o.x + sx * rho * Math.sin(a), o.y + sy * rho * Math.cos(a), {
        size, color, bold: true, align: inside ? "center" : sx < 0 ? "right" : "left",
      });
    };
    angleLabel(`i = ${fmt(s.angle, 1)}°`, i, -1, -1, COLORS.blue);
    angleLabel(`i′ = ${fmt(reflectionAngle(s.angle), 1)}°`, i, 1, -1, COLORS.green);
    if (r !== null) {
      const rr = rad(r);
      arc(ctx, o, ar, Math.PI / 2 - rr, Math.PI / 2, COLORS.purple);
      angleLabel(`r = ${fmt(r, 1)}°`, rr, 1, 1, COLORS.purple);
    } else {
      label(ctx, "Phản xạ toàn phần", o.x, o.y + R * 0.4, { size: size + 4, align: "center", color: COLORS.orange, bold: true });
      label(ctx, "Góc tới lớn hơn góc giới hạn: không có tia khúc xạ", o.x, o.y + R * 0.4 + 24, {
        size: size - 1, align: "center", color: COLORS.muted,
      });
    }

    // ray names
    if (!small) {
      label(ctx, "Tia tới", (src.x + o.x) / 2 - 12, (src.y + o.y) / 2 + 12, { size: 12, align: "right", color: COLORS.muted });
      label(ctx, "Tia phản xạ", o.x + (R / 2) * Math.sin(i) + 12, o.y - (R / 2) * Math.cos(i) + 12, { size: 12, color: COLORS.muted });
      if (r !== null) {
        const rr = rad(r);
        label(ctx, "Tia khúc xạ", o.x + R * 0.6 * Math.sin(rr) + 12, o.y + R * 0.6 * Math.cos(rr) - 8, { size: 12, color: COLORS.muted });
      }
    }

    // the lamp, pointing at the point of incidence
    ctx.save();
    ctx.translate(src.x, src.y);
    ctx.rotate(Math.atan2(o.y - src.y, o.x - src.x));
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.roundRect(-34, -9, 34, 18, 4);
    ctx.fill();
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(-4, -9, 4, 18);
    ctx.restore();

    // point of incidence
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 4, 0, Math.PI * 2);
    ctx.fill();
  },
});
