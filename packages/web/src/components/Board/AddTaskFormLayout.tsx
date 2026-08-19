import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AddTaskFormLayoutProps {
  isModal: boolean;
  kind: ReactNode;
  title: ReactNode;
  project: ReactNode;
  finance: ReactNode;
  rx: ReactNode;
  classify: ReactNode;
  when: ReactNode;
  more: ReactNode;
  actions: ReactNode;
  classifyTitle: string;
  whenTitle: string;
  moreTitle: string;
  projectTitle: string;
}

function BoardCard({
  title,
  children,
  className,
  dataTour,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  dataTour?: string;
}) {
  if (!children) return null;
  return (
    <section
      data-tour={dataTour}
      className={cn(
        'flex flex-col gap-4 rounded-[20px] border border-border bg-surface p-4',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45)]',
        'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]',
        className
      )}
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {title}
      </h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * Compact = single column (week cell).
 * Modal desktop = Apple-style tablón (2–3 grouped cards).
 */
export function AddTaskFormLayout({
  isModal,
  kind,
  title,
  project,
  finance,
  rx,
  classify,
  when,
  more,
  actions,
  classifyTitle,
  whenTitle,
  moreTitle,
  projectTitle,
}: AddTaskFormLayoutProps) {
  if (!isModal) {
    return (
      <div className="flex flex-col gap-2">
        {kind}
        {title}
        {project}
        {finance}
        {rx}
        {classify}
        {when}
        {more}
        {actions}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-4">{kind}</div>
      <div className="space-y-1.5">{title}</div>
      <BoardCard title={projectTitle}>{project}</BoardCard>
      {finance}
      {rx}
      <div className="grid grid-cols-1 items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
        <BoardCard title={whenTitle} dataTour="create-when">
          {when}
        </BoardCard>
        <BoardCard title={classifyTitle}>{classify}</BoardCard>
        <BoardCard title={moreTitle}>{more}</BoardCard>
      </div>
      {actions}
    </div>
  );
}
