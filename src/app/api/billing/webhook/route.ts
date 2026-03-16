import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

function nextPeriodEnd(plan: string, billingCycle: string): Date | null {
  const now = new Date()
  if (plan === 'crunch') {
    return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  }
  if (billingCycle === 'annual') {
    return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  }
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
}

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

export async function POST(request: Request) {
  const stripe = getStripeClient()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
  }

  const payload = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      const plan = session.metadata?.plan
      const billingCycle = session.metadata?.billingCycle || 'monthly'
      if (userId && plan) {
        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            plan,
            status: 'active',
            currentPeriodEnd: nextPeriodEnd(plan, billingCycle),
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
            stripeSubId: typeof session.subscription === 'string' ? session.subscription : null,
          },
          update: {
            plan,
            status: 'active',
            currentPeriodEnd: nextPeriodEnd(plan, billingCycle),
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
            stripeSubId: typeof session.subscription === 'string' ? session.subscription : null,
          },
        })
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      if (typeof sub.id === 'string') {
        await prisma.subscription.updateMany({
          where: { stripeSubId: sub.id },
          data: {
            plan: 'free',
            status: 'active',
            currentPeriodEnd: null,
          },
        })
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription
      if (typeof sub.id === 'string') {
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'inactive'
        const subWithPeriod = sub as unknown as { current_period_end?: number }
        await prisma.subscription.updateMany({
          where: { stripeSubId: sub.id },
          data: {
            status,
            currentPeriodEnd: subWithPeriod.current_period_end
              ? new Date(subWithPeriod.current_period_end * 1000)
              : null,
          },
        })
      }
    }
  } catch (error) {
    console.error('Stripe webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
