import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

/** Ponte pós-Stripe: não fica nesta tela — vai direto para Torneios. */
export default function PagamentoSucessoScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace({
      pathname: '/(tabs)/trofeu',
      params: { aba: 'torneios' },
    });
  }, [router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.box}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center' },
  box: { alignItems: 'center', padding: 28 },
});
