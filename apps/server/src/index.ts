import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { apiHealthSchema } from "@fcm/shared";

const app = new Hono();

app.get("/api/health", (context) =>
  context.json(apiHealthSchema.parse({ status: "ok" })),
);

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
