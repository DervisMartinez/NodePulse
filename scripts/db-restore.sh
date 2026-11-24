#!/usr/bin/env bash
# ============================================================================
# db-restore.sh — Restaura un respaldo (.sql o .sql.gz) con psql dentro del
# contenedor. REEMPLAZA los datos actuales de la base.
#
# Qué hace:
#   1. Hace un respaldo de seguridad de la base actual (pre-restore_*.sql.gz).
#   2. Detiene api, worker y collector para que nadie escriba durante la restauración.
#   3. Restaura en una sola transacción (o se aplica todo o no se aplica nada).
#   4. Vuelve a levantar los servicios que detuvo.
#
# Uso:
#   ./scripts/db-restore.sh backups/monitoreo_20261124_101500.sql.gz
#   ./scripts/db-restore.sh -y backups/archivo.sql.gz    # sin confirmación
#
# Variables opcionales:
#   DB_SERVICE   Servicio de Postgres (default: db)
#   BACKUP_DIR   Carpeta de respaldos (default: ./backups)
# ============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_SERVICE="${DB_SERVICE:-db}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
WRITER_SERVICES=(api worker collector)   # servicios que escriben en la base

ASSUME_YES=false
if [[ "${1:-}" == "-y" || "${1:-}" == "--yes" ]]; then
  ASSUME_YES=true
  shift
fi

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 [-y] <archivo.sql | archivo.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: no existe el archivo '$BACKUP_FILE'." >&2
  exit 1
fi

RUNNING="$(docker compose ps --status running --services)"
if ! grep -qx "$DB_SERVICE" <<< "$RUNNING"; then
  echo "ERROR: el servicio '$DB_SERVICE' no está corriendo. Levántalo con: docker compose up -d $DB_SERVICE" >&2
  exit 1
fi

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gzip -t "$BACKUP_FILE" || { echo "ERROR: el archivo .gz está corrupto." >&2; exit 1; }
  READ_CMD=(gzip -dc "$BACKUP_FILE")
else
  READ_CMD=(cat "$BACKUP_FILE")
fi

echo "⚠  Se restaurará '$BACKUP_FILE' en la base del servicio '$DB_SERVICE'."
echo "   Las tablas nodes, node_metrics, tasks e incident_audit serán reemplazadas."
echo "   Se detendrán temporalmente: ${WRITER_SERVICES[*]}"

if [[ "$ASSUME_YES" != true ]]; then
  read -r -p "¿Continuar? [escribe 'si' para confirmar]: " ANSWER
  [[ "$ANSWER" == "si" ]] || { echo "Cancelado."; exit 0; }
fi

# 1. Respaldo de seguridad del estado actual
SAFETY_FILE="pre-restore_$(date +%Y%m%d_%H%M%S).sql.gz"
echo "→ Respaldo de seguridad previo: $BACKUP_DIR/$SAFETY_FILE"
"$ROOT_DIR/scripts/db-backup.sh" "$SAFETY_FILE"

# 2. Detener los servicios que escriben (solo los que estén corriendo)
STOPPED=()
for svc in "${WRITER_SERVICES[@]}"; do
  if grep -qx "$svc" <<< "$RUNNING"; then
    STOPPED+=("$svc")
  fi
done

restart_services() {
  if [[ ${#STOPPED[@]} -gt 0 ]]; then
    echo "→ Levantando de nuevo: ${STOPPED[*]}"
    docker compose start "${STOPPED[@]}" >/dev/null
  fi
}
trap restart_services EXIT

if [[ ${#STOPPED[@]} -gt 0 ]]; then
  echo "→ Deteniendo: ${STOPPED[*]}"
  docker compose stop "${STOPPED[@]}" >/dev/null
fi

# 3. Restaurar (atómico: --single-transaction + ON_ERROR_STOP)
echo "→ Restaurando..."
"${READ_CMD[@]}" | docker compose exec -T "$DB_SERVICE" sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction --quiet'

echo "✔ Restauración completada. Conteo de filas:"
docker compose exec -T "$DB_SERVICE" sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
     SELECT '"'"'nodes'"'"' AS tabla, COUNT(*) FROM nodes
     UNION ALL SELECT '"'"'node_metrics'"'"', COUNT(*) FROM node_metrics
     UNION ALL SELECT '"'"'tasks'"'"', COUNT(*) FROM tasks
     UNION ALL SELECT '"'"'incident_audit'"'"', COUNT(*) FROM incident_audit;"'