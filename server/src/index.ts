import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { Pool } from "pg";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.APP_BASE_URL ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  let database: "connected" | "not-configured" | "unavailable" = "not-configured";
  if (pool) {
    try {
      await pool.query("SELECT 1");
      database = "connected";
    } catch {
      database = "unavailable";
    }
  }
  res.status(database === "unavailable" ? 503 : 200).json({
    service: "melat-api",
    status: database === "unavailable" ? "degraded" : "ok",
    database
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Melat API listening on port ${port}`);
});

process.on("SIGTERM", async () => {
  await pool?.end();
  process.exit(0);
});