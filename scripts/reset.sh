#!/usr/bin/env bash
set -euo pipefail
echo "=================================================================="
echo " ADVERTENCIA: Este proceso detendra todos los contenedores y"
echo " eliminara permanentemente los volumenes de datos (PostgreSQL)."
echo "=================================================================="
read -r -p "¿Estas seguro de que deseas reiniciar el sistema desde cero? (s/N): " CONFIRMACION
case "${CONFIRMACION}" in
  [sS]|[sS][iI])
    echo ""
    echo "=== Deteniendo contenedores y eliminando volumenes ==="
    docker compose down -v

    echo ""
    echo "=== Levantando el sistema limpio desde cero ==="
    docker compose up --build -d

    echo ""
    echo "OK: Sistema reiniciado desde cero. Ejecuta 'bash scripts/healthcheck.sh' para verificar."
    ;;
  *)
    echo ""
    echo "Operacion cancelada. No se borraron datos."
    exit 0
    ;;
esac