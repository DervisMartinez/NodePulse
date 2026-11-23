export function toPolylinePoints(
  values: number[],
  width: number,
  height: number,
  max: number = 100
): string {
  if (values.length === 0) {
    return '';
  }

  const step = values.length > 1 ? width / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const clamped = Math.min(Math.max(value, 0), max);
      const x = index * step;
      const y = height - (clamped / max) * height;
      return `${round(x)},${round(y)}`;
    })
    .join(' ');
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
