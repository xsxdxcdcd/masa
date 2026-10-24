-- CreateTable
CREATE TABLE "DirectChat" (
    "id" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "studentLastReadAt" TIMESTAMP(3),
    "instructorLastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    CONSTRAINT "DirectChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "attachmentUrl" TEXT,
    "attachmentType" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectChat_studentId_idx" ON "DirectChat"("studentId");
CREATE INDEX "DirectChat_instructorId_idx" ON "DirectChat"("instructorId");
CREATE UNIQUE INDEX "DirectChat_courseId_studentId_instructorId_key" ON "DirectChat"("courseId", "studentId", "instructorId");
CREATE INDEX "DirectMessage_chatId_idx" ON "DirectMessage"("chatId");
CREATE INDEX "DirectMessage_senderId_idx" ON "DirectMessage"("senderId");

-- AddForeignKey
ALTER TABLE "DirectChat" ADD CONSTRAINT "DirectChat_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectChat" ADD CONSTRAINT "DirectChat_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectChat" ADD CONSTRAINT "DirectChat_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "DirectChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;