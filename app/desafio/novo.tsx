import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

export default function NovoDesafioScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Novo desafio</Text>
      <Text style={styles.sub}>Fluxo de criação de desafio será implementado no próximo passo.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '900' },
  sub: { color: Colors.textSecondary, marginTop: 10, lineHeight: 20 },
});
