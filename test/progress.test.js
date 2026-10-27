import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, sanitizeProgress, recordWin, isUnlocked, totalStars } from '../src/progress.js';

test('fresh progress unlocks only the first level', () => {
  const p = createProgress(5);
  assert.deepEqual(p, { unlocked: 1, stars: [0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0] });
  assert.equal(isUnlocked(p, 0), true);
  assert.equal(isUnlocked(p, 1), false);
  assert.equal(isUnlocked(p, -1), false);
});

test('winning a level unlocks the next one without mutating the input', () => {
  const p = createProgress(5);
  const next = recordWin(p, 0, { stars: 2, score: 4000 });
  assert.equal(p.unlocked, 1);
  assert.equal(next.unlocked, 2);
  assert.equal(next.stars[0], 2);
  assert.equal(next.best[0], 4000);
  assert.equal(isUnlocked(next, 1), true);
});

test('best stars and score are kept', () => {
  let p = recordWin(createProgress(3), 0, { stars: 3, score: 9000 });
  p = recordWin(p, 0, { stars: 1, score: 2000 });
  assert.equal(p.stars[0], 3);
  assert.equal(p.best[0], 9000);
  assert.equal(totalStars(p), 3);
});

test('replaying an early level never locks later levels; unlock stops at the last level', () => {
  let p = createProgress(3);
  p = recordWin(p, 0, { stars: 1, score: 1 });
  p = recordWin(p, 1, { stars: 1, score: 1 });
  p = recordWin(p, 2, { stars: 1, score: 1 });
  assert.equal(p.unlocked, 3);
  p = recordWin(p, 0, { stars: 3, score: 5 });
  assert.equal(p.unlocked, 3);
});

test('out-of-range level indices are ignored', () => {
  const p = createProgress(2);
  assert.equal(recordWin(p, 7, { stars: 3, score: 1 }), p);
});

test('sanitize repairs junk from storage', () => {
  assert.deepEqual(sanitizeProgress(null, 3), createProgress(3));
  assert.deepEqual(sanitizeProgress('nope', 3), createProgress(3));
  const fixed = sanitizeProgress({ unlocked: 99, stars: [5, -2, 'x'], best: [10.7, null] }, 3);
  assert.deepEqual(fixed, { unlocked: 3, stars: [3, 0, 0], best: [10, 0, 0] });
  assert.equal(sanitizeProgress({ unlocked: 0 }, 3).unlocked, 1);
});

test('sanitize keeps valid saved progress', () => {
  const saved = recordWin(createProgress(4), 0, { stars: 2, score: 3500 });
  assert.deepEqual(sanitizeProgress(JSON.parse(JSON.stringify(saved)), 4), saved);
});
