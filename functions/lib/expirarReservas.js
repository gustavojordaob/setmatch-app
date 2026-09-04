"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expirarPreReservasRanking = void 0;
const firestore_1 = require("firebase-admin/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
/**
 * Expira pré-reservas de ranking pendentes após `expiraEm`
 * e cancela o desafio vinculado.
 */
exports.expirarPreReservasRanking = (0, scheduler_1.onSchedule)({
    schedule: 'every 20 minutes',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
}, async () => {
    const db = (0, firestore_1.getFirestore)();
    const agora = firestore_1.Timestamp.now();
    const clubes = await db.collection('clubes').get();
    for (const clube of clubes.docs) {
        const vencidas = await db
            .collection('clubes')
            .doc(clube.id)
            .collection('reservas')
            .where('status', '==', 'pendente')
            .where('tipo', '==', 'ranking')
            .where('expiraEm', '<=', agora)
            .limit(50)
            .get();
        for (const r of vencidas.docs) {
            const data = r.data();
            await r.ref.update({
                status: 'expirado',
                atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
            });
            const desafioId = String(data.desafioId || '');
            if (desafioId) {
                try {
                    await db.collection('desafios').doc(desafioId).update({
                        status: 'recusado',
                        atualizadoEm: firestore_1.FieldValue.serverTimestamp(),
                        motivoExpiracao: 'pre_reserva_expirada',
                    });
                }
                catch (e) {
                    console.warn('[expirarPreReservas] desafio', desafioId, e);
                }
            }
        }
    }
});
//# sourceMappingURL=expirarReservas.js.map