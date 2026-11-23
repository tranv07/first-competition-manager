import { headers } from "next/headers";
import { can, type CompetitionAction, type CompetitionRole } from "@fcm/shared";
import { prisma } from "@fcm/prisma";
import { z } from "zod";
import { auth } from "@/lib/auth";

const resourceIdSchema = z.string().uuid();

export class PermissionError extends Error {
  constructor(
    readonly status: 401 | 403 | 404,
    message: string,
  ) {
    super(message);
    this.name = "PermissionError";
  }
}

function isCompetitionRole(role: string): role is CompetitionRole {
  return (
    role === "event_admin" || role === "head_referee" || role === "scorekeeper"
  );
}

export async function requireActiveUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new PermissionError(401, "Sign in to continue.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      isSuperAdmin: true,
    },
  });
  if (!user?.isActive) {
    throw new PermissionError(403, "This account is inactive.");
  }
  return user;
}

export async function requireCompetitionPermission(
  competitionId: string,
  action: CompetitionAction,
) {
  const user = await requireActiveUser();
  if (!resourceIdSchema.safeParse(competitionId).success) {
    throw new PermissionError(404, "Competition not found.");
  }
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { id: true },
  });
  if (!competition) {
    throw new PermissionError(404, "Competition not found.");
  }

  const assignedRoles = await prisma.competitionRole.findMany({
    where: { userId: user.id, competitionId },
    select: { role: true },
  });
  const roles = assignedRoles.flatMap(({ role }) =>
    isCompetitionRole(role) ? [role] : [],
  );
  if (!can(user, roles, action)) {
    throw new PermissionError(
      403,
      "You do not have permission for this action.",
    );
  }

  return { user, roles };
}

export async function requireScorePermission(
  scoreId: string,
  action: CompetitionAction,
) {
  if (!resourceIdSchema.safeParse(scoreId).success) {
    throw new PermissionError(404, "Score not found.");
  }
  const score = await prisma.matchScore.findUnique({
    where: { id: scoreId },
    select: {
      id: true,
      match: { select: { competitionId: true } },
    },
  });
  if (!score) {
    throw new PermissionError(404, "Score not found.");
  }

  const access = await requireCompetitionPermission(
    score.match.competitionId,
    action,
  );
  return {
    ...access,
    scoreId: score.id,
    competitionId: score.match.competitionId,
  };
}

export async function requireMatchPermission(
  matchId: string,
  action: CompetitionAction,
) {
  if (!resourceIdSchema.safeParse(matchId).success) {
    throw new PermissionError(404, "Match not found.");
  }
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, competitionId: true },
  });
  if (!match) {
    throw new PermissionError(404, "Match not found.");
  }

  const access = await requireCompetitionPermission(
    match.competitionId,
    action,
  );
  return { ...access, matchId: match.id, competitionId: match.competitionId };
}
