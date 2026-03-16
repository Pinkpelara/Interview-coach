'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global app error:', error)
  }, [error])

  return (
    <html>
      <body className="min-h-screen bg-gray-50">
        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
          <p className="text-sm text-gray-600">
            We hit an unexpected issue while loading this page.
          </p>
          <div className="flex gap-3">
            <Button onClick={reset}>Try again</Button>
            <Link href="/dashboard">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
