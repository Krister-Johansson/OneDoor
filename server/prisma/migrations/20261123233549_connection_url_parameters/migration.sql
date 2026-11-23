-- AlterTable
ALTER TABLE "connection" ADD COLUMN     "url_parameters" JSONB;

-- Prisma 7 cannot express check constraints, so this is added here.

-- URL parameters fill the placeholders of a catalog auth option's URL (T22),
-- so only a catalog-based connection has them, as a JSON object.
ALTER TABLE "connection" ADD CONSTRAINT "connection_url_parameters_check" CHECK (
    "url_parameters" IS NULL
    OR ("catalog_entry_id" IS NOT NULL AND jsonb_typeof("url_parameters") = 'object')
);
