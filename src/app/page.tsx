'use client'

import Link from 'next/link'
import {
  BookOpen,
  Mic,
  Eye,
  Upload,
  MessageSquare,
  Users,
  BarChart3,
  UserCheck,
  Gauge,
  Map,
  Check,
  ChevronRight,
  ArrowRight,
  Zap,
} from 'lucide-react'

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white pt-20 pb-24 lg:pt-32 lg:pb-36">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-brand-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-accent-100/50 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-16 px-6 lg:flex-row lg:gap-12">
        {/* Copy */}
        <div className="flex-1 text-center lg:text-left">
          <span className="mb-4 inline-block rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700">
            AI-Powered Interview Simulation
          </span>
          <h1 className="mt-2 text-5xl font-extrabold leading-[1.08] tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
            So real, you&rsquo;ll
            <br />
            <span className="bg-gradient-to-r from-brand-700 to-accent-600 bg-clip-text text-transparent">
              get nervous.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600 sm:text-xl lg:mx-0 mx-auto">
            Practice with AI interviewers who look, sound, and behave like real
            people in a live video-call simulation before the stakes are real.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start justify-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-xl bg-brand-700 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 hover:shadow-xl hover:shadow-brand-700/30"
            >
              Start Practicing Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              See How It Works
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Mock interview room illustration */}
        <div className="w-full max-w-lg flex-1 lg:max-w-xl">
          <MockVideoCall />
        </div>
      </div>
    </section>
  )
}

/* ── Mock Audio Room UI ── */
function MockVideoCall() {
  return (
    <div className="relative mx-auto w-full">
      {/* Glow behind the card */}
      <div className="absolute inset-0 -m-4 rounded-3xl bg-gradient-to-br from-brand-200/40 to-accent-200/40 blur-2xl" />

      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-950 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="h-3 w-3 rounded-full bg-green-500" />
          <span className="ml-4 text-xs font-medium text-gray-400">
            Seatvio Interview Room
          </span>
          <span className="ml-auto flex items-center gap-1 rounded bg-red-600/90 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            LIVE
          </span>
        </div>

        {/* Interview tiles */}
        <div className="grid grid-cols-2 gap-2 p-3">
          {/* AI Interviewer 1 */}
          <div className="relative flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-brand-800 to-brand-950">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white ring-2 ring-brand-400/50">
                SK
              </div>
              <div className="flex items-end gap-0.5">
                <span className="h-2 w-1 animate-pulse rounded bg-brand-300" />
                <span className="h-4 w-1 animate-pulse rounded bg-brand-300" />
                <span className="h-3 w-1 animate-pulse rounded bg-brand-300" />
                <span className="h-5 w-1 animate-pulse rounded bg-brand-300" />
              </div>
            </div>
            <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
              Sarah K. — Technical Lead
            </span>
          </div>

          {/* AI Interviewer 2 */}
          <div className="relative flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-gray-800 to-gray-900">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-600 text-xl font-bold text-white ring-2 ring-accent-400/50">
                MR
              </div>
              <div className="h-1.5 w-10 rounded-full bg-emerald-400/40" />
            </div>
            <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
              Mike R. — HR Manager
            </span>
          </div>

          {/* You (candidate) */}
          <div className="relative col-span-2 flex aspect-[2.4/1] items-center justify-center rounded-lg bg-gradient-to-br from-gray-700 to-gray-800">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-gray-500 text-sm font-medium text-gray-400">
                YOU
              </div>
              <span className="text-xs text-gray-500">Camera preview</span>
            </div>
            <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
              You — Candidate
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 border-t border-gray-800 bg-gray-950 px-4 py-3">
          <button className="rounded-full bg-gray-800 p-2.5 text-gray-400 hover:text-white transition">
            <Mic className="h-4 w-4" />
          </button>
          <button className="rounded-full bg-gray-800 p-2.5 text-gray-400 hover:text-white transition">
            <MessageSquare className="h-4 w-4" />
          </button>
          <button className="rounded-full bg-red-600 p-2.5 text-white hover:bg-red-700 transition">
            <span className="block h-4 w-4 rounded-sm bg-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Three Modules ───────────────────────── */

const modules = [
  {
    title: 'PREPARE',
    subtitle: 'Build Knowledge',
    description:
      'Upload your resume and job description. Our AI generates custom questions tailored to your exact interview scenario.',
    icon: BookOpen,
    gradient: 'from-brand-600 to-brand-700',
    bg: 'bg-brand-50',
    border: 'border-brand-200',
  },
  {
    title: 'PERFORM',
    subtitle: 'Live Simulation',
    description:
      'Face AI interviewers in a realistic video-call environment. Experience pressure mechanics, follow-ups, and panel dynamics.',
    icon: Mic,
    gradient: 'from-accent-500 to-accent-600',
    bg: 'bg-accent-50',
    border: 'border-accent-200',
  },
  {
    title: 'OBSERVE',
    subtitle: 'Watch AI Demo',
    description:
      'Watch a full AI-led interview before stepping in. See how top candidates handle tough questions and learn by observation.',
    icon: Eye,
    gradient: 'from-emerald-500 to-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
]

function Modules() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Three modules. One complete system.
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            A structured path from preparation to mastery.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div
              key={m.title}
              className={`group relative rounded-2xl border ${m.border} ${m.bg} p-8 transition hover:shadow-lg hover:-translate-y-1`}
            >
              <div
                className={`mb-6 inline-flex rounded-xl bg-gradient-to-br ${m.gradient} p-3.5 text-white shadow-md`}
              >
                <m.icon className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold tracking-widest text-gray-500">
                {m.title}
              </h3>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {m.subtitle}
              </p>
              <p className="mt-3 leading-relaxed text-gray-600">
                {m.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── How It Works ───────────────────────── */

const steps = [
  {
    num: '01',
    title: 'Upload Resume + JD',
    description:
      'Drop in your resume and the job description. Our AI extracts the skills, requirements, and context it needs.',
    icon: Upload,
  },
  {
    num: '02',
    title: 'Get Custom Questions',
    description:
      'Receive a tailored question bank spanning behavioral, technical, and situational categories.',
    icon: MessageSquare,
  },
  {
    num: '03',
    title: 'Practice with AI Interviewers',
    description:
      'Step into a live simulation with animated AI interviewers. Face follow-ups, panel dynamics, and realistic pressure.',
    icon: Users,
  },
  {
    num: '04',
    title: 'Get Detailed Feedback',
    description:
      'Review your Moment Map, see where you excelled or stumbled, and get actionable advice for improvement.',
    icon: BarChart3,
  },
]

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="bg-gray-50 py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            From upload to insight in four simple steps.
          </p>
        </div>

        <div className="relative mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Connector line (hidden on mobile) */}
          <div className="pointer-events-none absolute top-14 left-[10%] right-[10%] hidden h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200 lg:block" />

          {steps.map((s) => (
            <div key={s.num} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 mb-6 flex h-28 w-28 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-md">
                <s.icon className="h-10 w-10 text-brand-700" />
                <span className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white shadow">
                  {s.num}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── Features ───────────────────────── */

const features = [
  {
    title: 'Real-Time Animated AI Interviewers',
    description:
      'Each interviewer has a distinct visual presence, voice cadence, and personality that adapts in real time.',
    icon: Mic,
  },
  {
    title: 'Panel Interviews',
    description:
      'Face up to three AI interviewers simultaneously. They coordinate questions and react to each other.',
    icon: Users,
  },
  {
    title: '6 Interviewer Archetypes',
    description:
      'From the Friendly HR to the Skeptical CTO, each archetype pushes you in different ways.',
    icon: UserCheck,
  },
  {
    title: 'Pressure Mechanics',
    description:
      'Awkward silences, rapid-fire follow-ups, and curveball questions replicate real interview stress.',
    icon: Gauge,
  },
  {
    title: 'Moment Map Debrief',
    description:
      'A timeline of your entire session highlighting strong moments, hesitations, and missed opportunities.',
    icon: Map,
  },
  {
    title: 'Observe Module',
    description:
      'Watch a full AI-driven demo interview before your session. Learn strategies by seeing them in action.',
    icon: Eye,
  },
]

function Features() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything you need to ace the interview
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Purpose-built features that go far beyond flashcards and mock
            questions.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition hover:border-brand-200 hover:shadow-md"
            >
              <div className="mb-5 inline-flex rounded-xl bg-brand-50 p-3 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-gray-600">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── Pricing ───────────────────────── */

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Dip your toes in with limited access.',
    features: [
      '2 sessions per month',
      '1 interviewer archetype',
      'Basic feedback summary',
      'Prepare module access',
    ],
    cta: 'Get Started',
    href: '/signup',
    recommended: false,
  },
  {
    name: 'Prep',
    price: '$19',
    period: '/mo',
    description: 'For serious preparation over time.',
    features: [
      'Unlimited sessions',
      '3 interviewer archetypes',
      'Full Prepare + Perform modules',
      'Moment Map debrief',
      'Session history',
    ],
    cta: 'Start Prep Plan',
    href: '/signup?plan=prep',
    recommended: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/mo',
    description: 'The complete Seatvio experience.',
    features: [
      'Everything in Prep',
      'All 6 interviewer archetypes',
      'Panel interviews',
      'Pressure mechanics',
      'Observe module',
      'Priority support',
    ],
    cta: 'Go Pro',
    href: '/signup?plan=pro',
    recommended: true,
  },
  {
    name: 'Crunch',
    price: '$99',
    period: 'one-time',
    description: '14 days of full access. Interview coming up fast.',
    features: [
      'Everything in Pro',
      '14 days of unlimited access',
      'No recurring billing',
      'Perfect for a single interview cycle',
    ],
    cta: 'Start Crunch Mode',
    href: '/signup?plan=crunch',
    recommended: false,
  },
]

function Pricing() {
  return (
    <section id="pricing" className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Start free. Upgrade when your interview matters most.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm transition hover:shadow-lg ${
                plan.recommended
                  ? 'border-brand-400 ring-2 ring-brand-700/20'
                  : 'border-gray-200'
              }`}
            >
              {plan.recommended && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-700 px-4 py-1 text-xs font-bold tracking-wide text-white shadow">
                  RECOMMENDED
                </span>
              )}

              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-gray-900">
                  {plan.price}
                </span>
                <span className="text-sm text-gray-500">{plan.period}</span>
              </div>
              <p className="mt-3 text-sm text-gray-600">{plan.description}</p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`mt-8 block rounded-xl py-3 text-center text-sm font-semibold transition ${
                  plan.recommended
                    ? 'bg-brand-700 text-white shadow-md shadow-brand-700/25 hover:bg-brand-800'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── CTA Band ───────────────────────── */

function CtaBand() {
  return (
    <section className="bg-gradient-to-r from-brand-700 to-brand-900 py-20">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <Zap className="mb-4 h-10 w-10 text-accent-400" />
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Ready to face the pressure?
        </h2>
        <p className="mt-4 max-w-xl text-lg text-brand-200">
          Your next interview won&rsquo;t wait. Start practicing with
          AI interviewers today — free, no credit card required.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50 hover:shadow-xl"
        >
          Start Practicing Free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}

/* ───────────────────────── Footer ───────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
            S
          </div>
          <span className="text-lg font-bold text-gray-900">Seatvio</span>
        </div>

        <nav className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
          <Link href="#how-it-works" className="hover:text-brand-700 transition">How It Works</Link>
          <Link href="#pricing" className="hover:text-brand-700 transition">Pricing</Link>
          <Link href="/login" className="hover:text-brand-700 transition">Log In</Link>
          <Link href="/signup" className="hover:text-brand-700 transition">Sign Up</Link>
        </nav>

        <p className="text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Seatvio. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

/* ───────────────────────── Page ───────────────────────── */

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Sticky nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
              S
            </div>
            <span className="text-lg font-bold text-gray-900">Seatvio</span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
            <a href="#how-it-works" className="hover:text-brand-700 transition">
              How It Works
            </a>
            <a href="#pricing" className="hover:text-brand-700 transition">
              Pricing
            </a>
            <Link href="/login" className="hover:text-brand-700 transition">
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-brand-700 px-5 py-2 text-white transition hover:bg-brand-800"
            >
              Sign Up Free
            </Link>
          </div>
        </div>
      </nav>

      <Hero />
      <Modules />
      <HowItWorks />
      <Features />
      <Pricing />
      <CtaBand />
      <Footer />
    </main>
  )
}
