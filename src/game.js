/**
 * One playable level: Matter.js world, slingshot shots, damage, targets and the win/lose rules.
 * The Matter object is injected, so this module never touches the DOM and runs under node:test.
 */
import { WORLD, MATERIALS, TARGET, PROJECTILE, LEVELS } from './levels.js';
import { STEP_MS, MAX_DRAG, clampDrag, launchVelocity, isShot, trajectory } from './launch.js';
import { impactDamage, starsFor, ammoBonus, POINTS } from './rules.js';
import { createRng } from './rng.js';

/** Bodies slower than this (pixels per step) count as resting. */
const REST_SPEED = 0.2;
/** Bodies spinning slower than this (radians per step) count as resting. */
const REST_SPIN = 0.01;
/** Consecutive resting steps that make a stone or the whole world "settled". */
const REST_STEPS = 30;
/** A stone is cleared at the latest this long after its launch. */
const PROJECTILE_LIFE_MS = 8000;
/** With no stones left, the level is lost at the latest this long after the last stone cleared. */
const SETTLE_TIMEOUT_MS = 6000;
/** Physics steps allowed per update call, so one long frame cannot stall the page. */
const MAX_STEPS_PER_UPDATE = 5;
/** Bodies further than this outside the world are gone. */
const OUT_MARGIN = 200;
/** Trajectory preview sampling. */
const PREVIEW = Object.freeze({ steps: 72, every: 3 });

/** The ?demo state: level 2 with a stone in flight and the aim preview shown. */
export const DEMO = Object.freeze({ levelIndex: 1, drag: Object.freeze({ x: -90, y: 42 }), flightMs: 500 });

/**
 * @typedef {'playing'|'won'|'lost'} Status
 * @typedef {{type: 'launch', x: number, y: number, power: number}
 *   | {type: 'hit', x: number, y: number, strength: number}
 *   | {type: 'break', material: string, x: number, y: number, w: number, h: number, angle: number}
 *   | {type: 'defeat', reason: 'destroyed'|'fall'|'out', x: number, y: number, variant: number}
 *   | {type: 'won', stars: number, bonus: number}
 *   | {type: 'lost'}} GameEvent
 * @typedef {{drag: {x:number,y:number}, start: {x:number,y:number}, velocity: {x:number,y:number},
 *   path: {x:number,y:number}[], ready: boolean}} AimState
 * @typedef {{levelIndex: number, levelKey: string, levelCount: number, status: Status,
 *   ammo: number, ammoTotal: number, score: number, stars: number, time: number,
 *   targetsLeft: number, targetsTotal: number, canLaunch: boolean, world: typeof WORLD,
 *   aim: AimState|null,
 *   blocks: {id: number, material: string, x: number, y: number, w: number, h: number, angle: number, damage: number}[],
 *   targets: {id: number, x: number, y: number, r: number, angle: number, damage: number, variant: number, phase: number}[],
 *   projectile: {x: number, y: number, r: number, angle: number}|null}} GameState
 * @typedef {{engine: object, update: (dtMs: number) => GameEvent[], launch: (drag: {x:number,y:number}) => boolean,
 *   setAim: (drag: {x:number,y:number}|null) => void, canLaunch: () => boolean, getState: () => GameState}} Game
 */

/**
 * Creates a level ready to play.
 * @param {{Matter: object, levelIndex?: number, rng?: () => number}} options
 *   Matter: the Matter.js namespace; levelIndex: zero-based level; rng: seeded random source for cosmetics.
 * @returns {Game}
 */
export function createGame({ Matter, levelIndex = 0, rng = createRng(levelIndex + 1) }) {
  const level = LEVELS[levelIndex];
  if (!level) throw new RangeError(`Unknown level index ${levelIndex}`);
  const { Engine, Bodies, Body, Composite, Events } = Matter;
  const engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
  const entities = new Map();
  /** @type {GameEvent[]} */
  const queue = [];
  const s = {
    status: /** @type {Status} */ ('playing'),
    ammo: level.ammo, score: 0, stars: 0, time: 0, accumulator: 0,
    aim: null, projectile: null, restSteps: 0, idleMs: 0,
  };

  const add = (entity) => {
    entities.set(entity.body.id, entity);
    Composite.add(engine.world, entity.body);
    return entity;
  };
  const remove = (entity) => {
    entities.delete(entity.body.id);
    Composite.remove(engine.world, entity.body);
  };
  const ofKind = (kind) => [...entities.values()].filter((e) => e.kind === kind);

  buildLevel();
  Events.on(engine, 'collisionStart', (event) => event.pairs.forEach(handleImpact));

  function buildLevel() {
    const { width, groundY } = WORLD;
    add({ kind: 'ground', body: Bodies.rectangle(width / 2, groundY + 50, width, 100, { isStatic: true, friction: 0.9 }) });
    level.blocks.forEach(addBlock);
    level.targets.forEach(addTarget);
  }

  function addBlock({ material, x, bottom, w, h }) {
    const m = MATERIALS[material];
    const body = Bodies.rectangle(x, WORLD.groundY - bottom - h / 2, w, h, {
      density: m.density, friction: m.friction, frictionStatic: 1, restitution: m.restitution,
    });
    const hp = (m.strength * w * h) / 1000;
    add({ kind: 'block', body, material, w, h, hp, maxHp: hp });
  }

  function addTarget({ x, bottom }) {
    const r = TARGET.radius;
    const y = WORLD.groundY - bottom - r * Math.cos(Math.PI / TARGET.sides);
    const body = Bodies.polygon(x, y, TARGET.sides, r, {
      density: TARGET.density, friction: TARGET.friction, frictionStatic: 1, restitution: TARGET.restitution,
    });
    const variant = Math.floor(rng() * 3);
    add({ kind: 'target', body, r, hp: TARGET.hp, maxHp: TARGET.hp, startY: y, variant, phase: rng() * Math.PI * 2 });
  }

  function handleImpact(pair) {
    const a = pair.bodyA.parent;
    const b = pair.bodyB.parent;
    const n = pair.collision.normal;
    const speed = (a.velocity.x - b.velocity.x) * n.x + (a.velocity.y - b.velocity.y) * n.y;
    const damage = impactDamage(speed, a.mass, b.mass);
    if (damage <= 0) return;
    hurt(entities.get(a.id), damage);
    hurt(entities.get(b.id), damage);
    const at = pair.collision.supports[0] || a.position;
    queue.push({ type: 'hit', x: at.x, y: at.y, strength: Math.min(1, damage / 100) });
  }

  function hurt(entity, damage) {
    if (entity && entity.maxHp) entity.hp -= damage;
  }

  function isOut(body) {
    const { x, y } = body.position;
    return x < -OUT_MARGIN || x > WORLD.width + OUT_MARGIN || y > WORLD.height + OUT_MARGIN;
  }

  function isResting(body) {
    return body.isStatic || (body.speed < REST_SPEED && body.angularSpeed < REST_SPIN);
  }

  function sweepBlock(block) {
    if (block.hp > 0 && !isOut(block.body)) return;
    const { position, angle } = block.body;
    remove(block);
    s.score += MATERIALS[block.material].points;
    queue.push({ type: 'break', material: block.material, x: position.x, y: position.y, w: block.w, h: block.h, angle });
  }

  function defeatReason(target) {
    if (target.hp <= 0) return 'destroyed';
    if (target.body.position.y - target.startY > TARGET.fallLimit) return 'fall';
    return isOut(target.body) ? 'out' : null;
  }

  function sweepTarget(target) {
    const reason = defeatReason(target);
    if (!reason) return;
    const { x, y } = target.body.position;
    remove(target);
    s.score += POINTS.target;
    queue.push({ type: 'defeat', reason, x, y, variant: target.variant });
  }

  function sweepProjectile() {
    const p = s.projectile;
    if (!p) return;
    p.restSteps = isResting(p.body) ? p.restSteps + 1 : 0;
    if (isOut(p.body) || p.restSteps >= REST_STEPS || s.time - p.launchedAt >= PROJECTILE_LIFE_MS) {
      remove(p);
      s.projectile = null;
    }
  }

  function win() {
    const bonus = ammoBonus(s.ammo);
    s.status = 'won';
    s.stars = starsFor(s.ammo);
    s.score += bonus;
    queue.push({ type: 'won', stars: s.stars, bonus });
  }

  function checkOutcome() {
    if (s.status !== 'playing') return;
    if (ofKind('target').length === 0) {
      win();
      return;
    }
    if (s.ammo > 0 || s.projectile) return;
    const atRest = Composite.allBodies(engine.world).every(isResting);
    s.restSteps = atRest ? s.restSteps + 1 : 0;
    s.idleMs += STEP_MS;
    if (s.restSteps >= REST_STEPS || s.idleMs >= SETTLE_TIMEOUT_MS) {
      s.status = 'lost';
      queue.push({ type: 'lost' });
    }
  }

  function step() {
    Engine.update(engine, STEP_MS);
    s.time += STEP_MS;
    ofKind('block').forEach(sweepBlock);
    ofKind('target').forEach(sweepTarget);
    sweepProjectile();
    checkOutcome();
  }

  /**
   * Advances the simulation with a fixed timestep.
   * @param {number} dtMs Elapsed real time in milliseconds.
   * @returns {GameEvent[]} Events since the previous call (for effects and sounds).
   */
  function update(dtMs) {
    s.accumulator = Math.min(s.accumulator + Math.max(0, dtMs), STEP_MS * MAX_STEPS_PER_UPDATE);
    while (s.accumulator >= STEP_MS - 1e-9) {
      step();
      s.accumulator = Math.max(0, s.accumulator - STEP_MS);
    }
    return queue.splice(0);
  }

  /** @returns {boolean} True when a stone can be fired now (one shot at a time). */
  function canLaunch() {
    return s.status === 'playing' && s.ammo > 0 && !s.projectile;
  }

  /**
   * Fires a stone. The pull is clamped; pulls shorter than MIN_DRAG are ignored.
   * @param {{x:number, y:number}} drag Pull vector from the sling anchor to the pointer.
   * @returns {boolean} True when a stone was launched.
   */
  function launch(drag) {
    if (!canLaunch() || !isShot(drag)) return false;
    const pull = clampDrag(drag);
    const start = { x: WORLD.sling.x + pull.x, y: WORLD.sling.y + pull.y };
    const body = Bodies.circle(start.x, start.y, PROJECTILE.radius, {
      density: PROJECTILE.density, friction: PROJECTILE.friction, restitution: PROJECTILE.restitution, frictionAir: 0,
    });
    Body.setVelocity(body, launchVelocity(pull));
    s.projectile = add({ kind: 'projectile', body, restSteps: 0, launchedAt: s.time });
    s.ammo -= 1;
    s.aim = null;
    queue.push({ type: 'launch', x: start.x, y: start.y, power: Math.hypot(pull.x, pull.y) / MAX_DRAG });
    return true;
  }

  /**
   * Sets or clears the aim shown by the trajectory preview.
   * @param {{x:number, y:number}|null} drag Current pull, or null when not aiming.
   */
  function setAim(drag) {
    s.aim = drag ? clampDrag(drag) : null;
  }

  function aimState() {
    if (!s.aim) return null;
    const start = { x: WORLD.sling.x + s.aim.x, y: WORLD.sling.y + s.aim.y };
    const velocity = launchVelocity(s.aim);
    const path = trajectory(start, velocity, { ...PREVIEW, floorY: WORLD.groundY });
    return { drag: { ...s.aim }, start, velocity, path, ready: isShot(s.aim) };
  }

  const damageOf = (e) => Math.max(0, Math.min(1, 1 - e.hp / e.maxHp));

  /** @returns {GameState} A plain snapshot for rendering. */
  function getState() {
    const targets = ofKind('target');
    const p = s.projectile;
    return {
      levelIndex, levelKey: level.key, levelCount: LEVELS.length,
      status: s.status, ammo: s.ammo, ammoTotal: level.ammo, score: s.score, stars: s.stars, time: s.time,
      targetsLeft: targets.length, targetsTotal: level.targets.length,
      canLaunch: canLaunch(), world: WORLD, aim: aimState(),
      blocks: ofKind('block').map((e) => ({
        id: e.body.id, material: e.material, x: e.body.position.x, y: e.body.position.y,
        w: e.w, h: e.h, angle: e.body.angle, damage: damageOf(e),
      })),
      targets: targets.map((e) => ({
        id: e.body.id, x: e.body.position.x, y: e.body.position.y, r: e.r,
        angle: e.body.angle, damage: damageOf(e), variant: e.variant, phase: e.phase,
      })),
      projectile: p ? { x: p.body.position.x, y: p.body.position.y, r: PROJECTILE.radius, angle: p.body.angle } : null,
    };
  }

  return { engine, update, launch, setAim, canLaunch, getState };
}

/**
 * Builds the deterministic ?demo state used for the README screenshot:
 * level 2, a stone mid-flight and the trajectory preview visible.
 * @param {{Matter: object}} options
 * @returns {Game}
 */
export function createDemoGame({ Matter }) {
  const game = createGame({ Matter, levelIndex: DEMO.levelIndex });
  game.launch(DEMO.drag);
  const steps = Math.round(DEMO.flightMs / STEP_MS);
  for (let i = 0; i < steps; i += 1) game.update(STEP_MS);
  game.setAim(DEMO.drag);
  return game;
}
