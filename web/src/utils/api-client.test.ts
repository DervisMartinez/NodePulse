import { describe, expect, it } from 'vitest';
import { extractErrorMessage } from './api-client';

describe('extractErrorMessage', () => {
  it('extrae el mensaje uniforme devuelto por la API', () => {
    const message = extractErrorMessage(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Título inválido' },
      },
      400
    );
    expect(message).toBe('Título inválido');
  });

  it('devuelve un respaldo legible si no hay payload estructurado', () => {
    expect(extractErrorMessage(null, 502)).toBe('Error del servidor (HTTP 502)');
  });
});
