BEGIN;

-- 20 nodos de prueba
INSERT INTO nodes (name, hostname)
SELECT 'bulk-' || lpad(g::text, 2, '0'), 'bulk-' || g || '.lab.local'
FROM generate_series(1, 20) g
ON CONFLICT (name) DO NOTHING;

-- 1.000.000 de métricas (≈ 50.000 por nodo), desde "ahora" hacia atrás, 1 por segundo
INSERT INTO node_metrics (node_id, cpu_percent, memory_percent, load_avg, uptime_seconds, status, recorded_at)
SELECT n.id,
       round((random() * 100)::numeric, 2),
       round((random() * 100)::numeric, 2),
       round((random() * 8)::numeric, 2),
       g,
       'healthy',
       now() - (g * interval '1 second')
FROM generate_series(1, 50000) g
CROSS JOIN (SELECT id FROM nodes WHERE name LIKE 'bulk-%') n;

-- 500.000 tareas: casi todas COMPLETED, pocas PENDING, muy pocas RUNNING atascadas
INSERT INTO tasks (title, payload, status, attempts, updated_at, created_at)
SELECT 'bulk task ' || g,
       '{"seed_bulk": true}',
       CASE WHEN g % 50000 = 0 THEN 'RUNNING'
            WHEN g % 1000  = 0 THEN 'PENDING'
            WHEN g % 200   = 0 THEN 'FAILED'
            ELSE 'COMPLETED' END,
       1,
       now() - (g * interval '2 seconds'),
       now() - (g * interval '2 seconds')
FROM generate_series(1, 500000) g;

-- 500.000 incidentes repartidos en 4 servicios
INSERT INTO incident_audit (service_name, severity, event_type, message, metadata, created_at)
SELECT (ARRAY['api','worker','db','monitor'])[1 + g % 4],
       'INFO', 'BULK_TEST', 'msg ' || g,
       '{"seed_bulk": true}',
       now() - (g * interval '2 seconds')
FROM generate_series(1, 500000) g;

COMMIT;

ANALYZE nodes; ANALYZE node_metrics; ANALYZE tasks; ANALYZE incident_audit;