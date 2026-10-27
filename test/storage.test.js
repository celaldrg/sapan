import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJSON, saveJSON } from '../src/storage.js';

function memoryStore() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}

const brokenStore = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

test('round-trips JSON values', () => {
  const store = memoryStore();
  assert.equal(saveJSON('k', { a: 1, b: [2] }, store), true);
  assert.deepEqual(loadJSON('k', null, store), { a: 1, b: [2] });
});

test('missing keys and invalid JSON return the fallback', () => {
  const store = memoryStore();
  assert.equal(loadJSON('missing', 'fb', store), 'fb');
  store.setItem('bad', '{not json');
  assert.equal(loadJSON('bad', 'fb', store), 'fb');
});

test('throwing storage (private mode) never throws', () => {
  assert.equal(loadJSON('k', 'fb', brokenStore), 'fb');
  assert.equal(saveJSON('k', 1, brokenStore), false);
});

test('missing storage falls back quietly', () => {
  assert.equal(loadJSON('k', 'fb', null), 'fb');
  assert.equal(saveJSON('k', 1, null), false);
});
