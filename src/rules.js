/**
 * Pure game rules: impact damage, scoring and stars.
 */

/** Impacts slower than this (pixels per step) cause no damage. */
export const MIN_IMPACT = 2;

/** Points awarded per event. */
export const POINTS = Object.freeze({ target: 2000, ammoLeft: 1500 });

/**
 * Collision energy above the damage threshold: 0.5 * reducedMass * (speed - MIN_IMPACT)^2.
 * A static partner (infinite mass) makes the reduced mass equal the moving body's mass.
 * @param {number} speed Closing speed along the contact normal, pixels per step.
 * @param {number} massA Mass of the first body (Infinity when static).
 * @param {number} massB Mass of the second body (Infinity when static).
 * @returns {number} Damage points dealt to each body (0 below the threshold).
 */
export function impactDamage(speed, massA, massB) {
  const excess = Math.abs(speed) - MIN_IMPACT;
  if (excess <= 0) return 0;
  return 0.5 * reducedMass(massA, massB) * excess * excess;
}

/**
 * Reduced mass of two bodies; finite even when one of them is static.
 * @param {number} massA
 * @param {number} massB
 * @returns {number}
 */
export function reducedMass(massA, massB) {
  if (!Number.isFinite(massA)) return Number.isFinite(massB) ? massB : 0;
  if (!Number.isFinite(massB)) return massA;
  return (massA * massB) / (massA + massB);
}

/**
 * Star rating for a won level: one star plus one per unused stone, at most three.
 * @param {number} ammoLeft Stones not yet launched when the level was won.
 * @returns {1|2|3}
 */
export function starsFor(ammoLeft) {
  return /** @type {1|2|3} */ (Math.max(1, Math.min(3, 1 + Math.floor(ammoLeft))));
}

/**
 * Bonus points for unused stones when a level is won.
 * @param {number} ammoLeft
 * @returns {number}
 */
export function ammoBonus(ammoLeft) {
  return Math.max(0, ammoLeft) * POINTS.ammoLeft;
}
