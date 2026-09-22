import AsyncStorage from '@react-native-async-storage/async-storage';
import { rotaFromIncomingUrl } from './deepLinks';

const KEY = '@rallyup/pendingDeepLink';

/** Guarda URL de deep link para sobreviver a OTA reload / cold start. */
export async function rememberDeepLinkUrl(
  url: string | null | undefined
): Promise<void> {
  if (!url || typeof url !== 'string') return;
  if (!rotaFromIncomingUrl(url)) return;
  try {
    await AsyncStorage.setItem(KEY, url);
  } catch {
    /* ignore */
  }
}

/** Lê e limpa o deep link pendente. */
export async function consumePendingDeepLink(): Promise<string | null> {
  try {
    const url = await AsyncStorage.getItem(KEY);
    if (url) await AsyncStorage.removeItem(KEY);
    return url;
  } catch {
    return null;
  }
}

/** Olha sem limpar (útil antes do OTA reload). */
export async function peekPendingDeepLink(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}
