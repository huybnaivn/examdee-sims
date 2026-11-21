// Mass on a spring with viscous damping: m·x'' = −k·x − b·x' + F(t).
// mode "free": dao động tắt dần (released from x₀, no force).
// mode "maintained": dao động duy trì (an energy source pushes with F = b·x', in step with the motion,
//   so it puts back exactly what friction takes and the mass swings at its own ω₀).
// mode "driven": dao động cưỡng bức, F = F₀·cos φ with φ' = Ω (phase is integrated so Ω can change mid-run).

const TAU = 2 * Math.PI;

export const initialState = () => ({
  mode: "driven",
  mass: 0.5, // kg
  stiffness: 20, // N/m
  damping: 0.4, // kg/s, b
  force: 0.5, // N, F₀
  drive: 5, // rad/s, Ω
  amp0: 10, // cm, starting displacement in the free / maintained modes
  showTheory: false,
  x: 0, // m
  v: 0, // m/s
  phase: 0, // rad, drive phase φ
  time: 0, // s
  settle: 0, // s since the drive or the oscillator last changed
  cyclePeak: 0, // m, largest |x| so far in the current drive period
  lastPeak: 0, // m, largest |x| in the previous complete drive period
  amplitude: 0, // m, steady-state amplitude once reached, else 0
  lastCross: -1, // s, time of the previous upward pass through x = 0
  measuredPeriod: 0, // s, time between the last two upward passes
  points: [], // [{ w: rad/s, A: m }] steady-state amplitudes measured so far
});

export const naturalFrequency = s => Math.sqrt(s.stiffness / s.mass);

/** A = F₀ / √((k − mΩ²)² + (bΩ)²). */
export const steadyAmplitude = (s, w = s.drive) =>
  s.force / Math.hypot(s.stiffness - s.mass * w * w, s.damping * w);

/** How far x lags behind the force in the steady state, δ ∈ [0, π]. */
export const phaseLag = (s, w = s.drive) => Math.atan2(s.damping * w, s.stiffness - s.mass * w * w);

/** Ω of the largest steady amplitude, √(ω₀² − b²/(2m²)); 0 when damping is too strong for a peak. */
export const resonanceFrequency = s => {
  const w2 = s.stiffness / s.mass - (s.damping * s.damping) / (2 * s.mass * s.mass);
  return w2 > 0 ? Math.sqrt(w2) : 0;
};

/** Free decay: the amplitude falls as A₀·e^(−bt/2m). */
export const envelope = (s, t) => (s.amp0 / 100) * Math.exp((-s.damping * t) / (2 * s.mass));

/** Wait five time constants 2m/b before trusting the amplitude (the transient is then below 1 %). */
export const settleTime = s => (10 * s.mass) / s.damping;

/** External force on the mass (N): the periodic drive, or the maintaining push b·v. */
export const force = (s, phase = s.phase, v = s.v) =>
  s.mode === "driven" ? s.force * Math.cos(phase) : s.mode === "maintained" ? s.damping * v : 0;
const accel = (s, x, v, phase) => (-s.stiffness * x - s.damping * v + force(s, phase, v)) / s.mass;

/** Forget the measurement in progress (the drive or the oscillator changed). */
export function unsettle(s) {
  s.settle = 0;
  s.cyclePeak = 0;
  s.lastPeak = 0;
  s.amplitude = 0;
  return s;
}

/** Back to the start of the chosen mode: at rest in O (driven) or released from x₀. */
export function start(s) {
  s.x = s.mode === "driven" ? 0 : s.amp0 / 100;
  s.v = 0;
  s.phase = 0;
  s.time = 0;
  s.lastCross = -1;
  s.measuredPeriod = 0;
  return unsettle(s);
}

/** Jump straight onto the steady solution x = A·cos(φ − δ). */
export function skipTransient(s) {
  const A = steadyAmplitude(s);
  const d = phaseLag(s);
  s.x = A * Math.cos(s.phase - d);
  s.v = -A * s.drive * Math.sin(s.phase - d);
  unsettle(s);
  s.settle = settleTime(s);
  return s;
}

/** Keep one measured point per drive frequency. */
export function addPoint(s) {
  s.points = [...s.points.filter(p => Math.abs(p.w - s.drive) > 0.05), { w: s.drive, A: s.amplitude }]
    .sort((p, q) => p.w - q.w)
    .slice(-40);
  return s;
}

/** Advance by dt (RK4). Returns "steady" on the step where the steady state is first recognised. */
export function step(s, dt) {
  const { x, v, phase: p } = s;
  const W = s.mode === "driven" ? s.drive : 0;
  const h = dt / 2;
  const k1x = v;
  const k1v = accel(s, x, v, p);
  const k2x = v + h * k1v;
  const k2v = accel(s, x + h * k1x, k2x, p + W * h);
  const k3x = v + h * k2v;
  const k3v = accel(s, x + h * k2x, k3x, p + W * h);
  const k4x = v + dt * k3v;
  const k4v = accel(s, x + dt * k3x, k4x, p + W * dt);
  s.x = x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
  s.v = v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  s.time += dt;
  s.settle += dt;

  let event = null;
  if (x < 0 && s.x >= 0) {
    if (s.lastCross >= 0) s.measuredPeriod = s.time - s.lastCross;
    s.lastCross = s.time;
  }
  if (s.mode === "driven") {
    s.phase = p + W * dt;
    s.cyclePeak = Math.max(s.cyclePeak, Math.abs(s.x));
    if (Math.floor(s.phase / TAU) !== Math.floor(p / TAU)) {
      // A full drive period ended: steady when it peaked where the previous one did.
      const same = s.lastPeak > 0 && Math.abs(s.cyclePeak - s.lastPeak) <= 0.005 * s.cyclePeak;
      if (!s.amplitude && same && s.settle >= settleTime(s)) {
        s.amplitude = s.cyclePeak;
        event = "steady";
      }
      s.lastPeak = s.cyclePeak;
      s.cyclePeak = 0;
    }
  }
  return event;
}

/** State from the host is untrusted: keep only a short list of finite, in-range points. */
export const sanitizePoints = list =>
  Array.isArray(list)
    ? list
        .filter(p => p && Number.isFinite(p.w) && Number.isFinite(p.A) && p.w > 0 && p.w <= 30 && p.A >= 0 && p.A <= 100)
        .slice(0, 40)
        .map(p => ({ w: p.w, A: p.A }))
    : [];
