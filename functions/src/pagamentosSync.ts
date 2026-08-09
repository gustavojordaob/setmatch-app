import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';

function db(): Firestore {
  return getFirestore();
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Marca pagamento aprovado/recusado e libera matrícula / torneio / ranking. */
export async function syncPagamentoAprovado(
  pagamentoId: string,
  paymentId: string,
  status: string,
  extra?: Record<string, unknown>
): Promise<void> {
  const pagRef = db().collection('pagamentos').doc(pagamentoId);
  const snap = await pagRef.get();
  if (!snap.exists) return;
  const pag = snap.data()!;

  const aprovado = status === 'approved' || status === 'aprovado' || status === 'paid';
  const patch: Record<string, unknown> = {
    paymentId,
    provedor: extra?.provedor ?? pag.provedor ?? 'stripe',
    atualizadoEm: FieldValue.serverTimestamp(),
    ...extra,
  };

  if (aprovado) {
    patch.status = 'aprovado';
    if (pag.ciclo === 'mensal') {
      patch.vigenteAte = addMonths(new Date(), 1);
    }
  } else if (status === 'rejected' || status === 'cancelled' || status === 'canceled') {
    patch.status = status === 'cancelled' || status === 'canceled' ? 'cancelado' : 'recusado';
  } else if (status === 'pending' || status === 'in_process' || status === 'open') {
    patch.status = 'aguardando_pagamento';
  }

  await pagRef.update(patch);

  if (!aprovado) return;

  if (pag.tipo === 'aula' && pag.clubeId && pag.uid) {
    const mats = await db()
      .collection('matriculas')
      .where('clubeId', '==', pag.clubeId)
      .where('uid', '==', pag.uid)
      .limit(1)
      .get();
    if (!mats.empty) {
      await mats.docs[0].ref.update({
        status: 'ativo',
        pagamentoId,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
    }
  }

  if (pag.tipo === 'torneio' && pag.torneioId && pag.uid) {
    await db()
      .collection('torneios')
      .doc(pag.torneioId)
      .collection('inscritos')
      .doc(pag.uid)
      .set(
        {
          pago: true,
          pagamentoId,
          pagoEm: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  if (pag.tipo === 'ranking' && pag.rankingId && pag.uid) {
    await db()
      .collection('rankings')
      .doc(pag.rankingId)
      .collection('classificacao')
      .doc(pag.uid)
      .set(
        {
          pagamentoOk: true,
          pagamentoId,
          atualizadoEm: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }
}
