'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  DollarSign,
  Send,
  ArrowLeft,
  Target,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'

type Difficulty = 'flexible' | 'standard' | 'firm'

interface NegotiationMessage {
  id: string
  speaker: 'candidate' | 'hiring_manager'
  text: string
  annotation?: string
}

interface ApplicationContext {
  id: string
  companyName: string
  jobTitle: string
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; description: string; badge: 'success' | 'warning' | 'danger' }> = {
  flexible: { label: 'Flexible Manager', description: 'Willing to negotiate and meet in the middle. Good for practice.', badge: 'success' },
  standard: { label: 'Standard Negotiation', description: 'Will push back but open to reasonable counteroffers.', badge: 'warning' },
  firm: { label: 'Firm on Budget', description: 'Very limited room. Will push back hard. High difficulty.', badge: 'danger' },
}

const INITIAL_OFFERS: Record<Difficulty, { base: string; total: string; opening: string }> = {
  flexible: {
    base: '$115,000',
    total: '$135,000',
    opening: "We'd like to offer you the position! We're offering a base salary of $115,000, with a total compensation package valued at approximately $135,000 including benefits and a performance bonus. How does that sound to you?",
  },
  standard: {
    base: '$105,000',
    total: '$125,000',
    opening: "Congratulations — we'd like to extend an offer. The base salary is $105,000 with total compensation around $125,000. This is a competitive offer for the role. What are your thoughts?",
  },
  firm: {
    base: '$95,000',
    total: '$110,000',
    opening: "We're pleased to offer you the role at a base salary of $95,000. Total compensation is approximately $110,000. I want to be upfront — our budget for this position is fairly set. Do you have any questions?",
  },
}

const MANAGER_RESPONSES: Record<Difficulty, string[]> = {
  flexible: [
    "That's a fair point. Let me see what I can do — I think we have some room to work with on the base.",
    "I appreciate you being direct. Let me check with our compensation team. I believe we can get closer to your number.",
    "You make a good case. How about we meet in the middle? I can push the base up and also look at the signing bonus.",
    "I think we can accommodate that. Let me put together a revised offer that reflects your experience level.",
    "That works for us. I'll have the updated offer letter sent over by end of day.",
  ],
  standard: [
    "I understand your perspective. The base is somewhat fixed, but I might have flexibility on the bonus structure.",
    "That's higher than our range for this level, but let me see if we can adjust the equity component.",
    "I appreciate the counter. We can't go that high on base, but what if we enhanced the relocation package and added an extra week of PTO?",
    "Let me be honest — we're close to our ceiling on cash compensation. But I can look at accelerating your review timeline.",
    "That's a strong counter. I'll need to discuss with leadership, but I think we can find a compromise.",
  ],
  firm: [
    "I understand that's below your expectations, but this is the approved range for the role. The growth potential here is significant though.",
    "Unfortunately, we don't have flexibility on the base. However, the equity refreshers at your first review could be substantial.",
    "I hear you, but our compensation bands are standardized across the team. I wouldn't want to create internal equity issues.",
    "I wish I could offer more, but this is the best we can do right now. The role itself offers incredible career growth.",
    "I appreciate your candor. Let me see if there's anything non-monetary I can add — perhaps flexible work arrangements or professional development budget.",
  ],
}

export default function SalaryNegotiationPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const applicationId = searchParams.get('applicationId') || ''
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [messages, setMessages] = useState<NegotiationMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [exchangeCount, setExchangeCount] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [application, setApplication] = useState<ApplicationContext | null>(null)
  const [loadingApplication, setLoadingApplication] = useState(true)
  const [contextError, setContextError] = useState<string | null>(null)
  const [plan, setPlan] = useState('free')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const responseIndexRef = useRef(0)
  const canStartSimulator = !contextError && (plan === 'pro' || plan === 'crunch')

  useEffect(() => {
    async function loadContext() {
      if (!applicationId) {
        setContextError('Select an application from Pressure Lab before starting Salary Negotiation.')
        setLoadingApplication(false)
        return
      }
      try {
        const res = await fetch(`/api/applications/${applicationId}`)
        if (!res.ok) throw new Error('Failed to load application')
        const data = await res.json()
        setApplication({
          id: data.id,
          companyName: data.companyName,
          jobTitle: data.jobTitle,
        })
      } catch {
        setContextError('Unable to load application context for this negotiation drill.')
      } finally {
        setLoadingApplication(false)
      }
    }
    async function loadPlan() {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setPlan(data.plan || 'free')
      }
    }
    void loadContext()
    void loadPlan()
  }, [applicationId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startSession = (diff: Difficulty) => {
    if (!canStartSimulator) return
    setDifficulty(diff)
    const offer = INITIAL_OFFERS[diff]
    setMessages([{
      id: 'initial',
      speaker: 'hiring_manager',
      text: offer.opening,
    }])
    setExchangeCount(0)
    setSessionComplete(false)
    responseIndexRef.current = 0
  }

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isSending || !difficulty || sessionComplete) return

    const userText = inputText.trim()
    setInputText('')
    setIsSending(true)

    setMessages(prev => [...prev, {
      id: `candidate_${Date.now()}`,
      speaker: 'candidate',
      text: userText,
    }])

    // Simulate manager thinking
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000))

    const responses = MANAGER_RESPONSES[difficulty]
    const responseText = responses[responseIndexRef.current % responses.length]
    responseIndexRef.current++

    // Generate annotation based on candidate's message
    let annotation: string | undefined
    const lower = userText.toLowerCase()
    if (lower.includes('i think') || lower.includes('maybe') || lower.includes('i was hoping')) {
      annotation = 'Uncertain language weakens your position. State your counter directly: "Based on my research, I\'m targeting $X."'
    } else if (lower.includes('market rate') || lower.includes('research') || lower.includes('glassdoor') || lower.includes('levels')) {
      annotation = 'Good — citing market data strengthens your negotiating position. Always anchor to external benchmarks.'
    } else if (lower.includes('accept') || lower.includes('deal') || lower.includes('sounds good')) {
      annotation = 'You accepted quickly. In real negotiations, even if the offer is good, asking for time to review shows professionalism.'
    } else if (/\d/.test(userText)) {
      annotation = 'Specific numbers are strong. Always counter with a range where your target is the bottom.'
    }

    setMessages(prev => [...prev, {
      id: `manager_${Date.now()}`,
      speaker: 'hiring_manager',
      text: responseText,
      annotation,
    }])

    setExchangeCount(prev => prev + 1)

    if (exchangeCount >= 3) {
      setSessionComplete(true)
    }

    setIsSending(false)
  }, [inputText, isSending, difficulty, sessionComplete, exchangeCount])

  // Selection screen
  if (!difficulty) {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/pressure-lab" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Pressure Lab
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-600" />
            Salary Negotiation Simulator
          </h2>
          <p className="mt-1 text-gray-500">Practice the full negotiation arc from initial offer to close.</p>
          {!loadingApplication && application && (
            <p className="mt-2 text-sm text-gray-700">
              Context: <span className="font-medium">{application.companyName}</span> — {application.jobTitle}
            </p>
          )}
          {!loadingApplication && contextError && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {contextError}
            </div>
          )}
          {plan !== 'pro' && plan !== 'crunch' && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Salary negotiation simulator is available on Pro and Crunch plans. <Link href="/pricing" className="underline">Upgrade</Link>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG.flexible][]).map(([key, config]) => (
            <Card
              key={key}
              className={`transition-shadow ${canStartSimulator ? 'hover:shadow-md cursor-pointer' : 'opacity-80'}`}
              onClick={canStartSimulator ? () => startSession(key) : undefined}
            >
              <CardContent className="text-center py-8 space-y-3">
                <Badge variant={config.badge}>{config.label}</Badge>
                <p className="text-sm text-gray-600">{config.description}</p>
                <p className="text-xs text-gray-400">Initial offer: {INITIAL_OFFERS[key].base} base</p>
                <Button size="sm" disabled={!canStartSimulator}>
                  Start Negotiation
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Salary Negotiation
          </h2>
          <p className="text-sm text-gray-500">
            <Badge variant={DIFFICULTY_CONFIG[difficulty].badge} className="mr-2">
              {DIFFICULTY_CONFIG[difficulty].label}
            </Badge>
            Round {exchangeCount + 1}
          </p>
          {application && (
            <p className="text-xs text-gray-500 mt-1">
              {application.companyName} — {application.jobTitle}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => { setDifficulty(null); setMessages([]) }}>
          New Session
        </Button>
      </div>

      {/* Chat area */}
      <Card>
        <CardContent className="p-0">
          <div className="h-[500px] overflow-y-auto p-6 space-y-4">
            {messages.map(msg => (
              <div key={msg.id}>
                <div className={`flex ${msg.speaker === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start gap-3 max-w-[80%] ${msg.speaker === 'candidate' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                      msg.speaker === 'candidate' ? 'bg-blue-600' : 'bg-green-600'
                    }`}>
                      {msg.speaker === 'candidate' ? 'Y' : 'HM'}
                    </div>
                    <div className={`rounded-2xl px-4 py-3 ${
                      msg.speaker === 'candidate'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                </div>
                {msg.annotation && (
                  <div className={`mt-1 ${msg.speaker === 'candidate' ? 'text-right' : 'ml-11'}`}>
                    <span className="inline-block text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5">
                      {msg.annotation}
                    </span>
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3 ml-11">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">thinking</span>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          {!sessionComplete ? (
            <div className="border-t border-gray-100 p-4 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Type your negotiation response..."
                disabled={isSending}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={isSending || !inputText.trim()}
                className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="border-t border-gray-100 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Target className="h-5 w-5 text-brand-600" />
                Negotiation Debrief
              </h3>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> What Worked
                  </p>
                  <p className="text-xs text-green-600">You engaged in the negotiation rather than accepting immediately. This signals confidence.</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> To Improve
                  </p>
                  <p className="text-xs text-amber-600">Always anchor to market data. Use specific numbers and ranges rather than vague requests.</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" /> Next Time
                  </p>
                  <p className="text-xs text-blue-600">Consider total compensation: equity, bonus, PTO, remote flexibility, and professional development budget.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button size="sm" onClick={() => startSession(difficulty)}>Practice Again</Button>
                <Button size="sm" variant="outline" onClick={() => { setDifficulty(null); setMessages([]) }}>Change Difficulty</Button>
                <Button size="sm" variant="ghost" onClick={() => router.push('/pressure-lab')}>
                  Back to Pressure Lab
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
