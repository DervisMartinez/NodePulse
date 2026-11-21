# Sistema de Monitoreo de Nodos y Cola de Tareas

**Universidad de Carabobo — FACYT — Departamento de Computación**  
**Taller de Sistemas Operativos (CAO503) · Simulación Git y Docker**

Sistema distribuido en contenedores para vigilar métricas de nodos de cómputo y procesar tareas asíncronas en cola.

## Servicios

| Servicio | Carpeta | Función |
| :--- | :--- | :--- |
| `db` | `db/` | PostgreSQL 16 con esquema inicial (`init.sql`) y volumen `postgres_data`. |
| `api` | `api/` | API REST en Express (`routes/`, `middleware/`, `tests/`). |
| `worker` | `worker/` | Consumidor de cola con reintentos configurables (`WORKER_MAX_RETRIES`). |
| `collector` | `collector/` | Recolector de métricas del SO (`CPU`, `RAM`, `load`, `uptime`). |
| `web` | `web/` | Panel React + Vite compilado a estáticos en Nginx. |
| `gateway` | `gateway/` | Proxy inverso Nginx (único puerto expuesto al anfitrión). |
| Utilidades | `scripts/`, `docs/` | Verificación de salud, pruebas de humo, runbook y bitácora. |

## Preparación del entorno (Día 0)

Requisitos: Git, Docker Desktop (o Docker Engine con Compose v2) y una terminal Bash (en Windows, Git Bash).

1. Clonar el repositorio y entrar en la carpeta:
   ```bash
   git clone <url-del-repositorio> NodePulse
   cd NodePulse
   ```
2. Crear el archivo de entorno local a partir de la plantilla:
   ```bash
   cp .env.example .env
   ```
3. Editar `.env` y cambiar `POSTGRES_PASSWORD` por una clave propia. El archivo `.env` nunca se sube a Git.
4. Construir y levantar los servicios (la primera vez tarda ~5 min mientras descarga imágenes y dependencias):
   ```bash
   docker compose up --build -d
   ```
5. Comprobar el estado hasta que los 6 servicios aparezcan como `healthy`:
   ```bash
   docker compose ps
   ```
6. Ejecutar la verificación integral hasta ver `SISTEMA SANO`:
   ```bash
   bash scripts/healthcheck.sh
   ```

> Si no existe `.env` (o falta `POSTGRES_PASSWORD`), `docker compose` se detiene antes de crear contenedores con el mensaje:
> `required variable POSTGRES_PASSWORD is missing a value: Falta POSTGRES_PASSWORD: copia .env.example a .env`

## Arranque rápido

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

- **Panel Web (vía Gateway):** `http://localhost:8080`
- **Healthcheck API (vía Gateway):** `http://localhost:8080/api/health`
- **Pruebas dentro del contenedor API:** `docker compose exec api npm test`
- **Verificación integral:** `bash scripts/healthcheck.sh`
