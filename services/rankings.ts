import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';
import type { Solicitacao } from '../types/ranking';

interface CriarClubeInput {
  nome: string;
  cidade: string;
  esporte: EsporteId;
  donoUid: string;
  donoNome: string;
  donoFotoUrl?: string;
  rankingNome: string;
}

/** Dono de academia cria um clube + o primeiro ranking, entrando como membro inicial. */
export async function criarClubeComRanking(input: CriarClubeInput): Promise<{
  clubeId: string;
  rankingId: string;
}> {
  const clubeRef = await addDoc(collection(db, 'clubes'), {
    nome: input.nome.trim(),
    cidade: input.cidade.trim(),
    esporte: input.esporte,
    donoUid: input.donoUid,
    donoNome: input.donoNome,
    criadoEm: serverTimestamp(),
  });

  const rankingRef = await addDoc(collection(db, 'rankings'), {
    nome: input.rankingNome.trim(),
    clubeId: clubeRef.id,
    clubeNome: input.nome.trim(),
    cidade: input.cidade.trim(),
    esporte: input.esporte,
    donoUid: input.donoUid,
    membros: [input.donoUid],
    totalMembros: 1,
    criadoEm: serverTimestamp(),
  });

  await setDoc(doc(db, 'rankings', rankingRef.id, 'classificacao', input.donoUid), {
    uid: input.donoUid,
    nome: input.donoNome,
    fotoUrl: input.donoFotoUrl ?? '',
    pts: 0,
    vitorias: 0,
    derrotas: 0,
  });

  return { clubeId: clubeRef.id, rankingId: rankingRef.id };
}

interface SolicitarInput {
  rankingId: string;
  rankingNome: string;
  clubeId: string;
  clubeNome: string;
  donoUid: string;
  uid: string;
  nome: string;
  fotoUrl?: string;
}

/** Jogador solicita entrada num ranking. Evita duplicar solicitação pendente. */
export async function solicitarEntrada(input: SolicitarInput): Promise<void> {
  const existentes = await getDocs(
    query(
      collection(db, 'solicitacoes'),
      where('rankingId', '==', input.rankingId),
      where('uid', '==', input.uid)
    )
  );
  const pendenteOuAceita = existentes.docs.some((d) => {
    const s = d.data().status;
    return s === 'pendente' || s === 'aceito';
  });
  if (pendenteOuAceita) return;

  await addDoc(collection(db, 'solicitacoes'), {
    rankingId: input.rankingId,
    rankingNome: input.rankingNome,
    clubeId: input.clubeId,
    clubeNome: input.clubeNome,
    donoUid: input.donoUid,
    uid: input.uid,
    nome: input.nome,
    fotoUrl: input.fotoUrl ?? '',
    status: 'pendente',
    criadoEm: serverTimestamp(),
  });
}

/** Dono aceita solicitação: adiciona o jogador aos membros + cria a classificação. */
export async function aceitarSolicitacao(sol: Solicitacao): Promise<void> {
  await updateDoc(doc(db, 'solicitacoes', sol.id), { status: 'aceito' });

  await updateDoc(doc(db, 'rankings', sol.rankingId), {
    membros: arrayUnion(sol.uid),
    totalMembros: increment(1),
  });

  const classRef = doc(db, 'rankings', sol.rankingId, 'classificacao', sol.uid);
  const existe = await getDoc(classRef);
  if (!existe.exists()) {
    await setDoc(classRef, {
      uid: sol.uid,
      nome: sol.nome,
      fotoUrl: sol.fotoUrl ?? '',
      pts: 0,
      vitorias: 0,
      derrotas: 0,
    });
  }
}

export async function recusarSolicitacao(solId: string): Promise<void> {
  await updateDoc(doc(db, 'solicitacoes', solId), { status: 'recusado' });
}
