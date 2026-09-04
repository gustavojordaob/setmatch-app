"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enviarPushAoCriarNotificacao = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
/**
 * Quando nasce notificação in-app, espelha push remoto via Expo Push API
 * se o destinatário tiver `usuarios/{uid}.pushToken`.
 */
exports.enviarPushAoCriarNotificacao = (0, firestore_1.onDocumentCreated)({
    document: 'usuarios/{uid}/notificacoes/{notifId}',
    region: 'southamerica-east1',
}, async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data();
    if (!data || !uid)
        return;
    const db = (0, firestore_2.getFirestore)();
    const userSnap = await db.collection('usuarios').doc(uid).get();
    const pushToken = String(userSnap.data()?.pushToken || '');
    if (!pushToken.startsWith('ExponentPushToken')) {
        return;
    }
    const title = String(data.titulo || 'Rally Up');
    const body = String(data.corpo || '');
    const rota = data.rota ? String(data.rota) : '';
    const refId = data.refId ? String(data.refId) : '';
    const tipo = data.tipo ? String(data.tipo) : '';
    const message = {
        to: pushToken,
        title,
        body,
        sound: 'default',
        channelId: 'setmatch-geral',
        data: {
            rota,
            refId,
            tipo,
            notifId: String(event.params.notifId || ''),
        },
    };
    try {
        const resp = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
        const texto = await resp.text();
        if (!resp.ok) {
            firebase_functions_1.logger.warn('Expo push falhou', { status: resp.status, texto });
        }
    }
    catch (e) {
        firebase_functions_1.logger.error('Expo push erro', e);
    }
});
//# sourceMappingURL=pushNotificacoes.js.map