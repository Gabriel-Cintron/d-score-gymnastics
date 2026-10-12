export function clampDifficulty(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(Math.round(value), minimum), maximum);
}

export function difficultyAtTrackOffset(
  offset: number,
  trackWidth: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(offset) || !Number.isFinite(trackWidth) || trackWidth <= 0) return minimum;
  const progress = Math.min(Math.max(offset / trackWidth, 0), 1);
  return clampDifficulty(minimum + progress * (maximum - minimum), minimum, maximum);
}

export function difficultyAfterDrag(
  startingValue: number,
  horizontalDelta: number,
  trackWidth: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(horizontalDelta) || !Number.isFinite(trackWidth) || trackWidth <= 0) {
    return clampDifficulty(startingValue, minimum, maximum);
  }
  const difficultyDelta = (horizontalDelta / trackWidth) * (maximum - minimum);
  return clampDifficulty(startingValue + difficultyDelta, minimum, maximum);
}
