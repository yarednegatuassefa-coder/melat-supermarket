import app from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.BIND_HOST ?? "127.0.0.1";
const server = app.listen(port, host, () => {
  console.log(`Melat API listening on ${host}:${port}`);
});

async function shutdown() {
  server.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
