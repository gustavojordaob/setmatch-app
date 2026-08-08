"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wipeSetmatchUser = wipeSetmatchUser;
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
async function deleteQueryInBatches(q, batchSize = 200) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const snap = await q.limit(batchSize).get();
        if (snap.empty)
            return;
        const batch = (0, firestore_1.getFirestore)().batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        if (snap.size < batchSize)
            return;
    }
}
async function deleteCollection(ref, batchSize = 200) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const snap = await ref.limit(batchSize).get();
        if (snap.empty)
            return;
        const batch = (0, firestore_1.getFirestore)().batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        if (snap.size < batchSize)
            return;
    }
}
async function deleteUserStorage(uid) {
    try {
        const bucket = (0, storage_1.getStorage)().bucket();
        await bucket.deleteFiles({ prefix: `usuarios/${uid}/` });
    }
    catch {
        // Storage vazio não bloqueia.
    }
}
async function deleteClubesDoDono(db, uid) {
    const clubes = await db.collection('clubes').where('donoUid', '==', uid).get();
    for (const clube of clubes.docs) {
        await deleteCollection(clube.ref.collection('modalidadesAula'));
        const rankings = await db.collection('rankings').where('clubeId', '==', clube.id).get();
        for (const r of rankings.docs) {
            await deleteCollection(r.ref.collection('classificacao'));
            await r.ref.delete();
        }
        const torneios = await db.collection('torneios').where('clubeId', '==', clube.id).get();
        for (const t of torneios.docs) {
            await deleteCollection(t.ref.collection('inscritos'));
            await deleteCollection(t.ref.collection('confrontos'));
            await t.ref.delete();
        }
        await clube.ref.delete();
    }
}
async function scrubClassificacaoEInscritos(db, uid) {
    const rankings = await db.collection('rankings').get();
    for (const r of rankings.docs) {
        await r.ref.collection('classificacao').doc(uid).delete().catch(() => undefined);
    }
    const torneios = await db.collection('torneios').get();
    for (const t of torneios.docs) {
        await t.ref.collection('inscritos').doc(uid).delete().catch(() => undefined);
    }
}
async function deleteConversasDoUsuario(db, uid) {
    const snap = await db.collection('conversas').where('participantes', 'array-contains', uid).get();
    for (const c of snap.docs) {
        await deleteCollection(c.ref.collection('mensagens'));
        await c.ref.delete();
    }
}
/**
 * Remove dados pessoais do Setmatch + Auth user.
 * Clubes do dono e conteúdo associado são apagados.
 */
async function wipeSetmatchUser(uid) {
    const db = (0, firestore_1.getFirestore)();
    await deleteUserStorage(uid);
    await deleteClubesDoDono(db, uid);
    const byUid = [
        db.collection('pagamentos').where('uid', '==', uid),
        db.collection('matriculas').where('uid', '==', uid),
        db.collection('interessesAulas').where('uid', '==', uid),
        db.collection('aulasPublicadas').where('donoUid', '==', uid),
        db.collection('desafios').where('desafiante', '==', uid),
        db.collection('desafios').where('desafiado', '==', uid),
        db.collection('partidas').where('jogador1', '==', uid),
        db.collection('partidas').where('jogador2', '==', uid),
        db.collection('posts').where('autorUid', '==', uid),
        db.collection('amizades').where('deUid', '==', uid),
        db.collection('amizades').where('paraUid', '==', uid),
        db.collection('solicitacoes').where('uid', '==', uid),
        db.collection('solicitacoes').where('donoUid', '==', uid),
    ];
    for (const q of byUid) {
        try {
            await deleteQueryInBatches(q);
        }
        catch (e) {
            console.warn('wipe query skip', e);
        }
    }
    try {
        await scrubClassificacaoEInscritos(db, uid);
    }
    catch (e) {
        console.warn('scrub ranking/torneio', e);
    }
    try {
        await deleteConversasDoUsuario(db, uid);
    }
    catch (e) {
        console.warn('conversas', e);
    }
    await db.collection('usuarios').doc(uid).delete().catch(() => undefined);
    await (0, auth_1.getAuth)().deleteUser(uid);
}
//# sourceMappingURL=deleteAccount.js.map