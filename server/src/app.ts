import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import { Pool } from "pg";
import { authRoutes } from "./routes/auth.js";
import { inventoryRoutes } from "./routes/inventory.js";
import { salesRoutes } from "./routes/sales.js";
import { purchasingRoutes } from "./routes/purchasing.js";
import { financeRoutes } from "./routes/finance.js";

const app = express();
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
}) : null;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin: process.env.APP_BASE_URL ? process.env.APP_BASE_URL.split(",").map((value) => value.trim()) : ["http://localhost:5173"],
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
  app.use("/api/sales", salesRoutes(pool));
  app.use("/api/purchasing", purchasingRoutes(pool));
  app.use("/api/finance", financeRoutes(pool));
} else {
  app.use("/api", (_req, res) => res.status(503).json({ error: "Melat database is not connected. The store administrator must complete database setup." }));
}

const clientDist = join(dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path === "/api" || req.path.startsWith("/api/")) return next();
    const indexFile = join(clientDist, "index.html");
    if (existsSync(indexFile)) return res.sendFile(indexFile);
    return next();
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const code = (error as { code?: string }).code;
  if (code === "40001" || code === "40P01") {
    return res.status(409).json({ error: "Concurrent update detected. Retry the operation." });
  }
  console.error("API request failed", error);
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

export default app;
