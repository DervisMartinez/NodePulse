const express = require('express');
const { createHealthRouter } = require('./routes/health.routes');
// TODO: importar rutas de nodes, tasks y middlewares

function createApp(db) {
  const app = express();

  app.use('/api', createHealthRouter(db));
  app.use('/api', nodesRouter);

  // TODO: registrar notFoundHandler y errorHandler
  return app;
}

module.exports = { createApp };
