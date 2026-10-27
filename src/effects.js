/**
 * Visual effects as plain data: debris particles, score pop-ups, the stone's trail and
 * screen shake. Driven by game events; no DOM, randomness from an injected RNG.
 */
import { MATERIALS, PROJECTILE } from './levels.js';
import { POINTS } from './rules.js';

/** Particle gravity in world pixels per second squared. */
const GRAVITY = 1400;
/** Points kept in the stone's trail. */
const TRAIL_LENGTH = 14;
/** How long a score pop-up stays, in seconds. */
const POPUP_LIFE = 1.1;

/** Debris colours per material, plus goblin slime per variant. */
const PALETTE = Object.freeze({
  wood: Object.freeze(['#b7793f', '#8a5428', '#d59a5b']),
  glass: Object.freeze(['#cffafe', '#a5f3fc', '#ffffff']),
  stone: Object.freeze(['#9ca3af', '#6b7280', '#d1d5db']),
  slime: Object.freeze([
    Object.freeze(['#84cc16', '#bef264', '#4d7c0f']),
    Object.freeze(['#2dd4bf', '#99f6e4', '#0f766e']),
    Object.freeze(['#eab308', '#fde047', '#a16207']),
  ]),
  dust: Object.freeze(['#d6c3a5', '#a8a29e']),
});

/**
 * @typedef {{kind: 'shard'|'blob'|'dust', x: number, y: number, vx: number, vy: number,
 *   size: number, color: string, life: number, maxLife: number, angle: number, spin: number}} Particle
 * @typedef {{x: number, y: number, value: number, life: number}} Popup
 * @typedef {{particles: Particle[], popups: Popup[], trail: {x:number, y:number}[], shake: number}} Effects
 */

/** @returns {Effects} An empty effects state. */
export function createEffects() {
  return { particles: [], popups: [], trail: [], shake: 0 };
}

/**
 * Spawns effects for game events.
 * @param {Effects} fx
 * @param {import('./game.js').GameEvent[]} events
 * @param {() => number} rng Seeded random source.
 * @param {{reduced?: boolean}} [options] reduced: fewer particles and no shake.
 */
export function applyEvents(fx, events, rng, { reduced = false } = {}) {
  const amount = (n) => (reduced ? Math.ceil(n / 3) : n);
  for (const e of events) {
    if (e.type === 'break') {
      burst(fx, rng, { x: e.x, y: e.y, count: amount(10), colors: PALETTE[e.material], kind: 'shard', speed: 260 });
      fx.popups.push({ x: e.x, y: e.y, value: MATERIALS[e.material].points, life: POPUP_LIFE });
      if (!reduced) fx.shake = Math.max(fx.shake, e.material === 'stone' ? 6 : 3);
    } else if (e.type === 'defeat') {
      burst(fx, rng, { x: e.x, y: e.y, count: amount(14), colors: PALETTE.slime[e.variant] || PALETTE.slime[0], kind: 'blob', speed: 320 });
      fx.popups.push({ x: e.x, y: e.y - 20, value: POINTS.target, life: POPUP_LIFE });
      if (!reduced) fx.shake = Math.max(fx.shake, 5);
    } else if (e.type === 'hit' && e.strength > 0.15) {
      burst(fx, rng, { x: e.x, y: e.y, count: amount(4), colors: PALETTE.dust, kind: 'dust', speed: 120 });
    } else if (e.type === 'launch') {
      fx.trail.length = 0;
      burst(fx, rng, { x: e.x, y: e.y + PROJECTILE.radius, count: amount(5), colors: PALETTE.dust, kind: 'dust', speed: 90 });
    }
  }
}

/**
 * Adds a spray of particles around a point.
 * @param {Effects} fx
 * @param {() => number} rng
 * @param {{x:number, y:number, count:number, colors: readonly string[], kind: Particle['kind'], speed:number}} spec
 */
function burst(fx, rng, { x, y, count, colors, kind, speed }) {
  for (let i = 0; i < count; i += 1) {
    const a = rng() * Math.PI * 2;
    const v = speed * (0.35 + rng() * 0.65);
    const maxLife = 0.6 + rng() * 0.6;
    fx.particles.push({
      kind, x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - speed * 0.4,
      size: kind === 'dust' ? 4 + rng() * 6 : 3 + rng() * 6,
      color: colors[Math.floor(rng() * colors.length)],
      life: maxLife, maxLife,
      angle: rng() * Math.PI, spin: (rng() - 0.5) * 12,
    });
  }
}

/**
 * Advances particles, pop-ups, shake and the stone's trail.
 * @param {Effects} fx
 * @param {number} dt Seconds since the previous frame.
 * @param {{x:number, y:number}|null} projectile Current stone position, if one is flying.
 */
export function stepEffects(fx, dt, projectile) {
  for (const p of fx.particles) {
    p.life -= dt;
    p.vy += (p.kind === 'dust' ? GRAVITY * 0.1 : GRAVITY) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.spin * dt;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const pop of fx.popups) pop.life -= dt;
  fx.popups = fx.popups.filter((pop) => pop.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 30);
  if (projectile) {
    fx.trail.push({ x: projectile.x, y: projectile.y });
    if (fx.trail.length > TRAIL_LENGTH) fx.trail.shift();
  } else if (fx.trail.length) {
    fx.trail.shift();
  }
}

/**
 * Share of a pop-up's life already used (0 = just spawned, 1 = gone).
 * @param {Popup} pop
 * @returns {number}
 */
export function popupProgress(pop) {
  return 1 - pop.life / POPUP_LIFE;
}
