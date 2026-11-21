// Ohm's law for one resistor across an ideal source. Volts, ohms, amperes, watts.

export const initialState = () => ({
  voltage: 6, // V
  resistance: 10, // Ω
});

/** I = U / R */
export const current = s => s.voltage / s.resistance;

/** P = U·I */
export const power = s => s.voltage * current(s);

// Animation only: how many dot spacings pass a point of the wire per coulomb.
export const FLOW = 2;

/** Advance the charge animation; its speed is proportional to the current. `_phase` is transient. */
export function step(s, dt) {
  s._phase = ((s._phase || 0) + current(s) * dt * FLOW) % 1;
  return s;
}
