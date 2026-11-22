// Separating mixtures. A mixture is { component id: mass in g }. A method splits it into fractions
// [{ place, comps }] using only the documented properties of the components below, so the
// suitability table is a consequence of the properties, not a list of answers.

// Boiling points in °C at 1 atm, densities in g/mL near 20 °C.
// Cooking oil is itself a mixture with no sharp boiling point: 300 °C stands for "far above water".
export const COMPONENTS = {
  nuoc: { name: "nước", kind: "liquid", bp: 100, density: 1.0, color: "#a9d2ff" },
  ethanol: { name: "rượu (ethanol)", kind: "liquid", bp: 78.3, density: 0.789, color: "#d9c8ff" },
  dau: { name: "dầu ăn", kind: "liquid", bp: 300, density: 0.92, color: "#f5d04a" },
  cat: { name: "cát", kind: "solid", bp: 2230, color: "#c9a25e" },
  muoi: { name: "muối ăn", kind: "solid", bp: 1465, color: "#eef1f8" },
  sat: { name: "bột sắt", kind: "solid", bp: 2862, magnetic: true, color: "#4b5468" },
  luuhuynh: { name: "bột lưu huỳnh", kind: "solid", bp: 444.6, color: "#f2d21f" },
};
export const BOILING = Object.fromEntries(Object.entries(COMPONENTS).map(([id, c]) => [id, c.bp]));

const SOLUBLE = { muoi: ["nuoc"] }; // solid -> liquids that dissolve it
const MISCIBLE = [["nuoc", "ethanol"]]; // pairs of liquids that mix completely
const VOLATILE_BELOW = 150; // °C: liquids that boil away when the dish is heated over a flame

export const MIXTURES = [
  { id: "cat-nuoc", name: "Cát + nước", comps: { cat: 20, nuoc: 100 } },
  { id: "muoi-nuoc", name: "Muối ăn + nước", comps: { muoi: 10, nuoc: 100 } },
  { id: "dau-nuoc", name: "Dầu ăn + nước", comps: { dau: 40, nuoc: 100 } },
  { id: "sat-luuhuynh", name: "Bột sắt + bột lưu huỳnh", comps: { sat: 10, luuhuynh: 10 } },
  { id: "ruou-nuoc", name: "Rượu (ethanol) + nước", comps: { ethanol: 40, nuoc: 60 } },
];
export const CHALLENGE = { id: "cat-muoi-nuoc", name: "Cát + muối ăn + nước", comps: { cat: 20, muoi: 10, nuoc: 100 }, targets: ["cat", "muoi"] };

export const METHODS = [
  { id: "loc", name: "Lọc", verb: "lọc" },
  { id: "co-can", name: "Cô cạn (bay hơi)", verb: "cô cạn" },
  { id: "chiet", name: "Chiết", verb: "chiết" },
  { id: "nam-cham", name: "Dùng nam châm", verb: "dùng nam châm" },
  { id: "chung-cat", name: "Chưng cất", verb: "chưng cất" },
];

// The method the grade 6 textbook uses for each mixture.
export const RECOMMENDED = { "cat-nuoc": "loc", "muoi-nuoc": "co-can", "dau-nuoc": "chiet", "sat-luuhuynh": "nam-cham", "ruou-nuoc": "chung-cat" };

export const PLACES = {
  "giay-loc": "trên giấy lọc",
  "nuoc-loc": "trong cốc hứng (nước lọc)",
  hoi: "bay hơi vào không khí",
  bat: "còn lại trong bát sứ",
  pheu: "trong phễu chiết",
  "lop-tren": "lớp trên, còn trong phễu chiết",
  "lop-duoi": "lớp dưới, đã chiết ra cốc",
  "nam-cham": "bám vào nam châm",
  giay: "còn lại trên giấy",
  "binh-hung": "trong bình hứng (chất chưng cất được)",
  "binh-cau": "còn lại trong bình cầu",
};

export const mixtureOf = id => MIXTURES.find(m => m.id === id) ?? (id === CHALLENGE.id ? CHALLENGE : MIXTURES[0]);
export const methodOf = id => METHODS.find(m => m.id === id) ?? METHODS[0];

export const initialState = () => ({
  mode: "explore", // "explore" | "challenge"
  mixture: "cat-nuoc",
  method: "loc",
  step1: "co-can", // challenge: first and second method (deliberately not the answer)
  step2: "loc",
  progress: 0, // 0…1 for one separation, 0…2 for the two steps of the challenge
  started: false,
});

export const endOf = s => (s.mode === "challenge" ? 2 : 1);
/** Progress is not bound to a control, so a forged value is clamped here. */
export const progressOf = s => Math.min(endOf(s), Math.max(0, Number(s.progress) || 0));

const pick = (comps, ids) => Object.fromEntries(ids.filter(id => comps[id] > 0).map(id => [id, comps[id]]));
export const miscible = (a, b) => MISCIBLE.some(pair => pair.includes(a) && pair.includes(b));

/** Sort the components of a mixture by how they sit in it. */
export function analyse(comps) {
  const ids = Object.keys(comps).filter(id => comps[id] > 0);
  const liquids = ids.filter(id => COMPONENTS[id].kind === "liquid");
  const solids = ids.filter(id => COMPONENTS[id].kind === "solid");
  const solvent = id => liquids.find(l => SOLUBLE[id]?.includes(l));
  return { ids, liquids, solids, dissolved: solids.filter(solvent), undissolved: solids.filter(id => !solvent(id)), solvent };
}

/** Apply one method to a mixture: { fractions: [{ place, comps }], note }. Masses are conserved. */
export function apply(method, comps) {
  const a = analyse(comps);
  const all = place => [{ place, comps: pick(comps, a.ids) }];
  const split = parts => parts.map(([place, ids]) => ({ place, comps: pick(comps, ids) })).filter(f => Object.keys(f.comps).length);
  switch (method) {
    case "loc": {
      if (!a.liquids.length) return { fractions: all("giay-loc"), note: "Không có chất lỏng nên tất cả nằm lại trên giấy lọc." };
      if (!a.undissolved.length) return { fractions: all("nuoc-loc"), note: "Không có chất rắn không tan nên tất cả đi qua giấy lọc." };
      return { fractions: split([["giay-loc", a.undissolved], ["nuoc-loc", [...a.liquids, ...a.dissolved]]]), note: "Chất rắn không tan bị giữ lại trên giấy lọc, phần chất lỏng đi qua." };
    }
    case "co-can": {
      if (!a.liquids.length) return { fractions: all("bat"), note: "Không có chất lỏng để bay hơi. (Đun nóng mạnh còn có thể làm các chất phản ứng với nhau tạo chất mới.)" };
      const gone = a.liquids.filter(id => COMPONENTS[id].bp < VOLATILE_BELOW);
      const stay = a.ids.filter(id => !gone.includes(id));
      return {
        fractions: split([["hoi", gone], ["bat", stay]]),
        note: stay.length ? "Chất lỏng dễ bay hơi đã bay đi, chất khó bay hơi còn lại trong bát sứ." : "Cả hai chất lỏng đều bay hơi hết, không thu được chất nào.",
      };
    }
    case "chiet": {
      if (!a.liquids.length) return { fractions: all("pheu"), note: "Không có chất lỏng: phễu chiết chỉ dùng cho hai chất lỏng không tan vào nhau." };
      if (a.undissolved.length) return { fractions: all("pheu"), note: "Chất rắn không tan làm tắc khoá phễu: phễu chiết chỉ dùng cho hai chất lỏng không tan vào nhau." };
      const [x, y] = [...a.liquids].sort((p, q) => COMPONENTS[q].density - COMPONENTS[p].density); // x is the denser
      if (!y || miscible(x, y)) return { fractions: all("pheu"), note: "Chỉ có một lớp chất lỏng đồng nhất nên không chiết được." };
      const withIts = l => [l, ...a.dissolved.filter(id => a.solvent(id) === l)];
      return { fractions: split([["lop-duoi", withIts(x)], ["lop-tren", withIts(y)]]), note: `Hai chất lỏng tách thành hai lớp; ${COMPONENTS[x].name} nặng hơn nên ở dưới và được chiết ra trước.` };
    }
    case "nam-cham": {
      const pulled = a.ids.filter(id => COMPONENTS[id].magnetic);
      if (!pulled.length) return { fractions: all("giay"), note: "Không có chất nào bị nam châm hút." };
      return { fractions: split([["nam-cham", pulled], ["giay", a.ids.filter(id => !pulled.includes(id))]]), note: "Sắt bị nam châm hút, chất còn lại thì không." };
    }
    case "chung-cat": {
      if (!a.liquids.length) return { fractions: all("binh-cau"), note: "Không có chất lỏng để chưng cất." };
      const first = a.liquids.reduce((lo, id) => (COMPONENTS[id].bp < COMPONENTS[lo].bp ? id : lo));
      const note = `${COMPONENTS[first].name[0].toUpperCase()}${COMPONENTS[first].name.slice(1)} sôi ở ${String(COMPONENTS[first].bp).replace(".", ",")} °C, hoá hơi trước rồi ngưng tụ vào bình hứng.`;
      const rest = a.liquids.filter(id => id !== first);
      const ideal = rest.some(id => miscible(id, first)) ? " (Mô hình lí tưởng: thực tế phần thu được còn lẫn một ít chất kia.)" : "";
      return { fractions: split([["binh-hung", [first]], ["binh-cau", a.ids.filter(id => id !== first)]]), note: note + ideal };
    }
    default:
      return { fractions: all("giay"), note: "" };
  }
}

const pure = f => f.place !== "hoi" && Object.keys(f.comps).length === 1;
/** A separation works when it gives at least two fractions and at least one collected fraction is a single substance. */
export const works = fractions => fractions.length >= 2 && fractions.some(pure);

/** Boiling point of the liquid that distils first, °C (what the thermometer shows), or null. */
export function distillTemp(comps) {
  const { liquids } = analyse(comps);
  return liquids.length ? Math.min(...liquids.map(id => COMPONENTS[id].bp)) : null;
}

/** One method on one of the five mixtures. */
export function outcome(mixtureId, methodId) {
  const mixture = mixtureOf(mixtureId);
  const result = apply(methodOf(methodId).id, mixture.comps);
  return { ...result, input: mixture.comps, works: works(result.fractions), recommended: RECOMMENDED[mixture.id] === methodOf(methodId).id };
}

/**
 * The challenge: two methods in a row on cát + muối ăn + nước. The second method is applied to the
 * collected fraction of the first that is still a mixture. Success: sand and salt each end up alone.
 */
export function runSequence(step1, step2) {
  const first = apply(methodOf(step1).id, CHALLENGE.comps);
  const k = first.fractions.findIndex(f => f.place !== "hoi" && Object.keys(f.comps).length > 1);
  const second = k >= 0 ? apply(methodOf(step2).id, first.fractions[k].comps) : { fractions: [], note: "" };
  const final = [...first.fractions.filter((_, i) => i !== k), ...second.fractions];
  const success = CHALLENGE.targets.every(id => final.some(f => pure(f) && f.comps[id] > 0));
  return {
    steps: [
      { method: methodOf(step1).id, input: CHALLENGE.comps, ...first },
      { method: methodOf(step2).id, input: k >= 0 ? first.fractions[k].comps : {}, ...second },
    ],
    final,
    success,
  };
}
