import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

const CHANNEL_ID = 'setmatch-geral';

/**
 * Só true se o **binário nativo** já inclui expo-notifications.
 * Builds antigos (só OTA) não têm o módulo → NÃO importar o pacote (crash iOS).
 */
export function pushNativoDisponivel(): boolean {
  if (Platform.OS === 'web') return false;
  if (Constants.appOwnership === 'expo') return false;
  const n = NativeModules as Record<string, unknown>;
  return Boolean(
    n.ExpoPushTokenManager ||
      n.ExpoNotifications ||
      n.ExpoNotificationPresenter ||
      n.ExpoNotificationsEmitter ||
      n.Notifications
  );
}

/** @deprecated use pushNativoDisponivel */
export function pushDisponivelNoRuntime(): boolean {
  return pushNativoDisponivel();
}

export async function registrarPushToken(uid: string): Promise<string | null> {
  if (!uid || !pushNativoDisponivel()) return null;

  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');

    if (!Device.isDevice) {
      console.warn('[push] só em dispositivo físico');
      return null;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Rally Up',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C7D941',
      });
    }

    const atual = await Notifications.getPermissionsAsync();
    let status = atual.status;
    if (status !== 'granted') {
      const pedida = await Notifications.requestPermissionsAsync();
      status = pedida.status;
    }
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) {
      console.warn('[push] projectId EAS ausente');
      return null;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes.data;
    if (!token) return null;

    await updateDoc(doc(db, 'usuarios', uid), {
      pushToken: token,
      pushTokenAtualizadoEm: serverTimestamp(),
      pushPlatform: Platform.OS,
    });

    return token;
  } catch (e) {
    console.warn('[push] registrar', e);
    return null;
  }
}

export type PushListenerCleanup = () => void;

export async function anexarListenersPush(opts: {
  onAbrirRota: (rota: string) => void;
}): Promise<PushListenerCleanup> {
  if (!pushNativoDisponivel()) return () => undefined;

  try {
    const Notifications = await import('expo-notifications');
    const received = Notifications.addNotificationReceivedListener(() => {
      /* in-app feed cobre */
    });
    const response = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as { rota?: string };
      if (data?.rota && typeof data.rota === 'string') {
        opts.onAbrirRota(data.rota);
      }
    });
    return () => {
      received.remove();
      response.remove();
    };
  } catch {
    return () => undefined;
  }
}
