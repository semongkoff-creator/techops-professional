import { verifyAccessToken } from "../utils/jwt.js";

function normalizeRole(role) {
  if (role === "technician") return "teknisi";
  return role;
}

export function auth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    req.user = verifyAccessToken(token);
    req.user.role = normalizeRole(req.user.role);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function roleGuard(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
