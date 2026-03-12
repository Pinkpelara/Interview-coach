import Link from 'next/link'
import { BookOpen, Users, Search, DollarSign, HelpCircle, RotateCcw } from 'lucide-react'

const GUIDES = [
  {
    slug: 'star-soar-car-prep',
    title: 'STAR / SOAR / CAR / PREP Methods',
    description: 'Master the four most common answer frameworks with resume-context examples.',
    icon: BookOpen,
  },
  {
    slug: 'body-language',
    title: 'Body Language Guide',
    description: 'Project confidence through posture, eye contact, and gestures — even on video calls.',
    icon: Users,
  },
  {
    slug: 'company-research',
    title: 'Company Research Guide',
    description: 'How to research a company before your interview and weave insights into your answers.',
    icon: Search,
  },
  {
    slug: 'salary-negotiation',
    title: 'Salary Negotiation Guide',
    description: 'Strategies for negotiating compensation without damaging the relationship.',
    icon: DollarSign,
  },
  {
    slug: 'unknown-questions',
    title: 'Handling Unknown Questions',
    description: 'What to do when you don\'t know the answer — frameworks for thinking out loud.',
    icon: HelpCircle,
  },
  {
    slug: 'repeated-questions',
    title: 'Redirecting Repeated Questions',
    description: 'When an interviewer keeps probing the same topic, how to redirect gracefully.',
    icon: RotateCcw,
  },
]

export default function CoachingLibraryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Coaching Library</h2>
        <p className="mt-1 text-sm text-gray-400">
          Guides and frameworks to strengthen your interview skills.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map(guide => (
          <div
            key={guide.slug}
            className="rounded-2xl bg-[#292929] p-5 hover:bg-[#333] transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5b5fc7]/20 mb-3">
              <guide.icon className="h-5 w-5 text-[#5b5fc7]" />
            </div>
            <h3 className="text-sm font-semibold text-white">{guide.title}</h3>
            <p className="mt-1 text-xs text-gray-400">{guide.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
