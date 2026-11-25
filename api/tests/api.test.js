const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { createApp } = require('../app');

function invokeApp(mockDb, { method = 'GET', url, body } = {}) {
  const app = createApp(mockDb);

  return new Promise((resolve, reject) => {
    const rawBody = body !== undefined ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const req = new PassThrough();
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = rawBody
      ? {
          'content-type': 'application/json',
          'content-length': String(rawBody.length),
        }
      : {};
    req.socket = { remoteAddress: '127.0.0.1' };
    req.connection = req.socket;

    const chunks = [];
    const headers = {};
    const res = new PassThrough();
    res.statusCode = 200;
    res.locals = {};
    res.setHeader = (name, value) => {
      headers[name.toLowerCase()] = value;
    };
    res.getHeader = (name) => headers[name.toLowerCase()];
    res.removeHeader = (name) => {
      delete headers[name.toLowerCase()];
    };
    res.writeHead = (code, hdrs) => {
      res.statusCode = code;
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) {
          res.setHeader(k, v);
        }
      }
      return res;
    };
    res.write = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString('utf8');
      let json = null;
      if (text.length > 0) {
        try {
          json = JSON.parse(text);
        } catch {
          json = text;
        }
      }
      resolve({ status: res.statusCode, body: json });
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
    });

    process.nextTick(() => {
      if (rawBody) {
        req.push(rawBody);
      }
      req.push(null);
    });
  });
}

test('GET /api/health responde 200 cuando PostgreSQL está disponible', async () => {
  const mockDb = {
    async query(sql) {
      assert.equal(sql, 'SELECT 1');
      return { rows: [{ '?column?': 1 }] };
    },
  };

  const res = await invokeApp(mockDb, { url: '/api/health' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, 'healthy');
  assert.equal(res.body.data.databaseConnected, true);
});

test('GET /api/health responde 503 uniforme si la BD falla', async () => {
  const mockDb = {
    async query() {
      throw new Error('connection refused');
    },
  };

  const res = await invokeApp(mockDb, { url: '/api/health' });
  assert.equal(res.status, 503);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'DB_UNAVAILABLE');
});

test('POST /api/metrics valida campos obligatorios con error uniforme 400', async () => {
  const mockDb = { async query() { return { rows: [] }; } };
  const res = await invokeApp(mockDb, {
    method: 'POST',
    url: '/api/metrics',
    body: { name: 'nodo-01', cpuPercent: 150, memoryPercent: 40 },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('POST /api/metrics registra nodo y métrica correctamente', async () => {
  const now = new Date().toISOString();
  const mockDb = {
    async query(sql) {
      if (sql.includes('INSERT INTO nodes')) {
        return {
          rows: [
            {
              id: 1,
              name: 'nodo-01',
              hostname: 'nodo-01',
              status: 'healthy',
              last_cpu_percent: '25.50',
              last_memory_percent: '48.20',
              last_load_avg: '0.45',
              uptime_seconds: '120',
              last_seen_at: now,
              created_at: now,
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const res = await invokeApp(mockDb, {
    method: 'POST',
    url: '/api/metrics',
    body: {
      name: 'nodo-01',
      cpuPercent: 25.5,
      memoryPercent: 48.2,
      loadAvg: 0.45,
      uptimeSeconds: 120,
      status: 'healthy',
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.name, 'nodo-01');
  assert.equal(res.body.data.cpuPercent, 25.5);
});

test('POST /api/tasks rechaza título vacío y crea tarea válida', async () => {
  const now = new Date().toISOString();
  const mockDb = {
    async query() {
      return {
        rows: [
          {
            id: 7,
            title: 'Respaldo diario',
            payload: {},
            status: 'PENDING',
            attempts: 0,
            max_retries: 3,
            worker_name: null,
            result: null,
            error_message: null,
            created_at: now,
            updated_at: now,
          },
        ],
      };
    },
  };

  const badRes = await invokeApp(mockDb, {
    method: 'POST',
    url: '/api/tasks',
    body: { title: '' },
  });
  assert.equal(badRes.status, 400);

  const okRes = await invokeApp(mockDb, {
    method: 'POST',
    url: '/api/tasks',
    body: { title: 'Respaldo diario' },
  });
  assert.equal(okRes.status, 201);
  assert.equal(okRes.body.data.id, 7);
  assert.equal(okRes.body.data.status, 'PENDING');
});

test('GET /api/nodes/:name responde 404 si el nodo no existe', async () => {
  const mockDb = { async query() { return { rows: [] }; } };
  const res = await invokeApp(mockDb, { url: '/api/nodes/inexistente' });
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'NODE_NOT_FOUND');
});

test('POST /api/tasks/claim y PATCH /api/tasks/:id manejan cola y fallo definitivo', async () => {
  const now = new Date().toISOString();
  const auditQueries = [];
  const mockDb = {
    async query(sql) {
      if (sql.includes('WITH next_task')) {
        return {
          rows: [
            {
              id: 3,
              title: 'Prueba worker',
              payload: { shouldFail: true },
              status: 'PROCESSING',
              attempts: 3,
              max_retries: 3,
              worker_name: 'worker-01',
              result: null,
              error_message: null,
              created_at: now,
              updated_at: now,
            },
          ],
        };
      }
      if (sql.includes('UPDATE tasks')) {
        return {
          rows: [
            {
              id: 3,
              title: 'Prueba worker',
              payload: { shouldFail: true },
              status: 'FAILED',
              attempts: 3,
              max_retries: 3,
              worker_name: 'worker-01',
              result: null,
              error_message: 'Fallo definitivo',
              created_at: now,
              updated_at: now,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO incident_audit')) {
        auditQueries.push(sql);
      }
      return { rows: [] };
    },
  };

  const claimRes = await invokeApp(mockDb, {
    method: 'POST',
    url: '/api/tasks/claim',
    body: { workerName: 'worker-01' },
  });
  assert.equal(claimRes.status, 200);
  assert.equal(claimRes.body.data.id, 3);
  assert.equal(claimRes.body.data.status, 'PROCESSING');

  const patchRes = await invokeApp(mockDb, {
    method: 'PATCH',
    url: '/api/tasks/3',
    body: { status: 'FAILED', errorMessage: 'Fallo definitivo' },
  });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.data.status, 'FAILED');
  assert.equal(auditQueries.length, 1);
});

test('Ruta inexistente devuelve 404 uniforme', async () => {
  const mockDb = { async query() { return { rows: [] }; } };
  const res = await invokeApp(mockDb, { url: '/api/desconocida' });
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('POST /api/tasks/requeue-stale reencola tareas atascadas y registra auditoría', async () => {
  const auditQueries = [];
  const mockDb = {
    async query(sql) {
      if (sql.includes('UPDATE tasks')) {
        return { rows: [{ id: 4 }, { id: 9 }] };
      }
      if (sql.includes('INSERT INTO incident_audit')) {
        auditQueries.push(sql);
      }
      return { rows: [] };
    },
  };

  const res = await invokeApp(mockDb, { method: 'POST', url: '/api/tasks/requeue-stale' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.requeued, 2);
  assert.deepEqual(res.body.data.taskIds, [4, 9]);
  assert.equal(auditQueries.length, 1);
});

test('POST /api/tasks/requeue-stale no registra auditoría si no hay tareas atascadas', async () => {
  const auditQueries = [];
  const mockDb = {
    async query(sql) {
      if (sql.includes('INSERT INTO incident_audit')) {
        auditQueries.push(sql);
      }
      return { rows: [] };
    },
  };

  const res = await invokeApp(mockDb, { method: 'POST', url: '/api/tasks/requeue-stale' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.requeued, 0);
  assert.equal(auditQueries.length, 0);
});

test('GET /api/tasks?status=PENDING filtra por estado', async () => {
  let usedParams = null;
  const mockDb = {
    async query(_sql, params) {
      usedParams = params;
      return { rows: [] };
    },
  };

  const res = await invokeApp(mockDb, { url: '/api/tasks?status=PENDING' });
  assert.equal(res.status, 200);
  assert.deepEqual(usedParams, ['PENDING']);
});

test('GET /api/tasks rechaza un estado inválido con 400', async () => {
  const mockDb = { async query() { return { rows: [] }; } };
  const res = await invokeApp(mockDb, { url: '/api/tasks?status=BORRADO' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('POST /api/metrics rechaza memoryLimitMb inválido con 400', async () => {
  const mockDb = { async query() { return { rows: [] }; } };
  for (const malo of [-5, 0, 1.5, '512']) {
    const res = await invokeApp(mockDb, {
      method: 'POST',
      url: '/api/metrics',
      body: { name: 'nodo-01', cpuPercent: 10, memoryPercent: 20, memoryLimitMb: malo },
    });
    assert.equal(res.status, 400, `debió rechazar ${JSON.stringify(malo)}`);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});

test('POST /api/metrics guarda memoryLimitMb y lo devuelve', async () => {
  const now = new Date().toISOString();
  const params = {};
  const mockDb = {
    async query(sql, values) {
      if (sql.includes('INSERT INTO nodes')) {
        params.nodes = values;
        return {
          rows: [
            {
              id: 1,
              name: 'nodo-01',
              hostname: 'nodo-01',
              status: 'healthy',
              last_cpu_percent: '10',
              last_memory_percent: '20',
              last_load_avg: '0',
              uptime_seconds: '0',
              memory_limit_mb: 512,
              last_seen_at: now,
              created_at: now,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO node_metrics')) params.metrics = values;
      return { rows: [] };
    },
  };

  const res = await invokeApp(mockDb, {
    method: 'POST',
    url: '/api/metrics',
    body: { name: 'nodo-01', cpuPercent: 10, memoryPercent: 20, memoryLimitMb: 512 },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.memoryLimitMb, 512);
  assert.equal(params.nodes[7], 512);
  assert.equal(params.metrics[6], 512);
});

test('GET /api/nodes devuelve memoryLimitMb null si no hay límite', async () => {
  const now = new Date().toISOString();
  const mockDb = {
    async query() {
      return {
        rows: [
          {
            id: 1,
            name: 'nodo-01',
            hostname: 'nodo-01',
            status: 'healthy',
            last_cpu_percent: '10',
            last_memory_percent: '20',
            last_load_avg: '0',
            uptime_seconds: '0',
            memory_limit_mb: null,
            last_seen_at: now,
            created_at: now,
          },
        ],
      };
    },
  };

  const res = await invokeApp(mockDb, { url: '/api/nodes' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data[0].memoryLimitMb, null);
});
