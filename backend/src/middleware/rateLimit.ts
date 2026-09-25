import rateLimit from "express-rate-limit";

// The public attendance endpoints are hit by every phone that scans the QR
// code; keep the ceiling generous but bounded to stop abuse/spam-marking.
export const publicAttendanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a moment and try again." },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});
