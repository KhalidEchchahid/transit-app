import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'muted'
  block?: boolean
}

const variantClass: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[var(--primary)] text-[var(--primary-foreground)] border-2 border-[var(--border)] shadow-[var(--shadow-md)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[var(--shadow-xl)]',
  ghost:
    'bg-[var(--background)] text-[var(--foreground)] border-2 border-[var(--border)] shadow-[var(--shadow-sm)] hover:bg-[var(--muted)]',
  muted:
    'bg-[var(--muted)] text-[var(--foreground)] border-2 border-[var(--border)] shadow-[var(--shadow-sm)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[var(--shadow-md)]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', block, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'font-bold uppercase tracking-widest transition-transform duration-150 ease-linear px-4 py-2',
        block ? 'w-full' : '',
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)

Button.displayName = 'Button'
