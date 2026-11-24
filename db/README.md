# Base de datos: esquema y datos de prueba

Esta carpeta contiene el SQL de la base de datos PostgreSQL del proyecto.

| Archivo | Para qué sirve | ¿Se ejecuta solo? |
|---|---|---|
| `init.sql` | Esquema: tablas e índices | Sí, en el primer arranque del contenedor |
| `seed.sql` | Datos de ejemplo para probar el panel | No, manual |
| `bulk.sql` | Datos sintéticos masivos para medir con `EXPLAIN` | No, manual |

> `seed.sql` y `bulk.sql` son **solo para desarrollo**. No ejecutarlos en producción.

Ambos requieren que el esquema ya exista (el contenedor ya levantado con `init.sql` aplicado).

## Cómo ejecutar un script

Con los contenedores arriba, desde la raíz del repositorio:

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/seed.sql
```

Las variables `$POSTGRES_USER` y `$POSTGRES_DB` se leen dentro del contenedor, así que no hace falta
tenerlas en tu shell. Si el servicio de Postgres no se llama `db` en `docker-compose.yml`, cambia el nombre.

Para usar otro script, reemplaza `db/seed.sql` por `db/bulk.sql`.

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

## `bulk.sql`: volumen para medir planes con EXPLAIN

El seed es demasiado pequeño para evaluar índices: con tablas de pocas filas, Postgres elige `Seq Scan`
aunque el índice exista. `bulk.sql` genera volumen para que las diferencias de plan sean visibles.

### Qué crea

| Tabla | Filas | Detalle |
|---|---|---|
| `nodes` | 20 | `bulk-01` … `bulk-20` (hostnames `*.lab.local`) |
| `node_metrics` | 1.000.000 | 50.000 por nodo, una por segundo hacia atrás desde `now()` |
| `tasks` | 500.000 | ~99 % `COMPLETED`/`FAILED`, ~490 `PENDING`, 10 `RUNNING` |
| `incident_audit` | 500.000 | Repartidos en `api`, `worker`, `db` y `monitor` |

Las filas de `tasks` e `incident_audit` llevan `"seed_bulk": true`, y los nodos usan el prefijo `bulk-`,
así que no se mezclan con los datos de `seed.sql`.
Al final se ejecuta `ANALYZE` sobre las cuatro tablas.

### Antes de ejecutarlo

- **No es idempotente.** Ejecutarlo dos veces duplica las métricas, tareas e incidentes. Limpia primero
  (ver más abajo).
- **Detén el worker** (`docker compose stop worker`, o el nombre de tu servicio). Las tareas `PENDING` de
  `bulk.sql` son falsas y el worker intentaría ejecutarlas.
- **Los nodos `bulk-*` aparecen en el panel** como nodos reales. Límpialos al terminar de medir.
- Tarda de unos segundos a un par de minutos y ocupa cientos de MB, según la máquina.

### Cómo medir

Ejecuta cada consulta dos veces y compara la segunda ejecución:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT node_id, avg(cpu_percent), max(memory_percent)
FROM node_metrics
WHERE recorded_at >= now() - interval '10 minutes'
GROUP BY node_id;
```

Para comparar antes y después de un índice: ejecutar las consultas, crear el índice, correr `ANALYZE`
sobre la tabla y volver a ejecutar las mismas consultas.

Los datos se generan con `now()` y van quedando "viejos". Si repites la medición días después, vuelve a
cargar el volumen o usa una ventana de tiempo fija.

### Limpieza

```sql
DELETE FROM nodes WHERE name LIKE 'bulk-%';   -- borra sus métricas (ON DELETE CASCADE)
DELETE FROM tasks WHERE payload @> '{"seed_bulk": true}';
DELETE FROM incident_audit WHERE metadata @> '{"seed_bulk": true}';
VACUUM ANALYZE;
```

---

## Buenas prácticas

- No mover `seed.sql` ni `bulk.sql` a la carpeta que Postgres monta en `/docker-entrypoint-initdb.d`:
  todo lo que esté ahí se ejecuta automáticamente al crear el contenedor.
- No incluir credenciales, hostnames reales ni datos de usuarios en estos scripts.
- Si agregas un índice nuevo, adjunta en el PR el `EXPLAIN` antes y después usando `bulk.sql`.