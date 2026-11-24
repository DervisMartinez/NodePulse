-- ============================================================================
-- Esquema Inicial — Sistema de Monitoreo de Nodos y Cola de Tareas (CAO503)
-- Universidad de Carabobo · FACYT · Departamento de Computación
-- ============================================================================

CREATE TABLE IF NOT EXISTS nodes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    hostname VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'healthy',
    last_cpu_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    last_memory_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    last_load_avg NUMERIC(6, 2) NOT NULL DEFAULT 0,
    uptime_seconds BIGINT NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS node_metrics (
    id SERIAL PRIMARY KEY,
    node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    cpu_percent NUMERIC(5, 2) NOT NULL,
    memory_percent NUMERIC(5, 2) NOT NULL,
    load_avg NUMERIC(6, 2) NOT NULL DEFAULT 0,
    uptime_seconds BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'healthy',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_metrics_node_recorded
    ON node_metrics (node_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    worker_name VARCHAR(100),
    result TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_id
    ON tasks (status, id ASC);

-- Tabla de auditoría de incidentes y eventos del sistema (adaptada de audit_logs)
CREATE TABLE IF NOT EXISTS incident_audit (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(60) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    event_type VARCHAR(80) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO incident_audit (service_name, severity, event_type, message)
VALUES ('db', 'INFO', 'SYSTEM_INIT', 'Esquema inicial de monitoreo e incidentes creado correctamente.')
ON CONFLICT DO NOTHING;
