import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';

export interface Post {
  id: string;
  autorUid: string;
  autorNome: string;
  autorFoto?: string;
  texto: string;
  esporte?: EsporteId;
  clubeId?: string;
  tipo?: 'texto' | 'resultado' | 'convite';
  partidaId?: string;
  curtidas: number;
  curtidoPor: string[];
  criadoEm?: { seconds: number };
}

export function useFeed(max = 50) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('criadoEm', 'desc'), limit(max));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              autorUid: String(raw.autorUid ?? ''),
              autorNome: String(raw.autorNome ?? 'Jogador'),
              autorFoto: raw.autorFoto ? String(raw.autorFoto) : undefined,
              texto: String(raw.texto ?? ''),
              esporte: raw.esporte as EsporteId | undefined,
              clubeId: raw.clubeId ? String(raw.clubeId) : undefined,
              tipo: (raw.tipo as Post['tipo']) ?? 'texto',
              partidaId: raw.partidaId ? String(raw.partidaId) : undefined,
              curtidas: Number(raw.curtidas ?? 0),
              curtidoPor: (raw.curtidoPor as string[]) ?? [],
              criadoEm: raw.criadoEm as { seconds: number } | undefined,
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [max]);

  return { posts, loading };
}

/** Filtra posts por esporte (estrito), clube opcional e opcionalmente só de amigos (+ próprios). */
export function useFeedFiltrado(opts: {
  esporte: EsporteId;
  clubeId?: string | null;
  soAmigos?: boolean;
  amigoUids?: Set<string>;
  meuUid?: string;
}) {
  const { posts, loading } = useFeed();
  const filtrados = useMemo(() => {
    return posts.filter((p) => {
      const esp = p.esporte ?? 'tenis';
      if (esp !== opts.esporte) return false;
      if (opts.clubeId) {
        // Posts sem clube entram no feed geral; com clube só no clube ativo
        if (p.clubeId && p.clubeId !== opts.clubeId) return false;
      }
      if (!opts.soAmigos) return true;
      if (!opts.meuUid) return false;
      return p.autorUid === opts.meuUid || !!opts.amigoUids?.has(p.autorUid);
    });
  }, [posts, opts.esporte, opts.clubeId, opts.soAmigos, opts.amigoUids, opts.meuUid]);

  return { posts: filtrados, loading };
}
