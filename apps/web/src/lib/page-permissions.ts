import { notFound, redirect } from "next/navigation";
import type { CompetitionAction } from "@fcm/shared";
import {
  PermissionError,
  requireCompetitionPermission,
} from "@/lib/permissions";

export async function requireCompetitionPagePermission(
  competitionId: string,
  action: CompetitionAction,
) {
  try {
    return await requireCompetitionPermission(competitionId, action);
  } catch (error) {
    if (error instanceof PermissionError && error.status === 401) {
      redirect("/login");
    }
    if (error instanceof PermissionError && error.status === 404) {
      notFound();
    }
    if (error instanceof PermissionError && error.status === 403) {
      redirect("/workspace/access-denied");
    }
    throw error;
  }
}
