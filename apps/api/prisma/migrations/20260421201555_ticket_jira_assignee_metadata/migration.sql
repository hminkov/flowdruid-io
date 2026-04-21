-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "jiraAssigneeEmail" TEXT,
ADD COLUMN     "jiraAssigneeName" TEXT,
ADD COLUMN     "jiraAttachmentCount" INTEGER NOT NULL DEFAULT 0;
