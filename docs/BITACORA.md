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
