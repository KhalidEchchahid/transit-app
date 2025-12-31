import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merge class names while letting Tailwind utilities resolve conflicts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
