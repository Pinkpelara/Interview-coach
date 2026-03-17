'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  AlertTriangle,
  Check,
  Mic,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Flag,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { ProgressBar } from '@/components/ui/ProgressBar'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserAnswer {
  id: string
  answerText: string
  confidenceRating: number
  status: string
  practiceCount: number
}

interface Question {
  id: string
  questionText: string
  questionType: string
  whyAsked: string | null
  framework: string | null
  modelAnswer: string | null
  whatNotToSay: string | null
  timeGuidance: number | null
  difficulty: number
  likelyFollowUp: string | null
  userAnswers: UserAnswer[]
}

interface Application {
  id: string
  companyName: string
  jobTitle: string
}

type TabKey = 'questions' | 'flashcards' | 'coaching'

type QuestionFilter =
  | 'all'
  | 'behavioral'
  | 'technical'
  | 'situational'
  | 'company-specific'
  | 'curveball'
  | 'opening'
  | 'closing'
  | 'culture'
  | 'leadership'
  | 'role-specific'

// ─── Constants ───────────────────────────────────────────────────────────────

const QUESTION_TYPE_COLORS: Record<string, string> = {
  behavioral: 'bg-blue-500/20 text-blue-400',
  technical: 'bg-purple-500/20 text-purple-400',
  situational: 'bg-green-500/20 text-green-400',
  'company-specific': 'bg-orange-500/20 text-orange-400',
  culture: 'bg-pink-500/20 text-pink-400',
  leadership: 'bg-amber-500/20 text-amber-400',
  'role-specific': 'bg-cyan-500/20 text-cyan-400',
  curveball: 'bg-red-500/20 text-red-400',
  opening: 'bg-[#333] text-gray-400',
  closing: 'bg-[#333] text-gray-400',
}

const STATUS_BADGE_CONFIG: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'info' }> = {
  drafting: { label: 'Drafting', variant: 'warning' },
  rehearsing: { label: 'Rehearsing', variant: 'info' },
  ready: { label: 'Ready', variant: 'success' },
  none: { label: 'Not started', variant: 'default' },
}

const FILTER_OPTIONS: { label: string; value: QuestionFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Behavioral', value: 'behavioral' },
  { label: 'Technical', value: 'technical' },
  { label: 'Situational', value: 'situational' },
  { label: 'Company-Specific', value: 'company-specific' },
  { label: 'Culture Fit', value: 'culture' },
  { label: 'Leadership', value: 'leadership' },
  { label: 'Role-Specific', value: 'role-specific' },
  { label: 'Curveball', value: 'curveball' },
  { label: 'Opening', value: 'opening' },
  { label: 'Closing', value: 'closing' },
]

const COACHING_SECTIONS = [
  {
    title: 'STAR Method',
    content:
      'The STAR method helps you structure behavioral answers clearly:\n\n' +
      'Situation: Set the context. Where were you? What was happening?\n' +
      'Task: What was your responsibility or the challenge you faced?\n' +
      'Action: What specific steps did YOU take? (Use "I" not "we")\n' +
      'Result: What was the outcome? Quantify with numbers when possible.\n\n' +
      'Tip: Keep the Situation and Task brief (20% of time). Spend the most time on Action (50%) and close strong with Result (30%).',
  },
  {
    title: 'SOAR Method',
    content:
      'SOAR is an alternative to STAR that emphasizes positive outcomes:\n\n' +
      'Situation: Describe the context and challenge.\n' +
      'Obstacle: What specific obstacle stood in your way?\n' +
      'Action: What did you do to overcome it?\n' +
      'Result: What positive outcome did you achieve?\n\n' +
      'Best for: Questions about overcoming challenges, resilience, and problem-solving. SOAR highlights your ability to turn obstacles into wins.',
  },
  {
    title: 'Body Language Guide',
    content:
      'Your non-verbal communication matters as much as your words:\n\n' +
      'Eye Contact: Maintain steady (not staring) eye contact. In video calls, look at the camera.\n' +
      'Posture: Sit upright, lean slightly forward to show engagement.\n' +
      'Hands: Use natural gestures. Avoid crossing arms or fidgeting.\n' +
      'Smile: A genuine smile at the start and end creates warmth.\n' +
      'Pace: Speak at a measured pace. Pausing before answering shows thoughtfulness, not uncertainty.\n' +
      'Mirror: Subtly match the interviewer\'s energy level.',
  },
  {
    title: 'Company Research',
    content:
      'Thorough company research demonstrates genuine interest:\n\n' +
      'Mission & Values: Understand and reference their stated mission.\n' +
      'Recent News: Check press releases, blog posts, and news in the last 3-6 months.\n' +
      'Products/Services: Know their core offerings and target market.\n' +
      'Competitors: Understand their competitive landscape.\n' +
      'Culture: Read Glassdoor reviews, check their social media, and look at team pages.\n' +
      'Financials: For public companies, know recent earnings trends.\n' +
      'Interviewer: Look up your interviewer on LinkedIn to find common ground.',
  },
  {
    title: 'Salary Negotiation',
    content:
      'Approach salary discussions strategically:\n\n' +
      'Timing: Delay salary discussion until you have an offer if possible.\n' +
      'Research: Know your market value using Glassdoor, Levels.fyi, or Payscale.\n' +
      'Range: Give a range with your target at the bottom.\n' +
      'Total Comp: Consider base, bonus, equity, benefits, PTO, and flexibility.\n' +
      'Deflect Early: "I\'d like to learn more about the role first. I\'m confident we can find a number that works for both of us."\n' +
      'Counter: "Based on my research and experience, I was expecting something in the range of X-Y. Is there flexibility?"',
  },
  {
    title: 'Handling Unknown Questions',
    content:
      'When you get a question you don\'t know how to answer:\n\n' +
      'Pause: Take a breath. 3-5 seconds of silence is perfectly acceptable.\n' +
      'Clarify: "That\'s a great question. Could you elaborate on [specific aspect]?"\n' +
      'Think Aloud: "Let me think through this..." and walk through your reasoning.\n' +
      'Bridge: Connect to something you do know: "I haven\'t encountered that exact scenario, but in a similar situation I..."\n' +
      'Be Honest: "I\'m not sure about X, but here\'s how I would approach finding the answer..."\n' +
      'Never: Don\'t make up facts, panic, or say "I have no idea."',
  },
]

// ─── Red-flag scanning helpers ───────────────────────────────────────────────

interface RedFlag {
  type: string
  pattern: string
  match: string
}

function scanRedFlags(text: string, timeGuidance: number | null): RedFlag[] {
  const flags: RedFlag[] = []

  const uncertainPatterns = [
    'i think',
    'sort of',
    'kind of',
    'maybe',
    'i feel like',
  ]

  const ownershipPatterns = [
    'we did',
    'the team',
  ]

  const lower = text.toLowerCase()

  for (const p of uncertainPatterns) {
    if (lower.includes(p)) {
      flags.push({ type: 'Uncertain Language', pattern: p, match: `Detected "${p}" — replace with confident language.` })
    }
  }

  // Check ownership: flag "we did" or "the team" only if no "I" present nearby
  for (const p of ownershipPatterns) {
    if (lower.includes(p) && !lower.includes('i ')) {
      flags.push({ type: 'Missing Ownership', pattern: p, match: `Detected "${p}" without "I" — show personal contribution.` })
    }
  }

  // Check for missing numbers / metrics when answer is substantial
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const hasNumbers = /\d+/.test(text)
  if (wordCount > 100 && !hasNumbers) {
    flags.push({
      type: 'Missing Numbers',
      pattern: 'No metrics or numbers found',
      match: 'Consider adding quantifiable results (%, $, time saved, etc.)',
    })
  }

  // Over time check
  if (timeGuidance) {
    const maxWords = 1.5 * timeGuidance * (130 / 60)
    if (wordCount > maxWords) {
      flags.push({
        type: 'Over Time',
        pattern: `${wordCount} words exceeds ~${Math.round(maxWords)} word limit`,
        match: `Your answer is too long for a ${timeGuidance}s response. Trim to stay on time.`,
      })
    }
  }

  return flags
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PreparePage() {
  const { data: session, status: sessionStatus } = useSession()
  const params = useParams()
  const applicationId = params.applicationId as string

  // Application details
  const [application, setApplication] = useState<Application | null>(null)

  // State
  const [activeTab, setActiveTab] = useState<TabKey>('questions')
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<QuestionFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [answerWorkspaceId, setAnswerWorkspaceId] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')
  const [savingAnswer, setSavingAnswer] = useState(false)
  const [confidenceRating, setConfidenceRating] = useState(0)
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout | null>(null)
  const [showRedFlags, setShowRedFlags] = useState(false)
  const [aiFeedback, setAiFeedback] = useState<{
    strengths: string[]
    issues: string[]
    missingElements: string[]
    scores: { structure: number; specificity: number; confidence: number; overall: number }
    verdict: string
  } | null>(null)
  const [analyzingAnswer, setAnalyzingAnswer] = useState(false)

  // Flashcard state
  const [flashcardIndex, setFlashcardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  // Coaching accordion state
  const [openCoachingSection, setOpenCoachingSection] = useState<number | null>(null)

  // Fetch application details
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return

    async function fetchApplication() {
      try {
        const res = await fetch(`/api/applications/${applicationId}`)
        if (res.ok) {
          const data = await res.json()
          setApplication(data)
        }
      } catch (err) {
        console.error('Failed to fetch application:', err)
      }
    }

    fetchApplication()
  }, [applicationId, sessionStatus])

  // Fetch questions
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return

    async function fetchQuestions() {
      try {
        setLoading(true)
        const res = await fetch(`/api/questions?applicationId=${applicationId}`)
        if (res.ok) {
          const data = await res.json()
          setQuestions(data)
        }
      } catch (err) {
        console.error('Failed to fetch questions:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchQuestions()
  }, [applicationId, sessionStatus])

  // Red flag debounce: show flags after 2s pause in typing
  const handleDraftChange = useCallback((value: string) => {
    setDraftText(value)
    setShowRedFlags(false)

    if (typingTimer) clearTimeout(typingTimer)

    const timer = setTimeout(() => {
      setShowRedFlags(true)
    }, 2000)

    setTypingTimer(timer)
  }, [typingTimer])

  // Generate question bank
  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })

      if (res.ok) {
        const data = await res.json()
        setQuestions(data.map((q: Question) => ({ ...q, userAnswers: q.userAnswers || [] })))
      }
    } catch (err) {
      console.error('Failed to generate questions:', err)
    } finally {
      setGenerating(false)
    }
  }

  // Save answer
  async function handleSaveAnswer(questionId: string) {
    if (!draftText.trim()) return
    setSavingAnswer(true)
    try {
      const res = await fetch('/api/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          answerText: draftText,
          confidenceRating,
          status: 'drafting',
        }),
      })

      if (res.ok) {
        const savedAnswer = await res.json()
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId
              ? { ...q, userAnswers: [savedAnswer] }
              : q
          )
        )
        setAnswerWorkspaceId(null)
        setDraftText('')
        setConfidenceRating(0)
      }
    } catch (err) {
      console.error('Failed to save answer:', err)
    } finally {
      setSavingAnswer(false)
    }
  }

  // Flashcard rating
  const handleFlashcardRate = useCallback((rating: 'easy' | 'got_it' | 'need_work') => {
    const confidenceMap = { easy: 5, got_it: 3, need_work: 1 } as const
    const statusMap = { easy: 'ready', got_it: 'rehearsing', need_work: 'drafting' } as const
    const currentQuestion = questions[flashcardIndex]
    if (currentQuestion) {
      const answerText =
        currentQuestion.userAnswers[0]?.answerText ||
        currentQuestion.modelAnswer ||
        ''
      if (answerText) {
        fetch('/api/answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: currentQuestion.id,
            answerText,
            confidenceRating: confidenceMap[rating],
            status: statusMap[rating],
          }),
        })
          .then((res) => {
            if (res.ok) return res.json()
          })
          .then((savedAnswer) => {
            if (savedAnswer) {
              setQuestions((prev) =>
                prev.map((q) =>
                  q.id === currentQuestion.id
                    ? { ...q, userAnswers: [savedAnswer] }
                    : q
                )
              )
            }
          })
      }
    }
    setFlipped(false)
    setFlashcardIndex((prev) => Math.min(prev + 1, Math.max(questions.length - 1, 0)))
  }, [questions, flashcardIndex])

  // ─── Derived values ─────────────────────────────────────────────────────────

  const filteredQuestions =
    filter === 'all'
      ? questions
      : questions.filter((q) => q.questionType === filter)

  const readyCount = questions.filter(
    (q) => q.userAnswers[0]?.status === 'ready'
  ).length
  const readyPercent = questions.length > 0 ? Math.round((readyCount / questions.length) * 100) : 0

  const wordCount = draftText.trim().split(/\s+/).filter(Boolean).length
  const speakingTime = Math.round((wordCount / 130) * 60) // seconds

  const activeQuestion = answerWorkspaceId
    ? questions.find((q) => q.id === answerWorkspaceId) || null
    : null

  const redFlags = activeQuestion ? scanRedFlags(draftText, activeQuestion.timeGuidance) : []

  // ─── Loading / Auth states ──────────────────────────────────────────────────

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#5b5fc7] border-t-transparent" />
      </div>
    )
  }

  // ─── Tabs ───────────────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'questions', label: 'Question Bank', icon: BookOpen },
    { key: 'flashcards', label: 'Flashcards', icon: RotateCcw },
    { key: 'coaching', label: 'Coaching Library', icon: Brain },
  ]

  // ─── Render helpers ─────────────────────────────────────────────────────────

  function renderStars(count: number, interactive?: boolean, onRate?: (n: number) => void) {
    return (
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            onClick={interactive && onRate ? () => onRate(i + 1) : undefined}
            className={`h-3.5 w-3.5 ${
              i < count ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
            } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
          />
        ))}
      </span>
    )
  }

  function getAnswerStatus(q: Question): string {
    return q.userAnswers[0]?.status || 'none'
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">
          {application
            ? `Prepare for ${application.companyName} — ${application.jobTitle}`
            : 'Prepare'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Build your answer bank, rehearse with flashcards, and master interview frameworks.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-[#333] p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#292929] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Question Bank Tab ────────────────────────────────────────────────── */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {/* Generate button when questions exist */}
          {questions.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
                {filter !== 'all' ? ` (${filter})` : ''}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                loading={generating}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate Questions
              </Button>
            </div>
          )}

          {questions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#5b5fc7]/10 mb-4">
                  <BookOpen className="h-8 w-8 text-[#5b5fc7]" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  No questions yet
                </h3>
                <p className="mt-2 max-w-sm text-sm text-gray-500">
                  Generate a personalized question bank based on your resume and job description.
                </p>
                <Button
                  className="mt-6"
                  onClick={handleGenerate}
                  loading={generating}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Questions
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Filter bar */}
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter === opt.value
                        ? 'bg-[#5b5fc7] text-white'
                        : 'bg-[#333] text-gray-400 hover:bg-[#3d3d3d]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Answer workspace (split view) */}
              {answerWorkspaceId && activeQuestion && (
                <Card className="border-[#5b5fc7]/30 bg-[#5b5fc7]/10">
                  <CardContent className="space-y-4">
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Left: question details */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                              QUESTION_TYPE_COLORS[activeQuestion.questionType] || 'bg-[#333] text-gray-400'
                            }`}
                          >
                            {activeQuestion.questionType}
                          </span>
                          {renderStars(activeQuestion.difficulty)}
                          {activeQuestion.timeGuidance && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="h-3.5 w-3.5" />
                              {activeQuestion.timeGuidance} seconds
                            </span>
                          )}
                        </div>
                        <p className="text-base font-semibold text-white leading-snug">
                          {activeQuestion.questionText}
                        </p>
                        {activeQuestion.whyAsked && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Why Asked</h4>
                            <p className="mt-1 text-sm text-gray-400">{activeQuestion.whyAsked}</p>
                          </div>
                        )}
                        {activeQuestion.framework && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Framework</h4>
                            <p className="mt-1 text-sm text-gray-400">{activeQuestion.framework}</p>
                          </div>
                        )}
                        {activeQuestion.modelAnswer && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Model Answer</h4>
                            <p className="mt-1 text-sm text-gray-400">{activeQuestion.modelAnswer}</p>
                          </div>
                        )}
                      </div>

                      {/* Right: answer editor */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-white">Your Answer</h4>
                        <Textarea
                          value={draftText}
                          onChange={(e) => handleDraftChange(e.target.value)}
                          placeholder="Write your answer here. Be specific, use 'I' not 'we', and include numbers where possible..."
                          className="min-h-[200px]"
                        />

                        {/* Live stats */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                          <span>
                            <strong>{wordCount}</strong> words
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            ~{speakingTime}s estimated speaking time
                            {activeQuestion.timeGuidance && (
                              <span
                                className={
                                  speakingTime > activeQuestion.timeGuidance
                                    ? 'text-red-500 font-medium'
                                    : 'text-green-400'
                                }
                              >
                                {' '}(target: {activeQuestion.timeGuidance}s)
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Red flags (shown after 2s typing pause) */}
                        {showRedFlags && redFlags.length > 0 && draftText.length > 10 && (
                          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                              <Flag className="h-3.5 w-3.5" />
                              Answer Scan ({redFlags.length} flag{redFlags.length > 1 ? 's' : ''})
                            </div>
                            {redFlags.map((flag, i) => (
                              <p key={i} className="text-xs text-amber-400">
                                <span className="font-medium">{flag.type}:</span>{' '}
                                {flag.match}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Confidence rating */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-400">Confidence:</span>
                          {renderStars(confidenceRating, true, setConfidenceRating)}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveAnswer(activeQuestion.id)}
                            loading={savingAnswer}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Save Answer
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            loading={analyzingAnswer}
                            onClick={async () => {
                              if (!draftText.trim() || !activeQuestion) return
                              setAnalyzingAnswer(true)
                              setAiFeedback(null)
                              try {
                                const res = await fetch('/api/answers/analyze', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    questionId: activeQuestion.id,
                                    answerText: draftText,
                                  }),
                                })
                                if (res.ok) {
                                  const data = await res.json()
                                  setAiFeedback(data)
                                }
                              } catch (err) {
                                console.error('Analysis failed:', err)
                              } finally {
                                setAnalyzingAnswer(false)
                              }
                            }}
                          >
                            <Sparkles className="mr-1 h-3.5 w-3.5" />
                            Analyze My Answer
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAnswerWorkspaceId(null)
                              setDraftText('')
                              setConfidenceRating(0)
                              setAiFeedback(null)
                            }}
                          >
                            Close
                          </Button>
                        </div>

                        {/* AI Feedback */}
                        {aiFeedback && (
                          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-semibold text-blue-400">AI Analysis</h5>
                              <div className="flex items-center gap-2">
                                {(['structure', 'specificity', 'confidence', 'overall'] as const).map(dim => (
                                  <span key={dim} className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400 bg-blue-500/20 rounded-full px-2 py-0.5">
                                    {dim}: {aiFeedback.scores[dim]}/10
                                  </span>
                                ))}
                              </div>
                            </div>

                            <p className="text-xs font-semibold text-blue-300 border-b border-blue-500/30 pb-2">
                              {aiFeedback.verdict}
                            </p>

                            {aiFeedback.strengths.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-green-400 uppercase mb-1">Strengths</p>
                                {aiFeedback.strengths.map((s, i) => (
                                  <p key={i} className="text-xs text-green-400 flex items-start gap-1.5">
                                    <Check className="h-3 w-3 mt-0.5 flex-shrink-0" />{s}
                                  </p>
                                ))}
                              </div>
                            )}

                            {aiFeedback.issues.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Issues</p>
                                {aiFeedback.issues.map((s, i) => (
                                  <p key={i} className="text-xs text-red-400 flex items-start gap-1.5">
                                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />{s}
                                  </p>
                                ))}
                              </div>
                            )}

                            {aiFeedback.missingElements.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-amber-400 uppercase mb-1">Missing Elements</p>
                                {aiFeedback.missingElements.map((s, i) => (
                                  <p key={i} className="text-xs text-amber-400 flex items-start gap-1.5">
                                    <Flag className="h-3 w-3 mt-0.5 flex-shrink-0" />{s}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Question grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {filteredQuestions.map((q) => {
                  const isExpanded = expandedId === q.id
                  const status = getAnswerStatus(q)
                  const statusConfig = STATUS_BADGE_CONFIG[status] || STATUS_BADGE_CONFIG.none

                  return (
                    <Card
                      key={q.id}
                      className={`transition-shadow hover:shadow-md ${
                        isExpanded ? 'md:col-span-2' : ''
                      }`}
                    >
                      <CardContent className="space-y-3">
                        {/* Top row: type badge + difficulty + time */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                              QUESTION_TYPE_COLORS[q.questionType] || 'bg-[#333] text-gray-400'
                            }`}
                          >
                            {q.questionType}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {renderStars(q.difficulty)}
                            {q.timeGuidance && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {q.timeGuidance} seconds
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Question text */}
                        <p className="text-sm font-bold text-white leading-snug">
                          {q.questionText}
                        </p>

                        {/* Status + actions */}
                        <div className="flex items-center justify-between">
                          <Badge variant={statusConfig.variant}>
                            {statusConfig.label}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setExpandedId(isExpanded ? null : q.id)
                              }}
                            >
                              {isExpanded ? (
                                <ChevronUp className="mr-1 h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="mr-1 h-3.5 w-3.5" />
                              )}
                              {isExpanded ? 'Collapse' : 'Details'}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setAnswerWorkspaceId(q.id)
                                setDraftText(q.userAnswers[0]?.answerText || '')
                                setConfidenceRating(q.userAnswers[0]?.confidenceRating || 0)
                                setAiFeedback(null)
                              }}
                            >
                              <Mic className="mr-1 h-3.5 w-3.5" />
                              Build My Answer
                            </Button>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-2 space-y-3 border-t border-[#333] pt-3">
                            {q.whyAsked && (
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Why Asked
                                </h4>
                                <p className="mt-1 text-sm text-gray-400">{q.whyAsked}</p>
                              </div>
                            )}
                            {q.framework && (
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Framework
                                </h4>
                                <p className="mt-1 text-sm text-gray-400">{q.framework}</p>
                              </div>
                            )}
                            {q.modelAnswer && (
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Model Answer
                                </h4>
                                <p className="mt-1 text-sm text-gray-400">{q.modelAnswer}</p>
                              </div>
                            )}
                            {q.whatNotToSay && (
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-red-400">
                                  What Not To Say
                                </h4>
                                <p className="mt-1 text-sm text-red-400">{q.whatNotToSay}</p>
                              </div>
                            )}
                            {q.likelyFollowUp && (
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Likely Follow-up
                                </h4>
                                <p className="mt-1 text-sm text-gray-400 italic">
                                  &ldquo;{q.likelyFollowUp}&rdquo;
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Flashcards Tab ───────────────────────────────────────────────────── */}
      {activeTab === 'flashcards' && (
        <div className="space-y-6">
          {questions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#5b5fc7]/10 mb-4">
                  <RotateCcw className="h-8 w-8 text-[#5b5fc7]" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  No flashcards available
                </h3>
                <p className="mt-2 max-w-sm text-sm text-gray-500">
                  Generate your question bank first, then come back to practice with flashcards.
                </p>
                <Button
                  className="mt-6"
                  onClick={() => setActiveTab('questions')}
                >
                  Go to Question Bank
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Progress */}
              <ProgressBar
                value={readyPercent}
                label="Questions Ready"
                showPercent
              />

              {/* Card counter */}
              <p className="text-center text-sm font-medium text-gray-400">
                Card {flashcardIndex + 1} of {questions.length}
              </p>

              {/* Flashcard */}
              <div className="mx-auto w-full max-w-2xl">
                <Card className="min-h-[300px] flex items-center justify-center transition-all">
                  <CardContent className="w-full text-center">
                    {!flipped ? (
                      <>
                        <p className="text-lg font-semibold text-white leading-relaxed">
                          {questions[flashcardIndex]?.questionText}
                        </p>
                      </>
                    ) : (
                      <>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                          {questions[flashcardIndex]?.userAnswers[0]
                            ? 'Your Answer'
                            : '(Model Answer)'}
                        </h4>
                        <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">
                          {questions[flashcardIndex]?.userAnswers[0]?.answerText ||
                            questions[flashcardIndex]?.modelAnswer ||
                            'No answer saved yet. Build your answer in the Question Bank tab.'}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Flip button */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setFlipped(!flipped)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Flip
                </Button>
              </div>

              {/* Rating buttons */}
              <div className="flex justify-center gap-3">
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => handleFlashcardRate('need_work')}
                >
                  Need Work
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                  onClick={() => handleFlashcardRate('got_it')}
                >
                  Got It
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className="bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  onClick={() => handleFlashcardRate('easy')}
                >
                  Easy
                </Button>
              </div>

              {/* Navigation arrows */}
              <div className="flex justify-center items-center gap-6">
                <button
                  onClick={() => {
                    setFlipped(false)
                    setFlashcardIndex((prev) => Math.max(prev - 1, 0))
                  }}
                  disabled={flashcardIndex === 0}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  onClick={() => {
                    setFlipped(false)
                    setFlashcardIndex((prev) => Math.min(prev + 1, questions.length - 1))
                  }}
                  disabled={flashcardIndex === questions.length - 1}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Coaching Library Tab ─────────────────────────────────────────────── */}
      {activeTab === 'coaching' && (
        <div className="space-y-3">
          {COACHING_SECTIONS.map((section, idx) => {
            const isOpen = openCoachingSection === idx
            return (
              <Card key={idx}>
                <button
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                  onClick={() =>
                    setOpenCoachingSection(isOpen ? null : idx)
                  }
                >
                  <span className="text-sm font-semibold text-white">
                    {section.title}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                {isOpen && (
                  <CardContent className="border-t border-[#333] pt-3">
                    <p className="text-sm text-gray-400 whitespace-pre-line leading-relaxed">
                      {section.content}
                    </p>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
