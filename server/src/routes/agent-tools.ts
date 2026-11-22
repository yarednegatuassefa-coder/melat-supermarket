import { Router } from "express";
import type { Pool } from "pg";
import { requireAuth, allowRoles } from "../security/sessions.js";

export function agentToolRoutes(pool: Pool) {
  const router = Router();
  router.use(requireAuth(pool), allowRoles("owner", "manager"));

  router.get("/", (_req, res) => res.setHeader("Cache-Control", "no-store").json({
    tools: [{ name: "inventory.stock_summary", description: "Aggregate active-product and zero-stock counts." }],
    discovery: "Tool implementation is loaded only when invoked."
  }));

  router.post("/", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.body?.tool !== "inventory.stock_summary") return res.status(404).json({ error: "Unknown tool." });
    try {
      const tool = await import("../agent/servers/inventory/stock-summary.js");
      const result = await tool.run(pool);
      return res.json({ ok: true, tool: tool.name, result, bounded: true, actorId: req.user!.id });
    } catch {
      return res.status(503).json({ error: "Tool execution failed." });
    }
  });
  return router;
}
