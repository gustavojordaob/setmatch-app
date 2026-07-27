"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookMercadoPagoSetmatch = exports.criarPreferenciaSetmatch = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const v2_1 = require("firebase-functions/v2");
(0, app_1.initializeApp)();
(0, v2_1.setGlobalOptions)({ region: 'southamerica-east1' });
/** Token MP via functions/.env (MP_ACCESS_TOKEN=APP_USR-...). Sem Secret Manager no MVP. */
const mpAccessToken = (0, params_1.defineString)('MP_ACCESS_TOKEN', { default: '' });
const db = (0, firestore_1.getFirestore)();
async function requireUid(req) {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token)
        throw new Error('UNAUTHORIZED');
    const decoded = await (0, auth_1.getAuth)().verifyIdToken(token);
    return decoded.uid;
}
function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}
/**
 * Cria preferência Checkout Pro (PIX + cartão 1x conforme flags).
 * ACCESS_TOKEN fica só no secret — nunca no app.
 */
exports.criarPreferenciaSetmatch = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido' });
        return;
    }
    try {
        const token = mpAccessToken.value();
        if (!token) {
            res.status(503).json({
                error: 'MP_ACCESS_TOKEN não configurado em functions/.env',
            });
            return;
        }
        const uid = await requireUid(req);
        const { pagamentoId, titulo, valor, ciclo = 'unico', permitePix = true, permiteCartao = true, } = req.body || {};
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
        const pag = pagSnap.data();
        if (pag.uid !== uid) {
            res.status(403).json({ error: 'Pagamento de outro usuário' });
            return;
        }
        const excluded = [{ id: 'ticket' }];
        if (!permitePix)
            excluded.push({ id: 'bank_transfer' });
        if (!permiteCartao) {
            excluded.push({ id: 'credit_card' }, { id: 'debit_card' });
        }
        const projectId = process.env.GCLOUD_PROJECT || 'setmatch-app-fabrica';
        const webhookUrl = `https://southamerica-east1-${projectId}.cloudfunctions.net/webhookMercadoPagoSetmatch`;
        const preferenceBody = {
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
            statement_descriptor: 'SETMATCH',
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
        const pref = JSON.parse(mpText);
        await pagRef.update({
            preferenceId: pref.id,
            initPoint: pref.init_point,
            sandboxInitPoint: pref.sandbox_init_point,
            status: 'aguardando_pagamento',
            atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
        });
        res.json({
            preferenceId: pref.id,
            initPoint: pref.init_point,
            sandboxInitPoint: pref.sandbox_init_point,
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro';
        if (msg === 'UNAUTHORIZED') {
            res.status(401).json({ error: 'Não autenticado' });
            return;
        }
        console.error(e);
        res.status(500).json({ error: msg });
    }
});
async function syncPagamentoAprovado(pagamentoId, paymentId, status) {
    const pagRef = db.collection('pagamentos').doc(pagamentoId);
    const snap = await pagRef.get();
    if (!snap.exists)
        return;
    const pag = snap.data();
    const aprovado = status === 'approved';
    const patch = {
        paymentId,
        mpStatus: status,
        atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
    };
    if (aprovado) {
        patch.status = 'aprovado';
        if (pag.ciclo === 'mensal') {
            patch.vigenteAte = addMonths(new Date(), 1);
        }
    }
    else if (status === 'rejected' || status === 'cancelled') {
        patch.status = status === 'cancelled' ? 'cancelado' : 'recusado';
    }
    else if (status === 'pending' || status === 'in_process') {
        patch.status = 'aguardando_pagamento';
    }
    await pagRef.update(patch);
    if (!aprovado)
        return;
    // Ativa matrícula de aulas
    if (pag.tipo === 'aula' && pag.clubeId && pag.uid) {
        const mats = await db
            .collection('matriculas')
            .where('clubeId', '==', pag.clubeId)
            .where('uid', '==', pag.uid)
            .limit(1)
            .get();
        if (!mats.empty) {
            await mats.docs[0].ref.update({
                status: 'ativo',
                pagamentoId,
                atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
            });
        }
    }
    // Torneio: marca inscrição como paga
    if (pag.tipo === 'torneio' && pag.torneioId && pag.uid) {
        await db
            .collection('torneios')
            .doc(pag.torneioId)
            .collection('inscritos')
            .doc(pag.uid)
            .set({
            pago: true,
            pagamentoId,
            pagoEm: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    // Ranking: marca membro como adimplente (campo no classificacao se existir)
    if (pag.tipo === 'ranking' && pag.rankingId && pag.uid) {
        await db
            .collection('rankings')
            .doc(pag.rankingId)
            .collection('classificacao')
            .doc(pag.uid)
            .set({
            pagamentoOk: true,
            pagamentoId,
            atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
}
exports.webhookMercadoPagoSetmatch = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    res.status(200).send('OK');
    try {
        const token = mpAccessToken.value();
        if (!token) {
            console.error('MP_ACCESS_TOKEN ausente no webhook');
            return;
        }
        const type = req.query.type || req.body?.type || req.body?.topic;
        const dataId = req.query['data.id'] ||
            req.body?.data?.id ||
            req.query.id ||
            req.body?.id;
        if (String(type) !== 'payment' || !dataId)
            return;
        const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!payRes.ok) {
            console.error('MP payment fetch failed', await payRes.text());
            return;
        }
        const payment = (await payRes.json());
        const pagamentoId = payment.external_reference;
        if (!pagamentoId)
            return;
        await syncPagamentoAprovado(pagamentoId, String(payment.id), payment.status);
    }
    catch (e) {
        console.error('webhook error', e);
    }
});
//# sourceMappingURL=index.js.map