import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { Pool } from "pg";
import { authRoutes } from "./routes/auth.js";
import { inventoryRoutes } from "./routes/inventory.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 12,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000
}) : null;

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin: process.env.APP_BASE_URL ?? "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", async (_req, res) => {
  if (!pool) return res.status(503).json({ service: "melat-api", status: "degraded", database: "not-configured" });
  try {
    await pool.query("SELECT 1");
    return res.json({ service: "melat-api", status: "ok", database: "connected" });
  } catch {
    return res.status(503).json({ service: "melat-api", status: "degraded", database: "unavailable" });
  }
});

if (pool) {
  app.use("/api/auth", authRoutes(pool));
  app.use("/api/inventory", inventoryRoutes(pool));
} else {
  app.use("/api", (_req, res) => res.status(503).json({ error: "DATABASE_URL is not configured." }));
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const code = (error as { code?: string }).code;
  if (code === "40001" || code === "40P01") {
    return res.status(409).json({ error: "Concurrent update detected. Retry the operation." });
  }
  console.error("API request failed", error);
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Melat API listening on port ${port}`);
});

async function shutdown() {
  server.close();
  await pool?.end();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
