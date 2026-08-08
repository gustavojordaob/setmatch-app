import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';
import type { FormatoPartidaId } from '../constants/formatosPartida';
import { criarPost } from './feed';

export type DesafioStatus = 'pendente' | 'aceito' | 'recusado' | 'finalizado';

export async function criarDesafio(input: {
  desafiante: string;
  desafianteNome: string;
  desafianteFoto?: string;
  desafiado: string;
  desafiadoNome: string;
  desafiadoFoto?: string;
  esporte: EsporteId;
  quadra?: string;
  clubeId?: string;
  clubeNome?: string;
  mensagem?: string;
  formato?: FormatoPartidaId;
  dataSugerida?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'desafios'), {
    desafiante: input.desafiante,
    desafianteNome: input.desafianteNome,
    desafianteFoto: input.desafianteFoto ?? '',
    desafiado: input.desafiado,
    desafiadoNome: input.desafiadoNome,
    desafiadoFoto: input.desafiadoFoto ?? '',
    esporte: input.esporte,
    quadra: input.quadra?.trim() || 'A combinar',
    clubeId: input.clubeId ?? '',
    clubeNome: input.clubeNome ?? '',
    mensagem: input.mensagem?.trim() || '',
    formato: input.formato ?? 'melhor_de_3_stb',
    dataSugerida: input.dataSugerida?.trim() || '',
    status: 'pendente' as DesafioStatus,
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function atualizarStatusDesafio(
  id: string,
  status: Exclude<DesafioStatus, 'pendente'>
): Promise<void> {
  await updateDoc(doc(db, 'desafios', id), {
    status,
    atualizadoEm: serverTimestamp(),
  });
}

export async function registrarPartidaDoDesafio(input: {
  desafioId: string;
  jogador1: string;
  jogador1Nome: string;
  jogador2: string;
  jogador2Nome: string;
  sets: { j1: number; j2: number }[];
  vencedor: string;
  esporte: EsporteId;
  quadra: string;
  clubeId?: string;
  clubeNome?: string;
  formato?: FormatoPartidaId;
}): Promise<string> {
  const partidaRef = await addDoc(collection(db, 'partidas'), {
    desafioId: input.desafioId,
    jogador1: input.jogador1,
    jogador1Nome: input.jogador1Nome,
    jogador2: input.jogador2,
    jogador2Nome: input.jogador2Nome,
    sets: input.sets,
    vencedor: input.vencedor,
    esporte: input.esporte,
    quadra: input.quadra,
    clubeId: input.clubeId ?? '',
    clubeNome: input.clubeNome ?? '',
    formato: input.formato ?? '',
    tipo: 'amistoso',
    dataPartida: serverTimestamp(),
  });

  await updateDoc(doc(db, 'desafios', input.desafioId), {
    status: 'finalizado',
    partidaId: partidaRef.id,
    atualizadoEm: serverTimestamp(),
  });

  const placar = input.sets.map((s) => `${s.j1}-${s.j2}`).join(', ');
  const vencedorNome =
    input.vencedor === input.jogador1 ? input.jogador1Nome : input.jogador2Nome;

  await criarPost({
    autorUid: input.jogador1,
    autorNome: input.jogador1Nome,
    texto: `🎾 Jogo finalizado: ${input.jogador1Nome} vs ${input.jogador2Nome}\nPlacar: ${placar}\nVencedor: ${vencedorNome}${
      input.clubeNome ? `\nClube: ${input.clubeNome}` : ''
    }`,
    esporte: input.esporte,
    clubeId: input.clubeId,
    tipo: 'resultado',
    partidaId: partidaRef.id,
  });

  const perdedor =
    input.vencedor === input.jogador1 ? input.jogador2 : input.jogador1;
  await updateDoc(doc(db, 'usuarios', input.vencedor), {
    vitorias: increment(1),
  });
  await updateDoc(doc(db, 'usuarios', perdedor), {
    derrotas: increment(1),
  });

  return partidaRef.id;
}

export async function buscarDesafio(id: string) {
  const snap = await getDoc(doc(db, 'desafios', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export type ConfrontoResumo = {
  id: string;
  placar: string;
  vencedorUid: string;
  dataLabel: string;
  euVenci: boolean;
};

/** Últimos confrontos diretos entre dois jogadores. */
export async function buscarConfrontosEntre(
  uidA: string,
  uidB: string,
  meuUid: string,
  limite = 5
): Promise<ConfrontoResumo[]> {
  const q1 = query(collection(db, 'partidas'), where('jogador1', '==', uidA));
  const snap = await getDocs(q1);
  const list: ConfrontoResumo[] = [];

  function pushFrom(raw: Record<string, unknown>, id: string) {
    const j1 = String(raw.jogador1 ?? '');
    const j2 = String(raw.jogador2 ?? '');
    if (!((j1 === uidA && j2 === uidB) || (j1 === uidB && j2 === uidA))) return;
    if (list.some((x) => x.id === id)) return;
    const sets = (raw.sets as { j1: number; j2: number }[]) ?? [];
    const placar = sets.map((s) => `${s.j1}-${s.j2}`).join(' · ') || '—';
    const vencedorUid = String(raw.vencedor ?? '');
    const sec = (raw.dataPartida as { seconds?: number } | undefined)?.seconds;
    const dataLabel = sec
      ? new Date(sec * 1000).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
        })
      : '';
    list.push({
      id,
      placar,
      vencedorUid,
      dataLabel,
      euVenci: vencedorUid === meuUid,
    });
  }

  for (const d of snap.docs) pushFrom(d.data(), d.id);

  const q2 = query(collection(db, 'partidas'), where('jogador2', '==', uidA));
  const snap2 = await getDocs(q2);
  for (const d of snap2.docs) pushFrom(d.data(), d.id);

  return list.slice(0, limite);
}

export type StatsJogador = {
  uid: string;
  nome: string;
  fotoUrl?: string;
  vitorias: number;
  derrotas: number;
  nivel?: string;
  cidade?: string;
};

export async function buscarStatsJogador(uid: string): Promise<StatsJogador | null> {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid,
    nome: String(d.nome ?? 'Jogador'),
    fotoUrl: d.fotoUrl ? String(d.fotoUrl) : undefined,
    vitorias: Number(d.vitorias ?? 0),
    derrotas: Number(d.derrotas ?? 0),
    nivel: d.nivel ? String(d.nivel) : undefined,
    cidade: d.cidade ? String(d.cidade) : undefined,
  };
}
