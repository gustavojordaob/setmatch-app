import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from './useAuth';
import { useRankings } from './useRankings';
import type { ClubeCompleto } from '../services/clubes';
import type { EsporteId } from '../constants/esportes';

export type MeuClubeResumo = {
  id: string;
  nome: string;
  cidade: string;
  telefone?: string;
  esportes: EsporteId[];
  aulas?: ClubeCompleto['aulas'];
  regrasGerais?: string;
  donoUid: string;
  /** Por que o usuário está ligado a este clube */
  vinculos: Array<'ranking' | 'aula' | 'pagamento'>;
  rankingIds: string[];
  rankingNomes: string[];
};

function mapClube(id: string, raw: Record<string, unknown>): Omit<MeuClubeResumo, 'vinculos' | 'rankingIds' | 'rankingNomes'> {
  const esportes = (raw.esportes as EsporteId[]) ??
    (raw.esporte ? [raw.esporte as EsporteId] : ['tenis']);
  return {
    id,
    nome: String(raw.nome ?? 'Clube'),
    cidade: String(raw.cidade ?? ''),
    telefone: raw.telefone ? String(raw.telefone) : undefined,
    esportes,
    aulas: raw.aulas as ClubeCompleto['aulas'],
    regrasGerais: raw.regrasGerais ? String(raw.regrasGerais) : undefined,
    donoUid: String(raw.donoUid ?? ''),
  };
}

/** Clubes onde o jogador tem ranking, matrícula ou pagamento. */
export function useMeusClubes() {
  const { user } = useAuth();
  const { meus: meusRankings } = useRankings();
  const [matriculas, setMatriculas] = useState<
    {
      id: string;
      clubeId: string;
      clubeNome: string;
      donoUid?: string;
      status: string;
      modalidadeNome?: string;
      valorFinal?: number;
      pagamentoId?: string;
    }[]
  >([]);
  const [pagClubeIds, setPagClubeIds] = useState<string[]>([]);
  const [clubesMap, setClubesMap] = useState<Record<string, MeuClubeResumo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMatriculas([]);
      return;
    }
    const q = query(collection(db, 'matriculas'), where('uid', '==', user.uid));
    return onSnapshot(
      q,
      (snap) => {
        setMatriculas(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              clubeId: String(raw.clubeId ?? ''),
              clubeNome: String(raw.clubeNome ?? ''),
              donoUid: raw.donoUid ? String(raw.donoUid) : undefined,
              status: String(raw.status ?? 'pendente'),
              modalidadeNome: raw.modalidadeNome
                ? String(raw.modalidadeNome)
                : undefined,
              valorFinal:
                raw.valorFinal != null ? Number(raw.valorFinal) : undefined,
              pagamentoId: raw.pagamentoId
                ? String(raw.pagamentoId)
                : undefined,
            };
          })
        );
      },
      () => setMatriculas([])
    );
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPagClubeIds([]);
      return;
    }
    const q = query(collection(db, 'pagamentos'), where('uid', '==', user.uid));
    return onSnapshot(
      q,
      (snap) => {
        const ids = new Set<string>();
        snap.docs.forEach((d) => {
          const cid = String(d.data().clubeId ?? '');
          if (cid) ids.add(cid);
        });
        setPagClubeIds([...ids]);
      },
      () => setPagClubeIds([])
    );
  }, [user]);

  const idsNecessarios = useMemo(() => {
    const s = new Set<string>();
    meusRankings.forEach((r) => {
      if (r.clubeId) s.add(r.clubeId);
    });
    matriculas.forEach((m) => {
      if (m.clubeId) s.add(m.clubeId);
    });
    pagClubeIds.forEach((id) => s.add(id));
    return [...s];
  }, [meusRankings, matriculas, pagClubeIds]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (idsNecessarios.length === 0) {
        setClubesMap({});
        setLoading(false);
        return;
      }
      setLoading(true);
      const next: Record<string, MeuClubeResumo> = {};
      await Promise.all(
        idsNecessarios.map(async (id) => {
          const snap = await getDoc(doc(db, 'clubes', id));
          if (!snap.exists()) return;
          const base = mapClube(snap.id, snap.data() as Record<string, unknown>);
          const rankingsDoClube = meusRankings.filter((r) => r.clubeId === id);
          const temAula = matriculas.some((m) => m.clubeId === id);
          const temPag = pagClubeIds.includes(id);
          const vinculos: MeuClubeResumo['vinculos'] = [];
          if (rankingsDoClube.length) vinculos.push('ranking');
          if (temAula) vinculos.push('aula');
          if (temPag) vinculos.push('pagamento');
          if (vinculos.length === 0) vinculos.push('pagamento');
          next[id] = {
            ...base,
            vinculos,
            rankingIds: rankingsDoClube.map((r) => r.id),
            rankingNomes: rankingsDoClube.map((r) => r.nome),
          };
        })
      );
      if (!cancelled) {
        setClubesMap(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idsNecessarios, meusRankings, matriculas, pagClubeIds]);

  const clubes = useMemo(() => Object.values(clubesMap), [clubesMap]);

  return { clubes, loading, matriculas };
}
