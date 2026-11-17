import { describe, expect, it } from "vitest";
import {
  assignRanks,
  compareTeams,
  computeRankings,
  computeTeamStats,
  computeTotalScore,
  determineMatchResult,
  type TiebreakerPointsRule,
} from "./ranking";

const scoringConfig = { minorFoulPoints: 5, majorFoulPoints: 15 };
const rankingConfig = {
  winRp: 2,
  tieRp: 1,
  lossRp: 0,
  tiebreakerPointsRule: "own_score" as const,
  aggregation: "sum" as const,
  tiebreakerOrder: [
    "ranking_points",
    "tiebreaker_points",
    "highest_score",
  ] as const,
};

function score(
  status: "draft" | "submitted" | "finalized" = "finalized",
  entries: Array<{ count: number; points: number }> = [],
  minorFouls = 0,
  majorFouls = 0,
) {
  return { status, entries, minorFouls, majorFouls };
}

function match(
  id: string,
  redScore: ReturnType<typeof score> | undefined,
  blueScore: ReturnType<typeof score> | undefined,
  teams: Array<{
    teamId: string;
    alliance: "red" | "blue";
    isSurrogate?: boolean;
    isDq?: boolean;
  }>,
) {
  return {
    id,
    scores: { red: redScore, blue: blueScore },
    teams: teams.map((team) => ({
      isSurrogate: false,
      isDq: false,
      ...team,
    })),
  };
}

describe("computeTotalScore", () => {
  it("adds scored elements and points for fouls committed by the opponent", () => {
    expect(
      computeTotalScore(
        [
          { count: 3, points: 2 },
          { count: 1, points: 8 },
        ],
        { minorFouls: 2, majorFouls: 1 },
        scoringConfig,
      ),
    ).toBe(39);
  });

  it("returns zero when there are no elements or opponent fouls", () => {
    expect(
      computeTotalScore([], { minorFouls: 0, majorFouls: 0 }, scoringConfig),
    ).toBe(0);
  });

  it("allows a zero-point foul configuration", () => {
    expect(
      computeTotalScore(
        [],
        { minorFouls: 2, majorFouls: 3 },
        { minorFoulPoints: 0, majorFoulPoints: 0 },
      ),
    ).toBe(0);
  });

  it("rejects negative scoring counts", () => {
    expect(() =>
      computeTotalScore(
        [{ count: -1, points: 2 }],
        { minorFouls: 0, majorFouls: 0 },
        scoringConfig,
      ),
    ).toThrow(RangeError);
  });
});

describe("determineMatchResult", () => {
  it("returns a tie when both finalized scores are equal", () => {
    expect(
      determineMatchResult(
        { status: "finalized", totalScore: 20 },
        { status: "finalized", totalScore: 20 },
      ),
    ).toEqual({ red: "tie", blue: "tie" });
  });

  it("returns win and loss outcomes for unequal finalized scores", () => {
    expect(
      determineMatchResult(
        { status: "finalized", totalScore: 21 },
        { status: "finalized", totalScore: 20 },
      ),
    ).toEqual({ red: "win", blue: "loss" });
  });

  it("does not produce a result until both alliance scores are finalized", () => {
    expect(
      determineMatchResult(
        { status: "finalized", totalScore: 21 },
        { status: "submitted", totalScore: 20 },
      ),
    ).toBeNull();
    expect(
      determineMatchResult({ status: "finalized", totalScore: 21 }, undefined),
    ).toBeNull();
  });
});

describe("computeTeamStats", () => {
  it("excludes surrogate appearances but counts the other teams in that match", () => {
    const matches = [
      match("m1", score(), score(), [
        { teamId: "surrogate", alliance: "red", isSurrogate: true },
        { teamId: "regular", alliance: "red" },
        { teamId: "opponent", alliance: "blue" },
      ]),
    ];

    expect(
      computeTeamStats("surrogate", matches, scoringConfig, rankingConfig)
        .matchesPlayed,
    ).toBe(0);
    expect(
      computeTeamStats("regular", matches, scoringConfig, rankingConfig)
        .matchesPlayed,
    ).toBe(1);
  });

  it("awards zero ranking points to a DQ while retaining the finalized result", () => {
    const matches = [
      match(
        "m1",
        score("finalized", [{ count: 5, points: 2 }]),
        score("finalized", [{ count: 1, points: 2 }]),
        [
          { teamId: "dq-team", alliance: "red", isDq: true },
          { teamId: "blue-team", alliance: "blue" },
        ],
      ),
    ];

    expect(
      computeTeamStats("dq-team", matches, scoringConfig, rankingConfig),
    ).toMatchObject({ matchesPlayed: 1, wins: 1, rankingPoints: 0 });
    expect(
      computeTeamStats("blue-team", matches, scoringConfig, rankingConfig),
    ).toMatchObject({ matchesPlayed: 1, losses: 1, rankingPoints: 0 });
  });

  it("counts tied finalized matches and awards tie RP", () => {
    const matches = [
      match(
        "m1",
        score("finalized", [{ count: 5, points: 2 }]),
        score("finalized", [{ count: 2, points: 5 }]),
        [
          { teamId: "red-team", alliance: "red" },
          { teamId: "blue-team", alliance: "blue" },
        ],
      ),
    ];

    expect(
      computeTeamStats("red-team", matches, scoringConfig, rankingConfig),
    ).toMatchObject({ ties: 1, rankingPoints: 1 });
    expect(
      computeTeamStats("blue-team", matches, scoringConfig, rankingConfig),
    ).toMatchObject({ ties: 1, rankingPoints: 1 });
  });

  it("recomputes stats from corrected scores rather than retaining stale totals", () => {
    const teams = [
      { teamId: "red-team", alliance: "red" as const },
      { teamId: "blue-team", alliance: "blue" as const },
    ];
    const original = [
      match(
        "m1",
        score("finalized", [{ count: 5, points: 2 }]),
        score("finalized", [{ count: 1, points: 2 }]),
        teams,
      ),
    ];
    const corrected = [
      match(
        "m1",
        score("finalized", [{ count: 1, points: 2 }]),
        score("finalized", [{ count: 5, points: 2 }]),
        teams,
      ),
    ];

    expect(
      computeTeamStats("red-team", original, scoringConfig, rankingConfig),
    ).toMatchObject({ wins: 1, rankingPoints: 2 });
    expect(
      computeTeamStats("blue-team", original, scoringConfig, rankingConfig),
    ).toMatchObject({ losses: 1, rankingPoints: 0 });
    expect(
      computeTeamStats("red-team", corrected, scoringConfig, rankingConfig),
    ).toMatchObject({ losses: 1, rankingPoints: 0 });
    expect(
      computeTeamStats("blue-team", corrected, scoringConfig, rankingConfig),
    ).toMatchObject({ wins: 1, rankingPoints: 2 });
  });

  it("returns zeroed stats for teams with no counted matches", () => {
    expect(
      computeTeamStats("idle-team", [], scoringConfig, rankingConfig),
    ).toMatchObject({
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      rankingPoints: 0,
      tiebreakerPoints: 0,
      totalPoints: 0,
      highestScore: 0,
    });
  });

  it("ignores matches until both alliance scores are finalized", () => {
    const matches = [
      match(
        "m1",
        score("finalized", [{ count: 5, points: 2 }]),
        score("submitted", [{ count: 1, points: 2 }]),
        [
          { teamId: "red-team", alliance: "red" },
          { teamId: "blue-team", alliance: "blue" },
        ],
      ),
    ];

    expect(
      computeTeamStats("red-team", matches, scoringConfig, rankingConfig)
        .matchesPlayed,
    ).toBe(0);
  });

  it("calculates configured tiebreaker points from fouls and match scores", () => {
    const matches = [
      match(
        "m1",
        score("finalized", [{ count: 2, points: 10 }], 1),
        score("finalized", [{ count: 1, points: 4 }], 0, 1),
        [
          { teamId: "red-team", alliance: "red" },
          { teamId: "blue-team", alliance: "blue" },
        ],
      ),
    ];

    const teamStats = (tiebreakerPointsRule: TiebreakerPointsRule) =>
      computeTeamStats("red-team", matches, scoringConfig, {
        ...rankingConfig,
        tiebreakerPointsRule,
      });

    expect(teamStats("none").tiebreakerPoints).toBe(0);
    expect(teamStats("own_score_without_fouls").tiebreakerPoints).toBe(20);
    expect(teamStats("losing_alliance_score").tiebreakerPoints).toBe(9);
  });

  it("aggregates ranking and tiebreaker points by average when configured", () => {
    const matches = [
      match("m1", score(), score(), [
        { teamId: "team", alliance: "red" },
        { teamId: "opponent", alliance: "blue" },
      ]),
      match("m2", score(), score(), [
        { teamId: "team", alliance: "blue" },
        { teamId: "opponent", alliance: "red" },
      ]),
    ];

    expect(
      computeTeamStats("team", matches, scoringConfig, {
        ...rankingConfig,
        aggregation: "average",
      }),
    ).toMatchObject({
      matchesPlayed: 2,
      rankingPoints: 1,
      tiebreakerPoints: 0,
    });
  });
});

describe("compareTeams", () => {
  it("compares descending values in configured criterion order", () => {
    const first = {
      rankingPoints: 4,
      tiebreakerPoints: 10,
      totalPoints: 20,
      highestScore: 12,
    };
    const second = {
      rankingPoints: 4,
      tiebreakerPoints: 9,
      totalPoints: 100,
      highestScore: 90,
    };

    expect(
      compareTeams(first, second, [
        "ranking_points",
        "tiebreaker_points",
        "total_points",
      ]),
    ).toBeLessThan(0);
    expect(
      compareTeams(first, second, ["ranking_points", "total_points"]),
    ).toBeGreaterThan(0);
  });

  it("returns zero when teams tie on every configured criterion", () => {
    const stats = {
      rankingPoints: 2,
      tiebreakerPoints: 5,
      totalPoints: 30,
      highestScore: 12,
    };

    expect(
      compareTeams(stats, stats, [
        "ranking_points",
        "tiebreaker_points",
        "total_points",
        "highest_score",
      ]),
    ).toBe(0);
  });
});

describe("assignRanks", () => {
  it("gives tied teams the same competition rank and leaves a gap after the tie", () => {
    const teams = [
      {
        teamId: "third",
        rankingPoints: 1,
        tiebreakerPoints: 0,
        totalPoints: 3,
        highestScore: 3,
      },
      {
        teamId: "first-a",
        rankingPoints: 3,
        tiebreakerPoints: 0,
        totalPoints: 9,
        highestScore: 9,
      },
      {
        teamId: "second",
        rankingPoints: 2,
        tiebreakerPoints: 0,
        totalPoints: 6,
        highestScore: 6,
      },
      {
        teamId: "first-b",
        rankingPoints: 3,
        tiebreakerPoints: 0,
        totalPoints: 9,
        highestScore: 9,
      },
    ];

    expect(assignRanks(teams, ["ranking_points"])).toEqual([
      { ...teams[1], rank: 1 },
      { ...teams[3], rank: 1 },
      { ...teams[2], rank: 3 },
      { ...teams[0], rank: 4 },
    ]);
    expect(teams[0]).not.toHaveProperty("rank");
  });
});

describe("computeRankings", () => {
  it("ranks all teams, including teams with no matches", () => {
    const matches = [
      match(
        "m1",
        score("finalized", [{ count: 5, points: 2 }]),
        score("finalized", [{ count: 1, points: 2 }]),
        [
          { teamId: "winner", alliance: "red" },
          { teamId: "loser", alliance: "blue" },
        ],
      ),
    ];

    expect(
      computeRankings(
        ["winner", "loser", "idle"],
        matches,
        scoringConfig,
        rankingConfig,
      ).map(({ teamId, rank }) => [teamId, rank]),
    ).toEqual([
      ["winner", 1],
      ["loser", 2],
      ["idle", 3],
    ]);
  });

  it("returns tied ranks when the configured criteria are all equal", () => {
    expect(
      computeRankings(["team-a", "team-b"], [], scoringConfig, {
        ...rankingConfig,
        tiebreakerOrder: ["ranking_points"],
      }).map(({ teamId, rank }) => [teamId, rank]),
    ).toEqual([
      ["team-a", 1],
      ["team-b", 1],
    ]);
  });
});
