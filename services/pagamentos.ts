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

/** Cria cobrança de aula se ainda não houver uma em aberto para o aluno/clube. */
async function garantirPagamentoAulaMatricula(input: {
  matriculaId: string;
  clubeId: string;
  clubeNome: string;
  donoUid: string;
  uid: string;
  setmatchId: string;
  nome: string;
  telefone?: string;
  modalidadeNome?: string;
  valor: number;
}): Promise<string | undefined> {
  if (!(input.valor > 0)) return undefined;

  // Admin NÃO pode listar por uid do aluno (rules). Query por donoUid (+ uid).
  // Aluno: donoUid do clube + próprio uid também funciona.
  let existente: { id: string } | undefined;
  try {
    const abertos = await getDocs(
      query(
        collection(db, 'pagamentos'),
        where('donoUid', '==', input.donoUid),
        where('uid', '==', input.uid),
        limit(30)
      )
    );
    const hit = abertos.docs.find((d) => {
      const raw = d.data();
      if (String(raw.clubeId ?? '') !== input.clubeId) return false;
      if (String(raw.tipo ?? '') !== 'aula') return false;
      const s = String(raw.status ?? '');
      return (
        s === 'aguardando_pagamento' ||
        s === 'pendente' ||
        s === 'atrasado' ||
        s === 'recusado'
      );
    });
    if (hit) existente = { id: hit.id };
  } catch {
    // Sem índice / rules — segue para criar
  }

  if (existente) {
    await updateDoc(doc(db, 'matriculas', input.matriculaId), {
      pagamentoId: existente.id,
      atualizadoEm: serverTimestamp(),
    });
    return existente.id;
  }

  // Reusa pagamentoId já na matrícula, se existir
  try {
    const matSnap = await getDoc(doc(db, 'matriculas', input.matriculaId));
    const pagId = matSnap.exists()
      ? String(matSnap.data().pagamentoId ?? '')
      : '';
    if (pagId) {
      const pSnap = await getDoc(doc(db, 'pagamentos', pagId));
      if (pSnap.exists()) {
        const s = String(pSnap.data().status ?? '');
        if (
          s === 'aguardando_pagamento' ||
          s === 'pendente' ||
          s === 'atrasado' ||
          s === 'recusado'
        ) {
          return pagId;
        }
      }
    }
  } catch {
    // continua criação
  }

  const pagRef = await addDoc(collection(db, 'pagamentos'), {
    uid: input.uid,
    setmatchId: input.setmatchId,
    nome: input.nome,
    telefone: input.telefone ?? '',
    tipo: 'aula',
    clubeId: input.clubeId,
    clubeNome: input.clubeNome,
    donoUid: input.donoUid,
    matriculaId: input.matriculaId,
    aulaTitulo: input.modalidadeNome || 'Mensalidade aulas',
    valor: input.valor,
    ciclo: 'mensal',
    status: 'aguardando_pagamento',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });

  await updateDoc(doc(db, 'matriculas', input.matriculaId), {
    pagamentoId: pagRef.id,
    atualizadoEm: serverTimestamp(),
  });

  return pagRef.id;
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

  let existentes;
  try {
    existentes = await getDocs(
      query(
        collection(db, 'matriculas'),
        where('clubeId', '==', input.clubeId),
        where('donoUid', '==', input.donoUid),
        where('uid', '==', user.uid),
        limit(1)
      )
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg.includes('permission') || msg.includes('Permission')
        ? 'Sem permissão para consultar matrículas. Confirme que você é o dono do clube.'
        : msg
    );
  }

  const valorFinal = input.valorFinal ?? input.valorBase ?? 0;
  // Com valor: fica pendente até pagar / admin liberar. Sem valor: já ativo.
  const statusMat =
    input.status ?? (valorFinal > 0 ? 'pendente' : 'ativo');

  const payload = {
    clubeId: input.clubeId,
    clubeNome: input.clubeNome,
    donoUid: input.donoUid,
    uid: user.uid,
    setmatchId: user.setmatchId,
    nome: user.nome,
    telefone: user.telefone,
    status: statusMat,
    modalidadeId: input.modalidadeId ?? '',
    modalidadeNome: input.modalidadeNome ?? '',
    valorBase: input.valorBase ?? 0,
    descontoPercent: input.descontoPercent ?? 0,
    valorFinal,
    atualizadoEm: serverTimestamp(),
  };

  let matriculaId: string;
  if (!existentes.empty) {
    const d = existentes.docs[0];
    matriculaId = d.id;
    await updateDoc(d.ref, payload);
  } else {
    const ref = await addDoc(collection(db, 'matriculas'), {
      ...payload,
      criadoEm: serverTimestamp(),
    });
    matriculaId = ref.id;
  }

  // Matrícula já salva — cobrança não pode derrubar o vínculo se falhar
  let pagamentoId: string | undefined;
  try {
    pagamentoId = await garantirPagamentoAulaMatricula({
      matriculaId,
      clubeId: input.clubeId,
      clubeNome: input.clubeNome,
      donoUid: input.donoUid,
      uid: user.uid,
      setmatchId: user.setmatchId,
      nome: user.nome,
      telefone: user.telefone,
      modalidadeNome: input.modalidadeNome,
      valor: valorFinal,
    });
  } catch {
    pagamentoId = undefined;
  }

  return {
    id: matriculaId,
    ...(payload as Omit<MatriculaAula, 'id'>),
    pagamentoId,
  };
}

/**
 * Aluno já matriculado sem cobrança (legado): gera pagamento em aberto.
 * Pode ser chamado pelo próprio aluno na tela de aulas.
 */
export async function garantirCobrancaMatriculaAluno(input: {
  matriculaId: string;
  clubeId: string;
  clubeNome: string;
  donoUid: string;
  uid: string;
  setmatchId: string;
  nome: string;
  telefone?: string;
  modalidadeNome?: string;
  valor: number;
}): Promise<string | undefined> {
  return garantirPagamentoAulaMatricula(input);
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
