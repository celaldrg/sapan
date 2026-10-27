import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEP_MS, GRAVITY_PER_STEP, MAX_DRAG, MIN_DRAG, POWER, clampDrag, launchVelocity, isShot, trajectory,
} from '../src/launch.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('gravity per step matches Matter.js defaults (scale 0.001, 60 Hz)', () => {
  close(STEP_MS, 1000 / 60);
  close(GRAVITY_PER_STEP, 0.001 * (1000 / 60) ** 2);
});

test('short drags are not clamped', () => {
  assert.deepEqual(clampDrag({ x: -30, y: 40 }), { x: -30, y: 40 });
});

test('long drags are clamped to MAX_DRAG and keep their direction', () => {
  const d = clampDrag({ x: -300, y: 400 });
  close(Math.hypot(d.x, d.y), MAX_DRAG);
  close(d.x / d.y, -300 / 400);
});

test('launch velocity points opposite to the drag and scales with its length', () => {
  const v = launchVelocity({ x: -50, y: 20 });
  close(v.x, 50 * POWER);
  close(v.y, -20 * POWER);
  const v2 = launchVelocity({ x: -100, y: 40 });
  close(v2.x, 2 * v.x);
  close(v2.y, 2 * v.y);
});

test('launch speed is capped by the clamp', () => {
  const flat = launchVelocity({ x: -5000, y: 0 });
  close(Math.hypot(flat.x, flat.y), MAX_DRAG * POWER);
  const steep = launchVelocity({ x: -3000, y: 3000 });
  close(Math.hypot(steep.x, steep.y), MAX_DRAG * POWER);
});

test('pulls shorter than MIN_DRAG do not count as a shot', () => {
  assert.equal(isShot({ x: -(MIN_DRAG - 1), y: 0 }), false);
  assert.equal(isShot({ x: -MIN_DRAG, y: 0 }), true);
});

test('trajectory samples every N steps and follows the integrated parabola', () => {
  const path = trajectory({ x: 0, y: 0 }, { x: 10, y: -10 }, { steps: 30, every: 3 });
  assert.equal(path.length, 10);
  close(path[0].x, 30);
  assert.ok(Math.min(...path.map((p) => p.y)) < 0, 'the shot rises first');
  // y after n steps: n * vy + g * n(n+1)/2 (velocity is updated before position)
  close(path.at(-1).y, -10 * 30 + (GRAVITY_PER_STEP * 30 * 31) / 2, 1e-6);
});

test('trajectory stops below the floor', () => {
  const path = trajectory({ x: 0, y: 0 }, { x: 5, y: 0 }, { steps: 500, every: 1, floorY: 100 });
  assert.ok(path.length > 0 && path.length < 500);
  assert.ok(path.every((p) => p.y <= 100));
});
