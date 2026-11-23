import React, { useCallback, useEffect, useState } from 'react';
import {
  apiRequest,
  type AuditRecord,
  type NodeDetailData,
  type NodeRecord,
  type RequeueStaleData,
  type SystemHealthData,
  type TaskRecord,
} from './utils/api-client';
import { MetricsChart } from './components/MetricsChart';
import { formatRelative } from './utils/format';

type TaskStatus = TaskRecord['status'];

const TASK_STATUSES: TaskStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'healthy':
    case 'COMPLETED':
    case 'INFO':
      return 'badge badge-ok';
    case 'degraded':
    case 'PENDING':
    case 'PROCESSING':
    case 'WARN':
      return 'badge badge-warn';
    case 'offline':
    case 'FAILED':
    case 'ERROR':
      return 'badge badge-alert';
    default:
      return 'badge badge-neutral';
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-VE', { hour12: false });
  } catch {
    return iso;
  }
}

export function App(): React.ReactElement {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeDetailData | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [shouldFail, setShouldFail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('—');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [filteredTasks, setFilteredTasks] = useState<TaskRecord[] | null>(null);
  const [requeuing, setRequeuing] = useState(false);
  const [requeueMessage, setRequeueMessage] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const [healthData, nodesData, tasksData, auditData, filteredData] = await Promise.all([
        apiRequest<SystemHealthData>('/health'),
        apiRequest<NodeRecord[]>('/nodes'),
        apiRequest<TaskRecord[]>('/tasks'),
        apiRequest<AuditRecord[]>('/audit'),
        statusFilter
          ? apiRequest<TaskRecord[]>(`/tasks?status=${statusFilter}`)
          : Promise.resolve(null),
      ]);

      setHealth(healthData);
      setNodes(nodesData);
      setTasks(tasksData);
      setAudit(auditData);
      setFilteredTasks(filteredData);
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString('es-VE', { hour12: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar la API.');
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void loadDashboard();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadDashboard]);

  async function handleInspectNode(name: string): Promise<void> {
    try {
      const detail = await apiRequest<NodeDetailData>(`/nodes/${encodeURIComponent(name)}`);
      setSelectedNode(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error consultando el nodo.');
    }
  }

  async function handleCreateTask(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const cleanTitle = taskTitle.trim();
    if (cleanTitle.length < 2) {
      setError('Escribe un título de al menos 2 caracteres para la tarea.');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest<TaskRecord>('/tasks', {
        method: 'POST',
        body: {
          title: cleanTitle,
          payload: shouldFail ? { shouldFail: true } : {},
        },
      });
      setTaskTitle('');
      setShouldFail(false);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo encolar la tarea.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequeueStale(): Promise<void> {
    setRequeuing(true);
    try {
      const { requeued } = await apiRequest<RequeueStaleData>('/tasks/requeue-stale', {
        method: 'POST',
      });
      setRequeueMessage(
        requeued === 0
          ? 'No había tareas atascadas.'
          : `Se reencolaron ${requeued} tarea(s) atascada(s).`
      );
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron reencolar las tareas.');
    } finally {
      setRequeuing(false);
    }
  }

  const onlineNodes = nodes.filter((n) => n.online);
  const avgCpu =
    onlineNodes.length > 0
      ? (onlineNodes.reduce((acc, n) => acc + n.cpuPercent, 0) / onlineNodes.length).toFixed(1)
      : '0.0';
  const avgRam =
    onlineNodes.length > 0
      ? (onlineNodes.reduce((acc, n) => acc + n.memoryPercent, 0) / onlineNodes.length).toFixed(1)
      : '0.0';
  const pendingCount = tasks.filter(
    (t) => t.status === 'PENDING' || t.status === 'PROCESSING'
  ).length;
  const visibleTasks = filteredTasks ?? tasks;

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <div className="topbar-kicker">
            Universidad de Carabobo · FACYT · Taller de Sistemas Operativos (CAO503)
          </div>
          <h1 className="topbar-title">Monitoreo de Nodos y Cola de Tareas</h1>
        </div>
        <div className="topbar-actions">
          <span className={statusBadgeClass(health?.status ?? 'offline')}>
            API: {health ? `${health.status} (${health.databaseConnected ? 'DB OK' : 'DB OFF'})` : 'Sin conexión'}
          </span>
          <span className="muted">Act: {lastUpdated}</span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto 5s
          </label>
          <button type="button" className="btn" onClick={() => void loadDashboard()}>
            Actualizar
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="kpi-grid">
        <article className="card">
          <div className="kpi-label">Nodos en línea</div>
          <div className="kpi-value">
            {onlineNodes.length} / {nodes.length}
          </div>
          <div className="kpi-sub">Reportando vía Collector</div>
        </article>
        <article className="card">
          <div className="kpi-label">CPU promedio</div>
          <div className="kpi-value">{avgCpu}%</div>
          <div className="kpi-sub">Carga agregada de nodos</div>
        </article>
        <article className="card">
          <div className="kpi-label">RAM promedio</div>
          <div className="kpi-value">{avgRam}%</div>
          <div className="kpi-sub">Memoria usada en contenedores</div>
        </article>
        <article className="card">
          <div className="kpi-label">Cola de tareas</div>
          <div className="kpi-value">
            {pendingCount} activas / {tasks.length} total
          </div>
          <div className="kpi-sub">Procesadas por Worker</div>
        </article>
      </section>

      <section className="card">
        <div className="section-header">
          <h2 className="section-title">Nodos activos y telemetría</h2>
          <span className="muted">Haz clic en un nodo para ver su historial reciente</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nodo</th>
                <th>Hostname</th>
                <th>Estado</th>
                <th>CPU %</th>
                <th>RAM %</th>
                <th>Límite</th>
                <th>Load (1m)</th>
                <th>Uptime (s)</th>
                <th>Último reporte</th>
              </tr>
            </thead>
            <tbody>
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    Esperando telemetría del servicio collector...
                  </td>
                </tr>
              ) : (
                nodes.map((node) => (
                  <tr
                    key={node.id}
                    className="clickable"
                    onClick={() => void handleInspectNode(node.name)}
                  >
                    <td className="mono">{node.name}</td>
                    <td className="mono">{node.hostname}</td>
                    <td>
                      <span className={statusBadgeClass(node.status)}>{node.status}</span>
                    </td>
                    <td className="mono">{node.cpuPercent.toFixed(2)}%</td>
                    <td className="mono">{node.memoryPercent.toFixed(2)}%</td>
                    <td className="mono">
                      {node.memoryLimitMb != null ? `${node.memoryLimitMb} MB` : 'sin límite'}
                    </td>
                    <td className="mono">{node.loadAvg.toFixed(2)}</td>
                    <td className="mono">{node.uptimeSeconds}s</td>
                    <td className="mono" title={formatTime(node.lastSeenAt)}>
                      {formatRelative(node.lastSeenAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedNode && (
        <section className="card">
          <div className="section-header">
            <h2 className="section-title">
              Detalle del nodo: <span className="mono">{selectedNode.node.name}</span>
            </h2>
            <button type="button" className="btn" onClick={() => setSelectedNode(null)}>
              Cerrar detalle
            </button>
          </div>
          <MetricsChart metrics={selectedNode.recentMetrics} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Estado</th>
                  <th>CPU %</th>
                  <th>RAM %</th>
                  <th>Load</th>
                  <th>Uptime</th>
                </tr>
              </thead>
              <tbody>
                {selectedNode.recentMetrics.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{formatTime(m.recordedAt)}</td>
                    <td>
                      <span className={statusBadgeClass(m.status)}>{m.status}</span>
                    </td>
                    <td className="mono">{m.cpuPercent.toFixed(2)}%</td>
                    <td className="mono">{m.memoryPercent.toFixed(2)}%</td>
                    <td className="mono">{m.loadAvg.toFixed(2)}</td>
                    <td className="mono">{m.uptimeSeconds}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <div className="section-header">
          <h2 className="section-title">Cola de tareas en segundo plano</h2>
          <div className="topbar-actions">
            {requeueMessage && <span className="muted">{requeueMessage}</span>}
            <button
              type="button"
              className="btn"
              onClick={() => void handleRequeueStale()}
              disabled={requeuing}
            >
              {requeuing ? 'Reencolando...' : 'Reencolar tareas atascadas'}
            </button>
            <label className="checkbox-label">
              Estado:
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => {
                  setFilteredTasks(null);
                  setStatusFilter(e.target.value as TaskStatus | '');
                }}
              >
                <option value="">Todas</option>
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <form className="form-row" onSubmit={(e) => void handleCreateTask(e)}>
          <input
            type="text"
            className="input input-grow"
            placeholder="Ej: Analizar logs del laboratorio"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            disabled={submitting}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={shouldFail}
              onChange={(e) => setShouldFail(e.target.checked)}
              disabled={submitting}
            />
            Simular fallo (probar reintentos)
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Encolar tarea'}
          </button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Intentos</th>
                <th>Worker</th>
                <th>Resultado / Error</th>
                <th>Actualizada</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    {statusFilter
                      ? `No hay tareas con estado ${statusFilter}.`
                      : 'No hay tareas registradas todavía. Encola una arriba.'}
                  </td>
                </tr>
              ) : (
                visibleTasks.map((task) => (
                  <tr key={task.id}>
                    <td className="mono">#{task.id}</td>
                    <td className="wrap">{task.title}</td>
                    <td>
                      <span className={statusBadgeClass(task.status)}>{task.status}</span>
                    </td>
                    <td className="mono">
                      {task.attempts}/{task.maxRetries}
                    </td>
                    <td className="mono">{task.workerName ?? '—'}</td>
                    <td className="wrap">{task.errorMessage ?? task.result ?? '—'}</td>
                    <td className="mono">{formatTime(task.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <h2 className="section-title">Auditoría de incidentes y eventos (BD)</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Servicio</th>
                <th>Severidad</th>
                <th>Evento</th>
                <th>Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id}>
                  <td className="mono">{formatTime(entry.createdAt)}</td>
                  <td className="mono">{entry.serviceName}</td>
                  <td>
                    <span className={statusBadgeClass(entry.severity)}>{entry.severity}</span>
                  </td>
                  <td className="mono">{entry.eventType}</td>
                  <td className="wrap">{entry.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
