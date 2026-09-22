import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';

export type PartidaResumo = {
  id: string;
  jogador1: string;
  jogador1Nome: string;
  jogador2: string;
  jogador2Nome: string;
  vencedor: string;
  placar: string;
  esporte?: EsporteId;
  tipo?: string;
  dataLabel: string;
  seconds: number;
};

async function partidasOnde(campo: 'jogador1' | 'jogador2', uid: string) {
  const snap = await getDocs(query(collection(db, 'partidas'), where(campo, '==', uid)));
  return snap.docs.map((d) => {
    const raw = d.data();
    const sets = (raw.sets as { j1: number; j2: number }[]) ?? [];
    const sec = (raw.dataPartida as { seconds?: number } | undefined)?.seconds ?? 0;
    return {
      id: d.id,
      jogador1: String(raw.jogador1 ?? ''),
      jogador1Nome: String(raw.jogador1Nome ?? 'Jogador'),
      jogador2: String(raw.jogador2 ?? ''),
      jogador2Nome: String(raw.jogador2Nome ?? 'Jogador'),
      vencedor: String(raw.vencedor ?? ''),
      placar: sets.map((s) => `${s.j1}-${s.j2}`).join(' · ') || '—',
      esporte: raw.esporte as EsporteId | undefined,
      tipo: raw.tipo ? String(raw.tipo) : undefined,
      dataLabel: sec
        ? new Date(sec * 1000).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
          })
        : '',
      seconds: sec,
    } satisfies PartidaResumo;
  });
}

export async function listarPartidasDoJogador(
  uid: string,
  limite = 12
): Promise<PartidaResumo[]> {
  const [a, b] = await Promise.all([
    partidasOnde('jogador1', uid),
    partidasOnde('jogador2', uid),
  ]);
  const map = new Map<string, PartidaResumo>();
  [...a, ...b].forEach((p) => map.set(p.id, p));
  return [...map.values()]
    .sort((x, y) => y.seconds - x.seconds)
    .slice(0, limite);
}

export async function jogadorFoiCampeao(uid: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, 'torneios'), where('campeaoUid', '==', uid))
  );
  return !snap.empty;
}
