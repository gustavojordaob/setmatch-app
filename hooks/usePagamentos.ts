import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from './useAuth';
import type { PagamentoDoc, StatusPagamento, TipoPagamento } from '../types/pagamento';

function mapPagamento(id: string, raw: Record<string, unknown>): PagamentoDoc {
  return {
    id,
    uid: String(raw.uid ?? ''),
    setmatchId: String(raw.setmatchId ?? ''),
    nome: String(raw.nome ?? ''),
    telefone: raw.telefone ? String(raw.telefone) : undefined,
    tipo: (raw.tipo as TipoPagamento) ?? 'aula',
    clubeId: String(raw.clubeId ?? ''),
    clubeNome: String(raw.clubeNome ?? ''),
    donoUid: String(raw.donoUid ?? ''),
    rankingId: raw.rankingId ? String(raw.rankingId) : undefined,
    rankingNome: raw.rankingNome ? String(raw.rankingNome) : undefined,
    torneioId: raw.torneioId ? String(raw.torneioId) : undefined,
    torneioNome: raw.torneioNome ? String(raw.torneioNome) : undefined,
    valor: Number(raw.valor ?? 0),
    ciclo: (raw.ciclo as PagamentoDoc['ciclo']) ?? 'unico',
    status: (raw.status as StatusPagamento) ?? 'pendente',
    preferenceId: raw.preferenceId ? String(raw.preferenceId) : undefined,
    paymentId: raw.paymentId ? String(raw.paymentId) : undefined,
    vigenteAte: raw.vigenteAte as { seconds: number } | undefined,
    liberadoPeloAdmin: Boolean(raw.liberadoPeloAdmin),
    criadoEm: raw.criadoEm as { seconds: number } | undefined,
  };
}

export function useMeusPagamentos() {
  const { user } = useAuth();
  const [pagamentos, setPagamentos] = useState<PagamentoDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPagamentos([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'pagamentos'), where('uid', '==', user.uid));
    return onSnapshot(
      q,
      (snap) => {
        setPagamentos(snap.docs.map((d) => mapPagamento(d.id, d.data())));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [user]);

  return { pagamentos, loading };
}

export function usePagamentosDoClube(clubeId?: string) {
  const [pagamentos, setPagamentos] = useState<PagamentoDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubeId) {
      setPagamentos([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'pagamentos'), where('clubeId', '==', clubeId));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => mapPagamento(d.id, d.data()));
        list.sort((a, b) => (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0));
        setPagamentos(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [clubeId]);

  return { pagamentos, loading };
}

export function useMatriculasDoClube(clubeId?: string) {
  const [matriculas, setMatriculas] = useState<
    {
      id: string;
      uid: string;
      setmatchId: string;
      nome: string;
      telefone?: string;
      status: string;
      modalidadeNome?: string;
      descontoPercent?: number;
      valorFinal?: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubeId) {
      setMatriculas([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'matriculas'), where('clubeId', '==', clubeId));
    return onSnapshot(
      q,
      (snap) => {
        setMatriculas(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              uid: String(raw.uid ?? ''),
              setmatchId: String(raw.setmatchId ?? ''),
              nome: String(raw.nome ?? ''),
              telefone: raw.telefone ? String(raw.telefone) : undefined,
              status: String(raw.status ?? 'pendente'),
              modalidadeNome: raw.modalidadeNome ? String(raw.modalidadeNome) : undefined,
              descontoPercent:
                raw.descontoPercent != null ? Number(raw.descontoPercent) : undefined,
              valorFinal: raw.valorFinal != null ? Number(raw.valorFinal) : undefined,
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [clubeId]);

  return { matriculas, loading };
}
