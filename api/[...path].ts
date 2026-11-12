/**
 * Vercel is a public preview host, not the Melat store runtime.
 * Never import the LAN Express app or connect this endpoint to the store database.
 */
export default function handler(_req: any, res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex");
  return res.status(503).json({
    service: "melat-api",
    status: "local-only",
    error: "The public preview is not connected to store operations. Open Melat using the secure local store address on the shop network."
  });
}
