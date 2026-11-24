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
