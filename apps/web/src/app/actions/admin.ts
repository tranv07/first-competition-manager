"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  competitionSchema,
  competitionUpdateSchema,
  matchSchema,
  matchUpdateSchema,
  scheduleConfigSchema,
  teamSchema,
  teamUpdateSchema,
  validateSchedule,
  type ScheduleMatch,
  type ScheduleWarning,
} from "@fcm/shared";
import { prisma } from "@fcm/prisma";
import {
  PermissionError,
  requireCompetitionPermission,
  requireMatchPermission,
  requireSuperAdmin,
} from "@/lib/permissions";

export interface AdminActionState {
  message: string;
  warnings?: ScheduleWarning[];
  error?: boolean;
}

function failure(error: unknown): AdminActionState {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return { message: "This value must be unique.", error: true };
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2003" || error.code === "P2025")
  ) {
    return {
      message: "This item cannot be changed because related data exists.",
      error: true,
    };
  }
  if (error instanceof PermissionError) {
    return { message: error.message, error: true };
  }
  if (error instanceof AdminWorkflowError) {
    return { message: error.message, error: true };
  }
  throw error;
}

class AdminWorkflowError extends Error {}

function revalidateAdmin() {
  revalidatePath("/workspace");
  revalidatePath("/workspace/events");
  revalidatePath("/workspace/teams");
  revalidatePath("/workspace/matches");
  revalidatePath("/workspace/rankings");
  revalidatePath("/workspace/admin");
}

export async function createCompetition(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireSuperAdmin();
    const input = competitionSchema.parse({
      name: formData.get("name"),
      program: formData.get("program"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      location: formData.get("location") || null,
      scoringConfigId: formData.get("scoringConfigId"),
    });
    const config = await prisma.scoringConfig.findUnique({
      where: { id: input.scoringConfigId },
      select: { program: true },
    });
    if (!config) throw new AdminWorkflowError("Scoring config not found.");
    if (config.program !== input.program) {
      throw new AdminWorkflowError(
        "The scoring config program must match the competition program.",
      );
    }
    await prisma.competition.create({
      data: {
        name: input.name,
        program: input.program,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        location: input.location,
        scoringConfigId: input.scoringConfigId,
      },
    });
    revalidateAdmin();
    return { message: "Competition created." };
  } catch (error) {
    return failure(error);
  }
}

export async function updateCompetition(
  competitionId: string,
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireCompetitionPermission(competitionId, "competition.edit");
    const rawStatus = formData.get("status");
    const input = competitionUpdateSchema.parse({
      name: formData.get("name") || undefined,
      startDate: formData.get("startDate") || undefined,
      endDate: formData.get("endDate") || undefined,
      location: formData.get("location") || null,
      status: rawStatus || undefined,
    });
    const current = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { startDate: true, endDate: true },
    });
    if (!current) throw new AdminWorkflowError("Competition not found.");
    const startDate = input.startDate
      ? new Date(input.startDate)
      : current.startDate;
    const endDate = input.endDate ? new Date(input.endDate) : current.endDate;
    if (endDate < startDate) {
      throw new AdminWorkflowError("End date cannot be before start date.");
    }
    await prisma.competition.update({
      where: { id: competitionId },
      data: {
        name: input.name,
        startDate,
        endDate,
        location: input.location,
        status: input.status,
      },
    });
    revalidateAdmin();
    return { message: "Competition updated." };
  } catch (error) {
    return failure(error);
  }
}

export async function assignScoringConfig(
  competitionId: string,
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireCompetitionPermission(competitionId, "config.edit");
    const scoringConfigId = String(formData.get("scoringConfigId"));
    const [competition, scoreCount] = await Promise.all([
      prisma.competition.findUnique({
        where: { id: competitionId },
        include: { matches: { include: { scores: true } } },
      }),
      prisma.matchScore.count({
        where: { match: { competitionId } },
      }),
    ]);
    if (!competition) throw new AdminWorkflowError("Competition not found.");
    if (scoreCount > 0) {
      throw new AdminWorkflowError(
        "The scoring config is locked because scores exist.",
      );
    }
    const config = await prisma.scoringConfig.findUnique({
      where: { id: scoringConfigId },
      select: { program: true },
    });
    if (!config) throw new AdminWorkflowError("Scoring config not found.");
    if (config.program !== competition.program) {
      throw new AdminWorkflowError(
        "The scoring config program must match the competition program.",
      );
    }
    await prisma.competition.update({
      where: { id: competitionId },
      data: { scoringConfigId },
    });
    revalidateAdmin();
    return { message: "Scoring config assigned." };
  } catch (error) {
    return failure(error);
  }
}

export async function createTeam(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireSuperAdmin();
    const input = teamSchema.parse({
      program: formData.get("program"),
      teamNumber: Number(formData.get("teamNumber")),
      name: formData.get("name"),
      organization: formData.get("organization"),
      city: formData.get("city") || null,
      coachName: formData.get("coachName"),
      robotName: formData.get("robotName") || null,
      logoUrl: formData.get("logoUrl") || null,
      contactEmail: formData.get("contactEmail"),
    });
    await prisma.team.create({ data: input });
    revalidateAdmin();
    return { message: "Team created." };
  } catch (error) {
    return failure(error);
  }
}

export async function updateTeam(
  teamId: string,
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireSuperAdmin();
    const input = teamUpdateSchema.parse({
      program: formData.get("program") || undefined,
      teamNumber: formData.get("teamNumber")
        ? Number(formData.get("teamNumber"))
        : undefined,
      name: formData.get("name") || undefined,
      organization: formData.get("organization") || undefined,
      city: formData.get("city") || null,
      coachName: formData.get("coachName") || undefined,
      robotName: formData.get("robotName") || null,
      logoUrl: formData.get("logoUrl") || null,
      contactEmail: formData.get("contactEmail") || undefined,
    });
    await prisma.team.update({ where: { id: teamId }, data: input });
    revalidateAdmin();
    return { message: "Team updated." };
  } catch (error) {
    return failure(error);
  }
}

export async function registerTeam(
  competitionId: string,
  teamId: string,
): Promise<AdminActionState> {
  try {
    await requireCompetitionPermission(competitionId, "competition.edit");
    const [competition, team] = await Promise.all([
      prisma.competition.findUnique({ where: { id: competitionId } }),
      prisma.team.findUnique({ where: { id: teamId } }),
    ]);
    if (!competition || !team) throw new AdminWorkflowError("Item not found.");
    if (competition.program !== team.program) {
      throw new AdminWorkflowError(
        "The team program must match the competition program.",
      );
    }
    await prisma.competitionTeam.create({
      data: { competitionId, teamId },
    });
    revalidateAdmin();
    return { message: "Team registered." };
  } catch (error) {
    return failure(error);
  }
}

export async function unregisterTeam(
  competitionId: string,
  teamId: string,
): Promise<AdminActionState> {
  try {
    await requireCompetitionPermission(competitionId, "competition.edit");
    const matchCount = await prisma.matchTeam.count({
      where: { teamId, match: { competitionId } },
    });
    if (matchCount > 0) {
      throw new AdminWorkflowError(
        "This team cannot be unregistered because it has match rows.",
      );
    }
    await prisma.competitionTeam.delete({
      where: { competitionId_teamId: { competitionId, teamId } },
    });
    revalidateAdmin();
    return { message: "Team unregistered." };
  } catch (error) {
    return failure(error);
  }
}

export async function createMatch(
  competitionId: string,
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireCompetitionPermission(competitionId, "match.update_status");
    const teams = JSON.parse(String(formData.get("teams"))) as unknown;
    const input = matchSchema.parse({
      stage: formData.get("stage"),
      round: formData.get("round") ? Number(formData.get("round")) : null,
      series: formData.get("series") ? Number(formData.get("series")) : null,
      matchNumber: Number(formData.get("matchNumber")),
      scheduledTime: formData.get("scheduledTime") || null,
      fieldNumber: formData.get("fieldNumber")
        ? Number(formData.get("fieldNumber"))
        : null,
      teams,
    });
    await validateMatchWrite(competitionId, input.teams, input);
    await prisma.match.create({
      data: {
        competitionId,
        stage: input.stage,
        round: input.round,
        series: input.series,
        matchNumber: input.matchNumber,
        scheduledTime: input.scheduledTime
          ? new Date(input.scheduledTime)
          : null,
        fieldNumber: input.fieldNumber,
        teams: {
          create: input.teams.map((team) => ({
            teamId: team.teamId,
            alliance: team.alliance,
            isSurrogate: team.isSurrogate,
          })),
        },
      },
    });
    revalidateAdmin();
    return { message: "Match created." };
  } catch (error) {
    return failure(error);
  }
}

async function validateMatchWrite(
  competitionId: string,
  teams: { teamId: string; alliance: "red" | "blue"; isSurrogate: boolean }[],
  input: {
    stage: "qualification" | "playoff" | "final";
    matchNumber: number;
    scheduledTime?: string | null;
    fieldNumber?: number | null;
  },
  excludedMatchId?: string,
) {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      scoringConfig: { select: { teamsPerAlliance: true } },
      teams: { select: { teamId: true } },
    },
  });
  if (!competition) throw new AdminWorkflowError("Competition not found.");

  const teamIds = teams.map((team) => team.teamId);
  if (new Set(teamIds).size !== teamIds.length) {
    throw new AdminWorkflowError("A team appears more than once in the match.");
  }
  for (const alliance of ["red", "blue"] as const) {
    const count = teams.filter((team) => team.alliance === alliance).length;
    if (count !== competition.scoringConfig.teamsPerAlliance) {
      throw new AdminWorkflowError(
        `Each alliance must contain ${competition.scoringConfig.teamsPerAlliance} teams.`,
      );
    }
  }
  const registeredIds = new Set(competition.teams.map((team) => team.teamId));
  if (teamIds.some((teamId) => !registeredIds.has(teamId))) {
    throw new AdminWorkflowError(
      "Every team in a match must be registered for the competition.",
    );
  }
  const duplicate = await prisma.match.findFirst({
    where: {
      competitionId,
      stage: input.stage,
      matchNumber: input.matchNumber,
      ...(excludedMatchId ? { id: { not: excludedMatchId } } : {}),
    },
  });
  if (duplicate) {
    throw new AdminWorkflowError(
      "This match number is already used in this stage.",
    );
  }
  if (input.scheduledTime && input.fieldNumber) {
    const conflict = await prisma.match.findFirst({
      where: {
        competitionId,
        fieldNumber: input.fieldNumber,
        scheduledTime: new Date(input.scheduledTime),
        ...(excludedMatchId ? { id: { not: excludedMatchId } } : {}),
      },
    });
    if (conflict) {
      throw new AdminWorkflowError(
        "Another match uses this field at the same time.",
      );
    }
  }
}

export async function updateMatch(
  matchId: string,
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireMatchPermission(matchId, "match.update_status");
    const scoreCount = await prisma.matchScore.count({ where: { matchId } });
    if (scoreCount > 0) {
      throw new AdminWorkflowError(
        "This match is locked because it has score data.",
      );
    }
    const teamsValue = formData.get("teams");
    const teams = teamsValue
      ? (JSON.parse(String(teamsValue)) as unknown)
      : undefined;
    const input = matchUpdateSchema.parse({
      round: formData.get("round") ? Number(formData.get("round")) : null,
      series: formData.get("series") ? Number(formData.get("series")) : null,
      matchNumber: formData.get("matchNumber")
        ? Number(formData.get("matchNumber"))
        : undefined,
      scheduledTime: formData.get("scheduledTime") || null,
      fieldNumber: formData.get("fieldNumber")
        ? Number(formData.get("fieldNumber"))
        : null,
      status: formData.get("status") || undefined,
      teams,
    });
    const current = await prisma.match.findUnique({
      where: { id: matchId },
      include: { teams: true },
    });
    if (!current) throw new AdminWorkflowError("Match not found.");
    if (
      input.matchNumber ||
      input.scheduledTime ||
      input.fieldNumber ||
      input.teams
    ) {
      await validateMatchWrite(
        current.competitionId,
        input.teams ??
          current.teams.map((team) => ({
            teamId: team.teamId,
            alliance: team.alliance,
            isSurrogate: team.isSurrogate,
          })),
        {
          stage: current.stage,
          matchNumber: input.matchNumber ?? current.matchNumber,
          scheduledTime:
            input.scheduledTime ?? current.scheduledTime?.toISOString(),
          fieldNumber: input.fieldNumber ?? current.fieldNumber,
        },
        matchId,
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          round: input.round,
          series: input.series,
          matchNumber: input.matchNumber,
          scheduledTime: input.scheduledTime
            ? new Date(input.scheduledTime)
            : input.scheduledTime === null
              ? null
              : undefined,
          fieldNumber: input.fieldNumber,
          status: input.status,
        },
      });
      if (input.teams) {
        await tx.matchTeam.deleteMany({ where: { matchId } });
        await tx.matchTeam.createMany({
          data: input.teams.map((team) => ({
            matchId,
            teamId: team.teamId,
            alliance: team.alliance,
            isSurrogate: team.isSurrogate,
          })),
        });
      }
    });
    revalidateAdmin();
    return { message: "Match updated." };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteMatch(matchId: string): Promise<AdminActionState> {
  try {
    await requireMatchPermission(matchId, "match.update_status");
    const scoreCount = await prisma.matchScore.count({ where: { matchId } });
    if (scoreCount > 0) {
      throw new AdminWorkflowError(
        "This match cannot be deleted because it has score data.",
      );
    }
    await prisma.match.delete({ where: { id: matchId } });
    revalidateAdmin();
    return { message: "Match deleted." };
  } catch (error) {
    return failure(error);
  }
}

export async function updateScheduleConfig(
  competitionId: string,
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireCompetitionPermission(competitionId, "config.edit");
    const input = scheduleConfigSchema.parse({
      matchesPerTeam: Number(formData.get("matchesPerTeam")),
      numberOfFields: Number(formData.get("numberOfFields")),
      cycleTimeMinutes: Number(formData.get("cycleTimeMinutes")),
      startTime: formData.get("startTime"),
      minMatchesBetween: Number(formData.get("minMatchesBetween")),
      randomSeed: formData.get("randomSeed")
        ? Number(formData.get("randomSeed"))
        : null,
    });
    await prisma.scheduleConfig.upsert({
      where: { competitionId },
      create: { competitionId, ...input },
      update: input,
    });
    revalidateAdmin();
    return { message: "Schedule config saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function validateScheduleAction(
  competitionId: string,
): Promise<AdminActionState> {
  try {
    await requireCompetitionPermission(competitionId, "config.edit");
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        teams: { select: { teamId: true } },
        matches: {
          where: { stage: "qualification" },
          include: { teams: { select: { teamId: true } } },
        },
        scheduleConfig: true,
      },
    });
    if (!competition?.scheduleConfig) {
      throw new AdminWorkflowError("Set the schedule config first.");
    }
    const matches: ScheduleMatch[] = competition.matches
      .filter((match) => match.scheduledTime && match.fieldNumber)
      .map((match) => ({
        matchNumber: match.matchNumber,
        scheduledTime: match.scheduledTime!.toISOString(),
        fieldNumber: match.fieldNumber!,
        teamIds: match.teams.map((team) => team.teamId),
      }));
    const warnings = validateSchedule(
      competition.teams.map((team) => team.teamId),
      matches,
      competition.scheduleConfig,
    );
    return {
      message:
        warnings.length === 0
          ? "Schedule validation passed."
          : `Schedule validation found ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`,
      warnings,
    };
  } catch (error) {
    return failure(error);
  }
}
