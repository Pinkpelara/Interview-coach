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

interface NegotiationDebrief {
  whatWorked: string
  toImprove: string
  nextTime: string
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
  const [debrief, setDebrief] = useState<NegotiationDebrief | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
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

  const startSession = async (diff: Difficulty) => {
    if (!canStartSimulator) return
    if (!application) return
    setIsSending(true)
    setDifficulty(diff)
    setExchangeCount(0)
    setSessionComplete(false)
    setDebrief(null)
    try {
      const res = await fetch('/api/salary-negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          difficulty: diff,
          round: 0,
          messages: [],
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to start salary simulation')
      }
      const data = await res.json()
      setMessages([{
        id: 'initial',
        speaker: 'hiring_manager',
        text: data.managerResponse || INITIAL_OFFERS[diff].opening,
        annotation: data.annotation,
      }])
    } catch (error) {
      setMessages([{
        id: 'initial',
        speaker: 'hiring_manager',
        text: INITIAL_OFFERS[diff].opening,
      }])
      setContextError(error instanceof Error ? error.message : 'Unable to start salary simulation.')
    } finally {
      setIsSending(false)
    }
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

    try {
      const history = [...messages, { id: `candidate_pending`, speaker: 'candidate', text: userText }]
      const res = await fetch('/api/salary-negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application?.id,
          difficulty,
          round: exchangeCount + 1,
          candidateMessage: userText,
          messages: history.map((m) => ({ speaker: m.speaker, text: m.text })),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to continue salary simulation')
      }
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: `manager_${Date.now()}`,
        speaker: 'hiring_manager',
        text: data.managerResponse,
        annotation: data.annotation,
      }])
      setExchangeCount(prev => prev + 1)
      if (data.shouldClose || exchangeCount >= 4) {
        setSessionComplete(true)
        if (data.debrief) {
          setDebrief(data.debrief)
        }
      }
    } catch (error) {
      setContextError(error instanceof Error ? error.message : 'Negotiation turn failed.')
    } finally {
      setIsSending(false)
    }
  }, [inputText, isSending, difficulty, sessionComplete, exchangeCount, messages, application])

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
                  <p className="text-xs text-green-600">{debrief?.whatWorked || 'You engaged in the negotiation rather than accepting immediately. This signals confidence.'}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> To Improve
                  </p>
                  <p className="text-xs text-amber-600">{debrief?.toImprove || 'Always anchor to market data. Use specific numbers and ranges rather than vague requests.'}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" /> Next Time
                  </p>
                  <p className="text-xs text-blue-600">{debrief?.nextTime || 'Consider total compensation: equity, bonus, PTO, remote flexibility, and professional development budget.'}</p>
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
