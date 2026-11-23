"use server";

import { Prisma } from "@prisma/client";
import {
  computeRankings,
  computeTotalScore,
  type Alliance,
  type MatchInput,
  type RankingConfig,
  type ScoringConfig,
} from "@fcm/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@fcm/prisma";
import {
  PermissionError,
  requireMatchPermission,
  requireScorePermission,
} from "@/lib/permissions";

const scoreSheetSchema = z
  .object({
    minorFouls: z.number().int().min(0),
    majorFouls: z.number().int().min(0),
    entries: z.array(
      z
        .object({
          elementId: z.string().uuid(),
          count: z.number().int().min(0),
        })
        .strict(),
    ),
  })
  .strict();

const matchSheetsSchema = z
  .object({
    red: scoreSheetSchema,
    blue: scoreSheetSchema,
  })
  .strict();

const correctionReasonSchema = z.string().trim().min(5).max(500);

export type ScoreSheetSubmission = z.infer<typeof scoreSheetSchema>;
export type MatchScoreSubmission = z.infer<typeof matchSheetsSchema>;

export interface ScoreActionState {
  message: string;
  error?: boolean;
}

class ScoreWorkflowError extends Error {}

function failure(error: unknown): ScoreActionState {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return {
      message: "Scores changed during the update. Reload and try again.",
      error: true,
    };
  }
  if (error instanceof PermissionError || error instanceof ScoreWorkflowError) {
    return { message: error.message, error: true };
  }
  throw error;
}

async function loadMatch(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      competition: {
        include: {
          scoringConfig: {
            include: {
              phases: { include: { elements: true } },
              rankingConfig: true,
            },
          },
        },
      },
      teams: true,
      scores: { include: { entries: true } },
    },
  });
  if (!match) throw new ScoreWorkflowError("Match not found.");
  return match;
}

function validateSubmission(
  match: Awaited<ReturnType<typeof loadMatch>>,
  submission: MatchScoreSubmission,
) {
  const config = match.competition.scoringConfig;
  const elements = config.phases.flatMap((phase) => phase.elements);
  const elementById = new Map(elements.map((element) => [element.id, element]));

  for (const alliance of ["red", "blue"] as const) {
    const assigned = match.teams.filter((team) => team.alliance === alliance);
    if (assigned.length !== config.teamsPerAlliance) {
      throw new ScoreWorkflowError(
        `Match must have ${config.teamsPerAlliance} teams on ${alliance}.`,
      );
    }

    const seenElementIds = new Set<string>();
    for (const entry of submission[alliance].entries) {
      const element = elementById.get(entry.elementId);
      if (!element || seenElementIds.has(entry.elementId)) {
        throw new ScoreWorkflowError("A score entry is invalid or duplicated.");
      }
      if (element.maxCount !== null && entry.count > element.maxCount) {
        throw new ScoreWorkflowError(
          `${element.label} cannot exceed ${element.maxCount}.`,
        );
      }
      seenElementIds.add(entry.elementId);
    }
    if (seenElementIds.size !== elements.length) {
      throw new ScoreWorkflowError(
        "Include every scoring element for both alliances.",
      );
    }
  }

  return elementById;
}

function calculateTotals(
  submission: MatchScoreSubmission,
  elementById: Map<
    string,
    { id: string; points: number; maxCount: number | null }
  >,
  scoringConfig: ScoringConfig,
) {
  const totals: Record<Alliance, number> = { red: 0, blue: 0 };
  for (const alliance of ["red", "blue"] as const) {
    const opposingAlliance = alliance === "red" ? "blue" : "red";
    totals[alliance] = computeTotalScore(
      submission[alliance].entries.map((entry) => {
        const element = elementById.get(entry.elementId);
        if (!element) {
          throw new ScoreWorkflowError("A score entry is invalid.");
        }
        return { count: entry.count, points: element.points };
      }),
      submission[opposingAlliance],
      scoringConfig,
    );
  }
  return totals;
}

async function saveSheets(
  matchId: string,
  userId: string,
  submission: MatchScoreSubmission,
  status: "draft" | "submitted",
) {
  const match = await loadMatch(matchId);
  const elementById = validateSubmission(match, submission);
  const expectedTeamIds = match.teams.map((team) => team.teamId);
  const registeredTeamCount = await prisma.competitionTeam.count({
    where: {
      competitionId: match.competitionId,
      teamId: { in: expectedTeamIds },
    },
  });
  if (registeredTeamCount !== expectedTeamIds.length) {
    throw new ScoreWorkflowError(
      "Every match team must be registered for this competition.",
    );
  }

  const totals = calculateTotals(submission, elementById, {
    minorFoulPoints: match.competition.scoringConfig.minorFoulPoints,
    majorFoulPoints: match.competition.scoringConfig.majorFoulPoints,
  });

  await prisma.$transaction(async (transaction) => {
    for (const alliance of ["red", "blue"] as const) {
      const scoreData = submission[alliance];
      const existing = await transaction.matchScore.findUnique({
        where: { match_alliance: { matchId, alliance } },
      });
      if (existing && existing.status !== "draft") {
        throw new ScoreWorkflowError(
          "Only draft scores can be edited. Finalized scores require a correction.",
        );
      }

      let scoreId: string;
      if (existing) {
        const updated = await transaction.matchScore.updateMany({
          where: { id: existing.id, status: "draft" },
          data: {
            minorFouls: scoreData.minorFouls,
            majorFouls: scoreData.majorFouls,
            totalScore: totals[alliance],
            status,
            submittedBy: userId,
            finalizedBy: null,
            finalizedAt: null,
          },
        });
        if (updated.count !== 1) {
          throw new ScoreWorkflowError(
            "A score changed before saving. Reload and try again.",
          );
        }
        scoreId = existing.id;
      } else {
        const score = await transaction.matchScore.create({
          data: {
            matchId,
            alliance,
            minorFouls: scoreData.minorFouls,
            majorFouls: scoreData.majorFouls,
            totalScore: totals[alliance],
            status,
            submittedBy: userId,
          },
        });
        scoreId = score.id;
      }

      await transaction.scoreEntry.deleteMany({
        where: { matchScoreId: scoreId },
      });
      const savedEntries = scoreData.entries.filter((entry) => entry.count > 0);
      if (savedEntries.length > 0) {
        await transaction.scoreEntry.createMany({
          data: savedEntries.map((entry) => ({
            matchScoreId: scoreId,
            elementId: entry.elementId,
            count: entry.count,
          })),
        });
      }
    }
  });

  revalidatePath("/workspace");
  revalidatePath("/workspace/matches");
  revalidatePath(`/workspace/matches/${matchId}/score`);
  revalidatePath("/workspace/rankings");
  return totals;
}

export async function saveScoreDrafts(
  matchId: string,
  input: unknown,
): Promise<ScoreActionState> {
  try {
    const { user } = await requireMatchPermission(matchId, "score.submit");
    const parsed = matchSheetsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        message: "Enter non-negative whole-number values for both alliances.",
        error: true,
      };
    }
    await saveSheets(matchId, user.id, parsed.data, "draft");
    return { message: "Draft scores saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function submitScoreSheets(
  matchId: string,
  input: unknown,
): Promise<ScoreActionState> {
  try {
    const { user } = await requireMatchPermission(matchId, "score.submit");
    const parsed = matchSheetsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        message: "Enter non-negative whole-number values for both alliances.",
        error: true,
      };
    }
    await saveSheets(matchId, user.id, parsed.data, "submitted");
    return { message: "Both alliance score sheets were submitted." };
  } catch (error) {
    return failure(error);
  }
}

export async function finalizeMatchScores(
  matchId: string,
): Promise<ScoreActionState> {
  try {
    const { user, competitionId } = await requireMatchPermission(
      matchId,
      "score.finalize",
    );
    const match = await loadMatch(matchId);
    if (match.scores.length !== 2) {
      throw new ScoreWorkflowError(
        "Both alliance score sheets must be submitted before finalization.",
      );
    }
    for (const score of match.scores) {
      await requireScorePermission(score.id, "score.finalize");
      if (score.status !== "submitted") {
        throw new ScoreWorkflowError("Only submitted scores can be finalized.");
      }
    }

    await prisma.$transaction(
      async (transaction) => {
        for (const score of match.scores) {
          const updated = await transaction.matchScore.updateMany({
            where: { id: score.id, status: "submitted" },
            data: {
              status: "finalized",
              finalizedBy: user.id,
              finalizedAt: new Date(),
            },
          });
          if (updated.count !== 1) {
            throw new ScoreWorkflowError(
              "A score changed before finalization. Reload and try again.",
            );
          }
        }
        await transaction.match.update({
          where: { id: matchId },
          data: { status: "completed" },
        });
        await recalculateRankings(transaction, competitionId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/workspace");
    revalidatePath("/workspace/matches");
    revalidatePath(`/workspace/matches/${matchId}/score`);
    revalidatePath("/workspace/rankings");
    return { message: "Scores finalized and rankings updated." };
  } catch (error) {
    return failure(error);
  }
}

export async function correctMatchScores(
  matchId: string,
  input: unknown,
  reasonInput: unknown,
): Promise<ScoreActionState> {
  try {
    const { user, competitionId } = await requireMatchPermission(
      matchId,
      "score.correct",
    );
    const match = await loadMatch(matchId);
    if (match.scores.length !== 2) {
      throw new ScoreWorkflowError("Both finalized score sheets are required.");
    }
    for (const score of match.scores) {
      await requireScorePermission(score.id, "score.correct");
      if (score.status !== "finalized") {
        throw new ScoreWorkflowError("Only finalized scores can be corrected.");
      }
    }

    const parsed = matchSheetsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        message: "Enter non-negative whole-number values for both alliances.",
        error: true,
      };
    }
    const parsedReason = correctionReasonSchema.safeParse(reasonInput);
    if (!parsedReason.success) {
      return {
        message: "Enter a correction reason between 5 and 500 characters.",
        error: true,
      };
    }
    const reason = parsedReason.data;

    const elementById = validateSubmission(match, parsed.data);
    const totals = calculateTotals(parsed.data, elementById, {
      minorFoulPoints: match.competition.scoringConfig.minorFoulPoints,
      majorFoulPoints: match.competition.scoringConfig.majorFoulPoints,
    });

    await prisma.$transaction(
      async (transaction) => {
        const scoreIds = match.scores.map((score) => score.id);
        await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "match_score"
        WHERE "id" IN (${Prisma.join(scoreIds)})
        ORDER BY "id"
        FOR UPDATE
      `;
        const currentScores = await transaction.matchScore.findMany({
          where: { id: { in: scoreIds } },
          include: { entries: true },
        });
        for (const score of match.scores) {
          const current = currentScores.find(({ id }) => id === score.id);
          const currentEntries = new Map<string, number>();
          for (const entry of current?.entries ?? []) {
            currentEntries.set(entry.elementId, entry.count);
          }
          if (
            !current ||
            current.status !== "finalized" ||
            current.minorFouls !== score.minorFouls ||
            current.majorFouls !== score.majorFouls ||
            current.totalScore !== score.totalScore ||
            current.finalizedBy !== score.finalizedBy ||
            current.finalizedAt?.getTime() !== score.finalizedAt?.getTime() ||
            currentEntries.size !== score.entries.length ||
            score.entries.some(
              (entry) => currentEntries.get(entry.elementId) !== entry.count,
            )
          ) {
            throw new ScoreWorkflowError(
              "A score changed before correction. Reload and try again.",
            );
          }
        }

        for (const score of match.scores) {
          const alliance = score.alliance;
          const scoreData = parsed.data[alliance];
          const updated = await transaction.matchScore.updateMany({
            where: { id: score.id, status: "finalized" },
            data: {
              minorFouls: scoreData.minorFouls,
              majorFouls: scoreData.majorFouls,
              totalScore: totals[alliance],
              finalizedBy: user.id,
              finalizedAt: new Date(),
            },
          });
          if (updated.count !== 1) {
            throw new ScoreWorkflowError(
              "A score changed before correction. Reload and try again.",
            );
          }

          await transaction.scoreAudit.create({
            data: {
              matchScoreId: score.id,
              changedBy: user.id,
              oldValue: {
                minorFouls: score.minorFouls,
                majorFouls: score.majorFouls,
                totalScore: score.totalScore,
                entries: score.entries.map(({ elementId, count }) => ({
                  elementId,
                  count,
                })),
              } satisfies Prisma.InputJsonValue,
              newValue: {
                minorFouls: scoreData.minorFouls,
                majorFouls: scoreData.majorFouls,
                totalScore: totals[alliance],
                entries: scoreData.entries
                  .filter((entry) => entry.count > 0)
                  .map(({ elementId, count }) => ({ elementId, count })),
              } satisfies Prisma.InputJsonValue,
              reason,
            },
          });

          await transaction.scoreEntry.deleteMany({
            where: { matchScoreId: score.id },
          });
          const entries = scoreData.entries.filter((entry) => entry.count > 0);
          if (entries.length > 0) {
            await transaction.scoreEntry.createMany({
              data: entries.map((entry) => ({
                matchScoreId: score.id,
                elementId: entry.elementId,
                count: entry.count,
              })),
            });
          }
        }
        await recalculateRankings(transaction, competitionId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/workspace");
    revalidatePath("/workspace/matches");
    revalidatePath(`/workspace/matches/${matchId}/score`);
    revalidatePath("/workspace/rankings");
    return { message: "Score correction saved and audited." };
  } catch (error) {
    return failure(error);
  }
}

async function recalculateRankings(
  transaction: Prisma.TransactionClient,
  competitionId: string,
) {
  const registeredTeams = await transaction.competitionTeam.findMany({
    where: { competitionId },
    select: { teamId: true },
  });
  const matchRecords = await transaction.match.findMany({
    where: { competitionId, stage: "qualification" },
    include: {
      teams: true,
      scores: { include: { entries: { include: { element: true } } } },
    },
  });
  const config = await transaction.competition.findUnique({
    where: { id: competitionId },
    include: { scoringConfig: { include: { rankingConfig: true } } },
  });
  if (!config?.scoringConfig.rankingConfig) {
    throw new ScoreWorkflowError(
      "The competition has no ranking configuration.",
    );
  }
  const rankingConfig: RankingConfig = {
    winRp: config.scoringConfig.rankingConfig.winRp,
    tieRp: config.scoringConfig.rankingConfig.tieRp,
    lossRp: config.scoringConfig.rankingConfig.lossRp,
    tiebreakerPointsRule:
      config.scoringConfig.rankingConfig.tiebreakerPointsRule,
    aggregation: config.scoringConfig.rankingConfig.aggregation,
    tiebreakerOrder: config.scoringConfig.rankingConfig.tiebreakerOrder,
  };
  const scoringConfig: ScoringConfig = {
    minorFoulPoints: config.scoringConfig.minorFoulPoints,
    majorFoulPoints: config.scoringConfig.majorFoulPoints,
  };
  const rankingMatches: MatchInput[] = matchRecords.map((record) => {
    const scores: MatchInput["scores"] = {};
    for (const score of record.scores) {
      scores[score.alliance] = {
        status: score.status,
        minorFouls: score.minorFouls,
        majorFouls: score.majorFouls,
        entries: score.entries.map((entry) => ({
          count: entry.count,
          points: entry.element.points,
        })),
      };
    }
    return {
      id: record.id,
      teams: record.teams.map((team) => ({
        teamId: team.teamId,
        alliance: team.alliance,
        isSurrogate: team.isSurrogate,
        isDq: team.isDq,
      })),
      scores,
    };
  });
  const rankings = computeRankings(
    registeredTeams.map(({ teamId }) => teamId),
    rankingMatches,
    scoringConfig,
    rankingConfig,
  );

  await transaction.ranking.deleteMany({
    where: { competitionId, stage: "qualification" },
  });
  if (rankings.length > 0) {
    await transaction.ranking.createMany({
      data: rankings.map((ranking) => ({
        competitionId,
        stage: "qualification",
        teamId: ranking.teamId,
        rank: ranking.rank,
        matchesPlayed: ranking.matchesPlayed,
        wins: ranking.wins,
        losses: ranking.losses,
        ties: ranking.ties,
        rankingPoints: ranking.rankingPoints,
        tiebreakerPoints: ranking.tiebreakerPoints,
        totalPoints: ranking.totalPoints,
        highestScore: ranking.highestScore,
      })),
    });
  }
}
