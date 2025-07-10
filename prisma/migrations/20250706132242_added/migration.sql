-- CreateEnum
CREATE TYPE "BookProgress" AS ENUM ('ONGOING', 'COMPLETED', 'DROPPED', 'HIATUS');

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "progress" "BookProgress" NOT NULL DEFAULT 'ONGOING';
