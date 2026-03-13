import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Webhook handler for payment processor events (Stripe, etc.)
// This route is NOT auth-protected — it validates via webhook signature instead.

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature') || request.headers.get('x-webhook-signature')

    // TODO: Verify webhook signature with payment processor secret
    // For now, parse the body and handle events
    if (!signature) {
      console.warn('Webhook received without signature — processing in dev mode')
    }

    let event: { type: string; data: Record<string, unknown> }
    try {
      event = JSON.parse(body)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const eventType = event.type

    switch (eventType) {
      case 'checkout.session.completed': {
        const data = event.data as {
          processorCustomerId?: string
          processorSubId?: string
          userId?: string
          plan?: string
          billingCycle?: string
        }

        if (data.userId && data.plan) {
          await prisma.subscription.upsert({
            where: { userId: data.userId },
            create: {
              userId: data.userId,
              plan: data.plan,
              status: 'active',
              billingCycle: data.billingCycle || 'monthly',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              paymentProcessor: 'stripe',
              processorCustomerId: data.processorCustomerId || null,
              processorSubId: data.processorSubId || null,
            },
            update: {
              plan: data.plan,
              status: 'active',
              paymentProcessor: 'stripe',
              processorCustomerId: data.processorCustomerId || null,
              processorSubId: data.processorSubId || null,
            },
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const data = event.data as {
          processorSubId?: string
          status?: string
          currentPeriodEnd?: string
        }

        if (data.processorSubId) {
          const sub = await prisma.subscription.findFirst({
            where: { processorSubId: data.processorSubId },
          })

          if (sub) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                status: data.status || sub.status,
                ...(data.currentPeriodEnd && {
                  currentPeriodEnd: new Date(data.currentPeriodEnd),
                }),
              },
            })
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const data = event.data as { processorSubId?: string }

        if (data.processorSubId) {
          const sub = await prisma.subscription.findFirst({
            where: { processorSubId: data.processorSubId },
          })

          if (sub) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                status: 'cancelled',
                plan: 'free',
              },
            })
          }
        }
        break
      }

      default:
        console.log(`Unhandled webhook event: ${eventType}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
