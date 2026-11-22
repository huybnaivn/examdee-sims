# Writing a sim

Each sim is a folder `sims/<slug>/` with five files. `sims/con-lac/` is the reference; copy its shape.

| File | Purpose |
|---|---|
| `model.js` | Pure logic: `initialState()`, `step(state, dt)` if it animates, and helpers. No DOM, no kit import. |
| `model.test.js` | `node:test` checks of the science or maths (conservation laws, known formulas, edge cases). |
| `sim.js` | The view: one `mount({...})` call from `../../kit/v1/kit.js`. |
| `index.html` | Copy from `con-lac`, change `<title>`. |
| `manifest.json` | Catalogue entry: slug, version, title, subject, grades, description, learningGoals, and a description of every `state` key and custom `event` (the AI tutor reads these). |

## Rules

1. **Original work only.** Write from the science and the Vietnamese curriculum. Do not open, copy or port any third-party simulation's code, art, text or layout, and do not name any third-party product.
2. **Do not edit `kit/`, `scripts/`, or another sim's folder.** If the kit lacks something, use a `custom` control or draw it on the canvas, and note the gap in your report.
3. **No dependencies, no build step.** Plain ES modules and Canvas 2D.
4. **State is flat JSON.** Numbers, strings, booleans at the top level. If you need an array or object, provide `sanitize(incoming, base)` in `mount` that validates it and returns only safe keys. Keys starting with `_` are transient and are not saved.
5. **Vietnamese UI**, decimal comma (use `fmt`), SI units, terms as used in Vietnamese textbooks.
6. **The model must be right.** Every formula the learner can observe needs a test. If the numbers on screen can disagree with the textbook formula, the sim is wrong.
7. **Emit meaningful events only** with `api.emit(name, data, kind)`. `kind` is `"action"` (the learner did something: a drag, a launch), `"result"` (a measurable outcome: `data` is a flat object of numbers) or `"goal"` (a notable condition reached: balanced, solved). Control changes and play/pause/reset are emitted by the kit already. Declare every event in `manifest.json` as `"events": { "<name>": { "kind", "description", "data": { "<key>": "<meaning and unit>" } } }`; `npm run check` enforces it.
8. **Works at 360 px wide** and with touch. Every draggable quantity should also have a slider so it works from the keyboard.

## `mount(def)`

```js
mount({
  slug, version, title, hint,          // strings (or { vi, en })
  initialState,                        // () => state
  step,                                // (state, dt, api) => void, optional; dt is 1/120 s
  timeScale,                           // (state) => number, optional playback speed
  autoplay,                            // start running, optional
  transport: false,                    // always-live scene: hide Chạy/Bước, step() runs all the time
  draw,                                // (ctx, state, view) => void; view = { w, h } in CSS px
  controls: [
    { type: "heading", label },
    { type: "slider", key, label, min, max, step, unit, digits, onChange(state, api) },
    { type: "select", key, label, options: [{ value, label }], onChange },
    { type: "checkbox", key, label, onChange },
    { type: "button", label, primary, action(state, api), event },
    { type: "stepper", key, label, min, max, step },           // − value + buttons
    { type: "custom", render(container, api) /* may return sync() */ },
    // any control may also take: visible(state) => bool, disabled(state) => bool
    // sliders and steppers may take: format(value, state) => "text shown beside the label"
    // any keyed control may take onCommit(state, api): called once when the adjustment is finished
    // (slider released), where onChange is called on every tick while dragging
  ],
  readouts: [{ label, value: state => "text" }],
  pointer: { down(p, state, api, view) /* return false to ignore */, move, up, hover },
  sanitize,                            // (incoming, base) => partial state, optional
});
```

`api`: `state`, `emit(name, data, kind)`, `redraw()`, `play()`, `pause()`, `sync()` (refresh controls after you change state in code).

Kit helpers: `COLORS`, `clamp`, `fmt(n, digits)`, `arrow(ctx, x1, y1, x2, y2, color, width)`, `label(ctx, text, x, y, { color, size, align, bold })`.

The kit clears the canvas before `draw`. Compute your world-to-screen scale from `view` on every draw so the sim resizes cleanly.

## Check before you are done

```sh
node --test "sims/<slug>/*.test.js"   # the model
node scripts/shot.mjs <slug>          # runs it in headless Chrome, checks the host bridge, writes thumb.png
```

Then open `sims/<slug>/thumb.png` and look at it: nothing clipped, nothing overlapping, labels readable.
