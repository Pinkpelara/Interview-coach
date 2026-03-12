'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp, Star, Clock, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Question {
  id: string
  questionText: string
  questionType: string
  whyAsked: string
  framework: string | null
  modelAnswer: string
  whatNotToSay: string
  timeGuidanceSec: number | null
  likelyFollowup: string | null
  difficulty: number
  sortOrder: number | null
  userAnswers?: Array<{
    id: string
    status: string
    confidenceRating: number | null
    practiceCount: number
  }>
}

const CATEGORIES = ['All', 'Behavioral', 'Technical', 'Situational', 'Company-Specific', 'Curveball', 'Opening', 'Closing']

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= level ? 'bg-[#5b5fc7]' : 'bg-[#333]'}`} />
      ))}
    </div>
  )
}

function AnswerStatusBadge({ answer }: { answer?: Question['userAnswers'] }) {
  const a = answer?.[0]
  if (!a) return <span className="text-xs text-gray-500">Not started</span>
  const color = a.status === 'ready' ? 'text-emerald-400 bg-emerald-900/30' :
    a.status === 'rehearsing' ? 'text-yellow-400 bg-yellow-900/30' :
    'text-gray-400 bg-[#333]'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>
      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
    </span>
  )
}

export default function QuestionBankPage() {
  const params = useParams()
  const applicationId = params.id as string
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/applications/${applicationId}/questions`)
      .then(r => r.json())
      .then(data => { setQuestions(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [applicationId])

  const filtered = activeCategory === 'All'
    ? questions
    : questions.filter(q => q.questionType.toLowerCase().replace(/[_-]/g, ' ').includes(activeCategory.toLowerCase().replace(/[_-]/g, ' ')))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#5b5fc7]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/applications/${applicationId}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h2 className="text-xl font-bold text-white">Question Bank</h2>
          <p className="text-sm text-gray-400">{questions.length} questions</p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-[#5b5fc7] text-white'
                : 'bg-[#292929] text-gray-400 hover:bg-[#333]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Questions */}
      <div className="space-y-2">
        {filtered.map(q => {
          const isExpanded = expandedId === q.id
          return (
            <div key={q.id} className="rounded-2xl bg-[#292929] overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : q.id)}
                className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-[#333] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{q.questionText}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-[#5b5fc7] bg-[#5b5fc7]/10 px-2 py-0.5 rounded-full">
                      {q.questionType}
                    </span>
                    <DifficultyDots level={q.difficulty} />
                    <AnswerStatusBadge answer={q.userAnswers} />
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 mt-1" />}
              </button>

              {isExpanded && (
                <div className="border-t border-[#333] p-4 space-y-4">
                  <div>
                    <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-1">Why This Is Asked</h4>
                    <p className="text-sm text-gray-300">{q.whyAsked}</p>
                  </div>
                  {q.framework && (
                    <div>
                      <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-1">Framework</h4>
                      <span className="text-xs bg-[#5b5fc7]/20 text-[#5b5fc7] px-2 py-0.5 rounded-full">{q.framework}</span>
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-1">Model Answer</h4>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{q.modelAnswer}</p>
                  </div>
                  <div>
                    <h4 className="text-xs text-red-400 uppercase tracking-wider mb-1">What Not to Say</h4>
                    <p className="text-sm text-gray-300">{q.whatNotToSay}</p>
                  </div>
                  {q.timeGuidanceSec && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      Target: {Math.floor(q.timeGuidanceSec / 60)}:{(q.timeGuidanceSec % 60).toString().padStart(2, '0')}
                    </div>
                  )}
                  {q.likelyFollowup && (
                    <div>
                      <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-1">Likely Follow-up</h4>
                      <p className="text-sm text-gray-300">{q.likelyFollowup}</p>
                    </div>
                  )}
                  <Link
                    href={`/prepare/${applicationId}?questionId=${q.id}`}
                    className="inline-block rounded-lg bg-[#5b5fc7] px-4 py-2 text-xs font-medium text-white hover:bg-[#4e52b5] transition-colors"
                  >
                    Build My Answer
                  </Link>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No questions in this category.</p>
          </div>
        )}
      </div>
    </div>
  )
}
