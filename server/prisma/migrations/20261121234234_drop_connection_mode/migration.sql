/*
  Warnings:

  - You are about to drop the column `mode` on the `connection` table. All the data in the column will be lost.

*/
-- The connection mode depended on tool annotations, which servers may leave out and
-- which are only hints. Each tool's own enabled flag replaces it (specs/connections.md).

-- AlterTable
ALTER TABLE "connection" DROP COLUMN "mode";

-- DropEnum
DROP TYPE "connection_mode";
