/**
 * Política de reintentos del worker.
 * Funciones puras: no hacen E/S, solo deciden qué hacer con una tarea.
 */

function resolveMaxRetries(task, envMaxRetries) {
  return task.maxRetries || envMaxRetries;
}

/**
 * Decide el resultado de una tarea ya procesada.
 * @returns {{ status: 'PENDING'|'FAILED'|'COMPLETED', errorMessage: string|null,
 *             result: string|null, logLevel: 'log'|'warn'|'error', message: string }}
 */
function decideOutcome(task, envMaxRetries, { workerName, durationMs } = {}) {
  const maxRetries = resolveMaxRetries(task, envMaxRetries);
  const shouldFail = Boolean(task.payload && task.payload.shouldFail);

  if (shouldFail) {
    if (task.attempts < maxRetries) {
      const msg = `Fallo simulado en intento ${task.attempts}/${maxRetries}; reencolando.`;
      return {
        status: 'PENDING',
        errorMessage: msg,
        result: null,
        logLevel: 'warn',
        message: `Tarea #${task.id}: ${msg}`,
      };
    }

    const msg = `Fallo definitivo tras ${task.attempts} intento(s).`;
    return {
      status: 'FAILED',
      errorMessage: msg,
      result: null,
      logLevel: 'error',
      message: `Tarea #${task.id}: ${msg}`,
    };
  }

  return {
    status: 'COMPLETED',
    errorMessage: null,
    result: `Completada por ${workerName} en ${durationMs}ms (intento ${task.attempts}).`,
    logLevel: 'log',
    message: `Tarea #${task.id} completada.`,
  };
}

/**
 * Calcula el tiempo de espera con backoff exponencial antes de reencolar.
 * Formula: backoffMs * 2^(trial - 1), con tope máximo
 * 
 * @param {number} trial
 * @param {number} backoffMs  -
 * @param {number} topMs      - 
 * @returns {number} - Milisegundos a esperar antes del siguiente intento
 */
function calculateBackoff(trial, backoffMs, topMs){
  const waiting = backoffMs * Math.pow(2, trial - 1);
  return Math.min(espera, topMs);
}

module.exports = { resolveMaxRetries, decideOutcome, calculateBackoff};