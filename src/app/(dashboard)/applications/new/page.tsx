'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Loader2 } from 'lucide-react'

const STAGE_OPTIONS = [
  { value: '', label: 'Select stage (optional)' },
  { value: 'phone_screen', label: 'Phone Screen' },
  { value: 'first_round', label: 'First Round' },
  { value: 'panel', label: 'Panel' },
  { value: 'final_round', label: 'Final Round' },
  { value: 'case', label: 'Case Interview' },
  { value: 'stress', label: 'Stress Interview' },
]

export default function NewApplicationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [companyName, setCompanyName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jdText, setJdText] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [interviewStage, setInterviewStage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim() || !jobTitle.trim() || !jdText.trim() || !resumeText.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          jobTitle: jobTitle.trim(),
          jdText: jdText.trim(),
          resumeText: resumeText.trim(),
          interviewStage: interviewStage || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create application')
      }

      const app = await res.json()
      router.push(`/applications/${app.id}`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">New Application</h2>
        <p className="mt-1 text-sm text-gray-400">
          Add a job you&apos;re applying for. We&apos;ll analyze the job description against your resume
          and generate personalized interview questions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl bg-[#292929] p-6 space-y-5">
          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Company Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g., Google"
              className="w-full rounded-lg bg-[#1b1b1b] border border-[#333] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#5b5fc7]"
            />
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Job Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g., Senior Product Manager"
              className="w-full rounded-lg bg-[#1b1b1b] border border-[#333] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#5b5fc7]"
            />
          </div>

          {/* JD */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Job Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={8}
              className="w-full rounded-lg bg-[#1b1b1b] border border-[#333] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#5b5fc7] resize-y"
            />
          </div>

          {/* Resume */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Resume Text <span className="text-red-400">*</span>
            </label>
            <textarea
              value={resumeText}
              onChange={e => setResumeText(e.target.value)}
              placeholder="Paste your resume content here..."
              rows={8}
              className="w-full rounded-lg bg-[#1b1b1b] border border-[#333] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#5b5fc7] resize-y"
            />
          </div>

          {/* Stage */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Interview Stage
            </label>
            <select
              value={interviewStage}
              onChange={e => setInterviewStage(e.target.value)}
              className="w-full rounded-lg bg-[#1b1b1b] border border-[#333] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#5b5fc7]"
            >
              {STAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-800/50 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#5b5fc7] py-3 text-sm font-medium text-white hover:bg-[#4e52b5] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing documents and generating questions...
            </>
          ) : (
            'Create Application'
          )}
        </button>
      </form>
    </div>
  )
}
