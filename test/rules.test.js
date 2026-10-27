import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_IMPACT, POINTS, impactDamage, reducedMass, starsFor, ammoBonus } from '../src/rules.js';

test('soft contacts deal no damage', () => {
  assert.equal(impactDamage(MIN_IMPACT, 3, 2), 0);
  assert.equal(impactDamage(0.5, 3, 2), 0);
});

test('damage grows with impact speed and ignores the sign of the speed', () => {
  const slow = impactDamage(5, 3, 2);
  const fast = impactDamage(10, 3, 2);
  assert.ok(fast > slow && slow > 0);
  assert.equal(impactDamage(-10, 3, 2), fast);
});

test('a static partner uses the moving body mass', () => {
  assert.equal(reducedMass(2, Infinity), 2);
  assert.equal(reducedMass(Infinity, 4), 4);
  assert.equal(impactDamage(MIN_IMPACT + 2, 2, Infinity), 0.5 * 2 * 4);
});

test('reduced mass is symmetric', () => {
  assert.equal(reducedMass(2, 6), reducedMass(6, 2));
  assert.equal(reducedMass(2, 6), 1.5);
});

test('stars: one plus one per spare stone, between 1 and 3', () => {
  assert.equal(starsFor(0), 1);
  assert.equal(starsFor(1), 2);
  assert.equal(starsFor(2), 3);
  assert.equal(starsFor(4), 3);
});

test('ammo bonus pays for unused stones', () => {
  assert.equal(ammoBonus(0), 0);
  assert.equal(ammoBonus(2), 2 * POINTS.ammoLeft);
});
