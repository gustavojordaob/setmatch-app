import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { criarNotificacao } from './notificacoes';
import { criarRegistroPagamento } from './pagamentos';

export type ConviteDuplaStatus = 'pendente' | 'aceito' | 'recusado' | 'expirado';
export type ConviteDuplaContexto = 'torneio' | 'ranking';

export interface ConviteDupla {
  id: string;
  contexto: ConviteDuplaContexto;
  refId: string;
  refNome: string;
  clubeId?: string;
  clubeNome?: string;
  donoUid?: string;
  deUid: string;
  deNome: string;
  paraUid: string;
  paraNome: string;
  status: ConviteDuplaStatus;
  busca: string;
}

/** Busca usuário por e-mail ou setmatchId (SM-XXXX). */
export async function buscarUsuarioPorEmailOuId(
  busca: string
): Promise<{ uid: string; nome: string; email?: string; setmatchId?: string; fotoUrl?: string } | null> {
  const raw = busca.trim();
  if (!raw) return null;

  const email = raw.toLowerCase();
  if (email.includes('@')) {
    const snap = await getDocs(
      query(collection(db, 'usuarios'), where('email', '==', email), limit(1))
    );
    if (!snap.empty) {
      const d = snap.docs[0];
      const data = d.data();
      return {
        uid: d.id,
        nome: String(data.nome ?? 'Jogador'),
        email: data.email ? String(data.email) : undefined,
        setmatchId: data.setmatchId ? String(data.setmatchId) : undefined,
        fotoUrl: data.fotoUrl ? String(data.fotoUrl) : undefined,
      };
    }
  }

  const idNorm = raw.toUpperCase().startsWith('SM-')
    ? raw.toUpperCase()
    : raw.toUpperCase().startsWith('SM')
      ? raw.toUpperCase()
      : `SM-${raw.toUpperCase().replace(/^SM-?/, '')}`;

  const byId = await getDocs(
    query(collection(db, 'usuarios'), where('setmatchId', '==', idNorm), limit(1))
  );
  if (!byId.empty) {
    const d = byId.docs[0];
    const data = d.data();
    return {
      uid: d.id,
      nome: String(data.nome ?? 'Jogador'),
      email: data.email ? String(data.email) : undefined,
      setmatchId: data.setmatchId ? String(data.setmatchId) : undefined,
      fotoUrl: data.fotoUrl ? String(data.fotoUrl) : undefined,
    };
  }

  // Fallback: alguns seeds sem setmatchId
  const byIdRaw = await getDocs(
    query(collection(db, 'usuarios'), where('setmatchId', '==', raw), limit(1))
  );
  if (!byIdRaw.empty) {
    const d = byIdRaw.docs[0];
    const data = d.data();
    return {
      uid: d.id,
      nome: String(data.nome ?? 'Jogador'),
      setmatchId: data.setmatchId ? String(data.setmatchId) : undefined,
      fotoUrl: data.fotoUrl ? String(data.fotoUrl) : undefined,
    };
  }

  return null;
}

export async function criarConviteDupla(input: {
  contexto: ConviteDuplaContexto;
  refId: string;
  refNome: string;
  clubeId?: string;
  clubeNome?: string;
  donoUid?: string;
  deUid: string;
  deNome: string;
  paraUid: string;
  paraNome: string;
  busca: string;
}): Promise<string> {
  if (input.deUid === input.paraUid) {
    throw new Error('Escolha outro jogador como parceiro.');
  }
  const ref = await addDoc(collection(db, 'convitesDupla'), {
    ...input,
    status: 'pendente' as ConviteDuplaStatus,
    criadoEm: serverTimestamp(),
  });

  void criarNotificacao({
    paraUid: input.paraUid,
    tipo: 'convite_dupla',
    titulo: 'Convite de dupla',
    corpo: `${input.deNome} te convidou para dupla em ${input.refNome}.`,
    rota: `/convite-dupla/${ref.id}`,
    refId: ref.id,
  }).catch((e) => console.warn('[dupla] notif', e));

  return ref.id;
}

export async function aceitarConviteDupla(conviteId: string, uid: string): Promise<ConviteDupla> {
  const snap = await getDoc(doc(db, 'convitesDupla', conviteId));
  if (!snap.exists()) throw new Error('Convite não encontrado.');
  const raw = snap.data();
  if (raw.paraUid !== uid) throw new Error('Este convite não é para você.');
  if (raw.status !== 'pendente') throw new Error('Convite já respondido.');

  await updateDoc(doc(db, 'convitesDupla', conviteId), {
    status: 'aceito',
    aceitoEm: serverTimestamp(),
  });

  const convite: ConviteDupla = {
    id: conviteId,
    contexto: raw.contexto as ConviteDuplaContexto,
    refId: String(raw.refId),
    refNome: String(raw.refNome ?? ''),
    clubeId: raw.clubeId ? String(raw.clubeId) : undefined,
    clubeNome: raw.clubeNome ? String(raw.clubeNome) : undefined,
    donoUid: raw.donoUid ? String(raw.donoUid) : undefined,
    deUid: String(raw.deUid),
    deNome: String(raw.deNome ?? ''),
    paraUid: String(raw.paraUid),
    paraNome: String(raw.paraNome ?? ''),
    status: 'aceito',
    busca: String(raw.busca ?? ''),
  };

  if (convite.contexto === 'torneio') {
    await vincularParceiroTorneio(convite);
  } else {
    await vincularParceiroRanking(convite);
  }

  void criarNotificacao({
    paraUid: convite.deUid,
    tipo: 'convite_dupla',
    titulo: 'Dupla confirmada',
    corpo: `${convite.paraNome} aceitou jogar com você em ${convite.refNome}.`,
    rota:
      convite.contexto === 'torneio'
        ? `/torneio/${convite.refId}`
        : `/ranking/${convite.refId}`,
    refId: convite.refId,
  }).catch(() => undefined);

  return convite;
}

export async function recusarConviteDupla(conviteId: string, uid: string): Promise<void> {
  const snap = await getDoc(doc(db, 'convitesDupla', conviteId));
  if (!snap.exists()) throw new Error('Convite não encontrado.');
  if (snap.data().paraUid !== uid) throw new Error('Este convite não é para você.');
  await updateDoc(doc(db, 'convitesDupla', conviteId), {
    status: 'recusado',
    atualizadoEm: serverTimestamp(),
  });
}

async function vincularParceiroTorneio(c: ConviteDupla): Promise<void> {
  const inscRef = doc(db, 'torneios', c.refId, 'inscritos', c.deUid);
  const insc = await getDoc(inscRef);
  if (!insc.exists()) throw new Error('Inscrição do parceiro não encontrada.');

  const tSnap = await getDoc(doc(db, 'torneios', c.refId));
  const t = tSnap.data() || {};
  const pag = t.pagamento as { ativo?: boolean; valor?: number } | undefined;
  const precisaPagar = Boolean(pag?.ativo && (pag.valor ?? 0) > 0);

  let parceiroFoto = '';
  try {
    const uSnap = await getDoc(doc(db, 'usuarios', c.paraUid));
    if (uSnap.exists()) parceiroFoto = String(uSnap.data()?.fotoUrl ?? '');
  } catch {
    /* ignore */
  }

  await updateDoc(inscRef, {
    parceiroUid: c.paraUid,
    parceiroNome: c.paraNome,
    parceiroFoto,
    parceiroAceito: true,
    status: precisaPagar ? 'aguardando_pagamento' : 'aguardando_pagamento',
    atualizadoEm: serverTimestamp(),
  });

  if (precisaPagar) {
    await criarPagamentosDuplaTorneio({
      torneioId: c.refId,
      torneioNome: String(t.nome ?? c.refNome),
      clubeId: String(t.clubeId ?? c.clubeId ?? ''),
      clubeNome: String(t.clubeNome ?? c.clubeNome ?? ''),
      donoUid: String(t.donoUid ?? c.donoUid ?? ''),
      valor: Number(pag!.valor),
      capitao: { uid: c.deUid, nome: c.deNome },
      parceiro: { uid: c.paraUid, nome: c.paraNome },
    });
  } else {
    await updateDoc(inscRef, {
      pago: true,
      parceiroPago: true,
    });
  }

  await tentarConfirmarInscricaoTorneio(c.refId, c.deUid);
}

async function vincularParceiroRanking(c: ConviteDupla): Promise<void> {
  const classRef = doc(db, 'rankings', c.refId, 'classificacao', c.deUid);
  await setDoc(
    classRef,
    {
      uid: c.deUid,
      nome: c.deNome,
      parceiroUid: c.paraUid,
      parceiroNome: c.paraNome,
      parceiroAceito: true,
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );
  await setDoc(
    doc(db, 'rankings', c.refId, 'classificacao', c.paraUid),
    {
      uid: c.paraUid,
      nome: c.paraNome,
      parceiroUid: c.deUid,
      parceiroNome: c.deNome,
      parceiroAceito: true,
      duplaCom: c.deUid,
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Promove inscrição a confirmado quando regras de parceiro + pagamento estão ok.
 * Incrementa totalInscritos só na primeira confirmação.
 */
export async function tentarConfirmarInscricaoTorneio(
  torneioId: string,
  capitaoUid: string
): Promise<boolean> {
  const tSnap = await getDoc(doc(db, 'torneios', torneioId));
  if (!tSnap.exists()) return false;
  const t = tSnap.data();
  const composicao = String(t.composicao ?? 'simples');
  const pag = t.pagamento as { ativo?: boolean; valor?: number } | undefined;
  const precisaPagar = Boolean(pag?.ativo && (pag.valor ?? 0) > 0);

  const inscRef = doc(db, 'torneios', torneioId, 'inscritos', capitaoUid);
  const inscSnap = await getDoc(inscRef);
  if (!inscSnap.exists()) return false;
  const insc = inscSnap.data();
  if (String(insc.status) === 'confirmado') return true;

  if (composicao === 'dupla') {
    if (!insc.parceiroAceito || !insc.parceiroUid) return false;
  }

  const capitaoPago = !precisaPagar || Boolean(insc.pago);
  const parceiroPago =
    composicao !== 'dupla' || !precisaPagar || Boolean(insc.parceiroPago);

  if (!capitaoPago || !parceiroPago) return false;

  await updateDoc(inscRef, {
    status: 'confirmado',
    confirmadoEm: serverTimestamp(),
  });
  if (!insc.contabilizado) {
    await updateDoc(doc(db, 'torneios', torneioId), {
      totalInscritos: increment(1),
    });
    await updateDoc(inscRef, { contabilizado: true });
  }
  return true;
}

/** Após pagamento aprovado (cliente ou CF espelho). */
export async function marcarPagamentoInscricaoTorneio(input: {
  torneioId: string;
  uid: string;
  pagamentoId: string;
}): Promise<void> {
  const tSnap = await getDoc(doc(db, 'torneios', input.torneioId));
  if (!tSnap.exists()) return;

  // Pode ser capitão ou parceiro
  const propria = doc(db, 'torneios', input.torneioId, 'inscritos', input.uid);
  const propriaSnap = await getDoc(propria);
  if (propriaSnap.exists()) {
    await updateDoc(propria, {
      pago: true,
      pagamentoId: input.pagamentoId,
      atualizadoEm: serverTimestamp(),
    });
    await tentarConfirmarInscricaoTorneio(input.torneioId, input.uid);
    return;
  }

  // Parceiro: achar inscrição onde parceiroUid == uid
  const todos = await getDocs(collection(db, 'torneios', input.torneioId, 'inscritos'));
  for (const d of todos.docs) {
    const raw = d.data();
    if (String(raw.parceiroUid ?? '') === input.uid) {
      await updateDoc(d.ref, {
        parceiroPago: true,
        parceiroPagamentoId: input.pagamentoId,
        atualizadoEm: serverTimestamp(),
      });
      await tentarConfirmarInscricaoTorneio(input.torneioId, d.id);
      return;
    }
  }
}

export async function criarPagamentosDuplaTorneio(input: {
  torneioId: string;
  torneioNome: string;
  clubeId: string;
  clubeNome: string;
  donoUid: string;
  valor: number;
  ciclo?: 'unico' | 'mensal';
  capitao: {
    uid: string;
    nome: string;
    setmatchId?: string;
    telefone?: string;
  };
  parceiro: {
    uid: string;
    nome: string;
    setmatchId?: string;
    telefone?: string;
  };
}): Promise<{ pagCapitaoId: string; pagParceiroId: string }> {
  const ciclo = input.ciclo ?? 'unico';
  const pagCapitaoId = await criarRegistroPagamento({
    uid: input.capitao.uid,
    setmatchId: input.capitao.setmatchId || '',
    nome: input.capitao.nome,
    telefone: input.capitao.telefone,
    tipo: 'torneio',
    clubeId: input.clubeId,
    clubeNome: input.clubeNome,
    donoUid: input.donoUid,
    torneioId: input.torneioId,
    torneioNome: input.torneioNome,
    valor: input.valor,
    ciclo,
    status: 'aguardando_pagamento',
  });
  const pagParceiroId = await criarRegistroPagamento({
    uid: input.parceiro.uid,
    setmatchId: input.parceiro.setmatchId || '',
    nome: input.parceiro.nome,
    telefone: input.parceiro.telefone,
    tipo: 'torneio',
    clubeId: input.clubeId,
    clubeNome: input.clubeNome,
    donoUid: input.donoUid,
    torneioId: input.torneioId,
    torneioNome: input.torneioNome,
    valor: input.valor,
    ciclo,
    status: 'aguardando_pagamento',
  });

  void criarNotificacao({
    paraUid: input.parceiro.uid,
    tipo: 'pagamento',
    titulo: 'Pagamento da inscrição',
    corpo: `Pague sua parte do torneio ${input.torneioNome} para confirmar a dupla.`,
    rota: '/pagamentos',
    refId: pagParceiroId,
  }).catch(() => undefined);

  return { pagCapitaoId, pagParceiroId };
}
