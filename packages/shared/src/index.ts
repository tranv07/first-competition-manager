import { z } from "zod";

export * from "./ranking";
export * from "./permissions";

export const apiHealthSchema = z.object({
  status: z.literal("ok"),
});

export type ApiHealth = z.infer<typeof apiHealthSchema>;
