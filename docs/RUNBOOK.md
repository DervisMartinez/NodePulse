# Runbook — Sistema de Monitoreo de Nodos y Cola de Tareas (CAO503)

## 1. Arranque desde cero

    cp .env.example .env
    docker compose up --build -d
    docker compose ps

Acceso único a través del gateway:
- Web: http://localhost:8080/
- API Health: http://localhost:8080/api/health

## 2. Formato de datos acordado

### Métricas (POST /api/metrics enviado por collector)

    {
      "name": "nodo-facyt-01",
      "hostname": "collector-container",
      "cpuPercent": 12.5,
      "memoryPercent": 41.2,
      "memoryLimitMb": 128,
      "loadAvg": 0.35,
      "uptimeSeconds": 1840,
      "status": "healthy"
    }

- memoryLimitMb: entero en megabytes leído desde cgroup v2 (/sys/fs/cgroup/memory.max), o null si el contenedor no tiene límite configurado.

### Tareas (POST /api/tasks)

    {
      "title": "Procesar lote de sensores",
      "maxRetries": 3,
      "payload": {
        "shouldFail": false
      }
    }

### Respuesta uniforme de errores (api/middleware/errorHandler.js)

    {
      "success": false,
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Descripción clara del error"
      }
    }

## 3. Verificación y pruebas

    # Verificar los 6 servicios y rutas por el gateway
    bash scripts/healthcheck.sh

    # Ejecutar pruebas dentro del contenedor de la API
    docker compose exec api npm test

    # Prueba de humo end-to-end
    node scripts/smoke-test.mjs

## 4. Comandos rápidos de diagnóstico

- Ver estado y salud de contenedores: docker compose ps
- Ver logs de un servicio: docker compose logs -f --tail=50 api
- Verificar persistencia en PostgreSQL tras docker compose down && docker compose up -d:
  docker compose exec db psql -U monitor_user -d monitor_db -c "SELECT COUNT(*) FROM nodes; SELECT COUNT(*) FROM tasks; SELECT COUNT(*) FROM incident_audit;"

## 5. Variables de entorno nuevas (v1.1)

Asegúrate de actualizar tu .env desde .env.example cuando se integren las features de cada servicio:
- COLLECTOR_MEMORY_SOURCE: fuente de lectura de memoria en collector (cgroup u os).
- TASK_STALE_MS: tiempo límite en milisegundos para considerar atascada una tarea en PROCESSING (por ejemplo, 60000, usado por api).
- WORKER_BACKOFF_MS: base en milisegundos para la espera exponencial de reintentos en worker (por ejemplo, 1000).

## 7. Diagrama de las dos redes de Docker

Los servicios están aislados en dos redes (frontal y datos); api es el único servicio conectado a ambas:

    [Usuario / Navegador :8080]
                 |
                 v
          +-------------+
          |   gateway   |  (Nginx, único puerto expuesto: 8080)
          +-------------+
            |         |
       red: frontal   |
      +-----+----+    |
      |          |    |
      v          v    v
    +-----+  +-----------+  +-----+
    | web |  | collector |  | api |  <-- único puente entre frontal y datos
    +-----+  +-----------+  +-----+
                               |
                          red: datos
                         +-----+----+
                         |          |
                         v          v
                      +----+    +--------+
                      | db |    | worker |
                      +----+    +--------+
