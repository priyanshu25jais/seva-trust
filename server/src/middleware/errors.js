function notFound(_req, res) {
  res.status(404).json({ error: "not_found", message: "Route not found" });
}

function errorHandler(err, _req, res, _next) {
  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "validation_error",
      message: "Invalid input",
      details: err.issues,
    });
  }

  const status = err.status || 500;
  const message = status === 500 ? "Server error" : err.message;
  if (status === 500) {
    console.error(err);
  }
  return res.status(status).json({ error: err.code || "error", message });
}

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

module.exports = { notFound, errorHandler, httpError };
