'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const STAGE_MAP: Record<string, string> = {
  screening: 'Phone Screen',
  technical: 'First Round',
  behavioral: 'Panel Interview',
  final: 'Final Round',
  offer: 'Final Round',
  'Phone Screen': 'Phone Screen',
  'First Round': 'First Round',
  'Panel Interview': 'Panel Interview',
  'Final Round': 'Final Round',
  'Case Interview': 'Case Interview',
  'Stress Interview': 'Stress Interview',
}

export default function PerformPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const applicationId = searchParams.get('applicationId')
  const rawStage = searchParams.get('stage')

  useEffect(() => {
    if (!applicationId) {
      setError('Missing application ID')
      return
    }

    const stage = (rawStage && STAGE_MAP[rawStage]) || 'Phone Screen'

    async function createSession() {
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicationId,
            stage,
            intensity: 'standard',
            durationMinutes: 45,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to create interview session')
          return
        }

        const session = await res.json()
        router.replace(`/perform/${session.id}`)
      } catch {
        setError('Something went wrong. Please try again.')
      }
    }

    createSession()
  }, [applicationId, rawStage, router])

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Unable to start interview
          </h2>
          <p className="text-gray-500">{error}</p>
          <button
            onClick={() => router.back()}
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-700 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Setting up your interview...</p>
      </div>
    </div>
  )
}
