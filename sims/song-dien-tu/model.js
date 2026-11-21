// Electromagnetic spectrum. SI units: f in Hz, λ in m, ε in J or eV.
// c = λf, ε = hf. Constants as rounded in Vietnamese textbooks.

export const C = 3e8; // m/s
export const H = 6.626e-34; // J·s
export const E = 1.6e-19; // C, so 1 eV = 1,6·10⁻¹⁹ J
export const F_MIN = 3; // log10 f, Hz
export const F_MAX = 23;
export const LOG_C = Math.log10(C);
export const LOG_HE = Math.log10(H / E); // log10 of eV per Hz

/**
 * Regions, radio (low f) first. Boundaries by wavelength, a lower bound is inclusive:
 * a region holds lo ≤ λ < hi, except visible light which holds 380 nm ≤ λ ≤ 760 nm.
 * The edges are conventions; neighbouring regions overlap in nature (X and gamma are told apart by source).
 */
export const REGIONS = [
  { name: "Sóng vô tuyến", short: "Vô tuyến", lo: 1, hi: Infinity, color: "#b8c4dc",
    sources: "Mạch dao động điện, ăng-ten phát thanh, phát hình", uses: "Phát thanh, truyền hình, liên lạc vô tuyến" },
  { name: "Vi sóng", short: "Vi sóng", lo: 1e-3, hi: 1, color: "#9fb3e8",
    sources: "Đèn magnetron, ăng-ten điện thoại, wifi, radar", uses: "Lò vi sóng, điện thoại di động, wifi, radar, thông tin vệ tinh" },
  { name: "Tia hồng ngoại", short: "Hồng ngoại", lo: 7.6e-7, hi: 1e-3, color: "#e8a3a3",
    sources: "Mọi vật có nhiệt độ, Mặt Trời, bếp, cơ thể người", uses: "Sưởi, sấy khô, điều khiển từ xa, camera ảnh nhiệt" },
  { name: "Ánh sáng nhìn thấy", short: "Nhìn thấy", lo: 3.8e-7, hi: 7.6e-7, color: "#ffffff",
    sources: "Mặt Trời, đèn sợi đốt, đèn LED, ngọn lửa", uses: "Chiếu sáng, quan sát, quang hợp, chụp ảnh" },
  { name: "Tia tử ngoại", short: "Tử ngoại", lo: 1e-8, hi: 3.8e-7, color: "#c3a6f0",
    sources: "Mặt Trời, hồ quang điện, đèn hơi thủy ngân", uses: "Tiệt trùng, chữa còi xương, phát hiện vết nứt, tiền giả" },
  { name: "Tia X", short: "Tia X", lo: 1e-11, hi: 1e-8, color: "#9fd4e8",
    sources: "Ống tia X (electron tốc độ cao đập vào kim loại)", uses: "Chiếu chụp X quang, chữa ung thư nông, kiểm tra hành lý, nghiên cứu tinh thể" },
  { name: "Tia gamma", short: "Gamma", lo: 0, hi: 1e-11, color: "#a8dcb0",
    sources: "Hạt nhân phóng xạ, phản ứng hạt nhân, vũ trụ", uses: "Chữa ung thư, khử trùng thực phẩm, dò khuyết tật kim loại" },
];
export const ALL_FOUND = (1 << REGIONS.length) - 1;

export const initialState = () => ({
  mode: "wavelength", // which quantity the slider sets: frequency | wavelength | energy
  logF: 14.75, // log10 f (Hz), about 535 nm, green
  logL: LOG_C - 14.75, // log10 λ (m)
  logE: LOG_HE + 14.75, // log10 ε (eV)
  found: 0, // bitmask of regions the learner has released the marker in
});

export const frequency = s => 10 ** s.logF;
export const wavelength = s => C / frequency(s); // c = λf
export const energyJ = s => H * frequency(s); // ε = hf
export const energyEV = s => energyJ(s) / E;

/** Set log f, clamped to the axis, and keep the two other sliders in step. */
export function setLogF(s, logF) {
  s.logF = Math.min(F_MAX, Math.max(F_MIN, Number.isFinite(logF) ? logF : F_MIN));
  s.logL = LOG_C - s.logF;
  s.logE = LOG_HE + s.logF;
}
export const fromWavelength = (s, logL) => setLogF(s, LOG_C - logL);
export const fromEnergy = (s, logE) => setLogF(s, logE - LOG_HE);

export function regionIndex(lambda) {
  if (lambda >= 3.8e-7 && lambda <= 7.6e-7) return 3;
  return REGIONS.findIndex(r => lambda >= r.lo && lambda < r.hi);
}

/** sRGB colour [r, g, b] (0–255) of monochromatic light, null outside 380–760 nm. Approximate. */
export function visibleColor(nm) {
  if (!(nm >= 380 && nm <= 760)) return null;
  let r = 0, g = 0, b = 0;
  if (nm < 440) [r, b] = [(440 - nm) / 60, 1];
  else if (nm < 490) [g, b] = [(nm - 440) / 50, 1];
  else if (nm < 510) [g, b] = [1, (510 - nm) / 20];
  else if (nm < 580) [r, g] = [(nm - 510) / 70, 1];
  else if (nm < 645) [r, g] = [1, (645 - nm) / 65];
  else r = 1;
  // dimmer towards the ends, where the eye is less sensitive
  const k = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (760 - nm)) / 60 : 1;
  return [r, g, b].map(v => Math.round(255 * (v * k) ** 0.8));
}

/** Everyday things to compare a wavelength with, sizes in m. */
export const OBJECTS = [
  [1.65e6, "chiều dài nước Việt Nam (khoảng 1 650 km)"],
  [6e4, "quãng đường Hà Nội – Hải Dương (khoảng 60 km)"],
  [8.8e3, "chiều cao đỉnh Everest (khoảng 8,8 km)"],
  [300, "một tòa nhà chọc trời (khoảng 300 m)"],
  [10, "một ngôi nhà ba tầng (khoảng 10 m)"],
  [1.7, "một người (khoảng 1,7 m)"],
  [0.15, "bàn tay (khoảng 15 cm)"],
  [0.02, "đồng xu (khoảng 2 cm)"],
  [2e-3, "con kiến (khoảng 2 mm)"],
  [1e-4, "sợi tóc (đường kính khoảng 0,1 mm)"],
  [1e-5, "tế bào người (khoảng 10 µm)"],
  [1e-6, "vi khuẩn (khoảng 1 µm)"],
  [1e-7, "virus (khoảng 100 nm)"],
  [1e-8, "phân tử protein (khoảng 10 nm)"],
  [1e-9, "phân tử nhỏ (khoảng 1 nm)"],
  [1e-10, "nguyên tử (khoảng 0,1 nm)"],
  [1e-14, "hạt nhân nguyên tử (khoảng 10⁻¹⁴ m)"],
];

export function compareObject(lambda) {
  let best = OBJECTS[0];
  for (const o of OBJECTS) if (Math.abs(Math.log10(o[0] / lambda)) < Math.abs(Math.log10(best[0] / lambda))) best = o;
  return { size: best[0], name: best[1] };
}

// ---------- number formatting (decimal comma, superscript powers) ----------
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const comma = (x, digits) => {
  const t = Number(x.toPrecision(digits)).toString().replace(".", ",");
  return t.replace("-", "−");
};

/** "5,45·10¹⁴" */
export function sci(x, digits = 3) {
  if (!Number.isFinite(x) || x === 0) return comma(x, digits);
  let exp = Math.floor(Math.log10(Math.abs(x)));
  let m = Number((x / 10 ** exp).toPrecision(digits));
  if (Math.abs(m) >= 10) [m, exp] = [m / 10, exp + 1];
  if (exp === 0) return comma(m, digits);
  return `${comma(m, digits)}·10${String(exp).split("").map(ch => SUP[ch]).join("")}`;
}

const PREFIX = [[1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"], [1e-15, "f"]];
/** Length with an SI prefix, 3 significant digits: "535 nm", "3,00 km". */
export function lengthText(m) {
  const p = PREFIX.find(([v]) => m >= v * 0.9995) ?? PREFIX.at(-1);
  const v = m / p[0];
  return `${v >= 1000 ? sci(v) : comma(v, 3)} ${p[1]}m`;
}

/** Photon energy in eV with a prefix where it reads naturally, scientific notation otherwise. */
export function energyText(ev) {
  if (ev >= 1e6 * 0.9995) return `${ev >= 1e9 ? sci(ev / 1e6) : comma(ev / 1e6, 3)} MeV`;
  if (ev >= 1e3 * 0.9995) return `${comma(ev / 1e3, 3)} keV`;
  if (ev >= 0.9995) return `${comma(ev, 3)} eV`;
  if (ev >= 1e-3 * 0.9995) return `${comma(ev * 1e3, 3)} meV`;
  return `${sci(ev)} eV`;
}
