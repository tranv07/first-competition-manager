import { describe, expect, it } from "vitest";
import {
  competitionSchema,
  teamSchema,
  validateSchedule,
  type ScheduleMatch,
} from "./index";

describe("competition validation", () => {
  it("rejects an end date before the start date", () => {
    const result = competitionSchema.safeParse({
      name: "Test Meet",
      program: "ftc",
      startDate: "2026-11-25",
      endDate: "2026-11-24",
      location: null,
      scoringConfigId: "4d3e3d3f-3e32-4df5-8a2a-1b9bd2ef6b54",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid team numbers and emails", () => {
    expect(
      teamSchema.safeParse({
        program: "ftc",
        teamNumber: 0,
        name: "Team",
        organization: "Org",
        coachName: "Coach",
        contactEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });
});

describe("validateSchedule", () => {
  const teams = ["team-a", "team-b", "team-c"];

  it("returns a warning when teams have the wrong match count", () => {
    const matches: ScheduleMatch[] = [
      {
        matchNumber: 1,
        scheduledTime: "2026-11-25T09:00:00.000Z",
        fieldNumber: 1,
        teamIds: ["team-a", "team-b"],
      },
    ];
    const warnings = validateSchedule(teams, matches, {
      matchesPerTeam: 2,
      minMatchesBetween: 1,
    });
    expect(
      warnings.some((warning) => warning.code === "team_match_count"),
    ).toBe(true);
  });

  it("detects overlapping matches", () => {
    const matches: ScheduleMatch[] = [
      {
        matchNumber: 1,
        scheduledTime: "2026-11-25T09:00:00.000Z",
        fieldNumber: 1,
        teamIds: ["team-a", "team-b"],
      },
      {
        matchNumber: 2,
        scheduledTime: "2026-11-25T09:00:00.000Z",
        fieldNumber: 2,
        teamIds: ["team-a", "team-c"],
      },
    ];
    const warnings = validateSchedule(teams, matches, {
      matchesPerTeam: 1,
      minMatchesBetween: 2,
    });
    expect(warnings.some((warning) => warning.code === "team_overlap")).toBe(
      true,
    );
  });

  it("detects matches that are too close together", () => {
    const matches: ScheduleMatch[] = [
      {
        matchNumber: 1,
        scheduledTime: "2026-11-25T09:00:00.000Z",
        fieldNumber: 1,
        teamIds: ["team-a", "team-b"],
      },
      {
        matchNumber: 2,
        scheduledTime: "2026-11-25T10:00:00.000Z",
        fieldNumber: 1,
        teamIds: ["team-a", "team-c"],
      },
    ];
    const warnings = validateSchedule(teams, matches, {
      matchesPerTeam: 2,
      minMatchesBetween: 2,
    });
    expect(warnings.some((warning) => warning.code === "team_spacing")).toBe(
      true,
    );
  });

  it("returns no warnings for a valid spaced schedule", () => {
    const matches: ScheduleMatch[] = [
      {
        matchNumber: 1,
        scheduledTime: "2026-11-25T09:00:00.000Z",
        fieldNumber: 1,
        teamIds: ["team-a", "team-b"],
      },
      {
        matchNumber: 2,
        scheduledTime: "2026-11-25T11:00:00.000Z",
        fieldNumber: 1,
        teamIds: ["team-a", "team-c"],
      },
    ];
    const warnings = validateSchedule(["team-a", "team-b", "team-c"], matches, {
      matchesPerTeam: 2,
      minMatchesBetween: 1,
    });
    expect(
      warnings.every((warning) => warning.code === "team_match_count"),
    ).toBe(true);
  });
});
