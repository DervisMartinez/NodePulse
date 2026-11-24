# Base de datos: esquema y datos de prueba

Esta carpeta contiene el SQL de la base de datos PostgreSQL del proyecto.

| Archivo | Para qué sirve | ¿Se ejecuta solo? |
|---|---|---|
| `init.sql` | Esquema: tablas e índices | Sí, en el primer arranque del contenedor |
| `seed.sql` | Datos de ejemplo para probar el panel | No, manual |

> `seed.sql` es **solo para desarrollo**. No debe ejecutarlo en producción.

Ambos requieren que el esquema ya exista (el contenedor ya levantado con `init.sql` aplicado).

## Cómo ejecutar un script

Con los contenedores arriba, desde la raíz del repositorio:

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/seed.sql
```

Las variables `$POSTGRES_USER` y `$POSTGRES_DB` se leen dentro del contenedor, así que no hace falta
tenerlas en tu shell. Si el servicio de Postgres no se llama `db` en `docker-compose.yml`, cambia el nombre.

---

## `seed.sql`: datos de ejemplo para el panel

Carga un conjunto pequeño y coherente que cubre todos los estados que el panel debe mostrar.

### Qué crea

| Tabla | Filas | Detalle |
|---|---|---|
| `nodes` | 7 | `node-alpha` … `node-golf`: 3 `healthy`, 2 `degraded`, 2 `disconnected` |
| `node_metrics` | 1.260 | 180 muestras por nodo, una cada 20 s (1 hora de historial) |
| `tasks` | 15 | `COMPLETED`, `RUNNING`, `PENDING` (nuevas y en reintento) y `FAILED` (reintentos agotados) |
| `incident_audit` | 7 | Incidentes de `monitor`, `worker` y `api` |

Los valores de `last_seen_at` y los tiempos de tareas e incidentes son relativos a `NOW()`, por lo que
cada carga se ve actualizada.

### Idempotencia

Se puede ejecutar varias veces:

- Los nodos se actualizan por `name` (`UPSERT`).
- Se borran y recrean las métricas de esos 7 nodos.
- Las tareas e incidentes de ejemplo se identifican con `"seed": true` en `payload` / `metadata`; se borran
  y recrean sin tocar datos reales.

Todo corre dentro de una transacción: si algo falla, no queda nada a medias.

### Cosas a tener en cuenta

- Las tareas `PENDING` del seed pueden ser tomadas por el worker si está corriendo. Es lo esperado
  para probar la cola.
- Los nodos de ejemplo no envían métricas reales, así que con el paso del tiempo el monitor puede
  marcarlos como `disconnected`.

### Limpieza

```sql
DELETE FROM nodes WHERE name IN ('node-alpha','node-bravo','node-charlie','node-delta',
                                 'node-echo','node-foxtrot','node-golf');  -- borra sus métricas (CASCADE)
DELETE FROM tasks WHERE payload @> '{"seed": true}';
DELETE FROM incident_audit WHERE metadata @> '{"seed": true}';
```

---

## Buenas prácticas

- No mover `seed.sql` a la carpeta que Postgres monta en `/docker-entrypoint-initdb.d`:
  todo lo que esté ahí se ejecuta automáticamente al crear el contenedor.
- No incluir credenciales, hostnames reales ni datos de usuarios en estos scripts.