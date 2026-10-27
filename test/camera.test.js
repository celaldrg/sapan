import test from 'node:test';
import assert from 'node:assert/strict';
import { levelBounds, fitCamera, toScreen, toWorld, pullFromScreen, MIN_FULL_PULL_PX, MAX_SCALE, SKY_SHARE } from '../src/camera.js';
import { LEVELS, WORLD } from '../src/levels.js';
import { MAX_DRAG } from '../src/launch.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('level bounds hold the slingshot, its pull room and every piece', () => {
  for (const level of LEVELS) {
    const b = levelBounds(level);
    assert.ok(b.x0 <= WORLD.sling.x - MAX_DRAG, 'room to pull back');
    assert.ok(b.y1 > WORLD.groundY, 'ground visible');
    for (const p of level.blocks) {
      assert.ok(p.x - p.w / 2 >= b.x0 && p.x + p.w / 2 <= b.x1);
      assert.ok(WORLD.groundY - p.bottom - p.h >= b.y0);
    }
  }
});

test('the camera fits the level in landscape and portrait, spare height mostly above it', () => {
  for (const level of LEVELS) {
    const b = levelBounds(level);
    for (const [w, h] of [[1184, 690], [359, 560], [800, 360]]) {
      const cam = fitCamera(b, w, h);
      const tl = toScreen(cam, { x: b.x0, y: b.y0 });
      const br = toScreen(cam, { x: b.x1, y: b.y1 });
      assert.ok(tl.x >= -1e-6 && tl.y >= -1e-6, `${w}x${h} top-left inside`);
      assert.ok(br.x <= w + 1e-6 && br.y <= h + 1e-6, `${w}x${h} bottom-right inside`);
      assert.ok(close(tl.x, w - br.x, 1e-6), 'centred horizontally');
      assert.ok(close(tl.y * (1 - SKY_SHARE), (h - br.y) * SKY_SHARE, 1e-6), 'sky above, ground below');
      assert.ok(cam.scale <= MAX_SCALE);
    }
  }
});

test('screen and world conversions are inverse', () => {
  const cam = fitCamera(levelBounds(LEVELS[2]), 375, 560);
  const p = { x: 1234.5, y: 321.25 };
  const back = toWorld(cam, toScreen(cam, p));
  assert.ok(close(back.x, p.x) && close(back.y, p.y));
});

test('pointer pulls follow the finger on big views and get a boost on tiny ones', () => {
  const big = { scale: 1.2, x: 0, y: 0, width: 1400, height: 800 };
  const pull = pullFromScreen(big, -60, 30);
  assert.ok(close(pull.x, -50) && close(pull.y, 25), 'one to one with world pixels');
  const tiny = { scale: 0.3, x: 0, y: 0, width: 375, height: 560 };
  const full = pullFromScreen(tiny, -MIN_FULL_PULL_PX, 0);
  assert.ok(close(full.x, -MAX_DRAG), 'a short phone drag reaches full power');
});
