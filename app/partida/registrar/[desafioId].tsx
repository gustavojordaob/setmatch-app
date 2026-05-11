import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/colors';

export default function RegistrarPartidaScreen() {
  const { desafioId } = useLocalSearchParams<{ desafioId: string }>();

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Registrar resultado</Text>
      <Text style={styles.sub}>Desafio: {desafioId}</Text>
      <Text style={styles.hint}>Placar por sets e confirmação do vencedor virão aqui.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '900' },
  sub: { color: Colors.textSecondary, marginTop: 8 },
  hint: { color: Colors.textSecondary, marginTop: 16, lineHeight: 20 },
});
