"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPagamentoAprovado = syncPagamentoAprovado;
const firestore_1 = require("firebase-admin/firestore");
function db() {
    return (0, firestore_1.getFirestore)();
}
function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}
/** Marca pagamento aprovado/recusado e libera matrícula / torneio / ranking. */
async function syncPagamentoAprovado(pagamentoId, paymentId, status, extra) {
    const pagRef = db().collection('pagamentos').doc(pagamentoId);
    const snap = await pagRef.get();
    if (!snap.exists)
        return;
    const pag = snap.data();
    const aprovado = status === 'approved' || status === 'aprovado' || status === 'paid';
    const patch = {
        paymentId,
        provedor: extra?.provedor ?? pag.provedor ?? 'stripe',
        atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
        ...extra,
    };
    if (aprovado) {
        patch.status = 'aprovado';
        if (pag.ciclo === 'mensal') {
            patch.vigenteAte = addMonths(new Date(), 1);
        }
    }
    else if (status === 'rejected' || status === 'cancelled' || status === 'canceled') {
        patch.status = status === 'cancelled' || status === 'canceled' ? 'cancelado' : 'recusado';
    }
    else if (status === 'pending' || status === 'in_process' || status === 'open') {
        patch.status = 'aguardando_pagamento';
    }
    await pagRef.update(patch);
    if (!aprovado)
        return;
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
                atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
            });
        }
    }
    if (pag.tipo === 'torneio' && pag.torneioId && pag.uid) {
        const torneioId = String(pag.torneioId);
        const uid = String(pag.uid);
        const propria = db().collection('torneios').doc(torneioId).collection('inscritos').doc(uid);
        const propriaSnap = await propria.get();
        if (propriaSnap.exists) {
            await propria.set({ pago: true, pagamentoId, pagoEm: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
        }
        else {
            const todos = await db().collection('torneios').doc(torneioId).collection('inscritos').get();
            for (const d of todos.docs) {
                if (String(d.data().parceiroUid || '') === uid) {
                    await d.ref.set({
                        parceiroPago: true,
                        parceiroPagamentoId: pagamentoId,
                        atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
                    }, { merge: true });
                    break;
                }
            }
        }
        // Confirma inscrição se dupla/pagamento ok
        const tSnap = await db().collection('torneios').doc(torneioId).get();
        const t = tSnap.data() || {};
        const composicao = String(t.composicao || 'simples');
        const pagaCfg = t.pagamento;
        const precisaPagar = Boolean(pagaCfg?.ativo && (pagaCfg.valor ?? 0) > 0);
        const inscritos = await db().collection('torneios').doc(torneioId).collection('inscritos').get();
        for (const d of inscritos.docs) {
            const insc = d.data();
            if (String(insc.status) === 'confirmado')
                continue;
            if (composicao === 'dupla' && (!insc.parceiroAceito || !insc.parceiroUid))
                continue;
            const capitaoPago = !precisaPagar || Boolean(insc.pago);
            const parceiroPago = composicao !== 'dupla' || !precisaPagar || Boolean(insc.parceiroPago);
            if (!capitaoPago || !parceiroPago)
                continue;
            await d.ref.set({ status: 'confirmado', confirmadoEm: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
            if (!insc.contabilizado) {
                await db()
                    .collection('torneios')
                    .doc(torneioId)
                    .update({ totalInscritos: firestore_1.FieldValue.increment(1) });
                await d.ref.set({ contabilizado: true }, { merge: true });
            }
        }
    }
    if (pag.tipo === 'ranking' && pag.rankingId && pag.uid) {
        await db()
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
//# sourceMappingURL=pagamentosSync.js.map