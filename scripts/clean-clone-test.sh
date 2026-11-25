#!/usr/bin/env bash
set -euo pipefail

RAMA="${1:-develop}"
REPO_URL=$(git config --get remote.origin.url || echo "https://github.com/DervisMartinez/NodePulse.git")

if docker ps --format '{{.Names}}' | grep -q '^monitoreo_'; then
  echo "AVISO: El sistema principal ya esta corriendo (contenedores 'monitoreo_*' activos en el puerto 8080)."
  echo "Detenlo primero con 'docker compose down' antes de ejecutar la prueba desde clon limpio."
  exit 1
fi

TEMP_DIR=$(mktemp -d)
DIR_ACTUAL=$(pwd)

limpiar() {
  echo ""
  echo "=== Limpiando entorno temporal ==="
  if [ -d "${TEMP_DIR}/NodePulse" ]; then
    cd "${TEMP_DIR}/NodePulse"
    docker compose down -v 2>/dev/null || true
  fi
  cd "${DIR_ACTUAL}"
  rm -rf "${TEMP_DIR}"
  echo "OK: Contenedores detenidos, volumenes eliminados y carpeta temporal borrada."
}

trap limpiar EXIT

echo "=== Clonando rama '${RAMA}' en ${TEMP_DIR} ==="
git clone --branch "${RAMA}" --single-branch "${REPO_URL}" "${TEMP_DIR}/NodePulse"

cd "${TEMP_DIR}/NodePulse"
cp .env.example .env

echo ""
echo "=== Construyendo, levantando y verificando salud ==="
if docker compose up --build -d && bash scripts/healthcheck.sh; then
  echo ""
  echo "=========================================="
  echo " RESULTADO: ÉXITO (Rama '${RAMA}' sana)"
  echo "=========================================="
  exit 0
else
  echo ""
  echo "=========================================="
  echo " RESULTADO: FALLO (Rama '${RAMA}' con errores)"
  echo "=========================================="
  exit 1
fi
