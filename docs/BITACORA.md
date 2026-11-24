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
