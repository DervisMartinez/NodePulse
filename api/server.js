require('dotenv').config();
const { createPool } = require('./db');
const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const pool = createPool();
const app = createApp(pool);

app.listen(port, () => {
  console.log(`[api] FACYT Monitoreo API escuchando en puerto ${port}`);
});
