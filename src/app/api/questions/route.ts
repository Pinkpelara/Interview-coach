import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

function generateQuestions(
  companyName: string,
  jobTitle: string,
  resumeText: string,
  jdText: string
): QuestionTemplate[] {
  const questions: QuestionTemplate[] = []

  // --- 6 Behavioral ---
  questions.push({
    questionText: `Tell me about a time you had to lead a team through a challenging project at a previous role.`,
    questionType: 'behavioral',
    whyAsked: `Interviewers at ${companyName} want to assess your leadership skills and ability to navigate adversity, which is critical for the ${jobTitle} role.`,
    framework: 'STAR (Situation, Task, Action, Result)',
    modelAnswer: `In my previous role, our team faced a tight deadline on a critical product launch. I organized daily standups, delegated tasks based on individual strengths, and personally tackled the highest-risk technical blocker. We delivered on time and the feature drove a 15% increase in user engagement.`,
    whatNotToSay: `Avoid blaming teammates, being vague about your specific contribution, or describing a situation where you gave up.`,
    timeGuidance: 90,
    difficulty: 3,
    likelyFollowUp: 'What would you do differently if you could do it again?',
  })
  questions.push({
    questionText: `Describe a situation where you received critical feedback. How did you handle it?`,
    questionType: 'behavioral',
    whyAsked: `${companyName} values growth mindset and coachability. They want to see you can accept and act on feedback constructively.`,
    framework: 'STAR (Situation, Task, Action, Result)',
    modelAnswer: `During a code review, a senior engineer pointed out that my architecture approach wouldn't scale. Instead of being defensive, I asked clarifying questions, researched alternatives over the weekend, and presented a revised design that the team adopted. It became our standard pattern.`,
    whatNotToSay: `Don't say you never receive negative feedback or describe getting defensive. Avoid examples where you ignored the feedback.`,
    timeGuidance: 90,
    difficulty: 2,
    likelyFollowUp: 'How do you typically seek out feedback proactively?',
  })
  questions.push({
    questionText: `Give an example of when you had to manage conflicting priorities or stakeholder expectations.`,
    questionType: 'behavioral',
    whyAsked: `The ${jobTitle} role likely involves balancing multiple projects. They want to see your prioritization and communication skills.`,
    framework: 'STAR (Situation, Task, Action, Result)',
    modelAnswer: `Two product managers both wanted their features prioritized for the same sprint. I facilitated a meeting to align on business impact metrics, proposed a phased approach that addressed the most critical needs first, and communicated clear timelines to both stakeholders. Both features shipped within the quarter.`,
    whatNotToSay: `Don't describe choosing one stakeholder over another without rationale, or say you just worked overtime to do everything.`,
    timeGuidance: 90,
    difficulty: 3,
    likelyFollowUp: 'How do you decide what to deprioritize when everything seems urgent?',
  })
  questions.push({
    questionText: `Tell me about a time you failed at something. What did you learn?`,
    questionType: 'behavioral',
    whyAsked: `${companyName} wants to assess self-awareness and resilience. Everyone fails — they want to see how you respond.`,
    framework: 'STAR (Situation, Task, Action, Result)',
    modelAnswer: `I once pushed a deployment that caused a 2-hour outage because I skipped the staging environment. I owned the mistake immediately, led the incident response, wrote a detailed postmortem, and implemented automated deployment gates that prevented similar issues. The experience made me a stronger advocate for process.`,
    whatNotToSay: `Avoid saying you've never failed, choosing a trivial example, or blaming external factors entirely.`,
    timeGuidance: 90,
    difficulty: 3,
    likelyFollowUp: 'How has that failure changed your approach to work?',
  })
  questions.push({
    questionText: `Describe a time you had to collaborate with someone whose working style was very different from yours.`,
    questionType: 'behavioral',
    whyAsked: `Team dynamics matter at ${companyName}. They want to know you can work effectively with diverse personalities.`,
    framework: 'STAR (Situation, Task, Action, Result)',
    modelAnswer: `I was paired with a colleague who preferred detailed documentation while I favored rapid prototyping. I suggested we combine approaches — I'd build quick prototypes while they documented the decisions. This actually improved our team's velocity and knowledge sharing.`,
    whatNotToSay: `Don't speak negatively about the other person's style or imply your way is always better.`,
    timeGuidance: 90,
    difficulty: 2,
    likelyFollowUp: 'What did you learn about your own working style from that experience?',
  })
  questions.push({
    questionText: `Tell me about an accomplishment you're most proud of in your career.`,
    questionType: 'behavioral',
    whyAsked: `This reveals what you value professionally and whether your achievements align with what ${companyName} needs for the ${jobTitle} position.`,
    framework: 'STAR (Situation, Task, Action, Result)',
    modelAnswer: `I designed and built an internal tool that automated our reporting pipeline, saving the team 20 hours per week. I identified the pain point, pitched the solution to leadership, and delivered it in 6 weeks. It's still in use two years later and has been adopted by three other departments.`,
    whatNotToSay: `Avoid picking something unrelated to the role, or describing a team achievement without clarifying your contribution.`,
    timeGuidance: 90,
    difficulty: 2,
    likelyFollowUp: 'What was the biggest obstacle you faced during that project?',
  })

  // --- 4 Technical ---
  questions.push({
    questionText: `Walk me through how you would design a scalable system for the core product challenges we face at ${companyName}.`,
    questionType: 'technical',
    whyAsked: `As a ${jobTitle}, you'll need system design skills. They want to evaluate your architectural thinking and technical depth.`,
    framework: 'Requirements → High-Level Design → Deep Dive → Trade-offs → Scaling',
    modelAnswer: `I'd start by clarifying requirements and expected scale. Then I'd propose a high-level architecture with appropriate services, databases, and caching layers. I'd discuss trade-offs between consistency and availability, explain my database choices, and address how the system handles failure modes and scaling.`,
    whatNotToSay: `Don't jump straight into implementation details without understanding requirements. Avoid mentioning only one technology without discussing alternatives.`,
    timeGuidance: 120,
    difficulty: 4,
    likelyFollowUp: 'How would you handle a 10x increase in traffic?',
  })
  questions.push({
    questionText: `What's your approach to debugging a complex production issue under time pressure?`,
    questionType: 'technical',
    whyAsked: `Production incidents are inevitable. ${companyName} needs to know you can stay calm, think systematically, and resolve issues efficiently.`,
    framework: 'Observe → Hypothesize → Test → Fix → Prevent',
    modelAnswer: `First, I check monitoring dashboards and logs to understand the scope and impact. I form hypotheses based on recent changes, test them systematically, and communicate status updates to stakeholders. After resolution, I ensure we have a postmortem and implement preventive measures.`,
    whatNotToSay: `Don't say you'd randomly try fixes, panic, or work alone without communicating. Avoid saying you'd never encounter such issues.`,
    timeGuidance: 90,
    difficulty: 3,
    likelyFollowUp: 'Can you give a specific example of a production issue you resolved?',
  })
  questions.push({
    questionText: `How do you ensure code quality and maintainability in your projects?`,
    questionType: 'technical',
    whyAsked: `${companyName} wants to understand your engineering practices and whether you'll contribute to their codebase health.`,
    framework: 'Practices → Tools → Culture → Examples',
    modelAnswer: `I advocate for a combination of automated testing (unit, integration, and E2E), code reviews with clear guidelines, consistent linting and formatting, and documentation of architectural decisions. I also champion refactoring as part of regular sprint work rather than accumulating tech debt.`,
    whatNotToSay: `Don't say testing slows you down or that you prefer to work without code reviews. Avoid claiming 100% test coverage is always necessary.`,
    timeGuidance: 90,
    difficulty: 3,
    likelyFollowUp: 'How do you balance speed of delivery with code quality?',
  })
  questions.push({
    questionText: `Explain a technically complex concept from your experience to me as if I were a non-technical stakeholder.`,
    questionType: 'technical',
    whyAsked: `The ${jobTitle} role requires cross-functional communication. They want to see you can translate technical concepts for diverse audiences.`,
    framework: 'Analogy → Core Concept → Business Impact → Questions',
    modelAnswer: `I'd choose an appropriate analogy. For example, explaining microservices: "Think of it like a restaurant. Instead of one chef doing everything, we have specialized stations — one for appetizers, one for mains. If the dessert station is busy, the rest keep running. That's why our system stays fast even under load."`,
    whatNotToSay: `Don't use jargon without explanation or talk down to the listener. Avoid picking something trivial that doesn't demonstrate depth.`,
    timeGuidance: 90,
    difficulty: 3,
    likelyFollowUp: 'How would you explain this to our CEO in an elevator pitch?',
  })

  // --- 4 Situational ---
  questions.push({
    questionText: `If you joined ${companyName} and discovered the codebase had significant technical debt, how would you approach it?`,
    questionType: 'situational',
    whyAsked: `They want to see your strategic thinking and whether you'd be pragmatic about technical debt rather than either ignoring it or demanding a full rewrite.`,
    framework: 'Assess → Prioritize → Plan → Communicate → Execute',
    modelAnswer: `I'd first understand the business context and why the debt accumulated. Then I'd categorize issues by impact and risk, propose a prioritized plan that addresses critical items alongside feature work, and get stakeholder buy-in by framing it in terms of velocity and reliability improvements.`,
    whatNotToSay: `Don't say you'd rewrite everything from scratch, or that tech debt doesn't matter. Avoid criticizing previous engineers.`,
    timeGuidance: 90,
    difficulty: 3,
    likelyFollowUp: 'How would you convince leadership to invest time in addressing tech debt?',
  })
  questions.push({
    questionText: `Imagine you disagree with a technical decision made by a senior colleague. How would you handle it?`,
    questionType: 'situational',
    whyAsked: `${companyName} values healthy debate and collaboration. They want to know you can push back respectfully and with data.`,
    framework: 'Listen → Research → Propose → Accept',
    modelAnswer: `I'd first make sure I fully understand their reasoning by asking thoughtful questions. If I still disagreed, I'd prepare a clear comparison with data or examples supporting my alternative approach, present it respectfully, and be open to the outcome even if my suggestion isn't adopted.`,
    whatNotToSay: `Don't say you'd just go along with it to avoid conflict, or that you'd escalate to management immediately.`,
    timeGuidance: 90,
    difficulty: 3,
    likelyFollowUp: 'What if after discussing it, you still disagree but the team wants to proceed with their approach?',
  })
  questions.push({
    questionText: `How would you handle being assigned to a project using technologies you've never worked with before?`,
    questionType: 'situational',
    whyAsked: `The ${jobTitle} position may require learning new technologies. They want to assess your learning agility and self-motivation.`,
    framework: 'Acknowledge → Plan → Learn → Deliver',
    modelAnswer: `I'd be transparent about my experience level while expressing enthusiasm. I'd create a focused learning plan — official docs, tutorials, and small practice projects. I'd identify a team expert as a mentor, start contributing with smaller tasks, and progressively take on more complex work as my confidence grows.`,
    whatNotToSay: `Don't pretend you already know the technology or say you can't work with unfamiliar tools. Avoid suggesting it would significantly slow you down.`,
    timeGuidance: 90,
    difficulty: 2,
    likelyFollowUp: 'Tell me about the last time you had to learn a new technology quickly.',
  })
  questions.push({
    questionText: `You're leading a feature that's behind schedule and the deadline can't be moved. What do you do?`,
    questionType: 'situational',
    whyAsked: `${companyName} needs to know you can manage pressure situations with practical decision-making and clear communication.`,
    framework: 'Assess → Scope → Communicate → Execute → Retrospect',
    modelAnswer: `I'd assess exactly where we are and identify the critical path. Then I'd propose scope adjustments — what's the minimum viable delivery that still provides value? I'd communicate transparently to stakeholders about trade-offs, rally the team around the revised plan, and after delivery, run a retrospective to prevent recurrence.`,
    whatNotToSay: `Don't suggest just working overtime without adjusting scope, or blaming the team for the delay.`,
    timeGuidance: 90,
    difficulty: 4,
    likelyFollowUp: 'How do you prevent scope creep in the first place?',
  })

  // --- 3 Company-Specific ---
  questions.push({
    questionText: `What do you know about ${companyName} and what excites you about this ${jobTitle} role?`,
    questionType: 'company-specific',
    whyAsked: `They want to gauge your genuine interest in ${companyName} and whether you've done your research.`,
    framework: 'Company Knowledge → Role Alignment → Personal Motivation',
    modelAnswer: `I've researched ${companyName}'s mission, recent developments, and product direction. What excites me most is [specific aspect]. My experience in [relevant area] aligns well with the ${jobTitle} role, and I'm particularly drawn to the opportunity to [specific contribution].`,
    whatNotToSay: `Don't give generic answers that could apply to any company. Avoid saying you don't know much about them or focusing only on salary/benefits.`,
    timeGuidance: 90,
    difficulty: 2,
    likelyFollowUp: 'Where do you see yourself contributing most in the first 90 days?',
  })
  questions.push({
    questionText: `How do you think your experience makes you uniquely qualified for the ${jobTitle} position at ${companyName}?`,
    questionType: 'company-specific',
    whyAsked: `They want you to connect your background specifically to their needs. This tests self-awareness and research depth.`,
    framework: 'Their Needs → Your Skills → Unique Value → Evidence',
    modelAnswer: `Based on the job description, ${companyName} needs someone who can [key requirement]. My experience in [relevant area] directly addresses this — for example, [specific achievement]. What makes me unique is my combination of [skill 1] and [skill 2], which I've seen is rare but exactly what this role requires.`,
    whatNotToSay: `Avoid generic claims like "I'm a hard worker." Don't list skills without connecting them to the company's specific needs.`,
    timeGuidance: 90,
    difficulty: 3,
    likelyFollowUp: 'What would you need to learn or develop to excel in this role?',
  })
  questions.push({
    questionText: `What challenges do you think ${companyName} faces in its industry, and how would you contribute to addressing them?`,
    questionType: 'company-specific',
    whyAsked: `This tests your industry awareness, analytical thinking, and ability to think strategically about ${companyName}'s position.`,
    framework: 'Industry Analysis → Specific Challenges → Your Contribution',
    modelAnswer: `From my research, ${companyName} operates in a competitive landscape where [challenge]. I believe the key to addressing this is [approach]. In the ${jobTitle} role, I would contribute by [specific actions], drawing on my experience with [relevant background].`,
    whatNotToSay: `Don't display ignorance about the industry or make assumptions without basis. Avoid being overly critical of the company's current strategy.`,
    timeGuidance: 90,
    difficulty: 4,
    likelyFollowUp: 'How do you stay informed about industry trends?',
  })

  // --- 3 Curveball ---
  questions.push({
    questionText: `If you had unlimited resources and one year, what product would you build and why?`,
    questionType: 'curveball',
    whyAsked: `This reveals your creativity, passion, and how you think about problem-solving when constraints are removed.`,
    framework: 'Problem → Vision → Approach → Impact',
    modelAnswer: `I'd build [product idea] because [problem it solves]. The reason this excites me is [personal connection]. I'd approach it by [high-level plan], and the impact would be [measurable outcome]. This connects to my interest in ${jobTitle} because [connection].`,
    whatNotToSay: `Don't say "I don't know" or pick something completely unrelated to your field. Avoid ideas that are purely for personal gain.`,
    timeGuidance: 90,
    difficulty: 3,
    likelyFollowUp: 'How would you prioritize features for your first release?',
  })
  questions.push({
    questionText: `What's the most interesting technical problem you've solved recently, and what made it interesting?`,
    questionType: 'curveball',
    whyAsked: `${companyName} wants to understand what intellectually excites you and whether your curiosity aligns with their technical challenges.`,
    framework: 'Problem → Why Interesting → Approach → Outcome → Learning',
    modelAnswer: `Recently I tackled [problem]. What made it fascinating was [unique aspect]. I approached it by [method], which led to [outcome]. The most interesting part was discovering [insight], which changed how I think about [broader concept].`,
    whatNotToSay: `Don't pick a trivial problem or one where you just followed a tutorial. Avoid getting so technical that you lose the narrative.`,
    timeGuidance: 90,
    difficulty: 3,
    likelyFollowUp: 'How did that experience influence your subsequent work?',
  })
  questions.push({
    questionText: `If you could go back to the start of your career and give yourself one piece of advice, what would it be?`,
    questionType: 'curveball',
    whyAsked: `This tests self-reflection and maturity. It also reveals what you've learned and how you've grown professionally.`,
    framework: 'Reflection → Advice → Why → How Applied Now',
    modelAnswer: `I'd tell myself to focus more on understanding the business context behind technical decisions. Early in my career I optimized purely for technical elegance, but I've learned that the best engineering decisions consider business impact, user needs, and team sustainability alongside technical merit.`,
    whatNotToSay: `Don't say you have no regrets or give superficial advice like "work harder." Avoid answers that suggest you haven't grown.`,
    timeGuidance: 60,
    difficulty: 2,
    likelyFollowUp: 'How has that realization changed your day-to-day work?',
  })

  // --- 2 Opening ---
  questions.push({
    questionText: `Tell me about yourself and walk me through your background.`,
    questionType: 'opening',
    whyAsked: `This is your first impression. ${companyName} wants a concise professional narrative that shows why you're here interviewing for ${jobTitle}.`,
    framework: 'Present → Past → Future (2-minute pitch)',
    modelAnswer: `I'm currently [current role/situation]. I got here through [brief career arc]. My key strengths are [2-3 relevant skills] which I've demonstrated by [brief achievement]. I'm excited about the ${jobTitle} role at ${companyName} because [specific reason], and I believe my background in [area] makes me a strong fit.`,
    whatNotToSay: `Don't recite your entire resume chronologically. Avoid personal details unrelated to the role. Don't speak for more than 2 minutes.`,
    timeGuidance: 120,
    difficulty: 1,
    likelyFollowUp: 'What specifically drew you to apply for this position?',
  })
  questions.push({
    questionText: `Why are you looking to leave your current position?`,
    questionType: 'opening',
    whyAsked: `${companyName} wants to understand your motivation and ensure you're running toward an opportunity, not just away from problems.`,
    framework: 'Positive Framing → Growth → Alignment',
    modelAnswer: `I've had a great experience at my current company where I [achievement]. However, I'm looking for an opportunity to [growth area] and the ${jobTitle} role at ${companyName} aligns perfectly with where I want to take my career, especially [specific aspect].`,
    whatNotToSay: `Never badmouth your current employer or colleagues. Avoid saying it's purely about money. Don't give answers that suggest instability.`,
    timeGuidance: 60,
    difficulty: 2,
    likelyFollowUp: 'What would your current manager say about you?',
  })

  // --- 3 Closing ---
  questions.push({
    questionText: `What questions do you have for us about ${companyName} or the ${jobTitle} role?`,
    questionType: 'closing',
    whyAsked: `Your questions reveal your priorities, research depth, and genuine interest in the role and ${companyName}.`,
    framework: 'Role → Team → Company → Growth',
    modelAnswer: `Prepare 3-5 thoughtful questions such as: "What does success look like in the first 90 days?", "How is the team structured and what's the collaboration style?", "What's the biggest challenge the team is currently facing?", "How does ${companyName} support professional development?"`,
    whatNotToSay: `Never say "I don't have any questions." Avoid asking about salary/benefits in early rounds. Don't ask questions easily answered by the website.`,
    timeGuidance: 60,
    difficulty: 1,
    likelyFollowUp: `Is there anything else you'd like to share before we wrap up?`,
  })
  questions.push({
    questionText: `Where do you see yourself in 3-5 years?`,
    questionType: 'closing',
    whyAsked: `${companyName} invests in hiring. They want to know your growth trajectory aligns with what they can offer and that you plan to stay.`,
    framework: 'Vision → Growth Path → Company Alignment',
    modelAnswer: `In 3-5 years, I see myself having deepened my expertise in [area] and taken on more responsibility, potentially leading [type of initiative]. I'm drawn to ${companyName} because the growth path here aligns with these goals, especially [specific opportunity].`,
    whatNotToSay: `Don't say you want to start your own company, take their job, or that you haven't thought about it. Avoid answers disconnected from the role.`,
    timeGuidance: 60,
    difficulty: 2,
    likelyFollowUp: 'What skills do you want to develop to get there?',
  })
  questions.push({
    questionText: `Is there anything we haven't covered that you'd like us to know about you?`,
    questionType: 'closing',
    whyAsked: `This is your final chance to reinforce your candidacy or address something you didn't get to mention.`,
    framework: 'Key Selling Point → Evidence → Enthusiasm',
    modelAnswer: `I'd like to emphasize [key strength or experience] that I think is particularly relevant. For example, [brief story or data point]. I'm genuinely excited about this opportunity at ${companyName} and believe I can make a meaningful impact as your ${jobTitle}.`,
    whatNotToSay: `Don't say "No, I think we covered everything" — always use this opportunity. Avoid introducing concerns or negatives.`,
    timeGuidance: 60,
    difficulty: 1,
    likelyFollowUp: `Thank you — we'll be in touch with next steps.`,
  })

  return questions
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

    // Generate questions using application context
    const questionTemplates = generateQuestions(
      application.companyName,
      application.jobTitle,
      application.resumeText,
      application.jdText
    )

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
