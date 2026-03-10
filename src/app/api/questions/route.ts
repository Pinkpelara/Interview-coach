import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletionJSON, isPuterConfigured } from '@/lib/puter-ai'

interface QuestionTemplate {
  questionText: string
  questionType: string
  whyAsked: string
  framework: string
  modelAnswer: string
  whatNotToSay: string
  timeGuidance: number
  difficulty: number
  likelyFollowUp: string
}

async function generateQuestionsWithAI(
  companyName: string,
  jobTitle: string,
  resumeText: string,
  jdText: string
): Promise<QuestionTemplate[]> {
  const systemPrompt = `You are an expert interview coach. Generate personalized interview questions based on the candidate's resume and the job description. Each question should be deeply relevant to the specific role and company.`

  const userPrompt = `Generate exactly 20 interview questions for a candidate applying to "${jobTitle}" at "${companyName}".

Resume excerpt: ${resumeText.slice(0, 2000)}

Job description excerpt: ${jdText.slice(0, 2000)}

Generate this exact distribution:
- 5 behavioral questions
- 4 technical questions
- 4 situational questions
- 3 company-specific questions
- 2 opening questions
- 2 closing questions

Return a JSON array of objects with these exact fields:
- questionText: the interview question
- questionType: one of "behavioral", "technical", "situational", "company-specific", "opening", "closing"
- whyAsked: why the interviewer asks this (reference the company and role specifically)
- framework: recommended answer framework (e.g., "STAR", "Present → Past → Future")
- modelAnswer: a strong example answer tailored to this role
- whatNotToSay: common mistakes to avoid
- timeGuidance: recommended answer time in seconds (60-120)
- difficulty: 1-5 scale
- likelyFollowUp: a likely follow-up question`

  return chatCompletionJSON<QuestionTemplate[]>(systemPrompt, userPrompt, {
    temperature: 0.8,
    maxTokens: 4000,
  })
}

function generateQuestionsFallback(
  companyName: string,
  jobTitle: string,
): QuestionTemplate[] {
  const types: Array<{ type: string; questions: string[]; count: number }> = [
    {
      type: 'behavioral',
      count: 5,
      questions: [
        `Tell me about a time you had to lead a team through a challenging project.`,
        `Describe a situation where you received critical feedback. How did you handle it?`,
        `Give an example of when you had to manage conflicting priorities.`,
        `Tell me about a time you failed at something. What did you learn?`,
        `Describe a time you collaborated with someone whose working style was very different from yours.`,
      ],
    },
    {
      type: 'technical',
      count: 4,
      questions: [
        `Walk me through how you would design a scalable system for the core challenges at ${companyName}.`,
        `What's your approach to debugging a complex production issue under time pressure?`,
        `How do you ensure code quality and maintainability in your projects?`,
        `Explain a technically complex concept as if I were a non-technical stakeholder.`,
      ],
    },
    {
      type: 'situational',
      count: 4,
      questions: [
        `If you joined ${companyName} and discovered significant technical debt, how would you approach it?`,
        `Imagine you disagree with a technical decision made by a senior colleague. How would you handle it?`,
        `How would you handle being assigned to a project using technologies you've never worked with?`,
        `You're leading a feature that's behind schedule and the deadline can't move. What do you do?`,
      ],
    },
    {
      type: 'company-specific',
      count: 3,
      questions: [
        `What do you know about ${companyName} and what excites you about the ${jobTitle} role?`,
        `How does your experience make you uniquely qualified for this ${jobTitle} position?`,
        `What challenges do you think ${companyName} faces, and how would you contribute?`,
      ],
    },
    {
      type: 'opening',
      count: 2,
      questions: [
        `Tell me about yourself and walk me through your background.`,
        `Why are you looking to leave your current position?`,
      ],
    },
    {
      type: 'closing',
      count: 2,
      questions: [
        `What questions do you have for us about ${companyName} or the ${jobTitle} role?`,
        `Where do you see yourself in 3-5 years?`,
      ],
    },
  ]

  const result: QuestionTemplate[] = []
  for (const category of types) {
    for (let i = 0; i < category.count; i++) {
      result.push({
        questionText: category.questions[i],
        questionType: category.type,
        whyAsked: `This question assesses key competencies for the ${jobTitle} role at ${companyName}.`,
        framework: category.type === 'behavioral' ? 'STAR (Situation, Task, Action, Result)' : 'Structure your answer clearly with examples.',
        modelAnswer: `Prepare a specific example that demonstrates your relevant experience for the ${jobTitle} position.`,
        whatNotToSay: `Avoid vague answers without specific examples or metrics.`,
        timeGuidance: 90,
        difficulty: 3,
        likelyFollowUp: 'Can you tell me more about that?',
      })
    }
  }
  return result
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const { searchParams } = new URL(request.url)
    const applicationId = searchParams.get('applicationId')

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
    }

    // Verify the application belongs to the user
    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId },
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const questions = await prisma.question.findMany({
      where: { applicationId },
      include: {
        userAnswers: {
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(questions)
  } catch (error) {
    console.error('Error fetching questions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const body = await request.json()
    const { applicationId } = body

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
    }

    // Verify the application belongs to the user
    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId },
      include: {
        parsedResume: true,
        parsedJD: true,
      },
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Check if questions already exist
    const existingCount = await prisma.question.count({
      where: { applicationId },
    })

    if (existingCount > 0) {
      return NextResponse.json(
        { error: 'Questions already generated for this application. Delete existing questions first.' },
        { status: 409 }
      )
    }

    // Generate questions using AI (with fallback)
    let questionTemplates: QuestionTemplate[]
    if (isPuterConfigured()) {
      try {
        questionTemplates = await generateQuestionsWithAI(
          application.companyName,
          application.jobTitle,
          application.resumeText,
          application.jdText
        )
      } catch (aiError) {
        console.error('AI question generation failed, using fallback:', aiError)
        questionTemplates = generateQuestionsFallback(
          application.companyName,
          application.jobTitle,
        )
      }
    } else {
      questionTemplates = generateQuestionsFallback(
        application.companyName,
        application.jobTitle,
      )
    }

    // Bulk-create questions
    const createdQuestions = await prisma.$transaction(
      questionTemplates.map((q) =>
        prisma.question.create({
          data: {
            applicationId,
            questionText: q.questionText,
            questionType: q.questionType,
            whyAsked: q.whyAsked,
            framework: q.framework,
            modelAnswer: q.modelAnswer,
            whatNotToSay: q.whatNotToSay,
            timeGuidance: q.timeGuidance,
            difficulty: q.difficulty,
            likelyFollowUp: q.likelyFollowUp,
          },
        })
      )
    )

    return NextResponse.json(createdQuestions, { status: 201 })
  } catch (error) {
    console.error('Error generating questions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
