export type Alliance = "red" | "blue";

export type ScoreStatus = "draft" | "submitted" | "finalized";

export type RankingCriterion =
  "ranking_points" | "tiebreaker_points" | "total_points" | "highest_score";

export type TiebreakerPointsRule =
  "none" | "own_score" | "own_score_without_fouls" | "losing_alliance_score";

export type RankingAggregation = "sum" | "average";

export interface ScoringConfig {
  minorFoulPoints: number;
  majorFoulPoints: number;
}

export interface RankingConfig {
  winRp: number;
  tieRp: number;
  lossRp: number;
  tiebreakerPointsRule: TiebreakerPointsRule;
  aggregation: RankingAggregation;
  tiebreakerOrder: readonly RankingCriterion[];
}

export interface ScoreEntryInput {
  count: number;
  points: number;
}

export interface FoulsInput {
  minorFouls: number;
  majorFouls: number;
}

export interface ScoreSheetInput extends FoulsInput {
  status: ScoreStatus;
  entries: readonly ScoreEntryInput[];
}

export interface AllianceScoreResult {
  status: ScoreStatus;
  totalScore: number;
}

export type MatchOutcome = "win" | "loss" | "tie";

export interface MatchResult {
  red: MatchOutcome;
  blue: MatchOutcome;
}

export interface TeamAssignment {
  teamId: string;
  alliance: Alliance;
  isSurrogate: boolean;
  isDq: boolean;
}

export interface MatchInput {
  id: string;
  teams: readonly TeamAssignment[];
  scores: Partial<Record<Alliance, ScoreSheetInput>>;
}

export interface TeamStats {
  teamId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  rankingPoints: number;
  tiebreakerPoints: number;
  totalPoints: number;
  highestScore: number;
}

export interface RankedTeam extends TeamStats {
  rank: number;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

export function computeTotalScore(
  entries: readonly ScoreEntryInput[],
  opponentFouls: FoulsInput,
  scoringConfig: ScoringConfig,
): number {
  assertNonNegativeInteger(opponentFouls.minorFouls, "opponent minor fouls");
  assertNonNegativeInteger(opponentFouls.majorFouls, "opponent major fouls");
  assertNonNegativeInteger(scoringConfig.minorFoulPoints, "minor foul points");
  assertNonNegativeInteger(scoringConfig.majorFoulPoints, "major foul points");

  let score = 0;
  for (const entry of entries) {
    assertNonNegativeInteger(entry.count, "score entry count");
    assertNonNegativeInteger(entry.points, "score entry points");
    score += entry.count * entry.points;
  }

  score +=
    opponentFouls.minorFouls * scoringConfig.minorFoulPoints +
    opponentFouls.majorFouls * scoringConfig.majorFoulPoints;

  if (!Number.isSafeInteger(score)) {
    throw new RangeError("total score exceeds the safe integer range");
  }
  return score;
}

export function determineMatchResult(
  redScore: AllianceScoreResult | undefined,
  blueScore: AllianceScoreResult | undefined,
): MatchResult | null {
  if (redScore?.status !== "finalized" || blueScore?.status !== "finalized") {
    return null;
  }

  if (redScore.totalScore === blueScore.totalScore) {
    return { red: "tie", blue: "tie" };
  }
  if (redScore.totalScore > blueScore.totalScore) {
    return { red: "win", blue: "loss" };
  }
  return { red: "loss", blue: "win" };
}

function emptyTeamStats(teamId: string): TeamStats {
  return {
    teamId,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    rankingPoints: 0,
    tiebreakerPoints: 0,
    totalPoints: 0,
    highestScore: 0,
  };
}

function getTiebreakerPoints(
  rule: TiebreakerPointsRule,
  ownScore: number,
  opposingScore: number,
  opposingFouls: FoulsInput,
  scoringConfig: ScoringConfig,
): number {
  switch (rule) {
    case "none":
      return 0;
    case "own_score":
      return ownScore;
    case "own_score_without_fouls":
      return (
        ownScore -
        opposingFouls.minorFouls * scoringConfig.minorFoulPoints -
        opposingFouls.majorFouls * scoringConfig.majorFoulPoints
      );
    case "losing_alliance_score":
      return Math.min(ownScore, opposingScore);
  }
}

function getOutcome(result: MatchResult, alliance: Alliance): MatchOutcome {
  return result[alliance];
}

export function computeTeamStats(
  teamId: string,
  matches: readonly MatchInput[],
  scoringConfig: ScoringConfig,
  rankingConfig: RankingConfig,
): TeamStats {
  const stats = emptyTeamStats(teamId);
  let rankingPointTotal = 0;
  let tiebreakerPointTotal = 0;

  for (const match of matches) {
    const assignment = match.teams.find((team) => team.teamId === teamId);
    if (!assignment || assignment.isSurrogate) {
      continue;
    }

    const redScoreInput = match.scores.red;
    const blueScoreInput = match.scores.blue;
    if (
      !redScoreInput ||
      !blueScoreInput ||
      redScoreInput.status !== "finalized" ||
      blueScoreInput.status !== "finalized"
    ) {
      continue;
    }

    const redTotalScore = computeTotalScore(
      redScoreInput.entries,
      blueScoreInput,
      scoringConfig,
    );
    const blueTotalScore = computeTotalScore(
      blueScoreInput.entries,
      redScoreInput,
      scoringConfig,
    );
    const result = determineMatchResult(
      { status: redScoreInput.status, totalScore: redTotalScore },
      { status: blueScoreInput.status, totalScore: blueTotalScore },
    );
    if (!result) {
      continue;
    }

    const opposingScoreInput =
      assignment.alliance === "red" ? blueScoreInput : redScoreInput;
    const ownTotalScore =
      assignment.alliance === "red" ? redTotalScore : blueTotalScore;
    const opposingTotalScore =
      assignment.alliance === "red" ? blueTotalScore : redTotalScore;
    const outcome = getOutcome(result, assignment.alliance);
    stats.matchesPlayed += 1;
    if (outcome === "win") {
      stats.wins += 1;
    } else if (outcome === "loss") {
      stats.losses += 1;
    } else {
      stats.ties += 1;
    }

    if (!assignment.isDq) {
      rankingPointTotal +=
        outcome === "win"
          ? rankingConfig.winRp
          : outcome === "tie"
            ? rankingConfig.tieRp
            : rankingConfig.lossRp;
    }

    tiebreakerPointTotal += getTiebreakerPoints(
      rankingConfig.tiebreakerPointsRule,
      ownTotalScore,
      opposingTotalScore,
      opposingScoreInput,
      scoringConfig,
    );
    stats.totalPoints += ownTotalScore;
    stats.highestScore = Math.max(stats.highestScore, ownTotalScore);
  }

  if (rankingConfig.aggregation === "average" && stats.matchesPlayed > 0) {
    stats.rankingPoints = rankingPointTotal / stats.matchesPlayed;
    stats.tiebreakerPoints = tiebreakerPointTotal / stats.matchesPlayed;
  } else {
    stats.rankingPoints = rankingPointTotal;
    stats.tiebreakerPoints = tiebreakerPointTotal;
  }

  return stats;
}

type ComparableTeam = Pick<
  TeamStats,
  "rankingPoints" | "tiebreakerPoints" | "totalPoints" | "highestScore"
>;

function criterionValue(
  team: ComparableTeam,
  criterion: RankingCriterion,
): number {
  switch (criterion) {
    case "ranking_points":
      return team.rankingPoints;
    case "tiebreaker_points":
      return team.tiebreakerPoints;
    case "total_points":
      return team.totalPoints;
    case "highest_score":
      return team.highestScore;
  }
}

export function compareTeams(
  left: ComparableTeam,
  right: ComparableTeam,
  tiebreakerOrder: readonly RankingCriterion[],
): number {
  for (const criterion of tiebreakerOrder) {
    const leftValue = criterionValue(left, criterion);
    const rightValue = criterionValue(right, criterion);
    if (leftValue > rightValue) {
      return -1;
    }
    if (leftValue < rightValue) {
      return 1;
    }
  }
  return 0;
}

export function assignRanks<T extends ComparableTeam>(
  teams: readonly T[],
  tiebreakerOrder: readonly RankingCriterion[],
): Array<T & { rank: number }> {
  const sortedTeams = [...teams].sort((left, right) =>
    compareTeams(left, right, tiebreakerOrder),
  );
  let currentRank = 0;

  return sortedTeams.map((team, index) => {
    if (
      index === 0 ||
      compareTeams(sortedTeams[index - 1], team, tiebreakerOrder) !== 0
    ) {
      currentRank = index + 1;
    }
    return { ...team, rank: currentRank };
  });
}

export function computeRankings(
  teamIds: readonly string[],
  matches: readonly MatchInput[],
  scoringConfig: ScoringConfig,
  rankingConfig: RankingConfig,
): RankedTeam[] {
  const stats = teamIds.map((teamId) =>
    computeTeamStats(teamId, matches, scoringConfig, rankingConfig),
  );
  return assignRanks(stats, rankingConfig.tiebreakerOrder);
}
