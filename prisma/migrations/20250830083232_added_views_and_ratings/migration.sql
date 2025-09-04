/*
  Warnings:

  - You are about to drop the column `likes` on the `Book` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Book" DROP COLUMN "likes",
ADD COLUMN     "ratings" INTEGER NOT NULL DEFAULT 0;
