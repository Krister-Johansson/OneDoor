-- CreateTable
CREATE TABLE "connection_oauth" (
    "connection_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "client_ciphertext" TEXT,
    "client_key_id" TEXT,
    "tokens_ciphertext" TEXT,
    "tokens_key_id" TEXT,
    "discovery_state" JSONB,
    "authorized_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "connection_oauth_pkey" PRIMARY KEY ("connection_id")
);

-- CreateIndex
CREATE INDEX "connection_oauth_owner_id_idx" ON "connection_oauth"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "connection_oauth_connection_id_owner_id_key" ON "connection_oauth"("connection_id", "owner_id");

-- AddForeignKey
ALTER TABLE "connection_oauth" ADD CONSTRAINT "connection_oauth_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_oauth" ADD CONSTRAINT "connection_oauth_connection_id_owner_id_fkey" FOREIGN KEY ("connection_id", "owner_id") REFERENCES "connection"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;
