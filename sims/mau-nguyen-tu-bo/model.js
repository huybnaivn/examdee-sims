// Bohr model of the hydrogen atom, levels n = 1…6.
//   E_n = −13,6/n² (eV),  r_n = n²·r₀,  ε = |E_cao − E_thấp| = hc/λ
// Electron going down (from > to): a photon is emitted. Going up: a photon is absorbed.

export const N_MAX = 6;
export const E0 = 13.6; // eV, ionisation energy of hydrogen from n = 1
export const R0 = 5.3e-11; // m, Bohr radius as given in the textbook
export const HC = 1239.842; // h·c in eV·nm
export const VISIBLE = [380, 760]; // nm, the visible range 0,38 µm – 0,76 µm

// Series named by the lower level of the transition.
export const SERIES = { 1: "Lai-man", 2: "Ban-me", 3: "Pa-sen" };

export const initialState = () => ({
  from: 3, // level the electron starts on
  to: 2, // level it ends on (3 → 2 is the red Balmer line Hα)
});

const level = n => Math.min(N_MAX, Math.max(1, Math.round(Number(n) || 1)));

/** Energy of level n (eV). */
export const energy = n => -E0 / level(n) ** 2;

/** Orbit radius r_n = n²·r₀ (m). */
export const radius = n => level(n) ** 2 * R0;

/** Photon energy |E_from − E_to| (eV); 0 when the levels are the same. */
export const photonEnergy = (from, to) => Math.abs(energy(from) - energy(to));

/** Wavelength λ = hc/ε (nm); Infinity when there is no transition. */
export const wavelength = (from, to) => HC / photonEnergy(from, to);

/** Series name from the lower level, or null for lower level 4 or 5 (outside the three textbook series). */
export const series = (from, to) => SERIES[Math.min(level(from), level(to))] ?? null;

/** "uv" (tử ngoại), "visible" or "ir" (hồng ngoại). */
export const region = nm => (nm < VISIBLE[0] ? "uv" : nm > VISIBLE[1] ? "ir" : "visible");

/** +1 emission (electron goes down), −1 absorption (goes up), 0 no transition. */
export const direction = (from, to) => Math.sign(level(from) - level(to));

/** Everything the screen and the event report about one transition. */
export function transition(from, to) {
  const f = level(from);
  const t = level(to);
  const e = photonEnergy(f, t);
  const nm = e > 0 ? HC / e : null;
  return { from: f, to: t, energy: e, wavelength: nm, series: series(f, t), region: nm && region(nm), direction: direction(f, t) };
}
