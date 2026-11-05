import { z } from "zod";

export const apiHealthSchema = z.object({
  status: z.literal("ok"),
});

export type ApiHealth = z.infer<typeof apiHealthSchema>;
