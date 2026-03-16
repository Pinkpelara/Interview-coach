import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPlanTier, getEffectivePlan } from '@/lib/subscription'
import Stripe from 'stripe'

type BillingCycle = 'monthly' | 'annual' | 'one_time'

const VALID_CYCLES: BillingCycle[] = ['monthly', 'annual', 'one_time']
const STRIPE_PRICE_IDS = {
  prep: {
    monthly: process.env.STRIPE_PRICE_PREP_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_PREP_ANNUAL || '',
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL || '',
  },
  crunch: {
    one_time: process.env.STRIPE_PRICE_CRUNCH_ONE_TIME || '',
  },
} as const

function getStripeClient(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return null
  return new Stripe(secret)
}

function getAppBaseUrl(): string {
  const explicit =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`.replace(/\/$/, '')
  return 'http://localhost:3000'
}

function getPriceId(plan: PlanTierWithoutFree, cycle: BillingCycle): string {
  if (plan === 'crunch') return STRIPE_PRICE_IDS.crunch.one_time
  if (plan === 'prep') return cycle === 'annual' ? STRIPE_PRICE_IDS.prep.annual : STRIPE_PRICE_IDS.prep.monthly
  return cycle === 'annual' ? STRIPE_PRICE_IDS.pro.annual : STRIPE_PRICE_IDS.pro.monthly
}

type PlanTierWithoutFree = 'prep' | 'pro' | 'crunch'

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

  const selectedPlan = plan as PlanTierWithoutFree
  const stripe = getStripeClient()
  if (stripe) {
    const priceId = getPriceId(selectedPlan, billingCycle)
    if (!priceId) {
      return NextResponse.json(
        { error: 'Billing configuration is incomplete for the selected plan.' },
        { status: 500 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (!dbUser?.email) {
      return NextResponse.json({ error: 'User email not found.' }, { status: 400 })
    }

    const baseUrl = getAppBaseUrl()
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: selectedPlan === 'crunch' ? 'payment' : 'subscription',
      customer_email: dbUser.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/pricing?checkout=success`,
      cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        userId,
        plan: selectedPlan,
        billingCycle,
      },
    })

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutSession.url,
    })
  }

  // Development fallback when Stripe is not configured.
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: selectedPlan,
      status: 'active',
      currentPeriodEnd: nextPeriodEnd(selectedPlan, billingCycle),
      stripeCustomerId: null,
      stripeSubId: null,
    },
    update: {
      plan: selectedPlan,
      status: 'active',
      currentPeriodEnd: nextPeriodEnd(selectedPlan, billingCycle),
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
