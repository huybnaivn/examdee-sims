# Host ↔ sim protocol, v1

A sim runs in an `<iframe>` and never calls the backend. It talks to the page that embeds it (the host) with `window.postMessage`. The host owns authentication and all backend calls.

**Stability rule:** this protocol only grows. Never rename a message, remove a field, or change what one means. A breaking change needs `v: 2` and a kit that still answers `v: 1`.

## Envelope

Every message is a plain object.

| Field | From sim | From host |
|---|---|---|
| `source` | `"examdee-sim"` | `"examdee-host"` |
| `v` | `1` | `1` |
| `slug`, `version` | the sim's slug and semver | – |
| `type` | see below | see below |

## Sim → host

| `type` | Extra fields | When |
|---|---|---|
| `ready` | – | Once, after the sim has mounted. Sent to any origin; carries no learner data. |
| `state` | `state`, `requestId?` | Reply to `init` and `getState`; also pushed 300 ms after the last learner action. |
| `event` | `kind`, `name`, `data`, `t` (ms epoch) | One meaningful learner action. Never per-frame data. |

### Events

Every event from every sim has the same shape, so the host and the backend can store and aggregate them without knowing the sim:

```json
{ "source": "examdee-sim", "v": 1, "slug": "nem-xien", "version": "1.0.0",
  "type": "event", "kind": "result", "name": "landed",
  "data": { "range": 40.8, "maxHeight": 10.2, "time": 2.88 }, "t": 1790000000000 }
```

`kind` is a closed list. Aggregate on `kind`; use `name` and `data` for sim-specific detail.

| `kind` | Meaning | `name` | `data` |
|---|---|---|---|
| `param` | A control was changed | always `param` | `{ key, value }`, `key` is a state key |
| `transport` | Playback | `play`, `pause`, `reset` | `{}` |
| `action` | The learner did something in the scene | sim-specific, e.g. `release` | sim-specific |
| `result` | The sim produced a measurable outcome | sim-specific, e.g. `landed` | flat object of numbers, in the units given in the manifest |
| `goal` | A notable condition was reached | sim-specific, e.g. `balanced` | sim-specific, may be `{}` |

`param` and `transport` are emitted by the kit, identically for every sim. Each sim declares its `action`, `result` and `goal` events in `manifest.json` under `events`, as `{ "<name>": { "kind": "...", "description": "...", "data": { "<key>": "<meaning and unit>" } } }`. `npm run check` fails if a sim emits an event it has not declared.

## Host → sim

| `type` | Extra fields | Effect |
|---|---|---|
| `init` | `config: { locale?, state?, readOnly? }` | Reply to `ready`. Restores a saved state, sets read-only mode. The sim answers with `state`. |
| `getState` | `requestId` | The sim answers with `state` carrying the same `requestId`. |
| `setState` | `state` | Replace the sim state. |
| `reset` | – | Back to the initial state. |

## State

`state` is a JSON object. Its keys are documented per sim in `manifest.json` under `state`. Store it together with the sim `version`: a saved state is reopened with the release it was recorded on, so no migration code is needed.

## Security requirements

- **Host:** accept a message only if `event.source === iframe.contentWindow` **and** `event.origin` equals the origin the iframe was loaded from. Send with that origin as `targetOrigin`, never `"*"`.
- **Sim (done by the kit):** accept a message only from `window.parent` on an origin in the kit's `HOST_ORIGINS` allowlist. Incoming state is untrusted: unknown keys and wrong types are dropped, numbers are clamped to the control range.
- **Deployment:** serve sims from their own origin (for example `sims.examdee.vn`), not the app's origin. Sim code must not be able to read the app's cookies or storage.
- **Scores:** state comes from the learner's browser and can be forged. Fine for practice; do not use it alone for exam grades.

`host-demo.html` is a working reference host.
