const fs = require('node:fs');
const { resolveMaxRetries, decideOutcome } = require('./lib/retry');

const API_URL = (process.env.API_URL || 'http://api:3000').replace(/\/+$/, '');
const WORKER_NAME = process.env.WORKER_NAME || 'worker-01';
const POLL_MS = Math.max(500, Number(process.env.WORKER_POLL_MS) || 3000);
const ENV_MAX_RETRIES = Math.max(1, Number(process.env.WORKER_MAX_RETRIES) || 3);
const TASK_DURATION_MS = Math.max(200, Number(process.env.TASK_DURATION_MS) || 1500);
const HEARTBEAT_FILE = '/tmp/worker.alive';

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
}

async function loop() {
  console.log(
    `[worker] Iniciado (${WORKER_NAME}) -> ${API_URL} | poll=${POLL_MS}ms | maxRetries=${ENV_MAX_RETRIES}`
  );

  while (true) {
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
    await sleep(POLL_MS);
  }
}

loop();
