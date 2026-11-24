#!/bin/sh
set -e
echo "[gateway] Validando la configuración de nginx..."
nginx -t
echo "[gateway] Configuración válida. Iniciando nginx."
exec nginx -g 'daemon off;'
