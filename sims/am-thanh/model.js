// A loudspeaker sends a sinusoidal sound wave into a medium. Pure model, SI units.
// The frequency slider is logarithmic (key logFrequency) so one control covers 3 Hz to 100 kHz;
// the frequency itself is rounded to two significant figures so 16 Hz and 20 000 Hz can be hit exactly.

export const MEDIA = {
  air: { name: "Không khí", speed: 340 },
  water: { name: "Nước", speed: 1500 },
  steel: { name: "Thép", speed: 6000 },
};
export const I0 = 1e-12; // W/m², reference intensity (cường độ âm chuẩn)
export const I_UNIT = 1e-6; // W/m², intensity at the listener when the amplitude A = 1
export const LOW = 16; // Hz, below: hạ âm
export const HIGH = 20000; // Hz, above: siêu âm

export const initialState = () => ({
  logFrequency: 3, // log10(f / 1 Hz)
  amplitude: 5, // relative units
  medium: "air",
});

export const frequency = s => Number((10 ** s.logFrequency).toPrecision(2));
export const speed = s => (MEDIA[s.medium] ?? MEDIA.air).speed;
/** λ = v/f */
export const wavelength = s => speed(s) / frequency(s);
/** I ∝ A²: I = I_UNIT·A² */
export const intensityOf = amplitude => I_UNIT * amplitude * amplitude;
export const intensity = s => intensityOf(s.amplitude);
/** L = 10·log₁₀(I/I₀) in dB */
export const levelOf = I => 10 * Math.log10(I / I0);
export const level = s => levelOf(intensity(s));
/** 0 = hạ âm (f < 16 Hz), 1 = âm nghe được (16 Hz ≤ f ≤ 20 000 Hz), 2 = siêu âm (f > 20 000 Hz) */
export const soundClass = f => (f < LOW ? 0 : f > HIGH ? 2 : 1);
export const CLASS_NAMES = ["Hạ âm", "Âm nghe được", "Siêu âm"];

/**
 * Particle displacement ξ and excess pressure p, both as fractions of their amplitudes, at
 * position x (in wavelengths) and phase φ = ωt: ξ = sin(φ − 2πx), p = −∂ξ/∂x ∝ cos(φ − 2πx).
 * Pressure is highest where neighbouring particles crowd together.
 */
export const displacement = (x, phase) => Math.sin(phase - 2 * Math.PI * x);
export const pressure = (x, phase) => Math.cos(phase - 2 * Math.PI * x);
