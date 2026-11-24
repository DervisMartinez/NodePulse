#!/bin/sh
set -e
echo "[gateway] Validando configuración de nginx..."
nginx -t
echo "[gateway] Configuración válida. Iniciando nginx."
exec nginx -g 'daemon off;'
