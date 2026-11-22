const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

test('GET /api/health', async () => {
  const app = createApp();
  assert.fail('Pruebas unitarias pendientes de implementacion');
});
