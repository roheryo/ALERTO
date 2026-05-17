import jwt from "jsonwebtoken";

function jwtSecret() {
  return process.env.JWT_SECRET ?? "dev-only-change-me";
}

export function signToken(userRow) {
  return jwt.sign(
    {
      sub: userRow.id,
      role: userRow.role,
      provinceId: userRow.province_id,
      municipalityId: userRow.municipality_id,
      barangayId: userRow.barangay_id
    },
    jwtSecret(),
    { expiresIn: "12h" }
  );
}

export function authMiddleware(req, res, next) {
  const h = req.headers.authorization ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return res.status(401).json({ error: "Missing bearer token" });
  try {
    const payload = jwt.verify(m[1], jwtSecret());
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
