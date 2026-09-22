import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';
import {
  asaasCheckoutHost,
  asaasFetch,
  asaasWebhookToken,
  todayISO,
} from './asaasClient';
import { syncPagamentoAprovado, aplicarDescricaoCobrancaAsaas } from './pagamentosSync';

const HOSTING = 'https://rallyup.app.br';
const FN_OPTS = { cors: true, region: 'southamerica-east1' as const };

function db() {
  return getFirestore();
}

async function requireUid(req: { headers: Record<string, unknown> }): Promise<string> {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('UNAUTHORIZED');
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}

type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

function normalizePixKey(tipo: PixKeyType, chave: string): string {
  const raw = String(chave || '').trim();
  if (tipo === 'CPF' || tipo === 'CNPJ') return raw.replace(/\D/g, '');
  if (tipo === 'PHONE') {
    const d = raw.replace(/\D/g, '');
    return d.length === 11 || d.length === 10 ? d : d;
  }
  if (tipo === 'EMAIL') return raw.toLowerCase();
  return raw;
}

/**
 * Cria Asaas Checkout (PIX / cartão / assinatura mensal).
 * Saldo fica na conta da plataforma; professor saca via PIX sem criar conta Asaas.
 */
export const criarCheckoutAsaas = onRequest(FN_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  try {
    const uid = await requireUid(req as never);
    const {
      pagamentoId,
      titulo,
      valor,
      ciclo = 'unico',
      meio,
      permitePix = true,
      permiteCartao = true,
      descontoPercent = 0,
      valorBase,
    } = req.body || {};

    if (!pagamentoId || !titulo || !valor) {
      res.status(400).json({ error: 'pagamentoId, titulo e valor são obrigatórios' });
      return;
    }

    const pagRef = db().collection('pagamentos').doc(String(pagamentoId));
    const pagSnap = await pagRef.get();
    if (!pagSnap.exists) {
      res.status(404).json({ error: 'Pagamento não encontrado' });
      return;
    }
    const pag = pagSnap.data()!;
    if (pag.uid !== uid) {
      res.status(403).json({ error: 'Pagamento de outro usuário' });
      return;
    }

    const amount = Number(valor);
    if (!(amount >= 1)) {
      res.status(400).json({ error: 'Valor mínimo R$ 1,00' });
      return;
    }

    const meioNorm: 'pix' | 'cartao' | 'ambos' =
      meio === 'pix' || meio === 'cartao'
        ? meio
        : permitePix !== false && permiteCartao === false
          ? 'pix'
          : permiteCartao !== false && permitePix === false
            ? 'cartao'
            : 'ambos';

    const isSubscription = String(ciclo) === 'mensal' && meioNorm === 'cartao';

    const billingTypes: string[] = [];
    if (isSubscription) {
      billingTypes.push('CREDIT_CARD');
    } else if (meioNorm === 'pix') {
      billingTypes.push('PIX');
    } else if (meioNorm === 'cartao') {
      billingTypes.push('CREDIT_CARD');
    } else {
      if (permitePix !== false) billingTypes.push('PIX');
      if (permiteCartao !== false) billingTypes.push('CREDIT_CARD');
      if (!billingTypes.length) billingTypes.push('PIX');
    }

    const clubeNome = String(pag.clubeNome || '').trim();
    const donoUid = String(pag.donoUid || '').trim();
    let professorNome = '';
    if (donoUid) {
      try {
        const donoSnap = await db().collection('usuarios').doc(donoUid).get();
        professorNome = String(donoSnap.data()?.nome || '').trim();
      } catch {
        /* sem nome do dono */
      }
    }

    // description aparece no extrato Asaas — facilita filtrar por clube/professor
    // (Checkout às vezes não propaga externalReference para a cobrança)
    const descParts = [
      String(titulo).trim(),
      clubeNome ? `Clube: ${clubeNome}` : null,
      professorNome ? `Prof: ${professorNome}` : null,
      pag.clubeId ? `clubeId:${pag.clubeId}` : null,
      donoUid ? `donoUid:${donoUid}` : null,
      `pag:${pagamentoId}`,
    ].filter(Boolean);
    const descricaoAsaas = descParts.join(' | ').slice(0, 500);

    const name = String(
      clubeNome ? `${String(titulo).slice(0, 18)} · ${clubeNome}`.slice(0, 30) : titulo
    ).slice(0, 30);

    const body: Record<string, unknown> = {
      billingTypes,
      chargeTypes: [isSubscription ? 'RECURRENT' : 'DETACHED'],
      minutesToExpire: 60,
      externalReference: String(pagamentoId),
      callback: {
        successUrl: `${HOSTING}/pagamento/sucesso?pagamentoId=${encodeURIComponent(String(pagamentoId))}`,
        cancelUrl: `${HOSTING}/pagamento/cancelado`,
        expiredUrl: `${HOSTING}/pagamento/cancelado`,
      },
      items: [
        {
          name,
          description: descricaoAsaas.slice(0, 150),
          quantity: 1,
          value: amount,
          // 1x1 PNG — OpenAPI marca imageBase64 como required em alguns ambientes
          imageBase64:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5TkJggg==',
        },
      ],
    };

    if (isSubscription) {
      body.subscription = {
        cycle: 'MONTHLY',
        nextDueDate: todayISO(),
      };
    }

    // NÃO enviar customerData parcial.
    // Se customerData for enviado, a Asaas exige name + email + cpfCnpj (e pode exigir endereço).
    // O app não coleta CPF/CNPJ — o pagador preenche na tela do Checkout Asaas.
    // Docs: https://docs.asaas.com/docs/como-informar-os-dados-do-cliente
    const cpfCnpj = String(
      pag.cpfCnpj || pag.cpf || req.body?.cpfCnpj || ''
    ).replace(/\D/g, '');
    let email =
      String(pag.email || '').trim().toLowerCase() ||
      String(req.body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      try {
        const authUser = await getAuth().getUser(uid);
        email = String(authUser.email || '').trim().toLowerCase();
      } catch {
        /* sem e-mail no Auth */
      }
    }
    if (!email || !email.includes('@')) {
      try {
        const uSnap = await db().collection('usuarios').doc(uid).get();
        email = String(uSnap.data()?.email || '').trim().toLowerCase();
      } catch {
        /* sem e-mail */
      }
    }
    const nomeCliente = String(pag.nome || '').trim().slice(0, 100);
    const cpfOk = cpfCnpj.length === 11 || cpfCnpj.length === 14;
    if (nomeCliente && email.includes('@') && cpfOk) {
      const customerData: Record<string, string> = {
        name: nomeCliente,
        email,
        cpfCnpj,
      };
      if (pag.telefone) {
        const phone = String(pag.telefone).replace(/\D/g, '').replace(/^55/, '');
        if (phone) customerData.phone = phone;
      }
      body.customerData = customerData;
    }

    const checkout = await asaasFetch<{
      id: string;
      link?: string;
      status?: string;
    }>('/v3/checkouts', { method: 'POST', body });

    const url =
      checkout.link ||
      `${asaasCheckoutHost()}/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`;

    await pagRef.update({
      provedor: 'asaas',
      asaasCheckoutId: checkout.id,
      checkoutUrl: url,
      status: 'aguardando_pagamento',
      ciclo: String(ciclo) === 'mensal' ? 'mensal' : 'unico',
      meioPagamento: meioNorm === 'ambos' ? null : meioNorm,
      descontoPercent: Number(descontoPercent) || 0,
      ...(valorBase != null ? { valorBase: Number(valorBase) } : {}),
      valor: amount,
      descricaoAsaas,
      ...(professorNome ? { professorNome, donoNome: professorNome } : {}),
      atualizadoEm: FieldValue.serverTimestamp(),
    });

    res.json({
      sessionId: checkout.id,
      checkoutId: checkout.id,
      url,
      provedor: 'asaas',
      mode: isSubscription ? 'subscription' : 'payment',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    if (msg === 'UNAUTHORIZED') {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    if (msg.includes('ASAAS_API_KEY')) {
      res.status(503).json({ error: msg });
      return;
    }
    console.error('criarCheckoutAsaas', e);
    res.status(500).json({ error: msg.slice(0, 400) });
  }
});

/** Confirma após fechar o browser — consulta cobranças Asaas por externalReference. */
export const confirmarCheckoutAsaas = onRequest(FN_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  try {
    const uid = await requireUid(req as never);
    const { sessionId, checkoutId, pagamentoId } = req.body || {};
    const cid = String(checkoutId || sessionId || '');
    if (!pagamentoId) {
      res.status(400).json({ error: 'pagamentoId obrigatório' });
      return;
    }

    const pagRef = db().collection('pagamentos').doc(String(pagamentoId));
    const pagSnap = await pagRef.get();
    if (!pagSnap.exists || pagSnap.data()?.uid !== uid) {
      res.status(403).json({ error: 'Sem permissão' });
      return;
    }

    const already = String(pagSnap.data()?.status || '');
    if (already === 'aprovado' || already === 'liberado_admin') {
      res.json({ status: 'aprovado', provedor: 'asaas' });
      return;
    }

    // 1) Status do checkout (se soubermos o id)
    const asaasCheckoutId = cid || String(pagSnap.data()?.asaasCheckoutId || '');
    if (asaasCheckoutId) {
      try {
        const ch = await asaasFetch<{ status?: string; id?: string }>(
          `/v3/checkouts/${encodeURIComponent(asaasCheckoutId)}`
        );
        if (String(ch.status).toUpperCase() === 'PAID') {
          await syncPagamentoAprovado(String(pagamentoId), asaasCheckoutId, 'approved', {
            provedor: 'asaas',
            asaasCheckoutId,
          });
          res.json({ status: 'aprovado', provedor: 'asaas' });
          return;
        }
      } catch (e) {
        console.warn('[asaas] get checkout', e);
      }
    }

    // 2) Lista cobranças com externalReference = pagamentoId
    try {
      const list = await asaasFetch<{
        data?: {
          id: string;
          status: string;
          subscription?: string;
          netValue?: number;
          billingType?: string;
          anticipated?: boolean;
          estimatedCreditDate?: string;
          creditDate?: string;
        }[];
      }>('/v3/payments', {
        query: { externalReference: String(pagamentoId), limit: '10' },
      });
      const paid = (list.data || []).find((p) =>
        ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(String(p.status).toUpperCase())
      );
      if (paid) {
        const net = Number(paid.netValue);
        const statusUp = String(paid.status).toUpperCase();
        const eventHint =
          statusUp === 'RECEIVED' || statusUp === 'RECEIVED_IN_CASH'
            ? 'PAYMENT_RECEIVED'
            : 'PAYMENT_CONFIRMED';
        await syncPagamentoAprovado(String(pagamentoId), paid.id, 'approved', {
          provedor: 'asaas',
          asaasPaymentId: paid.id,
          asaasEvent: eventHint,
          asaasPaymentStatus: paid.status,
          ...(paid.billingType ? { billingType: paid.billingType } : {}),
          ...(paid.anticipated ? { anticipated: true } : {}),
          ...(paid.estimatedCreditDate
            ? { estimatedCreditDate: String(paid.estimatedCreditDate) }
            : {}),
          ...(paid.creditDate ? { creditDate: String(paid.creditDate) } : {}),
          ...(paid.subscription ? { asaasSubscriptionId: paid.subscription } : {}),
          ...(Number.isFinite(net) && net > 0
            ? { netValue: net, valorLiquidoDono: net }
            : {}),
        });
        res.json({ status: 'aprovado', provedor: 'asaas' });
        return;
      }
    } catch (e) {
      console.warn('[asaas] list payments', e);
    }

    res.json({ status: 'pendente', provedor: 'asaas' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    if (msg === 'UNAUTHORIZED') {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    console.error('confirmarCheckoutAsaas', e);
    res.status(500).json({ error: msg });
  }
});

function mapAsaasPaymentStatus(status: string): string {
  const s = String(status || '').toUpperCase();
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(s)) return 'approved';
  if (['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED'].includes(s)) return 'rejected';
  if (['DELETED', 'OVERDUE'].includes(s)) return 'cancelled';
  return 'pending';
}

/** Webhook Asaas — configure no painel para esta URL. */
export const webhookAsaasSetmatch = onRequest(FN_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  // Asaas envia o authToken no header `asaas-access-token`
  const expected = asaasWebhookToken.value()?.trim();
  if (expected) {
    const got = String(
      req.headers['asaas-access-token'] ||
        req.headers['Asaas-Access-Token'] ||
        ''
    ).trim();
    if (!got || got !== expected) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
  }

  // Responde 200 cedo; processa em seguida (Asaas exige confirmação rápida)
  res.status(200).json({ received: true });

  try {
    const event = String(req.body?.event || '');
    const payment = (req.body?.payment || req.body?.checkout || {}) as Record<
      string,
      unknown
    >;

    if (event.startsWith('CHECKOUT_')) {
      const checkoutId = String(payment.id || req.body?.checkout?.id || '');
      const externalReference = String(
        payment.externalReference || req.body?.checkout?.externalReference || ''
      );
      let pagamentoId = externalReference;
      if (!pagamentoId && checkoutId) {
        const snap = await db()
          .collection('pagamentos')
          .where('asaasCheckoutId', '==', checkoutId)
          .limit(1)
          .get();
        if (!snap.empty) pagamentoId = snap.docs[0].id;
      }
      if (!pagamentoId) return;

      if (event === 'CHECKOUT_PAID') {
        const netFromBody = Number(
          (payment as { netValue?: number }).netValue ??
            req.body?.payment?.netValue ??
            NaN
        );
        const billingType = payment.billingType
          ? String(payment.billingType)
          : req.body?.payment?.billingType
            ? String(req.body.payment.billingType)
            : null;
        await syncPagamentoAprovado(pagamentoId, checkoutId || pagamentoId, 'approved', {
          provedor: 'asaas',
          asaasCheckoutId: checkoutId || null,
          asaasEvent: event,
          ...(billingType ? { billingType } : {}),
          ...(Number.isFinite(netFromBody) && netFromBody > 0
            ? { netValue: netFromBody, valorLiquidoDono: netFromBody }
            : {}),
        });
      } else if (event === 'CHECKOUT_CANCELED' || event === 'CHECKOUT_EXPIRED') {
        await syncPagamentoAprovado(pagamentoId, checkoutId || pagamentoId, 'cancelled', {
          provedor: 'asaas',
          asaasEvent: event,
        });
      }
      return;
    }

    if (event.startsWith('PAYMENT_') || event.startsWith('SUBSCRIPTION_')) {
      const payId = String(payment.id || '');
      const externalReference = String(payment.externalReference || '');
      let pagamentoId = externalReference;

      if (!pagamentoId && payId) {
        const byPay = await db()
          .collection('pagamentos')
          .where('asaasPaymentId', '==', payId)
          .limit(1)
          .get();
        if (!byPay.empty) pagamentoId = byPay.docs[0].id;
      }

      // Checkout: payment.checkoutSession → asaasCheckoutId no Firestore
      const checkoutSession = payment.checkoutSession
        ? String(payment.checkoutSession)
        : '';
      if (!pagamentoId && checkoutSession) {
        const byCheckout = await db()
          .collection('pagamentos')
          .where('asaasCheckoutId', '==', checkoutSession)
          .limit(1)
          .get();
        if (!byCheckout.empty) pagamentoId = byCheckout.docs[0].id;
      }

      const subId = payment.subscription ? String(payment.subscription) : '';
      if (!pagamentoId && subId) {
        const bySub = await db()
          .collection('pagamentos')
          .where('asaasSubscriptionId', '==', subId)
          .limit(1)
          .get();
        if (!bySub.empty) pagamentoId = bySub.docs[0].id;
      }

      if (!pagamentoId) return;

      // Enquanto PENDING dá para editar description na Asaas
      if (
        event === 'PAYMENT_CREATED' ||
        String(payment.status || '').toUpperCase() === 'PENDING'
      ) {
        const pagSnap = await db().collection('pagamentos').doc(pagamentoId).get();
        if (pagSnap.exists && payId.startsWith('pay_')) {
          await aplicarDescricaoCobrancaAsaas(payId, pagSnap.data() || {}, pagamentoId);
          await pagSnap.ref.set(
            {
              asaasPaymentId: payId,
              ...(checkoutSession ? { asaasCheckoutId: checkoutSession } : {}),
              atualizadoEm: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }

      const mapped = mapAsaasPaymentStatus(String(payment.status || ''));
      if (
        event === 'PAYMENT_RECEIVED' ||
        event === 'PAYMENT_CONFIRMED' ||
        event === 'PAYMENT_ANTICIPATED' ||
        mapped === 'approved'
      ) {
        const billingType = payment.billingType ? String(payment.billingType) : null;
        const net = Number(payment.netValue);
        await syncPagamentoAprovado(pagamentoId, payId || pagamentoId, 'approved', {
          provedor: 'asaas',
          asaasPaymentId: payId || null,
          asaasSubscriptionId: subId || null,
          asaasEvent: event,
          asaasPaymentStatus: String(payment.status || ''),
          renovacao: Boolean(subId && event === 'PAYMENT_RECEIVED'),
          ...(billingType ? { billingType } : {}),
          ...(payment.anticipated === true ? { anticipated: true } : {}),
          ...(payment.estimatedCreditDate
            ? { estimatedCreditDate: String(payment.estimatedCreditDate) }
            : {}),
          ...(payment.creditDate ? { creditDate: String(payment.creditDate) } : {}),
          ...(Number.isFinite(net) && net > 0
            ? {
                netValue: net,
                valorLiquidoDono: net,
              }
            : {}),
        });
      } else if (mapped === 'rejected' || mapped === 'cancelled') {
        await syncPagamentoAprovado(pagamentoId, payId || pagamentoId, mapped, {
          provedor: 'asaas',
          asaasPaymentId: payId || null,
          asaasEvent: event,
        });
      }
    }

    if (event.startsWith('TRANSFER_')) {
      const transfer = (req.body?.transfer || {}) as Record<string, unknown>;
      const transferId = String(transfer.id || '');
      const externalReference = String(transfer.externalReference || '');
      if (!externalReference) return;
      const ref = db().collection('transferencias').doc(externalReference);
      const snap = await ref.get();
      if (!snap.exists) return;
      const statusMap: Record<string, string> = {
        TRANSFER_DONE: 'concluida',
        TRANSFER_FAILED: 'falhou',
        TRANSFER_CANCELLED: 'cancelada',
        TRANSFER_PENDING: 'pendente',
      };
      const st = statusMap[event] || String(transfer.status || 'pendente').toLowerCase();
      await ref.update({
        status: st,
        asaasTransferId: transferId || snap.data()?.asaasTransferId,
        failReason: transfer.failReason ? String(transfer.failReason) : null,
        atualizadoEm: FieldValue.serverTimestamp(),
      });

      // Se falhou após debitar, recredita saldo
      if ((event === 'TRANSFER_FAILED' || event === 'TRANSFER_CANCELLED') && !snap.data()?.recreditado) {
        const donoUid = String(snap.data()?.donoUid || '');
        const valor = Number(snap.data()?.valor || 0);
        if (donoUid && valor > 0) {
          await db()
            .collection('saldosFinanceiros')
            .doc(donoUid)
            .set(
              {
                saldoDisponivel: FieldValue.increment(valor),
                saldoTransferido: FieldValue.increment(-valor),
                atualizadoEm: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          await ref.update({ recreditado: true });
        }
      }
    }
  } catch (e) {
    console.error('webhookAsaasSetmatch', e);
  }
});

function moneyCents(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

async function asaasBalanceCents(): Promise<number | null> {
  try {
    const bal = await asaasFetch<{ balance?: number }>('/v3/finance/balance');
    return moneyCents(bal.balance);
  } catch (e) {
    console.warn('[asaas] finance/balance', e);
    return null;
  }
}

function msgErroTransferenciaAsaas(raw: string, asaasCents: number | null): string {
  const low = raw.toLowerCase();
  if (low.includes('saldo insuficiente')) {
    const asaasTxt =
      asaasCents != null
        ? ` Saldo liberado na Asaas agora: R$ ${(asaasCents / 100).toFixed(2)}.`
        : '';
    return (
      'O valor já está no seu extrato do app, mas a conta Asaas da plataforma ' +
      'ainda não liberou esse saldo para PIX (cartão pode levar 1–2 dias úteis).' +
      asaasTxt +
      ' Seu saldo no app continua disponível.'
    );
  }
  return raw;
}

/** Saldo/PIX do dono; admin temporário opera a conta do organizador. */
async function resolveDonoFinanceiroUid(uid: string): Promise<string> {
  try {
    const uSnap = await db().collection('usuarios').doc(uid).get();
    const d = uSnap.data() || {};
    if (String(d.role || '') === 'admin_temporario' && d.organizadorUid) {
      return String(d.organizadorUid);
    }
  } catch {
    /* usa uid */
  }
  return uid;
}

/** Salva chave PIX do professor (sem criar conta Asaas). */
export const salvarChavePixDono = onRequest(FN_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }
  try {
    const uid = await requireUid(req as never);
    const donoUid = await resolveDonoFinanceiroUid(uid);
    const { pixTipo, pixChave } = req.body || {};
    const tipo = String(pixTipo || '').toUpperCase() as PixKeyType;
    if (!['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'].includes(tipo)) {
      res.status(400).json({ error: 'pixTipo inválido (CPF, CNPJ, EMAIL, PHONE, EVP)' });
      return;
    }
    const chave = normalizePixKey(tipo, String(pixChave || ''));
    if (!chave) {
      res.status(400).json({ error: 'pixChave obrigatória' });
      return;
    }
    await db()
      .collection('saldosFinanceiros')
      .doc(donoUid)
      .set(
        {
          donoUid,
          pixTipo: tipo,
          pixChave: chave,
          atualizadoEm: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    res.json({ ok: true, pixTipo: tipo, pixChave: chave });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    if (msg === 'UNAUTHORIZED') {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

/**
 * Transfere saldo disponível do professor para chave PIX (sem conta Asaas).
 * O dinheiro sai da conta Asaas da plataforma.
 */
export const transferirSaldoPix = onRequest(FN_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  try {
    const uid = await requireUid(req as never);
    const donoUid = await resolveDonoFinanceiroUid(uid);
    const { valor, pixTipo, pixChave, tudo } = req.body || {};
    const transferirTudo =
      tudo === true || tudo === 'true' || String(valor || '').toLowerCase() === 'tudo';

    const asaasCents = await asaasBalanceCents();
    const saldoRef = db().collection('saldosFinanceiros').doc(donoUid);

    const result = await db().runTransaction(async (tx) => {
      const snap = await tx.get(saldoRef);
      const data = snap.data() || {};
      const disponivelCents = moneyCents(data.saldoDisponivel);

      let pedirCents = transferirTudo ? disponivelCents : moneyCents(valor);
      if (!transferirTudo && pedirCents > disponivelCents && pedirCents - disponivelCents <= 1) {
        pedirCents = disponivelCents;
      }
      if (pedirCents > disponivelCents) {
        throw new Error(
          `Saldo insuficiente no app. Disponível: R$ ${(disponivelCents / 100).toFixed(2)}`
        );
      }
      if (pedirCents < 100) {
        throw new Error('Valor mínimo R$ 1,00');
      }

      if (asaasCents != null && pedirCents > asaasCents) {
        throw new Error(
          msgErroTransferenciaAsaas('Saldo insuficiente para realizar a operação.', asaasCents)
        );
      }

      const amount = pedirCents / 100;
      const tipo = String(pixTipo || data.pixTipo || 'EVP').toUpperCase() as PixKeyType;
      const chaveRaw = String(pixChave || data.pixChave || '');
      if (!['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'].includes(tipo) || !chaveRaw) {
        throw new Error('Cadastre sua chave PIX antes de transferir.');
      }
      const chave = normalizePixKey(tipo, chaveRaw);

      const transfRef = db().collection('transferencias').doc();
      tx.set(transfRef, {
        donoUid,
        solicitadoPorUid: uid,
        valor: amount,
        pixTipo: tipo,
        pixChave: chave,
        status: 'processando',
        criadoEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      tx.set(
        saldoRef,
        {
          donoUid,
          saldoDisponivel: FieldValue.increment(-amount),
          saldoTransferido: FieldValue.increment(amount),
          pixTipo: tipo,
          pixChave: chave,
          atualizadoEm: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { transfId: transfRef.id, tipo, chave, amount };
    });

    const amount = result.amount;

    try {
      const transfer = await asaasFetch<{ id: string; status?: string }>('/v3/transfers', {
        method: 'POST',
        body: {
          value: amount,
          pixAddressKey: result.chave,
          pixAddressKeyType: result.tipo,
          operationType: 'PIX',
          description: `Saque Rally Up ${result.transfId}`,
          externalReference: result.transfId,
        },
      });

      await db()
        .collection('transferencias')
        .doc(result.transfId)
        .update({
          asaasTransferId: transfer.id,
          status:
            String(transfer.status).toUpperCase() === 'DONE' ? 'concluida' : 'pendente',
          atualizadoEm: FieldValue.serverTimestamp(),
        });

      res.json({
        ok: true,
        transferenciaId: result.transfId,
        asaasTransferId: transfer.id,
        status: transfer.status,
      });
    } catch (apiErr: unknown) {
      await saldoRef.set(
        {
          saldoDisponivel: FieldValue.increment(amount),
          saldoTransferido: FieldValue.increment(-amount),
          atualizadoEm: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const raw = apiErr instanceof Error ? apiErr.message : 'Erro Asaas';
      const failReason = msgErroTransferenciaAsaas(raw, asaasCents);
      await db()
        .collection('transferencias')
        .doc(result.transfId)
        .update({
          status: 'falhou',
          failReason,
          recreditado: true,
          atualizadoEm: FieldValue.serverTimestamp(),
        });
      throw new Error(failReason);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    if (msg === 'UNAUTHORIZED') {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    console.error('transferirSaldoPix', e);
    res.status(400).json({ error: msg.slice(0, 500) });
  }
});

/** Dono libera acesso manualmente (credita saldo como Asaas). */
export const liberarPagamentoDono = onRequest(FN_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }
  try {
    const uid = await requireUid(req as never);
    const { pagamentoId } = req.body || {};
    if (!pagamentoId) {
      res.status(400).json({ error: 'pagamentoId obrigatório' });
      return;
    }
    const snap = await db().collection('pagamentos').doc(String(pagamentoId)).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Pagamento não encontrado' });
      return;
    }
    if (snap.data()?.donoUid !== uid) {
      res.status(403).json({ error: 'Só o dono pode liberar' });
      return;
    }
    await syncPagamentoAprovado(String(pagamentoId), `manual_${pagamentoId}`, 'approved', {
      provedor: snap.data()?.provedor || 'asaas',
      liberadoPeloAdmin: true,
      statusOverride: 'liberado_admin',
    });
    await db()
      .collection('pagamentos')
      .doc(String(pagamentoId))
      .update({
        status: 'liberado_admin',
        liberadoPeloAdmin: true,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    if (msg === 'UNAUTHORIZED') {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

/** Consulta saldo + chave PIX do dono logado. */
export const consultarSaldoFinanceiro = onRequest(FN_OPTS, async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }
  try {
    const uid = await requireUid(req as never);
    const donoUid = await resolveDonoFinanceiroUid(uid);
    const snap = await db().collection('saldosFinanceiros').doc(donoUid).get();
    const d = snap.data() || {};
    const disponivelCents = moneyCents(d.saldoDisponivel);
    const asaasCents = await asaasBalanceCents();
    res.json({
      saldoDisponivel: disponivelCents / 100,
      saldoALiberar: moneyCents(d.saldoALiberar) / 100,
      saldoTotalRecebido: moneyCents(d.saldoTotalRecebido) / 100,
      saldoTransferido: moneyCents(d.saldoTransferido) / 100,
      /** true = números do ledger já descontam a taxa Asaas (não precisa recalcular no app). */
      valoresEmLiquido: d.valoresEmLiquido !== false,
      saldoAsaasPlataforma: asaasCents != null ? asaasCents / 100 : null,
      porModalidade: d.porModalidade || {},
      porTipo: d.porTipo || {},
      pixTipo: d.pixTipo || null,
      pixChave: d.pixChave || null,
      provedor: 'asaas',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    if (msg === 'UNAUTHORIZED') {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    res.status(500).json({ error: msg });
  }
});
