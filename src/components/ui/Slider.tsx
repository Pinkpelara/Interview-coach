'use client'

import { cn } from '@/lib/utils'

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label?: string
  leftLabel?: string
  rightLabel?: string
  className?: string
}

export function Slider({
  value,
  onChange,
  min = 1,
  max = 10,
  label,
  leftLabel,
  rightLabel,
  className,
}: SliderProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <span className="text-sm font-semibold text-brand-700">{value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-700"
      />
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  )
}
