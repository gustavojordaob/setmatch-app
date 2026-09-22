import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { auth } from '../../utils/firebaseConfig';
import type { StravaAtividadeResumo } from '../../types/saude';
import { salvarSaudeResumo } from './sync';

WebBrowser.maybeCompleteAuthSession();

const STRAVA_AUTH = 'https://www.strava.com/oauth/mobile/authorize';
const STRAVA_SCOPES = 'read,activity:read_all';

/** Host = Authorization Callback Domain do painel Strava (`setmatch`). */
export const STRAVA_REDIRECT_URI = 'setmatch://setmatch';

function stravaClientId(): string {
  return process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID?.trim() || '';
}

function stravaFunctionBase(): string {
  return (
    process.env.EXPO_PUBLIC_STRAVA_FUNCTION_BASE?.trim() ||
    'https://southamerica-east1-setmatch-app-fabrica.cloudfunctions.net'
  );
}

async function idToken(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Não autenticado');
  return u.getIdToken();
}

export function stravaRedirectUri(): string {
  // Strava exige redirect exato = Authorization Callback Domain (setmatch).
  // makeRedirectUri pode variar no dev client; manter fixo no nativo.
  if (Platform.OS === 'web') {
    return AuthSession.makeRedirectUri({ scheme: 'setmatch' });
  }
  return STRAVA_REDIRECT_URI;
}

/** Troca o code OAuth (Cloud Function) e marca Strava conectado no perfil. */
export async function finalizarOAuthStrava(
  uid: string,
  code: string,
  redirectUri: string = STRAVA_REDIRECT_URI
): Promise<void> {
  const token = await idToken();
  const resp = await fetch(`${stravaFunctionBase()}/stravaExchangeCode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code, redirectUri }),
  });
  const data = (await resp.json()) as {
    ok?: boolean;
    error?: string;
    athleteId?: string;
    athleteNome?: string;
  };
  if (!resp.ok || !data.ok) {
    throw new Error(data.error || 'Falha ao conectar Strava');
  }

  await salvarSaudeResumo(uid, {
    fontes: { strava: true },
    stravaAthleteId: data.athleteId,
    stravaNome: data.athleteNome,
  });
}

/**
 * OAuth Strava no app; troca do code pelo secret fica na Cloud Function.
 * No Android o redirect costuma abrir a rota `/setmatch` (deep link) em vez de
 * completar o WebBrowser — essa rota também chama `finalizarOAuthStrava`.
 */
export async function conectarStrava(uid: string): Promise<{ completedInBrowser: boolean }> {
  const clientId = stravaClientId();
  if (!clientId) {
    throw new Error(
      'Configure EXPO_PUBLIC_STRAVA_CLIENT_ID (app Strava Developers) e o secret nas Functions.'
    );
  }

  const redirectUri = stravaRedirectUri();

  if (__DEV__) {
    console.log('[Strava] redirect_uri =', redirectUri);
  }

  const authUrl =
    `${STRAVA_AUTH}?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&approval_prompt=auto&scope=${encodeURIComponent(STRAVA_SCOPES)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  // Android: OAuth costuma completar via deep link (app/setmatch.tsx) após fechar o browser.
  if (result.type !== 'success' || !('url' in result) || !result.url) {
    return { completedInBrowser: false };
  }

  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Código Strava ausente');

  await finalizarOAuthStrava(uid, code, redirectUri);
  return { completedInBrowser: true };
}

export async function desconectarStrava(uid: string): Promise<void> {
  const token = await idToken();
  await fetch(`${stravaFunctionBase()}/stravaDisconnect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  await salvarSaudeResumo(uid, {
    fontes: { strava: false },
    stravaAthleteId: '',
    stravaNome: '',
    stravaAtividadesHoje: 0,
    stravaKmHoje: 0,
    stravaMinutosHoje: 0,
    stravaKcalHoje: 0,
    stravaAtividadesLista: [],
  });
}

/** Puxa atividades de hoje via Function e grava resumo Strava no perfil. */
export async function syncStravaAtividades(uid: string): Promise<{
  stravaAtividadesHoje: number;
  stravaKmHoje: number;
  stravaMinutosHoje: number;
  stravaKcalHoje: number;
  stravaAtividadesLista: StravaAtividadeResumo[];
}> {
  const token = await idToken();
  const resp = await fetch(`${stravaFunctionBase()}/stravaSyncToday`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  const data = (await resp.json()) as {
    ok?: boolean;
    error?: string;
    kcalAtivas?: number;
    stravaAtividadesHoje?: number;
    stravaKmHoje?: number;
    stravaMinutosHoje?: number;
    stravaKcalHoje?: number;
    stravaAtividadesLista?: StravaAtividadeResumo[];
  };
  if (!resp.ok || !data.ok) {
    throw new Error(data.error || 'Falha ao sincronizar Strava');
  }

  const stravaAtividadesHoje = data.stravaAtividadesHoje ?? 0;
  const stravaKmHoje = data.stravaKmHoje ?? 0;
  const stravaMinutosHoje = data.stravaMinutosHoje ?? 0;
  const stravaKcalHoje = data.stravaKcalHoje ?? 0;
  const stravaAtividadesLista = data.stravaAtividadesLista ?? [];

  const patch: Parameters<typeof salvarSaudeResumo>[1] = {
    fontes: { strava: true },
    stravaAtividadesHoje,
    stravaKmHoje,
    stravaMinutosHoje,
    stravaKcalHoje,
    stravaAtividadesLista,
  };
  if (data.kcalAtivas != null && stravaKcalHoje > 0) {
    patch.kcalAtivas = data.kcalAtivas;
  }
  await salvarSaudeResumo(uid, patch);

  return {
    stravaAtividadesHoje,
    stravaKmHoje,
    stravaMinutosHoje,
    stravaKcalHoje,
    stravaAtividadesLista,
  };
}
