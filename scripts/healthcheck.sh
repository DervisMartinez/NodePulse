#!/usr/bin/env bash
set -euo pipefail

GATEWAY_PORT="${GATEWAY_PORT:-8080}"
BASE_URL="http://localhost:${GATEWAY_PORT}"

echo "=== Verificando estado de los 6 contenedores ==="
SERVICES=("db" "api" "worker" "collector" "web" "gateway")

for svc in "${SERVICES[@]}"; do
  STATE=$(docker compose ps --status running --services | grep -x "${svc}" || true)
  if [ -z "${STATE}" ]; then
    echo "FAIL: El servicio '${svc}' no está en ejecución."
    docker compose ps
    exit 1
  fi
  echo "OK   servicio '${svc}' en ejecución"
done

echo ""
echo "=== Verificando PostgreSQL (db) ==="
docker compose exec -T db pg_isready -U "${POSTGRES_USER:-monitor_user}" -d "${POSTGRES_DB:-monitor_db}"
echo "OK   PostgreSQL responde"

echo ""
echo "=== Verificando rutas a través del Gateway (${BASE_URL}) ==="
curl -fsS "${BASE_URL}/gateway-health" >/dev/null && echo "OK   GET /gateway-health"
curl -fsS "${BASE_URL}/" >/dev/null && echo "OK   GET / (Panel Web)"
curl -fsS "${BASE_URL}/api/health" >/dev/null && echo "OK   GET /api/health"
curl -fsS "${BASE_URL}/api/nodes" >/dev/null && echo "OK   GET /api/nodes"
curl -fsS "${BASE_URL}/api/tasks" >/dev/null && echo "OK   GET /api/tasks"
curl -fsS "${BASE_URL}/api/audit" >/dev/null && echo "OK   GET /api/audit"

echo ""
echo "=== Ejecutando pruebas unitarias dentro de api ==="
docker compose exec -T api npm test

echo ""
echo "SISTEMA SANO: Los 6 servicios responden correctamente."
