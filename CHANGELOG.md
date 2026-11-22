# Registro de Cambios - NodePulse

## Puesto 6: Gateway - Teoban Rondón
- Configuración de cabeceras de seguridad HTTP: X-Content-Type-Options, X-Frame-Options y Referrer-Policy.
- Implementación de rate limiting en /api/ a 10 req/s con burst de 20 y respuesta 429.
- Estructuración de logs de acceso en formato JSON.
- Activación de compresión gzip (reduccion de 894 B a 467 B en la raíz) y políticas de caché para estáticos.
- Configuración de páginas de error personalizadas 502 y 503 para la API y el panel web.
