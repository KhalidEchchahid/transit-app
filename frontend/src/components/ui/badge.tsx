import { cn } from '@/lib/utils'

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'muted' | 'accent' | 'critical'
}

const toneClass: Record<NonNullable<BadgeProps['tone']>, string> = {
  muted: 'bg-[var(--muted)] text-[var(--foreground)]',
  accent: 'bg-[var(--accent)] text-[var(--accent-foreground)]',
  critical: 'bg-[var(--destructive)] text-[var(--destructive-foreground)]',
}

export function Badge({ tone = 'muted', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 border-2 border-[var(--border)] px-2 py-1 text-xs font-bold uppercase tracking-wide shadow-[var(--shadow-xs)]',
        toneClass[tone],
        className,
      )}
      {...props}
    />
  )
}
