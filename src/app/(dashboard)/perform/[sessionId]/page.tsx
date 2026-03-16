'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Mic, MicOff, Clock, PencilLine, ChevronLeft, ChevronRight, PhoneOff } from 'lucide-react'
import { useInterviewExchangeTransport } from '@/lib/interview/useInterviewExchangeTransport'

interface Character {
  id: string
  name: string
  title: string
  archetype: string
  silenceDuration: number
  voiceId?: string
  initials?: string
  avatarColor?: string
}

interface QuestionPlanItem {
  question_text: string
  question_type: string
  owner_character_id: string
  owner_archetype: string
}

interface Exchange {
  id: string
  sequenceNumber: number
  speaker: 'candidate' | 'interviewer' | 'system'
  characterId: string | null
  messageText: string
  timestampMs: number
}

interface SessionData {
  id: string
  stage: string
  intensity: string
  durationMinutes: number
  status: string
  characters: Character[]
  exchanges: Exchange[]
  questionPlan?: QuestionPlanItem[]
  application: {
    companyName: string
    jobTitle: string
  }
}

type Phase = 'loading' | 'briefing' | 'countdown' | 'interview' | 'complete'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function timestampLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function playJoinSound() {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = 880
  gain.gain.value = 0.02
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.08)
  setTimeout(() => void ctx.close(), 120)
}

const VOICE_INSTRUCTIONS: Record<string, string> = {
  skeptic: 'Direct, measured, no affirmations, asks for specifics.',
  friendly_champion: 'Warm and concise, inviting but evaluative.',
  technical_griller: 'Blunt technical depth, no pleasantries.',
  distracted_senior: 'Brief, slightly hurried, strategic framing.',
  culture_fit: 'Conversational, values and collaboration focused.',
  silent_observer: 'Very brief and reserved.',
}

function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const [amplitude, setAmplitude] = useState(0)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentAudioUrlRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  const stopAnalyser = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setAmplitude(0)
  }

  useEffect(() => {
    synthRef.current = window.speechSynthesis
    return () => {
      currentAudioRef.current?.pause()
      if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current)
      synthRef.current?.cancel()
      stopAnalyser()
    }
  }, [])

  const analyseAudio = (audio: HTMLAudioElement) => {
    try {
      const stream = (audio as any).captureStream?.()
      if (!stream) return
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const loop = () => {
        analyser.getByteFrequencyData(data)
        let total = 0
        for (let i = 0; i < data.length; i++) total += data[i]
        const avg = total / data.length
        setAmplitude(Math.min(1, avg / 96))
        rafRef.current = requestAnimationFrame(loop)
      }
      loop()
      audio.onended = () => {
        stopAnalyser()
        void ctx.close()
      }
      audio.onerror = () => {
        stopAnalyser()
        void ctx.close()
      }
    } catch {
      setAmplitude(0.4)
    }
  }

  const speak = useCallback((text: string, voiceId?: string, archetype?: string) => {
    return new Promise<void>(async (resolve) => {
      if (currentAudioRef.current) currentAudioRef.current.pause()
      if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current)
      synthRef.current?.cancel()
      stopAnalyser()
      setSpeaking(true)

      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice: voiceId || 'nova',
            instructions: VOICE_INSTRUCTIONS[archetype || 'friendly_champion'] || VOICE_INSTRUCTIONS.friendly_champion,
          }),
        })
        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          currentAudioRef.current = audio
          currentAudioUrlRef.current = url
          analyseAudio(audio)
          audio.onended = () => {
            stopAnalyser()
            setSpeaking(false)
            resolve()
          }
          audio.onerror = () => {
            stopAnalyser()
            setSpeaking(false)
            resolve()
          }
          await audio.play()
          return
        }
      } catch {
        // fall through to browser speech
      }

      if (!synthRef.current) {
        setSpeaking(false)
        resolve()
        return
      }
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = archetype === 'technical_griller' ? 0.92 : archetype === 'friendly_champion' ? 1.02 : 0.96
      utterance.pitch = archetype === 'skeptic' ? 0.9 : 1
      setAmplitude(0.45)
      utterance.onend = () => {
        setAmplitude(0)
        setSpeaking(false)
        resolve()
      }
      utterance.onerror = () => {
        setAmplitude(0)
        setSpeaking(false)
        resolve()
      }
      synthRef.current.speak(utterance)
    })
  }, [])

  const stop = useCallback(() => {
    currentAudioRef.current?.pause()
    if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current)
    synthRef.current?.cancel()
    stopAnalyser()
    setSpeaking(false)
  }, [])

  return { speak, stop, speaking, amplitude }
}

function AudioBars({ active, amplitude }: { active: boolean; amplitude: number }) {
  if (!active) return null
  const level = Math.max(0.15, amplitude)
  const bars = [0.55, 0.85, 0.65, 0.9]
  return (
    <div className="mt-3 flex items-end justify-center gap-1">
      {bars.map((b, idx) => (
        <span
          key={idx}
          className="w-1 rounded-sm bg-white/90"
          style={{ height: `${Math.max(8, Math.round(26 * level * b))}px` }}
        />
      ))}
    </div>
  )
}

export default function InterviewRoomPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [phase, setPhase] = useState<Phase>('loading')
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(120)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showTranscript, setShowTranscript] = useState(true)
  const [exchanges, setExchanges] = useState<Array<Exchange & { localTs: string }>>([])
  const [speakingCharacterId, setSpeakingCharacterId] = useState<string | null>(null)
  const [joinedCharacterIds, setJoinedCharacterIds] = useState<Set<string>>(new Set())
  const [isMicOn, setIsMicOn] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [audioConfirmed, setAudioConfirmed] = useState(false)
  const [cameraConfirmed, setCameraConfirmed] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const selfViewRef = useRef<HTMLVideoElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const { speak, stop: stopSpeech, amplitude } = useSpeech()
  const httpExchange = useCallback(async (payload: { messageText: string; characterId: string }) => {
    const res = await fetch(`/api/sessions/${sessionId}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageText: payload.messageText, characterId: payload.characterId || null }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Failed to send turn.')
    }
    return res.json()
  }, [sessionId])
  const { sendExchange } = useInterviewExchangeTransport(sessionId, httpExchange)

  const addTranscript = useCallback((exchange: Exchange) => {
    setExchanges((prev) => [...prev, { ...exchange, localTs: timestampLabel() }])
  }, [])

  const runMediaCheck = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (selfViewRef.current) selfViewRef.current.srcObject = stream
      setCameraReady(true)
      setCameraConfirmed(true)
      playJoinSound()
      setAudioConfirmed(false)
      setTimeout(() => playJoinSound(), 400)
    } catch {
      setError('Camera and microphone access is required for the live interview room.')
    }
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
  }, [])

  const startListening = useCallback(() => {
    const w = window as any
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognitionCtor || !isMicOn) return
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    let finalTranscript = ''
    recognition.onresult = (event: any) => {
      let chunk = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        chunk += event.results[i][0].transcript
      }
      finalTranscript = chunk.trim()
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = setTimeout(() => {
        recognition.stop()
      }, 1500)
    }
    recognition.onend = () => {
      setIsListening(false)
      if (finalTranscript && phase === 'interview') {
        void handleCandidateTurn(finalTranscript)
      }
    }
    recognition.onerror = () => setIsListening(false)
    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMicOn, phase])

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`)
        if (!res.ok) {
          const body = await res.json()
          setError(body.error || 'Failed to load interview session.')
          return
        }
        const data: SessionData = await res.json()
        setSessionData(data)
        setExchanges((data.exchanges || []).map((e) => ({ ...e, localTs: timestampLabel() })))
        setPhase(data.status === 'active' ? 'interview' : data.status === 'completed' ? 'complete' : 'briefing')
      } catch {
        setError('Failed to load interview session.')
      }
    }
    if (sessionId) void fetchSession()
  }, [sessionId])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      void startInterview()
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown])

  useEffect(() => {
    if (phase !== 'interview') return
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [exchanges])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      stopListening()
      stopSpeech()
    }
  }, [stopListening, stopSpeech])

  const startInterview = async () => {
    if (!sessionData) return
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })

    setPhase('interview')
    const characters = sessionData.characters || []
    const distracted = characters.find((c) => c.archetype === 'distracted_senior')
    const nonLate = characters.filter((c) => c.id !== distracted?.id)

    let delay = 800
    nonLate.forEach((char) => {
      setTimeout(() => {
        playJoinSound()
        setJoinedCharacterIds((prev) => new Set(prev).add(char.id))
        addTranscript({
          id: `join_${char.id}_${Date.now()}`,
          sequenceNumber: exchanges.length + 1,
          speaker: 'system',
          characterId: char.id,
          messageText: `${char.name} joined the meeting.`,
          timestampMs: elapsedSeconds * 1000,
        })
      }, delay)
      delay += 1500 + Math.floor(Math.random() * 2500)
    })

    if (distracted) {
      const lateDelay = 120000 + Math.floor(Math.random() * 60000)
      setTimeout(() => {
        playJoinSound()
        setJoinedCharacterIds((prev) => new Set(prev).add(distracted.id))
        addTranscript({
          id: `join_${distracted.id}_${Date.now()}`,
          sequenceNumber: exchanges.length + 1,
          speaker: 'system',
          characterId: distracted.id,
          messageText: `${distracted.name} joined the meeting.`,
          timestampMs: elapsedSeconds * 1000,
        })
      }, lateDelay)
    }

    setTimeout(async () => {
      const firstQuestion = sessionData.questionPlan?.[0]
      const opener =
        (firstQuestion && characters.find((c) => c.id === firstQuestion.owner_character_id))
        || characters.find((c) => c.archetype !== 'silent_observer' && c.archetype !== 'distracted_senior')
        || characters[0]
      if (!opener) return
      const line = firstQuestion?.question_text || `Welcome. Let's start with: tell me about yourself and why you're interested in ${sessionData.application.jobTitle}.`
      setSpeakingCharacterId(opener.id)
      await speak(line, opener.voiceId, opener.archetype)
      setSpeakingCharacterId(null)
      addTranscript({
        id: `opening_${Date.now()}`,
        sequenceNumber: exchanges.length + 1,
        speaker: 'interviewer',
        characterId: opener.id,
        messageText: line,
        timestampMs: elapsedSeconds * 1000,
      })
      startListening()
    }, delay + 1500)
  }

  const handleCandidateTurn = async (text: string) => {
    if (!sessionData || isSending || !text.trim()) return
    setIsSending(true)
    const candidateExchange: Exchange = {
      id: `candidate_${Date.now()}`,
      sequenceNumber: exchanges.length + 1,
      speaker: 'candidate',
      characterId: null,
      messageText: text.trim(),
      timestampMs: elapsedSeconds * 1000,
    }
    addTranscript(candidateExchange)

    try {
      const data = await sendExchange({
        messageText: text.trim(),
        characterId: speakingCharacterId || '',
      })
      const interviewerCharId = data.character?.id || data.interviewerExchange?.characterId
      setSpeakingCharacterId(interviewerCharId || null)
      await speak(
        data.interviewerExchange.messageText,
        data.character?.voiceId,
        data.character?.archetype
      )
      setSpeakingCharacterId(null)
      addTranscript(data.interviewerExchange)
      if (data.sessionEnd) {
        await endInterview()
        return
      }
      if (isMicOn) startListening()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Interview turn failed.')
      if (isMicOn) startListening()
    } finally {
      setIsSending(false)
    }
  }

  const endInterview = async () => {
    stopListening()
    stopSpeech()
    if (timerRef.current) clearInterval(timerRef.current)
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    setPhase('complete')
    setTimeout(() => router.push(`/debrief/${sessionId}`), 800)
  }

  const toggleMic = () => {
    if (isMicOn) {
      stopListening()
      streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false })
      setIsMicOn(false)
      return
    }
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = true })
    setIsMicOn(true)
    if (phase === 'interview') startListening()
  }

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      </div>
    )
  }

  if (error && !sessionData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19] px-4">
        <div className="max-w-md rounded-xl border border-white/10 bg-[#121826] p-6 text-center text-white">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  if (!sessionData) return null
  const { characters, application } = sessionData

  if (phase === 'briefing') {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0b0f19] p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-xl border border-white/10 bg-[#121826] p-6">
            <p className="text-xs uppercase tracking-wide text-slate-400">Interview briefing</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{application.companyName}</h1>
            <p className="text-slate-300">{application.jobTitle}</p>
            <p className="mt-4 text-sm text-slate-400">
              Based on {application.companyName}&apos;s interview style, expect a mixed live-audio interview flow.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#121826] p-6">
            <h2 className="text-sm font-semibold text-slate-200">Today&apos;s interviewer panel</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {characters.map((char) => (
                <div key={char.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#0f1524] p-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: char.avatarColor || '#334155' }}
                  >
                    {char.initials || char.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{char.name}</p>
                    <p className="text-xs text-slate-400">{char.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#121826] p-6">
            <h2 className="text-sm font-semibold text-slate-200">Camera and mic check</h2>
            <p className="mt-2 text-xs text-slate-400">Your camera feed stays local. Audio is used for live interview turns.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="aspect-video overflow-hidden rounded-lg border border-white/10 bg-black">
                <video ref={selfViewRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              </div>
              <div className="space-y-3 text-sm">
                <Button onClick={runMediaCheck} className="w-full">Run camera + mic check</Button>
                <label className="flex items-center gap-2 text-slate-200">
                  <input type="checkbox" checked={cameraConfirmed} onChange={(e) => setCameraConfirmed(e.target.checked)} />
                  Camera feed looks correct
                </label>
                <label className="flex items-center gap-2 text-slate-200">
                  <input type="checkbox" checked={audioConfirmed} onChange={(e) => setAudioConfirmed(e.target.checked)} />
                  I can hear the test audio
                </label>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Button
              size="lg"
              disabled={!cameraReady || !cameraConfirmed || !audioConfirmed}
              onClick={() => {
                setCountdown(120)
                setPhase('countdown')
              }}
            >
              Enter interview room
            </Button>
            {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'countdown') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19]">
        <div className="rounded-xl border border-white/10 bg-[#121826] p-8 text-center">
          <p className="text-sm text-slate-300">Your interview with {application.companyName} starts in 2 minutes.</p>
          <p className="mt-3 text-6xl font-semibold text-white">{countdown}</p>
        </div>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19] text-white">
        <p className="text-sm text-slate-300">Session ended. Opening your debrief...</p>
      </div>
    )
  }

  const speakingId = speakingCharacterId
  const gridCols = characters.length <= 1 ? 'grid-cols-1' : characters.length === 2 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0f19] text-white">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="text-xs text-slate-300">{application.companyName}</div>
        <div className="flex items-center gap-1 text-xs text-slate-300">
          <Clock className="h-3.5 w-3.5" />
          {formatTime(elapsedSeconds)}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-h-0 flex-1">
          <div className={`grid ${gridCols} w-full gap-3 p-3`}>
            {characters.map((char) => {
              const joined = joinedCharacterIds.has(char.id)
              const active = speakingId === char.id
              return (
                <div
                  key={char.id}
                  className={`relative flex min-h-[180px] flex-col items-center justify-center rounded-xl border bg-[#151b2c] p-4 ${
                    active ? 'border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]' : 'border-white/10'
                  }`}
                >
                  {!joined ? (
                    <p className="text-xs text-slate-500">Connecting...</p>
                  ) : (
                    <>
                      <div
                        className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold text-white"
                        style={{ backgroundColor: char.avatarColor || '#334155' }}
                      >
                        {char.initials || char.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <p className="mt-3 text-sm font-medium text-white">{char.name}</p>
                      <p className="text-center text-xs text-slate-400">{char.title}</p>
                      {char.archetype === 'silent_observer' && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                          <PencilLine className="h-3.5 w-3.5" />
                          taking notes
                        </div>
                      )}
                      <AudioBars active={active} amplitude={amplitude} />
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <div className="pointer-events-none absolute bottom-20 right-4 h-36 w-56 overflow-hidden rounded-xl border border-white/20 bg-black">
            <video ref={selfViewRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            <div className="absolute bottom-1 left-2 text-[11px] text-white">You</div>
          </div>
        </div>

        <aside className={`${showTranscript ? 'w-[28%] min-w-[300px]' : 'w-10'} border-l border-white/10 bg-[#111827] transition-all`}>
          <button
            onClick={() => setShowTranscript((s) => !s)}
            className="flex h-10 w-full items-center justify-center border-b border-white/10 text-slate-300 hover:bg-white/5"
            title={showTranscript ? 'Collapse transcript' : 'Expand transcript'}
          >
            {showTranscript ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          {showTranscript && (
            <div className="h-[calc(100%-40px)] overflow-y-auto p-3">
              {exchanges.map((ex) => {
                const char = characters.find((c) => c.id === ex.characterId)
                const author = ex.speaker === 'candidate' ? 'You' : ex.speaker === 'system' ? 'System' : (char?.name || 'Interviewer')
                return (
                  <div key={ex.id} className="mb-3 rounded-md border border-white/5 bg-[#0f172a] p-2">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-200">{author}</span>
                      <span className="text-slate-500">{ex.localTs}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">{ex.messageText}</p>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>
          )}
        </aside>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-[#0f172a] py-3">
        <button
          onClick={toggleMic}
          className={`flex h-12 w-12 items-center justify-center rounded-full ${isMicOn ? 'bg-slate-700 text-white' : 'bg-red-600 text-white'}`}
          title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
          disabled={isSending}
        >
          {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button
          onClick={() => {
            void endInterview()
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
          title="End call"
          disabled={isSending}
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
