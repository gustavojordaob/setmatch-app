import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { wipeSetmatchUser } from './deleteAccount';
import { syncPagamentoAprovado } from './pagamentosSync';

export {
  criarCheckoutStripe,
  confirmarCheckoutStripe,
  webhookStripeSetmatch,
  stripeConnectOnboarding,
  stripeConnectStatus,
} from './stripeHandlers';

export {
  stravaExchangeCode,
  stravaDisconnect,
  stravaSyncToday,
} from './stravaHandlers';

export { atualizarNoticias, atualizarNoticiasManual } from './noticiasHandlers';

initializeApp();
setGlobalOptions({ region: 'southamerica-east1' });

/** Token MP legado — app usa Stripe; mantido por compatibilidade. */
const mpAccessToken = defineString('MP_ACCESS_TOKEN', { default: '' });
const db = getFirestore();

async function requireUid(req: { headers: Record<string, unknown> }): Promise<string> {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('UNAUTHORIZED');
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}

/**
 * @deprecated Preferir criarCheckoutStripe
 * Cria preferência Checkout Pro (PIX + cartão 1x conforme flags).
 */
export const criarPreferenciaSetmatch = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido' });
      return;
    }

    try {
      const token = mpAccessToken.value();
      if (!token) {
        res.status(503).json({
          error: 'MP desativado. Use Stripe (criarCheckoutStripe).',
        });
        return;
      }

      const uid = await requireUid(req as never);
      const {
        pagamentoId,
        titulo,
        valor,
        ciclo = 'unico',
        permitePix = true,
        permiteCartao = true,
      } = req.body || {};

      if (!pagamentoId || !titulo || !valor) {
        res.status(400).json({ error: 'pagamentoId, titulo e valor são obrigatórios' });
        return;
      }

      const pagRef = db.collection('pagamentos').doc(String(pagamentoId));
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

      const excluded: Array<{ id: string }> = [{ id: 'ticket' }];
      if (!permitePix) excluded.push({ id: 'bank_transfer' });
      if (!permiteCartao) {
        excluded.push({ id: 'credit_card' }, { id: 'debit_card' });
      }

      const projectId = process.env.GCLOUD_PROJECT || 'setmatch-app-fabrica';
      const webhookUrl = `https://southamerica-east1-${projectId}.cloudfunctions.net/webhookMercadoPagoSetmatch`;

      const preferenceBody: Record<string, unknown> = {
        items: [
          {
            title: String(titulo).slice(0, 120),
            quantity: 1,
            currency_id: 'BRL',
            unit_price: Number(valor),
          },
        ],
        payer: {
          email: pag.email || undefined,
        },
        back_urls: {
          success: 'setmatch://pagamento/sucesso',
          failure: 'setmatch://pagamento/falha',
          pending: 'setmatch://pagamento/pendente',
        },
        auto_return: 'approved',
        external_reference: String(pagamentoId),
        notification_url: webhookUrl,
        statement_descriptor: 'RALLYUP',
        payment_methods: {
          excluded_payment_types: excluded,
          installments: 1,
          default_installments: 1,
        },
        metadata: {
          uid,
          pagamentoId: String(pagamentoId),
          tipo: pag.tipo || '',
          ciclo: String(ciclo),
          clubeId: pag.clubeId || '',
        },
      };

      const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(preferenceBody),
      });

      const mpText = await mpRes.text();
      if (!mpRes.ok) {
        res.status(502).json({ error: 'Falha Mercado Pago', detalhe: mpText });
        return;
      }

      const pref = JSON.parse(mpText) as {
        id: string;
        init_point: string;
        sandbox_init_point: string;
      };

      await pagRef.update({
        preferenceId: pref.id,
        initPoint: pref.init_point,
        sandboxInitPoint: pref.sandbox_init_point,
        status: 'aguardando_pagamento',
        atualizadoEm: FieldValue.serverTimestamp(),
      });

      res.json({
        preferenceId: pref.id,
        initPoint: pref.init_point,
        sandboxInitPoint: pref.sandbox_init_point,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro';
      if (msg === 'UNAUTHORIZED') {
        res.status(401).json({ error: 'Não autenticado' });
        return;
      }
      console.error(e);
      res.status(500).json({ error: msg });
    }
  }
);

export const webhookMercadoPagoSetmatch = onRequest(
  { cors: true },
  async (req, res) => {
    res.status(200).send('OK');

    try {
      const token = mpAccessToken.value();
      if (!token) {
        console.error('MP_ACCESS_TOKEN ausente no webhook');
        return;
      }

      const type = req.query.type || req.body?.type || req.body?.topic;
      const dataId =
        req.query['data.id'] ||
        req.body?.data?.id ||
        req.query.id ||
        req.body?.id;

      if (String(type) !== 'payment' || !dataId) return;

      const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!payRes.ok) {
        console.error('MP payment fetch failed', await payRes.text());
        return;
      }
      const payment = (await payRes.json()) as {
        id: number;
        status: string;
        external_reference?: string;
      };

      const pagamentoId = payment.external_reference;
      if (!pagamentoId) return;

      await syncPagamentoAprovado(pagamentoId, String(payment.id), payment.status, {
        provedor: 'mercadopago',
        mpStatus: payment.status,
      });
    } catch (e) {
      console.error('webhook error', e);
    }
  }
);

/**
 * Exclusão permanente de conta (App Store / Play / LGPD).
 * POST + Authorization: Bearer <Firebase ID token>
 */
export const excluirConta = onRequest({ cors: true, timeoutSeconds: 300 }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido' });
    return;
  }

  try {
    const uid = await requireUid(req as never);
    await wipeSetmatchUser(uid);
    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao excluir conta';
    if (msg === 'UNAUTHORIZED') {
      res.status(401).json({ ok: false, error: 'Não autorizado' });
      return;
    }
    console.error('excluirConta', e);
    res.status(500).json({ ok: false, error: msg });
  }
});
