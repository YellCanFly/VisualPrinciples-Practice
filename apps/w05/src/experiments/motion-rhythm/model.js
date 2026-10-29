// Time-to-progress mappings for the teaching demonstration. Outputs intentionally
// remain unclamped so anticipation, overshoot and spring oscillation stay visible.
// CSS Bézier / step semantics: https://www.w3.org/TR/css-easing-1/
// Named families: https://easings.net/ (Penner-style analytic easing functions).

const clamp01 = value => Math.min(1, Math.max(0, value));

function finite(value, name) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}

function nonnegative(value, name) {
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must be nonnegative`);
  return value;
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
  return value;
}

function bezierCoordinate(u, a, b) {
  return 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u ** 2 * b + u ** 3;
}

/** Evaluate y after solving x(u)=time; u itself is NOT elapsed time. */
export function cubicBezier(time, { x1 = .25, y1 = .1, x2 = .25, y2 = 1 } = {}) {
  const t = clamp01(finite(time, 'time'));
  const a = clamp01(finite(x1, 'x1'));
  const b = clamp01(finite(x2, 'x2'));
  finite(y1, 'y1');
  finite(y2, 'y2');
  if (t === 0 || t === 1) return t;
  // Bisection also handles flat tangents (including x1=x2=0 or 1).
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const u = (low + high) / 2;
    if (bezierCoordinate(u, a, b) < t) low = u;
    else high = u;
  }
  return bezierCoordinate((low + high) / 2, y1, y2);
}

function bounceOut(t) {
  const divisor = 2.75;
  const strength = divisor ** 2;
  if (t < 1 / divisor) return strength * t ** 2;
  if (t < 2 / divisor) return strength * (t - 1.5 / divisor) ** 2 + .75;
  if (t < 2.5 / divisor) return strength * (t - 2.25 / divisor) ** 2 + .9375;
  return strength * (t - 2.625 / divisor) ** 2 + .984375;
}

function inCurve(family, t, overshoot) {
  switch (family) {
    case 'quad': return t ** 2;
    case 'cubic': return t ** 3;
    case 'quart': return t ** 4;
    case 'quint': return t ** 5;
    case 'sine': return 1 - Math.cos(t * Math.PI / 2);
    case 'expo': return t === 0 ? 0 : 2 ** (10 * t - 10);
    case 'circ': return 1 - Math.sqrt(Math.max(0, 1 - t ** 2));
    case 'back': return (overshoot + 1) * t ** 3 - overshoot * t ** 2;
    case 'elastic': return -(2 ** (10 * t - 10)) * Math.sin((10 * t - 10.75) * 2 * Math.PI / 3);
    case 'bounce': return 1 - bounceOut(1 - t);
    default: throw new RangeError(`Unknown easing family: ${family}`);
  }
}

/**
 * Normalized elapsed time, clamped to [0,1], mapped to movement progress.
 * direction: 'in', 'out' (default), 'inout'. Bézier/steps ignore direction.
 * steps uses the forward, after-jump value at exact boundaries; delay holding
 * belongs to the caller, so jump-start does not advance before its start time.
 */
export function evaluateEasing(family, time, options = {}) {
  const t = clamp01(finite(time, 'time'));
  if (family === 'linear') return t;
  if (family === 'bezier') return cubicBezier(t, options);
  if (family === 'steps') {
    const count = options.steps ?? 5;
    if (!Number.isInteger(count) || count < 1) throw new RangeError('steps must be a positive integer');
    const position = options.position ?? 'end';
    if (!['start', 'end', 'jump-start', 'jump-end'].includes(position)) throw new RangeError('Unsupported step position');
    const start = position === 'start' || position === 'jump-start';
    return Math.min(1, (Math.floor(t * count) + (start ? 1 : 0)) / count);
  }
  const direction = options.direction ?? 'out';
  if (!['in', 'out', 'inout'].includes(direction)) throw new RangeError('Unknown easing direction');
  const overshoot = nonnegative(options.overshoot ?? 1.70158, 'overshoot');
  // Validate family even at endpoints.
  inCurve(family, 0, overshoot);
  if (t === 0 || t === 1) return t;
  if (direction === 'in') return inCurve(family, t, overshoot);
  if (direction === 'out') return 1 - inCurve(family, 1 - t, overshoot);
  if (family === 'elastic') {
    const oscillation = Math.sin((20 * t - 11.125) * 2 * Math.PI / 4.5);
    return t < .5
      ? -(2 ** (20 * t - 10)) * oscillation / 2
      : 2 ** (-20 * t + 10) * oscillation / 2 + 1;
  }
  const strength = family === 'back' ? overshoot * 1.525 : overshoot;
  return t < .5
    ? inCurve(family, t * 2, strength) / 2
    : 1 - inCurve(family, 2 - t * 2, strength) / 2;
}

/**
 * Analytic solution of m*x'' + c*x' + k*(x-1) = 0, x(0)=0, x'(0)=velocity.
 * seconds is real elapsed time; velocity is progress units per second.
 * There is no forced finish time or endpoint normalization. With damping=0,
 * oscillation persists. Nonzero initial velocity can cause any regime to cross 1.
 * Damping regimes: MIT 8.03SC, Lecture 2 (Damped Free Oscillators), 2016.
 */
export function springProgress(seconds, { mass = 1, stiffness = 100, damping = 10, velocity = 0 } = {}) {
  const time = Math.max(0, finite(seconds, 'seconds'));
  positive(mass, 'mass');
  positive(stiffness, 'stiffness');
  nonnegative(damping, 'damping');
  finite(velocity, 'velocity');
  if (time === 0) return 0;
  const omegaSquared = stiffness / mass;
  const alpha = damping / (2 * mass);
  const discriminant = alpha ** 2 - omegaSquared;
  if (Math.abs(discriminant) < omegaSquared * 1e-10) {
    return 1 + (-1 + (velocity - alpha) * time) * Math.exp(-alpha * time);
  }
  if (discriminant < 0) {
    const omega = Math.sqrt(-discriminant);
    return 1 + Math.exp(-alpha * time)
      * (-Math.cos(omega * time) + (velocity - alpha) * Math.sin(omega * time) / omega);
  }
  const root = Math.sqrt(discriminant);
  // Avoid cancellation in -alpha+root for strongly overdamped springs.
  const slow = -omegaSquared / (alpha + root);
  const fast = -alpha - root;
  const slowWeight = (velocity + fast) / (slow - fast);
  return 1 + slowWeight * Math.exp(slow * time) + (-1 - slowWeight) * Math.exp(fast * time);
}

/** Local time only; callers hold output at 0 while elapsed < delay. */
export function timelineProgress(elapsed, duration, delay = 0) {
  finite(elapsed, 'elapsed');
  nonnegative(duration, 'duration');
  nonnegative(delay, 'delay');
  if (duration === 0) return elapsed < delay ? 0 : 1;
  return clamp01((elapsed - delay) / duration);
}

/** End of the final member in a forward staggered sequence, in seconds. */
export function sequenceDuration(duration, delay = 0, stagger = 0, count = 1) {
  nonnegative(duration, 'duration');
  nonnegative(delay, 'delay');
  nonnegative(stagger, 'stagger');
  if (!Number.isInteger(count) || count < 1) throw new RangeError('count must be a positive integer');
  return delay + duration + stagger * (count - 1);
}
