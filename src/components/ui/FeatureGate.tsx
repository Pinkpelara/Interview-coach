'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { PlanTier } from '@/lib/feature-gate'

interface FeatureGateProps {
  allowed: boolean
  requiredPlan: PlanTier
  message: string
  children: React.ReactNode
}

const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  prep: 'Prep ($19/mo)',
  pro: 'Pro ($49/mo)',
  crunch: 'Crunch ($99)',
}

export function FeatureGate({ allowed, requiredPlan, message, children }: FeatureGateProps) {
  if (allowed) return <>{children}</>

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 blur-[1px] select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 max-w-sm text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center mx-auto">
            <Lock className="h-5 w-5 text-brand-700" />
          </div>
          <p className="text-sm text-gray-700">{message}</p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Upgrade to {PLAN_LABELS[requiredPlan]} →
          </Link>
        </div>
      </div>
    </div>
  )
}
