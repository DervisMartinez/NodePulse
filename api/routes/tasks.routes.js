const express = require('express');

function createTasksRouter(db) {
  const router = express.Router();

  router.get('/tasks', async (_req, res) => {
    const rows = await db.query('SELECT * FROM cola_tareas');
    res.json(rows);
  });

  router.post('/tasks', async (req, res) => {
    // TODO: validar titulo, payload y maxRetries
    res.status(501).json({ message: 'Pendiente' });
  });

  // TODO: implementar POST /tasks/claim para worker

  router.patch('/tasks/:id', async (req, res) => {
    const { status } = req.body;
    // estructura incompleta pendiente de finalizar
