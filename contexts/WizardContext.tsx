import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { EsporteId } from '../constants/esportes';
import type { Genero, NivelAtividade } from '../types/usuario';

export interface WizardDraft {
  idade?: number;
  genero?: Genero;
  peso?: number;
  altura?: number;
  esportes?: EsporteId[];
  nivel?: NivelAtividade;
  fotoUrl?: string;
}

interface WizardContextValue {
  draft: WizardDraft;
  setDraft: (patch: Partial<WizardDraft>) => void;
  resetDraft: () => void;
}

const WizardContext = createContext<WizardContextValue | undefined>(undefined);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<WizardDraft>({});

  const setDraft = useCallback((patch: Partial<WizardDraft>) => {
    setDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetDraft = useCallback(() => setDraftState({}), []);

  const value = useMemo(
    () => ({ draft, setDraft, resetDraft }),
    [draft, setDraft, resetDraft]
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard deve ser usado dentro de WizardProvider');
  return ctx;
}
