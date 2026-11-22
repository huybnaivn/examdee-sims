// A corrosion lab: three jars, each holding an iron nail. The learner decides what goes in every jar.
// Pure logic, no DOM.
//
// Rust needs water AND oxygen reaching bare iron. The relative rates below are a qualitative
// teaching scale, not measured data: what textbooks document is the ORDER (iron joined to copper
// in salt water > salt water > tap water > moist air > protected iron = none).
// ponytail: the factors only fix that order; replace them with measured rates if ever needed.

export const DAYS = 30; // length of one run, days
export const K = 0.021; // 1/day per unit of relative rate: salt water alone reaches about 85 % in 30 days
export const JARS = [1, 2, 3];

export const LIQUIDS = {
  none: { label: "Không có nước", rate: 0 },
  boiled: { label: "Nước cất đã đun sôi", rate: 0.3 }, // no dissolved oxygen at first; it creeps back in if left open
  tap: { label: "Nước máy", rate: 1 },
  salt: { label: "Nước muối", rate: 3 }, // conducts better: electrochemical corrosion is faster
  vinegar: { label: "Giấm ăn (acid loãng)", rate: 4 }, // acid attacks iron directly, no oxygen needed
};
export const OIL_FACTOR = 0.1; // an oil layer keeps new oxygen out; what was dissolved is soon used up
export const MOIST_AIR = 0.15; // open jar, no water: slow rusting in moist air
export const CU_FACTOR = 2; // iron is the anode of an Fe–Cu cell and corrodes faster than alone
export const ZN_VINEGAR = 6; // zinc dissolves quickly in acid

// What can be put into a jar. Liquids replace each other; the rest are switched on or off.
export const ITEMS = {
  boiled: "Nước cất đun sôi",
  tap: "Nước máy",
  salt: "Nước muối",
  vinegar: "Giấm ăn",
  oil: "Lớp dầu phủ mặt nước",
  dry: "Chất hút ẩm CaCl₂ khan",
  coat: "Sơn chống gỉ",
  Zn: "Thanh kẽm nối với đinh",
  Cu: "Dây đồng nối với đinh",
};
export const ITEM_ORDER = Object.keys(ITEMS);

// Standard electrode potentials E° (V), for the explanation text.
export const E0 = { Zn: -0.763, Fe: -0.44, Cu: 0.34 };

export const initialState = () => ({
  l1: "tap", o1: false, d1: false, c1: false, p1: "none",
  l2: "salt", o2: false, d2: false, c2: false, p2: "Cu",
  l3: "salt", o3: false, d3: false, c3: true, p3: "none",
  day: 0, // days since the nails went in
  speed: 2.5, // days per second of playback
  done: false, // the run reached the last day and was reported
  sel: 1, // jar picked for the keyboard controls
  pick: "salt", // item picked for the keyboard controls
  guess: 0, // predicted most-corroded jar (0 = no prediction)
  mission: "none",
});

/** Contents of jar i as one object. Unknown values fall back to an empty, open jar. */
export function jar(s, i) {
  const liquid = s[`l${i}`] in LIQUIDS ? s[`l${i}`] : "none";
  const partner = s[`p${i}`] === "Zn" || s[`p${i}`] === "Cu" ? s[`p${i}`] : "none";
  return { liquid, oil: s[`o${i}`] === true && liquid !== "none", dry: s[`d${i}`] === true && liquid === "none", coat: s[`c${i}`] === true, partner };
}

/** Relative corrosion rate of the iron nail (0 = stays shiny). */
export function ironRate(j) {
  if (j.coat) return 0; // paint keeps water and oxygen off the iron
  if (j.liquid === "none") return j.dry ? 0 : MOIST_AIR; // no water at all, or only moist air
  if (j.partner === "Zn") return 0; // zinc is more active: it is the anode and is sacrificed
  let rate = LIQUIDS[j.liquid].rate;
  if (j.oil && j.liquid !== "vinegar") rate = j.liquid === "boiled" ? 0 : rate * OIL_FACTOR;
  if (j.partner === "Cu") rate *= CU_FACTOR;
  return rate;
}

/** Relative corrosion rate of the zinc bar (it only corrodes when wet). */
export function zincRate(j) {
  if (j.partner !== "Zn" || j.liquid === "none") return 0;
  return j.liquid === "vinegar" ? ZN_VINEGAR : LIQUIDS[j.liquid].rate;
}

const amount = (rate, day) => 1 - Math.exp(-K * rate * Math.min(DAYS, Math.max(0, Number.isFinite(day) ? day : 0)));
/** Fraction of the nail eaten by corrosion, 0–1. */
export const corrosion = (j, day) => amount(ironRate(j), day);
/** Fraction of the zinc bar eaten away, 0–1. */
export const zincLoss = (j, day) => amount(zincRate(j), day);
export const MAX_RATE = LIQUIDS.vinegar.rate * CU_FACTOR;

/** One short sentence explaining what happens in this jar. */
export function reason(j) {
  if (j.coat) return "Lớp sơn ngăn nước và oxygen chạm vào sắt.";
  if (j.liquid === "none") return j.dry ? "Không khí khô, không có nước: sắt không gỉ." : "Không khí ẩm: sắt gỉ rất chậm.";
  if (j.partner === "Zn") return "Kẽm hoạt động mạnh hơn sắt nên bị ăn mòn thay cho sắt.";
  const cu = j.partner === "Cu" ? " Nối với đồng, sắt là cực âm nên bị ăn mòn nhanh hơn." : "";
  if (j.liquid === "vinegar") return `Acid ăn mòn sắt và giải phóng khí hydrogen.${cu}`;
  if (j.oil) return j.liquid === "boiled" ? "Nước đun sôi hết oxygen, lớp dầu chặn oxygen mới: sắt không gỉ." : `Lớp dầu chặn oxygen mới nên sắt gỉ rất chậm.${cu}`;
  if (j.liquid === "boiled") return `Oxygen tan dần trở lại vào nước nên sắt gỉ chậm.${cu}`;
  if (j.liquid === "salt") return `Nước muối dẫn điện tốt: sắt gỉ nhanh.${cu}`;
  return `Có đủ nước và oxygen: sắt bị gỉ.${cu}`;
}

/** Put an item into jar i. Returns "" when done, or a message saying why it cannot be done. */
export function add(s, i, item) {
  if (!JARS.includes(i) || !(item in ITEMS)) return "Không có vật đó.";
  if (item in LIQUIDS) {
    s[`l${i}`] = item;
    s[`d${i}`] = false; // the drying agent is useless once water is poured in
  } else if (item === "oil") {
    if (jar(s, i).liquid === "none") return "Phải có nước thì lớp dầu mới nổi lên trên được.";
    s[`o${i}`] = true;
  } else if (item === "dry") {
    s[`l${i}`] = "none";
    s[`o${i}`] = false;
    s[`d${i}`] = true;
  } else if (item === "coat") s[`c${i}`] = true;
  else s[`p${i}`] = item;
  restart(s);
  return "";
}

/** Take an item out of jar i. */
export function remove(s, i, item) {
  if (!JARS.includes(i)) return;
  if (item in LIQUIDS) { if (s[`l${i}`] === item) { s[`l${i}`] = "none"; s[`o${i}`] = false; } }
  else if (item === "oil") s[`o${i}`] = false;
  else if (item === "dry") s[`d${i}`] = false;
  else if (item === "coat") s[`c${i}`] = false;
  else if (s[`p${i}`] === item) s[`p${i}`] = "none";
  restart(s);
}

/** Is this item in jar i right now? */
export function has(s, i, item) {
  const j = jar(s, i);
  if (item in LIQUIDS) return j.liquid === item;
  if (item === "Zn" || item === "Cu") return j.partner === item;
  return j[item] === true;
}

/** Items in jar i, in shelf order. */
export const contents = (s, i) => ITEM_ORDER.filter(item => has(s, i, item));

/** A changed jar is a new experiment: back to day 0. */
export function restart(s) {
  s.day = 0;
  s.done = false;
}

/** Advance time by dt days. Returns true when the run has just reached the last day. */
export function step(s, dt) {
  if (s.done) return false;
  s.day = Math.min(DAYS, Math.max(0, s.day) + dt);
  if (s.day < DAYS) return false;
  s.done = true;
  return true;
}

/** Jar with strictly the most corrosion after the full run, or 0 when the top is a tie. */
export function winner(s) {
  const rates = JARS.map(i => ironRate(jar(s, i)));
  const top = Math.max(...rates);
  return rates.filter(r => r === top).length === 1 ? rates.indexOf(top) + 1 : 0;
}

export const MISSIONS = {
  none: "Tự do thí nghiệm",
  "keep-shiny": "Ngâm đinh trong nước muối 30 ngày mà vẫn sáng bóng",
  sacrifice: "Để một kim loại khác bị ăn mòn thay cho sắt",
  fastest: "Làm đinh bị ăn mòn nhanh nhất có thể",
};

/** Is the mission achieved by the jars as they stand (judged at the end of a run)? */
export function missionMet(s, id) {
  const js = JARS.map(i => jar(s, i));
  if (id === "keep-shiny") return js.some(j => j.liquid === "salt" && corrosion(j, DAYS) < 0.02);
  if (id === "sacrifice") return js.some(j => zincLoss(j, DAYS) > 0.4 && ironRate(j) === 0);
  if (id === "fastest") return js.some(j => ironRate(j) === MAX_RATE);
  return false;
}
