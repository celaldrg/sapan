import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';

test('same seed gives the same sequence', () => {
  const seqA = Array.from({ length: 20 }, createRng(42));
  const seqB = Array.from({ length: 20 }, createRng(42));
  assert.deepEqual(seqA, seqB);
});

test('different seeds give different sequences', () => {
  const a = Array.from({ length: 5 }, createRng(1));
  const b = Array.from({ length: 5 }, createRng(2));
  assert.notDeepEqual(a, b);
});

test('values stay in [0, 1)', () => {
  const rng = createRng(7);
  for (let i = 0; i < 1000; i += 1) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});
