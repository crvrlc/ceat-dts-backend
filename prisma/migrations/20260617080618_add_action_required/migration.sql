-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'action_required';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "actionRequiredFileName" TEXT,
ADD COLUMN     "actionRequiredFileUrl" TEXT,
ADD COLUMN     "revisedFileName" TEXT,
ADD COLUMN     "revisedFileUrl" TEXT;
