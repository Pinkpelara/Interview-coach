-- Seatvio v6 runtime alignment migration
-- Purpose: safely align production schema with current Prisma models
-- without destructive operations.

-- User
ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "onboarded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "verifyToken" TEXT;
ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- UserProfile
ALTER TABLE IF EXISTS "UserProfile" ADD COLUMN IF NOT EXISTS "targetIndustry" TEXT;
ALTER TABLE IF EXISTS "UserProfile" ADD COLUMN IF NOT EXISTS "workArrangement" TEXT;
ALTER TABLE IF EXISTS "UserProfile" ADD COLUMN IF NOT EXISTS "interviewDifficulty" TEXT;
ALTER TABLE IF EXISTS "UserProfile" ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT;
ALTER TABLE IF EXISTS "UserProfile" ADD COLUMN IF NOT EXISTS "portfolioUrl" TEXT;
ALTER TABLE IF EXISTS "UserProfile" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Application
ALTER TABLE IF EXISTS "Application" ADD COLUMN IF NOT EXISTS "interviewStage" TEXT;
ALTER TABLE IF EXISTS "Application" ADD COLUMN IF NOT EXISTS "realInterviewDate" TIMESTAMP(3);
ALTER TABLE IF EXISTS "Application" ADD COLUMN IF NOT EXISTS "alignmentScore" INTEGER;
ALTER TABLE IF EXISTS "Application" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS "Application" ADD COLUMN IF NOT EXISTS "skillGaps" TEXT;
ALTER TABLE IF EXISTS "Application" ADD COLUMN IF NOT EXISTS "strengths" TEXT;
ALTER TABLE IF EXISTS "Application" ADD COLUMN IF NOT EXISTS "missingKeywords" TEXT;
ALTER TABLE IF EXISTS "Application" ADD COLUMN IF NOT EXISTS "probeAreas" TEXT;
ALTER TABLE IF EXISTS "Application" ADD COLUMN IF NOT EXISTS "readinessScore" INTEGER NOT NULL DEFAULT 0;

-- Question
ALTER TABLE IF EXISTS "Question" ADD COLUMN IF NOT EXISTS "whyAsked" TEXT;
ALTER TABLE IF EXISTS "Question" ADD COLUMN IF NOT EXISTS "framework" TEXT;
ALTER TABLE IF EXISTS "Question" ADD COLUMN IF NOT EXISTS "modelAnswer" TEXT;
ALTER TABLE IF EXISTS "Question" ADD COLUMN IF NOT EXISTS "whatNotToSay" TEXT;
ALTER TABLE IF EXISTS "Question" ADD COLUMN IF NOT EXISTS "timeGuidance" INTEGER;
ALTER TABLE IF EXISTS "Question" ADD COLUMN IF NOT EXISTS "difficulty" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE IF EXISTS "Question" ADD COLUMN IF NOT EXISTS "likelyFollowUp" TEXT;

-- InterviewSession
ALTER TABLE IF EXISTS "InterviewSession" ADD COLUMN IF NOT EXISTS "characters" TEXT;

-- SessionAnalysis
ALTER TABLE IF EXISTS "SessionAnalysis" ADD COLUMN IF NOT EXISTS "companyFitLanguage" INTEGER;
ALTER TABLE IF EXISTS "SessionAnalysis" ADD COLUMN IF NOT EXISTS "listeningAccuracy" INTEGER;
ALTER TABLE IF EXISTS "SessionAnalysis" ADD COLUMN IF NOT EXISTS "nextTargets" TEXT;
ALTER TABLE IF EXISTS "SessionAnalysis" ADD COLUMN IF NOT EXISTS "coachScript" TEXT;

-- Subscription
ALTER TABLE IF EXISTS "Subscription" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE IF EXISTS "Subscription" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE IF EXISTS "Subscription" ADD COLUMN IF NOT EXISTS "stripeSubId" TEXT;

-- NotificationPreference (newer model)
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "welcomeEmail" BOOLEAN NOT NULL DEFAULT true,
  "sessionSummaryEmail" BOOLEAN NOT NULL DEFAULT true,
  "dailyCountdownEmail" BOOLEAN NOT NULL DEFAULT false,
  "weeklyProgressEmail" BOOLEAN NOT NULL DEFAULT true,
  "reengagementEmail" BOOLEAN NOT NULL DEFAULT true,
  "interviewMorningEmail" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'NotificationPreference_userId_key'
  ) THEN
    CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationPreference_userId_fkey'
  ) THEN
    ALTER TABLE "NotificationPreference"
      ADD CONSTRAINT "NotificationPreference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- NotificationEvent (newer model)
CREATE TABLE IF NOT EXISTS "NotificationEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'email',
  "recipient" TEXT,
  "subject" TEXT,
  "payload" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationEvent_userId_fkey'
  ) THEN
    ALTER TABLE "NotificationEvent"
      ADD CONSTRAINT "NotificationEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- InterviewReflection (newer model)
CREATE TABLE IF NOT EXISTS "InterviewReflection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "interviewDate" TIMESTAMP(3) NOT NULL,
  "outcome" TEXT,
  "selfRating" INTEGER,
  "actualQuestions" TEXT,
  "whatWentWell" TEXT,
  "whatToImprove" TEXT,
  "notes" TEXT,
  "predictedStrengths" TEXT,
  "predictedRisks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewReflection_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InterviewReflection_userId_fkey'
  ) THEN
    ALTER TABLE "InterviewReflection"
      ADD CONSTRAINT "InterviewReflection_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InterviewReflection_applicationId_fkey'
  ) THEN
    ALTER TABLE "InterviewReflection"
      ADD CONSTRAINT "InterviewReflection_applicationId_fkey"
      FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CountdownPlan (countdown mode persistence)
CREATE TABLE IF NOT EXISTS "CountdownPlan" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "interviewDate" TIMESTAMP(3) NOT NULL,
  "planData" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CountdownPlan_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'CountdownPlan_applicationId_key'
  ) THEN
    CREATE UNIQUE INDEX "CountdownPlan_applicationId_key" ON "CountdownPlan"("applicationId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CountdownPlan_applicationId_fkey'
  ) THEN
    ALTER TABLE "CountdownPlan"
      ADD CONSTRAINT "CountdownPlan_applicationId_fkey"
      FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
