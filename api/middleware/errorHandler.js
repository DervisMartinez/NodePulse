/**
 * Error de dominio y middleware HTTP uniforme (adaptado de APP EDV).
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

function notFoundHandler(req, _res, next) {
  next(
    new AppError(
      `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
      404,
      'NOT_FOUND'
    )
  );
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'El cuerpo de la petición no es un JSON válido.',
      },
    });
    return;
  }

  console.error('[UnhandledError]:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error interno en el servidor.',
    },
  });
}

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};
