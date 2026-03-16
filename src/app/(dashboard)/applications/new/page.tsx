'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { Briefcase, Upload, FileText, Building2, Loader2 } from 'lucide-react'

const STAGE_OPTIONS = [
  { value: 'Applied', label: 'Applied' },
  { value: 'Phone Screen Scheduled', label: 'Phone Screen Scheduled' },
  { value: 'First Round Scheduled', label: 'First Round Scheduled' },
  { value: 'Panel/Final Round Scheduled', label: 'Panel/Final Round Scheduled' },
]

export default function NewApplicationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [parsingJd, setParsingJd] = useState(false)
  const [parsingResume, setParsingResume] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    companyName: '',
    jobTitle: '',
    jdText: '',
    resumeText: '',
    interviewStage: 'Applied',
  })

  async function parseDocument(file: File, type: 'jd' | 'resume') {
    if (type === 'jd') setParsingJd(true)
    if (type === 'resume') setParsingResume(true)
    setError('')
    try {
      const data = new FormData()
      data.append('file', file)
      const res = await fetch('/api/documents/parse', {
        method: 'POST',
        body: data,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || 'Failed to parse document')
      }
      if (type === 'jd') {
        setForm((prev) => ({ ...prev, jdText: body.text || '' }))
      } else {
        setForm((prev) => ({ ...prev, resumeText: body.text || '' }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse document')
    } finally {
      if (type === 'jd') setParsingJd(false)
      if (type === 'resume') setParsingResume(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.companyName || !form.jobTitle || !form.jdText || !form.resumeText) {
      setError('Please fill in all required fields.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create application')
      }

      const app = await res.json()
      router.push(`/applications/${app.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Application</h1>
        <p className="mt-1 text-gray-600">
          Set up a new job application to start generating personalized interview prep.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-brand-700" />
              <h2 className="text-lg font-semibold">Company & Role</h2>
            </div>

            <Input
              label="Company Name *"
              placeholder="e.g., Google, Stripe, Shopify"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />

            <Input
              label="Job Title *"
              placeholder="e.g., Senior Product Manager"
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            />

            <Select
              label="Interview Stage (optional)"
              options={STAGE_OPTIONS}
              value={form.interviewStage}
              onChange={(e) => setForm({ ...form, interviewStage: e.target.value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-brand-700" />
              <h2 className="text-lg font-semibold">Job Description</h2>
            </div>
            <p className="text-sm text-gray-500">
              Paste the full job description or upload the original JD PDF/text file.
            </p>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                <Upload className="h-3.5 w-3.5" />
                Upload JD file (PDF/TXT)
                <input
                  type="file"
                  accept=".pdf,.txt,.md,text/plain,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void parseDocument(file, 'jd')
                    e.currentTarget.value = ''
                  }}
                />
              </label>
              {parsingJd && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing JD...
                </span>
              )}
            </div>
            <Textarea
              placeholder="Paste the complete job description here..."
              value={form.jdText}
              onChange={(e) => setForm({ ...form, jdText: e.target.value })}
              className="min-h-[200px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-brand-700" />
              <h2 className="text-lg font-semibold">Resume</h2>
            </div>
            <p className="text-sm text-gray-500">
              Paste resume text or upload your resume PDF/text file.
            </p>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                <Upload className="h-3.5 w-3.5" />
                Upload resume file (PDF/TXT)
                <input
                  type="file"
                  accept=".pdf,.txt,.md,text/plain,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void parseDocument(file, 'resume')
                    e.currentTarget.value = ''
                  }}
                />
              </label>
              {parsingResume && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing resume...
                </span>
              )}
            </div>
            <Textarea
              placeholder="Paste your resume content here..."
              value={form.resumeText}
              onChange={(e) => setForm({ ...form, resumeText: e.target.value })}
              className="min-h-[200px]"
            />
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} size="lg">
            <Briefcase className="h-4 w-4 mr-2" />
            Create Application
          </Button>
        </div>
      </form>
    </div>
  )
}
