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

---

## Incidente 1 — PR #18 y #19 rompen el sistema
- Detectado por / hora: Luis Guerrero, 2026-11-24 15:55.
- Síntoma observado: después de los PR #18 y #19, fusionados sin revisión, la base de datos no recibe su clave, la api no se conecta a la base, el worker no arranca y los scripts .sh dejan de funcionar en Linux.
- Comandos de diagnóstico: git log y git diff sobre develop para ver qué cambió esos PR.
- Causa raíz: commits 757b179 y 0d61375.
  - docker-compose.yml: la clave de postgres usa una variable que no existe (DB_PASS) y la api salió de la red datos.
  - .gitattributes: los .sh pasaron a CRLF.
  - worker/.dockerignore: se excluyó la carpeta lib que el worker necesita.
- Por qué ocurrió: los cambios parecían de mantenimiento y nadie los revisó antes de fusionarlos.
- Solución: rama fix/luis-sabotaje-develop, PR #22, que deja esas cuatro líneas como estaban.
- Verificación: se levantó todo con Docker, los 6 servicios quedaron sanos y scripts/healthcheck.sh pasó.
- Participantes: Luis Guerrero. Revisión: Angel Navas y Luisa Legoni.
- Declaración de uso de IA: Se usó IA (Claude) como apoyo en el diagnóstico, la corrección y la redacción. Todo se revisó y se probó antes de subirlo.

## Incidente 2 — Commit en feature/luisana-api reemplaza la API por un esqueleto que no compila
- Detectado por / hora: Luisa Legoni, 2026-11-22 14:59.
- Síntoma observado: en mi rama feature/luisana-api apareció un commit que no era mío. La API quedaba sin poder construirse ni arrancar: errores de sintaxis en las rutas y en server.js, el Dockerfile copiaba carpetas que no existen y se borraron casi todas las pruebas y el package-lock.json.
- Comandos de diagnóstico:
  ```
  $ git show --stat 4972da6
  4972da6  Dervis Martinez   Sat Nov 21 23:12:13 2026 -0400
  chore(api): reorganiza estructura modular de rutas y configuracion inicial
   api/Dockerfile | 20 +-   api/server.js | 12 +-   api/package-lock.json | 1027 ---
   ... 13 files changed, 68 insertions(+), 1864 deletions(-)

  $ git branch -r --contains 4972da6
    origin/feature/luisana-api

  $ node --check <archivo>
  SyntaxError en api/routes/health.routes.js:15, nodes.routes.js:24, tasks.routes.js:21, server.js:10
  ```
- Causa raíz: commit 4972da6.
  - api/Dockerfile línea 5: copia src/, que no existe, y deja de copiar db.js, app.js, server.js, routes y middleware.
  - api/server.js: usa el puerto 4000 y app.start(), que no existe.
  - api/routes/*.js: código incompleto (TODO) con errores de sintaxis; /health pasa a /status, así que el healthcheck fallaría.
- Por qué ocurrió: el commit se subió directamente a mi rama, que no tiene protección, sin Pull Request ni revisión. Su mensaje (chore: reorganiza estructura) lo hacía parecer un cambio legítimo.
- Solución: revert en mi rama feature/luisana-api, commit 0e1ed29 («Revierte el commit 4972da6 que rompia la API»), que llegó a develop con el PR #6.
- Verificación: git diff 9b10eee HEAD -- api docker-compose.yml .env.example quedó vacío (la API volvió a ser idéntica a la original); npm test de la API pasó 8 de 8.
- Participantes: Luisa Legoni.
- Declaración de uso de IA: Se usó IA (Claude) como apoyo en el diagnóstico y la redacción. El revert lo hice yo y lo probé antes de subirlo.

## Incidente 3 — Fuga de secretos: api/.env.backup subido a feature/luisana-api
- Detectado por / hora: Luisa Legoni, 2026-11-24 16:35.
- Síntoma observado: en mi rama feature/luisana-api (y por lo tanto en el PR #17) apareció un commit que no era mío, de un autor «Mantenimiento Lab», que subía api/.env.backup con la URL de la base de datos con su clave y un API_TOKEN.
- Comandos de diagnóstico:
  ```
  $ git log --format="%h %an <%ae> %ad | %s" origin/feature/luisana-api
  5eb07b5 Mantenimiento Lab <mantenimiento.lab@nodepulse.invalid> Tue Nov 24 14:25:36 2026 -0500 | Agrega respaldo de la configuración local de la API

  $ git show 5eb07b5 -- api/.env.backup
  +# Respaldo de la configuración local de la API
  +DATABASE_URL=postgresql://monitor_user:<clave>@db:5432/monitor_db
  +API_TOKEN=<token>                    (valores ocultos aquí para no volver a publicarlos)

  $ git branch -r --contains 5eb07b5
    origin/feature/luisana-api

  $ git check-ignore -v api/.env.backup
  (sin salida: .gitignore no lo excluía)
  ```
- Causa raíz: commit 5eb07b5 (api/.env.backup, 3 líneas). El .gitignore solo excluía .env, .env.local y .env.*.local, así que .env.backup se podía subir.
- Por qué ocurrió: el commit llegó directamente a mi rama, que no tiene protección, con un autor falso (dominio .invalid y otra zona horaria) y un mensaje de mantenimiento que lo hacía parecer legítimo. Un archivo de configuración con secretos nunca debe estar en el repositorio.
- Solución:
  - Angel Navas lo revirtió en feature/luisana-api: 071a53a (borra el archivo), c43c821 y 451f912 (revert de 5eb07b5).
  - Commit 4174c96 en feature/luisana-api: el .gitignore excluye .env.* (salvo .env.example) y *.backup.
  - No se reescribió la historia (sin push --force): el secreto sigue visible en el historial, así que el API_TOKEN se considera comprometido y debe rotarse.
  - Todo llegó a develop con el PR #17. Explicación del incidente en un comentario del PR #17.
- Verificación: api/.env.backup ya no existe en la rama; git check-ignore -v api/.env.backup → .gitignore:12:*.backup (ahora se ignora); .env.example sigue versionado; npm test de la API pasó 15 de 15.
- Participantes: Luisa Legoni. Revert: Angel Navas.
- Declaración de uso de IA: Se usó IA (Claude) como apoyo en el diagnóstico, la corrección del .gitignore y la redacción. Todo se revisó y se probó antes de subirlo.

## Incidente 4 — Merge no autorizado de develop a main ("Mantenimiento General") tumba producción
- Detectado por / hora: Angel Navas (Alumno 1 · Base de Datos), 2026-11-24 16:50.
- Síntoma observado: Tras el commit `4b42e5f` («Mantenimiento General») inyectado directamente en `main`, el entorno de producción fallaba en el arranque de la base de datos y la comunicación de servicios.
- Comandos de diagnóstico:
  $ git log -n 5 --oneline main
  4b42e5f Merge branch 'develop' into main (Mantenimiento General)
  00edf2a Reorganiza el RUNBOOK
  $ docker compose ps
- Causa raíz: Commit `4b42e5f` fusionado sin revisión en `main` que introdujo modificaciones no autorizadas en la configuración del clúster y dependencias.
- Por qué ocurrió: Fusión directa en la rama protegida `main` sin pasar por revisión de código en Pull Request ni validación de pruebas automatizadas.
- Solución: Hotfix mediante rama `hotfix/angel-incidentes-main` (PR #31) que revirtió el merge defectuoso en `main`.
- Verificación: `docker compose up --build -d` y ejecución de `scripts/healthcheck.sh` con salida exitosa de servicios y pruebas de integridad.
- Participantes: Angel Navas. Revisión: Equipo NodePulse.
- Declaración de uso de IA: Se usó IA como apoyo en el diagnóstico de los commits en producción y redacción del reporte.

## Incidente 5 — Fallo de arranque en contenedor Gateway por finales de línea CRLF en entrypoint.sh
- Detectado por / hora: Teoban Rondón (Alumno 6 · Gateway), 2026-11-24 16:10.
- Síntoma observado: Al levantar el entorno con `docker compose up -d --build`, el contenedor `gateway` entraba en bucle de reinicio (Restarting 127). En los logs se observaba el error: `monitoreo_gateway | exec /entrypoint.sh: no such file or directory`.
- Comandos de diagnóstico:
  $ docker compose ps gateway
  NAME                 IMAGE               COMMAND                  SERVICE   STATUS
  monitoreo_gateway    nodepulse-gateway   "/entrypoint.sh ngin…"   gateway   Restarting (127)

  $ docker compose logs gateway --tail 5
  monitoreo_gateway | exec /entrypoint.sh: no such file or directory

  $ file gateway/entrypoint.sh
  gateway/entrypoint.sh: POSIX shell script, ASCII text executable, with CRLF line terminators
- Causa raíz: Commits 047f9b9 y 0d61375 («Ajusta la construcción y los finales de línea para Windows») por SantiDev28. En .gitattributes se forzó `*.sh text eol=crlf` y se introdujeron retornos de carro de Windows (`\r\n`) en gateway/entrypoint.sh.
- Por qué ocurrió: Al ejecutarse dentro del contenedor Linux (Alpine), el kernel busca el intérprete `/bin/sh\r` en vez de `/bin/sh`, el cual no existe en el sistema operativo. Además, la caché local de Docker retenía la imagen construida con el archivo saboteado.
- Solución: Normalización de finales de línea a Unix (LF) con `sed -i 's/\r$//' gateway/entrypoint.sh`, corrección en .gitattributes a `*.sh text eol=lf` y reconstrucción limpia de la imagen con `docker compose build gateway`.
- Verificación: scripts/healthcheck.sh pasó completo con «SISTEMA SANO: Los 6 servicios responden correctamente»; curl a http://localhost:8080/gateway-health devuelve 200 OK con cabeceras de seguridad; prueba de carga a /api/nodes arrojó 24 respuestas 200 y 6 respuestas 429 confirmando el rate limit.
- Participantes: Teoban Rondón.
- Declaración de uso de IA: Se usó IA como apoyo en el diagnóstico de la codificación de caracteres en Linux y la verificación de las cabeceras HTTP.

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
- Solución: Se creo una rama `hotfix/angel-incidentes-main` donde se hizo el commit 82221cf. Se utilizo `git revert -m 1 4b42e5f`. No se reescribió la historia (sin push --force).
- Verificación: `git diff 9b10eee HEAD` vacío en lo que no debía cambiar; se levantó todo con Docker, los 6 servicios quedaron sanos, scripts/healthcheck.sh pasó, npm test de la API pasó N de N.
- Participantes: Angel Navas. Revisión: Angel Navas.
- Declaración de uso de IA: Se usó IA (Claude) como apoyo en la redacción del reporte. El diagnóstico, la corrección y las pruebas los realizó el equipo y se revisaron antes de subirlos.
