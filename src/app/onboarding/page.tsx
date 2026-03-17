'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const INDUSTRY_OPTIONS = [
  { value: 'accounting', label: 'Accounting' },
  { value: 'advertising', label: 'Advertising & PR' },
  { value: 'aerospace', label: 'Aerospace & Defense' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'architecture', label: 'Architecture & Planning' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'banking', label: 'Banking' },
  { value: 'biotech', label: 'Biotechnology' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'construction', label: 'Construction' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'consumer_goods', label: 'Consumer Goods' },
  { value: 'education', label: 'Education' },
  { value: 'energy', label: 'Energy & Utilities' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'environment', label: 'Environmental Services' },
  { value: 'fashion', label: 'Fashion & Apparel' },
  { value: 'finance', label: 'Financial Services' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'government', label: 'Government & Public Sector' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'hospitality', label: 'Hospitality & Tourism' },
  { value: 'human_resources', label: 'Human Resources' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'legal', label: 'Legal' },
  { value: 'logistics', label: 'Logistics & Supply Chain' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'media', label: 'Media & Publishing' },
  { value: 'mining', label: 'Mining & Metals' },
  { value: 'nonprofit', label: 'Nonprofit & NGO' },
  { value: 'pharmaceuticals', label: 'Pharmaceuticals' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'technology', label: 'Technology & Software' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'venture_capital', label: 'Venture Capital & Private Equity' },
  { value: 'other', label: 'Other' },
]

const EXPERIENCE_OPTIONS = [
  { value: '0-1', label: '0\u20131 years' },
  { value: '1-3', label: '1\u20133 years' },
  { value: '3-5', label: '3\u20135 years' },
  { value: '5-10', label: '5\u201310 years' },
  { value: '10+', label: '10+ years' },
]

const STEPS = [
  { number: 1, label: 'Professional Background' },
  { number: 2, label: 'Interview Context' },
  { number: 3, label: 'Optional' },
]

export default function OnboardingPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step 1
  const [fullName, setFullName] = useState('')
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
  useEffect(() => {
    if (session?.user?.name && !fullName) {
      setFullName(session.user.name)
    }
  }, [session, fullName])

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/signin')
    }
  }, [sessionStatus, router])

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
    setErrors({})
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
      router.refresh()
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Something went wrong' })
      setSubmitting(false)
    }
  }

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1b1b1b' }}>
        <svg className="animate-spin h-8 w-8" style={{ color: '#5b5fc7' }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  // Shared input classes
  const inputClasses = 'block w-full rounded-lg border border-gray-600 bg-gray-800/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-[#5b5fc7] focus:outline-none focus:ring-1 focus:ring-[#5b5fc7]'
  const selectClasses = 'block w-full rounded-lg border border-gray-600 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-[#5b5fc7] focus:outline-none focus:ring-1 focus:ring-[#5b5fc7]'
  const labelClasses = 'block text-sm font-medium text-gray-300 mb-1'
  const errorClasses = 'text-sm text-red-400 mt-1'

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1b1b1b' }}>
      {/* Header */}
      <div className="border-b border-gray-700" style={{ backgroundColor: '#292929' }}>
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h1 className="text-xl font-bold" style={{ color: '#5b5fc7' }}>Seatvio</h1>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              {STEPS.map((s, idx) => (
                <div key={s.number} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors"
                      style={{
                        backgroundColor: step >= s.number ? '#5b5fc7' : '#374151',
                        color: step >= s.number ? '#ffffff' : '#9ca3af',
                      }}
                    >
                      {step > s.number ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        s.number
                      )}
                    </div>
                    <span
                      className="hidden sm:inline text-sm font-medium"
                      style={{ color: step >= s.number ? '#e5e7eb' : '#6b7280' }}
                    >
                      {s.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className="hidden sm:block mx-4 h-px w-12 lg:w-20"
                      style={{ backgroundColor: step > s.number ? '#5b5fc7' : '#374151' }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="h-2 rounded-full" style={{ backgroundColor: '#374151' }}>
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{ width: `${(step / 3) * 100}%`, backgroundColor: '#5b5fc7' }}
              />
            </div>
          </div>

          {/* Card */}
          <div className="rounded-xl border border-gray-700 p-6 sm:p-8" style={{ backgroundColor: '#292929' }}>
            {/* Step 1: Professional Background */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold text-white">Professional Background</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Tell us about your career so we can tailor your interview coaching.
                  </p>
                </div>

                <div>
                  <label htmlFor="fullName" className={labelClasses}>Full name</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className={`${inputClasses} ${errors.fullName ? 'border-red-500' : ''}`}
                  />
                  {errors.fullName && <p className={errorClasses}>{errors.fullName}</p>}
                </div>

                <div>
                  <label htmlFor="currentRole" className={labelClasses}>Current or most recent job title</label>
                  <input
                    id="currentRole"
                    type="text"
                    value={currentRole}
                    onChange={(e) => setCurrentRole(e.target.value)}
                    placeholder="e.g. Senior Product Manager"
                    className={`${inputClasses} ${errors.currentRole ? 'border-red-500' : ''}`}
                  />
                  {errors.currentRole && <p className={errorClasses}>{errors.currentRole}</p>}
                </div>

                <div>
                  <label htmlFor="yearsExperience" className={labelClasses}>Years of experience</label>
                  <select
                    id="yearsExperience"
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    className={`${selectClasses} ${errors.yearsExperience ? 'border-red-500' : ''}`}
                  >
                    <option value="" className="bg-gray-800">Select...</option>
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-gray-800">{opt.label}</option>
                    ))}
                  </select>
                  {errors.yearsExperience && <p className={errorClasses}>{errors.yearsExperience}</p>}
                </div>

                <div>
                  <label htmlFor="currentIndustry" className={labelClasses}>Current industry</label>
                  <select
                    id="currentIndustry"
                    value={currentIndustry}
                    onChange={(e) => setCurrentIndustry(e.target.value)}
                    className={`${selectClasses} ${errors.currentIndustry ? 'border-red-500' : ''}`}
                  >
                    <option value="" className="bg-gray-800">Select...</option>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-gray-800">{opt.label}</option>
                    ))}
                  </select>
                  {errors.currentIndustry && <p className={errorClasses}>{errors.currentIndustry}</p>}
                </div>

                <div>
                  <label htmlFor="targetIndustry" className={labelClasses}>Target industry</label>
                  <select
                    id="targetIndustry"
                    value={targetIndustry}
                    onChange={(e) => setTargetIndustry(e.target.value)}
                    className={`${selectClasses} ${errors.targetIndustry ? 'border-red-500' : ''}`}
                  >
                    <option value="" className="bg-gray-800">Select...</option>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-gray-800">{opt.label}</option>
                    ))}
                  </select>
                  {errors.targetIndustry && <p className={errorClasses}>{errors.targetIndustry}</p>}
                </div>
              </div>
            )}

            {/* Step 2: Interview Context */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">Interview Context</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Help us understand your preferences and how you feel about interviews.
                  </p>
                </div>

                {/* Work Arrangement */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Target work arrangement
                  </label>
                  <div className="flex gap-3">
                    {(['Remote', 'Hybrid', 'On-site'] as const).map((option) => (
                      <label
                        key={option}
                        className="flex-1 cursor-pointer rounded-lg border-2 px-4 py-3 text-center text-sm font-medium transition-colors"
                        style={{
                          borderColor: workArrangement === option ? '#5b5fc7' : '#4b5563',
                          backgroundColor: workArrangement === option ? 'rgba(91, 95, 199, 0.1)' : 'transparent',
                          color: workArrangement === option ? '#5b5fc7' : '#9ca3af',
                        }}
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
                    <p className={errorClasses}>{errors.workArrangement}</p>
                  )}
                </div>

                {/* Anxiety Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-300">Interview anxiety level</label>
                    <span className="text-sm font-semibold" style={{ color: '#5b5fc7' }}>{anxietyLevel}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={anxietyLevel}
                    onChange={(e) => setAnxietyLevel(Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #5b5fc7 ${((anxietyLevel - 1) / 9) * 100}%, #374151 ${((anxietyLevel - 1) / 9) * 100}%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Completely calm</span>
                    <span>Extremely anxious</span>
                  </div>
                </div>

                {/* Interview Difficulty */}
                <div>
                  <label htmlFor="interviewDifficulty" className={labelClasses}>
                    Describe what makes interviews hard for you{' '}
                    <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="interviewDifficulty"
                    value={interviewDifficulty}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) setInterviewDifficulty(e.target.value)
                    }}
                    placeholder="e.g. I freeze up during behavioral questions, or I struggle to talk about my achievements..."
                    rows={4}
                    maxLength={500}
                    className={`${inputClasses} min-h-[100px] resize-y`}
                  />
                  <p className="mt-1 text-xs text-gray-500">{interviewDifficulty.length}/500 characters</p>
                </div>
              </div>
            )}

            {/* Step 3: Optional */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold text-white">Optional</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Add your online profiles so we can provide more personalized coaching.
                    You can skip this step and add them later.
                  </p>
                </div>

                <div>
                  <label htmlFor="linkedinUrl" className={labelClasses}>LinkedIn profile URL</label>
                  <input
                    id="linkedinUrl"
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/your-profile"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label htmlFor="portfolioUrl" className={labelClasses}>Portfolio URL</label>
                  <input
                    id="portfolioUrl"
                    type="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://your-portfolio.com"
                    className={inputClasses}
                  />
                </div>
              </div>
            )}

            {/* Error message */}
            {errors.submit && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {errors.submit}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex items-center justify-between">
              <div>
                {step > 1 && (
                  <button
                    onClick={handleBack}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:text-white hover:bg-gray-700"
                  >
                    Back
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {step < 3 ? (
                  <button
                    onClick={handleNext}
                    className="rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#292929]"
                    style={{ backgroundColor: '#5b5fc7' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4eb3'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5b5fc7'}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#292929] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#5b5fc7' }}
                    onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = '#4a4eb3'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#5b5fc7'; }}
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Completing...
                      </span>
                    ) : (
                      'Complete Setup'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step indicator text */}
          <p className="mt-4 text-center text-sm text-gray-500">
            Step {step} of 3
          </p>
        </div>
      </div>
    </div>
  )
}
