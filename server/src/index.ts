import app from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Melat API listening on port ${port}`);
});

async function shutdown() {
  server.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
