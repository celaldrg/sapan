/**
 * Slingshot maths: drag clamping, launch velocity and the trajectory preview.
 * Units follow Matter.js: pixels, and velocities in pixels per fixed step.
 */

/** Fixed physics step in milliseconds (60 Hz). */
export const STEP_MS = 1000 / 60;

/** Downward acceleration per step squared (Matter.js gravity y=1, scale 0.001). */
export const GRAVITY_PER_STEP = 0.001 * STEP_MS * STEP_MS;

/** Longest allowed pull, in world pixels. */
export const MAX_DRAG = 110;

/** Shorter pulls are treated as a cancelled shot. */
export const MIN_DRAG = 12;

/** Launch speed per pixel of pull (max speed = MAX_DRAG * POWER). */
export const POWER = 0.2;

/**
 * Limits a drag vector to MAX_DRAG while keeping its direction.
 * @param {{x:number, y:number}} drag Pull vector from the sling anchor to the pointer.
 * @returns {{x:number, y:number}} The clamped vector.
 */
export function clampDrag(drag) {
  const length = Math.hypot(drag.x, drag.y);
  if (length <= MAX_DRAG) return { x: drag.x, y: drag.y };
  const k = MAX_DRAG / length;
  return { x: drag.x * k, y: drag.y * k };
}

/**
 * Converts a pull into a launch velocity: opposite to the pull, proportional to its clamped length.
 * @param {{x:number, y:number}} drag Pull vector from the sling anchor.
 * @returns {{x:number, y:number}} Velocity in pixels per step.
 */
export function launchVelocity(drag) {
  const d = clampDrag(drag);
  return { x: -d.x * POWER, y: -d.y * POWER };
}

/**
 * Whether a pull is long enough to fire.
 * @param {{x:number, y:number}} drag Pull vector.
 * @returns {boolean}
 */
export function isShot(drag) {
  return Math.hypot(drag.x, drag.y) >= MIN_DRAG;
}

/**
 * Predicts the flight path with the same integration Matter.js uses
 * for a body without air friction (velocity += gravity, then position += velocity).
 * @param {{x:number, y:number}} start Launch position.
 * @param {{x:number, y:number}} velocity Launch velocity in pixels per step.
 * @param {{steps?:number, every?:number, floorY?:number}} [options]
 *   steps: how many steps to simulate; every: keep one point per N steps; floorY: stop below this y.
 * @returns {{x:number, y:number}[]} Sampled points (excluding the start).
 */
export function trajectory(start, velocity, { steps = 60, every = 3, floorY = Infinity } = {}) {
  const points = [];
  let { x, y } = start;
  let vx = velocity.x;
  let vy = velocity.y;
  for (let i = 1; i <= steps; i += 1) {
    vy += GRAVITY_PER_STEP;
    x += vx;
    y += vy;
    if (y > floorY) break;
    if (i % every === 0) points.push({ x, y });
  }
  return points;
}
