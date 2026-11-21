// Natural selection on prey colour. One gene, three heritable variants: 0 light, 1 medium, 2 dark.
// Each generation: predators eat prey, conspicuous ones (colour far from the background) more often;
// survivors produce the next generation (each child copies a random survivor's colour, and with
// probability "mutation" changes to one of the other two colours); the population doubles at most,
// up to the cap. The generator state lives in the state, so a saved state continues exactly.

export const VARIANTS = 3;
const BASE_DEATH = 0.2; // eaten regardless of colour
const SELECTIVE_DEATH = 0.6; // extra risk of the most conspicuous colour at full selection strength
export const MAX_CAP = 500;

export const initialState = () => ({
  background: 2, // 0 light, 1 medium, 2 dark
  selection: 0.8, // 0..1, how much more conspicuous prey are eaten
  mutation: 0.01, // probability per child
  cap: 300, // largest population the habitat holds
  seed: 2026, // seed of this run
  rng: 2026, // current generator state (uint32)
  generation: 0,
  n0: 100, // light
  n1: 100, // medium
  n2: 100, // dark
});

/** One mulberry32 draw; advances s.rng. */
export function random(s) {
  let a = (s.rng = ((s.rng >>> 0) + 0x6d2b79f5) >>> 0);
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

const whole = v => Math.max(0, Math.floor(Number.isFinite(v) ? v : 0));

/** Counts [light, medium, dark], cleaned and kept within [0, cap] even for a forged state. */
export function counts(s) {
  const cap = Math.min(MAX_CAP, whole(s.cap));
  const n = [whole(s.n0), whole(s.n1), whole(s.n2)];
  const total = n[0] + n[1] + n[2];
  if (total <= cap) return n;
  return n.map(x => Math.floor((x * cap) / total));
}

export const total = s => counts(s).reduce((a, b) => a + b, 0);

/** Frequencies of the three variants; they sum to 1 (all 0 after extinction). */
export function frequencies(s) {
  const n = counts(s);
  const sum = n[0] + n[1] + n[2];
  return sum ? n.map(x => x / sum) : [0, 0, 0];
}

/** Chance of being eaten in one generation for colour v on the current background. */
export function deathChance(s, v) {
  const bg = Math.min(2, Math.max(0, Math.round(s.background) || 0));
  const strength = Math.min(1, Math.max(0, s.selection || 0));
  return BASE_DEATH + SELECTIVE_DEATH * strength * (Math.abs(v - bg) / 2);
}

/** Advance one generation. Mutates the state; returns the new counts. */
export function generation(s) {
  const n = counts(s);
  const cap = Math.min(MAX_CAP, whole(s.cap));
  const mu = Math.min(1, Math.max(0, s.mutation || 0));
  // predation
  const survivors = [];
  for (let v = 0; v < VARIANTS; v++) {
    const p = deathChance(s, v);
    for (let i = 0; i < n[v]; i++) if (random(s) >= p) survivors.push(v);
  }
  // reproduction
  const next = [0, 0, 0];
  const size = Math.min(cap, 2 * survivors.length);
  for (let i = 0; i < size; i++) {
    let v = survivors[Math.floor(random(s) * survivors.length)];
    if (mu > 0 && random(s) < mu) v = (v + 1 + Math.floor(random(s) * 2)) % VARIANTS;
    next[v]++;
  }
  [s.n0, s.n1, s.n2] = next;
  s.generation = whole(s.generation) + 1;
  return next;
}

/** Start a fresh population (equal thirds of the cap) with the next seed. */
export function repopulate(s) {
  s.seed = (Math.imul(s.seed >>> 0, 1664525) + 1013904223) >>> 0;
  s.rng = s.seed;
  s.generation = 0;
  const third = Math.floor(Math.min(MAX_CAP, whole(s.cap)) / 3);
  [s.n0, s.n1, s.n2] = [third, third, third];
}
