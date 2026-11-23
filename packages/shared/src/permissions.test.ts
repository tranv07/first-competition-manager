import { describe, expect, it } from "vitest";
import {
  can,
  competitionActions,
  type CompetitionAction,
  type CompetitionRole,
} from "./permissions.js";

const expectedByRole: Record<CompetitionRole, CompetitionAction[]> = {
  event_admin: [
    "competition.edit",
    "role.assign",
    "config.edit",
    "match.update_status",
    "score.submit",
    "score.finalize",
    "results.view",
  ],
  head_referee: [
    "match.update_status",
    "score.submit",
    "score.finalize",
    "score.correct",
    "results.view",
  ],
  scorekeeper: ["match.update_status", "score.submit", "results.view"],
};

describe("competition permissions", () => {
  for (const [role, allowedActions] of Object.entries(expectedByRole) as [
    CompetitionRole,
    CompetitionAction[],
  ][]) {
    describe(role, () => {
      for (const action of competitionActions) {
        it(`${allowedActions.includes(action) ? "allows" : "denies"} ${action}`, () => {
          expect(
            can({ isSuperAdmin: false }, [role], action),
          ).toBe(allowedActions.includes(action));
        });
      }
    });
  }

  it("allows super admins every action without competition roles", () => {
    for (const action of competitionActions) {
      expect(can({ isSuperAdmin: true }, [], action)).toBe(true);
    }
  });

  it("denies users without a matching role", () => {
    for (const action of competitionActions) {
      expect(can({ isSuperAdmin: false }, [], action)).toBe(false);
    }
  });

  it("unions permissions across assigned roles", () => {
    expect(
      can(
        { isSuperAdmin: false },
        ["scorekeeper", "head_referee"],
        "score.correct",
      ),
    ).toBe(true);
  });
});
