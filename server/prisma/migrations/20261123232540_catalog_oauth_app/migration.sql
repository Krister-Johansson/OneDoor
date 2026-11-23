-- AlterTable
ALTER TABLE "catalog_auth_option" ADD COLUMN     "oauth_client_id" TEXT,
ADD COLUMN     "oauth_client_secret_ciphertext" TEXT,
ADD COLUMN     "oauth_client_secret_key_id" TEXT;

-- Prisma 7 cannot express check constraints, so they are added here.

-- An encrypted value is stored with the id of the key that encrypted it (REQ-CONN-041).
ALTER TABLE "catalog_auth_option" ADD CONSTRAINT "catalog_auth_option_oauth_client_secret_pair_check" CHECK (
    ("oauth_client_secret_ciphertext" IS NULL) = ("oauth_client_secret_key_id" IS NULL)
);

-- The OAuth app belongs to an OAUTH_MANUAL option, and a secret needs a client id (T22).
ALTER TABLE "catalog_auth_option" ADD CONSTRAINT "catalog_auth_option_oauth_client_auth_check" CHECK (
    ("oauth_client_id" IS NULL AND "oauth_client_secret_ciphertext" IS NULL)
    OR ("auth_type" = 'OAUTH_MANUAL' AND "oauth_client_id" IS NOT NULL)
);
