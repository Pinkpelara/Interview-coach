/**
 * Feature gating by subscription tier.
 *
 * Plan hierarchy: free < prep < pro < crunch
 *
 * Free:   2 sessions/month, question bank, flashcards, basic debrief (scores only), 1 character
 * Prep:   Unlimited sessions, full debrief with Moment Map & coach audio, all interview stages, all archetypes, Pressure Lab
 * Pro:    Everything in Prep + Company DNA research, Observe module, panel mode, stress interview, salary negotiation, Debrief Card sharing
 * Crunch: Full Pro access for 14 days + countdown plan
 */

export type PlanTier = 'free' | 'prep' | 'pro' | 'crunch'

const TIER_LEVEL: Record<PlanTier, number> = {
  free: 0,
  prep: 1,
  pro: 2,
  crunch: 2, // crunch = pro level access
}

export interface FeatureGateResult {
  allowed: boolean
  requiredPlan: PlanTier
  message: string
}

export type Feature =
  | 'unlimited_sessions'
  | 'full_debrief'
  | 'moment_map'
  | 'coach_audio'
  | 'all_archetypes'
  | 'all_stages'
  | 'pressure_lab'
  | 'observe_module'
  | 'panel_mode'
  | 'stress_interview'
  | 'salary_negotiation'
  | 'debrief_card'
  | 'countdown_plan'
  | 'company_dna'

const FEATURE_REQUIREMENTS: Record<Feature, { plan: PlanTier; message: string }> = {
  unlimited_sessions: {
    plan: 'prep',
    message: 'Unlimited sessions require the Prep plan or higher.',
  },
  full_debrief: {
    plan: 'prep',
    message: 'Full debrief with detailed analysis requires the Prep plan.',
  },
  moment_map: {
    plan: 'prep',
    message: 'The Moment Map is available on the Prep plan and above.',
  },
  coach_audio: {
    plan: 'prep',
    message: 'Coach audio feedback requires the Prep plan.',
  },
  all_archetypes: {
    plan: 'prep',
    message: 'All interviewer archetypes are available on the Prep plan.',
  },
  all_stages: {
    plan: 'prep',
    message: 'All interview stages require the Prep plan.',
  },
  pressure_lab: {
    plan: 'prep',
    message: 'The Pressure Lab is available on the Prep plan and above.',
  },
  observe_module: {
    plan: 'pro',
    message: 'The Observe module is a Pro feature. Watch AI demonstrate perfect and poor interview runs.',
  },
  panel_mode: {
    plan: 'pro',
    message: 'Panel interviews with 2-3 interviewers require the Pro plan.',
  },
  stress_interview: {
    plan: 'pro',
    message: 'Stress interview simulations are available on the Pro plan.',
  },
  salary_negotiation: {
    plan: 'pro',
    message: 'The Salary Negotiation Simulator is a Pro feature.',
  },
  debrief_card: {
    plan: 'pro',
    message: 'Shareable Debrief Cards require the Pro plan.',
  },
  countdown_plan: {
    plan: 'pro',
    message: 'Interview Countdown Mode with a daily practice plan requires the Pro plan.',
  },
  company_dna: {
    plan: 'pro',
    message: 'Company DNA deep research is a Pro feature.',
  },
}

export function checkFeature(userPlan: PlanTier, feature: Feature): FeatureGateResult {
  const requirement = FEATURE_REQUIREMENTS[feature]
  const userLevel = TIER_LEVEL[userPlan] || 0
  const requiredLevel = TIER_LEVEL[requirement.plan] || 0

  return {
    allowed: userLevel >= requiredLevel,
    requiredPlan: requirement.plan,
    message: requirement.message,
  }
}

export function getSessionLimit(plan: PlanTier): number {
  return plan === 'free' ? 2 : Infinity
}

export function getMaxCharacters(plan: PlanTier): number {
  return plan === 'free' ? 1 : 3
}
