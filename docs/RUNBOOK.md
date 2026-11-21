# Runbook — Sistema de Monitoreo de Nodos y Cola de Tareas (CAO503)

## 1. Arranque desde cero

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Acceso único a través del `gateway`:
- Web: `http://localhost:8080/`
- API Health: `http://localhost:8080/api/health`

## 2. Formato de datos acordado

### Métricas (`POST /api/metrics` enviado por `collector`)
```json
{
  "name": "nodo-facyt-01",
  "hostname": "collector-container",
  "cpuPercent": 12.5,
  "memoryPercent": 41.2,
  "loadAvg": 0.35,
  "uptimeSeconds": 1840,
  "status": "healthy"
}
```

### Tareas (`POST /api/tasks`)
```json
{
  "title": "Procesar lote de sensores",
  "maxRetries": 3,
  "payload": {
    "shouldFail": false
  }
}
```

### Respuesta uniforme de errores (`api/middleware/errorHandler.js`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descripción clara del error"
  }
}
```

## 3. Verificación y pruebas

```bash
# Verificar los 6 servicios y rutas por el gateway
bash scripts/healthcheck.sh

# Ejecutar pruebas dentro del contenedor de la API
docker compose exec api npm test

# Prueba de humo end-to-end
node scripts/smoke-test.mjs
```

## 4. Comandos rápidos de diagnóstico

- Ver estado y salud de contenedores: `docker compose ps`
- Ver logs de un servicio: `docker compose logs -f --tail=50 api`
- Verificar persistencia en PostgreSQL tras `docker compose down && docker compose up -d`:
  `docker compose exec db psql -U monitor_user -d monitor_db -c "SELECT COUNT(*) FROM nodes; SELECT COUNT(*) FROM tasks; SELECT COUNT(*) FROM incident_audit;"`
