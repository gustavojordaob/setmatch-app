import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

export type NotificacaoTipo =
  | 'desafio'
  | 'reserva_ranking'
  | 'chave_torneio'
  | 'convite_dupla'
  | 'pagamento'
  | 'sistema';

export interface NotificacaoApp {
  id: string;
  tipo: NotificacaoTipo;
  titulo: string;
  corpo: string;
  rota?: string;
  refId?: string;
  lida: boolean;
  criadoEm?: { seconds: number };
}

export async function criarNotificacao(input: {
  paraUid: string;
  tipo: NotificacaoTipo;
  titulo: string;
  corpo: string;
  rota?: string;
  refId?: string;
}): Promise<string> {
  if (!input.paraUid) return '';
  const ref = await addDoc(collection(db, 'usuarios', input.paraUid, 'notificacoes'), {
    tipo: input.tipo,
    titulo: input.titulo,
    corpo: input.corpo,
    rota: input.rota ?? '',
    refId: input.refId ?? '',
    lida: false,
    criadoEm: serverTimestamp(),
  });

  // Best-effort push (Expo). CF também espelha; não bloqueia o fluxo.
  void enviarPushExpoBestEffort(input.paraUid, {
    titulo: input.titulo,
    corpo: input.corpo,
    rota: input.rota,
    refId: input.refId,
    tipo: input.tipo,
    notifId: ref.id,
  });

  return ref.id;
}

async function enviarPushExpoBestEffort(
  paraUid: string,
  payload: {
    titulo: string;
    corpo: string;
    rota?: string;
    refId?: string;
    tipo: string;
    notifId: string;
  }
): Promise<void> {
  try {
    const { getDoc, doc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'usuarios', paraUid));
    const token = String(snap.data()?.pushToken || '');
    if (!token.startsWith('ExponentPushToken')) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title: payload.titulo,
        body: payload.corpo,
        sound: 'default',
        channelId: 'setmatch-geral',
        data: {
          rota: payload.rota ?? '',
          refId: payload.refId ?? '',
          tipo: payload.tipo,
          notifId: payload.notifId,
        },
      }),
    });
  } catch (e) {
    console.warn('[notif] push', e);
  }
}

export async function marcarNotificacaoLida(uid: string, notifId: string): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid, 'notificacoes', notifId), {
    lida: true,
  });
}

export function ouvirNotificacoes(
  uid: string,
  onData: (lista: NotificacaoApp[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'usuarios', uid, 'notificacoes'),
    orderBy('criadoEm', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: NotificacaoApp[] = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          tipo: (raw.tipo as NotificacaoTipo) || 'sistema',
          titulo: String(raw.titulo ?? ''),
          corpo: String(raw.corpo ?? ''),
          rota: raw.rota ? String(raw.rota) : undefined,
          refId: raw.refId ? String(raw.refId) : undefined,
          lida: Boolean(raw.lida),
          criadoEm: raw.criadoEm as { seconds: number } | undefined,
        };
      });
      onData(list);
    },
    () => onData([])
  );
}

export function ouvirNaoLidasCount(
  uid: string,
  onCount: (n: number) => void
): Unsubscribe {
  const q = query(
    collection(db, 'usuarios', uid, 'notificacoes'),
    where('lida', '==', false)
  );
  return onSnapshot(
    q,
    (snap) => onCount(snap.size),
    () => onCount(0)
  );
}
