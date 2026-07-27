import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bottom sheet (Radix Dialog adaptado):
 * - Mobile (<sm): pegado al borde inferior, full-width, slide desde abajo,
 *   con "grab handle" visual arriba.
 * - Desktop (sm+): modal centrado tradicional.
 *
 * Misma API que Dialog/DialogContent de shadcn, sólo cambia el posicionamiento.
 */

export const MobileSheet = DialogPrimitive.Root;
export const MobileSheetTrigger = DialogPrimitive.Trigger;
export const MobileSheetClose = DialogPrimitive.Close;

const MobileSheetOverlay = React.forwardRef<
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
MobileSheetOverlay.displayName = 'MobileSheetOverlay';

export const MobileSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <MobileSheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // base
        'fixed z-50 grid gap-3 border-border bg-surface shadow-xl duration-200',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        // mobile: bottom sheet + safe area + keyboard-friendly max height
        'bottom-0 left-0 right-0 max-h-[min(92dvh,100%)] overflow-y-auto rounded-t-3xl border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
        'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
        // sm+: centered modal
        'sm:bottom-auto sm:left-[50%] sm:right-auto sm:top-[50%] sm:w-full sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border sm:p-6',
        'sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]',
        'sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]',
        'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
        className
      )}
      data-glass-float
      {...props}
    >
      {/* Grab handle visual mobile-only */}
      <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />

      {children}

      <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring sm:right-4 sm:top-4">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
MobileSheetContent.displayName = 'MobileSheetContent';

export const MobileSheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1', className)} {...props} />
);
MobileSheetHeader.displayName = 'MobileSheetHeader';

export const MobileSheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-base font-semibold leading-none tracking-tight text-text-primary', className)}
    {...props}
  />
));
MobileSheetTitle.displayName = 'MobileSheetTitle';

export const MobileSheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-xs text-text-muted', className)}
    {...props}
  />
));
MobileSheetDescription.displayName = 'MobileSheetDescription';
