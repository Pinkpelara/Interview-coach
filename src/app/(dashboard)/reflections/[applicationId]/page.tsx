'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useParams } from 'next/navigation'

export default function ReflectionsPage() {
  const params = useParams()
  return (
    <div className="space-y-6">
      <Link href={`/applications/${params.applicationId}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h2 className="text-2xl font-bold text-white">Reflections</h2>
      <div className="rounded-2xl bg-[#292929] p-8 text-center">
        <p className="text-gray-400">Post-interview reflections coming soon.</p>
      </div>
    </div>
  )
}
