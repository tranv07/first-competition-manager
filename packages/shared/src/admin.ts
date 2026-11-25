import { z } from "zod";

export const programSchema = z.enum(["ftc", "frc", "first_global", "other"]);
export const competitionStatusSchema = z.enum(["draft", "active", "completed"]);
export const stageSchema = z.enum(["qualification", "playoff", "final"]);
export const allianceSchema = z.enum(["red", "blue"]);

export const competitionSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    program: programSchema,
    startDate: z.iso.datetime({ offset: true }).or(z.iso.date()),
    endDate: z.iso.datetime({ offset: true }).or(z.iso.date()),
    location: z.string().trim().max(160).optional().nullable(),
    scoringConfigId: z.string().uuid(),
  })
  .strict()
  .refine((value) => value.endDate >= value.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const competitionUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    startDate: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
    endDate: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
    location: z.string().trim().max(160).optional().nullable(),
    status: competitionStatusSchema.optional(),
  })
  .strict();

export const teamSchema = z
  .object({
    program: programSchema,
    teamNumber: z.number().int().positive(),
    name: z.string().trim().min(1).max(160),
    organization: z.string().trim().min(1).max(160),
    city: z.string().trim().max(160).optional().nullable(),
    coachName: z.string().trim().min(1).max(160),
    robotName: z.string().trim().max(160).optional().nullable(),
    logoUrl: z.url().optional().nullable().or(z.literal("")),
    contactEmail: z.email(),
  })
  .strict();

export const teamUpdateSchema = teamSchema.partial().strict();

export const matchTeamSchema = z
  .object({
    teamId: z.string().uuid(),
    alliance: allianceSchema,
    isSurrogate: z.boolean().default(false),
  })
  .strict();

export const matchSchema = z
  .object({
    stage: stageSchema,
    round: z.number().int().positive().nullable().optional(),
    series: z.number().int().positive().nullable().optional(),
    matchNumber: z.number().int().positive(),
    scheduledTime: z.iso.datetime({ offset: true }).nullable().optional(),
    fieldNumber: z.number().int().positive().nullable().optional(),
    teams: z.array(matchTeamSchema).min(2),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.stage !== "qualification" &&
      (value.round === null ||
        value.round === undefined ||
        value.series === null ||
        value.series === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Playoff and final matches require round and series.",
      });
    }
  });

export const matchUpdateSchema = z
  .object({
    round: z.number().int().positive().nullable().optional(),
    series: z.number().int().positive().nullable().optional(),
    matchNumber: z.number().int().positive().optional(),
    scheduledTime: z.iso.datetime({ offset: true }).nullable().optional(),
    fieldNumber: z.number().int().positive().nullable().optional(),
    status: z
      .enum(["upcoming", "in_progress", "completed", "postponed"])
      .optional(),
    teams: z.array(matchTeamSchema).min(2).optional(),
  })
  .strict();

export const scheduleConfigSchema = z
  .object({
    matchesPerTeam: z.number().int().positive(),
    numberOfFields: z.number().int().positive(),
    cycleTimeMinutes: z.number().int().positive(),
    startTime: z.iso.datetime({ local: true }),
    minMatchesBetween: z.number().int().nonnegative(),
    randomSeed: z.number().int().nullable().optional(),
  })
  .strict();

export interface ScheduleMatch {
  matchNumber: number;
  scheduledTime: string;
  fieldNumber: number;
  teamIds: string[];
}

export interface ScheduleConfigInput {
  matchesPerTeam: number;
  minMatchesBetween: number;
}

export interface ScheduleWarning {
  code: "team_match_count" | "team_overlap" | "team_spacing";
  message: string;
  teamId?: string;
  matchNumber?: number;
}

export function validateSchedule(
  teamIds: readonly string[],
  matches: readonly ScheduleMatch[],
  config: ScheduleConfigInput,
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  const count = new Map(teamIds.map((teamId) => [teamId, 0]));

  for (const match of matches) {
    for (const teamId of match.teamIds) {
      count.set(teamId, (count.get(teamId) ?? 0) + 1);
    }
  }

  for (const teamId of teamIds) {
    const actual = count.get(teamId) ?? 0;
    if (actual !== config.matchesPerTeam) {
      warnings.push({
        code: "team_match_count",
        teamId,
        message: `Team ${teamId} has ${actual} matches; ${config.matchesPerTeam} are configured.`,
      });
    }
  }

  const sorted = [...matches].sort(
    (a, b) =>
      new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime(),
  );

  for (let index = 0; index < sorted.length; index += 1) {
    const match = sorted[index];
    const start = new Date(match.scheduledTime).getTime();
    for (let later = index + 1; later < sorted.length; later += 1) {
      const candidate = sorted[later];
      const candidateStart = new Date(candidate.scheduledTime).getTime();
      if (candidateStart > start + 24 * 60 * 60 * 1000) break;
      const overlap = match.teamIds.filter((teamId) =>
        candidate.teamIds.includes(teamId),
      );
      if (
        overlap.length > 0 &&
        candidateStart - start < config.minMatchesBetween * 60 * 60 * 1000
      ) {
        for (const teamId of overlap) {
          warnings.push({
            code: candidateStart === start ? "team_overlap" : "team_spacing",
            teamId,
            matchNumber: match.matchNumber,
            message:
              candidateStart === start
                ? `Team ${teamId} appears in overlapping matches ${match.matchNumber} and ${candidate.matchNumber}.`
                : `Team ${teamId} plays matches ${match.matchNumber} and ${candidate.matchNumber} too close together.`,
          });
        }
      }
    }
  }

  return warnings;
}

export type CompetitionInput = z.infer<typeof competitionSchema>;
export type CompetitionUpdateInput = z.infer<typeof competitionUpdateSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
