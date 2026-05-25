import multer from "multer";
import path from "path";

function fileFilter(_req, file, cb) {
  const mime = String(file.mimetype || "").toLowerCase();
  const ext = path.extname(String(file.originalname || "")).replace(".", "").toLowerCase();
  const allowedImageMime = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
  const allowedImageExt = new Set(["jpg", "jpeg", "png", "webp"]);
  if (allowedImageMime.has(mime) || allowedImageExt.has(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error("Invalid file type. Allowed: jpg, jpeg, png, webp"));
}

function taskMediaFilter(_req, file, cb) {
  const mime = String(file.mimetype || "").toLowerCase();
  const ext = path.extname(String(file.originalname || "")).replace(".", "").toLowerCase();
  const allowedMime = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/ogg",
  ]);
  const allowedExt = new Set(["jpg", "jpeg", "png", "webp", "mp4", "mov", "webm", "ogg"]);
  if (allowedMime.has(mime) || allowedExt.has(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error("Invalid file type. Allowed: jpg, jpeg, png, webp, mp4, webm, mov, ogg"));
}

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

export const uploadTaskMedia = multer({
  storage: multer.memoryStorage(),
  fileFilter: taskMediaFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});
