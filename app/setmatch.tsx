import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import {
  finalizarOAuthStrava,
  STRAVA_REDIRECT_URI,
  syncStravaAtividades,
} from '../services/saude/strava';

WebBrowser.maybeCompleteAuthSession();

/**
 * Callback OAuth Strava — deep link `setmatch://setmatch?code=...`
 * (Authorization Callback Domain = setmatch).
 */
export default function StravaOAuthCallback() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const [status, setStatus] = useState('Conectando Strava…');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (!user) return;

    const code = typeof params.code === 'string' ? params.code : undefined;
    const err = typeof params.error === 'string' ? params.error : undefined;

    if (err || !code) {
      setStatus(err ? `Strava: ${err}` : 'Código ausente');
      const t = setTimeout(() => router.replace('/perfil/saude'), 1500);
      return () => clearTimeout(t);
    }

    ran.current = true;
    void (async () => {
      try {
        await finalizarOAuthStrava(user.uid, code, STRAVA_REDIRECT_URI);
        try {
          await syncStravaAtividades(user.uid);
        } catch {
          /* sync opcional */
        }
        setStatus('Strava conectado!');
      } catch (e: unknown) {
        setStatus(e instanceof Error ? e.message : 'Falha ao conectar');
      } finally {
        setTimeout(() => router.replace('/perfil/saude'), 800);
      }
    })();
  }, [user, params.code, params.error, router]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={Colors.accent} size="large" />
      <Text style={styles.txt}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  txt: {
    color: Colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
  },
});
