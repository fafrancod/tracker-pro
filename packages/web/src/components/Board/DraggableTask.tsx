import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import type { Task } from '@core/types';

interface DraggableTaskProps {
  task: Task;
  weekId: string;
  dayId: string;
  children: (renderArgs: {
    dragHandleProps: Record<string, unknown>;
    isDragging: boolean;
  }) => ReactNode;
}

/**
 * Wrapper que conecta el TaskCard a dnd-kit:
 * - `setNodeRef` y `attributes` van en el div externo.
 * - `listeners` se pasan al consumidor para que los aplique sobre el handle
 *   (no sobre toda la card; queremos drag con la "manija", no con cualquier click).
 */
export function DraggableTask({ task, weekId, dayId, children }: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { task, weekId, dayId },
  });

  const style: React.CSSProperties | undefined = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 50 : 'auto',
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ dragHandleProps: listeners ?? {}, isDragging })}
    </div>
  );
}
