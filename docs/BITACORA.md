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

## Incidente 1 — PR #18 y #19 rompen db, api, worker y gateway
- Detectado por / hora: Luis Guerrero (Alumno 4), 2026-11-24 15:55 (-04), al revisar develop antes de actualizar la rama.
- Síntoma observado: develop recibió los PR #18 y #19, fusionados por su autor sin revisión. Los commits de fondo tienen como autor "Mantenimiento Lab <mantenimiento.lab@nodepulse.invalid>". Con esos cambios postgres no recibe la clave, la api no llega a la base, el worker no encuentra `./lib/retry` y los `.sh` se bajan con CRLF.
- Comandos de diagnóstico:
  ```
  $ git log --format='%h %an <%ae> %s' origin/develop -5
  047f9b9 SantiDev28 <sjgdevtools@gmail.com> Ajusta la construcción y los finales de línea para Windows
  8827213 SantiDev28 <sjgdevtools@gmail.com> Reorganiza las redes y variables de la base de datos
  0d61375 Mantenimiento Lab <mantenimiento.lab@nodepulse.invalid> Ajusta la construcción y los finales de línea para Windows
  757b179 Mantenimiento Lab <mantenimiento.lab@nodepulse.invalid> Reorganiza las redes y variables de la base de datos

  $ git diff c1fdd98 origin/develop
  -      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?Falta POSTGRES_PASSWORD: copia .env.example a .env}"
  +      POSTGRES_PASSWORD: "${DB_PASS}"
  -      - datos
  -*.sh text eol=lf
  +*.sh text eol=crlf
  +lib

  $ git ls-files --eol gateway/entrypoint.sh
  i/lf    w/crlf  attr/text eol=crlf    	gateway/entrypoint.sh

  $ git show origin/develop:worker/index.js | grep require
  const { resolveMaxRetries, decideOutcome, calculateBackoff} = require('./lib/retry');
  ```
- Causa raíz:
  - `docker-compose.yml`, servicio db, `POSTGRES_PASSWORD: "${DB_PASS}"` (757b179). `DB_PASS` no existe; en `.env.example` se agregó `DB_PASSWORD`.
  - `docker-compose.yml`, servicio api, se quitó la red `datos` (757b179).
  - `.gitattributes`, línea 2, `*.sh text eol=crlf` (0d61375).
  - `worker/.dockerignore`, línea 5, `lib` (0d61375).
- Por qué ocurrió: los cambios entraron con títulos que parecían de mantenimiento y se fusionaron sin que nadie los revisara. develop no tiene protección de rama.
- Solución: rama `fix/luis-sabotaje-develop`, commits 0a1a560 (clave de postgres), 81abef7 (LF en `.sh`), 924b4e7 (`lib` en el worker) y b0ca875 (red `datos` en la api), PR #22.
- Verificación: `docker compose config -q` sin errores; `docker compose up -d --build` con los 6 contenedores en estado healthy; el worker arranca ("[worker] Iniciado (worker-01)"); `bash scripts/healthcheck.sh` con 12 pruebas pasadas y "SISTEMA SANO".
- Participantes: Luis Guerrero (Alumno 4). Revisión: Angel Navas (Alumno 1) y Luisa Legoni (Alumno 5).
- Declaración de uso de IA: (completar)
