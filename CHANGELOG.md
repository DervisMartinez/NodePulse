# Registro de cambios (CHANGELOG)

## [1.1.0] - En desarrollo

### Agregado
- *docs (Alumno 8 - Bryan Mirabal):* Crea CHANGELOG.md, CONTRIBUTING.md, plantilla de Pull Request (.github/pull_request_template.md), plantillas de issue (.github/ISSUE_TEMPLATE/) y actualiza docs/RUNBOOK.md (#8).
- *scripts (Alumno 7 - Jean Santamaria):* Crea `scripts/reset.sh`, `scripts/evidencia.sh` y `scripts/clean-clone-test.sh` con limpieza automática mediante `trap` (#1).
- *gateway (Alumno 6 - Teoban Rondon):* Endurece el proxy con cabeceras de seguridad HTTP, rate limiting en /api/ (10 req/s, burst 20, codigo 429), logs JSON, paginas de error personalizadas 502/503, cache de estaticos y optimizacion Gzip (-47.76% payload) (#3).
- *db (Alumno 1 - Angel Navas):*: Crea `db/migrations/002_memory-limit.sql` (#16).
- *web (Alumno 4 - Luis Guerrero):* Muestra el límite de memoria por nodo, último reporte en tiempo relativo, filtro de tareas por estado, botón para reencolar tareas atascadas y vista de detalle con gráfico de métricas (#5).

### Cambiado
- *worker (Alumno 2 - Jesus Hernandez):* Implementa backoff exponencial en `lib/retry.js` (`calculateBackoff`): espera `WORKER_BACKOFF_MS × 2^(intento-1)` con tope de 30 s antes de reencolar una tarea fallida. Agrega log `"reencolando en X ms"` en `index.js`. Implementa apagado ordenado ante `SIGTERM`: el worker termina la tarea en curso antes de salir. El contenedor ahora corre como usuario sin privilegios (`USER node` en Dockerfile). Agrega variable `WORKER_BACKOFF_MS` al entorno. Incluye pruebas unitarias de `lib/retry.js` con `node --test` (#14).
- *scripts (Alumno 7 - Jean Santamaria):* Amplía `scripts/smoke-test.mjs` con espera (polling) para verificar que el `worker` complete las tareas creadas (#1).
- *db (Alumno 1 - Angel Navas):* Modifica la base de datos en `db/init.sql` para agregar la columna `memory_limit_mb` en las tabla `node` y `node_metrics` (#16).

### Corregido

- *scripts (Alumno 7 - Jean Santamaria):* Restaura finales de línea `LF` para `*.sh` en `.gitattributes` y corrige variables de entorno (`POSTGRES_PASSWORD`) y red `frontal` de `api` en `docker-compose.yml` (#23).

- *compose (Alumno 4 - Luis Guerrero):* Corrige los cambios de los PR #18 y #19: restaura `POSTGRES_PASSWORD` en el servicio db, vuelve a conectar la api a la red `datos`, deja los `.sh` con finales de línea LF y vuelve a incluir `lib` en la imagen del worker (#21).


## [1.0-base] - Base inicial

### Agregado
- Arquitectura base de monitoreo de nodos y cola de tareas con 6 servicios en Docker (db, api, worker, collector, web, gateway).
- Esquema inicial de PostgreSQL (db/init.sql), panel web en React y proxy inverso Nginx en el puerto 8080.
- Documentación operativa inicial (docs/RUNBOOK.md), plantilla de bitácora (docs/BITACORA.md) y scripts de verificación (scripts/healthcheck.sh, scripts/smoke-test.mjs).