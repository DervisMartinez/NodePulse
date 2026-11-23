# Guía de Contribución — NodePulse

Esta guía define el flujo de trabajo con Git, Docker y GitHub para todo el equipo de *NodePulse*.

## 1. Flujo de ramas

- main: versión estable y entregable. Solo recibe cambios mediante Pull Request aprobado desde develop o desde una rama hotfix/....
- develop: rama de integración del equipo. Todo el desarrollo diario parte y se integra aquí.
- feature/alumnoN-tarea (o feature/nombre-modulo): una rama por cada feature, creada siempre desde develop.
- fix/...: corrección de errores o incidentes sobre develop.
- hotfix/...: corrección urgente sobre main (que luego también debe llevarse a develop).

*Reglas obligatorias sobre ramas:*
- Nunca hagas commits directos ni push directo a main ni a develop.
- Prohibido usar git push --force o git reset --hard en ramas compartidas (main, develop o ramas de compañeros). Para deshacer un cambio compartido, usa git revert.
- Cada integrante modifica únicamente el Dockerfile de su servicio (si tiene) y su bloque en docker-compose.yml y .env.example.
- Nunca subas el archivo .env, contraseñas, tokens ni secretos al repositorio.

## 2. Formato de commits

Cada feature debe desarrollarse en *al menos tres commits atómicos*:
- Un cambio lógico por commit (evita mezclar cambios de módulos o tareas distintas en un solo commit).
- Usa un mensaje en *imperativo* que explique qué hace el cambio (por ejemplo: feat(api): agrega validación de memoryLimitMb, fix(worker): corrige espera exponencial, docs: actualiza diagrama de redes en RUNBOOK.md).

## 3. Cómo abrir y revisar un Pull Request

### Para abrir un Pull Request
1. Abre primero un *Issue* en GitHub usando las plantillas de .github/ISSUE_TEMPLATE/ (para feature o incidente).
2. Crea tu rama desde develop actualizada (git switch develop && git pull && git switch -c feature/...).
3. Desarrolla tus commits atómicos y agrega tu entrada en CHANGELOG.md dentro de [1.1.0].
4. Sube tu rama (git push -u origin <tu-rama>) y abre el Pull Request hacia develop.
5. Completa la plantilla .github/pull_request_template.md, incluye Closes #N (con el número de tu issue) y pega los comandos de prueba y su salida.

### Para revisar el Pull Request de tu pareja
Las parejas se revisan mutuamente (1 <-> 5, 2 <-> 6, 3 <-> 4, 7 <-> 8). Antes de aprobar:
1. Descarga la rama de tu pareja (git fetch origin && git switch <rama-de-tu-pareja>).
2. Levanta y prueba el sistema con Docker:

    docker compose up --build -d
    bash scripts/healthcheck.sh

3. Verifica que cumpla su tarea, no rompa los demás servicios y no incluya secretos.
4. Deja tus comentarios de prueba en GitHub y aprueba el PR cuando esté listo.

## 4. Qué hacer ante un conflicto

Si GitHub o Git indica un conflicto (muy frecuente en CHANGELOG.md porque todo el equipo lo edita):
1. Actualiza tu rama con lo último de develop:

    git fetch origin
    git merge origin/develop

2. Abre el archivo en conflicto y busca las marcas <<<<<<<, ======= y >>>>>>>.
3. *Nunca descartes trabajo ajeno:* entiende ambos cambios y combínalos (por ejemplo, manteniendo tanto las entradas de tus compañeros como la tuya en CHANGELOG.md).
4. Guarda el archivo sin dejar las marcas de conflicto, prueba que el sistema siga levantando con Docker y confirma la resolución:

    git add <archivo>
    git commit -m "chore: resuelve conflicto en <archivo> conservando cambios del equipo"
    git push

5. Si tienes dudas sobre cómo combinar un cambio, coordina primero con el autor de la otra entrada antes de hacer merge.
