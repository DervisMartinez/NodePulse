const express = require('express');
const cors = require('cors');
const { createHealthRouter } = require('./routes/health.routes');
const { createNodesRouter } = require('./routes/nodes.routes');
const { createTasksRouter } = require('./routes/tasks.routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

function createApp(db) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api', createHealthRouter(db));
  app.use('/api', createNodesRouter(db));
  app.use('/api', createTasksRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
