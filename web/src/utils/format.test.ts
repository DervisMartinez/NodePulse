import { describe, expect, it } from 'vitest';
import { formatRelative } from './format';

describe('formatRelative', () => {
  const now = Date.parse('2026-11-22T12:00:00.000Z');

  it('muestra segundos si pasó menos de un minuto', () => {
    expect(formatRelative('2026-11-22T11:59:56.000Z', now)).toBe('hace 4 s');
  });

  it('muestra minutos si pasó menos de una hora', () => {
    expect(formatRelative('2026-11-22T11:57:00.000Z', now)).toBe('hace 3 min');
  });

  it('muestra horas si pasó menos de un día', () => {
    expect(formatRelative('2026-11-22T07:00:00.000Z', now)).toBe('hace 5 h');
  });

  it('muestra días si pasó un día o más', () => {
    expect(formatRelative('2026-11-20T12:00:00.000Z', now)).toBe('hace 2 d');
  });

  it('no muestra tiempos negativos si el reloj del nodo va adelantado', () => {
    expect(formatRelative('2026-11-22T12:00:03.000Z', now)).toBe('hace 0 s');
  });

  it('devuelve un guion si la fecha no es válida', () => {
    expect(formatRelative('no-es-fecha', now)).toBe('—');
  });
});
