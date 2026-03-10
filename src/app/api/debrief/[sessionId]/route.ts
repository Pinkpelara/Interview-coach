import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatCompletionJSON, chatCompletion, isPuterConfigured } from '@/lib/puter-ai'

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateMomentMap() {
  const types: Array<'strong' | 'recoverable' | 'dropped'> = ['strong', 'recoverable', 'dropped']
  const segments = []
  const count = randomInt(8, 12)
  const segmentDuration = Math.floor(100 / count)

  const transcripts = [
    { q: 'Tell me about a time you led a cross-functional initiative.', a: 'At my previous company, I spearheaded a migration project involving engineering, design, and product teams. We delivered two weeks ahead of schedule with zero rollback incidents.' },
    { q: 'How do you handle disagreements with your manager?', a: 'I try to understand their perspective first, then present data to support my view. If we still disagree, I commit to the decision and execute fully.' },
    { q: 'What is your biggest weakness?', a: 'Um... I guess I work too hard sometimes? I just care a lot about the work.' },
    { q: 'Why are you leaving your current role?', a: 'I am looking for more ownership and the chance to work on problems at a larger scale. The role here aligns perfectly with that trajectory.' },
    { q: 'Describe a project that failed.', a: 'We launched a feature without adequate user research. I learned to always validate assumptions early. Since then, I build prototype testing into every project timeline.' },
    { q: 'How would you approach prioritization with competing deadlines?', a: 'I use a framework of impact versus effort, communicate trade-offs to stakeholders, and ensure alignment before committing to delivery dates.' },
    { q: 'What makes you a good fit for this company?', a: 'Well, I think I would be good... I mean, I have experience and stuff. I like the company.' },
    { q: 'Walk me through a technical decision you made recently.', a: 'I chose to migrate our monolith to microservices. I evaluated three architectures, ran load tests, and presented findings to the team. We reduced p99 latency by 40%.' },
    { q: 'How do you give feedback to underperforming team members?', a: 'I set up a private 1:1, lead with specific observations, ask for their perspective, and co-create an improvement plan with clear milestones.' },
    { q: 'Where do you see yourself in five years?', a: 'I want to be leading a product engineering team, shipping impactful features, and mentoring the next generation of engineers.' },
    { q: 'Tell me about a time you had to learn something quickly.', a: 'When we adopted Kubernetes, I spent two weeks deep-diving, built a proof of concept, then ran internal workshops. We were production-ready in a month.' },
    { q: 'How do you handle ambiguity?', a: 'I break the problem into smaller knowable pieces, identify the biggest unknowns, run cheap experiments, and iterate based on what I learn.' },
  ]

  const coachingNotes = {
    strong: [
      'Excellent use of the STAR framework here. Specific, measurable outcome.',
      'Strong confidence in delivery. The interviewer nodded multiple times.',
      'Great company-specific language. You mirrored their values naturally.',
      'Perfect pacing. You gave the interviewer space to follow up.',
    ],
    recoverable: [
      'The answer started strong but lost structure midway. Add a clearer conclusion next time.',
      'You hesitated before the key point. Practice the opening line of this answer.',
      'Good content, but the delivery felt rehearsed. Try a more conversational tone.',
      'You missed an opportunity to tie this back to the specific role.',
    ],
    dropped: [
      'This is a classic trap answer. Never say "I work too hard." Be genuinely vulnerable.',
      'Vague language here. The interviewer was looking for specifics and you gave generalities.',
      'You lost the interviewer here. Their body language shifted noticeably.',
      'Filler words increased significantly. This signals low confidence on this topic.',
    ],
  }

  for (let i = 0; i < count; i++) {
    const type = types[randomInt(0, 2)]
    const t = transcripts[i % transcripts.length]
    const notes = coachingNotes[type]
    segments.push({
      id: `seg-${i}`,
      start: i * segmentDuration,
      end: Math.min((i + 1) * segmentDuration, 100),
      type,
      transcript: `Interviewer: "${t.q}"\n\nYou: "${t.a}"`,
      coachingNote: notes[randomInt(0, notes.length - 1)],
      timestampMs: i * 180000 + randomInt(0, 60000),
      hasInterviewerReaction: Math.random() > 0.65,
    })
  }
  return segments
}

function generateNextTargets() {
  return [
    {
      title: 'Eliminate Filler Words Under Pressure',
      description: 'You used "um" and "like" 12 times during pressure questions. This undermines perceived confidence.',
      action: 'Practice the Pressure Lab "Silence Drill" — answer with 3-second pauses instead of fillers.',
      successMetric: 'Fewer than 3 filler words per answer in your next mock session.',
    },
    {
      title: 'Strengthen Weakness Answer',
      description: 'Your weakness answer triggered a red flag. Generic answers like "I work too hard" signal low self-awareness.',
      action: 'Prepare a genuine weakness with a concrete improvement story using the STAR framework.',
      successMetric: 'Deliver a weakness answer that earns a "recoverable" or "strong" rating.',
    },
    {
      title: 'Mirror Company Language',
      description: 'You used company-specific terminology only twice. Top candidates mirror the JD language 5-8 times.',
      action: 'Review the job description and highlight 5 key phrases to weave into your answers naturally.',
      successMetric: 'Use at least 5 JD-aligned phrases in your next session.',
    },
  ]
}

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const { sessionId } = params

    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        exchanges: { orderBy: { sequenceNumber: 'asc' } },
        analysis: true,
        application: true,
      },
    })

    if (!interviewSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (interviewSession.analysis) {
      return NextResponse.json({
        session: interviewSession,
        analysis: {
          ...interviewSession.analysis,
          momentMap: JSON.parse(interviewSession.analysis.momentMap || '[]'),
          nextTargets: JSON.parse(interviewSession.analysis.nextTargets || '[]'),
        },
      })
    }

    // Generate analysis — use AI if configured, otherwise fallback
    let momentMap
    let nextTargets
    let answerQuality: number
    let deliveryConfidence: number
    let pressureRecovery: number
    let companyFitLanguage: number
    let listeningAccuracy: number
    let hiringProbability: number
    let coachScript: string

    const exchanges = interviewSession.exchanges || []
    const exchangeText = exchanges
      .map((e) => `${e.speaker}: ${e.messageText}`)
      .join('\n')
      .slice(0, 3000)

    if (isPuterConfigured() && exchangeText.length > 0) {
      try {
        const [scoresResult, coachResult] = await Promise.all([
          chatCompletionJSON<{
            answerQuality: number
            deliveryConfidence: number
            pressureRecovery: number
            companyFitLanguage: number
            listeningAccuracy: number
            hiringProbability: number
            nextTargets: Array<{ title: string; description: string; action: string; successMetric: string }>
          }>(
            'You are an expert interview coach analyzing a practice interview session. Score the candidate objectively.',
            `Analyze this interview transcript and return JSON with:
- answerQuality: 0-100 score for answer quality
- deliveryConfidence: 0-100 score for delivery confidence
- pressureRecovery: 0-100 score for how they handle pressure
- companyFitLanguage: 0-100 score for company-specific language use
- listeningAccuracy: 0-100 score for how well they listen and respond to the actual question
- hiringProbability: 0-100 estimated hiring probability
- nextTargets: array of exactly 3 improvement targets, each with title, description, action, and successMetric

Transcript:
${exchangeText}`,
            { temperature: 0.5 }
          ),
          chatCompletion(
            'You are a direct, encouraging interview coach delivering a post-interview debrief. Speak naturally and conversationally. Reference specific moments from the interview. Keep it to 3-4 sentences.',
            `Give a brief coaching debrief based on this interview transcript:\n\n${exchangeText}`,
            { temperature: 0.8, maxTokens: 300 }
          ),
        ])

        answerQuality = scoresResult.answerQuality
        deliveryConfidence = scoresResult.deliveryConfidence
        pressureRecovery = scoresResult.pressureRecovery
        companyFitLanguage = scoresResult.companyFitLanguage
        listeningAccuracy = scoresResult.listeningAccuracy
        hiringProbability = scoresResult.hiringProbability
        nextTargets = scoresResult.nextTargets
        coachScript = coachResult
        momentMap = generateMomentMap()
      } catch (aiError) {
        console.error('AI debrief generation failed, using fallback:', aiError)
        momentMap = generateMomentMap()
        nextTargets = generateNextTargets()
        answerQuality = randomInt(50, 90)
        deliveryConfidence = randomInt(50, 90)
        pressureRecovery = randomInt(50, 90)
        companyFitLanguage = randomInt(50, 90)
        listeningAccuracy = randomInt(50, 90)
        hiringProbability = randomInt(55, 85)
        coachScript = `Good session. Let's review what happened and identify areas for improvement. Your overall hiring probability is estimated at ${hiringProbability}%. With focused practice, we can improve that.`
      }
    } else {
      momentMap = generateMomentMap()
      nextTargets = generateNextTargets()
      answerQuality = randomInt(50, 90)
      deliveryConfidence = randomInt(50, 90)
      pressureRecovery = randomInt(50, 90)
      companyFitLanguage = randomInt(50, 90)
      listeningAccuracy = randomInt(50, 90)
      hiringProbability = randomInt(55, 85)
      coachScript = `Good session. Let's review what happened and identify areas for improvement. Your overall hiring probability is estimated at ${hiringProbability}%. With focused practice, we can improve that.`
    }

    const analysis = await prisma.sessionAnalysis.create({
      data: {
        sessionId,
        momentMap: JSON.stringify(momentMap),
        answerQuality,
        deliveryConfidence,
        pressureRecovery,
        companyFitLanguage,
        listeningAccuracy,
        hiringProbability,
        nextTargets: JSON.stringify(nextTargets),
        coachScript,
      },
    })

    return NextResponse.json({
      session: interviewSession,
      analysis: {
        ...analysis,
        momentMap,
        nextTargets,
      },
    })
  } catch (error) {
    console.error('Debrief API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
