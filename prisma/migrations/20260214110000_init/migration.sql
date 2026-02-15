-- CreateEnum
CREATE TYPE "SessionLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('es', 'en');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "level" "SessionLevel" NOT NULL,
  "theme" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "coachMode" BOOLEAN NOT NULL,
  "region" TEXT NOT NULL DEFAULT 'Spain',
  "title" TEXT NOT NULL,
  "memorySummary" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" "MessageRole" NOT NULL,
  "contentText" TEXT NOT NULL,
  "language" "LanguageCode" NOT NULL,
  "translationJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "turnIndex" INTEGER NOT NULL,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnAnalysis" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userMessageId" TEXT NOT NULL,
  "correctedTextEs" TEXT,
  "highlightsJson" JSONB NOT NULL,
  "explanationsJson" JSONB NOT NULL,
  "alternativesJson" JSONB NOT NULL,
  "mistakesJson" JSONB NOT NULL,
  "tagsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TurnAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeaknessStat" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeaknessStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flashcard" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT,
  "front" TEXT NOT NULL,
  "back" TEXT NOT NULL,
  "tagsJson" JSONB NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "intervalDays" INTEGER NOT NULL DEFAULT 1,
  "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "Session_userId_createdAt_idx" ON "Session"("userId", "createdAt");
CREATE INDEX "Message_sessionId_createdAt_idx" ON "Message"("sessionId", "createdAt");
CREATE INDEX "Message_sessionId_turnIndex_idx" ON "Message"("sessionId", "turnIndex");
CREATE UNIQUE INDEX "TurnAnalysis_userMessageId_key" ON "TurnAnalysis"("userMessageId");
CREATE INDEX "TurnAnalysis_sessionId_createdAt_idx" ON "TurnAnalysis"("sessionId", "createdAt");
CREATE UNIQUE INDEX "WeaknessStat_userId_category_key" ON "WeaknessStat"("userId", "category");
CREATE INDEX "WeaknessStat_userId_count_idx" ON "WeaknessStat"("userId", "count");
CREATE INDEX "Flashcard_userId_dueAt_idx" ON "Flashcard"("userId", "dueAt");
CREATE INDEX "Flashcard_sessionId_idx" ON "Flashcard"("sessionId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TurnAnalysis" ADD CONSTRAINT "TurnAnalysis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TurnAnalysis" ADD CONSTRAINT "TurnAnalysis_userMessageId_fkey" FOREIGN KEY ("userMessageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeaknessStat" ADD CONSTRAINT "WeaknessStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
