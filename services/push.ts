import { Alert, Linking, NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

const CHANNEL_ID = 'setmatch-geral';
const KEY_PEDIU_PUSH = 'rallyup_pediu_push_v1';

function temModuloPushNativo(): boolean {
  const n = NativeModules as Record<string, unknown>;
  if (
    n.ExpoPushTokenManager ||
    n.ExpoNotifications ||
    n.ExpoNotificationPresenter ||
    n.ExpoNotificationsEmitter ||
    n.Notifications
  ) {
    return true;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core = require('expo-modules-core') as {
      requireOptionalNativeModule?: (name: string) => unknown;
    };
    if (typeof core.requireOptionalNativeModule === 'function') {
      return Boolean(
        core.requireOptionalNativeModule('ExpoPushTokenManager') ||
          core.requireOptionalNativeModule('ExpoNotifications')
      );
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Só true se o **binário nativo** já inclui expo-notifications.
 * Builds antigos (só OTA) não têm o módulo → NÃO importar o pacote (crash iOS).
 */
export function pushNativoDisponivel(): boolean {
  if (Platform.OS === 'web') return false;
  if (Constants.appOwnership === 'expo') return false;
  return temModuloPushNativo();
}

/** @deprecated use pushNativoDisponivel */
export function pushDisponivelNoRuntime(): boolean {
  return pushNativoDisponivel();
}

export type PushRegistroResultado = {
  token: string | null;
  status: 'granted' | 'denied' | 'undetermined' | 'unavailable' | 'error';
  detalhe?: string;
};

/**
 * Pede a permissão do sistema (iOS e Android 13+ mostram o diálogo nativo).
 * iPhone: "Rally Up Would Like to Send You Notifications" / em PT equivalente.
 * Android 13+: diálogo "Permitir que Rally Up envie notificações?".
 */
async function pedirPermissaoSistema(): Promise<{
  status: string;
  canAskAgain?: boolean;
}> {
  const Notifications = await import('expo-notifications');

  // Android 13+ (API 33): POST_NOTIFICATIONS via PermissionsAndroid reforça o prompt
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      const { PermissionsAndroid } = await import('react-native');
      const already = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (!already) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notificações do Rally Up',
            message:
              'Quer receber avisos de jogos, placares e mensagens mesmo com o app fechado?',
            buttonPositive: 'Permitir',
            buttonNegative: 'Agora não',
          }
        );
      }
    } catch (e) {
      console.warn('[push] PermissionsAndroid', e);
    }
  }

  const atual = await Notifications.getPermissionsAsync();
  if (atual.status === 'granted') {
    return { status: 'granted', canAskAgain: atual.canAskAgain };
  }

  const pedida = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowDisplayInCarPlay: false,
    },
    android: {},
  });
  return { status: pedida.status, canAskAgain: pedida.canAskAgain };
}

/**
 * Pede permissão + grava Expo Push Token em usuarios/{uid}.
 * Sem permissão no iOS, a linha "Notificações" não aparece em Ajustes.
 */
export async function registrarPushToken(uid: string): Promise<string | null> {
  const r = await registrarPushTokenDetalhado(uid);
  return r.token;
}

export async function registrarPushTokenDetalhado(
  uid: string,
  opts?: { forcarPedido?: boolean }
): Promise<PushRegistroResultado> {
  if (!uid) return { token: null, status: 'unavailable', detalhe: 'sem uid' };
  if (!pushNativoDisponivel()) {
    return {
      token: null,
      status: 'unavailable',
      detalhe: 'Módulo nativo ausente — precisa de build novo da loja',
    };
  }

  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');

    if (!Device.isDevice) {
      console.warn('[push] só em dispositivo físico');
      return { token: null, status: 'unavailable', detalhe: 'simulador' };
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

    // Pedir sempre se ainda não concedeu (ou se forçou pelo botão)
    if (status !== 'granted' || opts?.forcarPedido) {
      const pedida = await pedirPermissaoSistema();
      status = pedida.status;
    }

    await updateDoc(doc(db, 'usuarios', uid), {
      pushPermission: status,
      pushPermissionAtualizadoEm: serverTimestamp(),
    }).catch(() => undefined);

    if (status !== 'granted') {
      return {
        token: null,
        status: status as 'denied' | 'undetermined',
        detalhe:
          Platform.OS === 'ios'
            ? 'Permissão negada — Ajustes → Rally Up → Notificações'
            : 'Permissão negada — Ajustes → Apps → Rally Up → Notificações',
      };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) {
      console.warn('[push] projectId EAS ausente');
      return { token: null, status: 'error', detalhe: 'projectId EAS ausente' };
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes.data;
    if (!token) return { token: null, status: 'error', detalhe: 'token vazio' };

    await updateDoc(doc(db, 'usuarios', uid), {
      pushToken: token,
      pushTokenAtualizadoEm: serverTimestamp(),
      pushPlatform: Platform.OS,
      pushPermission: 'granted',
    });

    return { token, status: 'granted' };
  } catch (e) {
    console.warn('[push] registrar', e);
    return {
      token: null,
      status: 'error',
      detalhe: e instanceof Error ? e.message : 'falha ao registrar',
    };
  }
}

/**
 * Uma vez após o onboarding: Alert explicando + diálogo nativo do sistema.
 * iPhone e Android 13+ mostram a solicitação do SO.
 */
export async function solicitarPushAposOnboarding(uid: string): Promise<void> {
  if (!uid || !pushNativoDisponivel()) return;

  try {
    const jaPediu = await AsyncStorage.getItem(KEY_PEDIU_PUSH);
    if (jaPediu === '1') {
      // Já pediu antes — só tenta registrar em silêncio se já tiver permissão
      await registrarPushToken(uid);
      return;
    }

    const Notifications = await import('expo-notifications');
    const atual = await Notifications.getPermissionsAsync();
    if (atual.status === 'granted') {
      await AsyncStorage.setItem(KEY_PEDIU_PUSH, '1');
      await registrarPushToken(uid);
      return;
    }

    await new Promise<void>((resolve) => {
      Alert.alert(
        'Ativar notificações?',
        Platform.OS === 'ios'
          ? 'O iPhone vai perguntar se o Rally Up pode enviar notificações. Aceite para receber jogos, placares e mensagens.'
          : 'Na próxima tela, o Android pede para permitir notificações do Rally Up. Aceite para receber jogos, placares e mensagens.',
        [
          {
            text: 'Agora não',
            style: 'cancel',
            onPress: () => {
              void AsyncStorage.setItem(KEY_PEDIU_PUSH, '1');
              resolve();
            },
          },
          {
            text: 'Permitir',
            onPress: () => {
              void (async () => {
                await AsyncStorage.setItem(KEY_PEDIU_PUSH, '1');
                await registrarPushTokenDetalhado(uid, { forcarPedido: true });
                resolve();
              })();
            },
          },
        ],
        { cancelable: false }
      );
    });
  } catch (e) {
    console.warn('[push] solicitar apos onboarding', e);
  }
}

/** Abre Ajustes do app (iOS/Android) para o usuário ligar Notificações. */
export async function abrirAjustesNotificacoes(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (e) {
    console.warn('[push] openSettings', e);
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
