import { StyleSheet, Text, View, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

export default function PagamentoSucessoScreen() {
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.box}>
        <Text style={styles.title}>Pagamento recebido</Text>
        <Text style={styles.sub}>
          Pode voltar ao app Setmatch. O status atualiza em Meus pagamentos.
        </Text>
        {session_id ? <Text style={styles.meta}>Sessão: {session_id}</Text> : null}
        <Text
          style={styles.link}
          onPress={() => void Linking.openURL('setmatch://pagamentos')}
        >
          Abrir Setmatch
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
  meta: { color: Colors.textSecondary, fontSize: 12 },
  link: { color: Colors.accent, fontWeight: 'bold', marginTop: 16, fontSize: 16 },
});
