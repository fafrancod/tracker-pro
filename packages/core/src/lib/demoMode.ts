// Flag in-memory: la capa de plataforma (web/mobile) la setea durante el
// bootstrap. Sirve para que la app renderice sin Supabase configurado: los
// subscribe* devuelven no-op y `authFetch` retorna mocks.

let demoMode = false;

export function setDemoMode(value: boolean): void {
  demoMode = value;
}

export function isDemoMode(): boolean {
  return demoMode;
}
