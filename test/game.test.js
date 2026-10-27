import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createGame, createDemoGame, DEMO } from '../src/game.js';
import { LEVELS, WORLD } from '../src/levels.js';
import { STEP_MS, MAX_DRAG, launchVelocity, trajectory } from '../src/launch.js';
import { starsFor } from '../src/rules.js';
import { createRng } from '../src/rng.js';

const Matter = createRequire(import.meta.url)('../vendor/matter.min.js');

/** Pull vector for a launch angle (degrees above horizontal) and pull length. */
const shot = (angleDeg, length) => {
  const a = (angleDeg * Math.PI) / 180;
  return { x: -length * Math.cos(a), y: length * Math.sin(a) };
};

/** Runs fixed steps and collects the emitted events. */
function run(game, steps) {
  const events = [];
  for (let i = 0; i < steps; i += 1) events.push(...game.update(STEP_MS));
  return events;
}

/** Runs until the next stone may be fired or the level is over. */
function runShot(game, maxSteps = 900) {
  const events = [];
  for (let i = 0; i < maxSteps; i += 1) {
    events.push(...game.update(STEP_MS));
    if (game.canLaunch() || game.getState().status !== 'playing') break;
  }
  return events;
}

/** Fires shots one at a time while the level is running, then lets the world settle. */
function playShots(game, shots) {
  const events = [];
  for (const drag of shots) {
    if (game.getState().status !== 'playing') break;
    assert.equal(game.launch(drag), true, 'stone launched');
    events.push(...runShot(game));
  }
  for (let i = 0; i < 1200 && game.getState().status === 'playing'; i += 1) events.push(...game.update(STEP_MS));
  return events;
}

const bodyById = (game, id) => Matter.Composite.allBodies(game.engine.world).find((b) => b.id === id);

/**
 * Winning shot sequences (angle, pull) found by searching the aim grid. Each one still wins when
 * every shot is nudged by a fraction of a degree or pixel, so the test does not hinge on float noise.
 */
const SOLUTIONS = [
  [shot(12.5, 110)],
  [shot(12.5, 110)],
  [shot(17.5, 105), shot(10, 110), shot(35, 85)],
  [shot(32.5, 100), shot(40, 90)],
  [shot(22.5, 105), shot(40, 80), shot(67.5, 95), shot(40, 80)],
];

test('every level loads with its blocks, targets and ammo', () => {
  LEVELS.forEach((level, i) => {
    const s = createGame({ Matter, levelIndex: i }).getState();
    assert.equal(s.levelIndex, i);
    assert.equal(s.levelKey, level.key);
    assert.equal(s.levelCount, LEVELS.length);
    assert.equal(s.status, 'playing');
    assert.equal(s.blocks.length, level.blocks.length);
    assert.equal(s.targets.length, level.targets.length);
    assert.equal(s.targetsLeft, s.targetsTotal);
    assert.equal(s.ammo, level.ammo);
    assert.equal(s.ammoTotal, level.ammo);
    assert.equal(s.score, 0);
    assert.equal(s.canLaunch, true);
    assert.equal(s.projectile, null);
    assert.equal(s.aim, null);
    assert.ok(s.blocks.every((b) => b.damage === 0));
  });
});

test('unknown level index throws', () => {
  assert.throws(() => createGame({ Matter, levelIndex: LEVELS.length }), RangeError);
});

test('stable levels: with no shots, 5 simulated seconds pass and nothing falls', () => {
  LEVELS.forEach((level, i) => {
    const game = createGame({ Matter, levelIndex: i });
    const before = game.getState();
    const events = run(game, 300);
    const after = game.getState();
    const lost = events.filter((e) => e.type === 'defeat' || e.type === 'break');
    assert.deepEqual(lost, [], `level ${i + 1}: nothing breaks or is defeated`);
    assert.equal(after.status, 'playing');
    assert.equal(after.targetsLeft, before.targetsTotal);
    assert.equal(after.blocks.length, before.blocks.length);
    for (const piece of [...before.blocks, ...before.targets]) {
      const now = [...after.blocks, ...after.targets].find((p) => p.id === piece.id);
      const moved = Math.hypot(now.x - piece.x, now.y - piece.y);
      assert.ok(moved < 5, `level ${i + 1}: piece ${piece.id} moved ${moved.toFixed(2)} px`);
      assert.ok(Math.abs(now.angle - piece.angle) < 0.05, `level ${i + 1}: piece ${piece.id} tilted`);
    }
  });
});

test('DONE: every level is won by toppling or destroying all its targets', () => {
  LEVELS.forEach((level, i) => {
    const game = createGame({ Matter, levelIndex: i });
    const events = playShots(game, SOLUTIONS[i]);
    const s = game.getState();
    const defeats = events.filter((e) => e.type === 'defeat');
    assert.equal(s.status, 'won', `level ${i + 1} is won`);
    assert.equal(s.targetsLeft, 0);
    assert.equal(defeats.length, level.targets.length);
    assert.ok(defeats.every((e) => ['destroyed', 'fall', 'out'].includes(e.reason)));
    assert.ok(s.ammo >= 0 && s.ammo < level.ammo);
    assert.equal(s.stars, starsFor(s.ammo));
    assert.ok(s.score > 0);
    assert.equal(events.filter((e) => e.type === 'won').length, 1);
    assert.equal(game.canLaunch(), false, 'no shots after the win');
  });
});

test('a strong shot destroys and topples the lookout in one go (3 stars)', () => {
  const game = createGame({ Matter, levelIndex: 1 });
  const events = playShots(game, [shot(12.5, 110)]);
  const s = game.getState();
  assert.equal(s.status, 'won');
  assert.equal(s.ammo, LEVELS[1].ammo - 1);
  assert.equal(s.stars, 3);
  const reasons = events.filter((e) => e.type === 'defeat').map((e) => e.reason);
  assert.ok(reasons.includes('destroyed'), 'a goblin was destroyed by impact');
  assert.ok(reasons.includes('fall'), 'a goblin was toppled');
  assert.ok(events.some((e) => e.type === 'break'), 'blocks broke');
  assert.ok(events.some((e) => e.type === 'hit' && e.strength > 0));
  const won = events.find((e) => e.type === 'won');
  assert.equal(won.stars, 3);
  assert.ok(won.bonus > 0);
});

test('removing the supports topples a goblin; knocking the last one off the world wins', () => {
  const game = createGame({ Matter, levelIndex: 0 });
  const start = game.getState();
  const posts = start.blocks.filter((b) => b.h === 100);
  assert.equal(posts.length, 2);
  for (const post of posts) Matter.Body.setPosition(bodyById(game, post.id), { x: -1000, y: 0 });
  const events = run(game, 240);
  assert.equal(events.filter((e) => e.type === 'break').length, 2, 'posts left the world');
  const topGoblin = start.targets.reduce((a, b) => (a.y < b.y ? a : b));
  assert.ok(!game.getState().targets.some((t) => t.id === topGoblin.id), 'top goblin is gone');
  assert.ok(events.some((e) => e.type === 'defeat' && e.reason === 'fall'));

  const remaining = game.getState().targets;
  assert.equal(game.getState().status, 'playing');
  for (const t of remaining) Matter.Body.setPosition(bodyById(game, t.id), { x: WORLD.width + 500, y: 100 });
  const more = run(game, 2);
  assert.ok(more.some((e) => e.type === 'defeat' && e.reason === 'out'));
  assert.equal(game.getState().status, 'won');
  assert.equal(game.getState().stars, 3, 'no stones used');
});

test('running out of stones without a win loses once everything rests', () => {
  const game = createGame({ Matter, levelIndex: 0 });
  const weak = { x: -15, y: 0 };
  const events = [];
  for (let i = 0; i < LEVELS[0].ammo; i += 1) {
    assert.equal(game.launch(weak), true);
    events.push(...runShot(game));
  }
  assert.equal(game.getState().ammo, 0);
  events.push(...run(game, 600));
  const s = game.getState();
  assert.equal(s.status, 'lost');
  assert.equal(s.stars, 0);
  assert.equal(s.targetsLeft, s.targetsTotal);
  assert.equal(events.filter((e) => e.type === 'lost').length, 1);
  assert.equal(game.launch(shot(10, 100)), false);
});

test('one shot at a time; tiny pulls are cancelled without using a stone', () => {
  const game = createGame({ Matter, levelIndex: 0 });
  assert.equal(game.launch({ x: -5, y: 2 }), false);
  assert.equal(game.getState().ammo, LEVELS[0].ammo);
  assert.equal(game.launch(shot(30, 90)), true);
  assert.equal(game.canLaunch(), false);
  assert.equal(game.launch(shot(30, 90)), false);
  assert.equal(game.getState().ammo, LEVELS[0].ammo - 1);
  const events = game.update(STEP_MS);
  const launch = events.find((e) => e.type === 'launch');
  assert.ok(launch && launch.power > 0.8 && launch.power <= 1);
});

test('a stone that leaves the world is cleared so the next one can fly', () => {
  const game = createGame({ Matter, levelIndex: 0 });
  assert.equal(game.launch({ x: MAX_DRAG, y: 0 }), true); // pull right = fire left, out of the world
  runShot(game);
  const s = game.getState();
  assert.equal(s.projectile, null);
  assert.equal(s.canLaunch, true);
  assert.equal(s.ammo, LEVELS[0].ammo - 1);
});

test('the trajectory preview matches the real flight', () => {
  const game = createGame({ Matter, levelIndex: 0 });
  const drag = shot(80, 100);
  game.setAim(drag);
  const aim = game.getState().aim;
  assert.ok(aim.ready);
  assert.deepEqual(aim.velocity, launchVelocity(drag));
  assert.ok(aim.path.length > 5);
  const expected = trajectory(aim.start, aim.velocity, { steps: 40, every: 1 });
  game.launch(drag);
  assert.equal(game.getState().aim, null, 'aim clears on launch');
  for (const point of expected) {
    game.update(STEP_MS);
    const p = game.getState().projectile;
    assert.ok(Math.abs(p.x - point.x) < 1e-6 && Math.abs(p.y - point.y) < 1e-6, `at ${point.x},${point.y}`);
  }
});

test('aim is clamped and can be cleared', () => {
  const game = createGame({ Matter, levelIndex: 0 });
  game.setAim({ x: -1000, y: 0 });
  const aim = game.getState().aim;
  assert.equal(Math.round(Math.hypot(aim.drag.x, aim.drag.y)), MAX_DRAG);
  assert.deepEqual(aim.start, { x: WORLD.sling.x - MAX_DRAG, y: WORLD.sling.y });
  game.setAim(null);
  assert.equal(game.getState().aim, null);
});

test('update uses a fixed timestep and caps long frames', () => {
  const game = createGame({ Matter, levelIndex: 0 });
  game.update(STEP_MS / 2);
  assert.equal(game.getState().time, 0);
  game.update(STEP_MS / 2);
  assert.ok(Math.abs(game.getState().time - STEP_MS) < 1e-9);
  game.update(10_000);
  assert.ok(Math.abs(game.getState().time - 6 * STEP_MS) < 1e-9, 'at most 5 steps per call');
});

test('the injected rng decides goblin looks deterministically', () => {
  const a = createGame({ Matter, levelIndex: 4, rng: createRng(9) }).getState().targets;
  const b = createGame({ Matter, levelIndex: 4, rng: createRng(9) }).getState().targets;
  assert.deepEqual(a.map((t) => [t.variant, t.phase]), b.map((t) => [t.variant, t.phase]));
  assert.ok(a.every((t) => [0, 1, 2].includes(t.variant)));
});

test('demo: level 2 with a stone mid-flight and the trajectory preview', () => {
  const s = createDemoGame({ Matter }).getState();
  assert.equal(s.levelIndex, DEMO.levelIndex);
  assert.equal(s.status, 'playing');
  assert.equal(s.ammo, LEVELS[DEMO.levelIndex].ammo - 1);
  assert.ok(s.projectile, 'stone in the air');
  assert.ok(s.projectile.x > WORLD.sling.x && s.projectile.x < 900, 'between sling and castle');
  assert.ok(s.projectile.y < WORLD.groundY - 100, 'well above the ground');
  assert.ok(s.aim && s.aim.path.length > 10, 'preview visible');
  assert.equal(s.targetsLeft, s.targetsTotal);
  // Matter body ids keep counting up between games, so compare everything else
  const withoutIds = (state) => JSON.stringify(state, (key, value) => (key === 'id' ? undefined : value));
  assert.equal(withoutIds(createDemoGame({ Matter }).getState()), withoutIds(s), 'deterministic');
});
