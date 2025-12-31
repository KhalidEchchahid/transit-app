import * as React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger
const ContextMenuPortal = ContextMenuPrimitive.Portal
const ContextMenuSeparator = ContextMenuPrimitive.Separator

const contentBase =
  'brut-card border-2 border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-[var(--shadow-md)] rounded-none'

const itemBase =
  'relative flex cursor-pointer select-none items-center rounded-none px-3 py-2 text-sm outline-none transition-colors hover:bg-[var(--muted)] focus:bg-[var(--muted)]'

const ContextMenuContent = forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <ContextMenuPortal>
    <ContextMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(contentBase, className)}
      {...props}
    />
  </ContextMenuPortal>
))
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Item ref={ref} className={cn(itemBase, className)} {...props} />
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const StyledSeparator = forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuSeparator ref={ref} className={cn('my-1 h-[1px] bg-[var(--border)]', className)} {...props} />
))
StyledSeparator.displayName = ContextMenuPrimitive.Separator.displayName

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  StyledSeparator as ContextMenuSeparator,
}
