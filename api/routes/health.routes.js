const express = require('express');
const { AppError } = require('../middleware/errorHandler');

function createHealthRouter(db) {
  const router = express.Router();

  router.get('/health', async (_req, res, next) => {
    try {
      await db.query('SELECT 1');
      res.status(200).json({
        success: true,
        data: {
          serviceName: 'FACYT Monitoreo API',
          version: '1.0.0',
          status: 'healthy',
          databaseConnected: true,
          timestamp: new Date().toISOString(),
          uptimeSeconds: Math.floor(process.uptime()),
        },
      });
    } catch (_err) {
      next(
        new AppError(
          'No fue posible conectar con la base de datos PostgreSQL.',
          503,
          'DB_UNAVAILABLE'
        )
      );
    }
  });

  return router;
}

module.exports = { createHealthRouter };
