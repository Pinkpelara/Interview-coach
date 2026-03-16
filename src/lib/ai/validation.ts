import { z } from 'zod'

export const ApplicationAlignmentSchema = z.object({
  alignmentScore: z.number().min(0).max(100),
  skillGaps: z.array(z.string()).min(1).max(8),
  strengths: z.array(z.string()).min(1).max(8),
  missingKeywords: z.array(z.string()).min(1).max(12),
  probeAreas: z.array(z.string()).min(1).max(8),
})

export const QuestionTemplateSchema = z.object({
  questionText: z.string().min(10),
  questionType: z.enum([
    'opening',
    'behavioral',
    'situational',
    'technical',
    'company-specific',
    'culture-fit',
    'motivation',
    'curveball',
    'closing-candidate',
    'salary-negotiation',
  ]),
  competencyDomain: z.string().min(2).optional(),
  whyAsked: z.string().min(8),
  framework: z.string().min(2),
  modelAnswer: z.string().refine((v) => v.trim().split(/\s+/).filter(Boolean).length >= 200, {
    message: 'modelAnswer must contain at least 200 words',
  }),
  whatNotToSay: z.string().min(8),
  timeGuidance: z.number().min(45).max(240),
  likelyFollowUps: z.array(z.string().min(8)).min(2).max(3),
  difficulty: z.number().int().min(1).max(5),
  bestAskedByArchetype: z.enum([
    'skeptic',
    'friendly_champion',
    'technical_griller',
    'distracted_senior',
    'culture_fit',
    'silent_observer',
  ]),
  bestStage: z.enum([
    'phone_screen',
    'first_round',
    'panel',
    'final_round',
    'case',
    'stress',
  ]),
})

export const QuestionTemplateArraySchema = z.array(QuestionTemplateSchema).min(100).max(240)

export const AnswerAnalysisSchema = z.object({
  strengths: z.array(z.string()).min(1),
  issues: z.array(z.string()).min(1),
  missingElements: z.array(z.string()).min(1),
  scores: z.object({
    structure: z.number().min(1).max(10),
    specificity: z.number().min(1).max(10),
    confidence: z.number().min(1).max(10),
    overall: z.number().min(1).max(10),
  }),
  verdict: z.string().min(8),
})

export const DebriefScoreSchema = z.object({
  answerQuality: z.number().min(0).max(100),
  deliveryConfidence: z.number().min(0).max(100),
  pressureRecovery: z.number().min(0).max(100),
  companyFitLanguage: z.number().min(0).max(100),
  listeningAccuracy: z.number().min(0).max(100),
  hiringProbability: z.number().min(0).max(100),
  nextTargets: z
    .array(
      z.object({
        title: z.string().min(4),
        description: z.string().min(12),
        action: z.string().min(8),
        successMetric: z.string().min(8),
      })
    )
    .min(3)
    .max(3),
})
