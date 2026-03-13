'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ArrowLeft, Shield, CreditCard } from 'lucide-react'

type Plan = 'prep' | 'pro' | 'crunch'

const PRICES: Record<Plan, { monthly?: number; annual?: number; oneTime?: number }> = {
  prep: { monthly: 19, annual: 182 },
  pro: { monthly: 49, annual: 470 },
  crunch: { oneTime: 99 },
}

export default function CheckoutPage() {
  const params = useSearchParams()
  const router = useRouter()
  const rawPlan = params.get('plan')
  const plan: Plan | null = rawPlan === 'prep' || rawPlan === 'pro' || rawPlan === 'crunch' ? rawPlan : null
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual' | 'one_time'>(plan === 'crunch' ? 'one_time' : 'monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amount = useMemo(() => {
    if (!plan) return 0
    if (plan === 'crunch') return PRICES.crunch.oneTime || 0
    return billingCycle === 'annual' ? PRICES[plan].annual || 0 : PRICES[plan].monthly || 0
  }, [plan, billingCycle])

  async function handleCheckout() {
    if (!plan) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Checkout failed')
        return
      }
      router.push('/pricing?checkout=success')
    } catch {
      setError('Unable to complete checkout right now.')
    } finally {
      setLoading(false)
    }
  }

  if (!plan) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <p className="text-sm text-red-600">Invalid plan selected.</p>
        <Link href="/pricing">
          <Button variant="outline">Back to Pricing</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/pricing" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Pricing
      </Link>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold text-white">Secure Checkout</h2>
          <p className="text-sm text-gray-500">Complete your Seatvio plan upgrade.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border border-[#333] p-4">
            <div>
              <p className="font-semibold text-white capitalize">{plan} Plan</p>
              <p className="text-xs text-gray-500">
                {plan === 'crunch' ? 'One-time intensive access for 14 days.' : 'Subscription with cancel-anytime access.'}
              </p>
            </div>
            <Badge variant="info">${amount}</Badge>
          </div>

          {plan !== 'crunch' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-400">Billing cycle</p>
              <div className="flex gap-2">
                <button
                  className={`rounded-lg border px-3 py-2 text-sm ${billingCycle === 'monthly' ? 'border-[#5b5fc7] bg-[#5b5fc7]/20 text-[#5b5fc7]' : 'border-[#444] text-gray-400'}`}
                  onClick={() => setBillingCycle('monthly')}
                  type="button"
                >
                  Monthly (${PRICES[plan].monthly})
                </button>
                <button
                  className={`rounded-lg border px-3 py-2 text-sm ${billingCycle === 'annual' ? 'border-[#5b5fc7] bg-[#5b5fc7]/20 text-[#5b5fc7]' : 'border-[#444] text-gray-400'}`}
                  onClick={() => setBillingCycle('annual')}
                  type="button"
                >
                  Annual (${PRICES[plan].annual})
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-emerald-700 bg-emerald-900/30 p-3 text-xs text-emerald-300 flex items-start gap-2">
            <Shield className="h-4 w-4 mt-0.5" />
            Payment details are processed by a PCI-compliant provider. Seatvio does not store card numbers.
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleCheckout} loading={loading} className="w-full">
            <CreditCard className="h-4 w-4 mr-2" />
            Complete Checkout
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
