'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  DollarSign,
  Swords,
  User,
  Zap,
  Users,
  ArrowRightLeft,
  HelpCircle,
} from 'lucide-react'

const DRILLS = [
  {
    id: 'salary',
    title: 'Salary Negotiation',
    description: 'Practice negotiating compensation with a hiring manager who pushes back.',
    icon: DollarSign,
    duration: '10–15 min',
  },
  {
    id: 'conflict',
    title: 'Conflict Questions',
    description: 'Handle "Tell me about a time you had a conflict" with composure.',
    icon: Swords,
    duration: '10–15 min',
  },
  {
    id: 'tell-me',
    title: 'Tell Me About Yourself',
    description: 'Nail the opening question with a structured, compelling narrative.',
    icon: User,
    duration: '10–15 min',
  },
  {
    id: 'curveball',
    title: 'Curveball Recovery',
    description: 'Recover from questions you have no prepared answer for.',
    icon: Zap,
    duration: '10–15 min',
  },
  {
    id: 'panel',
    title: 'Panel Dynamics',
    description: 'Manage multiple interviewers with different styles simultaneously.',
    icon: Users,
    duration: '10–15 min',
  },
  {
    id: 'why-leaving',
    title: 'Why Leaving',
    description: 'Explain your reasons for leaving without raising red flags.',
    icon: ArrowRightLeft,
    duration: '10–15 min',
  },
  {
    id: 'gap',
    title: 'Gap Explanation',
    description: 'Address career gaps, job hopping, or career changes confidently.',
    icon: HelpCircle,
    duration: '10–15 min',
  },
]

export default function PressureLabPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Pressure Lab</h2>
        <p className="mt-1 text-sm text-gray-400">
          Quick 10–15 minute drills in a Teams-style audio interview format.
          Each produces a brief debrief with observations and a target.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DRILLS.map(drill => (
          <div
            key={drill.id}
            className="rounded-2xl bg-[#292929] p-5 hover:bg-[#333] transition-colors group"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5b5fc7]/20 shrink-0">
                <drill.icon className="h-5 w-5 text-[#5b5fc7]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{drill.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{drill.duration}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-4">{drill.description}</p>
            <button
              className="w-full rounded-lg bg-[#5b5fc7] py-2 text-xs font-medium text-white hover:bg-[#4e52b5] transition-colors"
            >
              Start Drill
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
