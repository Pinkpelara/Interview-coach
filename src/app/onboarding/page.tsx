'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Slider } from '@/components/ui/Slider'
import { Textarea } from '@/components/ui/Textarea'

const INDUSTRY_OPTIONS = [
  { value: 'technology', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'legal', label: 'Legal' },
  { value: 'government', label: 'Government' },
  { value: 'retail', label: 'Retail' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'media', label: 'Media' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'energy', label: 'Energy' },
  { value: 'other', label: 'Other' },
]

const EXPERIENCE_OPTIONS = [
  { value: '0-1', label: '0-1 years' },
  { value: '1-3', label: '1-3 years' },
  { value: '3-5', label: '3-5 years' },
  { value: '5-10', label: '5-10 years' },
  { value: '10+', label: '10+ years' },
]

const STEPS = [
  { number: 1, label: 'Professional Background' },
  { number: 2, label: 'Interview Context' },
  { number: 3, label: 'Optional Context' },
]

export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step 1
  const [fullName, setFullName] = useState(session?.user?.name ?? '')
  const [currentRole, setCurrentRole] = useState('')
  const [yearsExperience, setYearsExperience] = useState('')
  const [currentIndustry, setCurrentIndustry] = useState('')
  const [targetIndustry, setTargetIndustry] = useState('')

  // Step 2
  const [workArrangement, setWorkArrangement] = useState('')
  const [anxietyLevel, setAnxietyLevel] = useState(5)
  const [interviewDifficulty, setInterviewDifficulty] = useState('')

  // Step 3
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')

  // Pre-fill name when session loads
  useState(() => {
    if (session?.user?.name && !fullName) {
      setFullName(session.user.name)
    }
  })

  function validateStep1(): boolean {
    const newErrors: Record<string, string> = {}
    if (!fullName.trim()) newErrors.fullName = 'Full name is required'
    if (!currentRole.trim()) newErrors.currentRole = 'Job title is required'
    if (!yearsExperience) newErrors.yearsExperience = 'Years of experience is required'
    if (!currentIndustry) newErrors.currentIndustry = 'Current industry is required'
    if (!targetIndustry) newErrors.targetIndustry = 'Target industry is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function validateStep2(): boolean {
    const newErrors: Record<string, string> = {}
    if (!workArrangement) newErrors.workArrangement = 'Please select a work arrangement'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep((s) => s + 1)
  }

  function handleBack() {
    setErrors({})
    setStep((s) => s - 1)
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          currentRole,
          yearsExperience,
          currentIndustry,
          targetIndustry,
          workArrangement,
          anxietyLevel,
          interviewDifficulty,
          linkedinUrl: linkedinUrl || null,
          portfolioUrl: portfolioUrl || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      router.push('/dashboard')
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Something went wrong' })
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h1 className="text-xl font-bold text-brand-700">Seatvio</h1>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {STEPS.map((s) => (
                <div key={s.number} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                      step >= s.number
                        ? 'bg-brand-700 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {s.number}
                  </div>
                  <span
                    className={`hidden sm:inline text-sm font-medium ${
                      step >= s.number ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-brand-700 transition-all duration-300"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Card */}
          <div className="rounded-xl border bg-white p-6 sm:p-8 shadow-sm">
            {/* Step 1: Professional Background */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Professional Background</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Tell us about your career so we can tailor your interview coaching.
                  </p>
                </div>

                <Input
                  id="fullName"
                  label="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  error={errors.fullName}
                  placeholder="Jane Doe"
                />

                <Input
                  id="currentRole"
                  label="Current or most recent job title"
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  error={errors.currentRole}
                  placeholder="e.g. Senior Product Manager"
                />

                <Select
                  id="yearsExperience"
                  label="Years of experience"
                  options={EXPERIENCE_OPTIONS}
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  error={errors.yearsExperience}
                />

                <Select
                  id="currentIndustry"
                  label="Current industry"
                  options={INDUSTRY_OPTIONS}
                  value={currentIndustry}
                  onChange={(e) => setCurrentIndustry(e.target.value)}
                  error={errors.currentIndustry}
                />

                <Select
                  id="targetIndustry"
                  label="Target industry"
                  options={INDUSTRY_OPTIONS}
                  value={targetIndustry}
                  onChange={(e) => setTargetIndustry(e.target.value)}
                  error={errors.targetIndustry}
                />
              </div>
            )}

            {/* Step 2: Interview Context */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Interview Context</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Help us understand your preferences and how you feel about interviews.
                  </p>
                </div>

                {/* Work Arrangement */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Target work arrangement
                  </label>
                  <div className="flex gap-3">
                    {(['Remote', 'Hybrid', 'On-site'] as const).map((option) => (
                      <label
                        key={option}
                        className={`flex-1 cursor-pointer rounded-lg border-2 px-4 py-3 text-center text-sm font-medium transition-colors ${
                          workArrangement === option
                            ? 'border-brand-700 bg-brand-50 text-brand-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="workArrangement"
                          value={option}
                          checked={workArrangement === option}
                          onChange={(e) => setWorkArrangement(e.target.value)}
                          className="sr-only"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  {errors.workArrangement && (
                    <p className="text-sm text-red-600">{errors.workArrangement}</p>
                  )}
                </div>

                {/* Anxiety Slider */}
                <Slider
                  value={anxietyLevel}
                  onChange={setAnxietyLevel}
                  min={1}
                  max={10}
                  label="Interview anxiety level"
                  leftLabel="Completely calm"
                  rightLabel="Extremely anxious"
                />

                {/* Interview Difficulty */}
                <Textarea
                  id="interviewDifficulty"
                  label="Describe what makes interviews hard for you (optional)"
                  value={interviewDifficulty}
                  onChange={(e) => setInterviewDifficulty(e.target.value)}
                  placeholder="e.g. I freeze up during behavioral questions, or I struggle to talk about my achievements..."
                />
              </div>
            )}

            {/* Step 3: Optional Context */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Optional Context</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Add your online profiles so we can provide more personalized coaching. You can
                    skip this step and add them later.
                  </p>
                </div>

                <Input
                  id="linkedinUrl"
                  label="LinkedIn profile URL"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/your-profile"
                />

                <Input
                  id="portfolioUrl"
                  label="Portfolio URL"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://your-portfolio.com"
                />
              </div>
            )}

            {/* Error message */}
            {errors.submit && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {errors.submit}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex items-center justify-between">
              <div>
                {step > 1 && (
                  <Button variant="ghost" onClick={handleBack}>
                    Back
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {step === 3 && (
                  <Button variant="ghost" onClick={handleSubmit} disabled={submitting}>
                    Skip
                  </Button>
                )}
                {step < 3 ? (
                  <Button onClick={handleNext}>Continue</Button>
                ) : (
                  <Button onClick={handleSubmit} loading={submitting}>
                    Complete Setup
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Step indicator text */}
          <p className="mt-4 text-center text-sm text-gray-400">
            Step {step} of 3
          </p>
        </div>
      </div>
    </div>
  )
}
