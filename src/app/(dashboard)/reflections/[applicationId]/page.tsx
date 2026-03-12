'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { ArrowLeft } from 'lucide-react'

interface Reflection {
  id: string
  interviewDate: string
  outcome: string | null
  selfRating: number | null
  whatWentWell: string | null
  whatToImprove: string | null
  notes: string | null
}

export default function ReflectionPage() {
  const params = useParams()
  const applicationId = params.applicationId as string

  const [interviewDate, setInterviewDate] = useState(new Date().toISOString().split('T')[0])
  const [outcome, setOutcome] = useState('pending')
  const [selfRating, setSelfRating] = useState(7)
  const [actualQuestions, setActualQuestions] = useState('')
  const [whatWentWell, setWhatWentWell] = useState('')
  const [whatToImprove, setWhatToImprove] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState<Reflection[]>([])

  async function loadHistory() {
    const res = await fetch(`/api/reflections?applicationId=${applicationId}`)
    if (res.ok) {
      const data = await res.json()
      setHistory(data)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [applicationId])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const questions = actualQuestions
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean)
    const res = await fetch('/api/reflections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        interviewDate,
        outcome,
        selfRating,
        actualQuestions: questions,
        whatWentWell,
        whatToImprove,
        notes,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setActualQuestions('')
      setWhatWentWell('')
      setWhatToImprove('')
      setNotes('')
      await loadHistory()
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href={`/countdown/${applicationId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Countdown
      </Link>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold text-gray-900">Post-Interview Reflection</h2>
          <p className="text-sm text-gray-500">
            Log what was actually asked and how it went. This closes the prediction loop for your next sessions.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input id="interviewDate" label="Interview date" type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="advanced">Advanced</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Self rating (1-10)</label>
            <input
              type="range"
              min={1}
              max={10}
              value={selfRating}
              onChange={(e) => setSelfRating(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Current: {selfRating}/10</p>
          </div>
          <Textarea
            id="actualQuestions"
            label="What questions were asked?"
            value={actualQuestions}
            onChange={(e) => setActualQuestions(e.target.value)}
            placeholder="One question per line..."
          />
          <Textarea id="whatWentWell" label="What went well?" value={whatWentWell} onChange={(e) => setWhatWentWell(e.target.value)} />
          <Textarea id="whatToImprove" label="What to improve next?" value={whatToImprove} onChange={(e) => setWhatToImprove(e.target.value)} />
          <Textarea id="notes" label="Additional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} loading={saving}>Save Reflection</Button>
            {saved && <span className="text-sm text-green-600">Saved</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Reflection History</h3>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No reflections yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(item.interviewDate).toLocaleDateString()} · Outcome: {item.outcome || 'pending'} · Self-rating: {item.selfRating ?? '-'}
                  </p>
                  {item.whatWentWell && <p className="text-xs text-gray-600 mt-1">Went well: {item.whatWentWell}</p>}
                  {item.whatToImprove && <p className="text-xs text-gray-600 mt-1">Improve: {item.whatToImprove}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
