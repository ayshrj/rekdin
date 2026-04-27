import "dotenv/config"

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://demo:demo@localhost:5432/demo_repo",
  jwtSecret: process.env.JWT_SECRET ?? "development-secret",
  adminToken: process.env.ADMIN_TOKEN ?? "let-me-in",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  dbPoolMax: Number(process.env.DB_POOL_MAX ?? 10),
  dbIdleTimeoutMs: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMaxAttempts: Number(process.env.RATE_LIMIT_MAX_ATTEMPTS ?? 10),
}
