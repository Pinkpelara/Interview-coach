'use client'

import { cn } from '@/lib/utils'

interface ScoreGaugeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

export function ScoreGauge({ score, size = 'md', label, className }: ScoreGaugeProps) {
  const sizes = {
    sm: { width: 60, stroke: 4, text: 'text-sm', labelText: 'text-[10px]' },
    md: { width: 100, stroke: 6, text: 'text-2xl', labelText: 'text-xs' },
    lg: { width: 140, stroke: 8, text: 'text-4xl', labelText: 'text-sm' },
  }

  const s = sizes[size]
  const radius = (s.width - s.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={s.width} height={s.width} className="-rotate-90">
        <circle
          cx={s.width / 2}
          cy={s.width / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={s.stroke}
        />
        <circle
          cx={s.width / 2}
          cy={s.width / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={s.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="animate-gauge transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('font-bold', s.text)} style={{ color }}>{score}</span>
        {label && <span className={cn('text-gray-500', s.labelText)}>{label}</span>}
      </div>
    </div>
  )
}
