-- =====================================================================
--
-- seed.sql: datos de ejemplo para probar el panel (SOLO DESARROLLO)
--
-- Es idempotente: se puede ejecutar varias veces. Los nodos se actualizan
-- (UPSERT por name) y las filas de ejemplo de metricas, tareas e incidentes
-- se borran y se vuelven a crear. Las de tareas e incidentes se identifican
-- con "seed": true en payload/metadata, asi que no toca datos reales.
--
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) NODOS
--    last_seen_at es relativo a NOW() para que los estados se vean
--    coherentes cada vez que se carga el seed.
--    healthy: visto hace segundos | degraded: carga alta | disconnected: sin reportar
-- ---------------------------------------------------------------------
INSERT INTO nodes
    (name, hostname, status, last_cpu_percent, last_memory_percent,
     last_load_avg, uptime_seconds, last_seen_at, created_at, memory_limit_mb)
VALUES
    ('node-alpha',   'alpha.lab.local',   'healthy',       23.50, 41.20, 0.65,  864000, NOW() - INTERVAL '3 seconds',  NOW() - INTERVAL '30 days', 4096),
    ('node-bravo',   'bravo.lab.local',   'healthy',       35.80, 52.90, 1.10,  432000, NOW() - INTERVAL '5 seconds',  NOW() - INTERVAL '21 days', 8192),
    ('node-charlie', 'charlie.lab.local', 'degraded',      91.20, 88.40, 7.80,  172800, NOW() - INTERVAL '4 seconds',  NOW() - INTERVAL '14 days', 2048),
    ('node-delta',   'delta.lab.local',   'degraded',      62.30, 93.70, 3.25,  259200, NOW() - INTERVAL '8 seconds',  NOW() - INTERVAL '10 days', 2048),
    ('node-echo',    'echo.lab.local',    'disconnected',   0.00,  0.00, 0.00,   86400, NOW() - INTERVAL '2 hours',    NOW() - INTERVAL '7 days',  4096),
    ('node-foxtrot', 'foxtrot.lab.local', 'disconnected',  12.40, 30.10, 0.30,  604800, NOW() - INTERVAL '1 day',      NOW() - INTERVAL '45 days', NULL),
    ('node-golf',    'golf.lab.local',    'healthy',        8.10, 19.60, 0.15, 1296000, NOW() - INTERVAL '2 seconds',  NOW() - INTERVAL '60 days', NULL)
ON CONFLICT (name) DO UPDATE SET
    hostname            = EXCLUDED.hostname,
    status              = EXCLUDED.status,
    last_cpu_percent    = EXCLUDED.last_cpu_percent,
    last_memory_percent = EXCLUDED.last_memory_percent,
    last_load_avg       = EXCLUDED.last_load_avg,
    uptime_seconds      = EXCLUDED.uptime_seconds,
    last_seen_at        = EXCLUDED.last_seen_at,
    memory_limit_mb     = EXCLUDED.memory_limit_mb;

-- ---------------------------------------------------------------------
-- 2) HISTORIAL DE METRICAS
--    180 muestras por nodo, una cada 20 s (1 hora de historial), terminando
--    en last_seen_at de cada nodo. Los nodos desconectados tienen el
--    historial cortado en el momento en que dejaron de reportar.
--    La muestra mas reciente (g = 0) coincide con los valores de "nodes".
--    El estado de cada muestra se deriva: degraded si CPU >= 85 o MEM >= 85.
-- ---------------------------------------------------------------------
DELETE FROM node_metrics
WHERE node_id IN (
    SELECT id FROM nodes
    WHERE name IN ('node-alpha','node-bravo','node-charlie','node-delta',
                   'node-echo','node-foxtrot','node-golf')
);

WITH profiles (name, cpu_base, cpu_amp, mem_base, mem_amp, load_base) AS (
    VALUES
        ('node-alpha',   25.0,  8.0, 40.0,  4.0, 0.7),
        ('node-bravo',   35.0, 12.0, 52.0,  6.0, 1.1),
        ('node-charlie', 85.0, 12.0, 82.0,  9.0, 7.0),
        ('node-delta',   60.0, 15.0, 88.0,  7.0, 3.0),
        ('node-echo',    30.0, 10.0, 45.0,  5.0, 0.9),
        ('node-foxtrot', 12.0,  5.0, 30.0,  3.0, 0.3),
        ('node-golf',     8.0,  4.0, 20.0,  2.0, 0.2)
),
samples AS (
    SELECT
        n.id AS node_id,
        g,
        CASE WHEN g = 0 THEN n.last_cpu_percent
             ELSE ROUND(LEAST(100, GREATEST(0,
                  p.cpu_base + p.cpu_amp * sin(g / 6.0) + (random() - 0.5) * 4))::numeric, 2)
        END AS cpu,
        CASE WHEN g = 0 THEN n.last_memory_percent
             ELSE ROUND(LEAST(100, GREATEST(0,
                  p.mem_base + p.mem_amp * sin(g / 15.0) + (random() - 0.5) * 2))::numeric, 2)
        END AS mem,
        CASE WHEN g = 0 THEN n.last_load_avg
             ELSE ROUND(GREATEST(0,
                  p.load_base + (p.load_base * 0.3) * sin(g / 8.0) + (random() - 0.5) * 0.3)::numeric, 2)
        END AS load_avg,
        GREATEST(0, n.uptime_seconds - g * 20) AS uptime,
        n.last_seen_at - (g * INTERVAL '20 seconds') AS recorded_at,
        n.memory_limit_mb
    FROM nodes n
    JOIN profiles p ON p.name = n.name
    CROSS JOIN generate_series(0, 179) AS g
)
INSERT INTO node_metrics
    (node_id, cpu_percent, memory_percent, load_avg, uptime_seconds,
     status, recorded_at, memory_limit_mb)
SELECT
    node_id, cpu, mem, load_avg, uptime,
    CASE WHEN cpu >= 85 OR mem >= 85 THEN 'degraded' ELSE 'healthy' END,
    recorded_at, memory_limit_mb
FROM samples;

-- ---------------------------------------------------------------------
-- 3) TAREAS
--    Cubre todos los casos que el panel debe mostrar:
--    PENDING (nuevas y en espera de reintento), RUNNING, COMPLETED
--    y FAILED (reintentos agotados).
--    Se identifican con "seed": true en payload para poder limpiarlas.
-- ---------------------------------------------------------------------
DELETE FROM tasks WHERE payload @> '{"seed": true}'::jsonb;

INSERT INTO tasks
    (title, payload, status, attempts, max_retries, worker_name,
     result, error_message, created_at, updated_at)
VALUES
    -- COMPLETED
    ('Generar reporte mensual de uso',
     '{"seed": true, "type": "report", "month": "2026-10"}',
     'COMPLETED', 1, 3, 'worker-1',
     'Reporte generado: 1.240 filas procesadas.', NULL,
     NOW() - INTERVAL '3 hours',  NOW() - INTERVAL '2 hours 55 minutes'),

    ('Respaldar base de datos de usuarios',
     '{"seed": true, "type": "backup", "target": "users_db"}',
     'COMPLETED', 1, 3, 'worker-2',
     'Respaldo de 312 MB guardado correctamente.', NULL,
     NOW() - INTERVAL '2 hours',  NOW() - INTERVAL '1 hour 50 minutes'),

    ('Enviar correos de bienvenida',
     '{"seed": true, "type": "email", "batch": 14, "recipients": 58}',
     'COMPLETED', 2, 3, 'worker-1',
     '58 de 58 correos enviados tras 1 reintento.', NULL,
     NOW() - INTERVAL '90 minutes', NOW() - INTERVAL '80 minutes'),

    ('Optimizar imagenes del catalogo',
     '{"seed": true, "type": "image_batch", "count": 120}',
     'COMPLETED', 1, 2, 'worker-3',
     '120 imagenes optimizadas, ahorro del 37 %.', NULL,
     NOW() - INTERVAL '70 minutes', NOW() - INTERVAL '55 minutes'),

    -- RUNNING
    ('Sincronizar inventario con proveedor',
     '{"seed": true, "type": "sync", "provider": "acme"}',
     'RUNNING', 1, 3, 'worker-1',
     NULL, NULL,
     NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '30 seconds'),

    ('Procesar video de capacitacion',
     '{"seed": true, "type": "transcode", "file": "capacitacion_01.mp4", "preset": "720p"}',
     'RUNNING', 2, 5, 'worker-2',
     NULL, 'Intento 1: timeout al leer el archivo de origen.',
     NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '1 minute'),

    -- PENDING con reintento en espera (ya fallaron antes)
    ('Importar CSV de donaciones',
     '{"seed": true, "type": "import", "file": "donaciones_nov.csv"}',
     'PENDING', 1, 3, NULL,
     NULL, 'Fila 87: formato de fecha invalido.',
     NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '4 minutes'),

    ('Notificar a voluntarios por SMS',
     '{"seed": true, "type": "sms", "group": "voluntarios", "count": 40}',
     'PENDING', 2, 3, NULL,
     NULL, 'Proveedor SMS respondio 503 (servicio no disponible).',
     NOW() - INTERVAL '18 minutes', NOW() - INTERVAL '2 minutes'),

    -- PENDING nuevas
    ('Limpiar archivos temporales',
     '{"seed": true, "type": "cleanup", "path": "/tmp/uploads"}',
     'PENDING', 0, 3, NULL, NULL, NULL,
     NOW() - INTERVAL '6 minutes', NOW() - INTERVAL '6 minutes'),

    ('Calcular estadisticas semanales',
     '{"seed": true, "type": "analytics", "week": "2026-W47"}',
     'PENDING', 0, 3, NULL, NULL, NULL,
     NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '4 minutes'),

    ('Reindexar busqueda de documentos',
     '{"seed": true, "type": "reindex", "index": "documentos"}',
     'PENDING', 0, 1, NULL, NULL, NULL,
     NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes'),

    ('Generar certificados de participacion',
     '{"seed": true, "type": "pdf", "template": "certificado_v2", "count": 25}',
     'PENDING', 0, 3, NULL, NULL, NULL,
     NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute'),

    -- FAILED (reintentos agotados: attempts = max_retries)
    ('Exportar datos a servicio externo',
     '{"seed": true, "type": "export", "destination": "https://api.externa.example/v1/ingest"}',
     'FAILED', 3, 3, 'worker-3',
     NULL, 'Conexion rechazada por el destino tras 3 intentos.',
     NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 40 minutes'),

    ('Migrar adjuntos al nuevo almacenamiento',
     '{"seed": true, "type": "migration", "bucket": "adjuntos-legacy"}',
     'FAILED', 2, 2, 'worker-2',
     NULL, 'Espacio insuficiente en el volumen de destino.',
     NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 30 minutes'),

    ('Tarea sin reintentos permitidos',
     '{"seed": true, "type": "noop", "note": "max_retries = 0"}',
     'FAILED', 1, 0, 'worker-1',
     NULL, 'Fallo inmediato: payload invalido.',
     NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '44 minutes');

-- ---------------------------------------------------------------------
-- 4) INCIDENTES / AUDITORIA
-- ---------------------------------------------------------------------
DELETE FROM incident_audit WHERE metadata @> '{"seed": true}'::jsonb;

INSERT INTO incident_audit (service_name, severity, event_type, message, metadata, created_at)
VALUES
    ('monitor', 'WARNING',  'NODE_DEGRADED',
     'node-charlie supera el 85 % de CPU y memoria.',
     '{"seed": true, "node": "node-charlie", "cpu": 91.2, "memory": 88.4}',
     NOW() - INTERVAL '12 minutes'),

    ('monitor', 'WARNING',  'NODE_DEGRADED',
     'node-delta con uso de memoria critico (93.7 %).',
     '{"seed": true, "node": "node-delta", "memory": 93.7}',
     NOW() - INTERVAL '9 minutes'),

    ('monitor', 'ERROR',    'NODE_DISCONNECTED',
     'node-echo dejo de reportar metricas.',
     '{"seed": true, "node": "node-echo"}',
     NOW() - INTERVAL '2 hours'),

    ('monitor', 'ERROR',    'NODE_DISCONNECTED',
     'node-foxtrot lleva mas de 24 horas sin reportar.',
     '{"seed": true, "node": "node-foxtrot"}',
     NOW() - INTERVAL '1 day'),

    ('worker',  'ERROR',    'TASK_FAILED',
     'La tarea "Exportar datos a servicio externo" agoto sus reintentos.',
     '{"seed": true, "worker": "worker-3", "attempts": 3}',
     NOW() - INTERVAL '4 hours 40 minutes'),

    ('worker',  'WARNING',  'TASK_RETRY',
     'Reintentando "Notificar a voluntarios por SMS" (intento 2 de 3).',
     '{"seed": true, "worker": "worker-1", "attempt": 2}',
     NOW() - INTERVAL '2 minutes'),

    ('api',     'INFO',     'TASK_ENQUEUED',
     'Nueva tarea encolada: "Generar certificados de participacion".',
     '{"seed": true, "source": "dashboard"}',
     NOW() - INTERVAL '1 minute');

COMMIT;