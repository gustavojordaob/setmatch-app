import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';

function db() {
  return getFirestore();
}

function stravaClientId(): string {
  return process.env.STRAVA_CLIENT_ID?.trim() || '';
}

function stravaClientSecret(): string {
  return process.env.STRAVA_CLIENT_SECRET?.trim() || '';
}

async function requireUid(req: { headers: Record<string, unknown> }): Promise<string> {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('UNAUTHORIZED');
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}

type StravaTokenDoc = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  athleteId?: number;
  athleteNome?: string;
};

async function loadTokens(uid: string): Promise<StravaTokenDoc | null> {
  const snap = await db().doc(`usuarios/${uid}/integracoes/strava`).get();
  if (!snap.exists) return null;
  return snap.data() as StravaTokenDoc;
}

async function saveTokens(uid: string, data: StravaTokenDoc): Promise<void> {
  await db().doc(`usuarios/${uid}/integracoes/strava`).set(
    {
      ...data,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function refreshIfNeeded(uid: string, tokens: StravaTokenDoc): Promise<StravaTokenDoc> {
  const now = Math.floor(Date.now() / 1000);
  if (tokens.expiresAt > now + 60) return tokens;

  const body = new URLSearchParams({
    client_id: stravaClientId(),
    client_secret: stravaClientSecret(),
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  });
  const resp = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) throw new Error(`Strava refresh ${resp.status}`);
  const json = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  const next: StravaTokenDoc = {
    ...tokens,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at,
  };
  await saveTokens(uid, next);
  return next;
}

export const stravaExchangeCode = onRequest(
  { cors: true, region: 'southamerica-east1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Método não permitido' });
      return;
    }
    try {
      const uid = await requireUid(req);
      const clientId = stravaClientId();
      const clientSecret = stravaClientSecret();
      if (!clientId || !clientSecret) {
        res.status(503).json({
          ok: false,
          error: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET não configurados nas Functions.',
        });
        return;
      }

      const { code, redirectUri } = req.body || {};
      if (!code) {
        res.status(400).json({ ok: false, error: 'code obrigatório' });
        return;
      }

      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: String(code),
        grant_type: 'authorization_code',
      });
      if (redirectUri) body.set('redirect_uri', String(redirectUri));

      const resp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const json = (await resp.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        athlete?: { id?: number; firstname?: string; lastname?: string };
        message?: string;
        errors?: unknown;
      };
      if (!resp.ok || !json.access_token || !json.refresh_token) {
        res.status(502).json({
          ok: false,
          error: json.message || 'Falha no OAuth Strava',
          detalhe: json.errors,
        });
        return;
      }

      const athleteNome = [json.athlete?.firstname, json.athlete?.lastname]
        .filter(Boolean)
        .join(' ');
      await saveTokens(uid, {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresAt: json.expires_at || 0,
        athleteId: json.athlete?.id,
        athleteNome,
      });

      await db().doc(`usuarios/${uid}`).update({
        'saude.fontes.strava': true,
        'saude.stravaAthleteId': String(json.athlete?.id || ''),
        'saude.stravaNome': athleteNome,
        'saude.atualizadoEm': FieldValue.serverTimestamp(),
      });

      res.json({
        ok: true,
        athleteId: String(json.athlete?.id || ''),
        athleteNome,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro';
      res.status(msg === 'UNAUTHORIZED' ? 401 : 500).json({ ok: false, error: msg });
    }
  }
);

export const stravaDisconnect = onRequest(
  { cors: true, region: 'southamerica-east1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Método não permitido' });
      return;
    }
    try {
      const uid = await requireUid(req);
      await db().doc(`usuarios/${uid}/integracoes/strava`).delete().catch(() => undefined);
      await db().doc(`usuarios/${uid}`).update({
        'saude.fontes.strava': false,
        'saude.stravaAthleteId': '',
        'saude.stravaNome': '',
        'saude.stravaAtividadesHoje': 0,
        'saude.stravaKmHoje': 0,
        'saude.stravaMinutosHoje': 0,
        'saude.stravaKcalHoje': 0,
        'saude.stravaAtividadesLista': [],
        'saude.atualizadoEm': FieldValue.serverTimestamp(),
      });
      res.json({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro';
      res.status(msg === 'UNAUTHORIZED' ? 401 : 500).json({ ok: false, error: msg });
    }
  }
);

export const stravaSyncToday = onRequest(
  { cors: true, region: 'southamerica-east1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Método não permitido' });
      return;
    }
    try {
      const uid = await requireUid(req);
      let tokens = await loadTokens(uid);
      if (!tokens) {
        res.status(400).json({ ok: false, error: 'Strava não conectado' });
        return;
      }
      tokens = await refreshIfNeeded(uid, tokens);

      // Atividades de hoje (Unix seconds, início do dia no fuso do servidor ≈ UTC;
      // para BR ainda cobre a manhã/noite do dia civil na maioria dos casos).
      const after = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
      const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=50`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (!resp.ok) {
        const t = await resp.text();
        res.status(502).json({ ok: false, error: `Strava API ${resp.status}`, detalhe: t });
        return;
      }

      type Ativ = {
        id?: number;
        name?: string;
        type?: string;
        sport_type?: string;
        distance?: number;
        moving_time?: number;
        kilojoules?: number;
        calories?: number;
        start_date_local?: string;
      };
      const activities = (await resp.json()) as Ativ[];

      let kcal = 0;
      let metros = 0;
      let segundos = 0;
      const stravaAtividadesLista = activities.slice(0, 10).map((a) => {
        let kcalAtiv = 0;
        if (typeof a.calories === 'number' && a.calories > 0) kcalAtiv = a.calories;
        else if (typeof a.kilojoules === 'number' && a.kilojoules > 0) {
          kcalAtiv = a.kilojoules / 4.184;
        }
        if (typeof a.calories === 'number' && a.calories > 0) kcal += a.calories;
        else if (typeof a.kilojoules === 'number' && a.kilojoules > 0) {
          kcal += a.kilojoules / 4.184;
        }
        if (typeof a.distance === 'number') metros += a.distance;
        if (typeof a.moving_time === 'number') segundos += a.moving_time;

        let horario: string | undefined;
        if (a.start_date_local) {
          const part = a.start_date_local.split('T')[1];
          horario = part ? part.slice(0, 5) : undefined;
        }

        return {
          id: a.id != null ? String(a.id) : undefined,
          nome: (a.name || 'Treino').slice(0, 80),
          tipo: a.sport_type || a.type || 'Workout',
          km: Math.round(((a.distance || 0) / 1000) * 100) / 100,
          minutos: Math.round((a.moving_time || 0) / 60),
          kcal: Math.round(kcalAtiv),
          horario,
        };
      });

      const stravaKcalHoje = Math.round(kcal);
      const stravaKmHoje = Math.round((metros / 1000) * 100) / 100;
      const stravaMinutosHoje = Math.round(segundos / 60);
      const stravaAtividadesHoje = activities.length;

      const userRef = db().doc(`usuarios/${uid}`);
      const snap = await userRef.get();
      const atualKcal =
        typeof snap.data()?.saude?.kcalAtivas === 'number'
          ? (snap.data()!.saude.kcalAtivas as number)
          : 0;
      // Não zerar kcal do Health Connect se Strava não tiver calorias hoje.
      const kcalAtivas =
        stravaKcalHoje > 0 ? Math.max(atualKcal, stravaKcalHoje) : atualKcal;

      await userRef.update({
        'saude.stravaAtividadesHoje': stravaAtividadesHoje,
        'saude.stravaKmHoje': stravaKmHoje,
        'saude.stravaMinutosHoje': stravaMinutosHoje,
        'saude.stravaKcalHoje': stravaKcalHoje,
        'saude.stravaAtividadesLista': stravaAtividadesLista,
        ...(stravaKcalHoje > 0 ? { 'saude.kcalAtivas': kcalAtivas } : {}),
        'saude.fontes.strava': true,
        'saude.atualizadoEm': FieldValue.serverTimestamp(),
      });

      res.json({
        ok: true,
        kcalAtivas: stravaKcalHoje > 0 ? kcalAtivas : atualKcal,
        stravaKcalHoje,
        stravaAtividadesHoje,
        stravaKmHoje,
        stravaMinutosHoje,
        stravaAtividadesLista,
        tipos: activities.slice(0, 5).map((a) => a.sport_type || a.type || a.name || '?'),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro';
      res.status(msg === 'UNAUTHORIZED' ? 401 : 500).json({ ok: false, error: msg });
    }
  }
);
