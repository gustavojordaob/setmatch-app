import Stripe from 'stripe';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { syncPagamentoAprovado } from './pagamentosSync';

const stripeSecret = defineString('STRIPE_SECRET_KEY', { default: '' });
const stripeWebhookSecret = defineString('STRIPE_WEBHOOK_SECRET', { default: '' });
/** Comissão Setmatch em % (0–100). 0 = sem taxa de plataforma. */
const feePercent = defineString('STRIPE_PLATFORM_FEE_PERCENT', { default: '0' });

const HOSTING = 'https://setmatch-app-fabrica.web.app';
const FN_OPTS = { cors: true, region: 'southamerica-east1' as const };

function db() {
  return getFirestore();
}

function getStripe(): Stripe {
  const key = stripeSecret.value();
  if (!key) throw new Error('STRIPE_SECRET_KEY não configurado em functions/.env');
  return new Stripe(key);
}

async function requireUid(req: { headers: Record<string, unknown> }): Promise<string> {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('UNAUTHORIZED');
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}

function toCents(valor: number): number {
  return Math.round(Number(valor) * 100);
}

function feeCents(amountCents: number): number {
  const pct = Math.max(0, Math.min(100, Number(feePercent.value() || 0)));
  return Math.round((amountCents * pct) / 100);
}

/**
 * Cria Stripe Checkout Session.
 * - ciclo mensal + cartão → mode: subscription (recorrente)
 * - demais casos → mode: payment (PIX e/ou cartão único)
 * Promo: o app envia `valor` já com desconto do meio escolhido.
 */
export const criarCheckoutStripe = onRequest(FN_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  try {
    const stripe = getStripe();
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

    const amount = toCents(Number(valor));
    if (amount < 50) {
      res.status(400).json({ error: 'Valor mínimo R$ 0,50' });
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

    // Assinatura Stripe no BR: cartão. PIX mensal = payment one-shot.
    const isSubscription = String(ciclo) === 'mensal' && meioNorm !== 'pix';

    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [];
    if (isSubscription) {
      paymentMethodTypes.push('card');
    } else if (meioNorm === 'pix') {
      paymentMethodTypes.push('pix');
    } else if (meioNorm === 'cartao') {
      paymentMethodTypes.push('card');
    } else {
      if (permiteCartao !== false) paymentMethodTypes.push('card');
      if (permitePix !== false) paymentMethodTypes.push('pix');
      if (paymentMethodTypes.length === 0) paymentMethodTypes.push('card');
    }

    let connectedAccountId: string | undefined;
    let chargesEnabled = false;
    if (pag.clubeId) {
      const clubeSnap = await db().collection('clubes').doc(String(pag.clubeId)).get();
      if (clubeSnap.exists) {
        const c = clubeSnap.data()!;
        connectedAccountId = c.stripeAccountId ? String(c.stripeAccountId) : undefined;
        chargesEnabled = Boolean(c.stripeChargesEnabled);
      }
    }

    const metaBase: Record<string, string> = {
      uid,
      pagamentoId: String(pagamentoId),
      tipo: String(pag.tipo || ''),
      ciclo: String(ciclo),
      clubeId: String(pag.clubeId || ''),
      meio: meioNorm,
      descontoPercent: String(descontoPercent || 0),
    };

    const productName = String(titulo).slice(0, 120);
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: isSubscription ? 'subscription' : 'payment',
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'brl',
            unit_amount: amount,
            ...(isSubscription
              ? { recurring: { interval: 'month' as const } }
              : {}),
            product_data: {
              name: productName,
              metadata: {
                pagamentoId: String(pagamentoId),
                tipo: String(pag.tipo || ''),
              },
            },
          },
        },
      ],
      client_reference_id: String(pagamentoId),
      customer_email: pag.email ? String(pag.email) : undefined,
      success_url: `${HOSTING}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${HOSTING}/pagamento/cancelado`,
      metadata: metaBase,
    };

    const fee = feeCents(amount);
    const feePct = Math.max(0, Math.min(100, Number(feePercent.value() || 0)));

    if (isSubscription) {
      params.subscription_data = {
        metadata: metaBase,
        ...(connectedAccountId && chargesEnabled
          ? {
              transfer_data: { destination: connectedAccountId },
              ...(feePct > 0 ? { application_fee_percent: feePct } : {}),
            }
          : {}),
      };
    } else {
      params.payment_intent_data = {
        metadata: metaBase,
      };
      if (connectedAccountId && chargesEnabled) {
        params.payment_intent_data = {
          ...params.payment_intent_data,
          transfer_data: { destination: connectedAccountId },
          ...(fee > 0 ? { application_fee_amount: fee } : {}),
        };
      }
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(params);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (paymentMethodTypes.includes('pix') && /pix/i.test(msg)) {
        params.payment_method_types = paymentMethodTypes.filter((t) => t !== 'pix');
        if (!params.payment_method_types?.length) {
          params.payment_method_types = ['card'];
        }
        session = await stripe.checkout.sessions.create(params);
      } else {
        throw err;
      }
    }

    const subId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    await pagRef.update({
      provedor: 'stripe',
      stripeSessionId: session.id,
      ...(subId ? { stripeSubscriptionId: subId } : {}),
      checkoutUrl: session.url,
      status: 'aguardando_pagamento',
      ciclo: String(ciclo) === 'mensal' ? 'mensal' : 'unico',
      meioPagamento: meioNorm === 'ambos' ? null : meioNorm,
      descontoPercent: Number(descontoPercent) || 0,
      ...(valorBase != null ? { valorBase: Number(valorBase) } : {}),
      valor: Number(valor),
      atualizadoEm: FieldValue.serverTimestamp(),
    });

    res.json({
      sessionId: session.id,
      url: session.url,
      provedor: 'stripe',
      mode: isSubscription ? 'subscription' : 'payment',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    if (msg === 'UNAUTHORIZED') {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    if (msg.includes('STRIPE_SECRET_KEY')) {
      res.status(503).json({ error: msg });
      return;
    }
    console.error('criarCheckoutStripe', e);
    res.status(500).json({ error: msg });
  }
});

/** Após fechar o browser — confirma sessão no Stripe e sincroniza Firestore. */
export const confirmarCheckoutStripe = onRequest(FN_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  try {
    const stripe = getStripe();
    const uid = await requireUid(req as never);
    const { sessionId, pagamentoId } = req.body || {};
    if (!sessionId || !pagamentoId) {
      res.status(400).json({ error: 'sessionId e pagamentoId obrigatórios' });
      return;
    }

    const pagRef = db().collection('pagamentos').doc(String(pagamentoId));
    const pagSnap = await pagRef.get();
    if (!pagSnap.exists || pagSnap.data()?.uid !== uid) {
      res.status(403).json({ error: 'Pagamento inválido' });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(String(sessionId), {
      expand: ['subscription'],
    });
    if (session.metadata?.pagamentoId && session.metadata.pagamentoId !== String(pagamentoId)) {
      res.status(400).json({ error: 'Sessão não corresponde ao pagamento' });
      return;
    }

    const paid =
      session.payment_status === 'paid' ||
      (session.mode === 'subscription' &&
        (session.status === 'complete' || session.payment_status === 'paid'));

    if (paid) {
      const paymentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || session.id;
      const subId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription && typeof session.subscription === 'object'
            ? session.subscription.id
            : undefined;
      await syncPagamentoAprovado(String(pagamentoId), paymentId, 'approved', {
        provedor: 'stripe',
        stripeSessionId: session.id,
        stripeStatus: session.payment_status,
        ...(subId ? { stripeSubscriptionId: subId } : {}),
      });
      res.json({ ok: true, status: 'aprovado' });
      return;
    }

    res.json({
      ok: true,
      status: session.payment_status === 'unpaid' ? 'aguardando_pagamento' : session.payment_status,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    if (msg === 'UNAUTHORIZED') {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    console.error('confirmarCheckoutStripe', e);
    res.status(500).json({ error: msg });
  }
});

export const webhookStripeSetmatch = onRequest(FN_OPTS, async (req, res) => {
  const stripe = (() => {
    try {
      return getStripe();
    } catch {
      return null;
    }
  })();

  if (!stripe) {
    res.status(503).send('Stripe não configurado');
    return;
  }

  let event: Stripe.Event;
  const whSecret = stripeWebhookSecret.value();
  try {
    if (whSecret) {
      const sig = req.headers['stripe-signature'];
      if (!sig || typeof sig !== 'string') {
        res.status(400).send('Missing stripe-signature');
        return;
      }
      const raw =
        (req as { rawBody?: Buffer }).rawBody ||
        Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      event = stripe.webhooks.constructEvent(raw, sig, whSecret);
    } else {
      // Sem secret (dev): confia no body — configure STRIPE_WEBHOOK_SECRET em produção
      event = req.body as Stripe.Event;
      console.warn('webhookStripe: STRIPE_WEBHOOK_SECRET vazio — validação de assinatura desligada');
    }
  } catch (err) {
    console.error('webhook signature', err);
    res.status(400).send('Webhook Error');
    return;
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const pagamentoId = session.metadata?.pagamentoId || session.client_reference_id;
      const paid =
        session.payment_status === 'paid' ||
        (session.mode === 'subscription' && session.status === 'complete');
      if (pagamentoId && paid) {
        const paymentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || session.id;
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : undefined;
        await syncPagamentoAprovado(pagamentoId, paymentId, 'approved', {
          provedor: 'stripe',
          stripeSessionId: session.id,
          stripeStatus: session.payment_status,
          ...(subId ? { stripeSubscriptionId: subId } : {}),
        });
      }
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const pagamentoId = session.metadata?.pagamentoId || session.client_reference_id;
      if (pagamentoId) {
        await syncPagamentoAprovado(pagamentoId, session.id, 'rejected', {
          provedor: 'stripe',
          stripeSessionId: session.id,
        });
      }
    }

    // Renovação mensal da assinatura — estende vigenteAte
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const subRaw = (invoice as { subscription?: string | { id: string } | null }).subscription;
      const subId = typeof subRaw === 'string' ? subRaw : subRaw?.id;
      let pagamentoId =
        (invoice as { metadata?: { pagamentoId?: string } }).metadata?.pagamentoId ||
        undefined;

      if (!pagamentoId && subId) {
        const snap = await db()
          .collection('pagamentos')
          .where('stripeSubscriptionId', '==', subId)
          .limit(1)
          .get();
        if (!snap.empty) pagamentoId = snap.docs[0].id;
      }

      if (pagamentoId && invoice.billing_reason !== 'subscription_create') {
        const pi = (invoice as { payment_intent?: string | { id: string } | null }).payment_intent;
        const paymentId = pi
          ? String(typeof pi === 'string' ? pi : pi.id)
          : invoice.id;
        await syncPagamentoAprovado(pagamentoId, paymentId, 'approved', {
          provedor: 'stripe',
          stripeInvoiceId: invoice.id,
          stripeSubscriptionId: subId || null,
          renovacao: true,
        });
      } else if (pagamentoId && subId) {
        await db()
          .collection('pagamentos')
          .doc(pagamentoId)
          .update({
            stripeSubscriptionId: subId,
            atualizadoEm: FieldValue.serverTimestamp(),
          });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const snap = await db()
        .collection('pagamentos')
        .where('stripeSubscriptionId', '==', sub.id)
        .limit(1)
        .get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({
          status: 'cancelado',
          stripeSubscriptionStatus: sub.status,
          atualizadoEm: FieldValue.serverTimestamp(),
        });
      }
    }

    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      const clubes = await db()
        .collection('clubes')
        .where('stripeAccountId', '==', account.id)
        .limit(5)
        .get();
      for (const d of clubes.docs) {
        await d.ref.update({
          stripeChargesEnabled: Boolean(account.charges_enabled),
          stripePayoutsEnabled: Boolean(account.payouts_enabled),
          stripeDetailsSubmitted: Boolean(account.details_submitted),
          atualizadoEm: FieldValue.serverTimestamp(),
        });
      }
    }
  } catch (e) {
    console.error('webhookStripe handler', e);
  }

  res.json({ received: true });
});

/** Dono do clube: cria conta Express + link de onboarding. */
export const stripeConnectOnboarding = onRequest(FN_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  try {
    const stripe = getStripe();
    const uid = await requireUid(req as never);
    const { clubeId } = req.body || {};
    if (!clubeId) {
      res.status(400).json({ error: 'clubeId obrigatório' });
      return;
    }

    const clubeRef = db().collection('clubes').doc(String(clubeId));
    const clubeSnap = await clubeRef.get();
    if (!clubeSnap.exists) {
      res.status(404).json({ error: 'Clube não encontrado' });
      return;
    }
    const clube = clubeSnap.data()!;
    if (clube.donoUid !== uid) {
      res.status(403).json({ error: 'Só o dono do clube pode conectar Stripe' });
      return;
    }

    let accountId = clube.stripeAccountId ? String(clube.stripeAccountId) : '';
    if (!accountId) {
      const user = await getAuth().getUser(uid);
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'BR',
        email: user.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: String(clube.nome || 'Clube Setmatch').slice(0, 100),
          product_description: 'Aulas, rankings e torneios via Setmatch',
        },
        metadata: { clubeId: String(clubeId), donoUid: uid },
      });
      accountId = account.id;
      await clubeRef.update({
        stripeAccountId: accountId,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${HOSTING}/pagamento/stripe-connect?clubeId=${clubeId}&refresh=1`,
      return_url: `${HOSTING}/pagamento/stripe-connect?clubeId=${clubeId}&ok=1`,
      type: 'account_onboarding',
    });

    res.json({ url: link.url, accountId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    if (msg === 'UNAUTHORIZED') {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    console.error('stripeConnectOnboarding', e);
    res.status(500).json({ error: msg });
  }
});

/** Atualiza status Connect do clube após onboarding. */
export const stripeConnectStatus = onRequest(FN_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  try {
    const stripe = getStripe();
    const uid = await requireUid(req as never);
    const { clubeId } = req.body || {};
    if (!clubeId) {
      res.status(400).json({ error: 'clubeId obrigatório' });
      return;
    }

    const clubeRef = db().collection('clubes').doc(String(clubeId));
    const clubeSnap = await clubeRef.get();
    if (!clubeSnap.exists || clubeSnap.data()?.donoUid !== uid) {
      res.status(403).json({ error: 'Sem permissão' });
      return;
    }

    const accountId = clubeSnap.data()?.stripeAccountId;
    if (!accountId) {
      res.json({
        connected: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      });
      return;
    }

    const account = await stripe.accounts.retrieve(String(accountId));
    const patch = {
      stripeChargesEnabled: Boolean(account.charges_enabled),
      stripePayoutsEnabled: Boolean(account.payouts_enabled),
      stripeDetailsSubmitted: Boolean(account.details_submitted),
      atualizadoEm: FieldValue.serverTimestamp(),
    };
    await clubeRef.update(patch);

    res.json({
      connected: true,
      accountId,
      chargesEnabled: patch.stripeChargesEnabled,
      payoutsEnabled: patch.stripePayoutsEnabled,
      detailsSubmitted: patch.stripeDetailsSubmitted,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro';
    if (msg === 'UNAUTHORIZED') {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    console.error('stripeConnectStatus', e);
    res.status(500).json({ error: msg });
  }
});
