/*
  Warnings:

  - You are about to drop the column `auth_type` on the `catalog_entry` table. All the data in the column will be lost.
  - You are about to drop the column `header_name` on the `catalog_entry` table. All the data in the column will be lost.
  - You are about to drop the column `header_prefix` on the `catalog_entry` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `catalog_entry` table. All the data in the column will be lost.

*/
-- A catalog entry now offers auth options (REQ-CONN-010), so its URL, auth type and
-- header settings move to catalog_auth_option. No database holds catalog entries yet,
-- so nothing is copied.
ALTER TABLE "catalog_entry" DROP CONSTRAINT "catalog_entry_api_key_header_check";

-- AlterTable
ALTER TABLE "catalog_entry" DROP COLUMN "auth_type",
DROP COLUMN "header_name",
DROP COLUMN "header_prefix",
DROP COLUMN "url";

-- AlterTable
ALTER TABLE "connection" ADD COLUMN     "catalog_auth_option_id" UUID;

-- CreateTable
CREATE TABLE "catalog_auth_option" (
    "id" UUID NOT NULL,
    "catalog_entry_id" UUID NOT NULL,
    "auth_type" "auth_type" NOT NULL,
    "url" TEXT NOT NULL,
    "header_name" TEXT,
    "header_prefix" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catalog_auth_option_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_auth_option_catalog_entry_id_auth_type_key" ON "catalog_auth_option"("catalog_entry_id", "auth_type");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_auth_option_catalog_entry_id_id_key" ON "catalog_auth_option"("catalog_entry_id", "id");

-- AddForeignKey
ALTER TABLE "catalog_auth_option" ADD CONSTRAINT "catalog_auth_option_catalog_entry_id_fkey" FOREIGN KEY ("catalog_entry_id") REFERENCES "catalog_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_catalog_entry_id_catalog_auth_option_id_fkey" FOREIGN KEY ("catalog_entry_id", "catalog_auth_option_id") REFERENCES "catalog_auth_option"("catalog_entry_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma 7 cannot express check constraints, so they are added here.

-- The header name and prefix are set for API_KEY and only for API_KEY (REQ-CONN-040).
ALTER TABLE "catalog_auth_option" ADD CONSTRAINT "catalog_auth_option_api_key_header_check" CHECK (
    CASE WHEN "auth_type" = 'API_KEY'
        THEN "header_name" IS NOT NULL AND "header_prefix" IS NOT NULL
        ELSE "header_name" IS NULL AND "header_prefix" IS NULL
    END
);

-- A catalog-based connection names its entry and the auth option it was switched on
-- with, and takes the rest from them (REQ-CONN-012). A custom one sets its own fields.
ALTER TABLE "connection" DROP CONSTRAINT "connection_catalog_or_custom_check";
ALTER TABLE "connection" ADD CONSTRAINT "connection_catalog_or_custom_check" CHECK (
    (
        "catalog_entry_id" IS NOT NULL
        AND "catalog_auth_option_id" IS NOT NULL
        AND "display_name" IS NULL
        AND "description" IS NULL
        AND "url" IS NULL
        AND "auth_type" IS NULL
        AND "header_name" IS NULL
        AND "header_prefix" IS NULL
    )
    OR (
        "catalog_entry_id" IS NULL
        AND "catalog_auth_option_id" IS NULL
        AND "display_name" IS NOT NULL
        AND "url" IS NOT NULL
        AND "auth_type" IS NOT NULL
    )
);
