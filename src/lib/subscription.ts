import { prisma } from '@/lib/prisma'
import { checkFeature, type Feature, type PlanTier } from '@/lib/feature-gate'

export async function getEffectivePlan(userId: string): Promise<PlanTier> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, currentPeriodEnd: true, status: true },
  })
  if (!sub || sub.status !== 'active') return 'free'

  const rawPlan = (sub.plan || 'free') as PlanTier
  if (rawPlan === 'free') return 'free'

  // Legacy subscriptions may not have a period end; treat as active.
  if (!sub.currentPeriodEnd) {
    return rawPlan
  }

  if (sub.currentPeriodEnd.getTime() > Date.now()) {
    return rawPlan
  }

  // Any expired paid plan falls back to free.
  await prisma.subscription.update({
    where: { userId },
    data: { plan: 'free', status: 'active', currentPeriodEnd: null },
  }).catch(() => {
    // Non-blocking fallback.
  })
  return 'free'
}

export async function requireFeature(userId: string, feature: Feature) {
  const plan = await getEffectivePlan(userId)
  const gate = checkFeature(plan, feature)
  return { plan, gate }
}

export function isPlanTier(value: string): value is PlanTier {
  return value === 'free' || value === 'prep' || value === 'pro' || value === 'crunch'
}
