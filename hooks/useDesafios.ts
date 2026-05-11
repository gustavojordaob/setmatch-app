import { useEffect, useState } from 'react';
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
  desafiado: string;
  esporte: string;
  quadra: string;
  status: DesafioStatus;
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

    const mapDoc = (d: { id: string; data: () => Record<string, unknown> }): Desafio => {
      const raw = d.data();
      return {
        id: d.id,
        desafiante: String(raw.desafiante ?? ''),
        desafiado: String(raw.desafiado ?? ''),
        esporte: String(raw.esporte ?? ''),
        quadra: String(raw.quadra ?? ''),
        status: (raw.status as DesafioStatus) ?? 'pendente',
        criadoEm: raw.criadoEm as { seconds: number } | undefined,
      };
    };

    let unsubA: Unsubscribe | undefined;
    let unsubB: Unsubscribe | undefined;

    unsubA = onSnapshot(qA, (snap) => {
      setChunkA(snap.docs.map((d) => mapDoc(d)));
    });
    unsubB = onSnapshot(qB, (snap) => {
      setChunkB(snap.docs.map((d) => mapDoc(d)));
    });

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

  return { desafios, loading };
}
