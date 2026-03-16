'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

type CompanyDNA = {
  cultureFingerprint: string[]
  communicationStyle: string
  decisionStyle: string
  riskTolerance: string
  interviewTempo: string
  panelDynamics: string[]
  valuesLanguageToMirror: string[]
  redFlagTriggers: string[]
  proofPointsToEmphasize: string[]
  candidateQuestionsToAsk: string[]
}

export default function CompanyDNAPage() {
  const params = useParams()
  const applicationId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiredPlan, setRequiredPlan] = useState<string | null>(null)
  const [application, setApplication] = useState<{ companyName: string; jobTitle: string } | null>(null)
  const [companyDna, setCompanyDna] = useState<CompanyDNA | null>(null)

  useEffect(() => {
    async function loadDNA() {
      try {
        const res = await fetch(`/api/applications/${applicationId}/company-dna`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Unable to load Company DNA.')
          setRequiredPlan(typeof data.requiredPlan === 'string' ? data.requiredPlan : null)
          return
        }
        setApplication(data.application)
        setCompanyDna(data.companyDna)
      } catch {
        setError('Unable to load Company DNA.')
      } finally {
        setLoading(false)
      }
    }
    if (applicationId) void loadDNA()
  }, [applicationId])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-700 border-t-transparent" />
      </div>
    )
  }

  if (error || !companyDna) {
    return (
      <div className="space-y-6">
        <Link href={`/applications/${applicationId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Application
        </Link>
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
            <p className="text-sm text-gray-700">{error || 'Company DNA is unavailable.'}</p>
            {requiredPlan && (
              <p className="text-xs text-gray-500">
                Upgrade to <span className="font-medium">{requiredPlan}</span> to unlock this module.
              </p>
            )}
            <Link href="/pricing">
              <Button size="sm">View plans</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href={`/applications/${applicationId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Application
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700/10">
          <Building2 className="h-5 w-5 text-brand-700" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Company DNA</h2>
          <p className="text-sm text-gray-500">
            {application?.companyName} — {application?.jobTitle}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-base font-semibold text-gray-900">Culture Fingerprint</h3></CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            {companyDna.cultureFingerprint.map((item, idx) => <p key={idx}>• {item}</p>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-base font-semibold text-gray-900">Panel Dynamics</h3></CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            {companyDna.panelDynamics.map((item, idx) => <p key={idx}>• {item}</p>)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-900">Communication Style</h3></CardHeader>
          <CardContent className="text-sm text-gray-700">{companyDna.communicationStyle}</CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-900">Decision Style</h3></CardHeader>
          <CardContent className="text-sm text-gray-700">{companyDna.decisionStyle}</CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-900">Interview Tempo</h3></CardHeader>
          <CardContent className="text-sm text-gray-700">{companyDna.interviewTempo}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h3 className="text-base font-semibold text-gray-900">Values Language To Mirror</h3></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {companyDna.valuesLanguageToMirror.map((value, idx) => (
            <Badge key={idx} variant="info">{value}</Badge>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-base font-semibold text-gray-900">Red Flag Triggers</h3></CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            {companyDna.redFlagTriggers.map((item, idx) => <p key={idx}>• {item}</p>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-base font-semibold text-gray-900">Proof Points To Emphasize</h3></CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            {companyDna.proofPointsToEmphasize.map((item, idx) => <p key={idx}>• {item}</p>)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h3 className="text-base font-semibold text-gray-900">Candidate Questions To Ask</h3></CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          {companyDna.candidateQuestionsToAsk.map((q, idx) => (
            <p key={idx}>{idx + 1}. {q}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
