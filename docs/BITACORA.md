# Bitácora de Incidentes — CAO503

Registrar cada incidente detectado con evidencia real de la terminal.

---

## Plantilla por incidente

```markdown
## Incidente N — <título corto>
- Detectado por / hora:
- Síntoma observado: (qué se veía, qué servicio, qué mensaje exacto)
- Comandos de diagnóstico: (los comandos ejecutados, en orden, con su salida recortada a las líneas relevantes; copiada de la terminal, no reescrita)
- Causa raíz: (archivo, línea y hash del commit que la introdujo)
- Por qué ocurrió: (explicación con sus palabras)
- Solución: (rama, hash del commit de la corrección y número del Pull Request)
- Verificación: (cómo comprobaron que quedó resuelto)
- Participantes:
- Declaración de uso de IA:
```

## Incidente 4 — Merge no autorizado de develop a main ("Mantenimiento General") tumba producción
- Detectado por / hora: Angel Navas, 2026-11-24 19:47. (El merge ocurrió a las 15:06:34 -0500.)
- Síntoma observado: main, que es la rama de producción, recibió sin revisión todo el contenido de develop, incluidos los cambios defectuosos de los PR #18 y #19 (Incidente 1). Como el resto de las ramas dependen de main, el fallo se propagó a todo el proyecto: la base de datos no recibe su clave, la api no conecta con la base, el worker no arranca, los .sh fallan en Linux.
- Comandos de diagnóstico:
```sh
$ docker compose up --build -d
WARN[0000] The "DB_PASS" variable is not set. Defaulting to a blank string.
...
 ✘ Container monitoreo_api       Error dependency api failed to start                                                                             117.7s
 ✘ Container monitoreo_web       not started: condition "service_healthy" of service "api" not met                                                  8.0s
 ✘ Container monitoreo_collector not started: condition "service_healthy" of service "api" not met                                                  9.1s
 ✘ Container monitoreo_worker    not started: condition "service_healthy" of service "api" not met                                                 11.5s
 ✘ Container monitoreo_gateway   not started: condition "service_healthy" of service "api" not met                                                  6.4sdependency failed to start: container monitoreo_api is unhealthy
```
```sh
$ git show 4b42e5f
commit 4b42e5f3f7ab6d8e79c3b54163889f213305a797 (HEAD -> main, origin/main, origin/HEAD)
Merge: 9b10eee 00edf2a
Author: SantiDev28
Date:   Tue Nov 24 15:06:34 2026 -0500

    Mantenimiento General

```
```sh
$ git log --oneline --graph main
*   4b42e5f (HEAD -> main, origin/main, origin/HEAD) Mantenimiento General
|\  
| * 00edf2a Reorganiza el RUNBOOK
| * 4ca1178 Actualiza rutas verificadas en el healthcheck
| * 08dc79d Simplifica el formato de tiempos relativos
| * 9b45f85 Afina la detección de nodos activos
| * 38be6fc Ajusta el cálculo de espera entre reintentos
| * 974b6ab Unifica la escala de las métricas de memoria
```
```sh
$ git diff 9b10eee 4b42e5f --stat
 .env.example                             |   5 ++
 .gitattributes                           |   2 +-
 .github/ISSUE_TEMPLATE/feature.md        |  17 ++++
 .github/ISSUE_TEMPLATE/incidente.md      |  18 ++++
 .github/pull_request_template.md         |  18 ++++
 CHANGELOG.md                             |  25 ++++++
 CONTRIBUTING.md                          |  61 ++++++++++++++
 api/routes/nodes.routes.js               |   2 +-
 api/routes/tasks.routes.js               |  63 +++++++++++++-
 api/tests/api.test.js                    |  60 ++++++++++++++
 collector/index.js                       |   4 +-
 db/init.sql                              |   6 +-
 db/migrations/002_memory_limit.sql       |   5 ++
 docker-compose.yml                       |   7 +-
 docs/NodePulse Proyecto Git y Docker.pdf | Bin 0 -> 231309 bytes
 docs/RUNBOOK.md                          | 138 +++++++++++++++++++------------
 docs/Tareas por Puesto.pdf               | Bin 0 -> 283572 bytes
 gateway/Dockerfile                       |   1 +
 gateway/entrypoint.sh                    |   2 +-
 gateway/html/50x.html                    |  11 +++
 gateway/html/error.json                  |   1 +
 gateway/nginx.conf                       |  58 +++++++++++++
 scripts/clean-clone-test.sh              |  50 +++++++++++
 scripts/evidencia.sh                     |  30 +++++++
 scripts/healthcheck.sh                   |   2 +-
 scripts/reset.sh                         |  26 ++++++
 scripts/smoke-test.mjs                   |  29 +++++++
 web/src/App.tsx                          |  87 +++++++++++++++++--
 web/src/components/MetricsChart.tsx      |  52 ++++++++++++
 web/src/styles/design-system.css         |  63 ++++++++++++++
 web/src/utils/api-client.ts              |   7 ++
 web/src/utils/chart.test.ts              |  24 ++++++
 web/src/utils/chart.ts                   |  25 ++++++
 web/src/utils/format.test.ts             |  30 +++++++
 web/src/utils/format.ts                  |  23 ++++++
 worker/.dockerignore                     |   2 +
 worker/Dockerfile                        |   1 +
 worker/index.js                          |  45 +++++++++-
 worker/lib/retry.js                      |  16 +++-
 worker/package.json                      |   3 +-
 worker/test/retry.test.js                |  62 ++++++++++++++
 41 files changed, 1001 insertions(+), 80 deletions(-)
```
- Causa raíz: commit de merge 4b42e5f ("Mantenimiento General", autor SantiDev28), que unió develop (00edf2a) con main (9b10eee). El problema tiene dos niveles:
  1. El merge de develop a main se hizo de forma no autorizada.
  2. Ese merge llevó a main los cambios defectuosos que ya estaban en develop: los commits 757b179 y 0d61375 (docker-compose.yml, .gitattributes y worker/.dockerignore, ver Incidente 1) asi como el commit 4972da6 (api/Dockerfile, api/server.js, api/routes/*.js, ver Incidente 2).
- Por qué ocurrió: El mensaje "Mantenimiento General" hizo que el cambio pareciera rutinario, y develop no estaba estable cuando se fusionó. Sin revisión, nadie detectó que se promovían a producción cambios defectuosos.
- Solución: Se creo una rama `hotfix/angel-incidentes-main` donde se hizo el commit 82221cf. Se utilizo `git revert -m 1 4b42e5f` o si se restauró main a 9b10eee. No se reescribió la historia (sin push --force).
- Verificación: `git diff 9b10eee HEAD` vacío en lo que no debía cambiar; se levantó todo con Docker, los 6 servicios quedaron sanos, scripts/healthcheck.sh pasó, npm test de la API pasó N de N.
- Participantes: Angel Navas. Revisión: Angel Navas.
- Declaración de uso de IA: Se usó IA (Claude) como apoyo en la redacción del reporte. El diagnóstico, la corrección y las pruebas los realizó el equipo y se revisaron antes de subirlos.