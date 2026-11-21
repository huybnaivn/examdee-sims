# Brief for writing a batch of sims

You are writing original educational simulations for this repo (Vietnamese school science and maths; static ES modules + Canvas 2D; zero dependencies).

Read these first, in full: `AUTHORING.md`, `PROTOCOL.md` (the Events section matters), `kit/v1/kit.js`, and two reference sims: `sims/con-lac/` (animated, drag, a `result` event) and `sims/mach-noi-tiep-song-song/` (static, table drawn on canvas, `visible` on controls). Follow `AUTHORING.md` exactly; it is the contract.

## Hard rules

- Original work only. Do not open, fetch, copy or port any third-party simulation's code, art, text or layout, and do not mention any third-party product name anywhere. Write from the science.
- Only create files inside your own sim folders. Do NOT edit `kit/`, `scripts/`, `package.json`, `catalog.json`, the docs, or any other sim's folder. Other agents are working in sibling folders at the same time.
- Do not run git commands that change anything.
- All UI text in Vietnamese with correct diacritics, current-textbook terminology and notation.
- Use the kit's controls (`slider`, `select`, `checkbox`, `stepper`, `button`, with `visible` / `disabled` / `format`) before reaching for `custom`.

## Things earlier authors tripped on

- "When the sliders settle": use the control's `onCommit(state, api)` (called once when the slider is released). Do not write a `setTimeout` debounce.
- To look at a sim in a non-initial state, open `host-demo.html?sim=<slug>&state=<url-encoded JSON>`. Never edit `initialState` temporarily.
- A `button` that changes state should pass `event` (and `eventKind`) so the change reaches the host.
- State keys without a control are not clamped by the kit. If such a key can make the model misbehave when forged (negative, huge), clamp it in the model.
- `manifest.subject` is one of `physics`, `chemistry`, `math`, `biology`.
- While other agents are mid-write, `check.mjs` reports their folders as FAIL "missing"; that is not yours to fix.

## Disk space (this once stopped every agent)

- Every headless Chrome run needs its own `--user-data-dir`, and you must delete it afterwards even when the run fails (`try { … } finally { rmSync(dir, { recursive: true, force: true }) }`). Never leave profile folders in the scratchpad or the system temp folder.
- Prefer `node scripts/shot.mjs <slug>` (it cleans up after itself) and `host-demo.html?sim=<slug>&state=…` over writing your own screenshot helper.
- Before finishing, check that you left no `prof*`, `snap*` or other Chrome profile folders behind.

## Events (the host and backend depend on this)

- Every sim must report what the learner achieved, not only what they touched. Emit at least one `result` event (a measurable outcome; `data` is a flat object of numbers) or `goal` event (a notable condition reached) wherever the sim has one. Emit it once per outcome, never per frame.
- Learner manipulation in the scene (a drag released, a launch) is an `action` event.
- Event names are kebab-case string literals. Declare each in `manifest.json` as `"events": { "<name>": { "kind", "description", "data": { "<key>": "<meaning and unit>" } } }`.
- Do not emit `param`, `play`, `pause` or `reset` yourself unless a `custom` control changes a state key, in which case emit `api.emit("param", { key, value }, "param")`.

## Quality bar

- The model must be right: every formula the learner can observe has a test, and numbers on screen agree with the textbook formula.
- "Đặt lại" returns to the initial state, so make the initial state both a sensible starting point and an informative picture (it is the catalogue thumbnail).
- Must work in a short, narrow stage too (about 360 × 330 CSS px): scale from `view`, drop secondary decoration when space is tight, never let a table or legend cover the main scene.
- Say on screen when something is drawn not to scale or uses a convention (for example electron flow versus conventional current).

## Done means, for each sim

```sh
node --test "sims/<slug>/*.test.js"    # passes
node scripts/check.mjs                 # no FAIL line for your slugs (ignore other agents' lines)
node scripts/shot.mjs <slug>           # prints ok: mounts, answers the host, reports a control change and reset as events
```

Then Read `sims/<slug>/thumb.png` and fix anything clipped, overlapping, off-screen or unreadable.

## Final report (short, plain text)

For each sim: the three results as actually observed, the events it emits with their kinds, anything you could not get right or did not check, and any gap in the kit you had to work around.
