import jwt from "jsonwebtoken";

export function signAccessToken(user, deviceId) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, username: user.username, type: "access", did: deviceId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" },
  );
}

export function signRefreshToken(user, deviceId) {
  return jwt.sign(
    { id: user.id, role: user.role, type: "refresh", did: deviceId },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
}
