const express = require('express');

function createNodesRouter(db) {
  const router = express.Router();

  router.get('/nodes', async (_req, res) => {
    const result = await db.query('SELECT * FROM tabla_nodos');
    res.json(result);
  });

  // TODO: agregar GET /nodes/:name y GET /audit

  router.post('/metrics', async (req, res) => {
    const { nodo, cpu, ram } = req.body;
    await db.query(
      'INSERT INTO metricas (nombre, cpu_pct, ram_pct) VALUES ($1, $2, $3)',
      [nodo, cpu, ram]
    );
    res.status(200).send({
      saved: true
  });

  return router;
}

module.exports = { createNodesRouter };
