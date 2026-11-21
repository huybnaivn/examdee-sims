// Transcription and translation of a short gene, with point mutations.
// The template strand is written 3'→5' left to right, so the mRNA (5'→3') lines up under it base for base.

export const MIN_LEN = 3;
export const MAX_LEN = 36;

// Standard genetic code. Index = 16·i + 4·j + k for the bases U, C, A, G at codon positions 1, 2, 3.
const BASES = "UCAG";
const CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
const THREE = {
  F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg",
  I: "Ile", M: "Met", T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly", "*": "KT",
};
export const STOP = "KT"; // bộ ba kết thúc

/** Every codon → three-letter amino acid ("KT" for a stop codon). 64 entries. */
export const CODON_TABLE = {};
for (let i = 0; i < 64; i++) {
  CODON_TABLE[BASES[i >> 4] + BASES[(i >> 2) & 3] + BASES[i & 3]] = THREE[CODE[i]];
}

const PAIR = { A: "U", T: "A", G: "C", C: "G" }; // template DNA → mRNA
const BACK = { A: "T", U: "A", G: "C", C: "G" }; // mRNA → template DNA
const ANTI = { A: "U", U: "A", G: "C", C: "G" }; // codon → anticodon

export const transcribe = template => [...template].map(b => PAIR[b]).join("");
export const templateOf = mrna => [...mrna].map(b => BACK[b]).join("");
/** Anticodon of the tRNA that reads `codon`, written 3'→5' so it lines up under the codon. */
export const anticodon = codon => [...codon].map(b => ANTI[b]).join("");

/** Translate from the first AUG, codon by codon, until a stop codon (included in `codons`) or the end. */
export function translate(mrna) {
  const start = mrna.indexOf("AUG");
  const codons = [];
  const aminoAcids = [];
  let stopped = false;
  if (start >= 0) {
    for (let i = start; i + 3 <= mrna.length; i += 3) {
      const codon = mrna.slice(i, i + 3);
      codons.push(codon);
      if (CODON_TABLE[codon] === STOP) {
        stopped = true;
        break;
      }
      aminoAcids.push(CODON_TABLE[codon]);
    }
  }
  return { start, codons, aminoAcids, stopped };
}

export const PRESETS = [
  { value: "p1", label: "Gene ngắn (5 amino acid)", mrna: "CAAUGGCUUCAAAGUGGUAACU" },
  { value: "p2", label: "Đoạn đầu gene β-globin (rút gọn)", mrna: "ACAUGGUGCACCUGACUCCUGAGGAGAAGUAAGC" },
  { value: "p3", label: "Có hai bộ ba AUG lệch khung", mrna: "UUACAUGCAUGGGAUAGCCUGAUU" },
].map(p => ({ ...p, template: templateOf(p.mrna) }));

export const MUTATIONS = { sub: "thay thế", ins: "thêm", del: "mất" };
export const MUT_CODE = { sub: 0, ins: 1, del: 2 };
// Effect of a mutation on the polypeptide.
export const EFFECTS = [
  "Đột biến câm (đồng nghĩa): chuỗi polypeptide không đổi",
  "Đột biến sai nghĩa: một amino acid bị thay bằng amino acid khác",
  "Đột biến vô nghĩa: xuất hiện bộ ba kết thúc sớm",
  "Đột biến dịch khung: khung đọc thay đổi từ điểm đột biến",
  "Đổi bộ ba mở đầu hoặc mất bộ ba kết thúc: chuỗi polypeptide thay đổi",
];
export const EFFECT_SHORT = ["câm", "sai nghĩa", "vô nghĩa", "dịch khung", "đổi mã mở đầu/kết thúc"];

export const initialState = () => ({
  preset: "p1",
  template: PRESETS[0].template,
  original: PRESETS[0].template, // the gene before any mutation, for "Khôi phục gene gốc"
  tx: PRESETS[0].template.length, // nucleotides transcribed (fraction while the polymerase moves)
  tl: 2.4, // codons translated
  mutType: "sub",
  mutPos: 12,
  mutBase: "A",
  target: "none",
  showTable: false,
  lastType: -1, // MUT_CODE of the last mutation, -1 if none
  lastEffect: -1, // effect code of the last mutation, -1 if none
});

/** Position stays inside the current strand, progress inside its range (state keys can be forged). */
export function tidy(s) {
  const n = s.template.length;
  s.mutPos = Math.round(Math.min(Math.max(s.mutPos, 1), n));
  s.tx = Math.min(Math.max(s.tx, 0), n);
  s.tl = Math.min(Math.max(s.tl, 0), translate(transcribe(s.template)).codons.length);
  return s;
}

/** Template after a mutation at 1-based position `pos`. Insertion puts `base` after nucleotide `pos`. */
export function mutate(template, type, pos, base) {
  const i = pos - 1;
  if (type === "sub") return template.slice(0, i) + base + template.slice(i + 1);
  if (type === "ins") return template.slice(0, i + 1) + base + template.slice(i + 1);
  return template.slice(0, i) + template.slice(i + 1);
}

/** Effect code (index into EFFECTS) of turning template `before` into `after` with a mutation of `type`. */
export function classify(before, after, type) {
  const a = translate(transcribe(before));
  const b = translate(transcribe(after));
  const same = a.start === -1 ? b.start === -1 : a.aminoAcids.join() === b.aminoAcids.join() && a.stopped === b.stopped;
  if (same) return 0;
  if (type !== "sub") return 3;
  if (a.start < 0 || b.start !== a.start) return 4;
  const n = a.aminoAcids.length;
  const m = b.aminoAcids.length;
  if (m < n && b.stopped && a.aminoAcids.slice(0, m).join() === b.aminoAcids.join()) return 2;
  if (m === n && a.stopped === b.stopped && a.aminoAcids.filter((x, k) => x !== b.aminoAcids[k]).length === 1) return 1;
  return 4;
}

/** Can the chosen mutation be applied? Returns null if so, otherwise the reason. */
export function blocked(s) {
  const n = s.template.length;
  if (s.mutType === "sub" && s.template[s.mutPos - 1] === s.mutBase) return "Nucleotide mới trùng nucleotide cũ.";
  if (s.mutType === "ins" && n >= MAX_LEN) return `Mạch khuôn đã dài tối đa ${MAX_LEN} nucleotide.`;
  if (s.mutType === "del" && n <= MIN_LEN) return `Mạch khuôn cần ít nhất ${MIN_LEN} nucleotide.`;
  return null;
}

/** Apply the chosen mutation to the state. Returns { type, effect } codes, or null if it is blocked. */
export function applyMutation(s) {
  if (blocked(s)) return null;
  const after = mutate(s.template, s.mutType, s.mutPos, s.mutBase);
  const effect = classify(s.template, after, s.mutType);
  s.template = after;
  s.lastType = MUT_CODE[s.mutType];
  s.lastEffect = effect;
  s.tx = 0;
  s.tl = 0;
  tidy(s);
  return { type: s.lastType, effect };
}

/** Clean a template typed by the learner: DNA letters only (U read as T), at most MAX_LEN. */
export const cleanTemplate = text =>
  String(text).toUpperCase().replace(/U/g, "T").replace(/[^ATGC]/g, "").slice(0, MAX_LEN);
