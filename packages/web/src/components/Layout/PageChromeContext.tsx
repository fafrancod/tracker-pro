import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface PageChromeState {
  title: string;
  showFab: boolean;
  primaryAction: { label: string; onClick: () => void } | null;
  onFabClick: (() => void) | null;
}

interface PageChromeContextValue {
  chrome: PageChromeState;
  setChrome: (patch: Partial<PageChromeState>) => void;
  resetChrome: () => void;
}

const DEFAULT_CHROME: PageChromeState = {
  title: '',
  showFab: false,
  primaryAction: null,
  onFabClick: null,
};

const PageChromeContext = createContext<PageChromeContextValue | null>(null);

export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<PageChromeState>(DEFAULT_CHROME);

  const setChrome = useCallback((patch: Partial<PageChromeState>) => {
    setChromeState(prev => {
      const next: PageChromeState = { ...prev, ...patch };
      // Evita re-renders en bucle cuando la página recrea primaryAction cada paint.
      if (
        prev.title === next.title &&
        prev.showFab === next.showFab &&
        prev.onFabClick === next.onFabClick &&
        prev.primaryAction?.label === next.primaryAction?.label &&
        prev.primaryAction?.onClick === next.primaryAction?.onClick
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const resetChrome = useCallback(() => {
    setChromeState(DEFAULT_CHROME);
  }, []);

  const value = useMemo(
    () => ({ chrome, setChrome, resetChrome }),
    [chrome, setChrome, resetChrome]
  );

  return <PageChromeContext.Provider value={value}>{children}</PageChromeContext.Provider>;
}

export function usePageChrome(): PageChromeContextValue | null {
  return useContext(PageChromeContext);
}
