import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from './useAuth';
import type { Classificacao, Ranking, Solicitacao } from '../types/ranking';
import type { EsporteId } from '../constants/esportes';

function mapRanking(d: { id: string; data: () => Record<string, unknown> }): Ranking {
  const raw = d.data();
  return {
    id: d.id,
    nome: String(raw.nome ?? ''),
    clubeId: String(raw.clubeId ?? ''),
    clubeNome: String(raw.clubeNome ?? ''),
    cidade: String(raw.cidade ?? ''),
    esporte: (raw.esporte as EsporteId) ?? 'tenis',
    donoUid: String(raw.donoUid ?? ''),
    descricao: raw.descricao ? String(raw.descricao) : undefined,
    membros: (raw.membros as string[]) ?? [],
    totalMembros: Number(raw.totalMembros ?? 0),
    pagamento: raw.pagamento
      ? {
          ativo: Boolean((raw.pagamento as { ativo?: boolean }).ativo),
          valor: Number((raw.pagamento as { valor?: number }).valor ?? 0),
          ciclo: ((raw.pagamento as { ciclo?: string }).ciclo as 'unico' | 'mensal') ?? 'mensal',
          regras: String((raw.pagamento as { regras?: string }).regras ?? ''),
          exigeParaEntrar: Boolean((raw.pagamento as { exigeParaEntrar?: boolean }).exigeParaEntrar),
          permitePix: Boolean((raw.pagamento as { permitePix?: boolean }).permitePix ?? true),
          permiteCartao: Boolean((raw.pagamento as { permiteCartao?: boolean }).permiteCartao ?? true),
          descontoPixPercent: Number(
            (raw.pagamento as { descontoPixPercent?: number }).descontoPixPercent ?? 0
          ),
          descontoCartaoPercent: Number(
            (raw.pagamento as { descontoCartaoPercent?: number }).descontoCartaoPercent ?? 0
          ),
        }
      : undefined,
    criadoEm: raw.criadoEm as { seconds: number } | undefined,
  };
}

/** Todos os rankings + separação: os meus (sou membro) e os próximos (posso solicitar). */
export function useRankings() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rankings'), (snap) => {
      setTodos(snap.docs.map(mapRanking));
      setLoading(false);
    });
    return unsub;
  }, []);

  const meus = useMemo(
    () => (user ? todos.filter((r) => r.membros.includes(user.uid)) : []),
    [todos, user]
  );
  const proximos = useMemo(
    () => (user ? todos.filter((r) => !r.membros.includes(user.uid)) : todos),
    [todos, user]
  );

  return { todos, meus, proximos, loading };
}

/** Solicitações feitas pelo usuário logado (para mostrar "pendente"). */
export function useMinhasSolicitacoes() {
  const { user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);

  useEffect(() => {
    if (!user) {
      setSolicitacoes([]);
      return;
    }
    const q = query(collection(db, 'solicitacoes'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setSolicitacoes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Solicitacao)));
    });
    return unsub;
  }, [user]);

  return solicitacoes;
}

/** Solicitações pendentes recebidas pelo dono (para aceitar/recusar). */
export function useSolicitacoesRecebidas() {
  const { user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);

  useEffect(() => {
    if (!user) {
      setSolicitacoes([]);
      return;
    }
    const q = query(
      collection(db, 'solicitacoes'),
      where('donoUid', '==', user.uid),
      where('status', '==', 'pendente')
    );
    const unsub = onSnapshot(q, (snap) => {
      setSolicitacoes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Solicitacao)));
    });
    return unsub;
  }, [user]);

  return solicitacoes;
}

/** Classificação (jogadores + pontos) de um ranking, ordenada por pts desc. */
export function useClassificacao(rankingId: string | null) {
  const [rows, setRows] = useState<Classificacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rankingId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'rankings', rankingId, 'classificacao'),
      orderBy('pts', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => d.data() as Classificacao));
      setLoading(false);
    });
    return unsub;
  }, [rankingId]);

  return { rows, loading };
}
