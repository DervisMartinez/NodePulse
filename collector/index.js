const os = require('node:os');
const fs = require('node:fs');

const API_URL = (process.env.API_URL || 'http://api:3000').replace(/\/+$/, '');
const NODE_NAME = process.env.NODE_NAME || os.hostname();
const INTERVAL_MS = Math.max(1000, Number(process.env.COLLECTOR_INTERVAL_MS) || 5000);
const HEARTBEAT_FILE = '/tmp/collector.alive';
const HEARTBEAT_INTERVAL_MS = 5000;

function readCpuSnapshot() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total +=
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.irq +
      cpu.times.idle;
  }
  return { idle, total };
}

let prevSnapshot = readCpuSnapshot();

function computeCpuPercent() {
  const current = readCpuSnapshot();
  const idleDiff = current.idle - prevSnapshot.idle;
  const totalDiff = current.total - prevSnapshot.total;
  prevSnapshot = current;

  if (totalDiff <= 0) {
    return 0;
  }
  const usage = ((totalDiff - idleDiff) / totalDiff) * 100;
  return Number(Math.min(100, Math.max(0, usage)).toFixed(2));
}

function collectSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memoryPercent = Number((((totalMem - freeMem) / totalMem) * 100).toFixed(2));
  const cpuPercent = computeCpuPercent();
  const loadAvg = Number((os.loadavg()[0] || 0).toFixed(2));
  const uptimeSeconds = Math.floor(os.uptime());
  const status = cpuPercent >= 90 || memoryPercent >= 90 ? 'degraded' : 'healthy';

  return {
    name: NODE_NAME,
    hostname: os.hostname(),
    cpuPercent,
    memoryPercent,
    loadAvg,
    uptimeSeconds,
    status,
  };
}

function touchHeartbeat() {
  try {
    fs.writeFileSync(HEARTBEAT_FILE, String(Date.now()));
  } catch {
    // Ignorar fuera de Linux/contenedor si /tmp no aplica
  }
}

async function sendMetrics() {
  const payload = collectSystemMetrics();

  try {
    const res = await fetch(`${API_URL}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    console.log(
      `[collector] Métrica enviada (${payload.name}): CPU=${payload.cpuPercent}% RAM=${payload.memoryPercent}% LOAD=${payload.loadAvg} status=${payload.status}`
    );
  } catch (err) {
    console.error(`[collector] Error enviando métrica: ${err.message}`);
  }
}

console.log(
  `[collector] Iniciado (${NODE_NAME}) -> ${API_URL} | intervalo=${INTERVAL_MS}ms`
);

touchHeartbeat();
setInterval(touchHeartbeat, HEARTBEAT_INTERVAL_MS);

setTimeout(() => {
  void sendMetrics();
  setInterval(() => {
    void sendMetrics();
  }, INTERVAL_MS);
}, 500);
