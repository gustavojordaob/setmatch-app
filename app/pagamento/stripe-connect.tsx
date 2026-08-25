import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';

/**
 * Página web de retorno do Stripe Connect.
 * Atualiza status via account.updated (webhook) ou o admin refresca no app.
 */
export default function StripeConnectReturnScreen() {
  const { clubeId, ok, refresh } = useLocalSearchParams<{
    clubeId?: string;
    ok?: string;
    refresh?: string;
  }>();
  const [msg, setMsg] = useState('Processando…');

  useEffect(() => {
    async function run() {
      if (!clubeId) {
        setMsg('Clube não informado. Volte ao painel do Rally Up.');
        return;
      }
      try {
        const ref = doc(db, 'clubes', String(clubeId));
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await updateDoc(ref, {
            stripeConnectReturnEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
          });
        }
        if (refresh === '1') {
          setMsg('Onboarding incompleto. Abra o painel e toque em Conectar Stripe de novo.');
        } else if (ok === '1') {
          setMsg('Conta Stripe enviada. Volte ao app e atualize o status no Financeiro.');
        } else {
          setMsg('Pode voltar ao app Rally Up.');
        }
      } catch {
        setMsg('Pode voltar ao app Rally Up (Financeiro).');
      }
    }
    void run();
  }, [clubeId, ok, refresh]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.box}>
        {!msg || msg === 'Processando…' ? (
          <ActivityIndicator color={Colors.accent} />
        ) : null}
        <Text style={styles.title}>Stripe Connect</Text>
        <Text style={styles.sub}>{msg}</Text>
        <Text
          style={styles.link}
          onPress={() => void Linking.openURL('setmatch://clube/financeiro')}
        >
          Abrir painel
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center' },
  box: { padding: 28, gap: 12 },
  title: { color: Colors.accent, fontSize: 24, fontWeight: 'bold' },
  sub: { color: Colors.textPrimary, fontSize: 16, lineHeight: 22 },
  link: { color: Colors.accent, fontWeight: 'bold', marginTop: 16, fontSize: 16 },
});
