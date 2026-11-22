import test from "node:test";
import assert from "node:assert/strict";
import {
  MATERIALS, T_ROOM, T_HOT, T_MELT, ABSORB, PLATE, G, BETA, DEPTH,
  initialState, diffusivity, erfc, rodTemperature, timeToReach, fallTimes, fallOrder, fallenCount,
  parsePrediction, predict, predictionCorrect, buoyantAcceleration, convectionSpeed, velocity, advect,
  incidentPower, absorbedPower, reflectedPower, lostPower, equilibriumTemperature, timeConstant, resetRun, step,
} from "./model.js";

const near = (a, b, rel = 1e-6) => assert.ok(Math.abs(a - b) <= rel * Math.max(1e-12, Math.abs(b)), `${a} ≠ ${b}`);
const run = (s, seconds, dt = 1 / 120) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) step(s, dt);
  return s;
};

test("erfc matches known values", () => {
  near(erfc(0), 1, 1e-6);
  near(erfc(0.5), 0.4795001, 1e-5);
  near(erfc(1), 0.1572992, 1e-5);
  near(erfc(2), 0.0046777, 1e-3);
});

test("wax falls in the order đồng, nhôm, sắt, thủy tinh at every distance", () => {
  assert.deepEqual(MATERIALS.map(m => m.name), ["Đồng", "Nhôm", "Sắt", "Thủy tinh"]);
  for (const distance of [3, 6, 10]) {
    const s = { ...initialState(), distance };
    assert.deepEqual(fallOrder(s), [0, 1, 2, 3]);
    const t = fallTimes(s);
    assert.ok(t[0] < t[1] && t[1] < t[2] && t[2] < t[3]);
  }
});

test("1D model: the wax point is at the melting temperature exactly when it falls", () => {
  const s = initialState();
  fallTimes(s).forEach((t, i) => {
    near(rodTemperature(MATERIALS[i], s.distance / 100, t), T_MELT, 1e-4);
    assert.ok(rodTemperature(MATERIALS[i], s.distance / 100, t * 0.8) < T_MELT);
    assert.ok(rodTemperature(MATERIALS[i], s.distance / 100, t * 1.2) > T_MELT);
  });
  // limits of the profile
  assert.equal(rodTemperature(MATERIALS[0], 0.05, 0), T_ROOM);
  near(rodTemperature(MATERIALS[0], 0, 10), T_HOT);
  assert.ok(rodTemperature(MATERIALS[0], 0.02, 5) > rodTemperature(MATERIALS[0], 0.08, 5)); // cooler further away
});

test("time to a temperature falls with conductivity: t ∝ 1/α = ρc/k, and ∝ x²", () => {
  const base = { k: 50, rho: 5000, c: 500 };
  near(timeToReach({ ...base, k: 100 }, 0.05), timeToReach(base, 0.05) / 2);
  near(timeToReach(base, 0.1), 4 * timeToReach(base, 0.05));
  // the four materials: more conductive, sooner; and the same order by k as by α
  const byK = [...MATERIALS].sort((a, b) => b.k - a.k);
  const byAlpha = [...MATERIALS].sort((a, b) => diffusivity(b) - diffusivity(a));
  assert.deepEqual(byK.map(m => m.id), byAlpha.map(m => m.id));
  near(diffusivity(MATERIALS[0]), 400 / (8960 * 380));
  near(timeToReach(MATERIALS[0], 0.06) / timeToReach(MATERIALS[2], 0.06), diffusivity(MATERIALS[2]) / diffusivity(MATERIALS[0]));
});

test("fallen count follows the clock; prediction is validated", () => {
  const s = initialState();
  const t = fallTimes(s);
  assert.equal(fallenCount(s), 0);
  assert.equal(fallenCount({ ...s, time: (t[1] + t[2]) / 2 }), 2);
  assert.equal(fallenCount({ ...s, time: t[3] + 1 }), 4);
  assert.deepEqual(parsePrediction("0123"), [0, 1, 2, 3]);
  assert.deepEqual(parsePrediction("0x0919<script>2"), [0, 1, 2]); // forged text: only distinct valid digits
  assert.deepEqual(parsePrediction(undefined), []);
  assert.equal(predict(s, 0), 1);
  assert.equal(predict(s, 0), 0); // already chosen
  assert.equal(predict(s, 7), 0);
  assert.equal(predict(s, 1), 2);
  assert.ok(!predictionCorrect(s)); // incomplete
  predict(s, 2);
  assert.equal(predict(s, 3), 4);
  assert.equal(s.prediction, "0123");
  assert.ok(predictionCorrect(s));
  assert.ok(!predictionCorrect({ ...s, prediction: "1023" }));
  assert.equal(predict({ ...initialState(), time: 2 }, 0), 0); // no predicting once the heating has started
});

test("warm fluid rises, cold fluid sinks; a = gβΔT", () => {
  near(buoyantAcceleration(10), G * BETA * 10);
  assert.ok(buoyantAcceleration(5) > 0 && buoyantAcceleration(-5) < 0);
  assert.equal(buoyantAcceleration(0), 0);
  const left = { ...initialState(), mode: "convection", heater: "left" };
  near(convectionSpeed(left), Math.sqrt(G * BETA * 10 * DEPTH));
  assert.ok(convectionSpeed({ ...left, deltaT: 20 }) > convectionSpeed(left)); // hotter, faster
  assert.ok(velocity(left, 0.15, 0.5).vy > 0); // up over the heater
  assert.ok(velocity(left, 0.85, 0.5).vy < 0); // down on the far side
  assert.ok(velocity(left, 0.5, 0.9).vx > 0); // along the top, away from the heated side
  assert.ok(velocity(left, 0.5, 0.1).vx < 0); // back along the bottom
  const centre = { ...left, heater: "center" };
  assert.ok(velocity(centre, 0.5, 0.5).vy > 0);
  assert.ok(velocity(centre, 0.1, 0.5).vy < 0 && velocity(centre, 0.9, 0.5).vy < 0);
  assert.ok(velocity(centre, 0.7, 0.9).vx > 0 && velocity(centre, 0.3, 0.9).vx < 0);
  const top = { ...left, heater: "top" };
  assert.equal(convectionSpeed(top), 0);
  assert.deepEqual(advect(top, { x: 0.3, y: 0.3 }, 1), { x: 0.3, y: 0.3 });
});

test("the flow is incompressible and does not cross the walls", () => {
  const e = 1e-5;
  for (const heater of ["left", "center"]) {
    const s = { ...initialState(), heater };
    for (const [x, y] of [[0.2, 0.3], [0.6, 0.8], [0.9, 0.1]]) {
      const div =
        (velocity(s, x + e, y).vx - velocity(s, x - e, y).vx) / (2 * e) + (velocity(s, x, y + e).vy - velocity(s, x, y - e).vy) / (2 * e);
      assert.ok(Math.abs(div) < 1e-6);
    }
    for (const u of [0.1, 0.4, 0.8]) {
      assert.ok(Math.abs(velocity(s, 0, u).vx) < 1e-12 && Math.abs(velocity(s, 1, u).vx) < 1e-12);
      assert.ok(Math.abs(velocity(s, u, 0).vy) < 1e-12 && Math.abs(velocity(s, u, 1).vy) < 1e-12);
    }
  }
});

test("the tracer comes back to where it started; hotter water circulates faster", () => {
  const loop = (heater, deltaT) => {
    const s = resetRun({ ...initialState(), mode: "convection", heater, deltaT });
    const start = { x: s.mx, y: s.my };
    run(s, 200);
    assert.ok(s.loopTime > 0, "one loop done");
    const again = resetRun({ ...s });
    run(again, s.loopTime);
    assert.ok(Math.hypot(again.mx - start.x, again.my - start.y) < 0.02);
    return s.loopTime;
  };
  const slow = loop("left", 5);
  const fast = loop("left", 20);
  near(slow / fast, 2, 0.01); // v ∝ √ΔT
  assert.ok(loop("center", 10) > 0);
  const top = run(resetRun({ ...initialState(), mode: "convection", heater: "top" }), 30);
  assert.equal(top.loopTime, 0);
  assert.equal(top.mx, 0.25);
});

test("black absorbs more than white; absorbed + reflected = incident", () => {
  const s = { ...initialState(), mode: "radiation" };
  near(incidentPower(s), 800 * PLATE.area);
  for (const which of ["black", "white"]) near(absorbedPower(s, which) + reflectedPower(s, which), incidentPower(s));
  assert.ok(absorbedPower(s, "black") > absorbedPower(s, "white"));
  near(absorbedPower(s, "black"), ABSORB.black * 8);
  run(s, 120);
  assert.ok(s.tBlack > s.tWhite && s.tWhite > T_ROOM);
  assert.ok(equilibriumTemperature(s, "black") > equilibriumTemperature(s, "white"));
});

test("radiation energy balance: stored heat = absorbed − lost, and equilibrium when they are equal", () => {
  const s = { ...initialState(), mode: "radiation", irradiance: 600 };
  const dt = 1 / 120;
  let absorbed = 0;
  let lost = 0;
  for (let i = 0; i < 300 * 120; i++) {
    absorbed += absorbedPower(s, "black") * dt;
    lost += lostPower(s.tBlack) * dt;
    step(s, dt);
  }
  near(PLATE.heatCapacity * (s.tBlack - T_ROOM), absorbed - lost, 1e-9);
  // analytic solution of C·dT/dt = P − hA(T − T0)
  const eq = equilibriumTemperature(s, "black");
  near(eq, T_ROOM + (0.95 * 600 * 0.01) / (10 * 0.02));
  near(s.tBlack, eq - (eq - T_ROOM) * Math.exp(-300 / timeConstant()), 1e-4);
  run(s, 20 * timeConstant());
  near(s.tBlack, eq, 1e-6);
  near(lostPower(s.tBlack), absorbedPower(s, "black"), 1e-5);
  near(s.tWhite, equilibriumTemperature(s, "white"), 1e-6);
  // no light, no warming
  const dark = run({ ...initialState(), mode: "radiation", irradiance: 0 }, 60);
  assert.equal(dark.tBlack, T_ROOM);
});

test("resetRun restarts the clock but keeps the settings and the prediction", () => {
  const s = run({ ...initialState(), mode: "radiation", prediction: "01", distance: 8 }, 10);
  resetRun(s);
  assert.equal(s.time, 0);
  assert.equal(s.tBlack, T_ROOM);
  assert.equal(s.prediction, "01");
  assert.equal(s.distance, 8);
});
