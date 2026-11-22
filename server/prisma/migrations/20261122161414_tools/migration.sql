-- CreateTable
CREATE TABLE "tool" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "input_schema" JSONB NOT NULL,
    "output_schema" JSONB,
    "annotations" JSONB,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tool_owner_id_idx" ON "tool"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "tool_connection_id_name_key" ON "tool"("connection_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "connection_id_owner_id_key" ON "connection"("id", "owner_id");

-- AddForeignKey
ALTER TABLE "tool" ADD CONSTRAINT "tool_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool" ADD CONSTRAINT "tool_connection_id_owner_id_fkey" FOREIGN KEY ("connection_id", "owner_id") REFERENCES "connection"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

