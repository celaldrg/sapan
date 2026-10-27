/**
 * Camera maths: fit a level into the canvas and convert between screen and world pixels.
 * Pure functions, no DOM.
 */
import { WORLD, TARGET } from './levels.js';
import { MAX_DRAG } from './launch.js';

/** On-screen pull (CSS pixels) that always gives full power, so tiny phone views stay aimable. */
export const MIN_FULL_PULL_PX = 90;

/** Largest zoom, so huge screens do not blow up the pixels. */
export const MAX_SCALE = 2;

/** Share of the spare viewport height shown above the level; the rest is ground below it. */
export const SKY_SHARE = 0.75;

/** Room kept around the action, in world pixels. */
const MARGIN = Object.freeze({ left: 40, right: 100, top: 120, below: 50 });

/**
 * @typedef {{x0: number, y0: number, x1: number, y1: number}} Bounds
 * @typedef {{scale: number, x: number, y: number, width: number, height: number}} Camera
 *   x/y: world point shown at the top-left corner; width/height: viewport in CSS pixels.
 */

/**
 * World rectangle that must stay visible for a level: the slingshot with room to pull back,
 * every block and goblin, some sky above the tallest piece and a strip of ground.
 * @param {{blocks: {x:number, bottom:number, w:number, h:number}[], targets: {x:number, bottom:number}[]}} level
 * @param {typeof WORLD} [world]
 * @returns {Bounds}
 */
export function levelBounds(level, world = WORLD) {
  const r = TARGET.radius;
  const boxes = [
    ...level.blocks.map((b) => ({ left: b.x - b.w / 2, right: b.x + b.w / 2, top: world.groundY - b.bottom - b.h })),
    ...level.targets.map((t) => ({ left: t.x - r, right: t.x + r, top: world.groundY - t.bottom - 2 * r })),
  ];
  let x1 = world.sling.x + MAX_DRAG;
  let top = world.sling.y - 140;
  for (const b of boxes) {
    x1 = Math.max(x1, b.right);
    top = Math.min(top, b.top);
  }
  return {
    x0: world.sling.x - MAX_DRAG - MARGIN.left,
    y0: top - MARGIN.top,
    x1: x1 + MARGIN.right,
    y1: world.groundY + MARGIN.below,
  };
}

/**
 * Fits bounds into a viewport, centred horizontally. Spare height goes mostly above the level
 * (sky, where high shots fly) and the rest below it (ground), see SKY_SHARE.
 * @param {Bounds} bounds World rectangle to show.
 * @param {number} width Viewport width in CSS pixels.
 * @param {number} height Viewport height in CSS pixels.
 * @returns {Camera}
 */
export function fitCamera(bounds, width, height) {
  const bw = bounds.x1 - bounds.x0;
  const bh = bounds.y1 - bounds.y0;
  const scale = Math.max(1e-3, Math.min(width / bw, height / bh, MAX_SCALE));
  return {
    scale,
    x: bounds.x0 - (width / scale - bw) / 2,
    y: bounds.y0 - (height / scale - bh) * SKY_SHARE,
    width,
    height,
  };
}

/**
 * World point to screen (CSS pixel) point.
 * @param {Camera} cam
 * @param {{x:number, y:number}} p
 * @returns {{x:number, y:number}}
 */
export function toScreen(cam, p) {
  return { x: (p.x - cam.x) * cam.scale, y: (p.y - cam.y) * cam.scale };
}

/**
 * Screen (CSS pixel) point to world point.
 * @param {Camera} cam
 * @param {{x:number, y:number}} p
 * @returns {{x:number, y:number}}
 */
export function toWorld(cam, p) {
  return { x: p.x / cam.scale + cam.x, y: p.y / cam.scale + cam.y };
}

/**
 * Converts a pointer drag on screen into a slingshot pull in world pixels.
 * On large views the pull follows the finger one to one; on small views a
 * MIN_FULL_PULL_PX drag already reaches full power.
 * @param {Camera} cam
 * @param {number} dx Horizontal drag in CSS pixels.
 * @param {number} dy Vertical drag in CSS pixels.
 * @returns {{x:number, y:number}}
 */
export function pullFromScreen(cam, dx, dy) {
  const k = MAX_DRAG / Math.max(MAX_DRAG * cam.scale, MIN_FULL_PULL_PX);
  return { x: dx * k, y: dy * k };
}
