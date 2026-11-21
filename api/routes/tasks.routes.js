const express = require('express');
const { AppError } = require('../middleware/errorHandler');
const {
  validateTaskPayload,
  validateTaskUpdatePayload,
} = require('../middleware/validate');

function serializeTask(row) {
  return {
    id: row.id,
    title: row.title,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    maxRetries: row.max_retries,
    workerName: row.worker_name,
    result: row.result,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createTasksRouter(db) {
  const router = express.Router();

  router.get('/tasks', async (_req, res, next) => {
    try {
      const { rows } = await db.query(
        'SELECT * FROM tasks ORDER BY id DESC LIMIT 50'
      );
      res.status(200).json({
        success: true,
        data: rows.map(serializeTask),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/tasks', validateTaskPayload, async (req, res, next) => {
    try {
      const defaultMaxRetries = Number(process.env.WORKER_MAX_RETRIES) || 3;
      const {
        title,
        payload = {},
        maxRetries = defaultMaxRetries,
      } = req.body;

      const { rows } = await db.query(
        `INSERT INTO tasks (title, payload, max_retries)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [title, JSON.stringify(payload), maxRetries]
      );

      res.status(201).json({
        success: true,
        data: serializeTask(rows[0]),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/tasks/claim', async (req, res, next) => {
    try {
      const workerName =
        typeof req.body?.workerName === 'string' && req.body.workerName.trim()
          ? req.body.workerName.trim()
          : 'worker-01';

      const { rows } = await db.query(
        `WITH next_task AS (
           SELECT id
           FROM tasks
           WHERE status = 'PENDING'
           ORDER BY id ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE tasks
         SET status = 'PROCESSING',
             attempts = tasks.attempts + 1,
             worker_name = $1,
             updated_at = NOW()
         FROM next_task
         WHERE tasks.id = next_task.id
         RETURNING tasks.*`,
        [workerName]
      );

      res.status(200).json({
        success: true,
        data: rows.length > 0 ? serializeTask(rows[0]) : null,
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/tasks/:id', validateTaskUpdatePayload, async (req, res, next) => {
    try {
      const taskId = Number(req.params.id);
      const { status, result = null, errorMessage = null } = req.body;

      const { rows } = await db.query(
        `UPDATE tasks
         SET status = $1,
             result = $2,
             error_message = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [status, result, errorMessage, taskId]
      );

      if (rows.length === 0) {
        return next(
          new AppError(`Tarea #${taskId} no encontrada.`, 404, 'TASK_NOT_FOUND')
        );
      }

      if (status === 'FAILED') {
        await db.query(
          `INSERT INTO incident_audit (service_name, severity, event_type, message, metadata)
           VALUES ('worker', 'ERROR', 'TASK_FAILED', $1, $2)`,
          [
            `Tarea #${taskId} ("${rows[0].title}") falló definitivamente tras ${rows[0].attempts} intento(s).`,
            JSON.stringify({ taskId, errorMessage }),
          ]
        );
      }

      res.status(200).json({
        success: true,
        data: serializeTask(rows[0]),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createTasksRouter };
