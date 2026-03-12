import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type BillingCycle = 'monthly' | 'annual' | 'one_time'

const VALID_PLANS = ['prep', 'pro', 'crunch']
const VALID_CYCLES: BillingCycle[] = ['monthly', 'annual', 'one_time']

function nextPeriodEnd(plan: string, cycle: BillingCycle): Date | null {
  const now = new Date()
  if (plan === 'crunch') {
    return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days
  }
  if (cycle === 'annual') {
    return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  }
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // monthly
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const body = await request.json()
    const plan = typeof body.plan === 'string' ? body.plan : ''
    const billingCycle = (body.billingCycle || 'monthly') as BillingCycle

    if (!VALID_PLANS.includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan selected.' }, { status: 400 })
    }
    if (!VALID_CYCLES.includes(billingCycle)) {
      return NextResponse.json({ error: 'Invalid billing cycle.' }, { status: 400 })
    }
    if (plan === 'crunch' && billingCycle !== 'one_time') {
      return NextResponse.json({ error: 'Crunch uses one-time billing only.' }, { status: 400 })
    }

    const now = new Date()

    // Placeholder: in production, this would create a Stripe/payment-processor checkout session
    // For now, directly activate the subscription
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        status: 'active',
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd(plan, billingCycle),
        paymentProcessor: null,
        processorCustomerId: null,
        processorSubId: null,
      },
      update: {
        plan,
        status: 'active',
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd(plan, billingCycle),
      },
    })

    return NextResponse.json({
      success: true,
      plan,
      message: 'Subscription updated successfully.',
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
