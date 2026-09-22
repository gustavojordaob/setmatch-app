import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { asaasFetch, netToDono } from './asaasClient';

function db(): Firestore {
  return getFirestore();
}

/**
 * Valor que o dono deve receber no ledger:
 * 1) netValue da cobrança Asaas (já desconta tarifa Asaas + antecipação, se houver)
 * 2) senão netToDono(bruto) com ASAAS_PLATFORM_FEE_PERCENT
 */
function liquidoParaDono(pag: Record<string, unknown>, extra?: Record<string, unknown>): number {
  const bruto = Number(pag.valor || 0);
  const fromExtra = Number(extra?.valorLiquidoDono ?? extra?.netValue ?? NaN);
  if (Number.isFinite(fromExtra) && fromExtra > 0) {
    return Math.round(fromExtra * 100) / 100;
  }
  const fromPag = Number(pag.valorLiquidoDono ?? pag.netValue ?? NaN);
  if (Number.isFinite(fromPag) && fromPag > 0) {
    return Math.round(fromPag * 100) / 100;
  }
  if (!(bruto > 0)) return 0;
  return netToDono(bruto);
}

/** Cobrança Asaas resolvida (Checkout não propaga externalReference → usa checkoutSession). */
export type AsaasPayResolved = {
  id: string;
  netValue: number;
  value: number;
  status: string;
  billingType?: string;
  anticipated?: boolean;
  estimatedCreditDate?: string | null;
  creditDate?: string | null;
  checkoutSession?: string | null;
};

function isAsaasPaymentId(id: string): boolean {
  return String(id || '').startsWith('pay_');
}

/** Busca cobrança Asaas por pay_id, externalReference ou checkoutSession. */
export async function resolverPagamentoAsaas(input: {
  pagamentoId: string;
  asaasPaymentId?: string | null;
  asaasCheckoutId?: string | null;
}): Promise<AsaasPayResolved | null> {
  const pick = (p: Record<string, unknown>): AsaasPayResolved | null => {
    const n = Number(p.netValue);
    if (!(Number.isFinite(n) && n > 0)) return null;
    return {
      id: String(p.id || ''),
      netValue: Math.round(n * 100) / 100,
      value: Number(p.value) || 0,
      status: String(p.status || ''),
      billingType: p.billingType ? String(p.billingType) : undefined,
      anticipated: p.anticipated === true,
      estimatedCreditDate: p.estimatedCreditDate != null ? String(p.estimatedCreditDate) : null,
      creditDate: p.creditDate != null ? String(p.creditDate) : null,
      checkoutSession: p.checkoutSession != null ? String(p.checkoutSession) : null,
    };
  };

  try {
    const pid = String(input.asaasPaymentId || '');
    if (pid && isAsaasPaymentId(pid) && !pid.startsWith('manual_')) {
      const pay = await asaasFetch<Record<string, unknown>>(
        `/v3/payments/${encodeURIComponent(pid)}`
      );
      const hit = pick(pay);
      if (hit) return hit;
    }
  } catch (e) {
    console.warn('[pagamentosSync] get payment', e);
  }

  try {
    const list = await asaasFetch<{ data?: Record<string, unknown>[] }>('/v3/payments', {
      query: { externalReference: String(input.pagamentoId), limit: '10' },
    });
    const paid = (list.data || []).find((p) =>
      ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(String(p.status || '').toUpperCase())
    );
    if (paid) {
      const hit = pick(paid);
      if (hit) return hit;
    }
  } catch (e) {
    console.warn('[pagamentosSync] list by externalReference', e);
  }

  // Checkout Asaas: payment.checkoutSession = asaasCheckoutId (externalReference costuma vir null)
  const checkoutId = String(input.asaasCheckoutId || '').trim();
  if (checkoutId) {
    try {
      const list = await asaasFetch<{ data?: Record<string, unknown>[] }>('/v3/payments', {
        query: { limit: '50' },
      });
      const paid = (list.data || []).find(
        (p) =>
          String(p.checkoutSession || '') === checkoutId &&
          ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(
            String(p.status || '').toUpperCase()
          )
      );
      if (paid) {
        const hit = pick(paid);
        if (hit) return hit;
      }
    } catch (e) {
      console.warn('[pagamentosSync] list by checkoutSession', e);
    }
  }

  return null;
}

/** Monta texto para extrato Asaas (clube + professor + ids). */
export function montarDescricaoAsaas(
  pag: Record<string, unknown>,
  pagamentoId: string
): string {
  const titulo = String(
    pag.titulo || pag.torneioNome || pag.rankingNome || pag.aulaTitulo || pag.tipo || 'Pagamento'
  ).trim();
  const clubeNome = String(pag.clubeNome || '').trim();
  const professorNome = String(pag.professorNome || pag.donoNome || '').trim();
  const parts = [
    titulo,
    clubeNome ? `Clube: ${clubeNome}` : null,
    professorNome ? `Prof: ${professorNome}` : null,
    pag.clubeId ? `clubeId:${pag.clubeId}` : null,
    pag.donoUid ? `donoUid:${pag.donoUid}` : null,
    `pag:${pagamentoId}`,
  ].filter(Boolean);
  return parts.join(' | ').slice(0, 500);
}

/** Grava description na cobrança Asaas (Checkout muitas vezes deixa description null). */
export async function aplicarDescricaoCobrancaAsaas(
  asaasPaymentId: string,
  pag: Record<string, unknown>,
  pagamentoId: string
): Promise<void> {
  const payId = String(asaasPaymentId || '');
  if (!payId.startsWith('pay_')) return;
  let professorNome = String(pag.professorNome || pag.donoNome || '').trim();
  if (!professorNome && pag.donoUid) {
    try {
      const donoSnap = await db().collection('usuarios').doc(String(pag.donoUid)).get();
      professorNome = String(donoSnap.data()?.nome || '').trim();
    } catch {
      /* ignore */
    }
  }
  const description =
    String(pag.descricaoAsaas || '').trim() ||
    montarDescricaoAsaas({ ...pag, professorNome }, pagamentoId);
  if (!description) return;
  try {
    await asaasFetch(`/v3/payments/${encodeURIComponent(payId)}`, {
      method: 'PUT',
      body: { description },
    });
  } catch (e) {
    // Asaas: só edita cobranças pendentes/vencidas — após RECEIVED/CONFIRMED falha
    console.warn('[pagamentosSync] PUT payment description', e);
  }
}

/** @deprecated use resolverPagamentoAsaas */
export async function resolverNetValueAsaas(input: {
  pagamentoId: string;
  asaasPaymentId?: string | null;
  asaasCheckoutId?: string | null;
}): Promise<number | null> {
  const p = await resolverPagamentoAsaas(input);
  return p?.netValue ?? null;
}

/**
 * Asaas:
 * - PAYMENT_CONFIRMED = pago, saldo ainda NÃO na conta
 * - PAYMENT_RECEIVED / PAYMENT_ANTICIPATED = valor disponível para transferência
 * PIX costuma ir direto para RECEIVED; cartão (mesmo com antecipação) pode demorar 1–2 dias úteis.
 */
function saldoJaLiberadoParaSaque(extra?: Record<string, unknown>): boolean {
  const event = String(extra?.asaasEvent || '').toUpperCase();
  if (
    event === 'PAYMENT_RECEIVED' ||
    event === 'PAYMENT_ANTICIPATED' ||
    event === 'PAYMENT_RECEIVED_IN_CASH'
  ) {
    return true;
  }
  if (event === 'PAYMENT_CONFIRMED') return false;

  const status = String(extra?.asaasPaymentStatus || '').toUpperCase();
  if (['RECEIVED', 'RECEIVED_IN_CASH'].includes(status)) return true;
  if (status === 'CONFIRMED') return false;

  const billing = String(extra?.billingType || extra?.meioPagamento || '').toUpperCase();
  if (billing === 'PIX' || billing === 'pix') return true;
  if (billing === 'CREDIT_CARD' || billing === 'cartao') return false;

  // Liberação manual / checkout sem detalhe
  if (event === 'CHECKOUT_PAID') {
    if (String(extra?.meioPagamento || '').toLowerCase() === 'pix') return true;
    if (String(extra?.meioPagamento || '').toLowerCase() === 'cartao') return false;
    // Checkout ambíguo (PIX+cartão): assume a liberar até PAYMENT_RECEIVED
    return false;
  }
  if (String(extra?.asaasPaymentId || '').startsWith('manual_')) return true;
  return true;
}

function meioFromBilling(billing?: unknown, fallback?: unknown): 'pix' | 'cartao' | null {
  const b = String(billing || fallback || '').toUpperCase();
  if (b === 'PIX' || b === 'pix') return 'pix';
  if (b === 'CREDIT_CARD' || b === 'DEBIT_CARD' || b === 'cartao') return 'cartao';
  return null;
}

/**
 * Credita ledger do dono (líquido). Idempotente.
 * - liberadoParaSaque=false → saldoALiberar (cartão confirmado, ainda não RECEIVED)
 * - liberadoParaSaque=true  → saldoDisponivel (pode transferir PIX)
 * Se já estava em aLiberar e chega RECEIVED → move para disponivel.
 */
async function creditarSaldoDono(
  pag: Record<string, unknown>,
  pagamentoId: string,
  extra?: Record<string, unknown>
): Promise<void> {
  const donoUid = String(pag.donoUid || '');
  if (!donoUid) return;

  const bruto = Number(pag.valor || 0);
  if (!(bruto > 0)) return;
  const liquido = liquidoParaDono(pag, extra);
  if (!(liquido > 0)) return;
  const taxaAsaas = Math.round((bruto - liquido) * 100) / 100;
  const liberado = saldoJaLiberadoParaSaque(extra);
  const tipo = String(pag.tipo || 'outro');
  const modalidade =
    String(pag.modalidadeNome || pag.aulaTitulo || pag.torneioNome || pag.rankingNome || tipo).trim() ||
    tipo;
  const meio =
    meioFromBilling(extra?.billingType, extra?.meioPagamento) ||
    meioFromBilling(pag.meioPagamento) ||
    null;
  const anticipated =
    extra?.anticipated === true ||
    String(extra?.asaasEvent || '').toUpperCase() === 'PAYMENT_ANTICIPATED';
  const estimatedCreditDate =
    extra?.estimatedCreditDate != null ? String(extra.estimatedCreditDate) : null;
  const creditDate = extra?.creditDate != null ? String(extra.creditDate) : null;

  const saldoRef = db().collection('saldosFinanceiros').doc(donoUid);
  const modKey = modalidade.slice(0, 80);

  await db().runTransaction(async (tx) => {
    const pagRef = db().collection('pagamentos').doc(pagamentoId);
    const again = await tx.get(pagRef);
    if (!again.exists) return;
    const curPag = again.data() || {};

    // Já creditado
    if (curPag.saldoCreditado === true) {
      // Legado (sem flag) ou já liberado → não mexe no dinheiro de novo
      if (curPag.liberadoParaSaque !== false) {
        if (curPag.liberadoParaSaque == null && liberado) {
          tx.update(pagRef, {
            liberadoParaSaque: true,
            atualizadoEm: FieldValue.serverTimestamp(),
          });
        }
        return;
      }
      // Estava em aLiberar → RECEIVED/ANTICIPATED move para disponivel
      if (!liberado) {
        tx.update(pagRef, {
          ...(estimatedCreditDate ? { estimatedCreditDate } : {}),
          ...(creditDate ? { creditDate } : {}),
          ...(anticipated ? { anticipated: true } : {}),
          asaasEvent: extra?.asaasEvent || curPag.asaasEvent || null,
          atualizadoEm: FieldValue.serverTimestamp(),
        });
        return;
      }
      const valorMove = Number(curPag.valorLiquidoDono || liquido);
      if (!(valorMove > 0)) return;
      tx.set(
        saldoRef,
        {
          donoUid,
          valoresEmLiquido: true,
          saldoALiberar: FieldValue.increment(-valorMove),
          saldoDisponivel: FieldValue.increment(valorMove),
          atualizadoEm: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.update(pagRef, {
        liberadoParaSaque: true,
        ...(creditDate ? { creditDate } : {}),
        ...(anticipated ? { anticipated: true } : {}),
        asaasEvent: extra?.asaasEvent || curPag.asaasEvent || null,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      return;
    }

    // Primeiro crédito
    const snap = await tx.get(saldoRef);
    const cur = snap.data() || {};
    const porModalidade = {
      ...((cur.porModalidade as Record<string, { recebido: number; qtd: number }>) || {}),
    };
    const prevM = porModalidade[modKey] || { recebido: 0, qtd: 0 };
    porModalidade[modKey] = {
      recebido: Math.round((prevM.recebido + liquido) * 100) / 100,
      qtd: prevM.qtd + 1,
    };
    const porTipo = { ...((cur.porTipo as Record<string, number>) || {}) };
    porTipo[tipo] = Math.round(((porTipo[tipo] || 0) + liquido) * 100) / 100;

    const saldoPatch: Record<string, unknown> = {
      donoUid,
      valoresEmLiquido: true,
      saldoTotalRecebido: FieldValue.increment(liquido),
      porModalidade,
      porTipo,
      atualizadoEm: FieldValue.serverTimestamp(),
    };
    if (liberado) {
      saldoPatch.saldoDisponivel = FieldValue.increment(liquido);
    } else {
      saldoPatch.saldoALiberar = FieldValue.increment(liquido);
    }

    tx.set(saldoRef, saldoPatch, { merge: true });
    tx.update(pagRef, {
      saldoCreditado: true,
      liberadoParaSaque: liberado,
      valorBruto: bruto,
      valorLiquidoDono: liquido,
      taxaAsaas: taxaAsaas > 0 ? taxaAsaas : 0,
      modalidadeNome: modalidade,
      ...(meio ? { meioPagamento: meio } : {}),
      ...(anticipated ? { anticipated: true } : {}),
      ...(estimatedCreditDate ? { estimatedCreditDate } : {}),
      ...(creditDate ? { creditDate } : {}),
      asaasEvent: extra?.asaasEvent || null,
      asaasPaymentStatus: extra?.asaasPaymentStatus || null,
    });
  });
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Marca inscrição de torneio como paga e confirma quando possível.
 * Docs multi-categoria usam id `uid__categoriaId` (não só `uid`).
 */
async function liberarInscricaoTorneioAposPagamento(input: {
  torneioId: string;
  uid: string;
  pagamentoId: string;
}): Promise<void> {
  const { torneioId, uid, pagamentoId } = input;
  const inscritosSnap = await db()
    .collection('torneios')
    .doc(torneioId)
    .collection('inscritos')
    .get();

  let touched = false;

  for (const d of inscritosSnap.docs) {
    const insc = d.data();
    // Ignora fantasma (só pago/pagamentoId sem inscrição real)
    const completa =
      Boolean(insc.nome) ||
      Boolean(insc.criadoEm) ||
      Boolean(insc.status) ||
      insc.inscritoPorOrganizador === true;
    if (!completa) continue;

    const capitao = String(insc.uid ?? d.id.split('__')[0]);
    const isCapitao = capitao === uid || d.id === uid || d.id.startsWith(`${uid}__`);
    if (isCapitao) {
      await d.ref.set(
        {
          pago: true,
          pagamentoId,
          pagoEm: FieldValue.serverTimestamp(),
          atualizadoEm: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      touched = true;
    } else if (String(insc.parceiroUid || '') === uid) {
      await d.ref.set(
        {
          parceiroPago: true,
          parceiroPagamentoId: pagamentoId,
          atualizadoEm: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      touched = true;
    }
  }

  if (!touched) {
    console.warn('[pagamentosSync] inscrição torneio não encontrada', {
      torneioId,
      uid,
      pagamentoId,
    });
    return;
  }

  const tSnap = await db().collection('torneios').doc(torneioId).get();
  const t = tSnap.data() || {};
  const composicao = String(t.composicao || 'simples');
  const pagaCfg = t.pagamento as { ativo?: boolean; valor?: number } | undefined;
  const precisaPagar = Boolean(pagaCfg?.ativo && (pagaCfg.valor ?? 0) > 0);

  // Releia após merges
  const again = await db()
    .collection('torneios')
    .doc(torneioId)
    .collection('inscritos')
    .get();

  for (const d of again.docs) {
    const insc = d.data();
    const capitao = String(insc.uid ?? d.id.split('__')[0]);
    const relevant =
      capitao === uid ||
      d.id === uid ||
      d.id.startsWith(`${uid}__`) ||
      String(insc.parceiroUid || '') === uid;
    if (!relevant) continue;
    if (String(insc.status) === 'confirmado') continue;

    // Dupla: respeita composicao da categoria se houver
    const compCat = String(insc.composicao || composicao);
    if (compCat === 'dupla' && (!insc.parceiroAceito || !insc.parceiroUid)) continue;

    const capitaoPago = !precisaPagar || Boolean(insc.pago);
    const parceiroPago =
      compCat !== 'dupla' || !precisaPagar || Boolean(insc.parceiroPago);
    if (!capitaoPago || !parceiroPago) continue;

    await d.ref.set(
      { status: 'confirmado', confirmadoEm: FieldValue.serverTimestamp() },
      { merge: true }
    );
    if (!insc.contabilizado) {
      await db()
        .collection('torneios')
        .doc(torneioId)
        .update({ totalInscritos: FieldValue.increment(1) });
      await d.ref.set({ contabilizado: true }, { merge: true });
    }
  }
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
    provedor: extra?.provedor ?? pag.provedor ?? 'asaas',
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

  try {
    // Sempre tentar resolver cobrança real: Checkout não manda netValue e externalReference
    // no payment costuma vir null — lookup por checkoutSession.
    const checkoutId =
      String(extra?.asaasCheckoutId || pag.asaasCheckoutId || '').trim() ||
      (!String(paymentId || '').startsWith('pay_') && !String(paymentId || '').startsWith('manual_')
        ? String(paymentId || '')
        : '');
    const payIdHint = String(extra?.asaasPaymentId || '').startsWith('pay_')
      ? String(extra?.asaasPaymentId)
      : String(paymentId || '').startsWith('pay_')
        ? String(paymentId)
        : null;

    let net = Number(extra?.netValue ?? extra?.valorLiquidoDono ?? NaN);
    const brutoPag = Number(pag.valor || 0);
    // Se net == bruto, provavelmente veio errado do CHECKOUT_PAID — reconsulta Asaas
    const netSuspeito = Number.isFinite(net) && brutoPag > 0 && Math.abs(net - brutoPag) < 0.009;

    let resolved = null as Awaited<ReturnType<typeof resolverPagamentoAsaas>>;
    if (!(Number.isFinite(net) && net > 0) || netSuspeito || checkoutId) {
      resolved = await resolverPagamentoAsaas({
        pagamentoId,
        asaasPaymentId: payIdHint,
        asaasCheckoutId: checkoutId || null,
      });
      if (resolved) net = resolved.netValue;
    }

    const creditExtra: Record<string, unknown> = { ...(extra || {}) };
    if (Number.isFinite(net) && net > 0) {
      creditExtra.netValue = net;
      creditExtra.valorLiquidoDono = net;
    }
    if (resolved) {
      creditExtra.asaasPaymentId = resolved.id;
      creditExtra.asaasPaymentStatus = resolved.status;
      if (resolved.billingType) creditExtra.billingType = resolved.billingType;
      if (resolved.anticipated) creditExtra.anticipated = true;
      if (resolved.estimatedCreditDate) {
        creditExtra.estimatedCreditDate = resolved.estimatedCreditDate;
      }
      if (resolved.creditDate) creditExtra.creditDate = resolved.creditDate;
      if (!creditExtra.asaasEvent) {
        const st = String(resolved.status).toUpperCase();
        creditExtra.asaasEvent =
          st === 'RECEIVED' || st === 'RECEIVED_IN_CASH'
            ? 'PAYMENT_RECEIVED'
            : st === 'CONFIRMED'
              ? 'PAYMENT_CONFIRMED'
              : extra?.asaasEvent;
      }
    }

    await creditarSaldoDono({ ...pag, ...patch }, pagamentoId, creditExtra);

    const payIdForDesc = String(
      creditExtra.asaasPaymentId || resolved?.id || payIdHint || ''
    );
    if (payIdForDesc.startsWith('pay_')) {
      void aplicarDescricaoCobrancaAsaas(
        payIdForDesc,
        { ...pag, ...patch, ...creditExtra },
        pagamentoId
      );
    }
  } catch (e) {
    console.error('[pagamentosSync] creditarSaldoDono', e);
  }

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
    if (pag.inscricaoRemovida) {
      console.warn('[pagamentosSync] pagamento com inscrição removida — não libera', {
        torneioId: pag.torneioId,
        uid: pag.uid,
        pagamentoId,
      });
      return;
    }
    await liberarInscricaoTorneioAposPagamento({
      torneioId: String(pag.torneioId),
      uid: String(pag.uid),
      pagamentoId,
    });
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
