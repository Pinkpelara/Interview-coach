import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Runtime compatibility shim for production databases that may lag behind
// the current Prisma schema. We only add missing nullable/defaulted columns.
let compatInitPromise: Promise<void> | null = null
let compatRunning = false

async function ensureRuntimeSchemaCompatibility() {
  if (compatInitPromise) return compatInitPromise

  compatInitPromise = (async () => {
    compatRunning = true
    try {
      const statements = [
        // User
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboarded" BOOLEAN NOT NULL DEFAULT false',
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifyToken" TEXT',
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false',

        // UserProfile
        'ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "targetIndustry" TEXT',
        'ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "workArrangement" TEXT',
        'ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "interviewDifficulty" TEXT',
        'ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT',
        'ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "portfolioUrl" TEXT',

        // Application
        'ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "interviewStage" TEXT',
        'ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "realInterviewDate" TIMESTAMP(3)',
        'ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "alignmentScore" INTEGER',
        'ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT \'active\'',
        'ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "skillGaps" TEXT',
        'ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "strengths" TEXT',
        'ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "missingKeywords" TEXT',
        'ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "probeAreas" TEXT',
        'ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "readinessScore" INTEGER NOT NULL DEFAULT 0',

        // Question
        'ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "whyAsked" TEXT',
        'ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "framework" TEXT',
        'ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "modelAnswer" TEXT',
        'ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "whatNotToSay" TEXT',
        'ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "timeGuidance" INTEGER',
        'ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "difficulty" INTEGER NOT NULL DEFAULT 3',
        'ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "likelyFollowUp" TEXT',

        // InterviewSession
        'ALTER TABLE "InterviewSession" ADD COLUMN IF NOT EXISTS "characters" TEXT',

        // SessionAnalysis
        'ALTER TABLE "SessionAnalysis" ADD COLUMN IF NOT EXISTS "companyFitLanguage" INTEGER',
        'ALTER TABLE "SessionAnalysis" ADD COLUMN IF NOT EXISTS "listeningAccuracy" INTEGER',
        'ALTER TABLE "SessionAnalysis" ADD COLUMN IF NOT EXISTS "nextTargets" TEXT',
        'ALTER TABLE "SessionAnalysis" ADD COLUMN IF NOT EXISTS "coachScript" TEXT',
      ]

      for (const sql of statements) {
        await prisma.$executeRawUnsafe(sql)
      }
    } catch (error) {
      // Keep app serving; compatibility fails closed only on specific routes.
      console.error('Runtime schema compatibility initialization failed:', error)
    } finally {
      compatRunning = false
    }
  })()

  return compatInitPromise
}

prisma.$use(async (params, next) => {
  // Only run once per runtime instance before model-backed operations.
  if (!compatRunning && params.model) {
    await ensureRuntimeSchemaCompatibility()
  }
  return next(params)
})
