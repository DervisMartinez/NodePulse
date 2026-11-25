#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
ARCHIVO="evidencia-${TIMESTAMP}.txt"

echo "Generando reporte de evidencia en ${ARCHIVO}..."

{
  echo "=================================================================="
  echo " REPORTE DE EVIDENCIA - NODEPULSE"
  echo " Fecha y hora: $(date)"
  echo " Rama actual:  $(git branch --show-current)"
  echo "=================================================================="
  echo ""

  echo "=== 1. ESTADO DE LOS CONTENEDORES (docker compose ps) ==="
  docker compose ps 2>&1 || true
  echo ""

  echo "=== 2. LOGS RECIENTES DE LOS SERVICIOS (ultimas 50 lineas) ==="
  docker compose logs --tail=50 2>&1 || true
  echo ""

  echo "=== 3. HISTORIAL RECIENTE DE GIT (git log -n 15) ==="
  git log --oneline --decorate -n 15 2>&1 || true
  echo ""
} > "${ARCHIVO}"

echo "OK: Evidencia guardada exitosamente en '${ARCHIVO}'."