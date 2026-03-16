import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
      <p className="text-sm text-gray-600">
        The page you’re looking for does not exist or has moved.
      </p>
      <Link href="/dashboard">
        <Button>Go to dashboard</Button>
      </Link>
    </div>
  )
}
