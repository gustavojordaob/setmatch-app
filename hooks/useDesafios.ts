import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from './useAuth';

export type DesafioStatus = 'pendente' | 'aceito' | 'recusado' | 'finalizado';

export interface Desafio {
  id: string;
  desafiante: string;
  desafianteNome: string;
  desafianteFoto?: string;
  desafiado: string;
  desafiadoNome: string;
  desafiadoFoto?: string;
  esporte: string;
  quadra: string;
  status: DesafioStatus;
  formato?: string;
  mensagem?: string;
  dataSugerida?: string;
  clubeNome?: string;
  partidaId?: string;
  criadoEm?: { seconds: number };
}

function mergeDesafios(a: Desafio[], b: Desafio[]): Desafio[] {
  const map = new Map<string, Desafio>();
  [...a, ...b].forEach((d) => map.set(d.id, d));
  return Array.from(map.values()).sort((x, y) => {
    const tx = x.criadoEm?.seconds ?? 0;
    const ty = y.criadoEm?.seconds ?? 0;
    return ty - tx;
  });
}

function mapDoc(d: { id: string; data: () => Record<string, unknown> }): Desafio {
  const raw = d.data();
  return {
    id: d.id,
    desafiante: String(raw.desafiante ?? ''),
    desafianteNome: String(raw.desafianteNome ?? 'Jogador'),
    desafianteFoto: raw.desafianteFoto ? String(raw.desafianteFoto) : undefined,
    desafiado: String(raw.desafiado ?? ''),
    desafiadoNome: String(raw.desafiadoNome ?? 'Jogador'),
    desafiadoFoto: raw.desafiadoFoto ? String(raw.desafiadoFoto) : undefined,
    esporte: String(raw.esporte ?? ''),
    quadra: String(raw.quadra ?? ''),
    status: (raw.status as DesafioStatus) ?? 'pendente',
    formato: raw.formato ? String(raw.formato) : undefined,
    mensagem: raw.mensagem ? String(raw.mensagem) : undefined,
    dataSugerida: raw.dataSugerida ? String(raw.dataSugerida) : undefined,
    clubeNome: raw.clubeNome ? String(raw.clubeNome) : undefined,
    partidaId: raw.partidaId ? String(raw.partidaId) : undefined,
    criadoEm: raw.criadoEm as { seconds: number } | undefined,
  };
}

export function useDesafios() {
  const { user } = useAuth();
  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [loading, setLoading] = useState(true);
  const [chunkA, setChunkA] = useState<Desafio[]>([]);
  const [chunkB, setChunkB] = useState<Desafio[]>([]);

  useEffect(() => {
    if (!user) {
      setChunkA([]);
      setChunkB([]);
      setDesafios([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const qA = query(collection(db, 'desafios'), where('desafiante', '==', user.uid));
    const qB = query(collection(db, 'desafios'), where('desafiado', '==', user.uid));

    let unsubA: Unsubscribe | undefined;
    let unsubB: Unsubscribe | undefined;

    unsubA = onSnapshot(qA, (snap) => setChunkA(snap.docs.map((d) => mapDoc(d))));
    unsubB = onSnapshot(qB, (snap) => setChunkB(snap.docs.map((d) => mapDoc(d))));

    return () => {
      unsubA?.();
      unsubB?.();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setDesafios(mergeDesafios(chunkA, chunkB));
    setLoading(false);
  }, [chunkA, chunkB, user]);

  const meuUid = user?.uid;

  /** Convites recebidos aguardando minha resposta. */
  const recebidosPendentes = useMemo(
    () => desafios.filter((d) => d.status === 'pendente' && d.desafiado === meuUid),
    [desafios, meuUid]
  );

  const enviadosPendentes = useMemo(
    () => desafios.filter((d) => d.status === 'pendente' && d.desafiante === meuUid),
    [desafios, meuUid]
  );

  const agendados = useMemo(
    () => desafios.filter((d) => d.status === 'aceito'),
    [desafios]
  );

  const historico = useMemo(
    () => desafios.filter((d) => d.status === 'finalizado' || d.status === 'recusado'),
    [desafios]
  );

  return {
    desafios,
    loading,
    recebidosPendentes,
    enviadosPendentes,
    agendados,
    historico,
  };
}
