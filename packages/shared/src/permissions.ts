export const competitionActions = [
  "competition.create",
  "competition.edit",
  "role.assign",
  "config.edit",
  "match.update_status",
  "score.submit",
  "score.finalize",
  "score.correct",
  "results.view",
] as const;

export type CompetitionAction = (typeof competitionActions)[number];
export type CompetitionRole = "event_admin" | "head_referee" | "scorekeeper";

interface PermissionUser {
  isSuperAdmin: boolean;
}

const roleActions: Record<CompetitionRole, ReadonlySet<CompetitionAction>> = {
  event_admin: new Set([
    "competition.edit",
    "role.assign",
    "config.edit",
    "match.update_status",
    "score.submit",
    "score.finalize",
    "results.view",
  ]),
  head_referee: new Set([
    "match.update_status",
    "score.submit",
    "score.finalize",
    "score.correct",
    "results.view",
  ]),
  scorekeeper: new Set([
    "match.update_status",
    "score.submit",
    "results.view",
  ]),
};

export function can(
  user: PermissionUser,
  roles: readonly CompetitionRole[],
  action: CompetitionAction,
): boolean {
  return (
    user.isSuperAdmin || roles.some((role) => roleActions[role].has(action))
  );
}
