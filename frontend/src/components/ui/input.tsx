import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'brut-input w-full outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-4 focus:ring-offset-[var(--background)]',
        className,
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'
