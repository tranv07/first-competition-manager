-- CreateEnum
CREATE TYPE "program" AS ENUM ('ftc', 'frc', 'first_global', 'other');

-- CreateEnum
CREATE TYPE "stage" AS ENUM ('qualification', 'playoff', 'final');

-- CreateEnum
CREATE TYPE "competition_status" AS ENUM ('draft', 'active', 'completed');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('upcoming', 'in_progress', 'completed', 'postponed');

-- CreateEnum
CREATE TYPE "score_status" AS ENUM ('draft', 'submitted', 'finalized');

-- CreateEnum
CREATE TYPE "alliance" AS ENUM ('red', 'blue');

-- CreateEnum
CREATE TYPE "competition_role_type" AS ENUM ('event_admin', 'head_referee', 'scorekeeper');

-- CreateTable
CREATE TABLE "competition" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "program" "program" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "location" TEXT,
    "scoring_config_id" UUID NOT NULL,
    "status" "competition_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL,
    "program" "program" NOT NULL,
    "team_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "city" TEXT,
    "coach_name" TEXT NOT NULL,
    "robot_name" TEXT,
    "logo_url" TEXT,
    "contact_email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_team" (
    "competition_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_team_pkey" PRIMARY KEY ("competition_id","team_id")
);

-- CreateTable
CREATE TABLE "match" (
    "id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "stage" "stage" NOT NULL,
    "round" INTEGER,
    "series" INTEGER,
    "match_number" INTEGER NOT NULL,
    "scheduled_time" TIMESTAMPTZ(6),
    "field_number" INTEGER,
    "status" "match_status" NOT NULL DEFAULT 'upcoming',

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_team" (
    "match_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "alliance" "alliance" NOT NULL,
    "is_surrogate" BOOLEAN NOT NULL DEFAULT false,
    "is_dq" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "match_team_pkey" PRIMARY KEY ("match_id","team_id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_role" (
    "user_id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "role" "competition_role_type" NOT NULL,

    CONSTRAINT "competition_role_pkey" PRIMARY KEY ("user_id","competition_id","role")
);

-- CreateTable
CREATE TABLE "scoring_config" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "program" "program" NOT NULL,
    "minor_foul_points" INTEGER,
    "major_foul_points" INTEGER,

    CONSTRAINT "scoring_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_phase" (
    "id" UUID NOT NULL,
    "config_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "scoring_phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_element" (
    "id" UUID NOT NULL,
    "phase_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "max_count" INTEGER,

    CONSTRAINT "scoring_element_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_config" (
    "scoring_config_id" UUID NOT NULL,
    "win_rp" INTEGER NOT NULL,
    "tie_rp" INTEGER NOT NULL,
    "loss_rp" INTEGER NOT NULL,
    "tiebreaker_order" TEXT[],

    CONSTRAINT "ranking_config_pkey" PRIMARY KEY ("scoring_config_id")
);

-- CreateTable
CREATE TABLE "match_score" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "alliance" "alliance" NOT NULL,
    "minor_fouls" INTEGER NOT NULL DEFAULT 0,
    "major_fouls" INTEGER NOT NULL DEFAULT 0,
    "total_score" INTEGER NOT NULL DEFAULT 0,
    "submitted_by" UUID NOT NULL,
    "finalized_by" UUID,
    "finalized_at" TIMESTAMPTZ(6),
    "status" "score_status" NOT NULL DEFAULT 'draft',

    CONSTRAINT "match_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_entry" (
    "match_score_id" UUID NOT NULL,
    "element_id" UUID NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "score_entry_pkey" PRIMARY KEY ("match_score_id","element_id")
);

-- CreateTable
CREATE TABLE "score_audit" (
    "id" UUID NOT NULL,
    "match_score_id" UUID NOT NULL,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "old_value" JSONB NOT NULL,
    "new_value" JSONB NOT NULL,
    "reason" TEXT,

    CONSTRAINT "score_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking" (
    "competition_id" UUID NOT NULL,
    "stage" "stage" NOT NULL,
    "team_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "ties" INTEGER NOT NULL DEFAULT 0,
    "ranking_points" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tiebreaker_points" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "highest_score" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ranking_pkey" PRIMARY KEY ("competition_id","stage","team_id")
);

-- CreateIndex
CREATE INDEX "competition_program_start_date_idx" ON "competition"("program", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "team_program_team_number_key" ON "team"("program", "team_number");

-- CreateIndex
CREATE INDEX "competition_team_team_id_idx" ON "competition_team"("team_id");

-- CreateIndex
CREATE INDEX "match_competition_id_status_idx" ON "match"("competition_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "match_competition_id_stage_match_number_key" ON "match"("competition_id", "stage", "match_number");

-- CreateIndex
CREATE INDEX "match_team_team_id_idx" ON "match_team"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "competition_role_competition_id_idx" ON "competition_role"("competition_id");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_config_program_name_key" ON "scoring_config"("program", "name");

-- CreateIndex
CREATE INDEX "scoring_phase_config_id_position_idx" ON "scoring_phase"("config_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_phase_config_id_key_key" ON "scoring_phase"("config_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_element_phase_id_key_key" ON "scoring_element"("phase_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "match_score_match_id_alliance_key" ON "match_score"("match_id", "alliance");

-- CreateIndex
CREATE INDEX "score_audit_match_score_id_changed_at_idx" ON "score_audit"("match_score_id", "changed_at");

-- CreateIndex
CREATE INDEX "ranking_competition_id_stage_rank_idx" ON "ranking"("competition_id", "stage", "rank");

-- AddForeignKey
ALTER TABLE "competition" ADD CONSTRAINT "competition_scoring_config_id_fkey" FOREIGN KEY ("scoring_config_id") REFERENCES "scoring_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_team" ADD CONSTRAINT "competition_team_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_team" ADD CONSTRAINT "competition_team_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_team" ADD CONSTRAINT "match_team_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_team" ADD CONSTRAINT "match_team_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_role" ADD CONSTRAINT "competition_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_role" ADD CONSTRAINT "competition_role_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_phase" ADD CONSTRAINT "scoring_phase_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "scoring_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_element" ADD CONSTRAINT "scoring_element_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "scoring_phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_config" ADD CONSTRAINT "ranking_config_scoring_config_id_fkey" FOREIGN KEY ("scoring_config_id") REFERENCES "scoring_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_score" ADD CONSTRAINT "match_score_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_score" ADD CONSTRAINT "match_score_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_score" ADD CONSTRAINT "match_score_finalized_by_fkey" FOREIGN KEY ("finalized_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entry" ADD CONSTRAINT "score_entry_match_score_id_fkey" FOREIGN KEY ("match_score_id") REFERENCES "match_score"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_entry" ADD CONSTRAINT "score_entry_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "scoring_element"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_audit" ADD CONSTRAINT "score_audit_match_score_id_fkey" FOREIGN KEY ("match_score_id") REFERENCES "match_score"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_audit" ADD CONSTRAINT "score_audit_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking" ADD CONSTRAINT "ranking_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking" ADD CONSTRAINT "ranking_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check constraints are kept here because Prisma Schema Language does not
-- currently represent PostgreSQL CHECK constraints.
ALTER TABLE "competition"
    ADD CONSTRAINT "competition_dates_check" CHECK ("end_date" >= "start_date");

ALTER TABLE "team"
    ADD CONSTRAINT "team_team_number_positive" CHECK ("team_number" > 0);

ALTER TABLE "match"
    ADD CONSTRAINT "match_number_positive" CHECK ("match_number" > 0),
    ADD CONSTRAINT "match_round_nonnegative" CHECK ("round" IS NULL OR "round" >= 0),
    ADD CONSTRAINT "match_series_nonnegative" CHECK ("series" IS NULL OR "series" >= 0),
    ADD CONSTRAINT "match_field_number_positive" CHECK ("field_number" IS NULL OR "field_number" > 0);

ALTER TABLE "scoring_config"
    ADD CONSTRAINT "scoring_config_minor_foul_points_nonnegative"
        CHECK ("minor_foul_points" IS NULL OR "minor_foul_points" >= 0),
    ADD CONSTRAINT "scoring_config_major_foul_points_nonnegative"
        CHECK ("major_foul_points" IS NULL OR "major_foul_points" >= 0);

ALTER TABLE "scoring_phase"
    ADD CONSTRAINT "scoring_phase_position_nonnegative" CHECK ("position" >= 0);

ALTER TABLE "scoring_element"
    ADD CONSTRAINT "scoring_element_points_nonnegative" CHECK ("points" >= 0),
    ADD CONSTRAINT "scoring_element_max_count_nonnegative"
        CHECK ("max_count" IS NULL OR "max_count" >= 0);

ALTER TABLE "ranking_config"
    ADD CONSTRAINT "ranking_config_points_nonnegative"
        CHECK ("win_rp" >= 0 AND "tie_rp" >= 0 AND "loss_rp" >= 0);

ALTER TABLE "match_score"
    ADD CONSTRAINT "match_score_fouls_nonnegative"
        CHECK ("minor_fouls" >= 0 AND "major_fouls" >= 0),
    ADD CONSTRAINT "match_score_total_nonnegative" CHECK ("total_score" >= 0);

ALTER TABLE "score_entry"
    ADD CONSTRAINT "score_entry_count_nonnegative" CHECK ("count" >= 0);

ALTER TABLE "ranking"
    ADD CONSTRAINT "ranking_rank_positive" CHECK ("rank" > 0),
    ADD CONSTRAINT "ranking_counts_nonnegative"
        CHECK (
            "matches_played" >= 0
            AND "wins" >= 0
            AND "losses" >= 0
            AND "ties" >= 0
            AND "total_points" >= 0
            AND "highest_score" >= 0
        ),
    ADD CONSTRAINT "ranking_points_nonnegative"
        CHECK ("ranking_points" >= 0 AND "tiebreaker_points" >= 0);
