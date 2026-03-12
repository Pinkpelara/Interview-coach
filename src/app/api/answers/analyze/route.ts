import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletionJSON, isAIConfigured } from '@/lib/ai-gateway'

interface AnalysisResult {
  strengths: string[]
  issues: string[]
  missingElements: string[]
  scores: {
    structure: number
    specificity: number
    confidence: number
    overall: number
  }
  verdict: string
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const body = await request.json()
    const { questionId, answerText } = body

    if (!questionId || !answerText?.trim()) {
      return NextResponse.json({ error: 'questionId and answerText are required' }, { status: 400 })
    }

    const question = await prisma.question.findFirst({
      where: { id: questionId, application: { userId } },
      include: {
        application: {
          select: { companyName: true, jobTitle: true, jdText: true },
        },
      },
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    if (!isAIConfigured()) {
      // Return smart fallback analysis
      const wordCount = answerText.trim().split(/\s+/).length
      const hasNumbers = /\d+/.test(answerText)
      const hasI = /\bI\b/.test(answerText)
      const hasWe = /\bwe\b/i.test(answerText) && !hasI

      const strengths: string[] = []
      const issues: string[] = []
      const missingElements: string[] = []

      if (wordCount > 50) strengths.push('Answer has sufficient depth and detail.')
      if (hasNumbers) strengths.push('Good use of specific metrics and numbers.')
      if (hasI) strengths.push('Strong personal ownership with first-person language.')
      if (wordCount < 30) issues.push('Answer is too brief. Expand with specific examples and outcomes.')
      if (!hasNumbers) issues.push('Add quantifiable results (percentages, dollar amounts, time saved).')
      if (hasWe) issues.push('Replace "we" language with "I" to show personal contribution.')
      if (!question.modelAnswer) {
        missingElements.push('Consider following the recommended framework for this question type.')
      }

      const overall = Math.min(10, Math.max(1, Math.round(
        (wordCount > 50 ? 3 : 1) + (hasNumbers ? 2 : 0) + (hasI ? 2 : 0) + (wordCount > 100 ? 2 : 0) + 1
      )))

      return NextResponse.json({
        strengths: strengths.length ? strengths : ['You have started drafting an answer — keep building on it.'],
        issues: issues.length ? issues : ['No major issues detected at this stage.'],
        missingElements: missingElements.length ? missingElements : ['Review the model answer for additional techniques to incorporate.'],
        scores: {
          structure: Math.min(10, overall + 1),
          specificity: hasNumbers ? Math.min(10, overall + 1) : Math.max(1, overall - 1),
          confidence: hasI ? Math.min(10, overall + 1) : Math.max(1, overall - 2),
          overall,
        },
        verdict: overall >= 7
          ? 'Solid answer — ready for rehearsal with minor refinements.'
          : overall >= 4
          ? 'Good foundation but needs more specificity and structure.'
          : 'Early draft — focus on adding specific examples and measurable outcomes.',
      } satisfies AnalysisResult)
    }

    const systemPrompt = `You are an expert interview coach analyzing a candidate's answer. The candidate is applying for ${question.application.jobTitle} at ${question.application.companyName}.

Analyze their answer and return a JSON object with this exact structure:
{
  "strengths": ["specific strength with quote from their answer", ...],
  "issues": ["specific issue with quote and fix suggestion", ...],
  "missingElements": ["what a strong answer would include that this doesn't", ...],
  "scores": { "structure": 1-10, "specificity": 1-10, "confidence": 1-10, "overall": 1-10 },
  "verdict": "one direct sentence summarizing the answer quality"
}

Be specific. Quote exact phrases from their answer. Reference the company and role context.`

    const userPrompt = `Question: ${question.questionText}
Question Type: ${question.questionType}
${question.framework ? `Recommended Framework: ${question.framework}` : ''}
${question.modelAnswer ? `Model Answer for reference: ${question.modelAnswer}` : ''}

Candidate's Answer:
${answerText}

Analyze this answer.`

    const analysis = await chatCompletionJSON<AnalysisResult>(systemPrompt, userPrompt, {
      temperature: 0.5,
      maxTokens: 1000,
      taskType: 'answer_analysis',
    })

    // Save feedback to database
    const existingAnswer = await prisma.userAnswer.findFirst({
      where: { questionId, userId },
    })

    if (existingAnswer) {
      await prisma.answerFeedback.create({
        data: {
          userAnswerId: existingAnswer.id,
          strengths: JSON.stringify(analysis.strengths),
          issues: JSON.stringify(analysis.issues),
          missingElements: JSON.stringify(analysis.missingElements),
          structureScore: analysis.scores.structure,
          specificityScore: analysis.scores.specificity,
          confidenceScore: analysis.scores.confidence,
          overallScore: analysis.scores.overall,
          verdict: analysis.verdict,
        },
      })
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error analyzing answer:', error)
    return NextResponse.json({ error: 'Failed to analyze answer' }, { status: 500 })
  }
}
