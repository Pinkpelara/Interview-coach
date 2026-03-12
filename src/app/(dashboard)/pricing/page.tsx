import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Check, Star, Zap, Rocket, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { getEffectivePlan } from '@/lib/subscription'

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Get started with basic interview practice.',
    icon: Star,
    features: [
      '2 sessions per month',
      'Basic debrief',
      '1 interviewer character',
    ],
    cta: 'Current Plan',
    highlighted: false,
  },
  {
    id: 'prep',
    name: 'Prep',
    price: '$19',
    period: '/month',
    description: 'Unlimited practice with full analysis tools.',
    icon: Zap,
    features: [
      'Unlimited sessions',
      'Full debrief + Moment Map',
      'Coach audio feedback',
      'All interviewer characters',
      'Pressure Lab access',
    ],
    cta: 'Upgrade',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'Complete toolkit for serious job seekers.',
    icon: Rocket,
    features: [
      'Everything in Prep',
      'Company DNA analysis',
      'Observe module',
      'Panel mode',
      'Stress interview simulation',
      'Salary negotiation lab',
      'Debrief Card export',
    ],
    cta: 'Upgrade',
    highlighted: true,
  },
  {
    id: 'crunch',
    name: 'Crunch',
    price: '$99',
    period: ' one-time',
    description: 'Full Pro access for 14 days with a countdown plan.',
    icon: Clock,
    features: [
      'Full Pro features for 14 days',
      'Countdown preparation plan',
      'Priority support',
      'All characters & modules',
      'Debrief Card export',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
]

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: { checkout?: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/signin')
  }

  const userId = (session.user as { id: string }).id

  await prisma.subscription.findUnique({
    where: { userId },
  })
  const currentPlan = await getEffectivePlan(userId)
  const checkoutSuccess = searchParams?.checkout === 'success'

  return (
    <div className="space-y-8">
      {checkoutSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Plan updated successfully.
        </div>
      )}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Choose Your Plan
        </h2>
        <p className="mt-2 text-gray-500">
          Pick the plan that fits your interview preparation timeline and goals.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id
          const Icon = plan.icon

          return (
            <Card
              key={plan.id}
              className={
                plan.highlighted
                  ? 'relative border-2 border-brand-700 shadow-md'
                  : ''
              }
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="info" className="bg-brand-700 text-white px-3 py-1 text-xs">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-700/10">
                  <Icon className="h-5 w-5 text-brand-700" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {plan.name}
                </h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {plan.price}
                  </span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2">
                  {isCurrentPlan ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled
                    >
                      Current Plan
                    </Button>
                  ) : (
                    <Link href={`/pricing/checkout?plan=${plan.id}`}>
                      <Button
                        variant={plan.highlighted ? 'primary' : 'outline'}
                        className="w-full"
                      >
                        {plan.cta}
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-500">
          All plans include secure data handling and can be cancelled anytime.{' '}
          <Link href="/settings" className="font-medium text-brand-700 hover:text-brand-800">
            Manage your subscription
          </Link>
        </p>
      </div>
    </div>
  )
}
