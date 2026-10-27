import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY_AIM, createKeyAim, nudgeKeyAim, keyAimToDrag } from '../src/keyaim.js';
import { MAX_DRAG, launchVelocity, isShot } from '../src/launch.js';

test('arrow nudges change angle and power within limits', () => {
  let aim = createKeyAim();
  aim = nudgeKeyAim(aim, { angle: 2, power: -1 });
  assert.equal(aim.angle, KEY_AIM.angle + 2 * KEY_AIM.angleStep);
  assert.ok(Math.abs(aim.power - (KEY_AIM.power - KEY_AIM.powerStep)) < 1e-12);
  assert.equal(nudgeKeyAim(aim, { angle: 1000 }).angle, KEY_AIM.maxAngle);
  assert.equal(nudgeKeyAim(aim, { angle: -1000 }).angle, KEY_AIM.minAngle);
  assert.equal(nudgeKeyAim(aim, { power: 1000 }).power, 1);
  assert.equal(nudgeKeyAim(aim, { power: -1000 }).power, KEY_AIM.minPower);
});

test('the keyboard aim becomes a pull that fires up and to the right', () => {
  const drag = keyAimToDrag({ angle: 45, power: 1 });
  assert.ok(Math.abs(Math.hypot(drag.x, drag.y) - MAX_DRAG) < 1e-9);
  const v = launchVelocity(drag);
  assert.ok(v.x > 0 && v.y < 0);
  assert.ok(Math.abs(v.x + v.y) < 1e-9, '45 degrees');
});

test('even the weakest keyboard aim is a real shot', () => {
  assert.ok(isShot(keyAimToDrag({ angle: 0, power: KEY_AIM.minPower })));
});
