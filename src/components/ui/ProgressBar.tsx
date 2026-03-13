import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showPercent?: boolean
  className?: string
  color?: string
}

export function ProgressBar({ value, max = 100, label, showPercent = true, className, color }: ProgressBarProps) {
  const percent = Math.min(Math.round((value / max) * 100), 100)
  const barColor = color || (percent >= 80 ? 'bg-green-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-red-500')

  return (
    <div className={cn('space-y-1', className)}>
      {(label || showPercent) && (
        <div className="flex justify-between text-sm">
          {label && <span className="text-gray-400">{label}</span>}
          {showPercent && <span className="font-medium text-gray-200">{percent}%</span>}
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-[#1b1b1b]">
        <div
          className={cn('h-2 rounded-full transition-all duration-500', barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
