import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from './useAuth';
import type { TipoPartida } from '../types/ranking';

export interface SetPlacar {
  j1: number;
  j2: number;
}

export interface Partida {
  id: string;
  desafioId: string;
  jogador1: string;
  jogador2: string;
  jogador1Nome?: string;
  jogador2Nome?: string;
  sets: SetPlacar[];
  vencedor: string;
  esporte: string;
  quadra: string;
  tipo?: TipoPartida;
  rankingId?: string;
  clubeId?: string;
  dataPartida?: { seconds: number };
}

function mergePartidas(a: Partida[], b: Partida[]): Partida[] {
  const map = new Map<string, Partida>();
  [...a, ...b].forEach((p) => map.set(p.id, p));
  return Array.from(map.values()).sort((x, y) => {
    const tx = x.dataPartida?.seconds ?? 0;
    const ty = y.dataPartida?.seconds ?? 0;
    return ty - tx;
  });
}

function mapDoc(d: { id: string; data: () => Record<string, unknown> }): Partida {
  const raw = d.data();
  return {
    id: d.id,
    desafioId: String(raw.desafioId ?? ''),
    jogador1: String(raw.jogador1 ?? ''),
    jogador2: String(raw.jogador2 ?? ''),
    jogador1Nome: raw.jogador1Nome ? String(raw.jogador1Nome) : undefined,
    jogador2Nome: raw.jogador2Nome ? String(raw.jogador2Nome) : undefined,
    sets: (raw.sets as SetPlacar[]) ?? [],
    vencedor: String(raw.vencedor ?? ''),
    esporte: String(raw.esporte ?? ''),
    quadra: String(raw.quadra ?? ''),
    tipo: raw.tipo as TipoPartida | undefined,
    rankingId: raw.rankingId ? String(raw.rankingId) : undefined,
    clubeId: raw.clubeId ? String(raw.clubeId) : undefined,
    dataPartida: raw.dataPartida as { seconds: number } | undefined,
  };
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

export function formatDataPartida(p: Partida): string {
  if (!p.dataPartida?.seconds) return '';
  const d = new Date(p.dataPartida.seconds * 1000);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
