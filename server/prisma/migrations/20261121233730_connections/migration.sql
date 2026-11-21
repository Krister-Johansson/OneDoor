-- Case-insensitive text for display names (REQ-CONN-021).
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "auth_type" AS ENUM ('NONE', 'API_KEY', 'OAUTH_DCR', 'OAUTH_MANUAL');

-- CreateEnum
CREATE TYPE "connection_mode" AS ENUM ('READ_ONLY', 'ALL', 'CUSTOM');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_entry" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "display_name" CITEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "auth_type" "auth_type" NOT NULL,
    "header_name" TEXT,
    "header_prefix" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catalog_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "catalog_entry_id" UUID,
    "display_name" CITEXT,
    "description" TEXT,
    "url" TEXT,
    "auth_type" "auth_type",
    "header_name" TEXT,
    "header_prefix" TEXT,
    "mode" "connection_mode" NOT NULL DEFAULT 'READ_ONLY',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_name_key" ON "user"("name");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_entry_key_key" ON "catalog_entry"("key");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_entry_display_name_key" ON "catalog_entry"("display_name");

-- CreateIndex
CREATE INDEX "connection_catalog_entry_id_idx" ON "connection"("catalog_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "connection_owner_id_display_name_key" ON "connection"("owner_id", "display_name");

-- CreateIndex
CREATE UNIQUE INDEX "connection_owner_id_catalog_entry_id_key" ON "connection"("owner_id", "catalog_entry_id");

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_catalog_entry_id_fkey" FOREIGN KEY ("catalog_entry_id") REFERENCES "catalog_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma 7 cannot express check constraints, so they are added here.

-- A catalog-based connection takes its display name, description, URL, auth type and
-- header settings from the entry (REQ-CONN-012). A custom one sets them itself.
ALTER TABLE "connection" ADD CONSTRAINT "connection_catalog_or_custom_check" CHECK (
    (
        "catalog_entry_id" IS NOT NULL
        AND "display_name" IS NULL
        AND "description" IS NULL
        AND "url" IS NULL
        AND "auth_type" IS NULL
        AND "header_name" IS NULL
        AND "header_prefix" IS NULL
    )
    OR (
        "catalog_entry_id" IS NULL
        AND "display_name" IS NOT NULL
        AND "url" IS NOT NULL
        AND "auth_type" IS NOT NULL
    )
);

-- The header name and prefix are set for API_KEY and only for API_KEY (REQ-CONN-040).
ALTER TABLE "catalog_entry" ADD CONSTRAINT "catalog_entry_api_key_header_check" CHECK (
    CASE WHEN "auth_type" = 'API_KEY'
        THEN "header_name" IS NOT NULL AND "header_prefix" IS NOT NULL
        ELSE "header_name" IS NULL AND "header_prefix" IS NULL
    END
);

ALTER TABLE "connection" ADD CONSTRAINT "connection_api_key_header_check" CHECK (
    CASE WHEN "auth_type" = 'API_KEY'
        THEN "header_name" IS NOT NULL AND "header_prefix" IS NOT NULL
        ELSE "header_name" IS NULL AND "header_prefix" IS NULL
    END
);
