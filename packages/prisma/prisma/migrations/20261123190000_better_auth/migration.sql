-- Backfill Better Auth's required name and timestamp before enforcing NOT NULL.
ALTER TABLE "user" ADD COLUMN "name" TEXT;
ALTER TABLE "user" ADD COLUMN "updated_at" TIMESTAMPTZ(6);
UPDATE "user"
SET "name" = COALESCE(NULLIF("username", ''), "email"),
    "updated_at" = "created_at";
ALTER TABLE "user"
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

DROP INDEX "user_username_key";

ALTER TABLE "user"
  DROP COLUMN "password_hash",
  DROP COLUMN "username",
  ADD COLUMN "ban_expires" TIMESTAMPTZ(6),
  ADD COLUMN "ban_reason" TEXT,
  ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "image" TEXT,
  ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

CREATE TABLE "session" (
  "id" UUID NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "token" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" UUID NOT NULL,
  "impersonated_by" TEXT,
  CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "account" (
  "id" UUID NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TIMESTAMPTZ(6),
  "refresh_token_expires_at" TIMESTAMPTZ(6),
  "scope" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification" (
  "id" UUID NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "session_user_id_idx" ON "session"("user_id");
CREATE INDEX "account_user_id_idx" ON "account"("user_id");
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

ALTER TABLE "session"
  ADD CONSTRAINT "session_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account"
  ADD CONSTRAINT "account_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
