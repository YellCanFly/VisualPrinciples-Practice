import test from 'node:test';
import assert from 'node:assert/strict';
import { dropsAt, sampledTime, sampleIndex, positionAtAge, samplingRelation } from '../src/experiments/water-strobe/model.js';

test('equal frequencies preserve all visible positions while drop identities advance', () => {
  const before = dropsAt(2, 24);
  const after = dropsAt(2 + 1 / 24, 24);
  assert.equal(before.length, after.length);
  before.forEach((drop, index) => {
    assert.ok(Math.abs(drop.y - after[index].y) < 1e-10);
    assert.equal(after[index].id, drop.id + 1);
  });
});

test('higher / lower strobe frequency reverses / slows the matched pattern, never the actual droplet', () => {
  for (const [flash, sign] of [[24.6, -1], [23.4, 1]]) {
    const age = .35;
    const relation = samplingRelation(24, flash);
    const patternShift = positionAtAge(age + relation.ageStep) - positionAtAge(age);
    assert.equal(Math.sign(patternShift), sign);
    assert.ok(positionAtAge(age + 1 / flash) > positionAtAge(age));
    const t = 2 + age;
    const first = dropsAt(t, 24).find(drop => drop.id === 48);
    const next = dropsAt(t + 1 / flash, 24).find(drop => drop.id === 49);
    assert.equal(Math.sign(next.y - first.y), sign);
  }
});

test('sampling holds between flashes and steps to an exact next flash', () => {
  const flash = 24.6;
  assert.equal(sampledTime(.01, flash), 0);
  assert.equal(sampledTime(.03, flash), 0);
  const next = (sampleIndex(.03, flash) + 1) / flash;
  assert.equal(sampleIndex(next, flash), 1);
  assert.equal(sampledTime(next, flash), next);
});
