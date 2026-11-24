#!/usr/bin/env bash
# ============================================================================
# db-backup.sh — Respalda la base de datos con pg_dump dentro del contenedor.
#
# Uso:
#   ./scripts/db-backup.sh                    # backups/monitoreo_YYYYmmdd_HHMMSS.sql.gz
#   ./scripts/db-backup.sh mi_respaldo.sql.gz # backups/mi_respaldo.sql.gz
#
# Variables opcionales:
#   DB_SERVICE   Servicio de Postgres en docker compose (default: db)
#   BACKUP_DIR   Carpeta de destino                     (default: ./backups)
#
# Usuario y base se toman del propio contenedor (POSTGRES_USER / POSTGRES_DB).
# ============================================================================
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_SERVICE="${DB_SERVICE:-db}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"

mkdir -p "$BACKUP_DIR"

if [[ $# -ge 1 ]]; then
  OUT_FILE="$1"
  [[ "$OUT_FILE" == */* ]] || OUT_FILE="$BACKUP_DIR/$OUT_FILE"
else
  OUT_FILE="$BACKUP_DIR/monitoreo_$(date +%Y%m%d_%H%M%S).sql.gz"
fi

if ! docker compose ps --status running --services | grep -qx "$DB_SERVICE"; then
  echo "ERROR: el servicio '$DB_SERVICE' no está corriendo. Levántalo con: docker compose up -d $DB_SERVICE" >&2
  exit 1
fi

TMP_FILE="$(mktemp "${OUT_FILE}.XXXXXX")"
trap 'rm -f "$TMP_FILE"' EXIT

echo "→ Respaldando la base del servicio '$DB_SERVICE'..."

# -T: sin TTY (necesario para redirigir la salida).
# --clean --if-exists: el respaldo se puede restaurar sobre una base existente.
# --no-owner --no-privileges: portable entre las computadoras del equipo.
# Las comillas simples hacen que $POSTGRES_* se expanda DENTRO del contenedor.
docker compose exec -T "$DB_SERVICE" sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' \
  | gzip > "$TMP_FILE"

# Validar: gzip íntegro y dump completo (la última línea de pg_dump lo confirma)
gzip -t "$TMP_FILE"
if ! gzip -dc "$TMP_FILE" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
  echo "ERROR: el respaldo está vacío o incompleto." >&2
  exit 1
fi

mv "$TMP_FILE" "$OUT_FILE"
trap - EXIT

echo "✔ Respaldo creado: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"