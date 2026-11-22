-- AlterTable
ALTER TABLE "catalog_entry" ADD COLUMN     "icon_id" UUID;

-- AlterTable
ALTER TABLE "connection" ADD COLUMN     "icon_id" UUID;

-- CreateTable
CREATE TABLE "icon" (
    "id" UUID NOT NULL,
    "content_type" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "icon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "icon_sha256_key" ON "icon"("sha256");

-- AddForeignKey
ALTER TABLE "catalog_entry" ADD CONSTRAINT "catalog_entry_icon_id_fkey" FOREIGN KEY ("icon_id") REFERENCES "icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_icon_id_fkey" FOREIGN KEY ("icon_id") REFERENCES "icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma 7 cannot express check constraints, so they are added here.

-- REQ-CONN-071: at most 256 KB, of a type read from the bytes.
ALTER TABLE "icon" ADD CONSTRAINT "icon_size_check" CHECK (octet_length("bytes") BETWEEN 1 AND 262144);
ALTER TABLE "icon" ADD CONSTRAINT "icon_content_type_check" CHECK (
    "content_type" IN (
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'image/vnd.microsoft.icon',
        'image/svg+xml'
    )
);

-- REQ-CONN-070: a catalog-based connection uses its entry's icon.
ALTER TABLE "connection" ADD CONSTRAINT "connection_icon_custom_check" CHECK (
    "icon_id" IS NULL OR "catalog_entry_id" IS NULL
);
