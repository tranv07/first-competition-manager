import { prisma } from "@fcm/prisma";
import type { DemoData } from "@/types";

export async function getCompetitionData(
  competitionId: string,
  matchId?: string,
): Promise<DemoData | null> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
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
        where: matchId
          ? { id: matchId }
          : { stage: "qualification", matchNumber: 1 },
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
  const match = competition?.matches[0];
  if (!competition || !match) return null;

  return {
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
  };
}

export async function getDemoCompetitionData(): Promise<DemoData | null> {
  const competition = await prisma.competition.findFirst({
    where: { name: "FTC Test Invitational", program: "ftc" },
    select: { id: true },
  });
  return competition ? getCompetitionData(competition.id) : null;
}

export async function getMatchCompetitionData(
  matchId: string,
): Promise<DemoData | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { competitionId: true },
  });
  return match ? getCompetitionData(match.competitionId, matchId) : null;
}

export async function getPublishedCompetitions() {
  return prisma.competition.findMany({
    where: { status: { not: "draft" } },
    select: {
      id: true,
      name: true,
      program: true,
      startDate: true,
      endDate: true,
      location: true,
      status: true,
      _count: { select: { teams: true, matches: true } },
    },
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
  });
}
