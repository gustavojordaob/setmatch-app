import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { gerarCodigoSetmatch, normalizarSetmatchId } from '../utils/setmatchId';
import type { MatriculaAula, PagamentoDoc, StatusPagamento } from '../types/pagamento';

export async function garantirSetmatchId(uid: string, atual?: string): Promise<string> {
  if (atual && /^SM-[A-Z0-9]{6}$/.test(atual)) return atual;

  for (let i = 0; i < 8; i++) {
    const candidate = gerarCodigoSetmatch();
    const snap = await getDocs(
      query(collection(db, 'usuarios'), where('setmatchId', '==', candidate), limit(1))
    );
    if (snap.empty) {
      await updateDoc(doc(db, 'usuarios', uid), { setmatchId: candidate });
      return candidate;
    }
  }
  throw new Error('Não foi possível gerar ID Setmatch.');
}

export async function buscarUsuarioPorSetmatchId(rawId: string) {
  const setmatchId = normalizarSetmatchId(rawId);
  const snap = await getDocs(
    query(collection(db, 'usuarios'), where('setmatchId', '==', setmatchId), limit(1))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  const raw = d.data();
  return {
    uid: d.id,
    setmatchId: String(raw.setmatchId ?? setmatchId),
    nome: String(raw.nome ?? 'Jogador'),
    telefone: String(raw.telefone ?? ''),
    fotoUrl: String(raw.fotoUrl ?? ''),
    email: String(raw.email ?? ''),
  };
}

export async function criarRegistroPagamento(
  data: Omit<PagamentoDoc, 'id' | 'criadoEm' | 'atualizadoEm' | 'status'> & {
    status?: StatusPagamento;
  }
): Promise<string> {
  const ref = await addDoc(collection(db, 'pagamentos'), {
    ...data,
    status: data.status ?? 'aguardando_pagamento',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function atualizarPagamento(
  id: string,
  patch: Partial<PagamentoDoc>
): Promise<void> {
  const { id: _id, ...rest } = patch;
  await updateDoc(doc(db, 'pagamentos', id), {
    ...rest,
    atualizadoEm: serverTimestamp(),
  });
}

export async function liberarPagamentoAdmin(pagamentoId: string): Promise<void> {
  const pagRef = doc(db, 'pagamentos', pagamentoId);
  const snap = await getDoc(pagRef);
  if (!snap.exists()) throw new Error('Pagamento não encontrado');
  const pag = snap.data();

  await updateDoc(pagRef, {
    status: 'liberado_admin',
    liberadoPeloAdmin: true,
    atualizadoEm: serverTimestamp(),
  });

  if (pag.tipo === 'aula' && pag.clubeId && pag.uid) {
    const mats = await getDocs(
      query(
        collection(db, 'matriculas'),
        where('clubeId', '==', pag.clubeId),
        where('uid', '==', pag.uid),
        limit(1)
      )
    );
    if (!mats.empty) {
      await updateDoc(mats.docs[0].ref, {
        status: 'ativo',
        pagamentoId,
        atualizadoEm: serverTimestamp(),
      });
    }
  }

  if (pag.tipo === 'torneio' && pag.torneioId && pag.uid) {
    await setDoc(
      doc(db, 'torneios', String(pag.torneioId), 'inscritos', String(pag.uid)),
      { pago: true, pagamentoId, liberadoPeloAdmin: true },
      { merge: true }
    );
  }

  if (pag.tipo === 'ranking' && pag.rankingId && pag.uid) {
    await setDoc(
      doc(db, 'rankings', String(pag.rankingId), 'classificacao', String(pag.uid)),
      { pagamentoOk: true, pagamentoId, atualizadoEm: serverTimestamp() },
      { merge: true }
    );
  }
}

export async function matricularAlunoPorId(input: {
  clubeId: string;
  clubeNome: string;
  donoUid: string;
  setmatchId: string;
  modalidadeId?: string;
  modalidadeNome?: string;
  valorBase?: number;
  descontoPercent?: number;
  valorFinal?: number;
  status?: MatriculaAula['status'];
}): Promise<MatriculaAula> {
  const user = await buscarUsuarioPorSetmatchId(input.setmatchId);
  if (!user) throw new Error('ID Setmatch não encontrado.');

  const existentes = await getDocs(
    query(
      collection(db, 'matriculas'),
      where('clubeId', '==', input.clubeId),
      where('uid', '==', user.uid),
      limit(1)
    )
  );

  const payload = {
    clubeId: input.clubeId,
    clubeNome: input.clubeNome,
    donoUid: input.donoUid,
    uid: user.uid,
    setmatchId: user.setmatchId,
    nome: user.nome,
    telefone: user.telefone,
    status: input.status ?? 'ativo',
    modalidadeId: input.modalidadeId ?? '',
    modalidadeNome: input.modalidadeNome ?? '',
    valorBase: input.valorBase ?? 0,
    descontoPercent: input.descontoPercent ?? 0,
    valorFinal: input.valorFinal ?? input.valorBase ?? 0,
    atualizadoEm: serverTimestamp(),
  };

  if (!existentes.empty) {
    const d = existentes.docs[0];
    await updateDoc(d.ref, payload);
    return { id: d.id, ...(payload as Omit<MatriculaAula, 'id'>) };
  }

  const ref = await addDoc(collection(db, 'matriculas'), {
    ...payload,
    criadoEm: serverTimestamp(),
  });

  return { id: ref.id, ...(payload as Omit<MatriculaAula, 'id'>) };
}

export async function solicitarAulas(input: {
  clubeId: string;
  clubeNome: string;
  donoUid: string;
  uid: string;
  setmatchId: string;
  nome: string;
  telefone?: string;
}): Promise<string> {
  const existentes = await getDocs(
    query(
      collection(db, 'matriculas'),
      where('clubeId', '==', input.clubeId),
      where('uid', '==', input.uid),
      limit(1)
    )
  );
  if (!existentes.empty) return existentes.docs[0].id;

  const ref = await addDoc(collection(db, 'matriculas'), {
    ...input,
    telefone: input.telefone ?? '',
    status: 'pendente',
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}
