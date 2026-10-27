import test from 'node:test';
import assert from 'node:assert/strict';
import { createEffects, applyEvents, stepEffects, popupProgress } from '../src/effects.js';
import { createRng } from '../src/rng.js';

const events = [
  { type: 'break', material: 'glass', x: 100, y: 200, w: 20, h: 40, angle: 0 },
  { type: 'defeat', reason: 'fall', x: 300, y: 400, variant: 1 },
];

test('events spawn debris and score pop-ups that fade away', () => {
  const fx = createEffects();
  applyEvents(fx, events, createRng(1));
  assert.ok(fx.particles.length > 10);
  assert.equal(fx.popups.length, 2);
  assert.ok(fx.shake > 0);
  for (let i = 0; i < 200; i += 1) stepEffects(fx, 1 / 60, null);
  assert.equal(fx.particles.length, 0);
  assert.equal(fx.popups.length, 0);
  assert.equal(fx.shake, 0);
});

test('reduced motion: fewer particles and no shake', () => {
  const full = createEffects();
  const calm = createEffects();
  applyEvents(full, events, createRng(1));
  applyEvents(calm, events, createRng(1), { reduced: true });
  assert.ok(calm.particles.length < full.particles.length);
  assert.equal(calm.shake, 0);
});

test('the trail follows the stone and is cleared on launch', () => {
  const fx = createEffects();
  for (let i = 0; i < 30; i += 1) stepEffects(fx, 1 / 60, { x: i, y: 0 });
  assert.equal(fx.trail.length, 14);
  assert.deepEqual(fx.trail.at(-1), { x: 29, y: 0 });
  applyEvents(fx, [{ type: 'launch', x: 0, y: 0, power: 1 }], createRng(2));
  assert.equal(fx.trail.length, 0);
});

test('same seed, same effects', () => {
  const a = createEffects();
  const b = createEffects();
  applyEvents(a, events, createRng(5));
  applyEvents(b, events, createRng(5));
  assert.deepEqual(a, b);
  assert.equal(popupProgress(a.popups[0]), 0);
});
