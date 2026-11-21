const { AppError } = require('./errorHandler');

function isValidPercent(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function validateMetricsPayload(req, _res, next) {
  const { name, hostname, cpuPercent, memoryPercent, loadAvg, uptimeSeconds, status } =
    req.body || {};

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return next(
      new AppError(
        'El campo "name" es obligatorio (entre 2 y 100 caracteres).',
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  if (!isValidPercent(cpuPercent)) {
    return next(
      new AppError(
        'El campo "cpuPercent" debe ser un número entre 0 y 100.',
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  if (!isValidPercent(memoryPercent)) {
    return next(
      new AppError(
        'El campo "memoryPercent" debe ser un número entre 0 y 100.',
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  if (loadAvg !== undefined && (typeof loadAvg !== 'number' || !Number.isFinite(loadAvg) || loadAvg < 0)) {
    return next(
      new AppError(
        'El campo "loadAvg" debe ser un número mayor o igual a 0.',
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  if (
    uptimeSeconds !== undefined &&
    (typeof uptimeSeconds !== 'number' || !Number.isFinite(uptimeSeconds) || uptimeSeconds < 0)
  ) {
    return next(
      new AppError(
        'El campo "uptimeSeconds" debe ser un número mayor o igual a 0.',
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  if (status !== undefined && !['healthy', 'degraded', 'offline'].includes(status)) {
    return next(
      new AppError(
        'El campo "status" debe ser "healthy", "degraded" u "offline".',
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  req.body.name = name.trim();
  req.body.hostname = typeof hostname === 'string' && hostname.trim() ? hostname.trim() : name.trim();
  next();
}

function validateTaskPayload(req, _res, next) {
  const { title, maxRetries, payload } = req.body || {};

  if (typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 160) {
    return next(
      new AppError(
        'El campo "title" es obligatorio (entre 2 y 160 caracteres).',
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  if (
    maxRetries !== undefined &&
    (!Number.isInteger(maxRetries) || maxRetries < 1 || maxRetries > 10)
  ) {
    return next(
      new AppError(
        'El campo "maxRetries" debe ser un entero entre 1 y 10.',
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  if (payload !== undefined && (typeof payload !== 'object' || payload === null || Array.isArray(payload))) {
    return next(
      new AppError(
        'El campo "payload" debe ser un objeto JSON.',
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  req.body.title = title.trim();
  next();
}

function validateTaskUpdatePayload(req, _res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new AppError('ID de tarea inválido.', 400, 'VALIDATION_ERROR'));
  }

  const { status } = req.body || {};
  if (!['PENDING', 'COMPLETED', 'FAILED'].includes(status)) {
    return next(
      new AppError(
        'El campo "status" debe ser PENDING, COMPLETED o FAILED.',
        400,
        'VALIDATION_ERROR'
      )
    );
  }

  next();
}

module.exports = {
  validateMetricsPayload,
  validateTaskPayload,
  validateTaskUpdatePayload,
};
