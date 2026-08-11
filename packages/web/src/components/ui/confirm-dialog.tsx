import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';

export type ConfirmDialogVariant = 'destructive' | 'warning' | 'default';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
  onConfirm: () => void | Promise<void>;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
}

/**
 * Modal de confirmación con skin (reemplazo de window.confirm / alert nativos).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  loadingLabel,
  onConfirm,
  variant = 'destructive',
  loading = false,
}: ConfirmDialogProps) {
  const { t } = useT();
  const Icon = variant === 'destructive' ? Trash2 : AlertTriangle;

  const iconClass =
    variant === 'destructive'
      ? 'bg-accent-red/15 text-accent-red'
      : variant === 'warning'
        ? 'bg-amber-500/15 text-amber-500'
        : 'bg-primary/15 text-primary';

  const confirmClass =
    variant === 'destructive'
      ? 'bg-accent-red text-white hover:bg-accent-red/90 focus-visible:ring-accent-red'
      : variant === 'warning'
        ? 'bg-amber-500 text-white hover:bg-amber-500/90 focus-visible:ring-amber-500'
        : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && loading) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md border-border bg-surface text-text-primary sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-text-primary">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                iconClass
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription className="text-text-muted">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel ?? t('action_cancel')}
          </Button>
          <Button
            type="button"
            disabled={loading}
            className={confirmClass}
            onClick={() => void onConfirm()}
          >
            {loading
              ? (loadingLabel ?? '…')
              : (confirmLabel ??
                (variant === 'destructive' ? t('action_delete') : t('action_confirm')))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
