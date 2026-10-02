export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, next) {
  const status = error.statusCode || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ message: error.message || 'An unexpected error occurred.' });
}
