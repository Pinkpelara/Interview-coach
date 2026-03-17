'use client'

import Link from 'next/link'
import { BookOpen, Mic, Eye, Check, ArrowRight } from 'lucide-react'

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0f0f0f] pt-20 pb-24 lg:pt-32 lg:pb-36">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[#5b5fc7]/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
          So real, you&apos;ll get nervous.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-gray-400">
          Seatvio puts you in a hyper-realistic AI interview that looks and feels like
          a real Teams call — with AI interviewers who speak, push back, and test you
          before you ever walk into the real thing.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-lg bg-[#5b5fc7] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[#4e52b5] transition-colors"
          >
            Start Practicing Free
          </Link>
          <Link
            href="#pricing"
            className="rounded-lg border border-[#333] px-8 py-3.5 text-sm font-semibold text-gray-300 hover:bg-[#1b1b1b] transition-colors"
          >
            View Pricing
          </Link>
        </div>

        {/* Interview room preview mock */}
        <div className="mt-16 w-full max-w-3xl rounded-2xl bg-[#1b1b1b] border border-[#333] p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-500">Google &middot; Senior Product Manager Interview</span>
            <span className="text-xs text-gray-500">12:34</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { initials: 'JM', name: 'James Miller', title: 'VP Engineering', color: '#4A6FA5' },
              { initials: 'SK', name: 'Sarah Kim', title: 'Senior Director', color: '#6B8E4E' },
            ].map(char => (
              <div key={char.initials} className="rounded-xl bg-[#292929] flex flex-col items-center justify-center py-10">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold mb-3"
                  style={{ backgroundColor: char.color }}
                >
                  {char.initials}
                </div>
                <p className="text-xs font-medium text-white">{char.name}</p>
                <p className="text-xs text-gray-500">{char.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Modules() {
  const modules = [
    {
      icon: BookOpen,
      title: 'Prepare',
      description: 'AI-generated question bank tailored to the exact job. Build answers with real-time coaching, red flag scanner, and spaced repetition flashcards.',
    },
    {
      icon: Mic,
      title: 'Perform',
      description: 'Live audio interview on a Teams-style call with AI interviewers who have distinct personalities, push back on vague answers, and create realistic pressure.',
    },
    {
      icon: Eye,
      title: 'Observe',
      description: 'Watch AI demonstrate the perfect interview and a cautionary run using your actual weak patterns. Side-by-side comparison synced to each question.',
    },
  ]

  return (
    <section className="bg-[#1b1b1b] py-20">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-3xl font-bold text-white">Three modules. One interview-ready you.</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {modules.map(m => (
            <div key={m.title} className="rounded-2xl bg-[#292929] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5b5fc7]/20 mb-4">
                <m.icon className="h-5 w-5 text-[#5b5fc7]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{m.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{m.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { step: '1', title: 'Add your application', desc: 'Paste the job description and upload your resume.' },
    { step: '2', title: 'Get your question bank', desc: 'AI analyzes both documents and generates 100\u2013200+ personalized questions across 10 categories.' },
    { step: '3', title: 'Run a live interview', desc: 'Join a Teams-style call with AI interviewers who speak, pause, and push back.' },
    { step: '4', title: 'Review your debrief', desc: 'Get scored on 5 dimensions, hiring probability, and targeted improvement plan.' },
  ]

  return (
    <section className="bg-[#0f0f0f] py-20">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-center text-3xl font-bold text-white">How it works</h2>
        <div className="mt-12 space-y-8">
          {steps.map(s => (
            <div key={s.step} className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5b5fc7] text-sm font-bold text-white">
                {s.step}
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '',
      features: ['2 sessions/month', 'Question bank + flashcards', 'Answer builder + AI analysis', 'Basic debrief (scores only)'],
      cta: 'Get Started',
      featured: false,
    },
    {
      name: 'Prep',
      price: '$19',
      period: '/mo',
      features: ['Unlimited sessions', 'Full debrief + Moment Map + coach audio', 'All stages + all archetypes', 'Pressure Lab'],
      cta: 'Start Prep Plan',
      featured: false,
    },
    {
      name: 'Pro',
      price: '$49',
      period: '/mo',
      features: ['Everything in Prep', 'Observe module', 'Panel mode (2–3 interviewers)', 'Stress interview + salary sim', 'Debrief Card sharing'],
      cta: 'Start Pro Plan',
      featured: true,
    },
    {
      name: 'Crunch',
      price: '$99',
      period: ' one-time',
      features: ['Everything in Pro for 14 days', 'Countdown plan with daily schedule', 'Morning-of warmup', 'Post-interview reflection'],
      cta: 'Start Crunch',
      featured: false,
    },
  ]

  return (
    <section id="pricing" className="bg-[#1b1b1b] py-20">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-3xl font-bold text-white">Simple pricing</h2>
        <p className="mt-3 text-center text-gray-400">No hidden fees. Cancel anytime.</p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 ${
                plan.featured
                  ? 'bg-[#5b5fc7] ring-2 ring-[#5b5fc7]'
                  : 'bg-[#292929]'
              }`}
            >
              <h3 className={`text-lg font-semibold ${plan.featured ? 'text-white' : 'text-white'}`}>
                {plan.name}
              </h3>
              <div className="mt-2">
                <span className={`text-3xl font-bold ${plan.featured ? 'text-white' : 'text-white'}`}>
                  {plan.price}
                </span>
                <span className={`text-sm ${plan.featured ? 'text-white/70' : 'text-gray-400'}`}>
                  {plan.period}
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {plan.features.map(f => (
                  <li key={f} className={`flex items-start gap-2 text-sm ${plan.featured ? 'text-white/90' : 'text-gray-400'}`}>
                    <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.featured ? 'text-white' : 'text-[#5b5fc7]'}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                  plan.featured
                    ? 'bg-white text-[#5b5fc7] hover:bg-gray-100'
                    : 'bg-[#5b5fc7] text-white hover:bg-[#4e52b5]'
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

function CTA() {
  return (
    <section className="bg-[#0f0f0f] py-20">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-3xl font-bold text-white">Ready to feel the pressure?</h2>
        <p className="mt-4 text-gray-400">
          Your next interview doesn&apos;t have to be your first practice run.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#5b5fc7] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[#4e52b5] transition-colors"
        >
          Get Started Free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-[#0f0f0f] border-t border-[#222] py-8">
      <div className="mx-auto max-w-5xl px-6 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#5b5fc7]">Seatvio</span>
        <span className="text-xs text-gray-500">&copy; {new Date().getFullYear()} Seatvio. All rights reserved.</span>
      </div>
    </footer>
  )
}

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f0f0f]/80 backdrop-blur-lg border-b border-[#222]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-lg font-bold text-[#5b5fc7]">Seatvio</Link>
        <div className="flex items-center gap-4">
          <Link href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</Link>
          <Link href="/signin" className="text-sm text-gray-400 hover:text-white transition-colors">Sign in</Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[#5b5fc7] px-4 py-2 text-sm font-medium text-white hover:bg-[#4e52b5] transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Nav />
      <Hero />
      <Modules />
      <HowItWorks />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  )
}
