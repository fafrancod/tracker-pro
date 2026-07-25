import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface PageChromeState {
  title: string;
  showFab: boolean;
  primaryAction: { label: string; onClick: () => void } | null;
  onFabClick: (() => void) | null;
}

interface PageChromeApi {
  setChrome: (patch: {
    title?: string;
    showFab?: boolean;
    /** Solo se usa label para comparar; onClick se guarda en ref estable. */
    primaryAction?: { label: string; onClick: () => void } | null;
    onFabClick?: (() => void) | null;
  }) => void;
  resetChrome: () => void;
}

const DEFAULT_CHROME: PageChromeState = {
  title: '',
  showFab: false,
  primaryAction: null,
  onFabClick: null,
};

const PageChromeStateContext = createContext<PageChromeState>(DEFAULT_CHROME);
const PageChromeApiContext = createContext<PageChromeApi | null>(null);

/**
 * API estable (setChrome/resetChrome) separada del state, para que Layout
 * no re-dispare efectos cuando solo cambia el chrome.
 */
export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<PageChromeState>(DEFAULT_CHROME);
  const primaryClickRef = useRef<(() => void) | null>(null);
  const fabClickRef = useRef<(() => void) | null>(null);

  const setChrome = useCallback(
    (patch: {
      title?: string;
      showFab?: boolean;
      primaryAction?: { label: string; onClick: () => void } | null;
      onFabClick?: (() => void) | null;
    }) => {
      // Callbacks en refs: no forman parte de la igualdad del state.
      if (patch.primaryAction !== undefined) {
        primaryClickRef.current = patch.primaryAction?.onClick ?? null;
      }
      if (patch.onFabClick !== undefined) {
        fabClickRef.current = patch.onFabClick ?? null;
      }

      setChromeState(prev => {
        const nextTitle = patch.title !== undefined ? patch.title : prev.title;
        const nextShowFab = patch.showFab !== undefined ? patch.showFab : prev.showFab;
        const nextLabel =
          patch.primaryAction !== undefined
            ? patch.primaryAction?.label ?? null
            : prev.primaryAction?.label ?? null;
        const hasPrimary =
          patch.primaryAction !== undefined
            ? patch.primaryAction !== null
            : prev.primaryAction !== null;
        const hasFabClick =
          patch.onFabClick !== undefined
            ? patch.onFabClick !== null
            : prev.onFabClick !== null;

        const prevLabel = prev.primaryAction?.label ?? null;
        const prevHasPrimary = prev.primaryAction !== null;
        const prevHasFab = prev.onFabClick !== null;

        if (
          prev.title === nextTitle &&
          prev.showFab === nextShowFab &&
          prevLabel === nextLabel &&
          prevHasPrimary === hasPrimary &&
          prevHasFab === hasFabClick
        ) {
          return prev;
        }

        const stablePrimary =
          hasPrimary && nextLabel
            ? {
                label: nextLabel,
                onClick: () => {
                  primaryClickRef.current?.();
                },
              }
            : null;

        const stableFab = hasFabClick
          ? () => {
              fabClickRef.current?.();
            }
          : null;

        return {
          title: nextTitle,
          showFab: nextShowFab,
          primaryAction: stablePrimary,
          onFabClick: stableFab,
        };
      });
    },
    []
  );

  const resetChrome = useCallback(() => {
    primaryClickRef.current = null;
    fabClickRef.current = null;
    setChromeState(DEFAULT_CHROME);
  }, []);

  const api = useMemo(() => ({ setChrome, resetChrome }), [setChrome, resetChrome]);

  return (
    <PageChromeApiContext.Provider value={api}>
      <PageChromeStateContext.Provider value={chrome}>{children}</PageChromeStateContext.Provider>
    </PageChromeApiContext.Provider>
  );
}

/** Solo API (estable). Preferir esto en Layout. */
export function usePageChromeApi(): PageChromeApi | null {
  return useContext(PageChromeApiContext);
}

/** Solo state de chrome (título / FAB). */
export function usePageChromeState(): PageChromeState {
  return useContext(PageChromeStateContext);
}

/** Compat: API + state (AppShell header). */
export function usePageChrome(): (PageChromeApi & { chrome: PageChromeState }) | null {
  const api = usePageChromeApi();
  const chrome = usePageChromeState();
  if (!api) return null;
  return { ...api, chrome };
}
