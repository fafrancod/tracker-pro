/**
 * ¿La caja anidada (chips de un día) debe quedarse con este delta de rueda?
 * Si no desborda de verdad, o ya está en el borde en esa dirección, el
 * calendario padre tiene que seguir desplazándose.
 */
export function nestedScrollerConsumesWheel(opts: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  deltaY: number;
}): boolean {
  const overflow = opts.scrollHeight - opts.clientHeight;
  if (!(overflow > 1) || opts.deltaY === 0) return false;
  if (opts.deltaY < 0) return opts.scrollTop > 0;
  return opts.scrollTop + opts.clientHeight < opts.scrollHeight - 1;
}
