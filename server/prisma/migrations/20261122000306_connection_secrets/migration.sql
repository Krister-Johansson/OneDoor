-- AlterTable
ALTER TABLE "connection" ADD COLUMN     "api_key_ciphertext" TEXT,
ADD COLUMN     "api_key_key_id" TEXT,
ADD COLUMN     "oauth_client_id" TEXT,
ADD COLUMN     "oauth_client_secret_ciphertext" TEXT,
ADD COLUMN     "oauth_client_secret_key_id" TEXT;

-- Prisma 7 cannot express check constraints, so they are added here.

-- An encrypted value is stored with the id of the key that encrypted it (REQ-CONN-041).
ALTER TABLE "connection" ADD CONSTRAINT "connection_api_key_pair_check" CHECK (
    ("api_key_ciphertext" IS NULL) = ("api_key_key_id" IS NULL)
);

ALTER TABLE "connection" ADD CONSTRAINT "connection_oauth_client_secret_pair_check" CHECK (
    ("oauth_client_secret_ciphertext" IS NULL) = ("oauth_client_secret_key_id" IS NULL)
);

-- An API key belongs to an API_KEY connection. A catalog-based connection has no auth
-- type of its own, so the service checks its entry's (REQ-CONN-040).
ALTER TABLE "connection" ADD CONSTRAINT "connection_api_key_auth_check" CHECK (
    "api_key_ciphertext" IS NULL
    OR "catalog_entry_id" IS NOT NULL
    OR "auth_type" = 'API_KEY'
);

-- OAuth client details on a connection are only for custom OAUTH_MANUAL connections.
-- Catalog entries get theirs from server config (REQ-CONN-010).
ALTER TABLE "connection" ADD CONSTRAINT "connection_oauth_client_auth_check" CHECK (
    ("oauth_client_id" IS NULL AND "oauth_client_secret_ciphertext" IS NULL)
    OR ("catalog_entry_id" IS NULL AND "auth_type" = 'OAUTH_MANUAL')
);
