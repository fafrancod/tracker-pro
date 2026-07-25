import type { BoardCategoryFilter } from '@core/types';
import type { TKey } from '@/lib/i18n';

/** Mensaje vacío del calendario según el filtro de categoría activo. */
export function emptyMessageKeyForCategory(
  category: BoardCategoryFilter | undefined
): TKey {
  switch (category) {
    case 'habits':
      return 'empty_no_habits';
    case 'events':
      return 'empty_no_events';
    case 'possible':
      return 'empty_no_possible';
    case 'rx':
      return 'empty_no_rx';
    case 'projects':
      return 'empty_no_projects_cat';
    case 'all':
    default:
      return 'empty_no_tasks';
  }
}
