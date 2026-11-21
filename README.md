# ExamDee Sims

Interactive science and maths simulations for ExamDee. Each sim is a static page with no dependencies and no build step, embedded in the app through an iframe.

- `sims/<slug>/` – one simulation (model, tests, view, manifest)
- `kit/v1/` – shared layout, controls, frame loop and host bridge
- [PROTOCOL.md](PROTOCOL.md) – the host ↔ sim message contract
- [AUTHORING.md](AUTHORING.md) – how to write a sim

```sh
npm test                 # model tests for every sim
npm run shot             # headless-Chrome smoke test + thumbnails (needs Google Chrome)
npm run catalog          # rebuild catalog.json
npm run serve            # http://localhost:5600 – gallery and host demo
SIMS_BASE_URL=https://sims.example npm run catalog && npm run release   # dist/<slug>/<version>/
```

Releases in `dist/` are immutable: each carries its own copy of the kit, and a released version is never overwritten. To change a sim, bump `version` in its manifest and in `sim.js`.
