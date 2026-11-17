import { z } from "zod";

export * from "./ranking.js";

export const apiHealthSchema = z.object({
  status: z.literal("ok"),
});

export type ApiHealth = z.infer<typeof apiHealthSchema>;
