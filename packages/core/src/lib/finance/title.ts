/** Título comparable: minúsculas, sin tildes, dpto = depto. */
export function normalizeFinanceTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bdepartamentos?\b/g, 'depto')
    .replace(/\bdpto\b/g, 'depto')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function financeTitlesMatch(a: string, b: string): boolean {
  const left = normalizeFinanceTitle(a);
  const right = normalizeFinanceTitle(b);
  return Boolean(left) && left === right;
}
