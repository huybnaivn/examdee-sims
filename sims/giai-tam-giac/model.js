// Solving a triangle ABC from three elements. Side a is opposite angle A, and so on.
// Angles in the state and in the results are in degrees.

export const CASES = ["SSS", "SAS", "ASA", "SSA"];
const EPS = 1e-9;
const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;

export const initialState = () => ({
  mode: "SAS", // which three elements are given
  a: 7, // cm
  b: 5,
  c: 8,
  A: 60, // degrees
  B: 50,
  C: 70,
  pick: 1, // SSA with two triangles: which one is drawn (1 or 2)
  circle: false, // draw the circumcircle
});

// The inputs each case uses, in the order they are given.
export const INPUTS = { SSS: ["a", "b", "c"], SAS: ["b", "A", "c"], ASA: ["B", "a", "C"], SSA: ["a", "b", "A"] };

/** Every quantity of a solved triangle from its three sides and three angles. */
export function measures(a, b, c, A, B, C) {
  const p = (a + b + c) / 2;
  const S = 0.5 * a * b * Math.sin(rad(C));
  const heron = Math.sqrt(Math.max(0, p * (p - a) * (p - b) * (p - c)));
  return { a, b, c, A, B, C, p, S, heron, R: a / (2 * Math.sin(rad(A))), r: S / p };
}

const lawOfCosinesAngle = (opp, x, y) => deg(Math.acos(Math.max(-1, Math.min(1, (x * x + y * y - opp * opp) / (2 * x * y)))));

/**
 * Solve the triangle. Returns { error } (a Vietnamese message) or
 * { solutions: [measures...], steps: [{ rule, text }] }. SSA may give 0, 1 or 2 solutions;
 * 0 solutions comes back as an error with `solutions: []`.
 */
export function solve(s) {
  const { a, b, c, A, B, C } = s;
  const steps = [];
  const pos = (...v) => v.every(x => Number.isFinite(x) && x > 0);
  if (s.mode === "SSS") {
    if (!pos(a, b, c)) return { error: "Độ dài các cạnh phải dương.", solutions: [] };
    const sorted = [a, b, c].sort((x, y) => x - y);
    if (sorted[0] + sorted[1] <= sorted[2] + EPS)
      return { error: `Không có tam giác: ${f(sorted[0])} + ${f(sorted[1])} ≤ ${f(sorted[2])}, vi phạm bất đẳng thức tam giác.`, solutions: [] };
    const A1 = lawOfCosinesAngle(a, b, c);
    const B1 = lawOfCosinesAngle(b, a, c);
    const C1 = 180 - A1 - B1;
    steps.push(
      { rule: "Định lí côsin", text: `cos A = (b² + c² − a²)/(2bc) = ${f((b * b + c * c - a * a) / (2 * b * c), 4)} ⇒ A ≈ ${f(A1, 1)}°` },
      { rule: "Định lí côsin", text: `cos B = (a² + c² − b²)/(2ac) = ${f((a * a + c * c - b * b) / (2 * a * c), 4)} ⇒ B ≈ ${f(B1, 1)}°` },
      { rule: "Tổng ba góc", text: `C = 180° − A − B ≈ ${f(C1, 1)}°` }
    );
    return { solutions: [measures(a, b, c, A1, B1, C1)], steps };
  }
  if (s.mode === "SAS") {
    if (!pos(b, c) || !(A > 0 && A < 180)) return { error: "Cần hai cạnh dương và góc xen giữa từ 0° đến 180°.", solutions: [] };
    const a1 = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(rad(A)));
    const B1 = lawOfCosinesAngle(b, a1, c);
    const C1 = 180 - A - B1;
    steps.push(
      { rule: "Định lí côsin", text: `a² = b² + c² − 2bc·cos A = ${f(a1 * a1)} ⇒ a ≈ ${f(a1)}` },
      { rule: "Định lí côsin", text: `cos B = (a² + c² − b²)/(2ac) = ${f((a1 * a1 + c * c - b * b) / (2 * a1 * c), 4)} ⇒ B ≈ ${f(B1, 1)}°` },
      { rule: "Tổng ba góc", text: `C = 180° − A − B ≈ ${f(C1, 1)}°` }
    );
    return { solutions: [measures(a1, b, c, A, B1, C1)], steps };
  }
  if (s.mode === "ASA") {
    if (!pos(a, B, C)) return { error: "Cần một cạnh dương và hai góc dương.", solutions: [] };
    if (B + C >= 180 - EPS) return { error: `Không có tam giác: B + C = ${f(B + C, 1)}° ≥ 180°.`, solutions: [] };
    const A1 = 180 - B - C;
    const k = a / Math.sin(rad(A1)); // = 2R
    const b1 = k * Math.sin(rad(B));
    const c1 = k * Math.sin(rad(C));
    steps.push(
      { rule: "Tổng ba góc", text: `A = 180° − B − C = ${f(A1, 1)}°` },
      { rule: "Định lí sin", text: `a/sin A = ${f(k)} = 2R` },
      { rule: "Định lí sin", text: `b = a·sin B/sin A ≈ ${f(b1)};  c = a·sin C/sin A ≈ ${f(c1)}` }
    );
    return { solutions: [measures(a, b1, c1, A1, B, C)], steps };
  }
  // SSA: a, b and angle A opposite a.
  if (!pos(a, b) || !(A > 0 && A < 180)) return { error: "Cần hai cạnh dương và góc A từ 0° đến 180°.", solutions: [] };
  const sinB = (b * Math.sin(rad(A))) / a;
  steps.push({ rule: "Định lí sin", text: `sin B = b·sin A/a = ${f(sinB, 4)}` });
  if (sinB > 1 + EPS) return { error: `sin B = ${f(sinB, 4)} > 1: không có tam giác nào.`, solutions: [], steps };
  const B1 = sinB >= 1 - EPS ? 90 : deg(Math.asin(sinB));
  const candidates = B1 === 90 ? [90] : [B1, 180 - B1];
  const solutions = [];
  for (const Bk of candidates) {
    const Ck = 180 - A - Bk;
    if (Ck <= EPS) continue;
    solutions.push(measures(a, b, (a * Math.sin(rad(Ck))) / Math.sin(rad(A)), A, Bk, Ck));
  }
  if (!solutions.length) return { error: `A + B ≥ 180° với mọi giá trị của B: không có tam giác nào.`, solutions, steps };
  steps.push({
    rule: "Biện luận",
    text: candidates.length === 2
      ? `B ≈ ${f(B1, 1)}° hoặc B ≈ ${f(180 - B1, 1)}°` + (solutions.length === 2 ? ": cả hai đều được (2 tam giác)" : `; chỉ B ≈ ${f(solutions[0].B, 1)}° cho A + B < 180°`)
      : "B = 90°: đúng một tam giác",
  });
  steps.push({ rule: "Định lí sin", text: `C = 180° − A − B;  c = a·sin C/sin A` });
  return { solutions, steps };
}

// Plain decimal-comma format, kept here so the model has no kit import.
function f(n, digits = 2) {
  if (Math.abs(n) < 0.5 * 10 ** -digits) n = 0;
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits }).replace("-", "−");
}
