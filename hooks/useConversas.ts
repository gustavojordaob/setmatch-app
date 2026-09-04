import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from './useAuth';

export interface Conversa {
  id: string;
  tipo: 'amigo' | 'clube';
  participantes: string[];
  nomes?: Record<string, string>;
  fotos?: Record<string, string>;
  clubeId?: string;
  clubeNome?: string;
  ultimoTexto: string;
  ultimoDeUid?: string;
  /** Contagem de não lidas por uid do participante. */
  naoLidas?: Record<string, number>;
  atualizadoEm?: { seconds: number };
}

export function naoLidasDaConversa(c: Conversa, uid?: string | null): number {
  if (!uid) return 0;
  const n = Number(c.naoLidas?.[uid] ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function totalNaoLidas(conversas: Conversa[], uid?: string | null): number {
  if (!uid) return 0;
  return conversas.reduce((acc, c) => acc + naoLidasDaConversa(c, uid), 0);
}

export interface Mensagem {
  id: string;
  deUid: string;
  deNome: string;
  texto: string;
  criadoEm?: { seconds: number };
}

export function useConversas() {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<Conversa[]>([]);

  useEffect(() => {
    if (!user) {
      setConversas([]);
      return;
    }
    const q = query(
      collection(db, 'conversas'),
      where('participantes', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            tipo: (raw.tipo as Conversa['tipo']) ?? 'amigo',
            participantes: (raw.participantes as string[]) ?? [],
            nomes: raw.nomes as Record<string, string> | undefined,
            fotos: raw.fotos as Record<string, string> | undefined,
            clubeId: raw.clubeId ? String(raw.clubeId) : undefined,
            clubeNome: raw.clubeNome ? String(raw.clubeNome) : undefined,
            ultimoTexto: String(raw.ultimoTexto ?? ''),
            ultimoDeUid: raw.ultimoDeUid ? String(raw.ultimoDeUid) : undefined,
            naoLidas: (raw.naoLidas as Record<string, number> | undefined) ?? {},
            atualizadoEm: raw.atualizadoEm as { seconds: number } | undefined,
          };
        });
        list.sort((a, b) => (b.atualizadoEm?.seconds ?? 0) - (a.atualizadoEm?.seconds ?? 0));
        setConversas(list);
      },
      () => setConversas([])
    );
    return unsub;
  }, [user]);

  return conversas;
}

export function useMensagens(conversaId: string | null) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);

  useEffect(() => {
    if (!conversaId) {
      setMensagens([]);
      return;
    }
    const q = query(
      collection(db, 'conversas', conversaId, 'mensagens'),
      orderBy('criadoEm', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMensagens(
        snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            deUid: String(raw.deUid ?? ''),
            deNome: String(raw.deNome ?? ''),
            texto: String(raw.texto ?? ''),
            criadoEm: raw.criadoEm as { seconds: number } | undefined,
          };
        })
      );
    });
    return unsub;
  }, [conversaId]);

  return mensagens;
}
