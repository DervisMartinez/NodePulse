import { describe, expect, it } from 'vitest';
import { toPolylinePoints } from './chart';

describe('toPolylinePoints', () => {
  it('reparte los puntos a lo ancho y escala el alto a 0-100', () => {
    expect(toPolylinePoints([0, 50, 100], 200, 100)).toBe('0,100 100,50 200,0');
  });

  it('devuelve una cadena vacía si no hay valores', () => {
    expect(toPolylinePoints([], 200, 100)).toBe('');
  });

  it('ubica un solo valor al inicio', () => {
    expect(toPolylinePoints([25], 200, 100)).toBe('0,75');
  });

  it('recorta valores fuera de rango', () => {
    expect(toPolylinePoints([-10, 130], 100, 100)).toBe('0,100 100,0');
  });

  it('redondea a un decimal', () => {
    expect(toPolylinePoints([33.333, 0], 90, 90)).toBe('0,60 90,90');
  });
});
