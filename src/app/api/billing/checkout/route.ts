import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPlanTier, getEffectivePlan } from '@/lib/subscription'

type BillingCycle = 'monthly' | 'annual' | 'one_time'

const VALID_CYCLES: BillingCycle[] = ['monthly', 'annual', 'one_time']

function nextPeriodEnd(plan: string, cycle: BillingCycle): Date | null {
  const now = new Date()
  if (plan === 'crunch') {
    return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  }
  if (cycle === 'annual') {
    return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  }
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as { id: string }).id
  const body = await request.json()
  const plan = typeof body.plan === 'string' ? body.plan : ''
  const billingCycle = (body.billingCycle || 'monthly') as BillingCycle

  if (!isPlanTier(plan) || plan === 'free') {
    return NextResponse.json({ error: 'Invalid plan selected.' }, { status: 400 })
  }
  if (!VALID_CYCLES.includes(billingCycle)) {
    return NextResponse.json({ error: 'Invalid billing cycle.' }, { status: 400 })
  }
  if (plan === 'crunch' && billingCycle !== 'one_time') {
    return NextResponse.json({ error: 'Crunch uses one-time billing only.' }, { status: 400 })
  }

  // Placeholder checkout completion endpoint. Card data is never collected here.
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan,
      status: 'active',
      currentPeriodEnd: nextPeriodEnd(plan, billingCycle),
      stripeCustomerId: null,
      stripeSubId: null,
    },
    update: {
      plan,
      status: 'active',
      currentPeriodEnd: nextPeriodEnd(plan, billingCycle),
    },
  })

  const effectivePlan = await getEffectivePlan(userId)
  return NextResponse.json({
    success: true,
    plan: effectivePlan,
    message: 'Subscription updated successfully.',
    redirectPath: '/pricing?checkout=success',
  })
}
