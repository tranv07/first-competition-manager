-- Add model enums.
CREATE TYPE "ranking_criterion" AS ENUM (
    'ranking_points',
    'tiebreaker_points',
    'total_points',
    'highest_score'
);

CREATE TYPE "tiebreaker_points_rule" AS ENUM (
    'none',
    'own_score',
    'own_score_without_fouls',
    'losing_alliance_score'
);

CREATE TYPE "ranking_aggregation" AS ENUM ('sum', 'average');

CREATE TYPE "playoff_role" AS ENUM ('captain', 'pick', 'backup');

-- Update existing scoring configurations while preserving their values.
ALTER TABLE "scoring_config"
    ADD COLUMN "teams_per_alliance" INTEGER NOT NULL DEFAULT 2;

UPDATE "scoring_config"
SET
    "minor_foul_points" = COALESCE("minor_foul_points", 0),
    "major_foul_points" = COALESCE("major_foul_points", 0);

ALTER TABLE "scoring_config"
    ALTER COLUMN "minor_foul_points" SET DEFAULT 0,
    ALTER COLUMN "minor_foul_points" SET NOT NULL,
    ALTER COLUMN "major_foul_points" SET DEFAULT 0,
    ALTER COLUMN "major_foul_points" SET NOT NULL,
    ALTER COLUMN "teams_per_alliance" DROP DEFAULT;

ALTER TABLE "scoring_config"
    DROP CONSTRAINT "scoring_config_minor_foul_points_nonnegative",
    DROP CONSTRAINT "scoring_config_major_foul_points_nonnegative",
    ADD CONSTRAINT "scoring_config_foul_points_nonnegative"
        CHECK ("minor_foul_points" >= 0 AND "major_foul_points" >= 0),
    ADD CONSTRAINT "scoring_config_teams_per_alliance_positive"
        CHECK ("teams_per_alliance" > 0);

-- Migrate existing ranking data and make its ranking semantics explicit.
ALTER TABLE "ranking_config"
    ADD COLUMN "tiebreaker_points_rule" "tiebreaker_points_rule" NOT NULL DEFAULT 'own_score',
    ADD COLUMN "aggregation" "ranking_aggregation" NOT NULL DEFAULT 'sum';

UPDATE "ranking_config"
SET "tiebreaker_order" = ARRAY['ranking_points', 'tiebreaker_points', 'highest_score']
WHERE "tiebreaker_order" IS NULL;

ALTER TABLE "ranking_config"
    ALTER COLUMN "tiebreaker_order" TYPE "ranking_criterion"[]
        USING "tiebreaker_order"::"ranking_criterion"[],
    ALTER COLUMN "tiebreaker_order" SET NOT NULL,
    ALTER COLUMN "tiebreaker_points_rule" DROP DEFAULT,
    ALTER COLUMN "aggregation" DROP DEFAULT;

-- Schedule configuration and planned breaks.
CREATE TABLE "schedule_config" (
    "competition_id" UUID NOT NULL,
    "matches_per_team" INTEGER NOT NULL,
    "number_of_fields" INTEGER NOT NULL,
    "cycle_time_minutes" INTEGER NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "min_matches_between" INTEGER NOT NULL,
    "random_seed" INTEGER,

    CONSTRAINT "schedule_config_pkey" PRIMARY KEY ("competition_id")
);

CREATE TABLE "schedule_break" (
    "id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "label" TEXT,

    CONSTRAINT "schedule_break_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "schedule_break_time_range_check" CHECK ("end_time" > "start_time")
);

CREATE INDEX "schedule_break_competition_id_start_time_idx"
    ON "schedule_break"("competition_id", "start_time");

ALTER TABLE "schedule_config"
    ADD CONSTRAINT "schedule_config_matches_per_team_positive"
        CHECK ("matches_per_team" > 0),
    ADD CONSTRAINT "schedule_config_number_of_fields_positive"
        CHECK ("number_of_fields" > 0),
    ADD CONSTRAINT "schedule_config_cycle_time_positive"
        CHECK ("cycle_time_minutes" > 0),
    ADD CONSTRAINT "schedule_config_min_matches_between_nonnegative"
        CHECK ("min_matches_between" >= 0);

-- Playoff alliance selection.
CREATE TABLE "playoff_alliance" (
    "id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "seed" INTEGER NOT NULL,

    CONSTRAINT "playoff_alliance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "playoff_alliance_seed_positive" CHECK ("seed" > 0)
);

CREATE TABLE "playoff_alliance_team" (
    "alliance_id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "role" "playoff_role" NOT NULL,
    "pick_order" INTEGER,

    CONSTRAINT "playoff_alliance_team_pkey" PRIMARY KEY ("alliance_id", "team_id"),
    CONSTRAINT "playoff_alliance_team_pick_order_check"
        CHECK (
            ("role" = 'captain' AND "pick_order" IS NULL)
            OR ("role" <> 'captain' AND "pick_order" > 0)
        )
);

CREATE UNIQUE INDEX "playoff_alliance_id_competition_id_key"
    ON "playoff_alliance"("id", "competition_id");

CREATE UNIQUE INDEX "playoff_alliance_competition_id_seed_key"
    ON "playoff_alliance"("competition_id", "seed");

CREATE UNIQUE INDEX "playoff_alliance_team_competition_id_team_id_key"
    ON "playoff_alliance_team"("competition_id", "team_id");

CREATE INDEX "playoff_alliance_team_team_id_idx"
    ON "playoff_alliance_team"("team_id");

-- Add competition relationships.
ALTER TABLE "schedule_config"
    ADD CONSTRAINT "schedule_config_competition_id_fkey"
        FOREIGN KEY ("competition_id") REFERENCES "competition"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_break"
    ADD CONSTRAINT "schedule_break_competition_id_fkey"
        FOREIGN KEY ("competition_id") REFERENCES "competition"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "playoff_alliance"
    ADD CONSTRAINT "playoff_alliance_competition_id_fkey"
        FOREIGN KEY ("competition_id") REFERENCES "competition"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "playoff_alliance_team"
    ADD CONSTRAINT "playoff_alliance_team_alliance_id_competition_id_fkey"
        FOREIGN KEY ("alliance_id", "competition_id")
        REFERENCES "playoff_alliance"("id", "competition_id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "playoff_alliance_team_team_id_fkey"
        FOREIGN KEY ("team_id") REFERENCES "team"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
