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
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useEsporte } from './EsporteContext';
import { useMeusClubes, type MeuClubeResumo } from '../hooks/useMeusClubes';
import type { EsporteId } from '../constants/esportes';

const STORAGE_KEY = '@setmatch/clubeAtivoId';

export type ClubeOpcao = {
  id: string;
  nome: string;
  cidade: string;
  esportes: EsporteId[];
  donoUid?: string;
  vinculo?: boolean;
};

interface ClubeContextValue {
  clubeAtivoId: string | null;
  clubeAtivo: ClubeOpcao | null;
  setClubeAtivoId: (id: string | null) => void;
  clubesDisponiveis: ClubeOpcao[];
  meusClubes: MeuClubeResumo[];
  ready: boolean;
  loading: boolean;
}

const ClubeContext = createContext<ClubeContextValue | undefined>(undefined);

export function ClubeProvider({ children }: { children: ReactNode }) {
  const { esporteAtivo } = useEsporte();
  const { clubes: meusClubes, loading: loadMeus } = useMeusClubes();
  const [clubeAtivoId, setClubeAtivoIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [clubesPublicos, setClubesPublicos] = useState<ClubeOpcao[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setClubeAtivoIdState(saved);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const q = query(
          collection(db, 'clubes'),
          where('esportes', 'array-contains', esporteAtivo),
          limit(40)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        setClubesPublicos(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              nome: String(raw.nome ?? 'Clube'),
              cidade: String(raw.cidade ?? ''),
              esportes: (raw.esportes as EsporteId[]) ?? [esporteAtivo],
              donoUid: raw.donoUid ? String(raw.donoUid) : undefined,
              vinculo: false,
            };
          })
        );
      } catch {
        // Sem índice / docs legados: lista geral e filtra no client
        try {
          const snap = await getDocs(query(collection(db, 'clubes'), limit(60)));
          if (cancelled) return;
          setClubesPublicos(
            snap.docs
              .map((d) => {
                const raw = d.data();
                const esportes =
                  (raw.esportes as EsporteId[]) ??
                  ([raw.esporte].filter(Boolean) as EsporteId[]);
                return {
                  id: d.id,
                  nome: String(raw.nome ?? 'Clube'),
                  cidade: String(raw.cidade ?? ''),
                  esportes: esportes.length ? esportes : (['tenis'] as EsporteId[]),
                  donoUid: raw.donoUid ? String(raw.donoUid) : undefined,
                  vinculo: false,
                };
              })
              .filter((c) => c.esportes.includes(esporteAtivo))
          );
        } catch {
          if (!cancelled) setClubesPublicos([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [esporteAtivo]);

  const clubesDisponiveis = useMemo(() => {
    const map = new Map<string, ClubeOpcao>();
    clubesPublicos.forEach((c) => map.set(c.id, c));
    meusClubes
      .filter((c) => c.esportes.includes(esporteAtivo) || c.esportes.length === 0)
      .forEach((c) => {
        map.set(c.id, {
          id: c.id,
          nome: c.nome,
          cidade: c.cidade,
          esportes: c.esportes,
          donoUid: c.donoUid,
          vinculo: true,
        });
      });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [clubesPublicos, meusClubes, esporteAtivo]);

  const setClubeAtivoId = useCallback((id: string | null) => {
    setClubeAtivoIdState(id);
    if (id) void AsyncStorage.setItem(STORAGE_KEY, id);
    else void AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  // Se clube salvo não existe na lista do esporte, limpa seleção
  useEffect(() => {
    if (!ready || !clubeAtivoId) return;
    if (clubesDisponiveis.length === 0) return;
    const ok = clubesDisponiveis.some((c) => c.id === clubeAtivoId);
    if (!ok) setClubeAtivoId(null);
  }, [ready, clubeAtivoId, clubesDisponiveis, setClubeAtivoId]);

  const clubeAtivo = useMemo(
    () => clubesDisponiveis.find((c) => c.id === clubeAtivoId) ?? null,
    [clubesDisponiveis, clubeAtivoId]
  );

  const value = useMemo(
    () => ({
      clubeAtivoId,
      clubeAtivo,
      setClubeAtivoId,
      clubesDisponiveis,
      meusClubes,
      ready,
      loading: loadMeus,
    }),
    [
      clubeAtivoId,
      clubeAtivo,
      setClubeAtivoId,
      clubesDisponiveis,
      meusClubes,
      ready,
      loadMeus,
    ]
  );

  return <ClubeContext.Provider value={value}>{children}</ClubeContext.Provider>;
}

export function useClube() {
  const ctx = useContext(ClubeContext);
  if (!ctx) throw new Error('useClube deve ser usado dentro de ClubeProvider');
  return ctx;
}
