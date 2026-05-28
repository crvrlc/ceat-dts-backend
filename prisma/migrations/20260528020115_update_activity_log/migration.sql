-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_documentId_fkey";

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "entityId" INTEGER,
ADD COLUMN     "entityType" TEXT,
ALTER COLUMN "documentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
