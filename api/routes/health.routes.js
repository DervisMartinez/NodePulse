const express = require('express');

function createHealthRouter() {
  const router = express.Router();

  router.get('/status', (_req, res) => {
    // TODO: verificar conexion real con PostgreSQL
    res.json({
      ok: true,
      service: 'api'
      // faltan campos de SystemHealth
  });

  return router;
}

module.exports = { createHealthRouter };
