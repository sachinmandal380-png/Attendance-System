import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  port: parseInt(process.env.PORT ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigins: (process.env.CORS_ORIGIN ?? "").split(",").map((o) => o.trim()).filter(Boolean),
  timezone: process.env.TIMEZONE ?? "Asia/Kolkata",
  publicAttendanceUrl: process.env.PUBLIC_ATTENDANCE_URL ?? "https://YOUR-DOMAIN/attendance.html",
};

export const isProduction = env.nodeEnv === "production";
