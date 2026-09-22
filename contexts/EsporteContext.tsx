import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ESPORTES, type EsporteId } from '../constants/esportes';

const STORAGE_KEY = '@setmatch/esporteAtivo';

interface EsporteContextValue {
  esporteAtivo: EsporteId;
  setEsporteAtivo: (id: EsporteId) => void;
  esporteIndex: number;
  setEsporteIndex: (i: number) => void;
  ready: boolean;
}

const EsporteContext = createContext<EsporteContextValue | undefined>(undefined);

function isEsporteId(v: string): v is EsporteId {
  return ESPORTES.some((e) => e.id === v);
}

export function EsporteProvider({ children }: { children: ReactNode }) {
  const [esporteAtivo, setEsporteAtivoState] = useState<EsporteId>('tenis');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && isEsporteId(saved)) setEsporteAtivoState(saved);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setEsporteAtivo = useCallback((id: EsporteId) => {
    setEsporteAtivoState(id);
    void AsyncStorage.setItem(STORAGE_KEY, id);
  }, []);

  const esporteIndex = ESPORTES.findIndex((e) => e.id === esporteAtivo);

  const setEsporteIndex = useCallback(
    (i: number) => {
      const e = ESPORTES[i];
      if (e) setEsporteAtivo(e.id);
    },
    [setEsporteAtivo]
  );

  const value = useMemo(
    () => ({
      esporteAtivo,
      setEsporteAtivo,
      esporteIndex: esporteIndex < 0 ? 0 : esporteIndex,
      setEsporteIndex,
      ready,
    }),
    [esporteAtivo, esporteIndex, setEsporteAtivo, setEsporteIndex, ready]
  );

  return <EsporteContext.Provider value={value}>{children}</EsporteContext.Provider>;
}

export function useEsporte() {
  const ctx = useContext(EsporteContext);
  if (!ctx) throw new Error('useEsporte deve ser usado dentro de EsporteProvider');
  return ctx;
}

/** Compara esporte do item com o ativo. Sem campo = não entra no filtro (estrito). */
export function esporteBate(itemEsporte: string | undefined | null, ativo: EsporteId): boolean {
  if (!itemEsporte) return false;
  return itemEsporte === ativo;
}
