# Registro de cambios (CHANGELOG)

Todos los cambios relevantes del proyecto *NodePulse* se documentan en este archivo.

Cada integrante debe agregar una breve entrada con su cambio en la sección [1.1.0] - En desarrollo dentro de su Pull Request. Al resolver conflictos de merge, *no borres las entradas de tus compañeros*.

## [1.1.0] - En desarrollo

### Agregado
- *docs (Alumno 8 - Bryan Mirabal):* Crea CHANGELOG.md, CONTRIBUTING.md, plantilla de Pull Request (.github/pull_request_template.md), plantillas de issue (.github/ISSUE_TEMPLATE/) y actualiza docs/RUNBOOK.md (#8).

### Cambiado
- (Agrega aquí tu entrada si modificas un comportamiento existente)

### Corregido
- (Agrega aquí tu entrada si corriges un bug o incidente)

## [1.0-base] - Base inicial

### Agregado
- Arquitectura base de monitoreo de nodos y cola de tareas con 6 servicios en Docker (db, api, worker, collector, web, gateway).
- Esquema inicial de PostgreSQL (db/init.sql), panel web en React y proxy inverso Nginx en el puerto 8080.
- Documentación operativa inicial (docs/RUNBOOK.md), plantilla de bitácora (docs/BITACORA.md) y scripts de verificación (scripts/healthcheck.sh, scripts/smoke-test.mjs).
