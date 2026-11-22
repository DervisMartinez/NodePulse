const { createPool } = require('./db');
const { createApp } = require('./app');

const port = Number(process.env.API_PORT) || 4000;
const app = createApp();

app.start(port, () => {
  console.log(`API escuchando en ${port}`);
// TODO: completar cierre de servidor
