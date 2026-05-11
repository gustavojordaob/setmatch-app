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

export interface SetPlacar {
  j1: number;
  j2: number;
}

export interface Partida {
  id: string;
  desafioId: string;
  jogador1: string;
  jogador2: string;
  sets: SetPlacar[];
  vencedor: string;
  esporte: string;
  quadra: string;
}

function mergePartidas(a: Partida[], b: Partida[]): Partida[] {
  const map = new Map<string, Partida>();
  [...a, ...b].forEach((p) => map.set(p.id, p));
  return Array.from(map.values());
}

export function usePartidas() {
  const { user } = useAuth();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [loading, setLoading] = useState(true);
  const [chunkA, setChunkA] = useState<Partida[]>([]);
  const [chunkB, setChunkB] = useState<Partida[]>([]);

  useEffect(() => {
    if (!user) {
      setChunkA([]);
      setChunkB([]);
      setPartidas([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const qA = query(collection(db, 'partidas'), where('jogador1', '==', user.uid));
    const qB = query(collection(db, 'partidas'), where('jogador2', '==', user.uid));

    const mapDoc = (d: { id: string; data: () => Record<string, unknown> }): Partida => {
      const raw = d.data();
      return {
        id: d.id,
        desafioId: String(raw.desafioId ?? ''),
        jogador1: String(raw.jogador1 ?? ''),
        jogador2: String(raw.jogador2 ?? ''),
        sets: (raw.sets as SetPlacar[]) ?? [],
        vencedor: String(raw.vencedor ?? ''),
        esporte: String(raw.esporte ?? ''),
        quadra: String(raw.quadra ?? ''),
      };
    };

    const unsubA = onSnapshot(qA, (snap) => setChunkA(snap.docs.map((d) => mapDoc(d))));
    const unsubB = onSnapshot(qB, (snap) => setChunkB(snap.docs.map((d) => mapDoc(d))));

    return () => {
      unsubA();
      unsubB();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setPartidas(mergePartidas(chunkA, chunkB));
    setLoading(false);
  }, [chunkA, chunkB, user]);

  return { partidas, loading };
}
