import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

/**
 * Expira pré-reservas de ranking pendentes após `expiraEm`
 * e cancela o desafio vinculado.
 */
export const expirarPreReservasRanking = onSchedule(
  {
    schedule: 'every 20 minutes',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
  },
  async () => {
    const db = getFirestore();
    const agora = Timestamp.now();
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
          atualizadoEm: FieldValue.serverTimestamp(),
        });
        const desafioId = String(data.desafioId || '');
        if (desafioId) {
          try {
            await db.collection('desafios').doc(desafioId).update({
              status: 'recusado',
              atualizadoEm: FieldValue.serverTimestamp(),
              motivoExpiracao: 'pre_reserva_expirada',
            });
          } catch (e) {
            console.warn('[expirarPreReservas] desafio', desafioId, e);
          }
        }
      }
    }
  }
);
