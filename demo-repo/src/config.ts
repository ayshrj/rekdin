import "dotenv/config"

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://demo:demo@localhost:5432/demo_repo",
  jwtSecret: process.env.JWT_SECRET ?? "development-secret",
  adminToken: process.env.ADMIN_TOKEN ?? "let-me-in",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
}
