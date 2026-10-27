import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, MATERIALS, TARGET, LEVELS, LEVEL_COUNT } from '../src/levels.js';

const EPS = 1e-9;

/** Axis-aligned box of a block or target spec, in "height above ground" coordinates. */
function box(piece) {
  if ('w' in piece) {
    return { left: piece.x - piece.w / 2, right: piece.x + piece.w / 2, bottom: piece.bottom, top: piece.bottom + piece.h };
  }
  const r = TARGET.radius;
  return { left: piece.x - r, right: piece.x + r, bottom: piece.bottom, top: piece.bottom + 2 * r };
}

const overlaps = (a, b) =>
  a.left < b.right - EPS && b.left < a.right - EPS && a.bottom < b.top - EPS && b.bottom < a.top - EPS;

test('there are five levels with unique keys', () => {
  assert.equal(LEVEL_COUNT, 5);
  assert.equal(new Set(LEVELS.map((l) => l.key)).size, 5);
});

test('ammo is 3-5 and difficulty never decreases', () => {
  LEVELS.forEach((level, i) => {
    assert.ok(level.ammo >= 3 && level.ammo <= 5, `level ${i + 1} ammo`);
    assert.ok(level.targets.length >= 1, `level ${i + 1} has targets`);
    if (i === 0) return;
    const prev = LEVELS[i - 1];
    assert.ok(level.targets.length >= prev.targets.length, `level ${i + 1} targets`);
    assert.ok(level.blocks.length >= prev.blocks.length, `level ${i + 1} blocks`);
    assert.ok(level.ammo >= prev.ammo, `level ${i + 1} ammo order`);
  });
  assert.ok(LEVELS.at(-1).blocks.length > LEVELS[0].blocks.length);
});

test('every level mixes known materials and the last one uses all three', () => {
  for (const level of LEVELS) {
    for (const b of level.blocks) {
      assert.ok(b.material in MATERIALS, `unknown material ${b.material}`);
      assert.ok(b.w > 0 && b.h > 0);
    }
  }
  assert.deepEqual(new Set(LEVELS.at(-1).blocks.map((b) => b.material)), new Set(['wood', 'glass', 'stone']));
});

test('materials differ in density and strength', () => {
  const { wood, glass, stone } = MATERIALS;
  assert.ok(stone.density > wood.density && wood.density > glass.density);
  assert.ok(stone.strength > wood.strength && wood.strength > glass.strength);
});

test('pieces lie inside the world, right of the slingshot, and never overlap', () => {
  LEVELS.forEach((level, i) => {
    const pieces = [...level.blocks, ...level.targets].map(box);
    for (const p of pieces) {
      assert.ok(p.left > WORLD.sling.x + 200 && p.right < WORLD.width, `level ${i + 1} piece x`);
      assert.ok(p.bottom >= 0 && p.top < WORLD.groundY, `level ${i + 1} piece y`);
    }
    for (let a = 0; a < pieces.length; a += 1) {
      for (let b = a + 1; b < pieces.length; b += 1) {
        assert.ok(!overlaps(pieces[a], pieces[b]), `level ${i + 1}: pieces ${a} and ${b} overlap`);
      }
    }
  });
});

test('every piece stands on the ground or on blocks spanning its centre', () => {
  LEVELS.forEach((level, i) => {
    const blocks = level.blocks.map(box);
    for (const piece of [...level.blocks, ...level.targets]) {
      if (piece.bottom === 0) continue;
      const own = box(piece);
      const supports = blocks.filter(
        (b) => Math.abs(b.top - piece.bottom) < EPS && b.left < own.right && b.right > own.left,
      );
      assert.ok(supports.length > 0, `level ${i + 1}: piece at x=${piece.x} floats`);
      const span = { left: Math.min(...supports.map((b) => b.left)), right: Math.max(...supports.map((b) => b.right)) };
      assert.ok(piece.x >= span.left && piece.x <= span.right, `level ${i + 1}: piece at x=${piece.x} overhangs`);
    }
  });
});
