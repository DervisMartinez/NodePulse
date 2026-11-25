#!/usr/bin/env node
/**
 * Prueba de humo end-to-end contra el Gateway (adaptado de SCPA).
 * Uso: node scripts/smoke-test.mjs
 */
const GATEWAY_PORT = process.env.GATEWAY_PORT || '8080';
const API_URL = process.env.API_URL || `http://localhost:${GATEWAY_PORT}/api`;

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  OK   ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` -> ${detail}` : ''}`);
}

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, json };
}

async function main() {
  console.log(`\nSmoke test contra ${API_URL}\n`);

  const health = await req('/health');
  check('GET /api/health', health.ok && health.json?.data?.databaseConnected === true);

  const badMetric = await req('/metrics', {
    method: 'POST',
    body: { name: 'x', cpuPercent: 999, memoryPercent: 10 },
  });
  check('POST /api/metrics valida parámetros (400)', badMetric.status === 400);

  const taskTitle = `Smoke-${Date.now()}`;
  const created = await req('/tasks', {
    method: 'POST',
    body: { title: taskTitle },
  });
  check('POST /api/tasks crea tarea', created.status === 201 && created.json?.data?.title === taskTitle);

  const nodes = await req('/nodes');
  check('GET /api/nodes responde lista', nodes.ok && Array.isArray(nodes.json?.data));

  console.log(`\nResultado: ${passed} OK, ${failed} FAIL\n`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
