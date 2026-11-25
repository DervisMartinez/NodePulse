const os = require('node:os');
const fs = require('node:fs');

const API_URL = (process.env.API_URL || 'http://api:3000').replace(/\/+$/, '');
const NODE_NAME = process.env.NODE_NAME || os.hostname();
const INTERVAL_MS = Math.max(1000, Number(process.env.COLLECTOR_INTERVAL_MS) || 5000);
const HEARTBEAT_FILE = '/tmp/collector.alive';
const HEARTBEAT_INTERVAL_MS = 5000;

const CGROUP_MEMORY_CURRENT = '/sys/fs/cgroup/memory.current';
const CGROUP_MEMORY_MAX = '/sys/fs/cgroup/memory.max';
const DISK_PATH = process.env.COLLECTOR_DISK_PATH || '/';
const BYTES_PER_MB = 1024 * 1024;

// Fuente solicitada: 'cgroup' (por defecto) u 'os'
const REQUESTED_MEMORY_SOURCE =
  (process.env.COLLECTOR_MEMORY_SOURCE || 'cgroup').toLowerCase() === 'os' ? 'os' : 'cgroup';

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

/**
 * Lee memoria del cgroup v2.
 * Devuelve { usedBytes, limitBytes|null } o null si el cgroup no está disponible.
 * memory.max vale "max" cuando no hay límite -> limitBytes = null.
 */
function readCgroupMemory() {
  try {
    const usedBytes = Number(fs.readFileSync(CGROUP_MEMORY_CURRENT, 'utf8').trim());
    const rawMax = fs.readFileSync(CGROUP_MEMORY_MAX, 'utf8').trim();
    if (!Number.isFinite(usedBytes)) {
      return null;
    }
    const parsedMax = rawMax === 'max' ? null : Number(rawMax);
    const limitBytes = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : null;
    return { usedBytes, limitBytes };
  } catch {
    return null;
  }
}

function collectMemory() {
  const cgroup = REQUESTED_MEMORY_SOURCE === 'cgroup' ? readCgroupMemory() : null;

  // Con cgroup y límite definido: porcentaje respecto al límite del contenedor
  if (cgroup && cgroup.limitBytes !== null) {
    const percent = (cgroup.usedBytes / cgroup.limitBytes) * 100;
    return {
      source: 'cgroup',
      memoryPercent: Number(Math.min(100, Math.max(0, percent)).toFixed(2)),
      memoryLimitMb: Math.floor(cgroup.limitBytes / BYTES_PER_MB),
    };
  }

  // Sin cgroup, o cgroup sin límite (max): cálculo con os, memoryLimitMb = null
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return {
    source: cgroup ? 'cgroup (sin límite, cálculo con os)' : 'os',
    memoryPercent: Number((((totalMem - freeMem) / totalMem) * 100).toFixed(2)),
    memoryLimitMb: null,
  };
}

/** Uso de disco del contenedor vía fs.statfs. Devuelve null si falla. */
function collectDisk() {
  try {
    const st = fs.statfsSync(DISK_PATH);
    const totalBytes = st.blocks * st.bsize;
    const usedBytes = (st.blocks - st.bfree) * st.bsize;
    if (totalBytes <= 0) {
      return null;
    }
    return {
      diskPercent: Number(((usedBytes / totalBytes) * 100).toFixed(2)),
      diskUsedMb: Math.floor(usedBytes / BYTES_PER_MB),
      diskTotalMb: Math.floor(totalBytes / BYTES_PER_MB),
    };
  } catch {
    return null;
  }
}

function collectSystemMetrics() {
  const memory = collectMemory();
  const disk = collectDisk();
  const cpuPercent = computeCpuPercent();
  const loadAvg = Number((os.loadavg()[0] || 0).toFixed(2));
  const uptimeSeconds = Math.floor(os.uptime());
  const status =
    cpuPercent >= 90 || memory.memoryPercent >= 90 ? 'degraded' : 'healthy';

  return {
    name: NODE_NAME,
    hostname: os.hostname(),
    cpuPercent,
    memoryPercent: memory.memoryPercent,
    memoryLimitMb: memory.memoryLimitMb,
    diskPercent: disk ? disk.diskPercent : null,
    diskUsedMb: disk ? disk.diskUsedMb : null,
    diskTotalMb: disk ? disk.diskTotalMb : null,
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
      `[collector] Métrica enviada (${payload.name}): CPU=${payload.cpuPercent}% RAM=${payload.memoryPercent}% ` +
        `(límite=${payload.memoryLimitMb ?? 'sin límite'} MB) DISCO=${payload.diskPercent ?? 'n/d'}% ` +
        `LOAD=${payload.loadAvg} status=${payload.status}`
    );
  } catch (err) {
    console.error(`[collector] Error enviando métrica: ${err.message}`);
  }
}

function logStartupConfig() {
  const memory = collectMemory();
  const disk = collectDisk();
  console.log('[collector] Configuración leída:');
  console.log(`  nodo                : ${NODE_NAME}`);
  console.log(`  API_URL             : ${API_URL}`);
  console.log(`  intervalo           : ${INTERVAL_MS}ms`);
  console.log(`  fuente memoria      : solicitada=${REQUESTED_MEMORY_SOURCE} efectiva=${memory.source}`);
  console.log(
    `  límite de memoria   : ${memory.memoryLimitMb !== null ? `${memory.memoryLimitMb} MB` : 'sin límite detectado'}`
  );
  console.log(
    `  disco (${DISK_PATH})${' '.repeat(Math.max(1, 12 - DISK_PATH.length))}: ${
      disk ? `${disk.diskUsedMb}/${disk.diskTotalMb} MB (${disk.diskPercent}%)` : 'no disponible'
    }`
  );
  console.log(`  usuario (uid:gid)   : ${process.getuid?.() ?? 'n/d'}:${process.getgid?.() ?? 'n/d'}`);
}

logStartupConfig();

touchHeartbeat();
setInterval(touchHeartbeat, HEARTBEAT_INTERVAL_MS);

setTimeout(() => {
  void sendMetrics();
  setInterval(() => {
    void sendMetrics();
  }, INTERVAL_MS);
}, 500);