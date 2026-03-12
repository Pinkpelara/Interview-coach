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
          <label className="block text-sm font-medium text-gray-300">{label}</label>
          <span className="text-sm font-semibold text-[#5b5fc7]">{value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#5b5fc7]"
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
