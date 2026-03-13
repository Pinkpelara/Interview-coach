import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-[#333] text-gray-400': variant === 'default',
          'bg-emerald-900/30 text-emerald-400': variant === 'success',
          'bg-yellow-900/30 text-yellow-400': variant === 'warning',
          'bg-red-900/30 text-red-400': variant === 'danger',
          'bg-blue-900/30 text-blue-400': variant === 'info',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
