import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Side sheet: bottom sheet en mobile, panel lateral derecho en desktop.
 * Para contenido grande (detalle de tarea, settings expandidas).
 */

export const SideSheet = DialogPrimitive.Root;
export const SideSheetTrigger = DialogPrimitive.Trigger;
export const SideSheetClose = DialogPrimitive.Close;

const SideSheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
SideSheetOverlay.displayName = 'SideSheetOverlay';

export const SideSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <SideSheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // base
        'fixed z-50 flex flex-col gap-3 border-border bg-surface shadow-xl duration-300',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        // mobile: bottom sheet
        'bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border-t p-4',
        'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
        // sm+: side panel from right
        'sm:bottom-0 sm:left-auto sm:top-0 sm:h-full sm:max-h-full sm:w-[440px] sm:max-w-[90vw] sm:rounded-none sm:border-l sm:border-t-0 sm:p-6',
        'sm:data-[state=open]:slide-in-from-right sm:data-[state=closed]:slide-out-to-right',
        className
      )}
      {...props}
    >
      <div className="mx-auto h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring sm:right-4 sm:top-4">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SideSheetContent.displayName = 'SideSheetContent';

export const SideSheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 pb-2 pr-8', className)} {...props} />
);
SideSheetHeader.displayName = 'SideSheetHeader';

export const SideSheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-base font-semibold text-text-primary', className)}
    {...props}
  />
));
SideSheetTitle.displayName = 'SideSheetTitle';

export const SideSheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-xs text-text-muted', className)}
    {...props}
  />
));
SideSheetDescription.displayName = 'SideSheetDescription';
