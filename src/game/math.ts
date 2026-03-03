/** Restrict a number to the inclusive `[min, max]` range. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Linear interpolation between two numbers. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Uniform random value between `min` and `max`. */
export const randomRange = (min: number, max: number): number => min + Math.random() * (max - min);

/** Squared distance avoids `Math.sqrt` for faster circle hit checks. */
export const distanceSquared = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
