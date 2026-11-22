// DNA replication at one fork, drawn flat, and semi-conservative bookkeeping over several rounds.
//
// Geometry of the fork (helicase moves left to right):
//   template 1 (top) is written 3'→5' left to right; its new partner is the leading strand, made
//   continuously 5'→3' in the direction the fork moves;
//   template 2 (bottom) is 5'→3' left to right; its new partner is the lagging strand, made 5'→3'
//   away from the fork in Okazaki fragments of FRAGMENT nucleotides, joined later by ligase.
// Time is counted in "nucleotide steps": helicase opens one base pair per step.
// ponytail: primers are left out; add them to fragmentsOf() if the lesson needs RNA primers.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const BASE = "TACGGCATTCAGGCTA"; // template 1; the molecule uses its first `length` bases
export const MIN_LENGTH = 6;
export const MAX_LENGTH = BASE.length;
export const MAX_ROUNDS = 5;
export const FRAGMENT = 4; // nucleotides per Okazaki fragment (real ones are 1000–2000 in bacteria)
export const SPEED = 2.5; // nucleotide steps per second of animation

const PAIR = { A: "T", T: "A", G: "C", C: "G" };
export const complement = seq => [...seq].map(b => PAIR[b]).join("");
/** Hydrogen bonds in the pair this base belongs to: 2 for A–T, 3 for G–C. */
export const hydrogenBonds = base => (base === "A" || base === "T" ? 2 : 3);

export const initialState = () => ({
  length: 12, // base pairs
  rounds: 3, // n, rounds of replication to run
  round: 0, // rounds already finished
  progress: 55, // % of the round on show
  guess: 0, // predicted number of molecules that keep an original strand after n rounds
  verdict: "none", // "none" | "right" | "wrong"
});

export const lengthOf = s => clamp(Math.round(Number(s.length) || 0), MIN_LENGTH, MAX_LENGTH);
export const roundsOf = s => clamp(Math.round(Number(s.rounds) || 0), 1, MAX_ROUNDS);
export const roundOf = s => clamp(Math.floor(Number(s.round) || 0), 0, roundsOf(s));
export const templateOf = s => BASE.slice(0, lengthOf(s));

/** Counts for one double-stranded molecule whose first strand is `seq`. */
export function composition(seq) {
  const at = [...seq].filter(b => b === "A" || b === "T").length;
  const gc = seq.length - at;
  return { pairs: seq.length, nucleotides: 2 * seq.length, A: at, T: at, G: gc, C: gc, hydrogen: 2 * at + 3 * gc };
}

// ---------- one fork ----------

/** Okazaki fragments for L base pairs: template positions [start, start + len), synthesis begins at step `begin`. */
export const fragmentsOf = L =>
  Array.from({ length: Math.ceil(L / FRAGMENT) }, (_, j) => {
    const start = j * FRAGMENT;
    const len = Math.min(FRAGMENT, L - start);
    return { start, len, begin: start + len + 1 }; // its whole template must be unwound first
  });

/** Steps for one whole round: last fragment made, then joined, then one step to look at the result. */
export const duration = L => {
  const last = fragmentsOf(L).at(-1);
  return last.begin + last.len + 2;
};

/** State of the fork after t steps. Positions are indices on template 1, counted from the left. */
export function fork(seq, t) {
  const L = seq.length;
  t = clamp(t, 0, duration(L));
  const leading = clamp(Math.floor(t - 1), 0, L); // positions 0 .. leading − 1, always behind the helicase
  const fragments = fragmentsOf(L).map((f, j) => ({
    ...f,
    made: clamp(Math.floor(t - f.begin), 0, f.len), // positions start + len − made .. start + len − 1 (grows leftwards)
    joined: j > 0 && t >= f.begin + f.len + 1, // ligase has sealed it to the fragment on its left
  }));
  const lagging = fragments.flatMap(f => Array.from({ length: f.made }, (_, k) => f.start + f.len - 1 - k));
  const bonds = positions => positions.reduce((sum, i) => sum + hydrogenBonds(seq[i]), 0);
  return {
    t,
    unwound: Math.min(L, t), // base pairs opened by helicase (fractional while a pair is opening)
    leading,
    fragments,
    lagging,
    added: leading + lagging.length, // free nucleotides used so far in this round, for this molecule
    hydrogen: bonds(Array.from({ length: leading }, (_, i) => i)) + bonds(lagging), // new hydrogen bonds formed
    pieces: fragments.filter(f => f.made > 0 && !f.joined).length, // separate stretches of the lagging strand
    complete: t >= duration(L),
  };
}

/** The four strands once the round is complete, all read left to right. */
export const daughters = seq => [
  { old: seq, made: complement(seq) }, // template 1 + leading strand
  { old: complement(seq), made: seq }, // template 2 + lagging strand
];

// ---------- generations ----------

/** One round: every molecule [strandA, strandB] (numbers = round in which the strand was made, 0 = original) gives two. */
export const replicate = (molecules, round) => molecules.flatMap(([a, b]) => [[a, round], [b, round]]);

export function generations(n) {
  let molecules = [[0, 0]];
  for (let r = 1; r <= clamp(Math.floor(n), 0, MAX_ROUNDS); r++) molecules = replicate(molecules, r);
  return molecules;
}

export const withOriginal = n => generations(n).filter(m => m.includes(0)).length;

/** Totals after n rounds starting from one molecule whose first strand is `seq`. */
export function totals(seq, n) {
  const c = composition(seq);
  const molecules = generations(n).length;
  const made = molecules - 1; // molecules' worth of new nucleotides: 2ⁿ − 1
  return {
    molecules,
    withOriginal: withOriginal(n),
    allNew: molecules - withOriginal(n),
    nucleotidesUsed: c.nucleotides * made, // N(2ⁿ − 1)
    usedA: c.A * made, // = T used
    usedG: c.G * made, // = C used
    hydrogenBroken: c.hydrogen * made, // H(2ⁿ − 1)
    hydrogenTotal: c.hydrogen * molecules, // in all molecules after n rounds
  };
}

// ---------- animation and prediction ----------

export const timeOf = s => (clamp(Number(s.progress) || 0, 0, 100) / 100) * duration(lengthOf(s));
/** The round the fork picture shows: the finished one at 100 %, otherwise the one in progress. */
export const shownRound = s => (s.progress >= 100 && roundOf(s) >= 1 ? roundOf(s) : roundOf(s) + 1);

/** The slider reached 100 %: count the round. True when a round was finished by this. */
export function commitProgress(s) {
  if (s.progress < 100 || roundOf(s) >= roundsOf(s)) return false;
  s.round = roundOf(s) + 1;
  return true;
}

/** Advance the animation by dt seconds. True when a round has just finished. */
export function step(s, dt) {
  if (roundOf(s) >= roundsOf(s)) return false;
  if (s.progress >= 100) s.progress = 0; // next round
  s.progress = Math.min(100, clamp(Number(s.progress) || 0, 0, 100) + (dt * SPEED * 100) / duration(lengthOf(s)));
  return commitProgress(s);
}

export function restart(s) {
  s.round = 0;
  s.progress = 0;
  s.verdict = "none";
  return s;
}

/** Check the learner's prediction for n = rounds. */
export function check(s) {
  const correct = Math.round(s.guess) === withOriginal(roundsOf(s));
  s.verdict = correct ? "right" : "wrong";
  return correct;
}
