/**
 * Small seeded pseudo-random generator (mulberry32).
 * Deterministic for a given seed, so tests and the demo state are reproducible.
 * @param {number} [seed=1] Any integer seed.
 * @returns {() => number} A function returning floats in [0, 1).
 */
export function createRng(seed = 1) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
