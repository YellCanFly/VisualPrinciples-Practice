import test from 'node:test';
import assert from 'node:assert/strict';
import { cubicBezier, evaluateEasing, springProgress, timelineProgress, sequenceDuration } from '../src/experiments/motion-rhythm/model.js';

const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`);
const samples = (fn, count = 1000) => Array.from({ length: count + 1 }, (_, index) => fn(index / count));
const families = ['quad', 'cubic', 'quart', 'quint', 'sine', 'expo', 'circ', 'back', 'elastic', 'bounce'];

test('named families keep endpoints, mirror In/Out, and center InOut at half progress', () => {
  for (const family of families) {
    for (const direction of ['in', 'out', 'inout']) {
      assert.equal(evaluateEasing(family, 0, { direction }), 0);
      assert.equal(evaluateEasing(family, 1, { direction }), 1);
      assert.ok(samples(t => evaluateEasing(family, t, { direction })).every(Number.isFinite));
    }
    near(evaluateEasing(family, .5, { direction: 'inout' }), .5);
    for (const time of [.13, .37, .68, .91]) {
      near(evaluateEasing(family, time, { direction: 'in' }), 1 - evaluateEasing(family, 1 - time, { direction: 'out' }));
    }
  }
  assert.equal(evaluateEasing('linear', .37), .37);
  near(evaluateEasing('cubic', .5, { direction: 'in' }), .125);
  near(evaluateEasing('cubic', .5, { direction: 'out' }), .875);
});

test('increasing power holds back an In and advances an Out; ordinary curves stay monotonic', () => {
  let previousIn = 1;
  let previousOut = 0;
  for (const family of ['quad', 'cubic', 'quart', 'quint']) {
    const currentIn = evaluateEasing(family, .4, { direction: 'in' });
    const currentOut = evaluateEasing(family, .4, { direction: 'out' });
    assert.ok(currentIn < previousIn);
    assert.ok(currentOut > previousOut);
    previousIn = currentIn;
    previousOut = currentOut;
  }
  for (const family of families.slice(0, 7)) {
    for (const direction of ['in', 'out', 'inout']) {
      const values = samples(t => evaluateEasing(family, t, { direction }));
      assert.ok(values.every((value, index) => value >= 0 && value <= 1 && (!index || value >= values[index - 1])));
    }
  }
});

test('Back crosses the target once, Elastic oscillates, and Bounce stays inside the boundary', () => {
  const back = samples(t => evaluateEasing('back', t));
  const elastic = samples(t => evaluateEasing('elastic', t));
  const bounce = samples(t => evaluateEasing('bounce', t));
  assert.ok(Math.max(...back) > 1.09);
  assert.ok(Math.min(...samples(t => evaluateEasing('back', t, { direction: 'in' }))) < -.09);
  const crossings = values => {
    const signs = values.map(value => Math.sign(value - 1)).filter(sign => sign !== 0);
    return signs.slice(1).filter((sign, index) => sign !== signs[index]).length;
  };
  assert.equal(crossings(back), 1);
  assert.ok(crossings(elastic) >= 4);
  assert.ok(bounce.every(value => value >= 0 && value <= 1));
  for (const contact of [1 / 2.75, 2 / 2.75, 2.5 / 2.75, 1]) near(evaluateEasing('bounce', contact), 1);
  near(evaluateEasing('bounce', 1.5 / 2.75), .75);
});

test('Bézier solves horizontal time, handles flat tangents, and preserves vertical overshoot', () => {
  near(cubicBezier(.5), .802403387584857, 1e-10); // CSS ease, not y(.5)=.5375.
  for (const time of [0, .00001, .1, .5, .9, .99999, 1]) {
    near(cubicBezier(time, { x1: 0, y1: 0, x2: 0, y2: 0 }), time);
    near(cubicBezier(time, { x1: 1, y1: 1, x2: 1, y2: 1 }), time);
  }
  const overshoot = { x1: .3, y1: 1.5, x2: .7, y2: 1.5 };
  assert.ok(cubicBezier(.5, overshoot) > 1);
  assert.equal(cubicBezier(0, overshoot), 0);
  assert.equal(cubicBezier(1, overshoot), 1);
  near(cubicBezier(.4, { x1: -3, x2: 4 }), cubicBezier(.4, { x1: 0, x2: 1 }));
});

test('Steps holds between jumps and implements forward jump-start/jump-end boundaries', () => {
  for (const position of ['end', 'jump-end']) {
    const at = time => evaluateEasing('steps', time, { steps: 4, position });
    assert.equal(at(0), 0);
    assert.equal(at(.249999), 0);
    assert.equal(at(.25), .25);
    assert.equal(at(.499999), .25);
    assert.equal(at(1), 1);
  }
  for (const position of ['start', 'jump-start']) {
    const at = time => evaluateEasing('steps', time, { steps: 4, position });
    assert.equal(at(0), .25);
    assert.equal(at(.249999), .25);
    assert.equal(at(.25), .5);
    assert.equal(at(.75), 1);
    assert.equal(at(1), 1);
  }
});

test('Spring satisfies initial displacement, velocity and motion equation in all damping regimes', () => {
  for (const damping of [0, 8, 20, 35, 10000]) {
    for (const velocity of [-2, 0, 3]) {
      const parameters = { mass: 1, stiffness: 100, damping, velocity };
      const at = time => springProgress(time, parameters);
      assert.equal(at(0), 0);
      near((at(1e-7) - at(0)) / 1e-7, velocity, .002);
      const t = .27;
      const dt = 1e-4;
      const derivative = (at(t + dt) - at(t - dt)) / (2 * dt);
      const acceleration = (at(t + dt) - 2 * at(t) + at(t - dt)) / dt ** 2;
      near(acceleration + damping * derivative + 100 * (at(t) - 1), 0, .003);
    }
  }
});

test('Spring has physical damping behavior and remains continuous near critical damping', () => {
  assert.ok(Math.max(...samples(t => springProgress(t, { damping: 8 }))) > 1.2);
  for (const damping of [20, 35]) {
    const values = samples(t => springProgress(t * 2, { damping }));
    assert.ok(values.every((value, index) => value >= 0 && value < 1 && (!index || value >= values[index - 1])));
    near(springProgress(20, { damping }), 1);
  }
  for (const t of [.01, .1, .5, 1, 3]) {
    near(springProgress(t, { damping: 19.999999, velocity: 3 }), springProgress(t, { damping: 20, velocity: 3 }), 1e-7);
    near(springProgress(t, { damping: 20.000001, velocity: 3 }), springProgress(t, { damping: 20, velocity: 3 }), 1e-7);
  }
  near(springProgress(Math.PI / 10, { damping: 0 }), 2);
  near(springProgress(2 * Math.PI / 10, { damping: 0 }), 0);
  assert.notEqual(springProgress(2, { damping: 2 }), 1); // No forced endpoint at demo duration.
  assert.ok(springProgress(.1, { velocity: 3 }) > springProgress(.1, { velocity: 0 }));
});

test('delay, duration, and stagger are independent and the final element completes at total time', () => {
  assert.equal(timelineProgress(.3, 2, .5), 0);
  assert.equal(timelineProgress(.5, 2, .5), 0);
  assert.equal(timelineProgress(1.5, 2, .5), .5);
  assert.equal(timelineProgress(3, 2, .5), 1);
  assert.equal(timelineProgress(.49, 0, .5), 0);
  assert.equal(timelineProgress(.5, 0, .5), 1);
  near(sequenceDuration(2, .5, .2, 5), 3.3);
  for (let index = 0; index < 5; index += 1) {
    const delay = .5 + .2 * index;
    near(timelineProgress(delay + 1, 2, delay), .5);
    near(timelineProgress(3.3, 2, delay), 1);
  }
});

test('invalid model parameters fail clearly instead of returning NaN', () => {
  assert.throws(() => evaluateEasing('unknown', 0), RangeError);
  assert.throws(() => evaluateEasing('linear', NaN), RangeError);
  assert.throws(() => evaluateEasing('steps', .5, { steps: 2.5 }), RangeError);
  assert.throws(() => springProgress(1, { mass: 0 }), RangeError);
  assert.throws(() => springProgress(1, { damping: -1 }), RangeError);
  assert.throws(() => timelineProgress(0, -1), RangeError);
  assert.throws(() => sequenceDuration(2, 0, .2, 0), RangeError);
});
