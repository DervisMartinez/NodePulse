export interface SystemHealthData {
  serviceName: string;
  version: string;
  status: 'healthy' | 'degraded';
  databaseConnected: boolean;
  timestamp: string;
  uptimeSeconds: number;
}

export interface NodeRecord {
  id: number;
  name: string;
  hostname: string;
  status: 'healthy' | 'degraded' | 'offline';
  online: boolean;
  cpuPercent: number;
  memoryPercent: number;
  memoryLimitMb?: number | null;
  loadAvg: number;
  uptimeSeconds: number;
  lastSeenAt: string;
  createdAt: string;
}

export interface NodeMetricPoint {
  id: number;
  cpuPercent: number;
  memoryPercent: number;
  loadAvg: number;
  uptimeSeconds: number;
  status: string;
  recordedAt: string;
}

export interface NodeDetailData {
  node: NodeRecord;
  recentMetrics: NodeMetricPoint[];
}

export interface TaskRecord {
  id: number;
  title: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  maxRetries: number;
  workerName: string | null;
  result: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: number;
  serviceName: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  eventType: string;
  message: string;
  createdAt: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

const configuredBase = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = (
  configuredBase && configuredBase.length > 0 ? configuredBase : '/api'
).replace(/\/+$/, '');

export function extractErrorMessage(payload: unknown, fallbackStatus: number): string {
  if (payload && typeof payload === 'object') {
    const record = payload as ApiEnvelope<unknown>;
    if (record.error?.message && record.error.message.trim().length > 0) {
      return record.error.message.trim();
    }
  }
  return `Error del servidor (HTTP ${fallbackStatus})`;
}

export async function apiRequest<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; baseUrl?: string } = {}
): Promise<T> {
  const baseUrl = options.baseUrl ?? API_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const hasBody = options.body !== undefined;

  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    method: options.method ?? 'GET',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(parsed, response.status));
  }

  const envelope = parsed as ApiEnvelope<T>;
  return envelope.data as T;
}
