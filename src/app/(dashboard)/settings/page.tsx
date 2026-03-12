'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Save, Eye, EyeOff, Trash2, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Slider } from '@/components/ui/Slider'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

const industryOptions = [
  { value: 'technology', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'design', label: 'Design' },
  { value: 'sales', label: 'Sales' },
  { value: 'legal', label: 'Legal' },
  { value: 'other', label: 'Other' },
]

const experienceOptions = [
  { value: '0-1', label: '0-1 years' },
  { value: '1-3', label: '1-3 years' },
  { value: '3-5', label: '3-5 years' },
  { value: '5-10', label: '5-10 years' },
  { value: '10+', label: '10+ years' },
]

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()

  // Profile state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [industry, setIndustry] = useState('')
  const [experience, setExperience] = useState('')
  const [anxietyLevel, setAnxietyLevel] = useState(5)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  // Notification state
  const [sessionSummaries, setSessionSummaries] = useState(true)
  const [dailyReminders, setDailyReminders] = useState(false)
  const [weeklyProgress, setWeeklyProgress] = useState(true)
  const [reEngagement, setReEngagement] = useState(true)
  const [interviewMorning, setInterviewMorning] = useState(true)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsSaved, setNotificationsSaved] = useState(false)

  // Subscription state
  const [currentPlan, setCurrentPlan] = useState('free')

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Loading state
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setFullName(data.fullName || '')
          setEmail(data.email || '')
          setJobTitle(data.currentRole || '')
          setIndustry(data.currentIndustry || '')
          setExperience(data.yearsExperience || '')
          setAnxietyLevel(data.anxietyLevel ?? 5)
          setCurrentPlan(data.plan || 'free')
          if (data.notifications) {
            setSessionSummaries(data.notifications.sessionSummaries ?? true)
            setDailyReminders(data.notifications.dailyReminders ?? false)
            setWeeklyProgress(data.notifications.weeklyProgress ?? true)
            setReEngagement(data.notifications.reEngagement ?? true)
            setInterviewMorning(data.notifications.interviewMorning ?? true)
          }
        }
      } catch {
        // silently fail, use defaults
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [])

  async function handleProfileSave() {
    setProfileLoading(true)
    setProfileSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'profile',
          fullName,
          currentRole: jobTitle,
          currentIndustry: industry,
          yearsExperience: experience,
          anxietyLevel,
        }),
      })
      if (res.ok) {
        setProfileSaved(true)
        setTimeout(() => setProfileSaved(false), 3000)
      }
    } catch {
      // handle error
    } finally {
      setProfileLoading(false)
    }
  }

  async function handlePasswordSave() {
    setPasswordError('')
    setPasswordSaved(false)

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setPasswordLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'password',
          currentPassword,
          newPassword,
        }),
      })
      if (res.ok) {
        setPasswordSaved(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => setPasswordSaved(false), 3000)
      } else {
        const data = await res.json()
        setPasswordError(data.error || 'Failed to update password')
      }
    } catch {
      setPasswordError('Something went wrong')
    } finally {
      setPasswordLoading(false)
    }
  }

  async function handleNotificationsSave() {
    setNotificationsLoading(true)
    setNotificationsSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'notifications',
          notifications: {
            sessionSummaries,
            dailyReminders,
            weeklyProgress,
            reEngagement,
            interviewMorning,
          },
        }),
      })
      if (res.ok) {
        setNotificationsSaved(true)
        setTimeout(() => setNotificationsSaved(false), 2500)
      }
    } finally {
      setNotificationsLoading(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'DELETE',
      })
      if (res.ok) {
        router.push('/login')
      }
    } catch {
      // handle error
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-700 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
          <p className="text-sm text-gray-500">Update your personal details and preferences.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            id="fullName"
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            disabled
            className="bg-gray-50"
          />
          <Input
            id="jobTitle"
            label="Job Title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Software Engineer"
          />
          <Select
            id="industry"
            label="Industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            options={industryOptions}
          />
          <Select
            id="experience"
            label="Experience"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            options={experienceOptions}
          />
          <Slider
            label="Anxiety Level"
            value={anxietyLevel}
            onChange={setAnxietyLevel}
            min={1}
            max={10}
            leftLabel="Very calm"
            rightLabel="Very anxious"
          />
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleProfileSave} loading={profileLoading}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
            {profileSaved && (
              <span className="text-sm text-green-600">Saved successfully</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
          <p className="text-sm text-gray-500">Update your password to keep your account secure.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              id="currentPassword"
              label="Current Password"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <Input
              id="newPassword"
              label="New Password"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Input
            id="confirmPassword"
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={passwordError}
          />
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handlePasswordSave} loading={passwordLoading}>
              <Save className="mr-2 h-4 w-4" />
              Update Password
            </Button>
            {passwordSaved && (
              <span className="text-sm text-green-600">Password updated</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
          <p className="text-sm text-gray-500">Choose which emails and notifications you receive.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationToggle
            label="Session Summaries"
            description="Receive a summary after each practice session"
            checked={sessionSummaries}
            onChange={setSessionSummaries}
          />
          <NotificationToggle
            label="Daily Reminders"
            description="Get a daily nudge to practice before your interview"
            checked={dailyReminders}
            onChange={setDailyReminders}
          />
          <NotificationToggle
            label="Weekly Progress"
            description="A weekly digest of your practice progress and improvements"
            checked={weeklyProgress}
            onChange={setWeeklyProgress}
          />
          <NotificationToggle
            label="Re-engagement"
            description="Get notified if you haven't practiced in a while"
            checked={reEngagement}
            onChange={setReEngagement}
          />
          <NotificationToggle
            label="Interview Morning Reminder"
            description="Receive a same-day motivation and focus reminder on interview day"
            checked={interviewMorning}
            onChange={setInterviewMorning}
          />
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleNotificationsSave} loading={notificationsLoading}>
              <Save className="mr-2 h-4 w-4" />
              Save Notifications
            </Button>
            {notificationsSaved && (
              <span className="text-sm text-green-600">Notification preferences updated</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
          <p className="text-sm text-gray-500">Manage your current plan and billing.</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">Current Plan:</span>
              <Badge variant={currentPlan === 'free' ? 'default' : 'success'}>
                {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
              </Badge>
            </div>
            <Link href="/pricing">
              <Button variant="outline" size="sm">
                {currentPlan === 'free' ? 'Upgrade' : 'Manage Plan'}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </h2>
          <p className="text-sm text-gray-500">
            Irreversible actions. Please proceed with caution.
          </p>
        </CardHeader>
        <CardContent>
          {!deleteConfirmOpen ? (
            <Button variant="danger" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          ) : (
            <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">
                This will permanently delete your account and all associated data including
                applications, sessions, and practice history. This action cannot be undone.
              </p>
              <Input
                id="deleteConfirm"
                label='Type "DELETE" to confirm'
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
              />
              <div className="flex gap-3">
                <Button
                  variant="danger"
                  onClick={handleDeleteAccount}
                  loading={deleteLoading}
                  disabled={deleteConfirmText !== 'DELETE'}
                >
                  Permanently Delete Account
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDeleteConfirmOpen(false)
                    setDeleteConfirmText('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NotificationToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? 'bg-brand-700' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
