import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  DAYS, PROTECT, MEMORY_AFTER, MAX_EXPOSURES, G, N, INFECTIOUS_DAYS,
  initialState, cleanExposures, antibody, illness, stats, outbreak, census, nextSeed, sanitize,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const DAYS_PER_SECOND = 12; // replay speed of the antibody graph
const PEOPLE = { vaccinated: COLORS.blue, susceptible: "#cbd3e1", sick: COLORS.red, recovered: COLORS.orange };
const isAntibody = s => s.view === "antibody";
const isHerd = s => s.view === "herd";
const typeName = st => (st.secondary ? "thứ phát" : "nguyên phát");

const textWidth = (ctx, text, size, bold) => {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  return ctx.measureText(text).width;
};
/** A label shrunk (down to 9 px) to fit `max` px. */
const line = (ctx, text, x, y, max, opts) => {
  const w = textWidth(ctx, text, opts.size, opts.bold);
  label(ctx, text, x, y, { ...opts, size: w > max ? Math.max(9, (opts.size * max) / w) : opts.size });
};

/** Everything derived from the exposure list, computed once per list. */
function facts(s) {
  const key = JSON.stringify(s.exposures);
  if (s._ab?.key !== key) {
    const list = cleanExposures(s.exposures);
    const curve = Array.from({ length: DAYS * 4 + 1 }, (_, i) => antibody(list, i / 4));
    s._ab = { key, list, curve, max: Math.max(0, ...curve), st: list.map((_, i) => ({ ...stats(list, i), ill: illness(list, i) })) };
  }
  return s._ab;
}

/** The spread run for the current seed and coverage, computed once. */
function runOf(s) {
  const key = `${s.seed}:${s.coverage}`;
  if (s._run?.key !== key) s._run = { key, ...outbreak(s.seed, s.coverage) };
  return s._run;
}

function drawAntibody(ctx, s, view) {
  const small = view.w < 560 || view.h < 430;
  const size = small ? 11 : 13;
  const f = facts(s);
  const now = clamp(s.time, 0, DAYS);
  const left = small ? 30 : 48;
  const right = view.w - (small ? 10 : 22);
  const X = d => left + ((right - left) * d) / DAYS;

  line(ctx, "Nồng độ kháng thể trong máu (đơn vị tương đối, U)", left, small ? 11 : 16, right - left, { size: size + 1, bold: true });
  const memoryDay = f.list.length ? f.list[0].t + MEMORY_AFTER : Infinity;
  const memory = memoryDay <= now ? `Tế bào nhớ: có từ ngày ${fmt(memoryDay, 0)}` : "Tế bào nhớ: chưa có";
  line(ctx, memory, left, small ? 26 : 36, right - left, { size, color: memoryDay <= now ? COLORS.green : COLORS.muted, bold: memoryDay <= now });

  // tags of the exposures, in as many rows as they need so they do not overlap
  const rowH = size * 2 + 6;
  const tagTop = small ? 36 : 50;
  const ends = [];
  const tags = f.list.map((e, i) => {
    const st = f.st[i];
    const vaccine = e.kind === "vaccine";
    const lines = [`${i + 1}. ${vaccine ? "tiêm vaccine" : "nhiễm mầm bệnh"}`, vaccine ? "không gây bệnh" : st.illnessDays > 0 ? `bị bệnh ${fmt(st.illnessDays, 1)} ngày` : "không bị bệnh"];
    const w = Math.max(textWidth(ctx, lines[0], size, true), textWidth(ctx, lines[1], size, false));
    const flip = X(e.t) + 4 + w > view.w - 4;
    const x0 = flip ? X(e.t) - 4 - w : X(e.t) + 4;
    let row = ends.findIndex(end => x0 > end + 6);
    if (row < 0) row = ends.length;
    ends[row] = x0 + w;
    return { e, st, vaccine, lines, flip, row, color: vaccine ? COLORS.blue : COLORS.red };
  });
  const top = tagTop + Math.max(1, ends.length) * rowH + 4;
  const bottom = view.h - (small ? 32 : 44);
  const yMax = Math.max(12, Math.ceil((f.max * 1.12) / 4) * 4);
  const Y = a => bottom - ((bottom - top) * a) / yMax;

  // grid and axes
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const a = (yMax * i) / 4;
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(left, Y(a));
    ctx.lineTo(right, Y(a));
    ctx.stroke();
    label(ctx, fmt(a, 0), left - 5, Y(a), { size: 10, align: "right", color: COLORS.muted });
  }
  for (let d = 0; d <= DAYS; d += small ? 20 : 10) label(ctx, fmt(d, 0), X(d), bottom + 10, { size: 10, align: "center", color: COLORS.muted });
  label(ctx, "ngày", right, bottom + 22, { size: 10, align: "right", color: COLORS.muted });
  line(ctx, "Mô hình minh hoạ, không phải số liệu của một bệnh cụ thể", left, bottom + 22, right - left - 34, { size: 10, color: COLORS.muted });
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  // days of illness
  for (const { ill } of f.st) {
    if (!(ill.days > 0) || ill.start >= now) continue;
    const x0 = X(ill.start);
    const x1 = X(Math.min(ill.end, now));
    ctx.fillStyle = "rgba(229, 72, 77, 0.16)";
    ctx.fillRect(x0, top, x1 - x0, bottom - top);
    if (x1 - x0 > 44) label(ctx, "bị bệnh", (x0 + x1) / 2, (top + bottom) / 2, { size: 10, align: "center", color: COLORS.red });
  }

  // protective level
  ctx.strokeStyle = COLORS.green;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(left, Y(PROTECT));
  ctx.lineTo(right, Y(PROTECT));
  ctx.stroke();
  label(ctx, `mức đủ bảo vệ ${fmt(PROTECT, 1)} U`, right - 4, Y(PROTECT) - 8, { size: 10, color: COLORS.green, align: "right" });

  // exposures
  for (const t of tags) {
    if (t.e.t > now) continue;
    const x = X(t.e.t);
    const y = tagTop + t.row * rowH;
    ctx.strokeStyle = t.color;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    const tx = t.flip ? x - 4 : x + 4;
    const align = t.flip ? "right" : "left";
    label(ctx, t.lines[0], tx, y + size / 2, { size, bold: true, color: t.color, align });
    label(ctx, t.lines[1], tx, y + size * 1.5 + 2, { size, color: COLORS.ink, align });
  }
  ctx.setLineDash([]);

  // antibody level up to the cursor
  ctx.strokeStyle = COLORS.purple;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= Math.floor(now * 4); i++) ctx[i ? "lineTo" : "moveTo"](X(i / 4), Y(f.curve[i]));
  ctx.lineTo(X(now), Y(antibody(f.list, now)));
  ctx.stroke();

  // peak of each response; a label that would cover an earlier one moves up, or is left out
  const placed = [];
  for (const st of f.st) {
    const day = st.day + st.timeToPeak;
    if (day > now) continue;
    ctx.fillStyle = COLORS.purple;
    ctx.beginPath();
    ctx.arc(X(day), Y(st.peak), 4, 0, Math.PI * 2);
    ctx.fill();
    const text = `${typeName(st)}: ${fmt(st.peak, 1)} U sau ${fmt(st.timeToPeak, 0)} ngày`;
    const w = textWidth(ctx, text, size, true);
    const cx = clamp(X(day), left + 4 + w / 2, right - w / 2);
    for (let y = Y(st.peak) - 13; y >= top + 8; y -= size + 4) {
      if (placed.some(r => Math.abs(r.cx - cx) < (r.w + w) / 2 + 4 && Math.abs(r.y - y) < size + 3)) continue;
      placed.push({ cx, y, w });
      ctx.fillStyle = "rgba(247, 249, 253, 0.85)";
      ctx.fillRect(cx - w / 2 - 2, y - size / 2 - 1, w + 4, size + 3);
      label(ctx, text, cx, y, { size, bold: true, align: "center", color: COLORS.purple });
      break;
    }
  }

  if (now < DAYS) {
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(now), top);
    ctx.lineTo(X(now), bottom);
    ctx.stroke();
  }
  if (!f.list.length) label(ctx, "Chưa có lần tiếp xúc nào: hãy thêm ở bảng bên", (left + right) / 2, (top + bottom) / 2, { size, align: "center", color: COLORS.muted });
}

function drawHerd(ctx, s, view) {
  const small = view.w < 560 || view.h < 430;
  const size = small ? 12 : 14;
  const run = runOf(s);
  const done = s.day >= run.end;
  const day = Math.min(Math.floor(s.day), run.end);
  const c = census(run, day);
  const everInfected = (c.sick + c.recovered) / N;

  const head = done
    ? `Dịch dừng sau ${run.end} ngày: ${fmt(run.fraction * 100, 1)} % số người đã nhiễm`
    : `Ngày ${day}: ${c.sick} người đang bệnh, ${fmt(everInfected * 100, 1)} % số người đã nhiễm`;
  line(ctx, head, view.w / 2, small ? 11 : 16, view.w - 16, { size: size + 1, bold: true, align: "center" });
  const verdict = done
    ? run.stopped
      ? "Ổ dịch bị chặn (không quá 2 % nhiễm): người chưa tiêm cũng được bảo vệ"
      : "Chưa chặn được dịch (hơn 2 % số người đã nhiễm): cần nhiều người tiêm hơn"
    : day === 0
      ? "Bấm ▶ Chạy để xem dịch lây lan từ các ca bệnh đầu tiên"
      : "Mỗi ngày, người đang bệnh có thể lây cho người chưa tiêm ở ô bên cạnh";
  line(ctx, verdict, view.w / 2, small ? 27 : 38, view.w - 16, { size, align: "center", bold: done, color: done ? (run.stopped ? COLORS.green : COLORS.red) : COLORS.muted });

  const top = small ? 40 : 54;
  const twoRows = view.w < 520;
  const legendH = (twoRows ? 2 : 1) * (size + 6) + 4;
  const noteH = 16;
  const side = Math.max(60, Math.min(view.w - 16, view.h - top - legendH - noteH - 4));
  const cell = side / G;
  const x0 = (view.w - side) / 2;
  const gap = cell > 5 ? 1 : 0.5;
  for (let i = 0; i < N; i++) {
    const d = run.infDay[i];
    const kind = run.vaccinated[i] ? "vaccinated" : d >= 0 && d <= day ? (day < d + INFECTIOUS_DAYS ? "sick" : "recovered") : "susceptible";
    ctx.fillStyle = PEOPLE[kind];
    ctx.fillRect(x0 + (i % G) * cell, top + Math.floor(i / G) * cell, cell - gap, cell - gap);
  }

  const items = [
    ["vaccinated", `đã tiêm (miễn dịch): ${c.vaccinated}`],
    ["susceptible", `chưa nhiễm: ${c.susceptible}`],
    ["sick", `đang bệnh: ${c.sick}`],
    ["recovered", `đã khỏi: ${c.recovered}`],
  ];
  const cols = twoRows ? 2 : 4;
  const colW = (view.w - 16) / cols;
  items.forEach(([kind, text], i) => {
    const x = 8 + (i % cols) * colW + (twoRows ? colW * 0.08 : 0);
    const y = top + side + 4 + Math.floor(i / cols) * (size + 6) + (size + 6) / 2;
    ctx.fillStyle = PEOPLE[kind];
    ctx.fillRect(x, y - 5, 10, 10);
    line(ctx, text, x + 15, y, colW - 20, { size: size - 1 });
  });
  line(ctx, "Mô hình: mỗi ô là 1 người, tiếp xúc với 8 ô xung quanh", view.w / 2, view.h - noteH / 2 - 1, view.w - 12, { size: 10, align: "center", color: COLORS.muted });
}

mount({
  slug: "he-mien-dich",
  version: "1.0.0",
  title: "Hệ miễn dịch và vaccine",
  hint: "Thêm các lần tiêm vaccine hoặc nhiễm mầm bệnh để so sánh đáp ứng miễn dịch lần đầu và lần sau. Ở phần miễn dịch cộng đồng, đổi tỉ lệ người đã tiêm rồi bấm ▶ Chạy để xem dịch lây lan.",
  initialState,
  sanitize,
  step(s, dt, api) {
    if (isAntibody(s)) {
      if (s.time >= DAYS) {
        if (s._ended) return; // finished in this very batch of steps: stay there until it has been drawn
        s.time = 0; // ▶ Chạy on a finished graph replays it from day 0
      }
      s.time = Math.min(DAYS, s.time + dt * DAYS_PER_SECOND);
      if (s.time >= DAYS) {
        s._ended = true;
        api.pause();
      }
      return;
    }
    const run = runOf(s);
    if (s.day >= run.end) {
      if (s._ended) return;
      s.day = 0; // ▶ Chạy on a finished run starts it again
    }
    s.day = Math.min(run.end, s.day + dt * Math.max(6, run.end / 8)); // a run takes 8 s at most
    if (s.day < run.end) return;
    s._ended = true;
    api.pause();
    api.emit("spread-finished", { coverage: s.coverage, infectedFraction: run.fraction, infected: run.infected, days: run.end }, "result");
    if (run.stopped) {
      // minimal = 1 when one slider step less coverage would not have stopped this outbreak
      const minimal = s.coverage < 5 || !outbreak(s.seed, s.coverage - 5).stopped ? 1 : 0;
      api.emit("outbreak-stopped", { coverage: s.coverage, infectedFraction: run.fraction, minimal }, "goal");
    }
  },
  controls: [
    {
      type: "select",
      key: "view",
      label: "Nội dung",
      options: [
        { value: "antibody", label: "Kháng thể sau mỗi lần tiếp xúc kháng nguyên" },
        { value: "herd", label: "Miễn dịch cộng đồng" },
      ],
      onChange: (s, api) => api.pause(),
    },
    { type: "heading", label: "LẦN TIẾP XÚC KHÁNG NGUYÊN TIẾP THEO", visible: isAntibody },
    {
      type: "select",
      key: "exposeKind",
      label: "Cách tiếp xúc",
      options: [
        { value: "vaccine", label: "Tiêm vaccine" },
        { value: "pathogen", label: "Nhiễm mầm bệnh" },
      ],
      visible: isAntibody,
    },
    { type: "slider", key: "exposeDay", label: "Thời điểm", min: 0, max: 90, step: 1, format: v => `ngày ${fmt(v, 0)}`, visible: isAntibody },
    {
      type: "button",
      label: "Thêm lần tiếp xúc này",
      primary: true,
      event: "expose",
      visible: isAntibody,
      disabled: s => cleanExposures(s.exposures).length >= MAX_EXPOSURES,
      action(s, api) {
        api.pause();
        const list = cleanExposures([...cleanExposures(s.exposures), { t: s.exposeDay, kind: s.exposeKind }]);
        s.exposures = list;
        s.time = DAYS;
        const i = list.findLastIndex(e => e.t === s.exposeDay && e.kind === s.exposeKind);
        api.emit("immune-response", stats(list, i), "result");
      },
    },
    {
      type: "button",
      label: "Xoá hết các lần tiếp xúc",
      event: "clear-exposures",
      visible: isAntibody,
      disabled: s => !cleanExposures(s.exposures).length,
      action(s, api) {
        api.pause();
        s.exposures = [];
        s.time = DAYS;
      },
    },
    {
      type: "slider",
      key: "coverage",
      label: "Tỉ lệ người đã tiêm vaccine",
      min: 0,
      max: 100,
      step: 5,
      unit: "%",
      digits: 0,
      visible: isHerd,
      onChange: s => (s.day = 0),
    },
    {
      type: "button",
      label: "Đổi sang một cộng đồng khác",
      event: "new-population",
      visible: isHerd,
      action(s, api) {
        api.pause();
        s.seed = nextSeed(s.seed);
        s.day = 0;
      },
    },
  ],
  readouts: [
    {
      label: "Đáp ứng miễn dịch gần nhất",
      value: s => {
        const st = facts(s).st.at(-1);
        return st ? `${typeName(st)}, đỉnh ${fmt(st.peak, 1)} U sau ${fmt(st.timeToPeak, 0)} ngày` : "–";
      },
    },
    { label: "Tổng số ngày bị bệnh", value: s => `${fmt(facts(s).st.reduce((a, st) => a + st.illnessDays, 0), 1)} ngày` },
    {
      label: "Cộng đồng: số người đã nhiễm",
      value: s => {
        const run = runOf(s);
        const c = census(run, Math.min(Math.floor(s.day), run.end));
        return `${fmt(((c.sick + c.recovered) / N) * 100, 1)} % (ngày ${Math.min(Math.floor(s.day), run.end)})`;
      },
    },
  ],
  draw(ctx, s, view) {
    s._ended = false;
    if (isHerd(s)) drawHerd(ctx, s, view);
    else drawAntibody(ctx, s, view);
  },
});
