// Renewable energy: a solar panel and a wind turbine. SI units; energy per day in kWh.
//
// Solar panel:  P = η · G · A · cos θ     G = 1000 W/m² (full sunlight), θ = angle between the rays and the panel's normal.
// Wind turbine: P = ½ · ρ · A · v³ · Cp  A = π R² (swept area), ρ = 1,225 kg/m³, Cp ≤ 16/27 (Betz limit).
// Energy per day: E = P · t (t = hours of full sunlight, or hours with that wind).

export const G = 1000; // W/m²
export const RHO = 1.225; // kg/m³, air at 15 °C
export const BETZ = 16 / 27; // ≈ 0,593

export const initialState = () => ({
  area: 10, // m², panel area
  efficiency: 18, // %, panel efficiency
  sunAngle: 30, // °, angle of incidence (0 = rays perpendicular to the panel)
  sunHours: 4, // h/day of full sunlight
  blade: 1.5, // m, blade length (rotor radius)
  windSpeed: 6, // m/s
  cp: 0.35, // power coefficient
  windHours: 10, // h/day with this wind
  need: 10, // kWh/day the household uses
  goalMet: false, // daily need covered at the last adjustment (goal already reported)
});

const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

export function solarPower(area, efficiencyPct, angleDeg) {
  const cos = Math.cos((num(angleDeg, 0, 90) * Math.PI) / 180);
  return (num(efficiencyPct, 0, 100) / 100) * G * num(area, 0, Infinity) * Math.max(0, cos);
}

export const sweptArea = radius => Math.PI * num(radius, 0, Infinity) ** 2;

/** Cp above the Betz limit is impossible: it is capped at 16/27. */
export const windPower = (radius, speed, cp) => 0.5 * RHO * sweptArea(radius) * num(speed, 0, Infinity) ** 3 * num(cp, 0, BETZ);

/** kWh from W and hours. */
export const dailyEnergy = (watts, hours) => (watts * num(hours, 0, 24)) / 1000;

export function outputs(s) {
  const solarW = solarPower(s.area, s.efficiency, s.sunAngle);
  const windW = windPower(s.blade, s.windSpeed, s.cp);
  const solarKWh = dailyEnergy(solarW, s.sunHours);
  const windKWh = dailyEnergy(windW, s.windHours);
  return { solarW, windW, solarKWh, windKWh, total: solarKWh + windKWh };
}
