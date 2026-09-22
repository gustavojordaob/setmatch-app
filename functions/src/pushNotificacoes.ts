import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data?: Record<string, string>;
  channelId?: string;
};

/**
 * Quando nasce notificação in-app, espelha push remoto via Expo Push API
 * se o destinatário tiver `usuarios/{uid}.pushToken`.
 */
export const enviarPushAoCriarNotificacao = onDocumentCreated(
  {
    document: 'usuarios/{uid}/notificacoes/{notifId}',
    region: 'southamerica-east1',
  },
  async (event) => {
    const uid = event.params.uid as string;
    const data = event.data?.data();
    if (!data || !uid) return;

    const db = getFirestore();
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

    const message: ExpoPushMessage = {
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
        logger.warn('Expo push falhou', { status: resp.status, texto });
      }
    } catch (e) {
      logger.error('Expo push erro', e);
    }
  }
);
