'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Loader2, Save } from 'lucide-react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [profile, setProfile] = useState({
    currentRole: '',
    yearsExperience: '',
    currentIndustry: '',
    targetIndustry: '',
    workArrangement: '',
    linkedinUrl: '',
    portfolioUrl: '',
  })

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setFullName(data.fullName || '')
        setEmail(data.email || '')
        if (data.profile) {
          setProfile({
            currentRole: data.profile.currentRole || '',
            yearsExperience: data.profile.yearsExperience || '',
            currentIndustry: data.profile.currentIndustry || '',
            targetIndustry: data.profile.targetIndustry || '',
            workArrangement: data.profile.workArrangement || '',
            linkedinUrl: data.profile.linkedinUrl || '',
            portfolioUrl: data.profile.portfolioUrl || '',
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const saveProfile = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, ...profile }),
      })
      if (res.ok) setMessage('Settings saved.')
      else setMessage('Failed to save settings.')
    } catch {
      setMessage('Error saving settings.')
    }
    setSaving(false)
  }

  const changePassword = async () => {
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      setMessage('New password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.ok) {
        setMessage('Password updated.')
        setCurrentPassword('')
        setNewPassword('')
      } else {
        const data = await res.json()
        setMessage(data.error || 'Failed to update password.')
      }
    } catch {
      setMessage('Error updating password.')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#5b5fc7]" />
      </div>
    )
  }

  const inputClass = "w-full rounded-lg bg-[#1b1b1b] border border-[#333] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#5b5fc7]"

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-white">Settings</h2>

      {message && (
        <div className="rounded-lg bg-[#5b5fc7]/10 border border-[#5b5fc7]/30 px-4 py-3 text-sm text-[#5b5fc7]">
          {message}
        </div>
      )}

      {/* Profile */}
      <div className="rounded-2xl bg-[#292929] p-6 space-y-4">
        <h3 className="text-sm font-medium text-white">Profile</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email</label>
            <input value={email} disabled className={`${inputClass} opacity-50`} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Current Role</label>
            <input value={profile.currentRole} onChange={e => setProfile(p => ({ ...p, currentRole: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Years Experience</label>
            <select value={profile.yearsExperience} onChange={e => setProfile(p => ({ ...p, yearsExperience: e.target.value }))} className={inputClass}>
              <option value="">Select</option>
              {['0-1', '1-3', '3-5', '5-10', '10+'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">LinkedIn URL</label>
            <input value={profile.linkedinUrl} onChange={e => setProfile(p => ({ ...p, linkedinUrl: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Portfolio URL</label>
            <input value={profile.portfolioUrl} onChange={e => setProfile(p => ({ ...p, portfolioUrl: e.target.value }))} className={inputClass} />
          </div>
        </div>
        <button onClick={saveProfile} disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#5b5fc7] px-4 py-2 text-sm font-medium text-white hover:bg-[#4e52b5] disabled:opacity-50 transition-colors">
          <Save className="h-4 w-4" /> Save Profile
        </button>
      </div>

      {/* Password */}
      <div className="rounded-2xl bg-[#292929] p-6 space-y-4">
        <h3 className="text-sm font-medium text-white">Change Password</h3>
        <div className="space-y-3">
          <input type="password" placeholder="Current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} />
          <input type="password" placeholder="New password (min 8 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} />
        </div>
        <button onClick={changePassword} disabled={saving} className="rounded-lg bg-[#5b5fc7] px-4 py-2 text-sm font-medium text-white hover:bg-[#4e52b5] disabled:opacity-50 transition-colors">
          Update Password
        </button>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl bg-[#292929] p-6 space-y-4">
        <h3 className="text-sm font-medium text-red-400">Danger Zone</h3>
        <button
          onClick={() => signOut({ callbackUrl: '/signin' })}
          className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
