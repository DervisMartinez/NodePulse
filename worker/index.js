const fs = require('node:fs');
const { resolveMaxRetries, decideOutcome, calculateBackoff} = require('./lib/retry');

const API_URL = (process.env.API_URL || 'http://api:3000').replace(/\/+$/, '');
const WORKER_NAME = process.env.WORKER_NAME || 'worker-01';
const POLL_MS = Math.max(500, Number(process.env.WORKER_POLL_MS) || 3000);
const ENV_MAX_RETRIES = Math.max(1, Number(process.env.WORKER_MAX_RETRIES) || 3);
const TASK_DURATION_MS = Math.max(200, Number(process.env.TASK_DURATION_MS) || 1500);
const HEARTBEAT_FILE = '/tmp/worker.alive';
const WORKER_BACKOFF_MS = Math.max(100, Number(process.env.WORKER_BACKOFF_MS) || 1000);
const BACKOFF_TOP_MS = 30000; // 30s maximo de espera

// Estado el apagado ordenado
let isShuttingDown = false;
let currentTaskId = null;   // para saber si hay tarea en curso
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function touchHeartbeat() {
  try {
    fs.writeFileSync(HEARTBEAT_FILE, String(Date.now()));
  } catch {
    // Ignorar fuera de Linux/contenedor si /tmp no aplica
  }
}

async function claimNextTask() {
  const res = await fetch(`${API_URL}/api/tasks/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerName: WORKER_NAME }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al reclamar tarea`);
  }

  const body = await res.json();
  return body.data || null;
}

async function updateTask(taskId, update) {
  const res = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al actualizar tarea #${taskId}`);
  }
}

async function processTask(task) {
  currentTaskId = task.id;
  const maxRetries = resolveMaxRetries(task, ENV_MAX_RETRIES);
  console.log(
    `[worker] Procesando tarea #${task.id} ("${task.title}") · intento ${task.attempts}/${maxRetries}`
  );

  await sleep(TASK_DURATION_MS);

  const outcome = decideOutcome(task, ENV_MAX_RETRIES, {
    workerName: WORKER_NAME,
    durationMs: TASK_DURATION_MS,
  });

  if (outcome.status === 'COMPLETED') {
    await updateTask(task.id, {
      status: outcome.status,
      result: outcome.result,
      errorMessage: null,
    });
    console.log(`[worker] ${outcome.message}`);
    return;
  }

  console[outcome.logLevel](`[worker] ${outcome.message}`);
  await updateTask(task.id, { status: outcome.status, errorMessage: outcome.errorMessage });

  // Si la tarea vuelve a PENDING, aplicar backoff exponencial antes del siguiente ciclo
  if (outcome.status === 'PENDING'){
    const waitMs = calculateBackoff(task.attempts, WORKER_BACKOFF_MS, BACKOFF_TOP_MS);
    console.log(`[worker] Tarea # ${task.id}: reencolado en ${waitMs} ms`);
    await sleep(waitMs);
  }

  currentTaskId = null;
}

// Captura de SIGTERM para apagado ordenado
process.on('SIGTERM', () => {
  if (isShuttingDown) return; // ignora duplicados
  isShuttingDown = true;
  if (currentTaskId !== null) {
    console.log(`[worker] SIGTERM recibido. Finalizamos tarea #${currentTaskId} antes de salir...`);
  } else {
    console.log(`[worker] SIGTERM recibido. Sin tarea en curso, saliendo.`);
    process.exit(0);
  }
});

async function loop() {
  console.log(
    `[worker] Iniciado (${WORKER_NAME}) -> ${API_URL} | poll=${POLL_MS}ms | maxRetries=${ENV_MAX_RETRIES}`
  );

  while (!isShuttingDown) {
    touchHeartbeat();
    try {
      const task = await claimNextTask();
      if (task) {
        await processTask(task);
        continue;
      }
    } catch (err) {
      console.error(`[worker] Error en ciclo: ${err.message}`);
    }

    if (!isShuttingDown){
      await sleep(POLL_MS);
    }
  }

  // Espera a que la tarea actual termine (si habia una)
  while (currentTaskId !== null){
    console.log(`[worker] Esperando a que termine la tarea #${currentTaskId}...`);
    await sleep(500);
  }

  console.log('[worker] Apagado ordenado completado.');
  process.exit(0);
}

loop();
