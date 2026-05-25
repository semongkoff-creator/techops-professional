export function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      message: "Ukuran file terlalu besar. Maksimal gambar 5MB dan video 25MB.",
    });
  }
  return res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
}
