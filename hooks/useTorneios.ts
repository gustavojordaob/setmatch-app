import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';
import type { Torneio } from '../services/torneios';

export function useTorneios(esporte: EsporteId) {
  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'torneios'), where('esporte', '==', esporte));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTorneios(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              clubeId: String(raw.clubeId ?? ''),
              clubeNome: String(raw.clubeNome ?? ''),
              cidade: String(raw.cidade ?? ''),
              nome: String(raw.nome ?? ''),
              esporte: (raw.esporte as EsporteId) ?? esporte,
              dataInicio: raw.dataInicio ? String(raw.dataInicio) : undefined,
              dataFim: raw.dataFim ? String(raw.dataFim) : undefined,
              descricao: raw.descricao ? String(raw.descricao) : undefined,
              local: raw.local ? String(raw.local) : undefined,
              donoUid: String(raw.donoUid ?? ''),
              status: (raw.status as Torneio['status']) ?? 'aberto',
              totalInscritos: Number(raw.totalInscritos ?? 0),
              pagamento: raw.pagamento
                ? {
                    ativo: Boolean((raw.pagamento as { ativo?: boolean }).ativo),
                    valor: Number((raw.pagamento as { valor?: number }).valor ?? 0),
                    regras: String((raw.pagamento as { regras?: string }).regras ?? ''),
                    prazoPagamento: (raw.pagamento as { prazoPagamento?: string }).prazoPagamento
                      ? String((raw.pagamento as { prazoPagamento?: string }).prazoPagamento)
                      : undefined,
                    permitePix: Boolean(
                      (raw.pagamento as { permitePix?: boolean }).permitePix ?? true
                    ),
                    permiteCartao: Boolean(
                      (raw.pagamento as { permiteCartao?: boolean }).permiteCartao ?? true
                    ),
                    descontoPixPercent: Number(
                      (raw.pagamento as { descontoPixPercent?: number }).descontoPixPercent ?? 0
                    ),
                    descontoCartaoPercent: Number(
                      (raw.pagamento as { descontoCartaoPercent?: number }).descontoCartaoPercent ??
                        0
                    ),
                  }
                : undefined,
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [esporte]);

  return { torneios, loading };
}

export function usePartidasAmigos(amigoUids: Set<string>, esporte?: EsporteId) {
  const [partidas, setPartidas] = useState<
    {
      id: string;
      jogador1: string;
      jogador2: string;
      jogador1Nome?: string;
      jogador2Nome?: string;
      vencedor: string;
      esporte: string;
      sets: { j1: number; j2: number }[];
      tipo?: string;
      dataPartida?: { seconds: number };
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const reloadKey = useCallback(() => Array.from(amigoUids).sort().join(','), [amigoUids]);

  useEffect(() => {
    if (amigoUids.size === 0) {
      setPartidas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'partidas'), orderBy('dataPartida', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              jogador1: String(raw.jogador1 ?? ''),
              jogador2: String(raw.jogador2 ?? ''),
              jogador1Nome: raw.jogador1Nome ? String(raw.jogador1Nome) : undefined,
              jogador2Nome: raw.jogador2Nome ? String(raw.jogador2Nome) : undefined,
              vencedor: String(raw.vencedor ?? ''),
              esporte: String(raw.esporte ?? ''),
              sets: (raw.sets as { j1: number; j2: number }[]) ?? [],
              tipo: raw.tipo ? String(raw.tipo) : undefined,
              dataPartida: raw.dataPartida as { seconds: number } | undefined,
            };
          })
          .filter((p) => {
            const amigoJogou = amigoUids.has(p.jogador1) || amigoUids.has(p.jogador2);
            if (!amigoJogou) return false;
            if (esporte) {
              const esp = p.esporte || 'tenis';
              if (esp !== esporte) return false;
            }
            return true;
          })
          .slice(0, 20);
        setPartidas(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [amigoUids, esporte, reloadKey]);

  return { partidas, loading };
}
