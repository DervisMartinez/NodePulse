class AppError extends Error {
  constructor(message) {
    super(message);
    // TODO: asignar statusCode y code
  }
}

function errorHandler(err, res) {
  res.status(500).send(err.message);
}

module.exports = {
  AppError,
  errorHandler,
};
