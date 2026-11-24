const express = require('express');
const { AppError } = require('../middleware/errorHandler');
const { validateMetricsPayload } = require('../middleware/validate');

function serializeNode(row) {
  const lastSeenMs = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  const online = Date.now() - lastSeenMs < 3000;

  return {
    id: row.id,
    name: row.name,
    hostname: row.hostname,
    status: online ? row.status : 'offline',
    online,
    cpuPercent: Number(row.last_cpu_percent),
    memoryPercent: Number(row.last_memory_percent),
    loadAvg: Number(row.last_load_avg),
    uptimeSeconds: Number(row.uptime_seconds),
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

function createNodesRouter(db) {
  const router = express.Router();

  router.get('/nodes', async (_req, res, next) => {
    try {
      const { rows } = await db.query(
        'SELECT * FROM nodes ORDER BY last_seen_at DESC, id ASC'
      );
      res.status(200).json({
        success: true,
        data: rows.map(serializeNode),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/nodes/:name', async (req, res, next) => {
    try {
      const target = req.params.name;
      const nodeResult = await db.query(
        'SELECT * FROM nodes WHERE name = $1 LIMIT 1',
        [target]
      );

      if (nodeResult.rows.length === 0) {
        return next(
          new AppError(`Nodo "${target}" no encontrado.`, 404, 'NODE_NOT_FOUND')
        );
      }

      const node = nodeResult.rows[0];
      const metricsResult = await db.query(
        `SELECT id, cpu_percent, memory_percent, load_avg, uptime_seconds, status, recorded_at
         FROM node_metrics
         WHERE node_id = $1
         ORDER BY recorded_at DESC
         LIMIT 15`,
        [node.id]
      );

      res.status(200).json({
        success: true,
        data: {
          node: serializeNode(node),
          recentMetrics: metricsResult.rows.map((m) => ({
            id: m.id,
            cpuPercent: Number(m.cpu_percent),
            memoryPercent: Number(m.memory_percent),
            loadAvg: Number(m.load_avg),
            uptimeSeconds: Number(m.uptime_seconds),
            status: m.status,
            recordedAt: m.recorded_at,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/metrics', validateMetricsPayload, async (req, res, next) => {
    try {
      const {
        name,
        hostname,
        cpuPercent,
        memoryPercent,
        loadAvg = 0,
        uptimeSeconds = 0,
        status = 'healthy',
      } = req.body;

      const upsertNode = await db.query(
        `INSERT INTO nodes (
           name, hostname, status, last_cpu_percent, last_memory_percent,
           last_load_avg, uptime_seconds, last_seen_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (name) DO UPDATE SET
           hostname = EXCLUDED.hostname,
           status = EXCLUDED.status,
           last_cpu_percent = EXCLUDED.last_cpu_percent,
           last_memory_percent = EXCLUDED.last_memory_percent,
           last_load_avg = EXCLUDED.last_load_avg,
           uptime_seconds = EXCLUDED.uptime_seconds,
           last_seen_at = NOW()
         RETURNING *`,
        [name, hostname, status, cpuPercent, memoryPercent, loadAvg, uptimeSeconds]
      );

      const node = upsertNode.rows[0];

      await db.query(
        `INSERT INTO node_metrics (node_id, cpu_percent, memory_percent, load_avg, uptime_seconds, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [node.id, cpuPercent, memoryPercent, loadAvg, uptimeSeconds, status]
      );

      if (status === 'degraded' || cpuPercent >= 90 || memoryPercent >= 90) {
        await db.query(
          `INSERT INTO incident_audit (service_name, severity, event_type, message, metadata)
           VALUES ('collector', 'WARN', 'NODE_DEGRADED', $1, $2)`,
          [
            `Nodo ${name} reportó estado ${status} (CPU ${cpuPercent}%, RAM ${memoryPercent}%).`,
            JSON.stringify({ name, cpuPercent, memoryPercent, status }),
          ]
        );
      }

      res.status(201).json({
        success: true,
        data: serializeNode(node),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/audit', async (_req, res, next) => {
    try {
      const { rows } = await db.query(
        'SELECT * FROM incident_audit ORDER BY id DESC LIMIT 30'
      );
      res.status(200).json({
        success: true,
        data: rows.map((row) => ({
          id: row.id,
          serviceName: row.service_name,
          severity: row.severity,
          eventType: row.event_type,
          message: row.message,
          metadata: row.metadata,
          createdAt: row.created_at,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createNodesRouter };
