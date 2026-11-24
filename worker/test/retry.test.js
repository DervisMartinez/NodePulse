'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveMaxRetries, decideOutcome, calculateBackoff } = require('../lib/retry');

// --- Test de resolveMaxRetries ---
describe('resolveMaxRetrie', () => {
    it('usa maxRetries de la tarea si está definido', () => {
        const task = { maxRetries: 5 };
        assert.strictEqual(resolveMaxRetries(task, 3), 5);
    });

    it('usa el valor de entorno si la tarea no tiene maxRetries', () => {
        const task = {};
        assert.strictEqual(resolveMaxRetries(task, 3), 3);
    });
});

// --- Test de calculateBackoff ---
describe('calculateBackoff', () =>{
    it('primer intento devuelve backoffMs sin cambios', () => {
        assert.strictEqual(calculateBackoff(1, 1000, 30000), 1000);
    });

    it('segundo intento dobla el tiempo de espera', () => {
    assert.strictEqual(calculateBackoff(2, 1000, 30000), 2000);
    });
    
    it('tercer intento cuadruplica el tiempo base', () => {
    assert.strictEqual(calculateBackoff(3, 1000, 30000), 4000);
    });
    
    it('nunca supera el tope máximo', () => {
    // 2^10 * 1000 = 1.024.000 ms >> 30000 ms
    assert.strictEqual(calculateBackoff(10, 1000, 30000), 30000);
    });
    
    it('tope de 0 ms siempre devuelve 0', () => {
    assert.strictEqual(calculateBackoff(1, 1000, 0), 0);
    });
})

// --- Test de decideOutcome ---
describe('decideOutcome', () => {
    it('tarea sin fallo se completa', () => {
        const task = {id: 1, attempts: 1, payload: {shouldFail: false} };
        const result = decideOutcome(task, 3, { workerName: 'test', durationMs: 100});
        assert.strictEqual(result.status, 'COMPLETED');
    });

    it('tarea con fallo y reintentos disponibles vuelve a PENDING', () => {
        const task = {id: 2, attempts: 1, payload: {shouldFail: true} };
        const result = decideOutcome(task, 3, {});
        assert.strictEqual(result.status, 'PENDING');
    })

    it('tarea con fallo sin reintentos disponibles queda en FAILED', () => {
    const tarea = { id: 3, attempts: 3, payload: { shouldFail: true } };
    const resultado = decideOutcome(tarea, 3, {});
    assert.strictEqual(resultado.status, 'FAILED');
    });
});