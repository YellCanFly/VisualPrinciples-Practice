// Distances in metres; time in simulated seconds. Downward is positive.
export const GRAVITY = 9.81;
export const INITIAL_SPEED = 0.45;
export const FALL_HEIGHT = 2.2;
export const FALL_TIME = (Math.sqrt(INITIAL_SPEED ** 2 + 2 * GRAVITY * FALL_HEIGHT) - INITIAL_SPEED) / GRAVITY;

export function positionAtAge(age) {
  return INITIAL_SPEED * age + 0.5 * GRAVITY * age * age;
}

export function dropsAt(time, frequency) {
  const drops = [];
  // Negative IDs prefill the steady stream before t = 0.
  const newest = Math.floor(time * frequency + 1e-9);
  const oldest = Math.ceil((time - FALL_TIME) * frequency - 1e-9);
  for (let id = oldest; id <= newest; id++) {
    const age = Math.max(0, time - id / frequency);
    drops.push({ id, age, y: positionAtAge(age) });
  }
  return drops;
}

export function sampleIndex(time, flashFrequency) {
  return Math.floor(time * flashFrequency + 1e-9);
}

export function sampledTime(time, flashFrequency) {
  return sampleIndex(time, flashFrequency) / flashFrequency;
}

export function samplingRelation(dropFrequency, flashFrequency) {
  const difference = flashFrequency - dropFrequency;
  return {
    difference,
    ageStep: 1 / flashFrequency - 1 / dropFrequency,
    phaseStep: dropFrequency / flashFrequency - 1,
    direction: Math.abs(difference) < 1e-8 ? 'still' : difference > 0 ? 'up' : 'down',
  };
}
