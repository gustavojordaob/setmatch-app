import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../../utils/firebaseConfig';
import { salvarSaudeResumo } from './sync';

WebBrowser.maybeCompleteAuthSession();

const STRAVA_AUTH = 'https://www.strava.com/oauth/mobile/authorize';
const STRAVA_SCOPES = 'read,activity:read_all';

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

/**
 * OAuth Strava no app; troca do code pelo secret fica na Cloud Function.
 */
export async function conectarStrava(uid: string): Promise<void> {
  const clientId = stravaClientId();
  if (!clientId) {
    throw new Error(
      'Configure EXPO_PUBLIC_STRAVA_CLIENT_ID (app Strava Developers) e o secret nas Functions.'
    );
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'setmatch',
    path: 'saude/strava',
  });

  const authUrl =
    `${STRAVA_AUTH}?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&approval_prompt=auto&scope=${encodeURIComponent(STRAVA_SCOPES)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type !== 'success' || !('url' in result) || !result.url) {
    throw new Error('Login Strava cancelado');
  }

  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Código Strava ausente');

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
  });
}

/** Puxa atividades recentes via Function e mescla kcal/passos aproximados no resumo. */
export async function syncStravaAtividades(uid: string): Promise<void> {
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
  };
  if (!resp.ok || !data.ok) {
    throw new Error(data.error || 'Falha ao sincronizar Strava');
  }
  if (data.kcalAtivas != null) {
    await salvarSaudeResumo(uid, {
      kcalAtivas: data.kcalAtivas,
      fontes: { strava: true },
    });
  }
}
