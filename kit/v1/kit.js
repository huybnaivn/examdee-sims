// ExamDee sim kit v1. Zero dependencies, no build step.
// A sim calls mount(def); the kit owns layout, controls, the frame loop and the host bridge.
// Host <-> sim protocol is documented in /PROTOCOL.md. Only add to it, never change meanings.

const PROTOCOL = 1;

// Origins allowed to drive a sim through postMessage. Anything else is ignored.
const HOST_ORIGINS = [
  /^https:\/\/([a-z0-9-]+\.)*examdee\.ai-vietnam\.vn$/,
  /^https:\/\/([a-z0-9-]+\.)*examdee\.vn$/,
  /^http:\/\/(localhost|127\.0\.0\.1|[a-z0-9-]+\.localhost)(:\d+)?$/,
];

const DT = 1 / 120; // fixed physics step, seconds

// Every event belongs to exactly one kind. Closed list: add here and in PROTOCOL.md, never rename.
//   param     – a control was changed            data: { key, value }
//   transport – play / pause / reset
//   action    – the learner did something in the scene (drag, launch, drop)
//   result    – the sim produced a measurable outcome   data: numbers keyed by quantity
//   goal      – a notable condition was reached (balanced, resonance, solved)
export const EVENT_KINDS = ["param", "transport", "action", "result", "goal"];

export const COLORS = {
  ink: "#1f2a44",
  muted: "#6b7890",
  grid: "#e3e8f2",
  bg: "#f7f9fd",
  blue: "#2f6fed",
  red: "#e5484d",
  green: "#1f9d6b",
  orange: "#f08c2e",
  purple: "#7a5af8",
  yellow: "#f5c518",
};

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Vietnamese number format: decimal comma, at most `digits` decimals. */
export const fmt = (n, digits = 2) => {
  if (!Number.isFinite(n)) return "–";
  if (Math.abs(n) < 0.5 * 10 ** -digits) n = 0; // never print "-0"
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits }).replace("-", "−");
};

export function arrow(ctx, x1, y1, x2, y2, color = COLORS.ink, width = 3) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.min(12, len * 0.6);
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(a) * head * 0.8, y2 - Math.sin(a) * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
  ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function label(ctx, text, x, y, { color = COLORS.ink, size = 14, align = "left", bold = false } = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

export function mount(def) {
  const query = new URLSearchParams(location.search);
  let locale = query.get("locale") || "vi";
  const L = s => (typeof s === "string" ? s : (s?.[locale] ?? s?.vi ?? ""));

  let state = def.initialState();
  let running = false;
  let dirty = true;
  let readOnly = false;
  let acc = 0;
  let last = 0;
  let hostOrigin = null;
  const syncers = [];

  window.addEventListener("error", e => {
    document.documentElement.dataset.error = e.message || "error";
  });
  window.addEventListener("unhandledrejection", e => {
    document.documentElement.dataset.error = String(e.reason);
  });

  // ---------- host bridge ----------
  const inFrame = window.parent !== window;
  const post = (msg, origin = hostOrigin) => {
    if (!inFrame || !origin) return;
    window.parent.postMessage(
      { source: "examdee-sim", v: PROTOCOL, slug: def.slug, version: def.version, ...msg },
      origin
    );
  };
  // Keys starting with "_" are transient (drag flags, caches) and never leave the sim.
  const snapshot = () =>
    JSON.parse(JSON.stringify(state, (key, value) => (key.startsWith("_") ? undefined : value)));

  let pushTimer = 0;
  const pushState = () => {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => post({ type: "state", state: snapshot() }), 300);
  };

  // State from the host is untrusted (it round-trips through the client and the BE):
  // keep only known keys of the right type, then clamp to each control's range.
  const applyState = incoming => {
    const base = def.initialState();
    if (incoming && typeof incoming === "object") {
      if (def.sanitize) {
        Object.assign(base, def.sanitize(incoming, base));
      } else {
        for (const key of Object.keys(base)) {
          const value = incoming[key];
          const type = typeof base[key];
          if (typeof value !== type || type === "object" || type === "function") continue;
          if (type === "number" && !Number.isFinite(value)) continue;
          base[key] = value;
        }
      }
    }
    for (const c of def.controls ?? []) {
      if (c.type === "slider" || c.type === "stepper") base[c.key] = clamp(base[c.key], c.min, c.max);
      if (c.type === "select" && !c.options.some(o => o.value === base[c.key])) {
        base[c.key] = c.options[0].value;
      }
    }
    state = base;
    acc = 0;
    syncAll();
  };

  const api = {
    get state() {
      return state;
    },
    /**
     * Report a meaningful learner action to the host. Not for per-frame data.
     * `kind` is one of EVENT_KINDS and is what the host and BE aggregate on;
     * `name` is the sim-specific detail and must be declared in manifest.json.
     */
    emit(name, data = {}, kind = "action") {
      if (!EVENT_KINDS.includes(kind)) throw new Error(`Unknown event kind: ${kind}`);
      post({ type: "event", kind, name, data, t: Date.now() });
      pushState();
    },
    redraw() {
      dirty = true;
    },
    play() {
      setRunning(true);
    },
    pause() {
      setRunning(false);
    },
    sync() {
      syncAll();
    },
  };

  window.addEventListener("message", e => {
    if (e.source !== window.parent) return;
    if (!HOST_ORIGINS.some(rx => rx.test(e.origin))) return;
    const m = e.data;
    if (!m || m.source !== "examdee-host") return;
    hostOrigin = e.origin;
    if (m.type === "init") {
      const config = m.config ?? {};
      if (typeof config.locale === "string") locale = config.locale;
      if (config.state) applyState(config.state);
      setReadOnly(config.readOnly === true);
      post({ type: "state", state: snapshot() });
    } else if (m.type === "getState") {
      post({ type: "state", requestId: m.requestId, state: snapshot() });
    } else if (m.type === "setState") {
      applyState(m.state);
    } else if (m.type === "reset") {
      reset();
    }
  });

  // ---------- layout ----------
  document.title = L(def.title);
  const root = el("div", "sim");
  const stage = el("div", "stage");
  const canvas = el("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", L(def.title));
  stage.append(canvas);
  const panel = el("aside", "panel");
  panel.append(el("h1", "", L(def.title)));
  if (def.hint) panel.append(el("p", "hint", L(def.hint)));
  root.append(stage, panel);
  document.body.append(root);
  const ctx = canvas.getContext("2d");
  const view = { w: 0, h: 0 };

  // transport
  const transport = el("div", "transport");
  let playBtn = null;
  if (def.step) {
    playBtn = el("button", "primary");
    playBtn.type = "button";
    playBtn.addEventListener("click", () => {
      setRunning(!running);
      api.emit(running ? "play" : "pause", {}, "transport");
    });
    const stepBtn = el("button", "", "Bước");
    stepBtn.type = "button";
    stepBtn.addEventListener("click", () => {
      setRunning(false);
      for (let i = 0; i < 6; i++) def.step(state, DT, api);
      dirty = true;
    });
    transport.append(playBtn, stepBtn);
  }
  const resetBtn = el("button", "", "Đặt lại");
  resetBtn.type = "button";
  resetBtn.addEventListener("click", () => {
    reset();
    api.emit("reset", {}, "transport");
  });
  transport.append(resetBtn);
  panel.append(transport);

  function setRunning(value) {
    running = value && !!def.step;
    if (playBtn) playBtn.textContent = running ? "❚❚ Dừng" : "▶ Chạy";
    last = 0;
    dirty = true;
  }

  function setReadOnly(value) {
    readOnly = value;
    panel.inert = value;
    root.classList.toggle("readonly", value);
  }

  function reset() {
    state = def.initialState();
    acc = 0;
    setRunning(def.autoplay === true);
    syncAll();
  }

  function syncAll() {
    for (const sync of syncers) sync();
    dirty = true;
  }

  // controls
  const controls = el("div", "controls");
  panel.append(controls);
  const changed = (c, value) => {
    c.onChange?.(state, api);
    c.onCommit?.(state, api); // once per finished adjustment (slider released), unlike onChange
    syncAll(); // other controls may depend on this one (visible / disabled / derived values)
    api.emit("param", { key: c.key, value }, "param");
  };

  for (const c of def.controls ?? []) {
    const before = controls.childElementCount;
    if (c.type === "heading") {
      controls.append(el("h2", "", L(c.label)));
    } else if (c.type === "slider") {
      const row = el("label", "row slider");
      const head = el("span", "row-head");
      const out = el("output");
      head.append(el("span", "", L(c.label)), out);
      const input = el("input");
      Object.assign(input, { type: "range", min: c.min, max: c.max, step: c.step ?? 1 });
      const show = () => {
        input.value = state[c.key];
        out.textContent = c.format
          ? c.format(state[c.key], state)
          : `${fmt(state[c.key], c.digits ?? 2)}${c.unit ? " " + c.unit : ""}`;
      };
      input.addEventListener("input", () => {
        state[c.key] = Number(input.value);
        c.onChange?.(state, api);
        show();
        dirty = true;
      });
      // Emit only when the learner lets go, so the host gets one event per adjustment.
      input.addEventListener("change", () => changed(c, state[c.key]));
      row.append(head, input);
      controls.append(row);
      syncers.push(show);
    } else if (c.type === "select") {
      const row = el("label", "row");
      row.append(el("span", "row-head", L(c.label)));
      const select = el("select");
      for (const o of c.options) {
        const opt = el("option", "", L(o.label));
        opt.value = String(o.value);
        select.append(opt);
      }
      select.addEventListener("change", () => {
        state[c.key] = c.options[select.selectedIndex].value;
        changed(c, state[c.key]);
      });
      row.append(select);
      controls.append(row);
      syncers.push(() => {
        select.selectedIndex = Math.max(0, c.options.findIndex(o => o.value === state[c.key]));
      });
    } else if (c.type === "checkbox") {
      const row = el("label", "row check");
      const input = el("input");
      input.type = "checkbox";
      input.addEventListener("change", () => {
        state[c.key] = input.checked;
        changed(c, input.checked);
      });
      row.append(input, el("span", "", L(c.label)));
      controls.append(row);
      syncers.push(() => {
        input.checked = !!state[c.key];
      });
    } else if (c.type === "custom") {
      // Escape hatch: render(container, api) builds its own DOM and may return a sync() function.
      const box = el("div", "row");
      const sync = c.render(box, api);
      controls.append(box);
      if (sync) syncers.push(sync);
    } else if (c.type === "stepper") {
      // Whole-number (or fixed-step) value with − / + buttons.
      const row = el("div", "row stepper");
      const out = el("output");
      const make = (text, delta) => {
        const b = el("button", "", text);
        b.type = "button";
        b.setAttribute("aria-label", `${L(c.label)} ${text}`);
        b.addEventListener("click", () => {
          state[c.key] = clamp(state[c.key] + delta * (c.step ?? 1), c.min, c.max);
          changed(c, state[c.key]);
        });
        return b;
      };
      const minus = make("−", -1);
      const plus = make("+", 1);
      row.append(el("span", "", L(c.label)), minus, out, plus);
      controls.append(row);
      syncers.push(() => {
        out.textContent = fmt(state[c.key], c.digits ?? 0);
        minus.disabled = state[c.key] <= c.min;
        plus.disabled = state[c.key] >= c.max;
      });
    } else if (c.type === "button") {
      const button = el("button", c.primary ? "primary" : "", L(c.label));
      button.type = "button";
      button.addEventListener("click", () => {
        c.action(state, api);
        syncAll();
        if (c.event) api.emit(c.event, {}, c.eventKind ?? "action");
      });
      controls.append(button);
    }
    // Optional on any control: visible(state) and disabled(state).
    const node = controls.children[before];
    if (node && (c.visible || c.disabled)) {
      syncers.push(() => {
        if (c.visible) node.hidden = !c.visible(state);
        if (c.disabled) {
          const off = !!c.disabled(state);
          for (const n of node.matches("button") ? [node] : node.querySelectorAll("input, select, button")) n.disabled = off;
          node.classList.toggle("off", off);
        }
      });
    }
  }

  // readouts
  const readouts = (def.readouts ?? []).map(r => {
    const row = el("div", "readout");
    const value = el("strong");
    row.append(el("span", "", L(r.label)), value);
    return { value, get: r.value };
  });
  if (readouts.length) {
    const box = el("div", "readouts");
    box.append(...readouts.map(r => r.value.parentNode));
    panel.append(box);
  }

  // ---------- pointer ----------
  if (def.pointer) {
    canvas.style.touchAction = "none";
    const point = e => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    let active = false;
    canvas.addEventListener("pointerdown", e => {
      if (readOnly) return;
      active = def.pointer.down?.(point(e), state, api, view) !== false;
      if (active) canvas.setPointerCapture(e.pointerId);
      dirty = true;
    });
    canvas.addEventListener("pointermove", e => {
      if (readOnly) return;
      if (active) def.pointer.move?.(point(e), state, api, view);
      else def.pointer.hover?.(point(e), state, api, view);
      dirty = true;
    });
    const end = e => {
      if (!active) return;
      active = false;
      def.pointer.up?.(point(e), state, api, view);
      syncAll();
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }

  // ---------- canvas + loop ----------
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const r = stage.getBoundingClientRect();
    view.w = Math.max(1, Math.floor(r.width));
    view.h = Math.max(1, Math.floor(r.height));
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  function frame(ts) {
    if (running) {
      const elapsed = last ? Math.min((ts - last) / 1000, 0.1) : 0;
      last = ts;
      acc += elapsed * (def.timeScale?.(state) ?? 1);
      // `running` is re-checked so a step() that calls api.pause() stops the frame at once.
      while (acc >= DT && running) {
        def.step(state, DT, api);
        acc -= DT;
      }
      dirty = true;
    }
    if (dirty) {
      dirty = false;
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, view.w, view.h);
      def.draw(ctx, state, view);
      for (const r of readouts) {
        const text = r.get(state);
        if (r.value.textContent !== text) r.value.textContent = text;
      }
    }
    requestAnimationFrame(frame);
  }

  setRunning(def.autoplay === true || query.has("play"));
  syncAll();
  requestAnimationFrame(frame);
  post({ type: "ready" }, "*"); // no learner data in this message; host replies with init
  return api;
}
