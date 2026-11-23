import { PrismaClient, type Prisma } from "@prisma/client";
import {
  computeRankings,
  computeTotalScore,
  type Alliance,
  type MatchInput,
  type RankingConfig,
  type ScoringConfig,
} from "@fcm/shared";
import { Hono } from "hono";
import { z } from "zod";

const prisma = new PrismaClient();
const app = new Hono();

const scoreSubmissionSchema = z
  .object({
    minorFouls: z.number().int().min(0),
    majorFouls: z.number().int().min(0),
    entries: z.array(
      z.object({
        elementId: z.string().uuid(),
        count: z.number().int().min(0),
      }),
    ),
  })
  .strict();

const finalizeSubmissionSchema = z
  .object({
    red: scoreSubmissionSchema,
    blue: scoreSubmissionSchema,
  })
  .strict();

const demoCompetitionName = "FTC Test Invitational";
const demoScorerUsername = "demo-scorekeeper";

app.onError((error, context) => {
  console.error("API request failed:", error);
  return context.json({ error: "The request could not be completed." }, 500);
});

app.get("/api/health", (context) => context.json({ status: "ok" }));

app.get("/api/demo", async (context) => {
  const competition = await prisma.competition.findFirst({
    where: { name: demoCompetitionName, program: "ftc" },
    include: {
      scoringConfig: {
        include: {
          phases: {
            orderBy: { position: "asc" },
            include: { elements: { orderBy: { key: "asc" } } },
          },
        },
      },
      teams: {
        include: { team: true },
        orderBy: { team: { teamNumber: "asc" } },
      },
      matches: {
        where: { stage: "qualification", matchNumber: 1 },
        include: {
          teams: {
            include: { team: true },
            orderBy: { team: { teamNumber: "asc" } },
          },
          scores: { include: { entries: true } },
        },
      },
      rankings: {
        where: { stage: "qualification" },
        include: { team: true },
        orderBy: { rank: "asc" },
      },
    },
  });

  if (!competition) {
    return context.json(
      { error: "Demo competition not found. Run `npm run db:seed` first." },
      404,
    );
  }

  const match = competition.matches[0];
  if (!match) {
    return context.json(
      { error: "Demo match not found. Run `npm run db:seed` first." },
      404,
    );
  }

  return context.json({
    competition: {
      id: competition.id,
      name: competition.name,
      location: competition.location,
      startDate: competition.startDate.toISOString(),
      endDate: competition.endDate.toISOString(),
      status: competition.status,
      scoringConfig: {
        minorFoulPoints: competition.scoringConfig.minorFoulPoints,
        majorFoulPoints: competition.scoringConfig.majorFoulPoints,
        phases: competition.scoringConfig.phases.map((phase) => ({
          id: phase.id,
          key: phase.key,
          label: phase.label,
          elements: phase.elements.map((element) => ({
            id: element.id,
            key: element.key,
            label: element.label,
            points: element.points,
            maxCount: element.maxCount,
          })),
        })),
      },
      registeredTeams: competition.teams.map(({ team }) => ({
        id: team.id,
        number: team.teamNumber,
        name: team.name,
      })),
    },
    match: {
      id: match.id,
      number: match.matchNumber,
      status: match.status,
      scheduledTime: match.scheduledTime?.toISOString() ?? null,
      teams: match.teams.map(({ team, alliance, isSurrogate, isDq }) => ({
        id: team.id,
        number: team.teamNumber,
        name: team.name,
        alliance,
        isSurrogate,
        isDq,
      })),
      scores: match.scores.map((score) => ({
        alliance: score.alliance,
        status: score.status,
        minorFouls: score.minorFouls,
        majorFouls: score.majorFouls,
        totalScore: score.totalScore,
        entries: score.entries.map((entry) => ({
          elementId: entry.elementId,
          count: entry.count,
        })),
      })),
    },
    rankings: competition.rankings.map((ranking) => ({
      teamId: ranking.teamId,
      teamNumber: ranking.team.teamNumber,
      teamName: ranking.team.name,
      rank: ranking.rank,
      matchesPlayed: ranking.matchesPlayed,
      wins: ranking.wins,
      losses: ranking.losses,
      ties: ranking.ties,
      rankingPoints: Number(ranking.rankingPoints),
      tiebreakerPoints: Number(ranking.tiebreakerPoints),
      totalPoints: ranking.totalPoints,
      highestScore: ranking.highestScore,
    })),
  });
});

app.post("/api/matches/:matchId/finalize", async (context) => {
  let requestBody: unknown;
  try {
    requestBody = await context.req.json();
  } catch {
    return context.json({ error: "Request body must be valid JSON." }, 400);
  }
  const parsedBody = finalizeSubmissionSchema.safeParse(requestBody);
  if (!parsedBody.success) {
    return context.json(
      { error: "Enter non-negative whole-number counts for both alliances." },
      400,
    );
  }

  const matchId = context.req.param("matchId");
  if (!z.string().uuid().safeParse(matchId).success) {
    return context.json({ error: "Match not found." }, 404);
  }

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
    },
  });

  if (!match) {
    return context.json({ error: "Match not found." }, 404);
  }

  const scoringConfig = match.competition.scoringConfig;
  const rankingConfig = scoringConfig.rankingConfig;
  if (!rankingConfig) {
    return context.json(
      { error: "The competition has no ranking configuration." },
      409,
    );
  }

  const expectedTeamCount = scoringConfig.teamsPerAlliance;
  for (const alliance of ["red", "blue"] as const) {
    const assigned = match.teams.filter((team) => team.alliance === alliance);
    if (assigned.length !== expectedTeamCount) {
      return context.json(
        { error: `Match must have ${expectedTeamCount} teams on ${alliance}.` },
        409,
      );
    }

    const registered = await prisma.competitionTeam.count({
      where: {
        competitionId: match.competitionId,
        teamId: { in: assigned.map((team) => team.teamId) },
      },
    });
    if (registered !== expectedTeamCount) {
      return context.json(
        { error: "Every match team must be registered for this competition." },
        409,
      );
    }
  }

  const elements = scoringConfig.phases.flatMap((phase) => phase.elements);
  const elementById = new Map(elements.map((element) => [element.id, element]));
  for (const alliance of ["red", "blue"] as const) {
    const entries = parsedBody.data[alliance].entries;
    const seenElementIds = new Set<string>();
    for (const entry of entries) {
      const element = elementById.get(entry.elementId);
      if (!element || seenElementIds.has(entry.elementId)) {
        return context.json(
          { error: "A score entry is invalid or duplicated." },
          400,
        );
      }
      if (element.maxCount !== null && entry.count > element.maxCount) {
        return context.json(
          { error: `${element.label} cannot exceed ${element.maxCount}.` },
          400,
        );
      }
      seenElementIds.add(entry.elementId);
    }
  }

  const scorer = await prisma.user.findUnique({
    where: { username: demoScorerUsername },
  });
  if (!scorer) {
    return context.json(
      { error: "Demo scorer not found. Run `npm run db:seed` first." },
      409,
    );
  }

  const submittedScores = parsedBody.data;
  const calculatedTotals: Record<Alliance, number> = {
    red: 0,
    blue: 0,
  };
  for (const alliance of ["red", "blue"] as const) {
    const opposingAlliance = alliance === "red" ? "blue" : "red";
    calculatedTotals[alliance] = computeTotalScore(
      submittedScores[alliance].entries.map((entry) => ({
        count: entry.count,
        points: elementById.get(entry.elementId)!.points,
      })),
      submittedScores[opposingAlliance],
      scoringConfig,
    );
  }

  const rankingSettings: RankingConfig = {
    winRp: rankingConfig.winRp,
    tieRp: rankingConfig.tieRp,
    lossRp: rankingConfig.lossRp,
    tiebreakerPointsRule: rankingConfig.tiebreakerPointsRule,
    aggregation: rankingConfig.aggregation,
    tiebreakerOrder: rankingConfig.tiebreakerOrder,
  };
  const scoringSettings: ScoringConfig = {
    minorFoulPoints: scoringConfig.minorFoulPoints,
    majorFoulPoints: scoringConfig.majorFoulPoints,
  };

  const rankings = await prisma.$transaction(async (transaction) => {
    for (const alliance of ["red", "blue"] as const) {
      const submission = submittedScores[alliance];
      const entries = submission.entries.filter((entry) => entry.count > 0);
      const existing = await transaction.matchScore.findUnique({
        where: { match_alliance: { matchId: match.id, alliance } },
        include: { entries: true },
      });

      const oldSnapshot = existing
        ? {
            minorFouls: existing.minorFouls,
            majorFouls: existing.majorFouls,
            totalScore: existing.totalScore,
            entries: existing.entries.map(({ elementId, count }) => ({
              elementId,
              count,
            })),
          }
        : null;
      const newSnapshot = {
        minorFouls: submission.minorFouls,
        majorFouls: submission.majorFouls,
        totalScore: calculatedTotals[alliance],
        entries: entries.map(({ elementId, count }) => ({ elementId, count })),
      };

      const scoreRecord = await transaction.matchScore.upsert({
        where: { match_alliance: { matchId: match.id, alliance } },
        create: {
          matchId: match.id,
          alliance,
          minorFouls: submission.minorFouls,
          majorFouls: submission.majorFouls,
          totalScore: calculatedTotals[alliance],
          submittedBy: scorer.id,
          finalizedBy: scorer.id,
          finalizedAt: new Date(),
          status: "finalized",
        },
        update: {
          minorFouls: submission.minorFouls,
          majorFouls: submission.majorFouls,
          totalScore: calculatedTotals[alliance],
          finalizedBy: scorer.id,
          finalizedAt: new Date(),
          status: "finalized",
        },
      });

      if (existing?.status === "finalized" && oldSnapshot) {
        if (JSON.stringify(oldSnapshot) !== JSON.stringify(newSnapshot)) {
          await transaction.scoreAudit.create({
            data: {
              matchScoreId: scoreRecord.id,
              changedBy: scorer.id,
              oldValue: oldSnapshot as Prisma.InputJsonValue,
              newValue: newSnapshot as Prisma.InputJsonValue,
              reason: "Score correction through the demo scoring page",
            },
          });
        }
      }

      await transaction.scoreEntry.deleteMany({
        where: { matchScoreId: scoreRecord.id },
      });
      if (entries.length > 0) {
        await transaction.scoreEntry.createMany({
          data: entries.map((entry) => ({
            matchScoreId: scoreRecord.id,
            elementId: entry.elementId,
            count: entry.count,
          })),
        });
      }
    }

    await transaction.match.update({
      where: { id: match.id },
      data: { status: "completed" },
    });

    const registeredTeams = await transaction.competitionTeam.findMany({
      where: { competitionId: match.competitionId },
      select: { teamId: true },
    });
    const matchRecords = await transaction.match.findMany({
      where: {
        competitionId: match.competitionId,
        stage: "qualification",
      },
      include: {
        teams: true,
        scores: { include: { entries: { include: { element: true } } } },
      },
    });

    const rankingMatches: MatchInput[] = matchRecords.map((record) => ({
      id: record.id,
      teams: record.teams.map((team) => ({
        teamId: team.teamId,
        alliance: team.alliance,
        isSurrogate: team.isSurrogate,
        isDq: team.isDq,
      })),
      scores: Object.fromEntries(
        record.scores.map((score) => [
          score.alliance,
          {
            status: score.status,
            minorFouls: score.minorFouls,
            majorFouls: score.majorFouls,
            entries: score.entries.map((entry) => ({
              count: entry.count,
              points: entry.element.points,
            })),
          },
        ]),
      ),
    }));

    const computedRankings = computeRankings(
      registeredTeams.map(({ teamId }) => teamId),
      rankingMatches,
      scoringSettings,
      rankingSettings,
    );

    await transaction.ranking.deleteMany({
      where: {
        competitionId: match.competitionId,
        stage: "qualification",
      },
    });
    if (computedRankings.length > 0) {
      await transaction.ranking.createMany({
        data: computedRankings.map((ranking) => ({
          competitionId: match.competitionId,
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

    return transaction.ranking.findMany({
      where: {
        competitionId: match.competitionId,
        stage: "qualification",
      },
      include: { team: true },
      orderBy: [{ rank: "asc" }, { team: { teamNumber: "asc" } }],
    });
  });

  return context.json({
    message: "Scores finalized and rankings updated.",
    scores: calculatedTotals,
    rankings: rankings.map((ranking) => ({
      teamNumber: ranking.team.teamNumber,
      teamName: ranking.team.name,
      rank: ranking.rank,
      matchesPlayed: ranking.matchesPlayed,
      wins: ranking.wins,
      losses: ranking.losses,
      ties: ranking.ties,
      rankingPoints: Number(ranking.rankingPoints),
      tiebreakerPoints: Number(ranking.tiebreakerPoints),
      totalPoints: ranking.totalPoints,
      highestScore: ranking.highestScore,
    })),
  });
});

export { app };
