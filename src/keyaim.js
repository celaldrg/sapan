/**
 * Keyboard aiming: an angle and a power level that the arrow keys nudge,
 * turned into the same pull vector a pointer drag produces. Pure functions.
 */
import { MAX_DRAG } from './launch.js';

/** Limits and step sizes for keyboard aiming. */
export const KEY_AIM = Object.freeze({
  angle: 30,
  power: 0.85,
  angleStep: 1,
  powerStep: 0.02,
  minAngle: -20,
  maxAngle: 85,
  minPower: 0.15,
});

/**
 * @typedef {{angle: number, power: number}} KeyAim
 * angle: degrees above the horizontal; power: 0..1 share of the longest pull.
 */

/** @returns {KeyAim} The starting keyboard aim. */
export function createKeyAim() {
  return { angle: KEY_AIM.angle, power: KEY_AIM.power };
}

/**
 * Moves the aim by a number of steps and keeps it inside the limits.
 * @param {KeyAim} aim
 * @param {{angle?: number, power?: number}} steps Signed step counts (e.g. {angle: 1}).
 * @returns {KeyAim} A new aim object.
 */
export function nudgeKeyAim(aim, { angle = 0, power = 0 }) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return {
    angle: clamp(aim.angle + angle * KEY_AIM.angleStep, KEY_AIM.minAngle, KEY_AIM.maxAngle),
    power: clamp(aim.power + power * KEY_AIM.powerStep, KEY_AIM.minPower, 1),
  };
}

/**
 * The slingshot pull for a keyboard aim: pulled back and down, opposite to the flight direction.
 * @param {KeyAim} aim
 * @returns {{x:number, y:number}} Pull vector in world pixels.
 */
export function keyAimToDrag(aim) {
  const a = (aim.angle * Math.PI) / 180;
  const length = aim.power * MAX_DRAG;
  return { x: -length * Math.cos(a), y: length * Math.sin(a) };
}
