// Population growth. N in individuals, t in years, r per year, harvest H in individuals per year.
//   Exponential (J curve):  dN/dt = rN,                N(t) = N₀·e^(rt)
//   Logistic (S curve):     dN/dt = rN(1 − N/K),       N(t) = K / (1 + ((K − N₀)/N₀)·e^(−rt))
//   Logistic + harvest:     dN/dt = rN(1 − N/K) − H,   integrated numerically; N stays ≥ 0 and 0 is final.

export const initialState = () => ({
  N0: 20,
  r: 0.5,
  K: 1000,
  tMax: 30,
  harvest: false,
  H: 100,
});

export const expN = (N0, r, t) => N0 * Math.exp(r * t);
export const logisticN = (N0, r, K, t) => (N0 <= 0 ? 0 : K / (1 + ((K - N0) / N0) * Math.exp(-r * t)));
/** Logistic growth rate dN/dt (individuals per year), before harvest. */
export const rate = (N, r, K) => r * N * (1 - N / K);
/** Maximum sustainable yield: the peak of dN/dt, at N = K/2. */
export const msy = (r, K) => (r * K) / 4;

/** Time for the logistic population to reach K/2 (years); 0 if it starts at or above K/2. */
export const timeToHalfK = (N0, r, K) => (N0 >= K / 2 ? 0 : Math.log((K - N0) / N0) / r);

/** Logistic growth with constant harvest H, RK4. Returns [t, N] points, `steps` per year. */
export function harvested(N0, r, K, H, tMax, steps = 50) {
  const f = N => rate(N, r, K) - H;
  const dt = 1 / steps;
  let N = Math.max(0, N0);
  const pts = [[0, N]];
  for (let i = 1; i <= Math.round(tMax * steps); i++) {
    if (N > 0) {
      const k1 = f(N);
      const k2 = f(N + (dt / 2) * k1);
      const k3 = f(N + (dt / 2) * k2);
      const k4 = f(N + dt * k3);
      N += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      if (N < 1e-6) N = 0; // extinct: a population of zero cannot recover or go negative
    }
    pts.push([i * dt, N]);
  }
  return pts;
}

/** Final logistic N at tMax, with the harvest if it is on. */
export const finalN = s => (s.harvest ? harvested(s.N0, s.r, s.K, s.H, s.tMax).at(-1)[1] : logisticN(s.N0, s.r, s.K, s.tMax));

/** Has the learner set the harvest to the maximum sustainable yield, within `tol` (relative)? */
export const atMsy = (s, tol = 0.03) => s.harvest && Math.abs(s.H - msy(s.r, s.K)) <= tol * msy(s.r, s.K);
