'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Eye,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react'

interface Exchange {
  id: string
  speaker: 'interviewer' | 'candidate'
  text: string
  annotation?: {
    type: 'perfect' | 'cautionary'
    note: string
    pattern?: string
  }
}

interface ObserveData {
  id: string
  sourceSessionId: string
  type: 'perfect' | 'cautionary'
  exchanges: Exchange[]
  annotations: Array<{
    exchangeId: string
    type: string
    note: string
    pattern?: string
  }>
}

export default function ObservePage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const { data: authSession } = useSession()

  const [activeTab, setActiveTab] = useState<'perfect' | 'cautionary'>('perfect')
  const [splitView, setSplitView] = useState(false)
  const [perfectData, setPerfectData] = useState<ObserveData | null>(null)
  const [cautionaryData, setCautionaryData] = useState<ObserveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchObserveData() {
      try {
        // First check if observe sessions already exist
        const existingRes = await fetch(`/api/observe?sourceSessionId=${sessionId}`)
        if (existingRes.ok) {
          const existing = await existingRes.json()
          const existingPerfect = existing.find((s: ObserveData) => s.type === 'perfect')
          const existingCautionary = existing.find((s: ObserveData) => s.type === 'cautionary')

          if (existingPerfect && existingCautionary) {
            setPerfectData(existingPerfect)
            setCautionaryData(existingCautionary)
            setLoading(false)
            return
          }
        }

        // Generate missing sessions via POST
        const [perfectRes, cautionaryRes] = await Promise.all([
          fetch('/api/observe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceSessionId: sessionId, type: 'perfect' }),
          }),
          fetch('/api/observe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceSessionId: sessionId, type: 'cautionary' }),
          }),
        ])

        if (!perfectRes.ok || !cautionaryRes.ok) {
          const errData = !perfectRes.ok
            ? await perfectRes.json()
            : await cautionaryRes.json()
          throw new Error(errData.error || 'Failed to load observe data')
        }

        const [perfect, cautionary] = await Promise.all([
          perfectRes.json(),
          cautionaryRes.json(),
        ])

        setPerfectData(perfect)
        setCautionaryData(cautionary)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      fetchObserveData()
    }
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5b5fc7] mx-auto" />
          <p className="text-gray-500">Generating observe sessions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent>
            <div className="text-center space-y-3 py-4">
              <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
              <p className="text-gray-200 font-medium">Unable to load observe module</p>
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  function renderExchangeList(data: ObserveData | null) {
    if (!data) return null

    return (
      <div className="space-y-4">
        {data.exchanges.map((exchange) => (
          <div key={exchange.id}>
            {/* Exchange Card */}
            <Card
              className={
                exchange.speaker === 'interviewer'
                  ? 'border-l-4 border-l-gray-400'
                  : 'border-l-4 border-l-[#5b5fc7]'
              }
            >
              <CardContent>
                <div className="flex items-start gap-3">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      exchange.speaker === 'interviewer'
                        ? 'bg-[#333] text-gray-400'
                        : 'bg-[#5b5fc7]/20 text-[#5b5fc7]'
                    }`}
                  >
                    {exchange.speaker === 'interviewer' ? 'IV' : 'CD'}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      {exchange.speaker === 'interviewer'
                        ? 'Interviewer'
                        : 'Candidate'}
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {exchange.text}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Annotation Panel */}
            {exchange.annotation && (
              <div
                className={`ml-8 mt-1 rounded-lg p-3 border ${
                  exchange.annotation.type === 'perfect'
                    ? 'bg-green-900/20 border-green-500/30'
                    : 'bg-red-900/20 border-red-500/30'
                }`}
              >
                <div className="flex items-start gap-2">
                  {exchange.annotation.type === 'perfect' ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    {exchange.annotation.pattern && (
                      <Badge variant="danger" className="mb-1.5">
                        {exchange.annotation.pattern}
                      </Badge>
                    )}
                    <p
                      className={`text-sm ${
                        exchange.annotation.type === 'perfect'
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {exchange.annotation.note}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Eye className="h-6 w-6 text-[#5b5fc7]" />
          Observe Module
        </h2>
        <p className="mt-1 text-gray-500">
          Study AI-generated interview runs to learn what works and what does not.
        </p>
      </div>

      {/* Tab Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'perfect' && !splitView ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setActiveTab('perfect')
              setSplitView(false)
            }}
          >
            <CheckCircle className="h-4 w-4 mr-1.5" />
            Perfect Run
          </Button>
          <Button
            variant={activeTab === 'cautionary' && !splitView ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setActiveTab('cautionary')
              setSplitView(false)
            }}
          >
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            Cautionary Run
          </Button>
        </div>
        <Button
          variant={splitView ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setSplitView(!splitView)}
        >
          <Users className="h-4 w-4 mr-1.5" />
          Split View
        </Button>
      </div>

      {/* Content */}
      {splitView ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Perfect Run Column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                Perfect Run
              </h3>
            </div>
            {renderExchangeList(perfectData)}
          </div>

          {/* Cautionary Run Column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                Cautionary Run
              </h3>
            </div>
            {renderExchangeList(cautionaryData)}
          </div>
        </div>
      ) : (
        <div>
          {activeTab === 'perfect' ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  Perfect Run
                </h3>
                <Badge variant="success">Model Answers</Badge>
              </div>
              {renderExchangeList(perfectData)}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  Cautionary Run
                </h3>
                <Badge variant="danger">Common Mistakes</Badge>
              </div>
              {renderExchangeList(cautionaryData)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
