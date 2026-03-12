'use client'

import { useState } from 'react'

export default function AdminPage() {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleDbPush = async () => {
    if (!token.trim()) {
      setStatus('error')
      setMessage('Please enter your admin token (your NEXTAUTH_SECRET or AUTH_SECRET value from Vercel env vars)')
      return
    }

    setStatus('loading')
    setMessage('Updating database schema... this may take up to 60 seconds.')

    try {
      const res = await fetch('/api/admin/db-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()

      if (data.success) {
        setStatus('success')
        setMessage('Database schema updated successfully! You can now go to the dashboard.')
      } else {
        setStatus('error')
        setMessage(`Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      setStatus('error')
      setMessage('Network error. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#292929] rounded-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white">Admin Panel</h1>
          <p className="text-gray-400 text-sm mt-1">Database management</p>
        </div>

        <div className="space-y-4">
          <div className="bg-[#1b1b1b] rounded-xl p-4">
            <h2 className="text-white text-sm font-medium mb-2">Update Database Schema</h2>
            <p className="text-gray-500 text-xs mb-4">
              Enter your admin token (the value of NEXTAUTH_SECRET or AUTH_SECRET from your Vercel environment variables) and click Update.
            </p>

            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your secret token here"
              className="w-full px-3 py-2.5 rounded-lg bg-[#292929] border border-gray-700 text-white text-sm mb-3 focus:outline-none focus:border-[#5b5fc7]"
            />

            <button
              onClick={handleDbPush}
              disabled={status === 'loading'}
              className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
                status === 'loading'
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-[#5b5fc7] text-white hover:bg-[#4e52b5]'
              }`}
            >
              {status === 'loading' ? 'Updating...' : 'Update Database'}
            </button>
          </div>

          {message && (
            <div className={`rounded-lg px-4 py-3 text-sm ${
              status === 'success'
                ? 'bg-green-900/30 text-green-400 border border-green-800/50'
                : status === 'error'
                ? 'bg-red-900/30 text-red-400 border border-red-800/50'
                : 'bg-blue-900/30 text-blue-400 border border-blue-800/50'
            }`}>
              {message}
            </div>
          )}
        </div>

        <a
          href="/dashboard"
          className="block w-full py-2 text-gray-400 text-sm hover:text-white transition-colors text-center"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}
