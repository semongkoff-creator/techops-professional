import multer from "multer";

function fileFilter(_req, file, cb) {
  if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error("Invalid file type. Allowed: jpg, png, webp"));
}

function taskMediaFilter(_req, file, cb) {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/ogg",
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error("Invalid file type. Allowed: jpg, png, webp, mp4, webm, mov, ogg"));
}

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

export const uploadTaskMedia = multer({
  storage: multer.memoryStorage(),
  fileFilter: taskMediaFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});
