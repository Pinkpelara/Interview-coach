'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Mic, MicOff, CheckCircle2 } from 'lucide-react'

const STAGES = [
  { value: 'Phone Screen', label: 'Phone Screen' },
  { value: 'First Round', label: 'First Round' },
  { value: 'Panel Interview', label: 'Panel' },
  { value: 'Final Round', label: 'Final Round' },
  { value: 'Case Interview', label: 'Case' },
  { value: 'Stress Interview', label: 'Stress' },
]

const INTENSITIES = [
  { value: 'warmup', label: 'Warm-Up', desc: 'Shorter silences, gentler follow-ups' },
  { value: 'standard', label: 'Standard', desc: 'Archetype defaults' },
  { value: 'high-pressure', label: 'High Pressure', desc: 'Longer silences, aggressive follow-ups' },
]

const DURATIONS = [
  { value: 20, label: '20 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
]

export default function InterviewSetupPage() {
  const params = useParams()
  const router = useRouter()
  const applicationId = params.id as string

  const [appData, setAppData] = useState<{ companyName: string; jobTitle: string } | null>(null)
  const [stage, setStage] = useState('first_round')
  const [intensity, setIntensity] = useState('standard')
  const [duration, setDuration] = useState(45)
  const [micChecked, setMicChecked] = useState(false)
  const [micWorking, setMicWorking] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/applications/${applicationId}`)
      .then(r => r.json())
      .then(data => setAppData({ companyName: data.companyName, jobTitle: data.jobTitle }))
      .catch(() => {})
  }, [applicationId])

  const checkMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicChecked(true)
      setMicWorking(true)
      stream.getTracks().forEach(t => t.stop())
    } catch {
      setMicChecked(true)
      setMicWorking(false)
    }
  }

  const startSession = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, intensity, targetDurationMin: duration }),
      })
      if (!res.ok) throw new Error('Failed to create session')
      const session = await res.json()
      router.push(`/perform/${session.id}`)
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="text-center">
        <p className="text-sm text-gray-400">Preparing for</p>
        <h2 className="text-xl font-bold text-white">
          {appData ? `${appData.jobTitle} at ${appData.companyName}` : 'Loading...'}
        </h2>
      </div>

      {/* Stage */}
      <div className="rounded-2xl bg-[#292929] p-5">
        <h3 className="text-sm font-medium text-white mb-3">Interview Stage</h3>
        <div className="grid grid-cols-3 gap-2">
          {STAGES.map(s => (
            <button
              key={s.value}
              onClick={() => setStage(s.value)}
              className={`rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                stage === s.value
                  ? 'bg-[#5b5fc7] text-white'
                  : 'bg-[#1b1b1b] text-gray-400 hover:bg-[#333]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Intensity */}
      <div className="rounded-2xl bg-[#292929] p-5">
        <h3 className="text-sm font-medium text-white mb-3">Intensity</h3>
        <div className="space-y-2">
          {INTENSITIES.map(i => (
            <button
              key={i.value}
              onClick={() => setIntensity(i.value)}
              className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${
                intensity === i.value
                  ? 'bg-[#5b5fc7] text-white'
                  : 'bg-[#1b1b1b] text-gray-400 hover:bg-[#333]'
              }`}
            >
              <p className="text-sm font-medium">{i.label}</p>
              <p className={`text-xs mt-0.5 ${intensity === i.value ? 'text-white/70' : 'text-gray-500'}`}>
                {i.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="rounded-2xl bg-[#292929] p-5">
        <h3 className="text-sm font-medium text-white mb-3">Duration</h3>
        <div className="flex gap-2">
          {DURATIONS.map(d => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value)}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                duration === d.value
                  ? 'bg-[#5b5fc7] text-white'
                  : 'bg-[#1b1b1b] text-gray-400 hover:bg-[#333]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mic Check */}
      <div className="rounded-2xl bg-[#292929] p-5">
        <h3 className="text-sm font-medium text-white mb-3">Microphone Check</h3>
        {!micChecked ? (
          <button
            onClick={checkMic}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#1b1b1b] px-4 py-3 text-sm text-gray-400 hover:bg-[#333] transition-colors"
          >
            <Mic className="h-4 w-4" />
            Test Microphone
          </button>
        ) : micWorking ? (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Microphone working
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <MicOff className="h-4 w-4" />
            Microphone not detected. Please check your settings.
          </div>
        )}
      </div>

      {/* Start */}
      <button
        onClick={startSession}
        disabled={loading || !micChecked || !micWorking}
        className="w-full rounded-lg bg-[#5b5fc7] py-3.5 text-sm font-semibold text-white hover:bg-[#4e52b5] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Creating session...' : 'Start Interview'}
      </button>
    </div>
  )
}
