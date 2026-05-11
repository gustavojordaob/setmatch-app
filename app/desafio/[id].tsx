import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

export default function DesafioDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Desafio</Text>
      <Text style={styles.sub}>ID: {id}</Text>
      <Text style={styles.hint}>Aceitar / recusar e detalhes virão aqui.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '900' },
  sub: { color: Colors.textSecondary, marginTop: 8 },
  hint: { color: Colors.textSecondary, marginTop: 16, lineHeight: 20 },
});
